package main

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// =========================
// 📐 PoR PARAMETERS
// =========================

const (
	CreditsPerBlock     = 100
	CreditsPerTx        = 10
	CreditsPerPeer      = 5
	CreditsCostToMine   = 50
	MinBlockIntervalSec = 60 // 1 block per minute per node
)

// =========================
// 📊 RELAY STATS
// =========================

type RelayStats struct {
	NodeID          string
	Credits         int64
	TotalBlocks     int64
	TotalTxs        int64
	TotalPeerCycles int64
	LastActivity    int64
	LastMineTime    int64
	Score           float64
}

func (s *RelayStats) canMine() (bool, string) {
	if s.Credits < CreditsCostToMine {
		return false, fmt.Sprintf("credits: %d/%d", s.Credits, CreditsCostToMine)
	}
	if s.LastMineTime > 0 {
		elapsed := time.Now().Unix() - s.LastMineTime
		if elapsed < MinBlockIntervalSec {
			return false, fmt.Sprintf("cooldown: %ds remaining", MinBlockIntervalSec-elapsed)
		}
	}
	return true, "OK"
}

// =========================
// 🌐 PEER SCORE
// =========================

type PeerScore struct {
	NodeID    string  `json:"node_id"`
	Score     float64 `json:"score"`
	Credits   int64   `json:"credits"`
	UpdatedAt int64   `json:"updated_at"`
	PeerAddr  string  `json:"peer_addr"` // canonical TCP address of the sender
}

// =========================
// 🚀 RELAY MINING ENGINE
// =========================

type RelayMiningEngine struct {
	blockchain *Blockchain
	p2pNode    *P2PNode
	nodeID     string

	mu                sync.Mutex
	stats             map[string]*RelayStats
	peerScores        map[string]PeerScore
	lastExternalBlock int64

	stopCh chan struct{}
}

func NewRelayMiningEngine(bc *Blockchain, p2p *P2PNode, nodeID string) *RelayMiningEngine {
	return &RelayMiningEngine{
		blockchain: bc,
		p2pNode:    p2p,
		nodeID:     nodeID,
		stats:      make(map[string]*RelayStats),
		peerScores: make(map[string]PeerScore),
		stopCh:     make(chan struct{}),
	}
}

func (rme *RelayMiningEngine) getOrCreate(nodeID string) *RelayStats {
	s, ok := rme.stats[nodeID]
	if !ok {
		s = &RelayStats{NodeID: nodeID}
		rme.stats[nodeID] = s
	}
	return s
}

// =========================
// 📡 RELAY REGISTRATION
// =========================

func (rme *RelayMiningEngine) OnBlockRelayed(nodeID string) {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	s := rme.getOrCreate(nodeID)
	s.Credits += CreditsPerBlock
	s.TotalBlocks++
	s.LastActivity = time.Now().Unix()
	s.Score = rme.calcScore(s)
}

func (rme *RelayMiningEngine) OnTxRelayed(nodeID string) {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	s := rme.getOrCreate(nodeID)
	s.Credits += CreditsPerTx
	s.TotalTxs++
	s.LastActivity = time.Now().Unix()
	s.Score = rme.calcScore(s)
}

func (rme *RelayMiningEngine) OnPeerCycle(nodeID string, peerCount int) {
	if peerCount == 0 {
		return
	}
	rme.mu.Lock()
	defer rme.mu.Unlock()
	s := rme.getOrCreate(nodeID)
	s.Credits += int64(peerCount) * CreditsPerPeer
	s.TotalPeerCycles++
	s.LastActivity = time.Now().Unix()
	s.Score = rme.calcScore(s)
}

func (rme *RelayMiningEngine) OnVerifiedRelay(nodeID string) {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	s := rme.getOrCreate(nodeID)
	s.Credits += CreditsPerBlock * 2
	s.TotalBlocks++
	s.LastActivity = time.Now().Unix()
	s.Score = rme.calcScore(s)
	fmt.Printf("✅ Relay verified! +%d credits\n", CreditsPerBlock*2)
}

