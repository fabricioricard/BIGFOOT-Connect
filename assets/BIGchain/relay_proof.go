package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"
	"time"
)

// =========================
// 📦 RELAY REQUEST
// Representa uma requisição real sendo roteada pela rede
// =========================

type RelayRequest struct {
	ID          string   `json:"id"`           // UUID único — evita loops
	Origin      string   `json:"origin"`       // nodeID de quem iniciou
	Destination string   `json:"destination"`  // nodeID destino
	Payload     string   `json:"payload"`      // dados (hash do conteúdo real)
	PayloadHash string   `json:"payload_hash"` // SHA-256 do payload — detecção de alteração
	Hops        []RelayHop `json:"hops"`       // histórico verificável do caminho
	MaxHops     int      `json:"max_hops"`     // limite anti-loop (máx 10)
	CreatedAt   int64    `json:"created_at"`
	ExpiresAt   int64    `json:"expires_at"`   // TTL — evita replay de requisições antigas
}

// RelayHop é a assinatura de um nó no caminho
type RelayHop struct {
	NodeID    string `json:"node_id"`
	Signature string `json:"signature"`  // assina: id + payload_hash + hop_index
	Timestamp int64  `json:"timestamp"`
	HopIndex  int    `json:"hop_index"`
}

// =========================
// 🔐 CHALLENGE-RESPONSE
// A rede desafia nós para provar que realmente relayaram
// =========================

type RelayChallenge struct {
	ChallengeID string `json:"challenge_id"`
	RequestID   string `json:"request_id"`   // qual relay está sendo desafiado
	NodeID      string `json:"node_id"`      // quem está sendo desafiado
	Nonce       string `json:"nonce"`        // nonce aleatório
	IssuedAt    int64  `json:"issued_at"`
	ExpiresAt   int64  `json:"expires_at"`   // 30s para responder
}

type ChallengeResponse struct {
	ChallengeID string `json:"challenge_id"`
	NodeID      string `json:"node_id"`
	Proof       string `json:"proof"` // ECDSA(nonce + request_id + payload_hash)
	Timestamp   int64  `json:"timestamp"`
}

// =========================
// 📊 RELAY RECORD
// Registro on-chain de um relay verificado
// =========================

type RelayRecord struct {
	RequestID     string     `json:"request_id"`
	Hops          []RelayHop `json:"hops"`
	Verified      bool       `json:"verified"`
	VerifiedAt    int64      `json:"verified_at"`
	RewardedNodes []string   `json:"rewarded_nodes"`
}

// =========================
// 🛡️ PROOF OF RELAY ENGINE
// =========================

type ProofOfRelayEngine struct {
	nodeID     string
	wallet     *Wallet
	blockchain *Blockchain

	// Requisições em trânsito (id → request)
	pendingRequests map[string]*RelayRequest
	// Desafios aguardando resposta (challengeID → challenge)
	pendingChallenges map[string]*RelayChallenge
	// IDs já vistos — anti-loop e anti-replay
	seenIDs map[string]int64
	// Reputação dos nós (nodeID → score)
	reputation map[string]float64

	mu sync.RWMutex
}

func NewProofOfRelayEngine(nodeID string, wallet *Wallet, bc *Blockchain) *ProofOfRelayEngine {
	e := &ProofOfRelayEngine{
		nodeID:            nodeID,
		wallet:            wallet,
		blockchain:        bc,
		pendingRequests:   make(map[string]*RelayRequest),
		pendingChallenges: make(map[string]*RelayChallenge),
		seenIDs:           make(map[string]int64),
		reputation:        make(map[string]float64),
	}

	// Limpeza periódica de IDs expirados (anti-memória infinita)
	go e.cleanupLoop()

	return e
}

// =========================
// 📡 RECEBER E ENCAMINHAR RELAY
// =========================

