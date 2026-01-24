const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');

// Define o nome do app ANTES de qualquer outra coisa
app.setName('BIGFOOT Connect');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'fabricioricard',
  repo: 'BIGFOOT-Connect'
});

const isDev = require('electron-is-dev');

// Auto-updater logs
autoUpdater.on('checking-for-update', () => {
  console.log('[UPDATER] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[UPDATER] Update available:', info.version);
  
  const targetWindow = mainWindow || loginWindow;
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('update-notification', {
      type: 'available',
      version: info.version,
      message: isSharing 
        ? 'A new version is being downloaded...\n\nNOTICE: Mining will be paused during the update installation.'
        : 'A new version is being downloaded...'
    });
  }
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

autoUpdater.on('update-downloaded', async (info) => {
  console.log('[UPDATER] Update downloaded:', info.version);
  autoUpdater.autoInstallOnAppQuit = false;
  
  const targetWindow = mainWindow || loginWindow;
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('update-notification', {
      type: 'downloaded',
      version: info.version,
      message: isSharing
        ? 'Update downloaded. Mining will be paused to apply the update.\n\nDo you want to restart now?'
        : 'Update downloaded. Do you want to restart now to apply it?'
    });
  }
});

let mainWindow;
let loginWindow;
let tray = null;
let minerProcess = null;
let miningThreads = 1;
let currentUserEmail = null;
let isSharing = false;

// XMRig wallet configuration
const XMR_WALLET = '4B8UJL6tKqyB1CVEjH5rULBmA4A5wrPoz3AHQHAhbFGWVhjWXZ7tYgCNZvLi7PcnUWRruYZUxjSbLaVGTqL3HDC7PbSL4yk';
const POOL_URL = 'gulf.moneroocean.stream:10128';

// Tracking variables
let lastAcceptedShares = 0;
let totalBigPointsToday = 0;
let currentFirebaseToken = null;
let lastHashrate = 0;

// Sync variables
let syncInterval = null;
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 30000;
const MIN_SYNC_INTERVAL_MS = 5000;

// Update control flag
let isUpdating = false;

