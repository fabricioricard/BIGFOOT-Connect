package main

import (
	"fmt"
	"sync"
	"time"
)

// =========================
// 📐 EMISSION MODEL
// =========================
//
// Instead of "X BIG per block", BIGchain uses "X BIG per day" shared
// among all active nodes. This means:
//
//   - The total daily emission is fixed regardless of node count
//   - A user joining year 10 still earns BIG — just less than year 1
//   - Supply grows predictably over decades, not days
//
// Emission schedule (halves every 4 years):
//   Year  1–4:  1,440 BIG/day  →  525,600 BIG/year
//   Year  5–8:    720 BIG/day  →  262,800 BIG/year
//   Year  9–12:   360 BIG/day  →  131,400 BIG/year
//   Year 13–16:   180 BIG/day  →   65,700 BIG/year
//   ...
//   Asymptote: never quite reaches 21,000,000 BIG (like Bitcoin)
//
// Per-block reward = DailyEmission / BlocksPerDay
// BlocksPerDay depends on number of active nodes:
//   - 1 node  → 1 block/min → 1,440 blocks/day → 1.00 BIG/block
//   - 10 nodes → 10 blocks/min → 14,400 blocks/day → 0.10 BIG/block
//   - 3,000 nodes → 3,000 blocks/min → 4,320,000 blocks/day → 0.000333 BIG/block
//
// This way adding more nodes does NOT increase total daily emission —
// it just distributes the same amount among more participants.

const (
	MaxSupply         = 21_000_000.0
	DailyEmissionBase = 1_440.0  // BIG per day in year 1 (1 per minute baseline)
	HalvingYears      = 4        // emission halves every 4 years
	SecondsPerDay     = 86_400
	SecondsPerYear    = 365 * SecondsPerDay
	HalvingSeconds    = HalvingYears * SecondsPerYear

	// Relay gets 25% of the block reward — miner gets 75%
	// Both are slices of the per-block emission, not additive
	MinerSharePct = 0.75
	RelaySharePct = 0.25

	// Minimum reward to avoid dust
	MinRewardBIG = 0.00000001
)

// calcDailyEmission returns the daily emission at a given unix timestamp.
func calcDailyEmission(genesisTime int64, now int64) float64 {
	elapsed := now - genesisTime
	if elapsed < 0 {
		elapsed = 0
	}
	halvings := int(elapsed / HalvingSeconds)
	emission := DailyEmissionBase
	for i := 0; i < halvings; i++ {
		emission /= 2
		if emission < MinRewardBIG {
			return 0
		}
	}
	return emission
}

// calcBlockReward returns the reward for a single block given:
//   - daily emission at the current time
//   - number of active nodes (for per-block share calculation)
//
// activeNodes is used to compute blocks-per-day, which determines
// how much each block is worth. More nodes = smaller per-block reward,
// but same total daily payout.
func calcBlockReward(dailyEmission float64, activeNodes int) float64 {
	if activeNodes < 1 {
		activeNodes = 1
	}
	// Each node mines once per minute in round-robin
	// So total blocks per day = activeNodes * 1440
	blocksPerDay := float64(activeNodes) * 1440.0
	reward := dailyEmission / blocksPerDay
	if reward < MinRewardBIG {
		return 0
	}
	return reward
}

// =========================
// 🏗️ BLOCKCHAIN STRUCT
// =========================

type Blockchain struct {
	Blocks       []Block
	PendingTx    []Transaction
	MiningReward float64 // current per-block reward (updated dynamically)
	ActiveMiners map[string]*Miner
	mu           sync.RWMutex
	genesisHash  string
	genesisTime  int64  // unix timestamp of genesis — anchor for emission schedule
	dataDir      string
	port         string

	// activeNodeCount is updated by the P2P layer (peer count + 1)
	activeNodeCount int
}

type Miner struct {
	Address  string
	IsActive bool
}

