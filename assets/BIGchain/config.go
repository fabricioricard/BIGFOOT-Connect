package main

import (
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"sync"
)

// =====================
// NETWORK CONFIG (🔥 NOVO MODELO)
// =====================

type BootstrapConfig struct {
	Enabled   bool     `json:"enabled"`
	Endpoints []string `json:"endpoints"`
}

type P2PAdvancedConfig struct {
	Port              int  `json:"port"`
	MaxConnections    int  `json:"max_connections"`
	MinConnections    int  `json:"min_connections"`
	EnablePEX         bool `json:"enable_pex"`
	EnableGossip      bool `json:"enable_gossip"`
	GossipIntervalMS  int  `json:"gossip_interval"`
	PeerTimeoutMS     int  `json:"peer_timeout"`
	MaxKnownPeers     int  `json:"max_known_peers"`
}

type ConsensusConfig struct {
	RequiredValidations int `json:"required_validations"`
	ProofExpirationSec  int `json:"proof_expiration"`
}

// =====================
// NODE CONFIG
// =====================

type NodeConfig struct {
	Environment string              `json:"environment"`
	Bootstrap   BootstrapConfig     `json:"bootstrap"`
	P2P         P2PAdvancedConfig   `json:"p2p"`
	Consensus   ConsensusConfig     `json:"consensus"`
	Mining      MiningConfig        `json:"mining"`
	Sync        SyncConfig          `json:"sync"`
}

// =====================
// MINING / SYNC
// =====================

type MiningConfig struct {
	Enabled            bool    `json:"enabled"`
	BlockTime          int     `json:"block_time_minutes"`
	Reward             float64 `json:"mining_reward"`
	CooperativeMode    bool    `json:"cooperative_mode"`
	RewardDistribution string  `json:"reward_distribution"`
}

type SyncConfig struct {
	EnableAutoSync   bool `json:"enable_auto_sync"`
	SyncIntervalMins int  `json:"sync_interval_mins"`
}

// =====================
// GLOBALS
// =====================

var (
	configMutex  sync.RWMutex
	globalConfig *NodeConfig
)

// =====================
// DEFAULT CONFIG
// =====================

func GetDefaultConfig() *NodeConfig {
	return &NodeConfig{
		Environment: "production",

		Bootstrap: BootstrapConfig{
			Enabled: true,
			Endpoints: []string{
				"https://raw.githubusercontent.com/fabricioricard/BIGFOOT-Connect-API/refs/heads/main/pages/api/peers/list.js",
			},
		},

		P2P: P2PAdvancedConfig{
			Port:             30303,
			MaxConnections:   50,
			MinConnections:   5,
			EnablePEX:        true,
			EnableGossip:     true,
			GossipIntervalMS: 3000,
			PeerTimeoutMS:    10000,
			MaxKnownPeers:    1000,
		},

		Consensus: ConsensusConfig{
			RequiredValidations: 3,
			ProofExpirationSec:  300,
		},

		Mining: MiningConfig{
			Enabled:            true,
			BlockTime:          10,
			Reward:             1.0,
			CooperativeMode:    true,
			RewardDistribution: "all_nodes",
		},

		Sync: SyncConfig{
			EnableAutoSync:   true,
			SyncIntervalMins: 5,
		},
	}
}

// =====================
// LOAD CONFIG
// =====================

func LoadConfig() (*NodeConfig, error) {
	configMutex.Lock()
	defer configMutex.Unlock()

	configFile := "bigchain_config.json"

	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		config := GetDefaultConfig()
		data, _ := json.MarshalIndent(config, "", "  ")
		os.WriteFile(configFile, data, 0644)
		globalConfig = config
		return config, nil
	}

	data, err := os.ReadFile(configFile)
	if err != nil {
		return nil, err
	}

	var config NodeConfig
	json.Unmarshal(data, &config)

	globalConfig = &config
	return &config, nil
}

// =====================
// VALIDATION
// =====================

func isValidIPAddress(ip string) bool {
	ipv4Regex := regexp.MustCompile(`^(\d{1,3}\.){3}\d{1,3}$`)
	ipv6Regex := regexp.MustCompile(`^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$`)
	return ipv4Regex.MatchString(ip) || ipv6Regex.MatchString(ip)
}

func isValidAddress(addr string) bool {
	if addr == "" {
		return false
	}

	if !strings.Contains(addr, ":") {
		return false
	}

	if strings.HasPrefix(addr, "[") {
		if !strings.Contains(addr, "]:") {
			return false
		}
	}

	return true
}

func (config *NodeConfig) ValidateForProduction() []string {
	warnings := []string{}

	if !config.Bootstrap.Enabled {
		warnings = append(warnings, "Bootstrap está desativado — rede pode não iniciar")
	}

	if len(config.Bootstrap.Endpoints) == 0 {
		warnings = append(warnings, "Nenhum endpoint de bootstrap definido")
	}

	if config.P2P.MinConnections <= 0 {
		warnings = append(warnings, "MinConnections deve ser maior que 0")
	}

	if config.P2P.MaxConnections < config.P2P.MinConnections {
		warnings = append(warnings, "MaxConnections deve ser maior que MinConnections")
	}

	if config.Consensus.RequiredValidations < 1 {
		warnings = append(warnings, "Consensus inválido")
	}

	return warnings
}

// =====================
// SAVE / GET
// =====================

func SaveConfig(config *NodeConfig) error {
	configMutex.Lock()
	defer configMutex.Unlock()

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("bigchain_config.json", data, 0644)
}

func GetConfig() *NodeConfig {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return globalConfig
}