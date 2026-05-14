package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// =========================
// 📦 TIPOS DE MENSAGEM P2P
// =========================

type MessageType string

const (
	MsgHandshake MessageType = "handshake"
	MsgPing      MessageType = "ping"
	MsgPong      MessageType = "pong"
	MsgGetBlocks MessageType = "get_blocks"
	MsgBlocks    MessageType = "blocks"
	MsgNewBlock  MessageType = "new_block"
	MsgNewTx     MessageType = "new_tx"
	MsgGetPeers  MessageType = "get_peers"
	MsgPeers     MessageType = "peers"
	MsgScore          MessageType = "score"          // anuncia relay score para eleição de líder
	MsgRelayRequest   MessageType = "relay_request"  // requisição de relay real
	MsgRelayChallenge MessageType = "relay_challenge" // desafio anti-fake
	MsgRelayResponse  MessageType = "relay_response"  // resposta ao desafio
)

type P2PMessage struct {
	Type    MessageType `json:"type"`
	Payload string      `json:"payload,omitempty"`
}

// =========================
// 🏗️ STRUCT PRINCIPAL
// =========================

type P2PNode struct {
	relayEngine *RelayMiningEngine
	relayProof  *ProofOfRelayEngine
	nodeID     string
	port       string
	externalIP string
	blockchain *Blockchain

	// Chave: endereço canônico do peer (ex: "[ip]:3001")
	peers map[string]net.Conn
	mutex sync.Mutex
}

// =========================
// 🚀 CONSTRUCTOR
// =========================

func NewP2PNode(nodeID, port string, bc *Blockchain, relay *RelayMiningEngine) *P2PNode {
	return &P2PNode{
		nodeID:     nodeID,
		port:       port,
		blockchain: bc,
		peers:      make(map[string]net.Conn),
		externalIP: getPublicIP(),
		relayEngine: relay,
		relayProof:  nil, // injetado após criação
	}
}

// =========================
// 🌐 START NODE
// =========================

func (p *P2PNode) Start() {
	listener, err := net.Listen("tcp", ":"+p.port)
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	fmt.Println("🌐 P2P running on port :" + p.port)

	go p.bootstrapLoop()
	go p.registerLoop()

	for {
		conn, err := listener.Accept()
		if err != nil {
			continue
		}
		go p.runSession(conn, "", false)
	}
}

// =========================
// 🔁 BOOTSTRAP LOOP
// =========================

func (p *P2PNode) bootstrapLoop() {
	time.Sleep(3 * time.Second)
	p.connectToKnownPeers()

	for {
		time.Sleep(30 * time.Second)
		p.connectToKnownPeers()
	}
}

func (p *P2PNode) connectToKnownPeers() {
	peers := p.fetchPeers()

	p.mutex.Lock()
	connected := make(map[string]bool)
	for addr := range p.peers {
		connected[addr] = true
	}
	p.mutex.Unlock()

	for _, peer := range peers {
		if peer == p.getAddress() || connected[peer] {
			continue
		}
		go p.connectToPeer(peer)
	}
}

// =========================
// 📡 REGISTER LOOP
// =========================

func (p *P2PNode) registerLoop() {
	p.registerNode()

	ticker := time.NewTicker(5 * time.Minute) // register every 5 minutes is enough
	defer ticker.Stop()
	for range ticker.C {
		p.registerNode()
	}
}

// =========================
// 🌍 GET PUBLIC IP
// =========================