// =========================
// 🌱 GENESIS BLOCK (HARDCODED)
// =========================
// The genesis block is fixed for all nodes — this ensures all nodes
// share the same chain regardless of when they first started.
const (
	GenesisHash      = "82d4414ca2091f129bfbad90bebb6b98187d65de745669e75a52d42e9f0a3770"
	GenesisTimestamp = int64(1774469990)
)

func hardcodedGenesis() Block {
	return Block{
		Index:        0,
		Timestamp:    GenesisTimestamp,
		Transactions: []Transaction{},
		PreviousHash: "0",
		Hash:         GenesisHash,
		MinedBy:      "genesis",
	}
}

func NewBlockchain(dataDir string, port string) *Blockchain {
	bc := &Blockchain{
		PendingTx:       []Transaction{},
		ActiveMiners:    make(map[string]*Miner),
		dataDir:         dataDir,
		port:            port,
		activeNodeCount: 1,
		genesisHash:     GenesisHash,
		genesisTime:     GenesisTimestamp,
	}

	blocks, err := LoadBlockchain(dataDir)
	if err != nil {
		fmt.Println("⚠️ Error loading blockchain:", err)
	}

	if len(blocks) > 0 {
		// Reject chains with wrong genesis — different network
		if blocks[0].Hash != GenesisHash {
			fmt.Println("⚠️ blockchain.json has wrong genesis — resetting to official chain")
			blocks = nil
		}
	}

	if len(blocks) > 0 {
		bc.Blocks = blocks
		bc.MiningReward = bc.calcCurrentReward()
		fmt.Printf("💾 Blockchain loaded: %d blocks | reward: %.8f BIG\n",
			len(bc.Blocks), bc.MiningReward)
	} else {
		// Always use the official hardcoded genesis
		genesis := hardcodedGenesis()
		bc.Blocks = []Block{genesis}
		bc.MiningReward = DailyEmissionBase / 1440.0
		fmt.Println("🌱 Genesis block created")
		bc.saveUnsafe()
	}

	return bc
}

// SetActiveNodes is called by P2P when peer count changes.
// Updates the per-block reward dynamically.
func (bc *Blockchain) SetActiveNodes(count int) {
	bc.mu.Lock()
	defer bc.mu.Unlock()
	if count < 1 {
		count = 1
	}
	bc.activeNodeCount = count
	bc.MiningReward = bc.calcCurrentRewardUnsafe()
}

func (bc *Blockchain) calcCurrentReward() float64 {
	// called with lock already held or during init
	return bc.calcCurrentRewardUnsafe()
}

func (bc *Blockchain) calcCurrentRewardUnsafe() float64 {
	daily := calcDailyEmission(bc.genesisTime, time.Now().Unix())
	return calcBlockReward(daily, bc.activeNodeCount)
}

// TotalSupply computes total BIG ever emitted.
func (bc *Blockchain) TotalSupply() float64 {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return bc.totalSupplyUnsafe()
}

func (bc *Blockchain) totalSupplyUnsafe() float64 {
	total := 0.0
	for _, b := range bc.Blocks {
		for _, tx := range b.Transactions {
			if tx.TxType == "mining_reward" || tx.TxType == "relay_reward" {
				total += tx.Amount
			}
		}
	}
	return total
}

// DailyEmission returns the current daily emission rate.
func (bc *Blockchain) DailyEmission() float64 {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return calcDailyEmission(bc.genesisTime, time.Now().Unix())
}

// YearsElapsed returns years since genesis.
func (bc *Blockchain) YearsElapsed() float64 {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return float64(time.Now().Unix()-bc.genesisTime) / float64(SecondsPerYear)
}

