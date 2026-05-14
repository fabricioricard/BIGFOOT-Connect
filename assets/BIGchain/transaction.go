package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
)

type Transaction struct {
	FromAddress string  `json:"from_address"`
	ToAddress   string  `json:"to_address"`
	Amount      float64 `json:"amount"`
	Timestamp   int64   `json:"timestamp"`
	TxType      string  `json:"tx_type"`
	Nonce       int64   `json:"nonce"`
	PublicKey   string  `json:"public_key"` // chave pública do remetente (hex, 64 bytes)
	Signature   string  `json:"signature"`
	Hash        string  `json:"hash"`
}

// =========================
// 🔥 CALCULAR HASH
// =========================

func (tx *Transaction) CalculateHash() string {
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
		Signature   string  `json:"signature"`
	}{
		FromAddress: tx.FromAddress,
		ToAddress:   tx.ToAddress,
		Amount:      tx.Amount,
		Timestamp:   tx.Timestamp,
		TxType:      tx.TxType,
		Nonce:       tx.Nonce,
		Signature:   tx.Signature,
	}

	jsonData, err := json.Marshal(txData)
	if err != nil {
		return ""
	}

	hash := sha256.Sum256(jsonData)
	return fmt.Sprintf("%x", hash)
}

// =========================
// 🔥 VALIDAÇÃO
// =========================

const maxTransactionAmount = 1_000_000_000.0 // 1 bilhão de BIG — teto de sanidade

func (tx *Transaction) Validate() bool {
	if tx == nil {
		return false
	}

	// Tipo obrigatório e válido
	if tx.TxType == "" {
		return false
	}

	validTypes := map[string]bool{
		"transfer":      true,
		"mining_reward": true,
		"relay_reward":  true,
	}
	if !validTypes[tx.TxType] {
		return false
	}

	// ToAddress sempre obrigatório
	if tx.ToAddress == "" {
		return false
	}

	// Amount: positivo, finito e dentro do teto de sanidade
	if tx.Amount <= 0 || math.IsNaN(tx.Amount) || math.IsInf(tx.Amount, 0) {
		return false
	}
	if tx.Amount > maxTransactionAmount {
		return false
	}

	// Timestamp obrigatório
	if tx.Timestamp <= 0 {
		return false
	}

	// Nonce obrigatório para transfers (proteção contra replay)
	if tx.TxType == "transfer" && tx.Nonce <= 0 {
		return false
	}

	// FromAddress obrigatório exceto rewards
	if tx.TxType != "mining_reward" && tx.TxType != "relay_reward" {
		if tx.FromAddress == "" {
			return false
		}
	}

	// Hash obrigatório e correto — não aceita TX sem hash
	if tx.Hash == "" {
		return false
	}
	if tx.Hash != tx.CalculateHash() {
		return false
	}

	// Transfers precisam de assinatura válida e chave pública coerente com o endereço
	if tx.TxType == "transfer" {
		if tx.Signature == "" || tx.PublicKey == "" {
			return false
		}
		if !VerifyAddressMatchesPublicKey(tx) {
			return false
		}
		if !VerifyTransaction(tx) {
			return false
		}
	}

	return true
}

// =========================
// 🔥 VALOR
// =========================

func (tx *Transaction) GetTransactionValue() float64 {
	if tx == nil {
		return 0
	}
	return tx.Amount
}

// =========================
// 🔥 PRINT
// =========================

func (tx *Transaction) PrintTransaction() {
	if tx == nil {
		fmt.Println("❌ Transaction is nil")
		return
	}

	fmt.Println()
	fmt.Println("=== Transaction ===")
	fmt.Printf("Type:      %s\n", tx.TxType)
	fmt.Printf("From:      %s\n", tx.FromAddress)
	fmt.Printf("To:        %s\n", tx.ToAddress)
	fmt.Printf("Amount:    %.8f BIG\n", tx.Amount)
	fmt.Printf("Timestamp: %d\n", tx.Timestamp)
	fmt.Printf("Nonce:     %d\n", tx.Nonce)
	fmt.Printf("Hash:      %s\n", tx.Hash)
	fmt.Println()
}