require('dotenv').config(); // Carrega variáveis de ambiente do .env (Firebase config, etc.)

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, session, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

// Define o nome do app ANTES de qualquer outra coisa
app.setName('BIGFOOT Connect');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'fabricioricard',
  repo: 'BIGFOOT-Connect'
});

const isDev = require('electron-is-dev');

// ==========================================
// AUTO-UPDATER EVENTS
// ==========================================
autoUpdater.on('checking-for-update', () => {
  console.log('[UPDATER] Checking for updates...');
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[UPDATER] No updates available. Current version:', info.version);
});

autoUpdater.on('error', (err) => {
  console.log('[UPDATER] Error:', err.message);
  isUpdating = false;
  
  const targetWindow = mainWindow || loginWindow;
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('update-notification', {
      type: 'error',
      message: `Error updating: ${err.message}`
    });
  }
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[UPDATER] Progress: ${Math.round(progress.percent)}%`);
  
  const targetWindow = mainWindow || loginWindow;
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('update-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    });
  }
});

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let mainWindow;
let loginWindow;
let tray = null;
let nodeProcess = null;
let currentUserEmail = null;
let nodeRunning = false;

// Node status tracking
let nodeStats = {
  connected: false,
  peers: 0,
  blockHeight: 0,
  balance: 0,
  pendingBalance: 0,   // ← novo campo
  totalSupply: 0,
  relayCount: 0,
  relayScore: 0,
  relayCredits: 0,
  canMine: false,
  isLeader: false,
  miningReward: 0,
  dailyEmission: 1440,
  scoreBonus: 1.0,
  walletAddress: '',
  nodeID: ''
};

// Wallet tracking
let cachedWalletData = null;
let walletWatchInterval = null;

// Tracking variables
let totalBigPointsToday = 0;
let currentFirebaseToken = null;
let currentFirebaseTokenTimestamp = 0;
const FIREBASE_TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutos

// Sync variables
let syncInterval = null;
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 30000;
const MIN_SYNC_INTERVAL_MS = 5000;

// Update control flag
let isUpdating = false;

// ==========================================
// SINGLE INSTANCE LOCK
// ==========================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const activeWindow = mainWindow || loginWindow;
    if (activeWindow) {
      if (activeWindow.isMinimized()) {
        activeWindow.restore();
      }
      activeWindow.focus();
      activeWindow.show();
    }
  });

  app.whenReady().then(async () => {
    // ⭐ LIMPAR CACHE NA INICIALIZAÇÃO (previne tela branca após updates)
    try {
      console.log('[APP] 🧹 Limpando cache...');
      await session.defaultSession.clearCache();
      console.log('[APP] ✅ Cache limpo!');
    } catch (error) {
      console.log('[APP] ⚠️ Erro ao limpar cache:', error.message);
    }
    
    createTray();
    createLoginWindow();
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// ==========================================
// FIREBASE TOKEN MANAGEMENT
// ==========================================
function getFirebaseIdToken() {
  return new Promise((resolve, reject) => {
    const tokenAge = Date.now() - currentFirebaseTokenTimestamp;
    if (currentFirebaseToken && tokenAge < FIREBASE_TOKEN_TTL_MS) {
      resolve(currentFirebaseToken);
      return;
    }
    // Token expirado ou ausente — solicita novo ao renderer
    currentFirebaseToken = null;

    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao obter token Firebase'));
    }, 5000);
    
    const targetWindow = mainWindow || loginWindow;
    targetWindow?.webContents.send('request-firebase-token');
    
    const handleTokenResponse = (_, token) => {
      clearTimeout(timeout);
      ipcMain.removeListener('firebase-token-response', handleTokenResponse);
      
      if (token && token !== 'NO_USER') {
        currentFirebaseToken = token;
        resolve(token);
      } else {
        reject(new Error('Usuário não autenticado'));
      }
    };
    
    ipcMain.once('firebase-token-response', handleTokenResponse);
  });
}

// ==========================================
// DATE & SYNC FUNCTIONS
// ==========================================
function getCurrentDateBrazil() {
  const now = new Date();
  const brazilDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function checkAndResetDailyCounters() {
  const currentDate = getCurrentDateBrazil();
  const lastSavedDate = global.lastSavedDate || null;
  
  if (lastSavedDate !== currentDate) {
    console.log(`[DAILY RESET] New day detected: ${lastSavedDate} → ${currentDate}`);
    console.log(`[DAILY RESET] Resetting counters. Previous total: ${totalBigPointsToday} BIG`);
    
    totalBigPointsToday = 0;
    global.lastSavedDate = currentDate;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bigpoints-data', totalBigPointsToday);
      mainWindow.webContents.send('daily-reset', currentDate);
    }
    
    console.log(`[DAILY RESET] Counters reset for ${currentDate}`);
  }
}

// ==========================================
// WALLET FUNCTIONS
// ==========================================

function findWalletFile() {
  // Locais de busca em ordem de prioridade:
  // 1. AppData\Roaming\BIGchain\ (novo padrão do Go)
  // 2. Pasta do executável (legado)
  // 3. Working dir de dev
  const os = require('os');
  const searchDirs = [];

  try {
    const appDataRoaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    searchDirs.push(path.join(appDataRoaming, 'BIGchain'));
  } catch (e) {}

  try {
    searchDirs.push(path.dirname(getBigchainPath()));
  } catch (e) {}

  try {
    if (typeof getBigchainWorkingDir === 'function') {
      searchDirs.push(getBigchainWorkingDir());
    }
  } catch (e) {}

  for (const dir of searchDirs.filter(Boolean)) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      const walletFile = files.find(f => f.startsWith('wallet_') && f.endsWith('.json'));
      if (walletFile) {
        const fullPath = path.join(dir, walletFile);
        console.log('[WALLET] ✅ Wallet encontrada em: ' + fullPath);
        return fullPath;
      }
    } catch (e) {
      console.log('[WALLET] ⚠️ Erro ao buscar em ' + dir + ':', e.message);
    }
  }

  console.log('[WALLET] ℹ️ Wallet não encontrada em nenhum local');
  return null;
}

function saveBalanceCache(balance) {
  try {
    fs.writeFileSync(balanceCachePath, JSON.stringify({ balance, updatedAt: Date.now() }));
    console.log(`[WALLET] 💾 Balance cacheado em disco: ${balance} BIG`);
  } catch (e) {
    console.error('[WALLET] ❌ Erro ao salvar balance cache:', e.message);
  }
}

function loadBalanceCache() {
  try {
    if (fs.existsSync(balanceCachePath)) {
      const cached = JSON.parse(fs.readFileSync(balanceCachePath, 'utf-8'));
      console.log(`[WALLET] 📦 Balance cache carregado: ${cached.balance} BIG`);
      return cached.balance || 0;
    }
  } catch (e) {
    console.error('[WALLET] ❌ Erro ao ler balance cache:', e.message);
  }
  return 0;
}

function readWalletData() {
  const walletPath = findWalletFile();
console.log('[IPC] Wallet path encontrado:', walletPath);
  
  if (!walletPath) {
    console.log('[WALLET] ℹ️ Wallet ainda não foi criada');
    return {
      success: false,
      error: 'WALLET_NOT_CREATED',
      message: 'Wallet will be created when you connect to the network'
    };
  }
  
  try {
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    
    // Converte timestamp para data legível
    const createdDate = new Date(walletData.created_at * 1000);
    
    const data = {
      address: walletData.address,
      publicKey: walletData.public_key_hex,
      createdAt: walletData.created_at,
      createdDate: createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      balance: nodeStats.balance || loadBalanceCache(),
      pendingBalance: 0.00
    };
    
    // Cache os dados
    cachedWalletData = data;
    
    console.log('[WALLET] ✅ Wallet carregada:', data.address);
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('[WALLET] ❌ Erro ao ler wallet:', error);
    return {
      success: false,
      error: 'READ_ERROR',
      message: error.message
    };
  }
}

function watchWalletCreation(window) {
  // ⭐ IMPORTANTE: Verifica se wallet já existe antes de começar a monitorar
  const existingWallet = findWalletFile();
  
  if (existingWallet) {
    console.log('[WALLET] ✅ Wallet já existe, não precisa monitorar criação');
    // Carrega dados da wallet existente
    const walletData = readWalletData();
    
    // ⭐ NOVO: Tenta buscar balance atual do node se estiver rodando
    if (walletData.success && nodeProcess) {
      console.log('[WALLET] 🔍 Buscando balance atual da wallet...');
      
      // Envia comando para o node (se suportar stdin)
      try {
        // Tenta comando getbalance (se o node suportar)
        nodeProcess.stdin?.write('getbalance\n');
      } catch (error) {
        console.log('[WALLET] ℹ️ Node não suporta stdin commands');
      }
    }
    
    return;
  }
  
  console.log('[WALLET] 👀 Monitorando criação de wallet...');
  
  // Verifica a cada 2 segundos se a wallet foi criada
  walletWatchInterval = setInterval(() => {
    const walletPath = findWalletFile();
    
    // ⭐ Wallet foi criada E ainda não tínhamos cache (primeira vez)
    if (walletPath && !cachedWalletData) {
      console.log('[WALLET] 🎉 Nova wallet detectada!');
      
      const walletData = readWalletData();
      
      if (walletData.success && window && !window.isDestroyed()) {
        // Notifica o renderer que a wallet foi criada
        window.webContents.send('wallet-created', walletData.data);
        console.log('[WALLET] 📢 Notificação enviada para o renderer');
        
        // ⭐ NOVO: Tenta buscar balance
        if (nodeProcess) {
          try {
            nodeProcess.stdin?.write('getbalance\n');
          } catch (error) {
            console.log('[WALLET] ℹ️ Aguardando balance do output do node');
          }
        }
      }
      
      // Para de verificar após encontrar
      clearInterval(walletWatchInterval);
      walletWatchInterval = null;
    }
  }, 2000);
}

function stopWalletWatch() {
  if (walletWatchInterval) {
    clearInterval(walletWatchInterval);
    walletWatchInterval = null;
    console.log('[WALLET] ⏹️ Monitoramento de wallet parado');
  }
}

async function syncBigPointsData(force = false) {
  if (!currentUserEmail) {
    console.log('[SYNC] Email not available, skipping sync');
    return;
  }

  const now = Date.now();
  if (!force && (now - lastSyncTime) < MIN_SYNC_INTERVAL_MS) {
    console.log(`[SYNC] Throttling active - waiting ${MIN_SYNC_INTERVAL_MS}ms between syncs`);
    return;
  }

  checkAndResetDailyCounters();

  const today = getCurrentDateBrazil();
  const amount = parseFloat(totalBigPointsToday.toFixed(6));
  
  if (amount === 0 && !force) {
    console.log('[SYNC] No points to sync');
    return;
  }

  lastSyncTime = now;

  console.log(`[SYNC] === STARTING SYNC ===`);
  console.log(`[SYNC] Date (Brazil): ${today}`);
  console.log(`[SYNC] Total points: ${amount} BIG`);

  try {
    const idToken = await getFirebaseIdToken();
    
    const response = await axios.post('https://api.bigfootconnect.tech/api/bigpoints', {
      email: currentUserEmail,
      date: today,
      amount: amount,
      idToken: idToken
    }, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.success) {
      console.log('[SYNC] ✅ Sync successful!');
      console.log('[SYNC] Response:', response.data.message);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-success', {
          date: today,
          amount: amount,
          message: response.data.message
        });
      }
      
    } else {
      console.error('[SYNC] ❌ API response error:', response.data);
    }

  } catch (error) {
    console.error('[SYNC] ❌ Sync error:', error.message);
    
    if (error.response) {
      console.error('[SYNC] HTTP status:', error.response.status);
      console.error('[SYNC] Error data:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('[SYNC] Token expired, clearing cache...');
        currentFirebaseToken = null;
      }
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-error', {
        date: today,
        amount: amount,
        error: error.message
      });
    }
  }
}

function startPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  console.log(`[SYNC TIMER] Starting automatic sync every ${SYNC_INTERVAL_MS/1000} seconds`);
  
  syncInterval = setInterval(() => {
    if (currentUserEmail && totalBigPointsToday > 0) {
      console.log(`[SYNC TIMER] Running periodic sync...`);
      syncBigPointsData();
    }
  }, SYNC_INTERVAL_MS);
}

function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[SYNC TIMER] Automatic sync stopped');
  }
}

// ==========================================
// BIGCHAIN NODE FUNCTIONS
// ==========================================
function getBigchainPath() {
  if (isDev) {
    return path.join(__dirname, 'assets', 'BIGchain', 'bigchain.exe');
  } else {
    return path.join(process.resourcesPath, 'assets', 'BIGchain', 'bigchain.exe');
  }
}

function getBigchainWorkingDir() {
  if (isDev) {
    return path.join(__dirname, 'assets', 'BIGchain');
  } else {
    return path.join(process.resourcesPath, 'assets', 'BIGchain');
  }
}

function parseBigchainOutput(output) {
  let updated = false;

  // ── PEERS ──────────────────────────────────────────────────────────────
  // "Peer identified: [ip]:3000"  or  "Peer disconnected:"
  if (output.includes('Peer identified:') || output.includes('Peer connected:')) {
    nodeStats.peers = Math.max(nodeStats.peers, 1);
    nodeStats.connected = true;
    updated = true;
  }
  if (output.includes('Peer disconnected:')) {
    nodeStats.peers = Math.max(0, nodeStats.peers - 1);
    nodeStats.connected = nodeStats.peers > 0;
    updated = true;
  }
  // "Peers: 1" from status command
  const peersMatch = output.match(/Peers:\s*(\d+)/i);
  if (peersMatch) {
    nodeStats.peers = parseInt(peersMatch[1], 10);
    nodeStats.connected = nodeStats.peers > 0;
    updated = true;
  }

  // ── BLOCK HEIGHT ───────────────────────────────────────────────────────
  // "🎉 Block #29 | +0.50 BIG | supply: 60/21M"
  // "💾 Blockchain loaded: 28 blocks"
  // "📥 Block #28 accepted from network"
  const blockMineMatch = output.match(/Block #(\d+)/i);
  if (blockMineMatch) {
    const h = parseInt(blockMineMatch[1], 10);
    if (h > nodeStats.blockHeight) {
      nodeStats.blockHeight = h;
      updated = true;
    }
  }
  const loadedMatch = output.match(/Blockchain loaded:\s*(\d+)\s*blocks/i);
  if (loadedMatch) {
    nodeStats.blockHeight = parseInt(loadedMatch[1], 10);
    updated = true;
  }

  // ── MINING REWARD (per block) ──────────────────────────────────────────
  // "🎉 Block #29 | +0.50 BIG | supply: 60/21M"
  // "🎉 Block #30 | +0.4688 BIG (score bonus: +25%) | supply: 61/21M"
  const rewardMatch = output.match(/Block #\d+\s*\|\s*\+(\d+\.?\d*)/);
  if (rewardMatch) {
    nodeStats.miningReward = parseFloat(rewardMatch[1]);
    updated = true;
  }

  // ── SCORE BONUS ────────────────────────────────────────────────────────
  // "score bonus: +25%"
  const bonusMatch = output.match(/score bonus:\s*\+(\d+)%/i);
  if (bonusMatch) {
    nodeStats.scoreBonus = 1 + parseInt(bonusMatch[1], 10) / 100;
    updated = true;
  }

  // ── SUPPLY ─────────────────────────────────────────────────────────────
  // "supply: 60/21M"
  const supplyMatch = output.match(/supply:\s*([\d.]+)\/21M/i);
  if (supplyMatch) {
    nodeStats.totalSupply = parseFloat(supplyMatch[1]);
    updated = true;
  }

  // ── BALANCE ────────────────────────────────────────────────────────────
  // "💰 Your balance: 23.00000000 BIG"
  // "Balance:     23.00000000 BIG"
  const balancePatterns = [
    /Your balance:\s*([\d.]+)\s*BIG/i,
    /Balance[:\s]+([\d.]+)\s*BIG/i,
    /balance[:\s]+([\d.]+)/i,
  ];
  for (const pattern of balancePatterns) {
    const balanceMatch = output.match(pattern);
    if (balanceMatch) {
      const newBalance = parseFloat(balanceMatch[1]);
      console.log(`[BIGCHAIN] 💰 Balance: ${newBalance} BIG`);
      if (newBalance > nodeStats.balance) {
        const earned = newBalance - nodeStats.balance;
        totalBigPointsToday += earned;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bigpoints-data', totalBigPointsToday);
          mainWindow.webContents.send('block-reward', { earned, totalBigPoints: totalBigPointsToday });
        }
        syncBigPointsData();
      }
      nodeStats.balance = newBalance;
      saveBalanceCache(newBalance);
      if (cachedWalletData) cachedWalletData.balance = newBalance;
      updated = true;
      break;
    }
  }

  // ── RELAY STATS ────────────────────────────────────────────────────────
  // "📡 Relay reward → will be included in next block"
  if (output.includes('Relay reward') || output.includes('relay reward')) {
    nodeStats.relayCount = (nodeStats.relayCount || 0) + 1;
    updated = true;
  }

  // ── RELAY CREDITS ──────────────────────────────────────────────────────
  // "Credits:        160 (cost: 50)"
  // "PoR Credits: 160/50"
  const creditsMatch = output.match(/Credits[:\s]+(\d+)\s*(?:\/|\(cost)/i);
  if (creditsMatch) {
    nodeStats.relayCredits = parseInt(creditsMatch[1], 10);
    updated = true;
  }

  // ── RELAY SCORE ────────────────────────────────────────────────────────
  // "Score:          8.00"
  const scoreMatch = output.match(/Score:\s*([\d.]+)/i);
  if (scoreMatch) {
    nodeStats.relayScore = parseFloat(scoreMatch[1]);
    updated = true;
  }

  // ── IS LEADER ──────────────────────────────────────────────────────────
  // "Is leader:      true"
  const leaderMatch = output.match(/Is leader:\s*(true|false)/i);
  if (leaderMatch) {
    nodeStats.isLeader = leaderMatch[1].toLowerCase() === 'true';
    updated = true;
  }

  // ── CAN MINE ───────────────────────────────────────────────────────────
  // "Can mine:       true — OK"
  // "Can mine:       false — cooldown: 45s remaining"
  const canMineMatch = output.match(/Can mine:\s*(true|false)/i);
  if (canMineMatch) {
    nodeStats.canMine = canMineMatch[1].toLowerCase() === 'true';
    updated = true;
  }

  // ── DAILY EMISSION ─────────────────────────────────────────────────────
  // "Daily emission: 1440.0000 BIG/day"
  const emissionMatch = output.match(/Daily emission:\s*([\d.]+)\s*BIG\/day/i);
  if (emissionMatch) {
    nodeStats.dailyEmission = parseFloat(emissionMatch[1]);
    updated = true;
  }

  // ── WALLET ADDRESS ─────────────────────────────────────────────────────
  // "🔐 Wallet: big55dc..."  or  "Address:       big55dc..."
  if (output.includes('Wallet:') || output.includes('Address:')) {
    const addrMatch = output.match(/big[a-f0-9]{40,}/i);
    if (addrMatch) {
      nodeStats.walletAddress = addrMatch[0];
      updated = true;
    }
  }

  if (updated) sendNodeStatsUpdate();

  // ── TRANSACTIONS ───────────────────────────────────────────────────────
  parseTransaction(output);
}

// ⭐ NOVA FUNÇÃO: Parser de Transações
function parseTransaction(output) {
  // Padrões de transação suportados:
  // "Transaction sent: 5.00 BIG to big1abc..."
  // "Transaction received: 10.00 BIG from big1xyz..."
  // "Sent 5.00 BIG to big1abc..."
  // "Received 10.00 BIG from big1xyz..."
  // "TX: sent 5.00 to big1abc... hash: abc123..."
  
  const patterns = [
    // Sent patterns
    {
      regex: /(?:Transaction\s+)?[Ss]ent[:\s]+([\d.]+)\s*BIG\s+to\s+(big[a-f0-9]{40,})/i,
      type: 'sent'
    },
    {
      regex: /[Ee]nviado[:\s]+([\d.]+)\s*BIG\s+para\s+(big[a-f0-9]{40,})/i,
      type: 'sent'
    },
    // Received patterns
    {
      regex: /(?:Transaction\s+)?[Rr]eceived[:\s]+([\d.]+)\s*BIG\s+from\s+(big[a-f0-9]{40,})/i,
      type: 'received'
    },
    {
      regex: /[Rr]ecebido[:\s]+([\d.]+)\s*BIG\s+de\s+(big[a-f0-9]{40,})/i,
      type: 'received'
    },
    // Mining reward
    {
      regex: /[Mm]ining\s+reward[:\s]+([\d.]+)\s*BIG/i,
      type: 'received',
      isMining: true
    },
    {
      regex: /[Rr]ecompensa\s+de\s+minera[çc][ãa]o[:\s]+([\d.]+)\s*BIG/i,
      type: 'received',
      isMining: true
    }
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern.regex);
    if (match) {
      const amount = parseFloat(match[1]);
      const address = pattern.isMining ? 'Mining Reward' : (match[2] || 'Unknown');
      
      // Extrai hash se presente
      const hashMatch = output.match(/hash[:\s]+([a-f0-9]{40,})/i);
      const txHash = hashMatch ? hashMatch[1] : null;
      
      const transaction = {
        type: pattern.type,
        amount: amount,
        address: address,
        date: new Date().toISOString(),
        dateFormatted: 'Just now',
        hash: txHash,
        status: 'confirmed'
      };
      
      console.log('[WALLET] 💸 Transaction detected:', transaction);
      
      // Adiciona ao cache da wallet
      if (cachedWalletData) {
        if (!cachedWalletData.transactions) {
          cachedWalletData.transactions = [];
        }
        
        // Adiciona no início (mais recente primeiro)
        cachedWalletData.transactions.unshift(transaction);
        
        // Limita a 50 transações
        if (cachedWalletData.transactions.length > 50) {
          cachedWalletData.transactions = cachedWalletData.transactions.slice(0, 50);
        }
      }
      
      // Notifica o renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-transaction', transaction);
      }
      
      break; // Encontrou, não precisa testar outros padrões
    }
  }
}

function sendNodeStatsUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('node-stats-update', nodeStats);
  }
}

function startBigchainNode() {
  if (nodeProcess) {
    console.log('[BIGCHAIN] Node already running');
    return;
  }

  const bigchainPath = getBigchainPath();
  const workingDir = getBigchainWorkingDir();
  
  if (!fs.existsSync(bigchainPath)) {
    console.error(`[BIGCHAIN] File not found: ${bigchainPath}`);
    mainWindow?.webContents.send('node-log', `ERROR: bigchain.exe not found at: ${bigchainPath}`);
    return;
  }

  console.log(`[BIGCHAIN] Starting node...`);
  console.log(`[BIGCHAIN] Path: ${bigchainPath}`);
  console.log(`[BIGCHAIN] Working directory: ${workingDir}`);
  console.log(`[BIGCHAIN] Current date (Brazil): ${getCurrentDateBrazil()}`);

  checkAndResetDailyCounters();
  
  // Reset stats
  nodeStats = {
    connected: false,
    peers: 0,
    blockHeight: 0,
    balance: 0,
    totalSupply: 0,
    relayCount: 0,
    relayScore: 0,
    canMine: false,
    walletAddress: '',
    nodeID: ''
  };

  try {
    nodeProcess = spawn(bigchainPath, [], {
      cwd: workingDir,
      windowsHide: !isDev // Ocultar console do node em produção
    });

    // ⭐ INICIA MONITORAMENTO DE CRIAÇÃO DA WALLET
    if (mainWindow && !mainWindow.isDestroyed()) {
      watchWalletCreation(mainWindow);
    }

    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // ⭐ LOG DETALHADO de TUDO que o node envia
      console.log(`[BIGCHAIN STDOUT] ${output}`);
      
      // ⭐ NOVO: Log específico para linhas que contenham números
      if (/\d+\.?\d*/.test(output)) {
        console.log(`[BIGCHAIN] 🔍 Linha com números detectada: ${output}`);
      }
      
      parseBigchainOutput(output);
      mainWindow?.webContents.send('node-log', output);
    });

    nodeProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[BIGCHAIN STDERR] ${error}`);
      parseBigchainOutput(error);
      mainWindow?.webContents.send('node-log', error);
    });

    nodeProcess.on('error', (error) => {
      console.error(`[BIGCHAIN] Error: ${error.message}`);
      mainWindow?.webContents.send('node-log', `ERROR: ${error.message}`);
      nodeProcess = null;
      nodeRunning = false;
      nodeStats.connected = false;
      sendNodeStatsUpdate();
    });

    nodeProcess.on('close', (code) => {
      console.log(`[BIGCHAIN] Node stopped with code ${code}`);
      nodeProcess = null;
      nodeRunning = false;
      nodeStats.connected = false;
      stopPeriodicSync();
      sendNodeStatsUpdate();
      mainWindow?.webContents.send('node-status', false);
    });

    nodeRunning = true;
    nodeStats.connected = true;
    mainWindow?.webContents.send('node-status', true);
    sendNodeStatsUpdate();
    startPeriodicSync();
    syncBigPointsData(true);
    
    console.log('[BIGCHAIN] ✅ Node started successfully!');
    
  } catch (error) {
    console.error(`[BIGCHAIN] Error starting node: ${error.message}`);
    mainWindow?.webContents.send('node-log', `ERROR: ${error.message}`);
  }
}

