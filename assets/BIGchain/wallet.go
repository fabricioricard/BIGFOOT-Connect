package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
)

type Wallet struct {
	PrivateKey *ecdsa.PrivateKey
	PublicKey  []byte // sempre 64 bytes: 32 (X) + 32 (Y), com zero-padding
	Address    string
}

// =========================
// 🔥 CRIAÇÃO / CARREGAMENTO
// =========================

// NewWallet cria uma wallet nova ou carrega do disco se já existir.
func NewWallet(filepath string) *Wallet {
	if filepath != "" {
		if w, err := loadWallet(filepath); err == nil {
			fmt.Println("🔑 Wallet loaded:", w.Address)
			return w
		}
	}

	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}

	pubKey := marshalPublicKey(&privateKey.PublicKey)
	address := generateAddress(pubKey)

	w := &Wallet{
		PrivateKey: privateKey,
		PublicKey:  pubKey,
		Address:    address,
	}

	if filepath != "" {
		if err := w.Save(filepath); err != nil {
			fmt.Println("⚠️ Could not save wallet:", err)
		}
	}

	return w
}

// marshalPublicKey serializa a chave pública em exatamente 64 bytes,
// aplicando zero-padding em X e Y se necessário.
func marshalPublicKey(pub *ecdsa.PublicKey) []byte {
	result := make([]byte, 64)
	xBytes := pub.X.Bytes()
	yBytes := pub.Y.Bytes()
	copy(result[32-len(xBytes):32], xBytes)
	copy(result[64-len(yBytes):64], yBytes)
	return result
}

// =========================
// 🔥 ADDRESS
// =========================

// generateAddress deriva o endereço da chave pública.
// Usa SHA-256 completo (64 hex chars = 32 bytes) para máxima segurança.
func generateAddress(publicKey []byte) string {
	hash := sha256.Sum256(publicKey)
	return "big" + hex.EncodeToString(hash[:]) // 3 + 64 = 67 chars
}

// =========================
// 🔥 HASH PARA ASSINATURA
// =========================

// CalculateSigningHash computa o hash dos campos da TX *sem* assinatura e sem hash final.
// Este é o dado que é assinado e verificado.
func (tx *Transaction) CalculateSigningHash() string {
	if tx == nil {
		return ""
	}

	txData := struct {
		FromAddress string  `json:"from_address"`
		ToAddress   string  `json:"to_address"`
		Amount      float64 `json:"amount"`
		Timestamp   int64   `json:"timestamp"`
		TxType      string  `json:"tx_type"`
		Nonce       int64   `json:"nonce"`
	}{
		FromAddress: tx.FromAddress,
		ToAddress:   tx.ToAddress,
		Amount:      tx.Amount,
		Timestamp:   tx.Timestamp,
		TxType:      tx.TxType,
		Nonce:       tx.Nonce,
	}

	data, _ := json.Marshal(txData)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// =========================
// 🔥 ASSINAR TRANSAÇÃO
// =========================

// SignTransaction assina a TX com a chave privada da wallet,
// embute a chave pública na TX (para verificação futura) e gera o hash final.
func (w *Wallet) SignTransaction(tx *Transaction) error {
	if w.PrivateKey == nil {
		return fmt.Errorf("private key is nil")
	}
	if tx == nil {
		return fmt.Errorf("transaction is nil")
	}

	// Embute a chave pública para que qualquer node possa verificar
	tx.PublicKey = hex.EncodeToString(w.PublicKey)

	signingHash := tx.CalculateSigningHash()
	hashBytes, err := hex.DecodeString(signingHash)
	if err != nil {
		return err
	}

	r, s, err := ecdsa.Sign(rand.Reader, w.PrivateKey, hashBytes)
	if err != nil {
		return err
	}

	// Serializa r e s em exatamente 64 bytes com zero-padding
	signature := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(signature[32-len(rBytes):32], rBytes)
	copy(signature[64-len(sBytes):64], sBytes)

	tx.Signature = hex.EncodeToString(signature)

	// Hash final inclui a assinatura
	tx.Hash = tx.CalculateHash()

	return nil
}

// =========================
// 🔥 VERIFICAR ASSINATURA
// =========================

// VerifyTransaction verifica a assinatura usando a chave pública embutida na TX.
func VerifyTransaction(tx *Transaction) bool {
	if tx == nil || tx.Signature == "" || tx.PublicKey == "" {
		return false
	}

	pubKeyBytes, err := hex.DecodeString(tx.PublicKey)
	if err != nil || len(pubKeyBytes) != 64 {
		return false
	}

	return VerifyTransactionSignature(tx, pubKeyBytes)
}

// VerifyTransactionSignature verifica com uma chave pública explícita.
func VerifyTransactionSignature(tx *Transaction, publicKey []byte) bool {
	if tx == nil || tx.Signature == "" {
		return false
	}
	if len(publicKey) != 64 {
		return false
	}

	signatureBytes, err := hex.DecodeString(tx.Signature)
	if err != nil || len(signatureBytes) != 64 {
		return false
	}

	r := new(big.Int).SetBytes(signatureBytes[:32])
	s := new(big.Int).SetBytes(signatureBytes[32:64])

	x := new(big.Int).SetBytes(publicKey[:32])
	y := new(big.Int).SetBytes(publicKey[32:64])

	pubKey := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     x,
		Y:     y,
	}

	// Verifica que o ponto está na curva (evita ataques de chave inválida)
	if !pubKey.Curve.IsOnCurve(x, y) {
		return false
	}

	signingHash := tx.CalculateSigningHash()
	hashBytes, err := hex.DecodeString(signingHash)
	if err != nil {
		return false
	}

	return ecdsa.Verify(pubKey, hashBytes, r, s)
}

