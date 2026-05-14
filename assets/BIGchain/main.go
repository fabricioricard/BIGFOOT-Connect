package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func main() {
	fmt.Println("🚀 Starting BIGchain...")
	port    := flag.String("port",     "3000", "P2P port")
	apiPort := flag.String("api-port", "",     "HTTP API port (default: port+1000)")
	flag.Parse()

	resolvedAPIPort := *apiPort
	if resolvedAPIPort == "" {
		p := 3000
		fmt.Sscanf(*port, "%d", &p)
		resolvedAPIPort = fmt.Sprintf("%d", p+1000)
	}

	// Diretório de dados
	dataDir, err := EnsureDataDir()
	if err != nil {
		fmt.Println("❌ Error creating data directory:", err)
		os.Exit(1)
	}
	fmt.Println("📁 Data dir:", dataDir)

	// Wallet per port
	sep := "/"
	if runtime.GOOS == "windows" {
		sep = "\\"
	}
	walletPath := fmt.Sprintf("%s%swallet_%s.json", dataDir, sep, *port)
	wallet := NewWallet(walletPath)
	fmt.Println("🔐 Wallet:", wallet.Address)

	// Blockchain
	bc := NewBlockchain(dataDir, *port)

	// Relay Engine (mineração por relay)
	relayEngine := NewRelayMiningEngine(bc, nil, wallet.Address)

	// P2P (recebe o relay engine)
	p2pNode := NewP2PNode(wallet.Address, *port, bc, relayEngine)
	relayEngine.p2pNode = p2pNode

	// Proof of Relay Engine (provas criptográficas reais)
	relayProof := NewProofOfRelayEngine(wallet.Address, wallet, bc)
	p2pNode.SetRelayProof(relayProof)

	go p2pNode.Start()

	// Inicia mineração PoR após conectar peers
	go func() {
		time.Sleep(5 * time.Second)
		relayEngine.StartAutoMining()
	}()

	// API HTTP
	go startAPI(resolvedAPIPort, bc, p2pNode, wallet, relayEngine)
	fmt.Println("🌐 HTTP API on port :" + resolvedAPIPort)

	// CLI
	go runCLI(bc, p2pNode, wallet, relayEngine, relayProof)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	fmt.Println("\n🛑 Saving blockchain...")
	relayEngine.Stop()
	SaveBlockchain(bc, dataDir)
	fmt.Println("✅ Shutdown complete.")
}

// =========================
// 💻 CLI
// =========================