func getPublicIP() string {
	resp, err := http.Get("https://api64.ipify.org")
	if err != nil {
		return "127.0.0.1"
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return string(body)
}

// =========================
// 🔗 GET FULL ADDRESS
// =========================

func (p *P2PNode) getAddress() string {
	if stringsContains(p.externalIP, ":") {
		return fmt.Sprintf("[%s]:%s", p.externalIP, p.port)
	}
	return fmt.Sprintf("%s:%s", p.externalIP, p.port)
}

// =========================
// 📤 REGISTER NODE
// =========================

func (p *P2PNode) registerNode() {
	url := "https://api.bigfootconnect.tech/api/peers/register"

	payload := map[string]interface{}{
		"address": p.externalIP,
		"port":    p.port,
		"nodeId":  p.nodeID,
	}

	jsonData, _ := json.Marshal(payload)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Println("❌ Error registering node:", err)
		return
	}
	defer resp.Body.Close()

	fmt.Println("📤 Node registered:", p.getAddress())
}

// =========================
// 📥 FETCH PEERS
// =========================

func (p *P2PNode) fetchPeers() []string {
	url := "https://api.bigfootconnect.tech/api/peers/list"

	resp, err := http.Get(url)
	if err != nil {
		fmt.Println("❌ Error fetching peers:", err)
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
		Peers   []struct {
			Address string `json:"address"`
		} `json:"peers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Println("❌ Error decoding peers:", err)
		return nil
	}

	fmt.Println("🌐 Peers found:", len(result.Peers))

	var peers []string
	for _, pr := range result.Peers {
		peers = append(peers, pr.Address)
	}

	return peers
}

// =========================
// 🔌 CONNECT TO PEER (saída)
// =========================

func (p *P2PNode) connectToPeer(address string) {
	p.mutex.Lock()
	if _, exists := p.peers[address]; exists {
		p.mutex.Unlock()
		return
	}
	// Reserva o slot — evita tentativas simultâneas ao mesmo endereço
	p.peers[address] = nil
	p.mutex.Unlock()

	fmt.Println("🔎 Trying to connect:", address)

	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		fmt.Println("❌ Connection failed:", address)
		p.mutex.Lock()
		delete(p.peers, address)
		p.mutex.Unlock()
		return
	}

	fmt.Println("🔌 Connected to:", address)

	go p.runSession(conn, address, true)
}

// =========================
// 🤝 SESSÃO P2P UNIFICADA
// =========================

// runSession gerencia toda a vida de uma conexão TCP com um peer.
//
//   - outbound=true:  nós iniciamos; canonicalAddr já conhecido.
//   - outbound=false: peer nos conectou; canonicalAddr="" até handshake.
func (p *P2PNode) runSession(conn net.Conn, canonicalAddr string, outbound bool) {
	reader := bufio.NewReader(conn)

	// ── FASE 1: HANDSHAKE ──────────────────────────────────────────────────

	// Anuncia nosso endereço canônico imediatamente
	if err := p.sendMessage(conn, P2PMessage{
		Type:    MsgHandshake,
		Payload: p.getAddress(),
	}); err != nil {
		conn.Close()
		if outbound {
			p.mutex.Lock()
			delete(p.peers, canonicalAddr)
			p.mutex.Unlock()
		}
		return
	}

	// Aguarda handshake do peer (timeout de 10s)
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	line, err := reader.ReadString('\n')
	if err != nil {
		conn.Close()
		if outbound {
			p.mutex.Lock()
			delete(p.peers, canonicalAddr)
			p.mutex.Unlock()
		}
		return
	}

	var hsMsg P2PMessage
	if err := json.Unmarshal([]byte(strings.TrimSpace(line)), &hsMsg); err != nil || hsMsg.Type != MsgHandshake {
		fmt.Println("⚠️ Invalid handshake — connection refused")
		conn.Close()
		if outbound {
			p.mutex.Lock()
			delete(p.peers, canonicalAddr)
			p.mutex.Unlock()
		}
		return
	}

	peerCanonical := hsMsg.Payload

	// ── FASE 2: DEDUPLICAÇÃO ───────────────────────────────────────────────

	p.mutex.Lock()

	var connToClose net.Conn

	if existing, exists := p.peers[peerCanonical]; exists && existing != nil {
		if p.getAddress() < peerCanonical {
			// Nós fechamos esta nova conexão
			p.mutex.Unlock()
			fmt.Println("♻️ Duplicate discarded (we closed):", peerCanonical)
			conn.Close()
			return
		}
		// Substituímos a antiga pela nova — fecha a antiga fora do mutex
		connToClose = existing
		fmt.Println("♻️ Duplicate resolved — using new connection:", peerCanonical)
	}

	p.peers[peerCanonical] = conn
	p.mutex.Unlock()

	// Fecha a conexão antiga FORA do mutex para evitar deadlock
	if connToClose != nil {
		connToClose.Close()
	}

	fmt.Println("🔗 Peer identified:", peerCanonical)

	// Anuncia nosso score imediatamente para este peer poder participar da eleição
	if p.relayEngine != nil {
		go func() {
			time.Sleep(200 * time.Millisecond)
			p.relayEngine.announceScore()
		}()
	}

	// ── FASE 3: SESSÃO ATIVA ───────────────────────────────────────────────

	defer func() {
		conn.Close()
		p.mutex.Lock()
		if p.peers[peerCanonical] == conn {
			delete(p.peers, peerCanonical)
		}
		p.mutex.Unlock()
		fmt.Println("❌ Peer disconnected:", peerCanonical)
	}()

	conn.SetDeadline(time.Time{})

	pingOK := make(chan struct{}, 1)

	// Heartbeat: ping a cada 20s, espera pong por 15s.
	// Só incrementa missedPings se o pong NÃO chegou nesse período.
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		missed := 0
		for range ticker.C {
			if err := p.sendMessage(conn, P2PMessage{Type: MsgPing}); err != nil {
				return
			}
			// Drena canal antes de esperar
			select {
			case <-pingOK:
				missed = 0
				continue
			default:
			}
			// Aguarda pong por até 15s
			select {
			case <-pingOK:
				missed = 0
			case <-time.After(15 * time.Second):
				missed++
				if missed >= 3 {
					fmt.Println("⚠️ Peer unresponsive — closing:", peerCanonical)
					conn.Close()
					return
				}
			}
		}
	}()

	// Solicita chain para sincronizar (em goroutine para não bloquear a leitura)
	go func() {
		time.Sleep(100 * time.Millisecond)
		chain := p.blockchain.GetChain()
		lastIndex := len(chain) - 1
		if lastIndex < 0 {
			lastIndex = 0
		}
		_ = p.sendMessage(conn, P2PMessage{
			Type:    MsgGetBlocks,
			Payload: fmt.Sprintf("%d", lastIndex+1), // pede blocos a partir do próximo
		})
	}()

	for {
		// Sem deadline no loop — o heartbeat acima controla a detecção de morte
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var msg P2PMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			fmt.Println("⚠️ Invalid message from", peerCanonical)
			continue
		}

		p.handleMessage(conn, peerCanonical, msg, pingOK)
	}
}

// =========================
// 📨 HANDLE MESSAGE
// =========================

func (p *P2PNode) handleMessage(conn net.Conn, from string, msg P2PMessage, pingOK chan struct{}) {
	switch msg.Type {

	case MsgHandshake:
		// Handshakes extras pós-fase-inicial são ignorados

	case MsgPing:
		_ = p.sendMessage(conn, P2PMessage{Type: MsgPong})

	case MsgPong:
		// Sinaliza ao heartbeat que o peer está vivo
		select {
		case pingOK <- struct{}{}:
		default:
		}

	case MsgGetBlocks:
		// Payload: index of the last block the peer has
		// We always include the genesis so ReplaceChain can validate
		chain := p.blockchain.GetChain()
		fromIndex := 0
		if msg.Payload != "" {
			fmt.Sscanf(msg.Payload, "%d", &fromIndex)
		}
		// Only send partial chain if peer already has our genesis
		// (i.e. fromIndex > 0 means they already have block 0)
		// Always include from block 0 so isValidChain passes
		var toSend []Block
		if fromIndex > 1 && fromIndex < len(chain) {
			// Peer has genesis + some blocks — send only what's missing
			// but include genesis as first element for validation
			toSend = append([]Block{chain[0]}, chain[fromIndex:]...)
		} else {
			// Send full chain
			toSend = chain
		}
		if len(toSend) == 0 {
			return
		}
		chainJSON, err := json.Marshal(toSend)
		if err == nil {
			_ = p.sendMessage(conn, P2PMessage{Type: MsgBlocks, Payload: string(chainJSON)})
		}

	case MsgBlocks:
		var receivedChain []Block
		if err := json.Unmarshal([]byte(msg.Payload), &receivedChain); err != nil {
			fmt.Println("⚠️ Error decoding chain from", from)
			return
		}
		if p.blockchain.ReplaceChain(receivedChain) {
			fmt.Printf("🔄 Chain synced: %d blocks from %s\n", len(receivedChain), from)
		}

	case MsgNewBlock:
		var block Block
		if err := json.Unmarshal([]byte(msg.Payload), &block); err != nil {
			fmt.Println("⚠️ Error decoding block from", from)
			return
		}
		// Proof of Relay: passa o endereço de quem nos enviou o bloco
		if p.blockchain.AddReceivedBlock(block, p.nodeID) {
			fmt.Println("📦 New block accepted from:", from)
			if p.relayEngine != nil {
				p.relayEngine.OnBlockRelayed(p.nodeID)
				p.relayEngine.OnExternalBlock()
			}
			// Update node count for emission calculation
			p.blockchain.SetActiveNodes(p.GetPeerCount() + 1)
			p.broadcastExcept(msg, from)
		}

	case MsgNewTx:
		fmt.Println("💸 New transaction received from:", from)
		if p.relayEngine != nil {
			p.relayEngine.OnTxRelayed(p.nodeID)
		}
		p.broadcastExcept(msg, from)

	case MsgRelayRequest:
		// Recebe uma requisição de relay real — valida, assina e repropaga
		if p.relayProof == nil {
			return
		}
		var req RelayRequest
		if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
			return
		}
		forwarded, err := p.relayProof.ReceiveRelay(&req, from)
		if err != nil {
			// Relay inválido — ignora silenciosamente (não propaga lixo)
			return
		}
		// Propaga para frente (exceto quem nos enviou)
		data, _ := json.Marshal(forwarded)
		p.broadcastExcept(P2PMessage{Type: MsgRelayRequest, Payload: string(data)}, from)

	case MsgRelayChallenge:
		// Recebemos um desafio — precisamos provar que relayamos
		if p.relayProof == nil {
			return
		}
		var ch RelayChallenge
		if err := json.Unmarshal([]byte(msg.Payload), &ch); err != nil {
			return
		}
		resp, err := p.relayProof.RespondToChallenge(&ch)
		if err != nil {
			// Não temos prova — não respondemos (penalidade virá)
			return
		}
		data, _ := json.Marshal(resp)
		_ = p.sendMessage(conn, P2PMessage{Type: MsgRelayResponse, Payload: string(data)})

	case MsgRelayResponse:
		// Recebemos a resposta de um desafio que emitimos
		if p.relayProof == nil {
			return
		}
		var resp ChallengeResponse
		if err := json.Unmarshal([]byte(msg.Payload), &resp); err != nil {
			return
		}
		// Verificação usa a chave pública do nó (simplificado: confia na reputação)
		_ = p.relayProof.VerifyChallengeResponse(&resp, "")

	case MsgScore:
		// Receives relay score from a peer — used in leader election
		var ps PeerScore
		if err := json.Unmarshal([]byte(msg.Payload), &ps); err != nil {
			return
		}
		// Record which TCP connection sent this score
		// so isLeader() can verify they are still connected
		ps.PeerAddr = from
		if p.relayEngine != nil {
			p.relayEngine.UpdatePeerScore(ps)
		}

	case MsgGetPeers:
		p.mutex.Lock()
		var list []string
		for addr := range p.peers {
			list = append(list, addr)
		}
		p.mutex.Unlock()

		listJSON, _ := json.Marshal(list)
		_ = p.sendMessage(conn, P2PMessage{Type: MsgPeers, Payload: string(listJSON)})

	case MsgPeers:
		var peerList []string
		if err := json.Unmarshal([]byte(msg.Payload), &peerList); err != nil {
			return
		}
		p.mutex.Lock()
		connected := make(map[string]bool)
		for addr := range p.peers {
			connected[addr] = true
		}
		p.mutex.Unlock()

		for _, addr := range peerList {
			if addr != p.getAddress() && !connected[addr] {
				go p.connectToPeer(addr)
			}
		}
	}
}

// =========================
// 📢 BROADCAST
// =========================

func (p *P2PNode) BroadcastMessage(msg P2PMessage) {
	p.broadcastExcept(msg, "")
}

func (p *P2PNode) broadcastExcept(msg P2PMessage, exceptAddr string) {
	p.mutex.Lock()
	conns := make(map[string]net.Conn)
	for addr, conn := range p.peers {
		if conn != nil && addr != exceptAddr {
			conns[addr] = conn
		}
	}
	p.mutex.Unlock()

	for addr, conn := range conns {
		if err := p.sendMessage(conn, msg); err != nil {
			fmt.Println("❌ Error sending to", addr)
		}
	}
}

func (p *P2PNode) BroadcastNewBlock(block Block) {
	payload, err := json.Marshal(block)
	if err != nil {
		return
	}
	p.BroadcastMessage(P2PMessage{Type: MsgNewBlock, Payload: string(payload)})
}

func (p *P2PNode) BroadcastNewTx(tx interface{}) {
	payload, err := json.Marshal(tx)
	if err != nil {
		return
	}
	p.BroadcastMessage(P2PMessage{Type: MsgNewTx, Payload: string(payload)})
}

// BroadcastScore anuncia o relay score deste node para os peers.
func (p *P2PNode) BroadcastScore(ps PeerScore) {
	payload, err := json.Marshal(ps)
	if err != nil {
		return
	}
	p.BroadcastMessage(P2PMessage{Type: MsgScore, Payload: string(payload)})
}

// BroadcastRelayRequest envia uma requisição de relay pela rede.
func (p *P2PNode) BroadcastRelayRequest(req *RelayRequest) {
	payload, err := json.Marshal(req)
	if err != nil {
		return
	}
	p.BroadcastMessage(P2PMessage{Type: MsgRelayRequest, Payload: string(payload)})
}

// SetRelayProof injeta o ProofOfRelayEngine após criação.
func (p *P2PNode) SetRelayProof(rpe *ProofOfRelayEngine) {
	p.relayProof = rpe
}

// =========================
// ✉️ SEND MESSAGE
// =========================

func (p *P2PNode) sendMessage(conn net.Conn, msg P2PMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	conn.SetWriteDeadline(time.Now().Add(30 * time.Second)) // 30s para chains grandes
	_, err = conn.Write(data)
	return err
}

// =========================
// 📊 STATS
// =========================

func (p *P2PNode) GetPeerCount() int {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	count := 0
	for _, conn := range p.peers {
		if conn != nil {
			count++
		}
	}
	return count
}

func (p *P2PNode) GetActivePeerList() []string {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	var list []string
	for addr, conn := range p.peers {
		if conn != nil {
			list = append(list, addr)
		}
	}
	return list
}

// GetActivePeerAddresses returns canonical addresses of currently connected peers.
func (p *P2PNode) GetActivePeerAddresses() []string {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	var list []string
	for addr, conn := range p.peers {
		if conn != nil {
			list = append(list, addr)
		}
	}
	return list
}

// =========================
// 🔧 HELPERS
// =========================

func stringsContains(s, substr string) bool {
	return bytes.Contains([]byte(s), []byte(substr))
}