// Single instance lock
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

  app.whenReady().then(() => {
    createTray();
    
    // SEMPRE inicia com tela de login
    createLoginWindow();
    
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// REMOVIDA: Função checkExistingSession - não é mais necessária

// Firebase token management
function getFirebaseIdToken() {
  return new Promise((resolve, reject) => {
    if (currentFirebaseToken) {
      resolve(currentFirebaseToken);
      return;
    }

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

// Get current date in Brazil timezone
function getCurrentDateBrazil() {
  const now = new Date();
  const brazilDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Daily counter reset
function checkAndResetDailyCounters() {
  const currentDate = getCurrentDateBrazil();
  const lastSavedDate = global.lastSavedDate || null;
  
  if (lastSavedDate !== currentDate) {
    console.log(`[DAILY RESET] New day detected: ${lastSavedDate} → ${currentDate}`);
    console.log(`[DAILY RESET] Resetting counters. Previous total: ${totalBigPointsToday} BIG`);
    
    totalBigPointsToday = 0;
    lastAcceptedShares = 0;
    lastHashrate = 0;
    global.lastSavedDate = currentDate;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bigpoints-data', totalBigPointsToday);
      mainWindow.webContents.send('daily-reset', currentDate);
    }
    
    console.log(`[DAILY RESET] Counters reset for ${currentDate}`);
  }
}

// Sync BigPoints data
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
  console.log(`[SYNC] Current time: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
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

// Periodic sync
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

// Parse XMRig output for shares and hashrate
function parseXMRigOutput(output) {
  const acceptedMatch = output.match(/accepted\s+\((\d+)\/(\d+)\)/i);
  
  if (acceptedMatch) {
    const acceptedShares = parseInt(acceptedMatch[1], 10);
    const rejectedShares = parseInt(acceptedMatch[2], 10);
    
    console.log(`[XMRIG] Shares - Accepted: ${acceptedShares}, Rejected: ${rejectedShares}`);
    console.log(`[DEBUG] lastAcceptedShares before: ${lastAcceptedShares}`);
    
    if (acceptedShares > lastAcceptedShares) {
      const newShares = acceptedShares - lastAcceptedShares;
      lastAcceptedShares = acceptedShares;
      
      const bigPointsPerShare = 5.0;
      const bigPointsEarned = newShares * bigPointsPerShare;
      
      totalBigPointsToday += bigPointsEarned;
      
      console.log(`[XMRIG MINING] +${newShares} accepted shares`);
      console.log(`[BIG POINTS] +${bigPointsEarned.toFixed(6)} BIG Points earned (${bigPointsPerShare} per share)`);
      console.log(`[BIG POINTS] Total today: ${totalBigPointsToday.toFixed(6)} BIG Points`);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bigpoints-data', totalBigPointsToday);
        mainWindow.webContents.send('share-accepted', {
          newShares: newShares,
          bigPointsEarned: bigPointsEarned,
          totalBigPoints: totalBigPointsToday
        });
      }
      
      syncBigPointsData();
      return { newShares, bigPointsEarned, totalBigPoints: totalBigPointsToday };
    } 
    else if (acceptedShares < lastAcceptedShares) {
      console.log(`[XMRIG] ATTENTION: Miner restarted - shares: ${lastAcceptedShares} → ${acceptedShares}`);
      lastAcceptedShares = acceptedShares;
    }
  }
  
  const hashrateMatch = output.match(/miner\s+speed\s+[\w\/]+\s+([\d.]+)\s+([\d.]+)\s+(?:[\d.]+|n\/a)\s+H\/s/i);
  
  if (hashrateMatch) {
    const hashrate60s = parseFloat(hashrateMatch[2]);
    
    if (Math.abs(hashrate60s - lastHashrate) > 0.5 || lastHashrate === 0) {
      lastHashrate = hashrate60s;
      console.log(`[XMRIG] Current hashrate: ${lastHashrate.toFixed(2)} H/s`);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hashrate-update', lastHashrate);
      }
    }
  }
  
  return null;
}

function getXMRigPath() {
  if (isDev) {
    return path.join(__dirname, 'assets', 'xmrig.exe');
  } else {
    return path.join(process.resourcesPath, 'assets', 'xmrig.exe');
  }
}

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
    
    const fs = require('fs');
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

// Criar janela de Login
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loginWindow.setMenu(null);
  
  const fs = require('fs');
  if (!fs.existsSync(loginPath)) {
    console.error('[LOGIN] File not found:', loginPath);
    console.error('[LOGIN] Current directory:', __dirname);
    console.error('[LOGIN] Files in renderer:', fs.readdirSync(path.join(__dirname, 'renderer')));
  }
  
  loginWindow.loadFile(loginPath).catch(err => {
    console.error('[LOGIN] Error loading file:', err);
  });

  loginWindow.once('ready-to-show', () => {
    loginWindow.maximize();
    loginWindow.show();
    loginWindow.focus();
  });

  loginWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      console.log('Opening DevTools...');
      loginWindow.webContents.openDevTools({ mode: 'detach' });
    }
    if (input.key === 'F12') {
      console.log('Opening DevTools...');
      loginWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  loginWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      loginWindow.hide();
    }
  });
}

// IPC Handlers
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
  console.log(`[EMAIL] Stored: ${email}`);
  return { success: true };
});

ipcMain.handle('store-firebase-token', async (_, token) => {
  currentFirebaseToken = token;
  console.log('[TOKEN] Firebase token updated');
  return { success: true };
});

// Handler para login bem-sucedido
ipcMain.handle('login-success', async (_, email) => {
  console.log('[AUTH] ✅ Login successful for:', email);
  currentUserEmail = email;
  
  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }
  
  createWindow();
  
  return { success: true };
});

// Handler para logout
ipcMain.handle('logout-requested', async () => {
  console.log('[AUTH] 🚪 Logout requested - clearing session');
  
  // MARCA que deve limpar sessão
  shouldClearSession = true;
  
  // Stop mining if active
  if (isSharing) {
    await stopMining();
  }
  
  // Sync final data
  if (totalBigPointsToday > 0) {
    try {
      await syncBigPointsData(true);
    } catch (error) {
      console.log('[LOGOUT] Sync error:', error.message);
    }
  }
  
  // Clear user data
  currentUserEmail = null;
  currentFirebaseToken = null;
  totalBigPointsToday = 0;
  lastAcceptedShares = 0;
  lastHashrate = 0;
  
  // CRITICAL: Clear Firebase session in main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.webContents.session.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cookies']
    }).catch(err => console.log('[LOGOUT] Clear storage error:', err));
    console.log('[LOGOUT] ✅ Session data cleared from main window');
  }
  
  // Close main window
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  
  // Open login window
  createLoginWindow();
  
  // Reset flag após limpar
  shouldClearSession = false;
  
  return { success: true };
});

ipcMain.handle('open-external', async (_, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('Error opening external link:', err);
    return { success: false, message: err.message };
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
  return {
    isSharing,
    threads: miningThreads,
    totalBigPoints: totalBigPointsToday,
    currentDate: getCurrentDateBrazil(),
    email: currentUserEmail,
    syncActive: syncInterval !== null,
    hashrate: lastHashrate
  };
});

// Handler para instalar update
ipcMain.handle('install-update', async () => {
  console.log('[UPDATE] User chose to install update now');
  isUpdating = true;
  shouldClearSession = true; // Limpa sessão em updates também
  
  if (isSharing) {
    console.log('[UPDATE] Stopping mining before update...');
    await stopMining(true);
  }
  
  if (totalBigPointsToday > 0) {
    console.log('[UPDATE] Final sync before update...');
    try {
      await syncBigPointsData(true);
    } catch (error) {
      console.log('[UPDATE] Sync error (non-critical):', error.message);
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('[UPDATE] Installing update and restarting...');
  app.isQuitting = true;
  
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  
  return { success: true };
});

// Handler para adiar update
ipcMain.handle('postpone-update', async () => {
  console.log('[UPDATE] User chose to postpone update');
  isUpdating = false;
  autoUpdater.autoInstallOnAppQuit = false;
  return { success: true };
});

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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      console.log('Opening DevTools...');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    if (input.key === 'F12') {
      console.log('Opening DevTools...');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
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
      stopMining();
    }
  });
}

// Start XMRig mining
function startMining(threads = 1) {
  if (minerProcess) return;

  if (threads < 1) threads = 1;
  if (threads > 4) threads = 4;

  miningThreads = threads;
  isSharing = true;

  const xmrigPath = getXMRigPath();
  
  const fs = require('fs');
  if (!fs.existsSync(xmrigPath)) {
    console.error(`File not found: ${xmrigPath}`);
    mainWindow?.webContents.send('miner-log', `ERROR: xmrig.exe not found at: ${xmrigPath}`);
    return;
  }

  const threadLevels = {
    1: 'LOW (Baixo) - Light Mining',
    2: 'MEDIUM (Médio) - Balanced Mining',
    3: 'HIGH (Alto) - Performance Mining',
    4: 'MAXIMUM (Máximo) - Maximum Performance'
  };

  console.log(`[MINING] Starting XMRig - Level: ${threadLevels[threads]}`);
  console.log(`[MINING] Current date (Brazil): ${getCurrentDateBrazil()}`);
  console.log(`[MINING] Configuration: ${threads} thread(s), optimized for performance`);
  
  const args = [
    '-o', POOL_URL,
    '-u', XMR_WALLET,
    '-p', 'BIG',
    '-k',
    '-t', threads.toString(),
    '--donate-level', '1'
  ];

  if (threads === 1) {
    args.push('--cpu-priority', '1');
    args.push('--randomx-mode', 'light');
    args.push('--cpu-max-threads-hint', '25');
  } else if (threads === 2) {
    args.push('--cpu-priority', '2');
    args.push('--randomx-mode', 'auto');
    args.push('--cpu-max-threads-hint', '45');
  } else if (threads === 3) {
    args.push('--cpu-priority', '2');
    args.push('--randomx-mode', 'auto');
    args.push('--cpu-max-threads-hint', '60');
    args.push('--asm', 'auto');
  } else if (threads === 4) {
    args.push('--cpu-priority', '2');
    args.push('--randomx-mode', 'auto');
    args.push('--cpu-max-threads-hint', '70');
    args.push('--asm', 'auto');
    args.push('--randomx-1gb-pages');
  }

  args.push('--pause-on-battery');
  args.push('--randomx-no-rdmsr');
  args.push('--log-file', path.join(app.getPath('userData'), 'xmrig.log'));

  checkAndResetDailyCounters();
  lastAcceptedShares = 0;
  lastHashrate = 0;

  try {
    minerProcess = spawn(xmrigPath, args);

    minerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[STDOUT] ${output}`);
      parseXMRigOutput(output);
      mainWindow?.webContents.send('miner-log', output);
    });

    minerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[STDERR] ${error}`);
      parseXMRigOutput(error);
      mainWindow?.webContents.send('miner-log', error);
    });

    minerProcess.on('error', (error) => {
      console.error(`[MINING] Error: ${error.message}`);
      mainWindow?.webContents.send('miner-log', `ERROR: ${error.message}`);
      minerProcess = null;
      isSharing = false;
    });

    minerProcess.on('close', (code) => {
      console.log(`[MINING] Finished with code ${code}`);
      minerProcess = null;
      isSharing = false;
      stopPeriodicSync();
      mainWindow?.webContents.send('sharing-status', false);
    });

    mainWindow?.webContents.send('sharing-status', true);
    startPeriodicSync();
    syncBigPointsData(true);
    
  } catch (error) {
    console.error(`[MINING] Error starting: ${error.message}`);
    mainWindow?.webContents.send('miner-log', `ERROR: ${error.message}`);
  }
}

function debugCurrentState() {
  console.log("=== DEBUG CURRENT STATE ===");
  console.log(`Current email: ${currentUserEmail}`);
  console.log(`Firebase token: ${currentFirebaseToken ? 'Present' : 'Absent'}`);
  console.log(`Mining active: ${isSharing}`);
  console.log(`Mining process: ${minerProcess ? 'Active' : 'Inactive'}`);
  console.log(`Total BIG Points today: ${totalBigPointsToday}`);
  console.log(`Accepted shares: ${lastAcceptedShares}`);
  console.log(`Current hashrate: ${lastHashrate.toFixed(2)} H/s`);
  console.log(`Current date (Brazil): ${getCurrentDateBrazil()}`);
  console.log(`Periodic sync active: ${syncInterval ? 'Yes' : 'No'}`);
  console.log("================================");
}

setInterval(debugCurrentState, 10000);

function stopMining(forUpdate = false) {
  console.log(`[MINING] Stopping mining... ${forUpdate ? '(for update)' : ''}`);
  
  stopPeriodicSync();
  
  return new Promise((resolve) => {
    if (!minerProcess) {
      console.log('[MINING] No active process');
      isSharing = false;
      mainWindow?.webContents.send('sharing-status', false);
      resolve();
      return;
    }

    const processName = 'xmrig.exe';
    
    try {
      console.log('[MINING] Terminating process...');
      minerProcess.kill('SIGTERM');
    } catch (error) {
      console.log('[MINING] Error terminating:', error.message);
    }

    setTimeout(() => {
      if (minerProcess && !minerProcess.killed) {
        console.log('[MINING] Forcing termination...');
        
        if (process.platform === 'win32') {
          exec(`taskkill /F /IM ${processName} /T`, (error) => {
            if (error && !error.message.includes('not found')) {
              console.log('[MINING] Taskkill error:', error.message);
            }
          });
        }
        
        try {
          minerProcess.kill('SIGKILL');
        } catch (killError) {
          console.log('[MINING] Process already terminated:', killError.message);
        }
      }

      minerProcess = null;
      isSharing = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sharing-status', false);
      }
      
      console.log('[MINING] Stopped successfully');
      
      if (totalBigPointsToday > 0) {
        syncBigPointsData(true).finally(() => resolve());
      } else {
        resolve();
      }
      
    }, forUpdate ? 2000 : 1000);
  });
}

ipcMain.handle('toggle-sharing', async (_, enabled) => {
  if (!enabled) {
    await stopMining();
  } else {
    startMining(miningThreads);
  }
  return { success: true };
});

ipcMain.handle('get-sharing-status', async () => {
  return { 
    isSharing, 
    threads: miningThreads,
    totalBigPoints: totalBigPointsToday,
    hashrate: lastHashrate,
    miner: 'xmrig'
  };
});

ipcMain.on('language-changed', () => {
  console.log('Language changed, preserving sharing state:', isSharing);
  mainWindow?.webContents.send('sharing-status', isSharing);
  mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
  mainWindow?.webContents.send('hashrate-update', lastHashrate);
});

ipcMain.on('start-mining-with-threads', (_, threads) => {
  startMining(threads);
});

ipcMain.on('firebase-token-response', (event, token) => {
  // Handled dynamically in getFirebaseIdToken()
});

app.on('before-quit', async (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    return;
  }
  
  console.log('[APP] Application is quitting - cleaning up...');
  
  // SEMPRE limpa sessão ao fechar (para forçar login na próxima abertura)
  console.log('[APP] 🔒 Clearing session to force login on next start...');
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.webContents.session.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cookies']
    }).catch(err => console.log('[APP] Clear main storage error:', err));
    console.log('[APP] Main window session cleared');
  }
  
  if (loginWindow && !loginWindow.isDestroyed()) {
    await loginWindow.webContents.session.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cookies']
    }).catch(err => console.log('[APP] Clear login storage error:', err));
    console.log('[APP] Login window session cleared');
  }
  
  if (isUpdating) {
    event.preventDefault();
    
    console.log('[UPDATE] Preparing for update installation...');
    
    if (isSharing && minerProcess) {
      console.log('[UPDATE] Stopping mining...');
      await stopMining(true);
    }
    
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
    
    setTimeout(() => {
      console.log('[UPDATE] Launching installer...');
      autoUpdater.quitAndInstall(false, true);
    }, 500);
    
    return;
  }
  
  console.log('[QUIT] Normal application exit...');
  
  if (isSharing && minerProcess) {
    event.preventDefault();
    console.log('[QUIT] Stopping mining before exit...');
    
    await stopMining();
    
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
  
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && loginWindow === null) {
    createLoginWindow(); // Sempre mostra login
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (loginWindow) {
    loginWindow.show();
    loginWindow.focus();
  }
});

async function checkInternetConnection() {
  try {
    await axios.get('https://www.google.com', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}