function stopBigchainNode(forUpdate = false) {
  console.log(`[BIGCHAIN] Stopping node... ${forUpdate ? '(for update)' : ''}`);
  
  stopPeriodicSync();
  
  // ⭐ Para monitoramento de wallet
  stopWalletWatch();
  
  return new Promise((resolve) => {
    if (!nodeProcess) {
      console.log('[BIGCHAIN] No active process');
      nodeRunning = false;
      nodeStats.connected = false;
      mainWindow?.webContents.send('node-status', false);
      sendNodeStatsUpdate();
      resolve();
      return;
    }

    const processName = 'bigchain.exe';
    
    try {
      console.log('[BIGCHAIN] Terminating process...');
      nodeProcess.kill('SIGTERM');
    } catch (error) {
      console.log('[BIGCHAIN] Error terminating:', error.message);
    }

    setTimeout(() => {
      if (nodeProcess && !nodeProcess.killed) {
        console.log('[BIGCHAIN] Forcing termination...');
        
        if (process.platform === 'win32') {
          exec(`taskkill /F /IM ${processName} /T`, (error) => {
            if (error && !error.message.includes('not found')) {
              console.log('[BIGCHAIN] Taskkill error:', error.message);
            }
          });
        }
        
        try {
          nodeProcess.kill('SIGKILL');
        } catch (killError) {
          console.log('[BIGCHAIN] Process already terminated:', killError.message);
        }
      }

      nodeProcess = null;
      nodeRunning = false;
      nodeStats.connected = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('node-status', false);
        sendNodeStatsUpdate();
      }
      
      console.log('[BIGCHAIN] ✅ Stopped successfully');
      
      if (totalBigPointsToday > 0) {
        syncBigPointsData(true).finally(() => resolve());
      } else {
        resolve();
      }
      
    }, forUpdate ? 2000 : 1000);
  });
}

