package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
)

type Block struct {
	Index        int           `json:"index"`
	Timestamp    int64         `json:"timestamp"`
	Transactions []Transaction `json:"transactions"`
	PreviousHash string        `json:"previous_hash"`
	Hash         string        `json:"hash"`
	MinedBy      string        `json:"mined_by"`
	RelayedBy    string        `json:"relayed_by"`
	RelayScore   float64       `json:"relay_score"`  // miner score at block time
	RelayCredits int64         `json:"relay_credits"` // créditos gastos para minerar
}

// CalculateHash computes the block hash (no PoW — single SHA-256).
func (b *Block) CalculateHash() string {
	if b == nil {
		return ""
	}
	blockData := struct {
		Index        int           `json:"index"`
		Timestamp    int64         `json:"timestamp"`
		Transactions []Transaction `json:"transactions"`
		PreviousHash string        `json:"previous_hash"`
		MinedBy      string        `json:"mined_by"`
		RelayedBy    string        `json:"relayed_by"`
		RelayScore   float64       `json:"relay_score"`
		RelayCredits int64         `json:"relay_credits"`
	}{
		b.Index, b.Timestamp, b.Transactions,
		b.PreviousHash, b.MinedBy, b.RelayedBy,
		b.RelayScore, b.RelayCredits,
	}
	data, err := json.Marshal(blockData)
	if err != nil {
		return ""
	}
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash)
}

// ValidateBlock valida estrutura e hash — sem verificação de dificuldade.
func (b *Block) ValidateBlock(previousBlock *Block) bool {
	if b == nil {
		return false
	}
	if previousBlock != nil && b.PreviousHash != previousBlock.Hash {
		return false
	}
	if b.CalculateHash() != b.Hash {
		return false
	}
	for _, tx := range b.Transactions {
		if !tx.Validate() {
			return false
		}
	}
	return true
}

func (b *Block) PrintBlock() {
	if b == nil {
		return
	}
	fmt.Printf("\n📦 Block #%d | Txs: %d | Score: %.0f\n",
		b.Index, len(b.Transactions), b.RelayScore)
	fmt.Printf("   Hash:     %s\n", b.Hash)
	fmt.Printf("   MinedBy:  %s\n", b.MinedBy)
	if b.RelayedBy != "" {
		fmt.Printf("   RelayedBy: %s\n", b.RelayedBy)
	}
}