func (bc *Blockchain) saveUnsafe() {
	if bc.dataDir == "" {
		return
	}
	chainCopy := make([]Block, len(bc.Blocks))
	copy(chainCopy, bc.Blocks)
	go func(blocks []Block) {
		snapshot := chainSnapshot{Blocks: blocks}
		if err := writeSnapshot(snapshot, bc.dataDir, bc.port); err != nil {
			fmt.Println("⚠️ Error saving blockchain:", err)
		}
	}(chainCopy)
}

// =========================
// 💸 TRANSACTIONS
// =========================

func (bc *Blockchain) AddTransaction(tx Transaction) bool {
	if !tx.Validate() {
		return false
	}
	bc.mu.Lock()
	defer bc.mu.Unlock()
	bc.PendingTx = append(bc.PendingTx, tx)
	return true
}

// =========================
// 🏆 SCORE BONUS
// =========================

// calcScoreBonus returns a reward multiplier based on relay score.
// Score 0   → multiplier 1.00 (no bonus)
// Score 50  → multiplier 1.25 (+25%)
// Score 100 → multiplier 1.50 (+50% max)
// Formula: bonus = min(score / 200, 0.5)  → max 50% bonus
func calcScoreBonus(score float64) float64 {
	if score <= 0 {
		return 1.0
	}
	bonus := score / 200.0
	if bonus > 0.5 {
		bonus = 0.5 // cap at 50%
	}
	return 1.0 + bonus
}

// =========================
// ⛏️ MINE BLOCK (PoR — no PoW)
// =========================

func (bc *Blockchain) mineNextPoR(minerAddress string, relayScore float64, relayCredits int64) *Block {
	bc.mu.Lock()

	if bc.totalSupplyUnsafe() >= MaxSupply {
		bc.mu.Unlock()
		return nil
	}

	prevBlock := bc.Blocks[len(bc.Blocks)-1]
	baseReward := bc.calcCurrentRewardUnsafe()

	// Apply score bonus — higher relay activity = higher reward
	scoreMultiplier := calcScoreBonus(relayScore)
	minerReward := baseReward * MinerSharePct * scoreMultiplier

	if minerReward < MinRewardBIG {
		bc.mu.Unlock()
		return nil
	}

	rewardTx := Transaction{
		FromAddress: "",
		ToAddress:   minerAddress,
		Amount:      minerReward,
		Timestamp:   time.Now().Unix(),
		TxType:      "mining_reward",
	}
	rewardTx.Hash = rewardTx.CalculateHash()

	transactions := append([]Transaction{}, bc.PendingTx...)
	transactions = append(transactions, rewardTx)

	block := Block{
		Index:        len(bc.Blocks),
		Timestamp:    time.Now().Unix(),
		Transactions: transactions,
		PreviousHash: prevBlock.Hash,
		MinedBy:      minerAddress,
		RelayScore:   relayScore,
		RelayCredits: relayCredits,
	}
	block.Hash = block.CalculateHash()

	bc.Blocks = append(bc.Blocks, block)
	bc.PendingTx = []Transaction{}
	bc.MiningReward = bc.calcCurrentRewardUnsafe()

	chainCopy := make([]Block, len(bc.Blocks))
	copy(chainCopy, bc.Blocks)
	blockCopy := block

	bc.mu.Unlock()

	go func() {
		snapshot := chainSnapshot{Blocks: chainCopy}
		if err := writeSnapshot(snapshot, bc.dataDir, bc.port); err != nil {
			fmt.Println("⚠️ Error saving blockchain:", err)
		}
	}()

	return &blockCopy
}

func (bc *Blockchain) MineBlock(minerAddress string) *Block {
	return bc.mineNextPoR(minerAddress, 0, 0)
}

// =========================
// 📥 RECEIVE BLOCK FROM NETWORK
// =========================

