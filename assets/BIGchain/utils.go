package main

import (
	"fmt"
	"time"
)

//
// 🔥 FORMATAÇÃO DE ENDEREÇO
//

func shortenAddress(address string) string {
	if len(address) > 12 {
		return address[:12] + "..."
	}
	return address
}

//
// 🔥 TIMESTAMP LEGÍVEL (IMPORTANTE PRA DEBUG)
//

func formatTimestamp(ts int64) string {
	t := time.Unix(ts, 0)
	return t.Format("2006-01-02 15:04:05")
}

//
// 🔥 MINERADORES ATIVOS
//

func (bc *Blockchain) GetActiveMiners() []string {
	bc.mu.RLock()
	defer bc.mu.RUnlock()

	var active []string
	for addr, miner := range bc.ActiveMiners {
		if miner.IsActive {
			active = append(active, addr)
		}
	}
	return active
}

//
// 🔥 RECOMPENSA DINÂMICA
//

func (bc *Blockchain) getCurrentMiningReward() float64 {
	return bc.MiningReward
}

//
// 🔥 VALIDAÇÃO REAL DA BLOCKCHAIN
//

func (bc *Blockchain) ValidateChain() bool {
	bc.mu.RLock()
	defer bc.mu.RUnlock()

	if len(bc.Blocks) == 0 {
		return false
	}

	for i := 1; i < len(bc.Blocks); i++ {
		current := bc.Blocks[i]
		prev := bc.Blocks[i-1]

		// 🔗 Verifica ligação
		if current.PreviousHash != prev.Hash {
			fmt.Println("❌ Blockchain inválida: hash anterior não confere")
			return false
		}

		// 🔥 Verifica hash do bloco
		if current.CalculateHash() != current.Hash {
			fmt.Println("❌ Blockchain inválida: hash do bloco corrompido")
			return false
		}

		// 🔥 Valida transações
		for _, tx := range current.Transactions {
			if !tx.Validate() {
				fmt.Println("❌ Blockchain inválida: transação inválida")
				return false
			}
		}
	}

	return true
}

//
// 🔥 DEBUG: STATUS DA REDE
//

func (bc *Blockchain) PrintNetworkStatus() {
	bc.mu.RLock()
	defer bc.mu.RUnlock()

	fmt.Println("\n🌐 === STATUS DA REDE ===")
	fmt.Printf("Blocos: %d\n", len(bc.Blocks))
	fmt.Printf("Mineradores ativos: %d\n", len(bc.GetActiveMiners()))
	fmt.Printf("Reward atual: %.4f BIG\n", bc.MiningReward)
	fmt.Println("========================\n")
}

//
// 🔥 SCORE DINÂMICO (BASE PRA PEX)
//

func calculateNodeScore(uptime int64, successRate float64, latency int64) float64 {
	// quanto maior uptime e successRate melhor
	// quanto menor latency melhor

	return float64(uptime)*0.5 + successRate*100 - float64(latency)*0.1
}