function debugCurrentState() {
  console.log("=== DEBUG CURRENT STATE ===");
  console.log(`Current email: ${currentUserEmail ? currentUserEmail.replace(/(.{2}).*(@.*)/, "$1***$2") : "none"}`);
  console.log(`Firebase token: ${currentFirebaseToken ? "Present (masked)" : "Absent"}`);
  console.log(`Node active: ${nodeRunning}`);
  console.log(`Node process: ${nodeProcess ? 'Active' : 'Inactive'}`);
  console.log(`Connected: ${nodeStats.connected}`);
  console.log(`Peers: ${nodeStats.peers}`);
  console.log(`Block height: ${nodeStats.blockHeight}`);
  console.log(`Balance: ${nodeStats.balance} BIG`);
  console.log(`Total BIG Points today: ${totalBigPointsToday}`);
  console.log(`Relay count: ${nodeStats.relayCount}`);
  console.log(`Relay score: ${nodeStats.relayScore}`);
  console.log(`Can mine: ${nodeStats.canMine}`);
  console.log(`Current date (Brazil): ${getCurrentDateBrazil()}`);
  console.log(`Periodic sync active: ${syncInterval ? 'Yes' : 'No'}`);
  console.log("================================");
}

// debugCurrentState interval removido — expunha email, token e balance em logs de produção
if (isDev) { setInterval(debugCurrentState, 30000); }