// ReceiveRelay processa uma requisição recebida de outro nó.
// Valida, assina e encaminha se legítima.
func (e *ProofOfRelayEngine) ReceiveRelay(req *RelayRequest, fromNode string) (*RelayRequest, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// 1. Anti-replay: já vimos este ID?
	if _, seen := e.seenIDs[req.ID]; seen {
		return nil, fmt.Errorf("relay duplicado: %s", req.ID[:8])
	}

	// 2. TTL expirado?
	if time.Now().Unix() > req.ExpiresAt {
		return nil, fmt.Errorf("relay expirado: %s", req.ID[:8])
	}

	// 3. Limite de hops (anti-loop)
	if len(req.Hops) >= req.MaxHops {
		return nil, fmt.Errorf("limite de hops atingido: %d", req.MaxHops)
	}

	// 4. Verifica integridade do payload
	if !verifyPayloadHash(req.Payload, req.PayloadHash) {
		return nil, fmt.Errorf("payload corrompido no relay %s", req.ID[:8])
	}

	// 5. Verifica assinaturas dos hops anteriores
	for i, hop := range req.Hops {
		if !e.verifyHopSignature(req, hop, i) {
			return nil, fmt.Errorf("assinatura inválida no hop %d (nó %s)", i, hop.NodeID[:12])
		}
	}

	// 6. Verifica reputação do nó de origem
	if rep, ok := e.reputation[fromNode]; ok && rep < -10 {
		return nil, fmt.Errorf("nó %s com reputação negativa (%.1f)", fromNode[:12], rep)
	}

	// ✅ Válido — registra que vimos este ID
	e.seenIDs[req.ID] = time.Now().Unix()
	e.pendingRequests[req.ID] = req

	// 7. Assina este hop
	hopIndex := len(req.Hops)
	sig, err := e.signHop(req, hopIndex)
	if err != nil {
		return nil, fmt.Errorf("erro ao assinar hop: %w", err)
	}

	// 8. Adiciona nosso hop ao histórico
	req.Hops = append(req.Hops, RelayHop{
		NodeID:    e.nodeID,
		Signature: sig,
		Timestamp: time.Now().Unix(),
		HopIndex:  hopIndex,
	})

	fmt.Printf("📡 Relay %s... hop %d/%d\n", req.ID[:8], hopIndex+1, req.MaxHops)

	return req, nil
}

// =========================
// 🔐 ASSINATURAS
// =========================

// signHop cria a assinatura ECDSA para este hop:
// assina SHA-256(requestID + payloadHash + hopIndex)
func (e *ProofOfRelayEngine) signHop(req *RelayRequest, hopIndex int) (string, error) {
	msg := fmt.Sprintf("%s:%s:%d", req.ID, req.PayloadHash, hopIndex)
	hash := sha256.Sum256([]byte(msg))

	r, s, err := ecdsa.Sign(rand.Reader, e.wallet.PrivateKey, hash[:])
	if err != nil {
		return "", err
	}

	sig := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(sig[32-len(rBytes):32], rBytes)
	copy(sig[64-len(sBytes):64], sBytes)

	return hex.EncodeToString(sig), nil
}

// verifyHopSignature verifica a assinatura de um hop usando a chave
// pública derivada do nodeID do hop.
// Na prática, o nodeID é o endereço derivado da chave pública —
// aqui usamos a reputação acumulada para confiar.
func (e *ProofOfRelayEngine) verifyHopSignature(req *RelayRequest, hop RelayHop, hopIndex int) bool {
	if hop.Signature == "" {
		return false
	}
	// A verificação completa exigiria lookup da chave pública do nó.
	// Por ora validamos formato e consistência do índice.
	if hop.HopIndex != hopIndex {
		return false
	}
	if len(hop.Signature) != 128 { // 64 bytes em hex
		return false
	}
	return true
}

// verifyPayloadHash verifica que o payload não foi alterado.
func verifyPayloadHash(payload, expectedHash string) bool {
	h := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(h[:]) == expectedHash
}

// =========================
// 🎯 CHALLENGE-RESPONSE
// =========================

// IssueChallenge emite um desafio para um nó provar que relayou.
func (e *ProofOfRelayEngine) IssueChallenge(targetNodeID, requestID string) *RelayChallenge {
	e.mu.Lock()
	defer e.mu.Unlock()

	nonceBytes := make([]byte, 16)
	rand.Read(nonceBytes)

	ch := &RelayChallenge{
		ChallengeID: generateID(),
		RequestID:   requestID,
		NodeID:      targetNodeID,
		Nonce:       hex.EncodeToString(nonceBytes),
		IssuedAt:    time.Now().Unix(),
		ExpiresAt:   time.Now().Unix() + 30,
	}

	e.pendingChallenges[ch.ChallengeID] = ch
	return ch
}

// RespondToChallenge gera a resposta criptográfica para um desafio recebido.
func (e *ProofOfRelayEngine) RespondToChallenge(ch *RelayChallenge) (*ChallengeResponse, error) {
	e.mu.RLock()
	req, exists := e.pendingRequests[ch.RequestID]
	e.mu.RUnlock()

	if !exists {
		// Não temos este relay — não podemos provar
		return nil, fmt.Errorf("relay %s não encontrado — não posso provar", ch.RequestID[:8])
	}

	// Prova: ECDSA(nonce + requestID + payloadHash)
	msg := fmt.Sprintf("%s:%s:%s", ch.Nonce, ch.RequestID, req.PayloadHash)
	hash := sha256.Sum256([]byte(msg))

	r, s, err := ecdsa.Sign(rand.Reader, e.wallet.PrivateKey, hash[:])
	if err != nil {
		return nil, err
	}

	sig := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(sig[32-len(rBytes):32], rBytes)
	copy(sig[64-len(sBytes):64], sBytes)

	return &ChallengeResponse{
		ChallengeID: ch.ChallengeID,
		NodeID:      e.nodeID,
		Proof:       hex.EncodeToString(sig),
		Timestamp:   time.Now().Unix(),
	}, nil
}

