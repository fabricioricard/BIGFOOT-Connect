package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
)

// =========================
// 📁 DATA DIRECTORY
// =========================

func GetDataDir() string {
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("APPDATA")
		if base == "" {
			base = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
		return filepath.Join(base, "BIGchain")
	default:
		base := os.Getenv("HOME")
		if base == "" {
			base = "."
		}
		return filepath.Join(base, ".bigchain")
	}
}

func EnsureDataDir() (string, error) {
	dir := GetDataDir()
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("error creating data directory: %w", err)
	}
	return dir, nil
}

// =========================
// 💾 BLOCKCHAIN PERSISTENCE
// =========================

type chainSnapshot struct {
	Blocks []Block `json:"blocks"`
}

// saveMu serializes disk writes within the same process.
// Different processes use different tmp files (per port).
var saveMu sync.Mutex

// writeSnapshot saves with a port-specific tmp file to avoid
// collisions between two nodes sharing the same data directory.
// On Windows, os.Rename over an existing file fails with "Access denied",
// so we remove the destination first.
func writeSnapshot(snapshot chainSnapshot, dataDir string, port string) error {
	data, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("error serializing: %w", err)
	}

	saveMu.Lock()
	defer saveMu.Unlock()

	path := filepath.Join(dataDir, "blockchain.json")
	tmp := filepath.Join(dataDir, fmt.Sprintf("blockchain_%s.tmp", port))

	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return fmt.Errorf("error writing tmp: %w", err)
	}

	// Windows does not allow renaming over an open file — remove first.
	if runtime.GOOS == "windows" {
		_ = os.Remove(path)
	}

	if err := os.Rename(tmp, path); err != nil {
		// Fallback: write directly if rename still fails (e.g. cross-device)
		if err2 := os.WriteFile(path, data, 0600); err2 != nil {
			_ = os.Remove(tmp)
			return fmt.Errorf("error saving blockchain: %w", err2)
		}
		_ = os.Remove(tmp)
	}

	return nil
}

// SaveBlockchain is called on shutdown — reads chain safely then saves.
func SaveBlockchain(bc *Blockchain, dataDir string) error {
	chain := bc.GetChain()
	return writeSnapshot(chainSnapshot{Blocks: chain}, dataDir, bc.port)
}

// LoadBlockchain reads blockchain.json. Returns nil on first boot.
func LoadBlockchain(dataDir string) ([]Block, error) {
	path := filepath.Join(dataDir, "blockchain.json")

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error reading blockchain.json: %w", err)
	}

	var snapshot chainSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("blockchain.json corrupted: %w", err)
	}

	return snapshot.Blocks, nil
}