// ==========================================
// TRAY FUNCTIONS
// ==========================================
function getIconPath() {
  let iconPath;
  
  if (isDev) {
    iconPath = path.join(__dirname, 'assets', 'icon.ico');
  } else {
    const possiblePaths = [
      path.join(process.resourcesPath, 'app', 'assets', 'icon.ico'),
      path.join(process.resourcesPath, 'assets', 'icon.ico'),
      path.join(__dirname, 'assets', 'icon.ico'),
      path.join(process.resourcesPath, 'icon.ico'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.ico')
    ];
    
    iconPath = possiblePaths.find(p => {
      const exists = fs.existsSync(p);
      console.log(`Checking icon at: ${p} - ${exists ? 'FOUND' : 'NOT FOUND'}`);
      return exists;
    });
    
    if (!iconPath) {
      console.error('No icon found in paths:', possiblePaths);
      iconPath = process.execPath;
    }
  }
  
  console.log('Using icon from path:', iconPath);
  return iconPath;
}

function createTray() {
  if (tray) {
    console.log('Tray already exists');
    return true;
  }
  
  try {
    const iconPath = getIconPath();
    if (!iconPath) {
      console.error('Could not find icon for tray');
      return false;
    }
    
    console.log('Creating tray with icon:', iconPath);
    
    tray = new Tray(iconPath);
    
    if (!tray) {
      console.error('Failed to create tray');
      return false;
    }
    
    tray.setToolTip('BIGFOOT Connect - Click to open');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open BIGFOOT Connect',
        click: () => {
          const activeWindow = mainWindow || loginWindow;
          if (activeWindow) {
            activeWindow.show();
            activeWindow.focus();
            if (activeWindow.isMinimized()) {
              activeWindow.restore();
            }
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Dashboard',
        click: () => {
          shell.openExternal('https://bigfootconnect.tech/dashboard');
        },
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
    
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      console.log('Tray clicked');
      const activeWindow = mainWindow || loginWindow;
      if (activeWindow) {
        if (activeWindow.isVisible() && activeWindow.isFocused()) {
          activeWindow.hide();
        } else {
          activeWindow.show();
          activeWindow.focus();
          if (activeWindow.isMinimized()) {
            activeWindow.restore();
          }
        }
      }
    });
    
    tray.on('double-click', () => {
      console.log('Tray double-clicked');
      const activeWindow = mainWindow || loginWindow;
      if (activeWindow) {
        activeWindow.show();
        activeWindow.focus();
        if (activeWindow.isMinimized()) {
          activeWindow.restore();
        }
      }
    });
    
    console.log('Tray created successfully!');
    return true;
  } catch (error) {
    console.error('Error creating tray:', error);
    tray = null;
    return false;
  }
}

// ==========================================
// WINDOW FUNCTIONS
// ==========================================
function createLoginWindow() {
  console.log('[LOGIN] Creating login window - user MUST authenticate');
  
  const loginPath = isDev 
    ? path.join(__dirname, 'renderer', 'login.html')
    : path.join(__dirname, 'renderer', 'login.html');
  
  console.log('[LOGIN] Loading from:', loginPath);
  
  loginWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  icon: path.join(__dirname, 'assets', 'icon.ico'),
  autoHideMenuBar: true,
  show: false,
  backgroundColor: '#0A0A0A',        // ← CORREÇÃO PRINCIPAL
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});

  loginWindow.setMenu(null);
  
  if (!fs.existsSync(loginPath)) {
    console.error('[LOGIN] File not found:', loginPath);
    console.error('[LOGIN] Current directory:', __dirname);
  }
  
  loginWindow.loadFile(loginPath).catch(err => {
    console.error('[LOGIN] Error loading file:', err);
  });

  loginWindow.once('ready-to-show', () => {
    loginWindow.maximize();
    loginWindow.show();
    loginWindow.focus();
  });

  // DevTools (F12 / Ctrl+Shift+I) — apenas em modo de desenvolvimento
  loginWindow.webContents.on('before-input-event', (event, input) => {
    const isF12      = input.key === 'F12';
    const isCtrlShiftI = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';

    if (isF12 || isCtrlShiftI) {
      if (isDev) {
        // Desenvolvimento: abre DevTools normalmente
        loginWindow.webContents.openDevTools({ mode: 'detach' });
      } else {
        // Produção: bloqueia a tecla — usuário não consegue abrir DevTools
        event.preventDefault();
      }
    }
  });

  loginWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      loginWindow.hide();
    }
  });
}