func runCLI(bc *Blockchain, node *P2PNode, wallet *Wallet, relay *RelayMiningEngine, proof *ProofOfRelayEngine) {
	scanner := bufio.NewScanner(os.Stdin)
	printHelp()

	for {
		fmt.Print("\n> ")
		if !scanner.Scan() {
			return
		}
		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}
		parts := strings.Fields(input)
		cmd := parts[0]

		switch cmd {

		case "help":
			printHelp()

		case "wallet":
			dataDir, _ := EnsureDataDir()
			fmt.Println("\n🔐 === WALLET ===")
			fmt.Println("Address:      ", wallet.Address)
			fmt.Printf("Public Key:   %x\n", wallet.PublicKey)
			privBytes := wallet.PrivateKey.D.Bytes()
			padded := make([]byte, 32)
			copy(padded[32-len(privBytes):], privBytes)
			fmt.Printf("Private Key:  %x\n", padded)
			fmt.Printf("File:          %s\n", filepath.Join(dataDir, "wallet_*.json"))
			fmt.Println("⚠️  Never share your private key!")
			fmt.Println("================")

		case "balance":
			bal := calcBalance(bc, wallet.Address)
			fmt.Printf("\n💰 Your balance: %.8f BIG\n", bal)

		case "send":
			if len(parts) < 3 {
				fmt.Println("Usage: send <address> <amount>")
				fmt.Println("Ex:   send big919f8d... 10")
				continue
			}
			to := parts[1]

			// Use strconv for reliable float parsing instead of fmt.Sscanf
			amount, err := strconv.ParseFloat(parts[2], 64)
			if err != nil || amount <= 0 {
				fmt.Printf("❌ Invalid amount: %s\n", parts[2])
				continue
			}
			if len(to) < 10 || !strings.HasPrefix(to, "big") {
				fmt.Println("❌ Invalid address (must start with 'big')")
				continue
			}
			if to == wallet.Address {
				fmt.Println("❌ Cannot send to yourself")
				continue
			}

			bal := calcBalance(bc, wallet.Address)
			if bal < amount {
				fmt.Printf("❌ Insufficient balance\n   Available: %.8f BIG\n   Requested:  %.8f BIG\n", bal, amount)
				continue
			}

			tx := Transaction{
				FromAddress: wallet.Address,
				ToAddress:   to,
				Amount:      amount,
				Timestamp:   time.Now().UnixNano(),
				TxType:      "transfer",
				Nonce:       time.Now().UnixNano(),
			}
			if err := wallet.SignTransaction(&tx); err != nil {
				fmt.Println("❌ Signing error:", err)
				continue
			}
			if bc.AddTransaction(tx) {
				node.BroadcastNewTx(tx)
				fmt.Printf("✅ Sent!\n")
				fmt.Printf("   To:      %s\n", to)
				fmt.Printf("   Amount:  %.8f BIG\n", amount)
				fmt.Printf("   TX:      %s...\n", tx.Hash[:16])
				fmt.Printf("   Balance: %.8f BIG → %.8f BIG\n", bal, bal-amount)
				fmt.Println("   ⏳ Will be confirmed in the next block.")
			} else {
				fmt.Println("❌ Invalid transaction")
			}

		case "status":
			supply := bc.TotalSupply()
			stats := relay.GetStats(wallet.Address)
			fmt.Println("\n⛓️ === STATUS ===")
			fmt.Printf("Node:        %s\n", node.getAddress())
			fmt.Printf("Wallet:      %s\n", wallet.Address)
			fmt.Printf("Balance:     %.8f BIG\n", calcBalance(bc, wallet.Address))
			fmt.Printf("Blocks:      %d\n", len(bc.GetChain()))
			fmt.Printf("Reward:      %.8f BIG/block\n", bc.MiningReward)
			fmt.Printf("Supply:      %.2f / %.0f BIG (%.4f%%)\n",
				supply, MaxSupply, supply/MaxSupply*100)
			fmt.Printf("PoR Credits: %d/%d\n", stats.Credits, CreditsCostToMine)
			fmt.Printf("Pending TX:  %d\n", len(bc.PendingTx))
			fmt.Printf("Peers:       %d\n", node.GetPeerCount())
			fmt.Printf("Chain OK:    %v\n", bc.IsValid())
			fmt.Println("================")

		case "supply":
			supply := bc.TotalSupply()
			daily := bc.DailyEmission()
			years := bc.YearsElapsed()
			halvings := int(years) / HalvingYears
			nextHalvingYears := float64(HalvingYears) - (years - float64(halvings*HalvingYears))
			nodes := node.GetPeerCount() + 1
			fmt.Println("\n💎 === BIG SUPPLY ===")
			fmt.Printf("Issued:         %.8f BIG\n", supply)
			fmt.Printf("Maximum:        %.0f BIG\n", MaxSupply)
			fmt.Printf("Remaining:      %.8f BIG\n", MaxSupply-supply)
			fmt.Printf("%%Issued:        %.6f%%\n", supply/MaxSupply*100)
			fmt.Println("---")
			fmt.Printf("Daily emission: %.4f BIG/day\n", daily)
			fmt.Printf("Per block:      %.8f BIG\n", bc.MiningReward)
			fmt.Printf("Active nodes:   %d\n", nodes)
			fmt.Printf("Years elapsed:  %.2f\n", years)
			fmt.Printf("Halvings:       %d\n", halvings)
			fmt.Printf("Next halving:   in %.1f years\n", nextHalvingYears)
			fmt.Println("====================")

		case "relay":
			relay.PrintStats(wallet.Address)
			rep := proof.GetReputation(wallet.Address)
			verified := proof.ValidRelayCount()
			fmt.Printf("PoR Reputation: %.1f\n", rep)
			fmt.Printf("Verified Relays: %d\n", verified)

		case "chain":
			chain := bc.GetChain()
			limit := 5
			if len(parts) > 1 {
				fmt.Sscanf(parts[1], "%d", &limit)
			}
			start := len(chain) - limit
			if start < 0 {
				start = 0
			}
			for _, b := range chain[start:] {
				b.PrintBlock()
			}

		case "pending":
			bc.mu.RLock()
			pending := bc.PendingTx
			bc.mu.RUnlock()
			if len(pending) == 0 {
				fmt.Println("No pending transactions.")
				continue
			}
			for _, tx := range pending {
				fmt.Printf("  [%s] %s → %s : %.8f BIG\n",
					tx.TxType, shortenAddress(tx.FromAddress), shortenAddress(tx.ToAddress), tx.Amount)
			}

		case "peers":
			fmt.Printf("\n🌐 Peers: %d\n", node.GetPeerCount())
			for _, p := range node.GetActivePeerList() {
				fmt.Println("  •", p)
			}

		default:
			fmt.Printf("❓ Unknown command '%s'. Type 'help'.\n", cmd)
		}
	}
}