// OnExternalBlock is called when a block mined by another node arrives.
func (rme *RelayMiningEngine) OnExternalBlock() {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	rme.lastExternalBlock = time.Now().Unix()
}

func (rme *RelayMiningEngine) UpdatePeerScore(ps PeerScore) {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	rme.peerScores[ps.NodeID] = ps
}

func (rme *RelayMiningEngine) calcScore(s *RelayStats) float64 {
	return float64(s.TotalBlocks)*3.0 +
		float64(s.TotalTxs)*0.5 +
		float64(s.TotalPeerCycles)*1.0
}

// =========================
// 👑 LEADER ELECTION — ROUND ROBIN
// =========================

// isLeader uses round-robin based on the last block's hash.
// All nodes sort themselves alphabetically, then pick the leader
// based on (blockIndex % numberOfNodes). This guarantees strict
// alternation regardless of score differences.
func (rme *RelayMiningEngine) isLeader() bool {
	rme.mu.Lock()
	defer rme.mu.Unlock()

	// Pause after receiving an external block
	if rme.lastExternalBlock > 0 {
		elapsed := time.Now().Unix() - rme.lastExternalBlock
		if elapsed < MinBlockIntervalSec {
			return false
		}
	}

	// Only include peers that are BOTH currently connected AND sent a fresh score
	connectedPeers := rme.p2pNode.GetActivePeerAddresses()
	connected := make(map[string]bool)
	for _, addr := range connectedPeers {
		connected[addr] = true
	}

	nodes := []string{rme.nodeID}
	for _, ps := range rme.peerScores {
		age := time.Now().Unix() - ps.UpdatedAt
		if age <= 60 && connected[ps.PeerAddr] {
			nodes = append(nodes, ps.NodeID)
		}
	}

	// FALLBACK: if no block has been mined in 2× the block interval,
	// assume all peers are offline/ghost and mine regardless of round-robin.
	// This prevents the network from stalling due to stale peer entries.
	chain := rme.blockchain.GetChain()
	if len(chain) > 0 {
		lastBlock := chain[len(chain)-1]
		timeSinceLastBlock := time.Now().Unix() - lastBlock.Timestamp
		if timeSinceLastBlock > int64(MinBlockIntervalSec*2) {
			return true
		}
	}

	// No live peers with fresh scores → mine freely
	if len(nodes) == 1 {
		return true
	}

	sort.Strings(nodes)
	nextIndex := len(chain)
	leaderIndex := nextIndex % len(nodes)
	return nodes[leaderIndex] == rme.nodeID
}

// =========================
// ⛏️ TRY TO MINE
// =========================

func (rme *RelayMiningEngine) TryMine() *Block {
	if !rme.isLeader() {
		return nil
	}

	rme.mu.Lock()
	s := rme.getOrCreate(rme.nodeID)
	canMine, _ := s.canMine()
	if !canMine {
		rme.mu.Unlock()
		return nil
	}

	s.Credits -= CreditsCostToMine
	s.LastMineTime = time.Now().Unix()
	score := s.Score
	credits := s.Credits + CreditsCostToMine
	rme.mu.Unlock()

	return rme.blockchain.mineNextPoR(rme.nodeID, score, credits)
}

// =========================
// 🔁 MINING LOOP
// =========================