function createWindow() {
  console.log('[MAIN] Creating main window...');
  mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  icon: path.join(__dirname, 'assets', 'icon.ico'),
  autoHideMenuBar: true,
  show: false,
  backgroundColor: '#0A0A0A',        // ← CORREÇÃO PRINCIPAL
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // DevTools (F12 / Ctrl+Shift+I) — apenas em modo de desenvolvimento
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isF12        = input.key === 'F12';
    const isCtrlShiftI = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';

    if (isF12 || isCtrlShiftI) {
      if (isDev) {
        // Desenvolvimento: abre DevTools normalmente
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      } else {
        // Produção: bloqueia a tecla — usuário não consegue abrir DevTools
        event.preventDefault();
      }
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'win32' && tray) {
        tray.displayBalloon({
          title: 'BIGFOOT Connect',
          content: 'Application minimized to tray',
          icon: path.join(__dirname, 'assets', 'icon.ico')
        });
      }
    } else {
      stopBigchainNode();
    }
  });
}

// ==========================================
// IPC HANDLERS
// ==========================================
ipcMain.handle('register-user', async (_, id, password) => {
  try {
    await axios.post('https://bigfootconnect.tech/register', { id, password });
    return { success: true };
  } catch (err) {
    const message = err.response?.data?.message || 'Registration error.';
    return { success: false, message };
  }
});