func printHelp() {
	fmt.Println(`
╔═══════════════════════════════════════════╗
║           BIGchain Node CLI               ║
╠═══════════════════════════════════════════╣
║  wallet              — your wallet        ║
║  balance             — your balance       ║
║  send <address> <amount> — send BIG       ║
║  supply              — token supply       ║
║  relay               — relay stats        ║
║  status              — node status        ║
║  chain [N]           — last N blocks      ║
║  pending             — pending TXs        ║
║  peers               — connected peers    ║
║  help                — this help          ║
╚═══════════════════════════════════════════╝
  📡 Proof of Relay active.`)
}

// =========================
// 🌐 HTTP API
// =========================

func startAPI(port string, bc *Blockchain, node *P2PNode, wallet *Wallet, relay *RelayMiningEngine) {
	mux := http.NewServeMux()

	mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		chain := bc.GetChain()
		stats := relay.GetStats(wallet.Address)
		jsonResponse(w, map[string]interface{}{
			"node":          node.getAddress(),
			"wallet":        wallet.Address,
			"blocks":        len(chain),
			"reward":        bc.MiningReward,
			"supply":        bc.TotalSupply(),
			"max_supply":    MaxSupply,
			"relay_credits": stats.Credits,
			"relay_score":   stats.Score,
			"peers":         node.GetPeerCount(),
			"peer_list":     node.GetActivePeerList(),
			"chain_valid":   bc.IsValid(),
			"consensus":     "Proof of Relay",
		})
	})

	mux.HandleFunc("/chain", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, bc.GetChain())
	})

	mux.HandleFunc("/balance", func(w http.ResponseWriter, r *http.Request) {
		address := r.URL.Query().Get("address")
		if address == "" {
			address = wallet.Address
		}
		jsonResponse(w, map[string]interface{}{
			"address": address,
			"balance": calcBalance(bc, address),
		})
	})

	mux.HandleFunc("/supply", func(w http.ResponseWriter, r *http.Request) {
		supply := bc.TotalSupply()
		jsonResponse(w, map[string]interface{}{
			"supply":         supply,
			"max_supply":     MaxSupply,
			"remaining":      MaxSupply - supply,
			"percent":        supply / MaxSupply * 100,
			"reward":         bc.MiningReward,
			"daily_emission": bc.DailyEmission(),
			"years_elapsed":  bc.YearsElapsed(),
			"active_nodes":   node.GetPeerCount() + 1,
		})
	})

	mux.HandleFunc("/relay", func(w http.ResponseWriter, r *http.Request) {
		stats := relay.GetStats(wallet.Address)
		jsonResponse(w, stats)
	})

	mux.HandleFunc("/pending", func(w http.ResponseWriter, r *http.Request) {
		bc.mu.RLock()
		pending := bc.PendingTx
		bc.mu.RUnlock()
		jsonResponse(w, pending)
	})

	mux.HandleFunc("/transaction", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			To     string  `json:"to"`
			Amount float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "payload inválido", http.StatusBadRequest)
			return
		}
		if req.To == "" || req.Amount <= 0 {
			http.Error(w, "to e amount obrigatórios", http.StatusBadRequest)
			return
		}
		bal := calcBalance(bc, wallet.Address)
		if bal < req.Amount {
			http.Error(w, fmt.Sprintf("insufficient balance: %.8f BIG", bal), http.StatusBadRequest)
			return
		}
		tx := Transaction{
			FromAddress: wallet.Address,
			ToAddress:   req.To,
			Amount:      req.Amount,
			Timestamp:   time.Now().UnixNano(),
			TxType:      "transfer",
			Nonce:       time.Now().UnixNano(),
		}
		if err := wallet.SignTransaction(&tx); err != nil {
			http.Error(w, "erro ao assinar: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if !bc.AddTransaction(tx) {
			http.Error(w, "transação inválida", http.StatusBadRequest)
			return
		}
		node.BroadcastNewTx(tx)
		jsonResponse(w, map[string]interface{}{"success": true, "tx_hash": tx.Hash})
	})

	mux.HandleFunc("/peers", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, map[string]interface{}{
			"count": node.GetPeerCount(),
			"peers": node.GetActivePeerList(),
		})
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		fmt.Println("❌ Erro na API:", err)
	}
}

func calcBalance(bc *Blockchain, address string) float64 {
	balance := 0.0
	for _, block := range bc.GetChain() {
		for _, tx := range block.Transactions {
			if tx.ToAddress == address {
				balance += tx.Amount
			}
			if tx.FromAddress == address {
				balance -= tx.Amount
			}
		}
	}
	return balance
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}