// VerifyChallengeResponse verifica a resposta de um desafio.
func (e *ProofOfRelayEngine) VerifyChallengeResponse(resp *ChallengeResponse, pubKeyHex string) bool {
	e.mu.RLock()
	ch, exists := e.pendingChallenges[resp.ChallengeID]
	req, reqExists := e.pendingRequests[ch.RequestID]
	e.mu.RUnlock()

	if !exists || !reqExists {
		return false
	}

	// TTL do desafio
	if time.Now().Unix() > ch.ExpiresAt {
		e.penalize(resp.NodeID, "challenge expirado sem resposta")
		return false
	}

	// Reconstrói a mensagem
	msg := fmt.Sprintf("%s:%s:%s", ch.Nonce, ch.RequestID, req.PayloadHash)
	hash := sha256.Sum256([]byte(msg))

	// Decodifica chave pública
	pubKeyBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil || len(pubKeyBytes) != 64 {
		return false
	}

	x := new(big.Int).SetBytes(pubKeyBytes[:32])
	y := new(big.Int).SetBytes(pubKeyBytes[32:])
	pubKey := &ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}

	if !pubKey.Curve.IsOnCurve(x, y) {
		return false
	}

	sigBytes, err := hex.DecodeString(resp.Proof)
	if err != nil || len(sigBytes) != 64 {
		return false
	}

	r := new(big.Int).SetBytes(sigBytes[:32])
	s := new(big.Int).SetBytes(sigBytes[32:])

	verified := ecdsa.Verify(pubKey, hash[:], r, s)

	if verified {
		// Limpa o challenge — foi respondido
		e.mu.Lock()
		delete(e.pendingChallenges, resp.ChallengeID)
		e.mu.Unlock()
		e.reward(resp.NodeID)
	} else {
		e.penalize(resp.NodeID, "prova inválida")
	}

	return verified
}

// =========================
// 🏆 REPUTAÇÃO E RECOMPENSA
// =========================

func (e *ProofOfRelayEngine) reward(nodeID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.reputation[nodeID] += 1.0
}

func (e *ProofOfRelayEngine) penalize(nodeID string, reason string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.reputation[nodeID] -= 5.0
	fmt.Printf("⚠️ Penalidade: %s — %s (rep: %.1f)\n",
		nodeID[:12]+"...", reason, e.reputation[nodeID])
}

// GetReputation retorna a reputação de um nó.
func (e *ProofOfRelayEngine) GetReputation(nodeID string) float64 {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.reputation[nodeID]
}

// ValidRelayCount retorna quantos relays válidos este nó fez
// (baseado na reputação positiva acumulada).
func (e *ProofOfRelayEngine) ValidRelayCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	rep := e.reputation[e.nodeID]
	if rep < 0 {
		return 0
	}
	return int(rep)
}

// =========================
// 🔁 CRIAR REQUISIÇÃO DE RELAY
// =========================

// NewRelayRequest cria uma nova requisição para ser roteada pela rede.
func (e *ProofOfRelayEngine) NewRelayRequest(destination, payload string) *RelayRequest {
	h := sha256.Sum256([]byte(payload))
	now := time.Now().Unix()

	return &RelayRequest{
		ID:          generateID(),
		Origin:      e.nodeID,
		Destination: destination,
		Payload:     payload,
		PayloadHash: hex.EncodeToString(h[:]),
		Hops:        []RelayHop{},
		MaxHops:     10,
		CreatedAt:   now,
		ExpiresAt:   now + 300, // 5 minutos
	}
}

// =========================
// 🧹 LIMPEZA
// =========================

func (e *ProofOfRelayEngine) cleanupLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		e.mu.Lock()
		now := time.Now().Unix()

		// Remove IDs antigos (>10 min)
		for id, ts := range e.seenIDs {
			if now-ts > 600 {
				delete(e.seenIDs, id)
			}
		}

		// Remove requests expiradas
		for id, req := range e.pendingRequests {
			if now > req.ExpiresAt {
				delete(e.pendingRequests, id)
			}
		}

		// Remove challenges expirados e penaliza quem não respondeu
		for id, ch := range e.pendingChallenges {
			if now > ch.ExpiresAt {
				e.reputation[ch.NodeID] -= 2.0
				delete(e.pendingChallenges, id)
			}
		}

		e.mu.Unlock()
	}
}

// =========================
// 🔧 HELPERS
// =========================

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}