ipcMain.handle('store-email', async (_, email) => {
  currentUserEmail = email;
  console.log('[EMAIL] Email do usuário armazenado');
  return { success: true };
});

ipcMain.handle('store-firebase-token', async (_, token) => {
  currentFirebaseToken = token;
  currentFirebaseTokenTimestamp = Date.now();
  console.log('[TOKEN] Firebase token updated');
  return { success: true };
});

ipcMain.handle('login-success', async (_, email) => {
  console.log('[AUTH] ✅ Login successful');
  currentUserEmail = email;
  
  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }
  
  createWindow();
  
  return { success: true };
});

ipcMain.handle('logout-requested', async () => {
  
  // Para o node se estiver rodando
  if (nodeRunning) {
    console.log('[LOGOUT] 🛑 Parando node...');
    await stopBigchainNode();
  }
  
  // Sincroniza dados finais antes de limpar
  if (totalBigPointsToday > 0) {
    console.log('[LOGOUT] 💾 Sincronizando dados finais...');
    try {
      await syncBigPointsData(true);
    } catch (error) {
      console.log('[LOGOUT] ⚠️ Erro ao sincronizar:', error.message);
    }
  }
  
  // Limpa dados do usuário
  currentUserEmail = null;
  currentFirebaseToken = null;
  totalBigPointsToday = 0;
  nodeRunning = false;
  
  // Limpa storage do navegador (cookies, localStorage, sessionStorage)
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[LOGOUT] 🧹 Limpando storage...');
    await mainWindow.webContents.session.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cookies']
    }).catch(err => console.log('[LOGOUT] ⚠️ Erro ao limpar storage:', err));
  }
  
  // Fecha mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[LOGOUT] 🗑️ Fechando mainWindow...');
    mainWindow.close();
    mainWindow = null;
  }
  
  // Cria/mostra loginWindow
  if (!loginWindow || loginWindow.isDestroyed()) {
    console.log('[LOGOUT] 🔐 Criando loginWindow...');
    createLoginWindow();
  } else {
    console.log('[LOGOUT] 🔐 Mostrando loginWindow existente...');
    loginWindow.show();
    loginWindow.focus();
  }
  
  console.log('[LOGOUT] ✅ Logout completo!');
  return { success: true };
});

ipcMain.handle('open-external', async (_, url) => {
  // Validação de protocolo e domínio — previne abertura de file://, ms-msdt:, smb:// etc.
  const ALLOWED_PROTOCOLS = ['https:'];
  const ALLOWED_DOMAINS = [
    'bigfootconnect.tech', 'api.bigfootconnect.tech',
    'discord.gg', 'x.com', 'twitter.com',
    'youtube.com', 'www.youtube.com',
    't.me', 'telegram.me'
  ];
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { success: false, message: 'Protocolo não permitido' };
    }
    const domainOk = ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
    if (!domainOk) {
      return { success: false, message: 'Domínio não permitido' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, message: 'URL inválida ou erro ao abrir' };
  }
});

ipcMain.handle('open-dashboard', () => {
  shell.openExternal('https://bigfootconnect.tech/dashboard');
});

ipcMain.handle('check-internet-connection', async () => {
  try {
    const isConnected = await checkInternetConnection();
    return { connected: isConnected };
  } catch (error) {
    return { connected: false, error: error.message };
  }
});

ipcMain.handle('get-connection-status', async () => {
  return {
    hasInternet: await checkInternetConnection()
  };
});