func (bc *Blockchain) AddReceivedBlock(block Block, relayerAddress string) bool {
	bc.mu.Lock()

	last := bc.Blocks[len(bc.Blocks)-1]

	if block.Index != last.Index+1 {
		bc.mu.Unlock()
		return false
	}
	if block.PreviousHash != last.Hash {
		bc.mu.Unlock()
		return false
	}
	if block.CalculateHash() != block.Hash {
		bc.mu.Unlock()
		return false
	}

	shouldRelay := relayerAddress != "" && relayerAddress != block.MinedBy

	bc.Blocks = append(bc.Blocks, block)
	bc.removePendingTxFromBlock(block)
	bc.MiningReward = bc.calcCurrentRewardUnsafe()

	// Relay reward = 25% of current block reward
	if shouldRelay {
		relayReward := bc.calcCurrentRewardUnsafe() * RelaySharePct
		if relayReward >= MinRewardBIG {
			relayTx := Transaction{
				FromAddress: "",
				ToAddress:   relayerAddress,
				Amount:      relayReward,
				Timestamp:   time.Now().Unix(),
				TxType:      "relay_reward",
			}
			relayTx.Hash = relayTx.CalculateHash()
			bc.PendingTx = append(bc.PendingTx, relayTx)
		}
	}

	chainCopy := make([]Block, len(bc.Blocks))
	copy(chainCopy, bc.Blocks)

	bc.mu.Unlock()

	if shouldRelay {
		fmt.Printf("📡 Relay reward → will be included in next block\n")
	}

	go func() {
		snapshot := chainSnapshot{Blocks: chainCopy}
		if err := writeSnapshot(snapshot, bc.dataDir, bc.port); err != nil {
			fmt.Println("⚠️ Error saving blockchain:", err)
		}
	}()

	fmt.Printf("📥 Block #%d accepted from network\n", block.Index)
	return true
}

func (bc *Blockchain) removePendingTxFromBlock(block Block) {
	included := make(map[string]bool)
	for _, tx := range block.Transactions {
		included[tx.Hash] = true
	}
	remaining := bc.PendingTx[:0]
	for _, tx := range bc.PendingTx {
		if !included[tx.Hash] {
			remaining = append(remaining, tx)
		}
	}
	bc.PendingTx = remaining
}

// =========================
// 🔄 REPLACE CHAIN
// =========================

func (bc *Blockchain) ReplaceChain(newBlocks []Block) bool {
	bc.mu.Lock()

	if len(newBlocks) <= len(bc.Blocks) {
		bc.mu.Unlock()
		return false
	}
	if !bc.isValidChain(newBlocks) {
		bc.mu.Unlock()
		return false
	}

	bc.Blocks = newBlocks
	bc.PendingTx = []Transaction{}
	bc.MiningReward = bc.calcCurrentRewardUnsafe()

	chainCopy := make([]Block, len(bc.Blocks))
	copy(chainCopy, bc.Blocks)

	bc.mu.Unlock()

	go func() {
		snapshot := chainSnapshot{Blocks: chainCopy}
		if err := writeSnapshot(snapshot, bc.dataDir, bc.port); err != nil {
			fmt.Println("⚠️ Error saving blockchain:", err)
		}
	}()

	fmt.Println("🔄 Chain replaced by longer network chain")
	return true
}

func (bc *Blockchain) isValidChain(blocks []Block) bool {
	if len(blocks) == 0 {
		return false
	}
	if blocks[0].Hash != bc.genesisHash {
		return false
	}
	for i := 1; i < len(blocks); i++ {
		cur, prev := blocks[i], blocks[i-1]
		if cur.PreviousHash != prev.Hash {
			return false
		}
		if cur.CalculateHash() != cur.Hash {
			return false
		}
	}
	return true
}

// =========================
// 🔍 GETTERS
// =========================

func (bc *Blockchain) IsValid() bool {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	return bc.isValidChain(bc.Blocks)
}

func (bc *Blockchain) GetChain() []Block {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	chain := make([]Block, len(bc.Blocks))
	copy(chain, bc.Blocks)
	return chain
}

func (bc *Blockchain) GetDifficulty() int { return 0 }