func (rme *RelayMiningEngine) StartAutoMining() {
	fmt.Println("⛏️  PoR mining started")

	// Initial credits so mining can start immediately
	rme.mu.Lock()
	s := rme.getOrCreate(rme.nodeID)
	s.Credits = CreditsCostToMine
	rme.mu.Unlock()

	// Peer credits + score announcement (every 30s)
	go func() {
		rme.announceScore()

		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-rme.stopCh:
				return
			case <-ticker.C:
				peers := rme.p2pNode.GetPeerCount()
				rme.OnPeerCycle(rme.nodeID, peers)
				rme.applyDecay(rme.nodeID)
				rme.announceScore()
			}
		}
	}()

	// Main mining loop (checks every 10s)
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-rme.stopCh:
				return
			case <-ticker.C:
				if rme.blockchain.TotalSupply() >= MaxSupply {
					fmt.Println("🏁 Maximum supply reached.")
					return
				}

				block := rme.TryMine()
				if block == nil {
					continue
				}

				rme.p2pNode.BroadcastNewBlock(*block)
				rme.OnBlockRelayed(rme.nodeID)
				rme.announceScore()

				// Calculate actual reward from block's mining_reward TX
				actualReward := 0.0
				for _, tx := range block.Transactions {
					if tx.TxType == "mining_reward" {
						actualReward = tx.Amount
					}
				}
				s := rme.GetStats(rme.nodeID)
				bonus := calcScoreBonus(s.Score)
				if bonus > 1.0 {
					fmt.Printf("🎉 Block #%d | +%.4f BIG (score bonus: +%.0f%%) | supply: %.0f/21M\n",
						block.Index, actualReward, (bonus-1.0)*100, rme.blockchain.TotalSupply())
				} else {
					fmt.Printf("🎉 Block #%d | +%.4f BIG | supply: %.0f/21M\n",
						block.Index, actualReward, rme.blockchain.TotalSupply())
				}
			}
		}
	}()
}

func (rme *RelayMiningEngine) announceScore() {
	rme.mu.Lock()
	myStats := rme.getOrCreate(rme.nodeID)
	ps := PeerScore{
		NodeID:    rme.nodeID,
		Score:     myStats.Score,
		Credits:   myStats.Credits,
		UpdatedAt: time.Now().Unix(),
		PeerAddr:  rme.p2pNode.getAddress(), // our own canonical address
	}
	rme.mu.Unlock()
	rme.p2pNode.BroadcastScore(ps)
}

func (rme *RelayMiningEngine) applyDecay(nodeID string) {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	s, ok := rme.stats[nodeID]
	if !ok {
		return
	}
	inactiveMins := float64(time.Now().Unix()-s.LastActivity) / 60.0
	if inactiveMins > 1 {
		decay := int64(float64(s.Credits) * 0.01 * inactiveMins)
		s.Credits -= decay
		if s.Credits < 0 {
			s.Credits = 0
		}
	}
}

func (rme *RelayMiningEngine) Stop() {
	close(rme.stopCh)
}

// =========================
// 📊 STATS
// =========================

func (rme *RelayMiningEngine) GetStats(nodeID string) RelayStats {
	rme.mu.Lock()
	defer rme.mu.Unlock()
	if s, ok := rme.stats[nodeID]; ok {
		return *s
	}
	return RelayStats{NodeID: nodeID}
}

func (rme *RelayMiningEngine) PrintStats(nodeID string) {
	s := rme.GetStats(nodeID)
	supply := rme.blockchain.TotalSupply()
	leader := rme.isLeader()
	canMine, mineStatus := s.canMine()

	fmt.Println("\n📊 === PROOF OF RELAY ===")
	fmt.Printf("Credits:        %d (cost: %d)\n", s.Credits, CreditsCostToMine)
	fmt.Printf("Can mine:       %v — %s\n", canMine, mineStatus)
	fmt.Printf("Is leader:      %v\n", leader)
	fmt.Printf("Score:          %.2f\n", s.Score)
	bonus := calcScoreBonus(s.Score)
	fmt.Printf("Reward bonus:   +%.0f%% (score multiplier: %.2fx)\n", (bonus-1.0)*100, bonus)
	fmt.Printf("Relayed blocks: %d\n", s.TotalBlocks)
	fmt.Printf("Relayed TXs:    %d\n", s.TotalTxs)
	fmt.Println("---")
	fmt.Printf("Supply:         %.2f / %.0f BIG\n", supply, MaxSupply)
	fmt.Printf("Per block:      %.8f BIG\n", rme.blockchain.MiningReward)
	fmt.Printf("Daily emission: %.4f BIG/day\n", rme.blockchain.DailyEmission())
	years := rme.blockchain.YearsElapsed()
	halvings := int(years) / HalvingYears
	nextHalving := float64(HalvingYears) - (years - float64(halvings*HalvingYears))
	fmt.Printf("Halvings:       %d\n", halvings)
	fmt.Printf("Next halving:   in %.1f years\n", nextHalving)
	fmt.Println("========================\n")
}