// VerifyAddressMatchesPublicKey confirma que o FromAddress da TX
// corresponde à chave pública embutida — evita que alguém use chave alheia.
func VerifyAddressMatchesPublicKey(tx *Transaction) bool {
	if tx == nil || tx.PublicKey == "" {
		return false
	}
	pubKeyBytes, err := hex.DecodeString(tx.PublicKey)
	if err != nil {
		return false
	}
	expectedAddress := generateAddress(pubKeyBytes)
	return tx.FromAddress == expectedAddress
}

// =========================
// 🔥 PERSISTÊNCIA
// =========================

type walletFile struct {
	PrivateKeyHex string `json:"private_key"`
	PublicKeyHex  string `json:"public_key"`
	Address       string `json:"address"`
}

// Save salva a wallet em disco (chave privada em hex).
func (w *Wallet) Save(filepath string) error {
	privBytes := w.PrivateKey.D.Bytes()
	// Garante 32 bytes com zero-padding
	paddedPriv := make([]byte, 32)
	copy(paddedPriv[32-len(privBytes):], privBytes)

	data := walletFile{
		PrivateKeyHex: hex.EncodeToString(paddedPriv),
		PublicKeyHex:  hex.EncodeToString(w.PublicKey),
		Address:       w.Address,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath, jsonData, 0600) // 0600: só o dono lê
}

// loadWallet carrega uma wallet salva do disco.
func loadWallet(filepath string) (*Wallet, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}

	var wf walletFile
	if err := json.Unmarshal(data, &wf); err != nil {
		return nil, err
	}

	privBytes, err := hex.DecodeString(wf.PrivateKeyHex)
	if err != nil {
		return nil, err
	}

	curve := elliptic.P256()
	d := new(big.Int).SetBytes(privBytes)

	// Reconstrói a chave pública a partir de D
	x, y := curve.ScalarBaseMult(privBytes)
	privateKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{Curve: curve, X: x, Y: y},
		D:         d,
	}

	pubKey := marshalPublicKey(&privateKey.PublicKey)

	// Valida que o endereço bate com a chave pública
	expectedAddress := generateAddress(pubKey)
	if expectedAddress != wf.Address {
		return nil, fmt.Errorf("wallet address does not match public key")
	}

	return &Wallet{
		PrivateKey: privateKey,
		PublicKey:  pubKey,
		Address:    wf.Address,
	}, nil
}

// =========================
// 🔥 DEBUG
// =========================

func (w *Wallet) PrintWallet() {
	fmt.Println("\n🔐 === WALLET ===")
	fmt.Println("Address:", w.Address)
	fmt.Println("=================\n")
}