ipcMain.handle('force-sync', async () => {
  try {
    await syncBigPointsData(true);
    return { success: true, message: 'Forced sync executed successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-current-status', async () => {
  // email removido — não deve ser exposto ao renderer
  return {
    nodeRunning,
    nodeStats,
    totalBigPoints: totalBigPointsToday,
    currentDate: getCurrentDateBrazil(),
    syncActive: syncInterval !== null
  };
});

// Handler para instalar update
ipcMain.handle('install-update', async () => {
  console.log('[UPDATE] User chose to install update now');
  isUpdating = true;

  if (nodeRunning) {
    console.log('[UPDATE] Stopping node before update...');
    await stopBigchainNode(true);
  }

  if (totalBigPointsToday > 0) {
    console.log('[UPDATE] Final sync before update...');
    try {
      await syncBigPointsData(true);
    } catch (error) {
      console.log('[UPDATE] Sync error (non-critical):', error.message);
    }
  }

  stopWalletWatch();

  if (tray) {
    tray.destroy();
    tray = null;
  }

  console.log('[UPDATE] Calling quitAndInstall...');
  app.isQuitting = true;
  autoUpdater.quitAndInstall(false, true);

  return { success: true };
});

// Handler para adiar update
ipcMain.handle('postpone-update', async () => {
  console.log('[UPDATE] User chose to postpone update');
  isUpdating = false;
  autoUpdater.autoInstallOnAppQuit = false;
  return { success: true };
});

// ==========================================
// NODE CONTROL IPC HANDLERS
// ==========================================
ipcMain.handle('toggle-node', async (_, enabled) => {
  if (!enabled) {
    await stopBigchainNode();
  } else {
    startBigchainNode();
  }
  return { success: true };
});

ipcMain.handle('get-node-status', async () => {
  return { 
    nodeRunning,
    nodeStats,
    totalBigPoints: totalBigPointsToday
  };
});

ipcMain.on('language-changed', () => {
  console.log('Language changed, preserving node state:', nodeRunning);
  mainWindow?.webContents.send('node-status', nodeRunning);
  mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
  mainWindow?.webContents.send('node-stats-update', nodeStats);
});

ipcMain.on('firebase-token-response', (event, token) => {
  // Handled dynamically in getFirebaseIdToken()
});

// ==========================================
// WALLET IPC HANDLERS
// ==========================================
ipcMain.handle('get-wallet-data', async () => {
  const walletData = readWalletData();
  
  // Se wallet existe e temos saldo do node, atualiza
  if (walletData.success && nodeStats.balance) {
    walletData.data.balance = nodeStats.balance;
  }
  
  return walletData;
});

ipcMain.handle('refresh-wallet-balance', async () => {
  // Retorna o saldo atual das stats do node, ou o último conhecido do cache
  const balance = nodeStats.balance || loadBalanceCache();
  
  return {
    success: true,
    balance: balance
  };
});

ipcMain.handle('export-private-key', async (_, confirmed) => {
  if (!confirmed) {
    return { success: false, error: 'Export not confirmed' };
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Private Key — Security Warning',
    message: '⚠️  Are you sure you want to reveal your private key?',
    detail: 'Your private key gives FULL access to your wallet.\n\nNever share it with anyone. Make sure no one can see your screen.',
    buttons: ['Cancel', 'Yes, reveal my private key'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });

  console.log('[IPC] 🔑 Dialog response:', response);  // 0 = Cancel, 1 = Yes

  if (response !== 1) {
    console.log('[IPC] 🔒 export-private-key: cancelled by user via system dialog');
    return { success: false, error: 'Cancelled' };
  }

  console.log('[IPC] 🔑 export-private-key: confirmed via system dialog');

  const walletPath = findWalletFile();
  console.log('[IPC] Wallet path encontrado:', walletPath);

  if (!walletPath) {
    return { success: false, error: 'Wallet file not found' };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    console.log('[IPC] Wallet raw data:', raw);  // Verifique no console se aparece private_key
    // 🔧 CORREÇÃO: o campo correto é "private_key", não "private_key_hex"
    const privateKey = raw.private_key;
    if (!privateKey) {
      console.error('[IPC] Campo "private_key" não encontrado no ficheiro.');
      return { success: false, error: 'Private key not found in wallet file' };
    }
    return { success: true, privateKey: privateKey };
  } catch (error) {
    console.error('[IPC] Error reading wallet:', error);
    return { success: false, error: 'Error reading wallet file' };
  }
});

ipcMain.handle('check-wallet-exists', async () => {
  const walletPath = findWalletFile();
  // path removido da resposta — renderer não precisa conhecer caminhos do disco
  return { exists: !!walletPath };
});

ipcMain.handle('send-transaction', async (_, txData) => {
  const { to, amount, from } = txData || {};

  // 1. Validação do endereço de destino
  if (!to || typeof to !== 'string' || !to.startsWith('big')) {
    return { success: false, error: 'Invalid destination address (must start with "big")' };
  }
  // Endereço: "big" + 64 caracteres hex = 67
  if (to.length !== 67 || !/^big[a-f0-9]{64}$/i.test(to)) {
    return { success: false, error: 'Invalid destination address format' };
  }

  // 2. Validação do valor
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { success: false, error: 'Invalid amount (must be positive)' };
  }

  // 3. Verificar saldo
  const currentBalance = nodeStats.balance || loadBalanceCache();
  if (parsedAmount > currentBalance) {
    return { success: false, error: `Insufficient balance (${currentBalance.toFixed(8)} BIG available)` };
  }

  // 4. Chamar a API HTTP do nó
  try {
    const apiPort = 4000; // porta P2P padrão 3000 + 1000
    const response = await axios.post(`http://localhost:${apiPort}/transaction`, {
      to: to,
      amount: parsedAmount
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.success) {
      const txHash = response.data.tx_hash;
      console.log(`[TX] ✅ Transação enviada: ${parsedAmount} BIG → ${to}, hash: ${txHash}`);
      return { success: true, txHash };
    } else {
      console.error('[TX] ❌ Resposta inesperada da API:', response.data);
      return { success: false, error: response.data?.error || 'Transaction rejected by node' };
    }
  } catch (error) {
    console.error('[TX] ❌ Erro ao comunicar com o nó:', error.message);
    if (error.code === 'ECONNREFUSED') {
      return { success: false, error: 'Node is not running. Start the node to send transactions.' };
    }
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: `Failed to send transaction: ${error.message}` };
  }
});

// ==========================================
// LANGUAGE PREFERENCE HANDLERS
// ==========================================

const prefsPath = path.join(app.getPath('userData'), 'user-preferences.json');
const balanceCachePath = path.join(app.getPath('userData'), 'balance-cache.json');

// Função para carregar preferências
function loadPreferences() {
  try {
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(data);
      console.log('[PREFS] ✅ Carregado:', prefs);
      return prefs;
    }
  } catch (error) {
    console.error('[PREFS] ❌ Erro ao carregar:', error);
  }
  console.log('[PREFS] 📝 Usando padrões');
  return { language: 'en' }; // Padrão
}

// Função para salvar preferências
function savePreferences(prefs) {
  try {
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    console.log('[PREFS] ✅ Salvo:', prefs);
    console.log('[PREFS] 📁 Local:', prefsPath);
    return true;
  } catch (error) {
    console.error('[PREFS] ❌ Erro ao salvar:', error);
    return false;
  }
}

// Handler para salvar idioma
ipcMain.handle('save-language', async (event, lang) => {
  const VALID_LANGS = ['pt', 'en'];
  if (!VALID_LANGS.includes(lang)) {
    return { success: false, language: null, error: 'Idioma inválido' };
  }
  const prefs = loadPreferences();
  prefs.language = lang;
  const success = savePreferences(prefs);
  return { success, language: lang };
});

// Handler para obter idioma
ipcMain.handle('get-language', async () => {
  const prefs = loadPreferences();
  return prefs.language || 'en';
});

// ==========================================
// FIREBASE CONFIG — lido de variáveis de ambiente
// NUNCA hardcode credenciais no renderer
// ==========================================
// Logo após os requires e antes de qualquer app.whenReady()
ipcMain.handle('get-firebase-config', () => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  console.log('[MAIN] Firebase config delivered to renderer. Has apiKey:', !!config.apiKey);
  return config;
});

// ==========================================
// APP LIFECYCLE EVENTS
// ==========================================
app.on('before-quit', async (event) => {
  // Se está instalando update, deixa passar direto
  if (isUpdating) {
    console.log('[UPDATE] before-quit: isUpdating=true, allowing quit for install...');
    
    if (nodeRunning && nodeProcess) {
      console.log('[UPDATE] Stopping node...');
      await stopBigchainNode(true);
    }
    
    stopWalletWatch();
    
    if (totalBigPointsToday > 0) {
      console.log('[UPDATE] Final data sync...');
      try {
        await syncBigPointsData(true);
      } catch (error) {
        console.log('[UPDATE] Sync error (continuing anyway):', error.message);
      }
    }
    
    if (tray) {
      tray.destroy();
      tray = null;
    }
    
    return; // Deixa o quit continuar normalmente
  }

  if (!app.isQuitting) {
    event.preventDefault();
    return;
  }
  
  console.log('[APP] Application is quitting - cleaning up...');
  
  // ⭐ NÃO limpar localStorage - deixar tema salvo!
  // Apenas limpar cookies e sessão, mas NÃO localStorage
  console.log('[APP] Clearing session (except localStorage)...');
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Apenas limpa cookies e sessionstorage, NÃO localStorage!
    await mainWindow.webContents.session.clearStorageData({
      storages: ['sessionstorage', 'cookies']
    }).catch(err => console.log('[APP] Clear main storage error:', err));
    console.log('[APP] Main window session cleared (localStorage preserved)');
  }
  
  if (loginWindow && !loginWindow.isDestroyed()) {
    // Apenas limpa cookies e sessionstorage, NÃO localStorage!
    await loginWindow.webContents.session.clearStorageData({
      storages: ['sessionstorage', 'cookies']
    }).catch(err => console.log('[APP] Clear login storage error:', err));
    console.log('[APP] Login window session cleared (localStorage preserved)');
  }
  
  console.log('[QUIT] Normal application exit...');
  
  if (nodeRunning && nodeProcess) {
    event.preventDefault();
    console.log('[QUIT] Stopping node before exit...');
    
    await stopBigchainNode();
    
    if (totalBigPointsToday > 0) {
      try {
        await syncBigPointsData(true);
      } catch (error) {
        console.log('[QUIT] Sync error:', error.message);
      }
    }
    
    if (tray) {
      tray.destroy();
      tray = null;
    }
    
    setTimeout(() => {
      app.exit(0);
    }, 500);
    
    return;
  }
  
  // ⭐ Para monitoramento de wallet
  stopWalletWatch();
  
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && loginWindow === null) {
    createLoginWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (loginWindow) {
    loginWindow.show();
    loginWindow.focus();
  }
});

// ⭐ NOVO: Handler para conversão BIG → Solana
ipcMain.handle('convert-big', async (event, { solanaAddress, amount }) => {
  console.log('[CONVERT] 💱 Conversão solicitada');
  
  // ✅ Sanitização básica: apenas caracteres alfanuméricos e base58 (exceto 0, O, I, l)
  const sanitizedAddress = solanaAddress.replace(/[^1-9A-HJ-NP-Za-km-z]/g, '');
  if (sanitizedAddress.length < 32 || sanitizedAddress.length > 44) {
    return { success: false, error: 'Invalid Solana address length' };
  }
  
  console.log('[CONVERT] Endereço Solana sanitizado:', sanitizedAddress);
  console.log('[CONVERT] Quantidade:', amount, 'BIG');
  
  return new Promise((resolve, reject) => {
    const bigchainPath = getBigchainPath();
    const workingDir = getBigchainWorkingDir();
    
    console.log('[CONVERT] Executando bigchain.exe...');
    console.log('[CONVERT] Path:', bigchainPath);
    console.log('[CONVERT] Working dir:', workingDir);
    
    // Spawn processo bigchain com argumentos de conversão
    const bigchain = spawn(bigchainPath, [], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let currentStep = 'init';
    
    // Timeout de 60 segundos
    const timeout = setTimeout(() => {
      console.error('[CONVERT] ⏰ Timeout - processo demorou muito');
      bigchain.kill();
      reject({
        success: false,
        error: 'Timeout - processo demorou muito'
      });
    }, 60000);
    
    bigchain.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('[CONVERT OUT]', output.trim());
      
      // Detectar prompts e responder automaticamente
      if (output.includes('BIGchain-PoR>') && currentStep === 'init') {
        console.log('[CONVERT] → Enviando comando "convert"');
        bigchain.stdin.write('convert\n');
        currentStep = 'wallet';
      } 
      else if ((output.includes('Sua Wallet Solana:') || output.includes('Your Solana Wallet:')) && currentStep === 'wallet') {
        console.log('[CONVERT] → Enviando endereço Solana');
        bigchain.stdin.write(solanaAddress + '\n');
        currentStep = 'amount';
      } 
      else if ((output.includes('Quanto BIG converter?') || output.includes('How much BIG to convert?')) && currentStep === 'amount') {
        console.log('[CONVERT] → Enviando quantidade');
        bigchain.stdin.write(amount.toString() + '\n');
        currentStep = 'confirm';
      } 
      else if ((output.includes('Confirmar conversao?') || output.includes('Confirm conversion?')) && currentStep === 'confirm') {
        console.log('[CONVERT] → Confirmando conversão');
        bigchain.stdin.write('s\n');
        currentStep = 'processing';
      }
      else if (output.includes('Conversao ID:') || output.includes('Conversion ID:')) {
        console.log('[CONVERT] ✅ Conversão iniciada com sucesso!');
        
        clearTimeout(timeout);
        
        // Parse do ID da conversão
        const idMatch = output.match(/(?:Conversao|Conversion) ID:\s*(CONV_\d+)/i);
        const amountMatch = output.match(/(?:receber|receive):\s*([\d.]+)\s*BIG/i);
        const feeMatch = output.match(/Taxa.*:\s*([\d.]+)\s*BIG/i);
        
        const result = {
          success: true,
          data: {
            id: idMatch ? idMatch[1] : `CONV_${Date.now()}`,
            big_amount: amount,
            big_after_fee: amountMatch ? parseFloat(amountMatch[1]) : amount * 0.98,
            fee: feeMatch ? parseFloat(feeMatch[1]) : amount * 0.02,
            solana_address: solanaAddress,
            timestamp: Date.now()
          }
        };
        
        console.log('[CONVERT] Resultado:', result);
        
        // Mata processo
        bigchain.kill();
        
        resolve(result);
      }
      else if (output.includes('Erro:') || output.includes('Error:') || output.includes('invalido') || output.includes('invalid')) {
        console.error('[CONVERT] ❌ Erro detectado no output');
        clearTimeout(timeout);
        bigchain.kill();
        
        reject({
          success: false,
          error: 'Erro na conversão: ' + output.trim()
        });
      }
    });
    
    bigchain.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[CONVERT ERR]', data.toString().trim());
    });
    
    bigchain.on('error', (error) => {
      console.error('[CONVERT] ❌ Erro ao executar bigchain:', error);
      clearTimeout(timeout);
      reject({
        success: false,
        error: 'Erro ao executar bigchain: ' + error.message
      });
    });
    
    bigchain.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code !== 0 && code !== null) {
        console.error('[CONVERT] ❌ Processo terminou com código:', code);
        console.error('[CONVERT] stderr:', stderr);
        
        reject({
          success: false,
          error: `Processo terminou com erro (code ${code})`
        });
      }
    });
  });
});

async function checkInternetConnection() {
  try {
    await axios.get('https://www.google.com', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}