const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');

// Silencia todos os logs se estiver em produção
if (process.env.NODE_ENV === 'production') {
  ['log', 'debug', 'info', 'warn', 'error'].forEach(method => {
    console[method] = () => {};
  });
}

let mainWindow;
let tray = null;
let minerProcess = null;
let miningThreads = 4;
let currentUserEmail = null;
let isSharing = false;

// Variáveis para tracking individual do usuário baseado em shares
const WALLET_ADDRESS = 'pkt1q2phzyfzd7aufszned7q2h77t4u0kl3exxgyuqf';

let lastAcceptedShares = 0;
let totalBigPointsToday = 0;
let currentFirebaseToken = null;

// Implementa o controle de instância única
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.show();
    }
  });

  app.whenReady().then(() => {
    createTray();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// Função para obter token Firebase do renderer
function getFirebaseIdToken() {
  return new Promise((resolve, reject) => {
    if (currentFirebaseToken) {
      resolve(currentFirebaseToken);
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao obter token Firebase'));
    }, 5000);
    
    mainWindow?.webContents.send('request-firebase-token');
    
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

// Função para sincronizar dados usando API backend
async function syncBigPointsData() {
  if (!currentUserEmail) {
    console.log('[SYNC] Email não disponível, pulando sincronização');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const amount = parseFloat(totalBigPointsToday.toFixed(6));

  console.log(`[SYNC] Enviando ${amount} BIG Points via API backend...`);

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
      console.log('[SYNC] BIG Points sincronizados com sucesso via API!');
      console.log('[SYNC] Resposta:', response.data.message);
      if (response.data.data) {
        console.log('[SYNC] Dados:', JSON.stringify(response.data.data));
      }
    } else {
      console.error('[SYNC] Erro na resposta da API:', response.data);
    }

  } catch (error) {
    console.error('[SYNC] Erro ao sincronizar via API:', error.message);
    
    if (error.response) {
      console.error('[SYNC] Status HTTP:', error.response.status);
      console.error('[SYNC] Dados erro:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('[SYNC] Token Firebase expirado, limpando cache...');
        currentFirebaseToken = null;
      }
    }
  }
}

// Função para parsear shares aceitas do usuário individual
function parseUserMiningShares(output) {
  const statsRegex = /accept\/reject\/overload:\s*\[(\d+)\/(\d+)\/(\d+)\]/;
  const match = output.match(statsRegex);
  
  if (match) {
    const acceptedShares = parseInt(match[1], 10);
    const rejectedShares = parseInt(match[2], 10);
    const overloadShares = parseInt(match[3], 10);
    
    console.log(`[USER SHARES] Aceitas: ${acceptedShares}, Rejeitadas: ${rejectedShares}, Overload: ${overloadShares}`);
    
    if (acceptedShares > lastAcceptedShares) {
      const newShares = acceptedShares - lastAcceptedShares;
      lastAcceptedShares = acceptedShares;
      
      // Valor conservador por share para evitar prejuízo
      const pktPerShare = 0.001; // 1 share aceita = 0.001 PKT (valor seguro)
      const bigPointsEarned = newShares * pktPerShare;
      
      totalBigPointsToday += bigPointsEarned;
      
      console.log(`[USER MINING] +${newShares} shares aceitas`);
      console.log(`[USER MINING] +${bigPointsEarned.toFixed(6)} BIG Points ganhos`);
      console.log(`[USER MINING] Total do usuário hoje: ${totalBigPointsToday.toFixed(6)} BIG Points`);
      
      // Envia dados atualizados para o renderer
      mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
      
      // Sincroniza com backend apenas quando há novos ganhos
      syncBigPointsData();
      
      return { newShares, bigPointsEarned, totalBigPoints: totalBigPointsToday };
    }
  }
  
  return null;
}

function getPacketcryptPath() {
  if (isDev) {
    return path.join(__dirname, 'assets', 'packetcrypt.exe');
  } else {
    return path.join(process.resourcesPath, 'assets', 'packetcrypt.exe');
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
      console.log(`Verificando ícone em: ${p} - ${exists ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
      return exists;
    });
    
    if (!iconPath) {
      console.error('Nenhum ícone encontrado nos caminhos:', possiblePaths);
      iconPath = process.execPath;
    }
  }
  
  console.log('Usando ícone do caminho:', iconPath);
  return iconPath;
}

function createTray() {
  if (tray) {
    console.log('Tray já existe, não criando novamente');
    return true;
  }
  
  try {
    const iconPath = getIconPath();
    if (!iconPath) {
      console.error('Não foi possível encontrar o ícone para o tray');
      return false;
    }
    
    console.log('Criando tray com ícone:', iconPath);
    
    tray = new Tray(iconPath);
    
    if (!tray) {
      console.error('Falha ao criar o tray');
      return false;
    }
    
    tray.setToolTip('BIGFOOT Connect - Click to open');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open BIGFOOT Connect',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
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
      console.log('Tray clicado');
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
        }
      }
    });
    
    tray.on('double-click', () => {
      console.log('Tray duplo-clicado');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
      }
    });
    
    console.log('Tray criado com sucesso!');
    console.log('Tray destruído?', tray.isDestroyed());
    console.log('Plataforma:', process.platform);
    console.log('Versão Electron:', process.versions.electron);
    
    return true;
  } catch (error) {
    console.error('Erro ao criar tray:', error);
    tray = null;
    return false;
  }
}

// IPC Handlers
ipcMain.handle('register-user', async (_, id, password) => {
  try {
    await axios.post('https://bigfootconnect.tech/register', { id, password });
    return { success: true };
  } catch (err) {
    const message = err.response?.data?.message || 'Erro ao se cadastrar.';
    return { success: false, message };
  }
});

ipcMain.handle('store-email', async (_, email) => {
  currentUserEmail = email;
  console.log(`E-mail armazenado: ${email}`);
});

ipcMain.handle('store-firebase-token', async (_, token) => {
  currentFirebaseToken = token;
  console.log('[TOKEN] Token Firebase atualizado');
  return { success: true };
});

ipcMain.handle('open-external', async (_, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('Erro ao abrir link externo:', err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('open-dashboard', () => {
  shell.openExternal('https://bigfootconnect.tech/dashboard');
});

function createWindow() {
  console.log('Criando janela principal...');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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

  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
      if (input.key === 'F12') {
        event.preventDefault();
      }
    });
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'win32' && tray) {
        tray.displayBalloon({
          title: 'BIGFOOT Connect',
          content: 'Aplicativo minimizado para a área de notificação',
          icon: path.join(__dirname, 'assets', 'icon.ico')
        });
      }
    } else {
      stopMining();
    }
  });
}

// Função de mineração baseada em shares do usuário
function startMining(threads = 4) {
  if (minerProcess) return;

  miningThreads = threads;
  isSharing = true;

  const packetcryptPath = getPacketcryptPath();
  
  const fs = require('fs');
  if (!fs.existsSync(packetcryptPath)) {
    console.error(`Arquivo não encontrado: ${packetcryptPath}`);
    mainWindow?.webContents.send('miner-log', `ERRO: Arquivo packetcrypt.exe não encontrado em: ${packetcryptPath}`);
    return;
  }

  console.log(`Iniciando mineração individual do usuário: ${packetcryptPath}`);
  const args = ['ann', '-t', threads.toString(), '-p', WALLET_ADDRESS, 'http://pool.pkt.world'];

  // Reset contadores individuais do usuário
  lastAcceptedShares = 0;
  // NÃO reseta totalBigPointsToday para manter acúmulo do dia

  try {
    minerProcess = spawn(packetcryptPath, args);

    minerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[STDOUT] ${output}`);
      parseUserMiningShares(output);
      mainWindow?.webContents.send('miner-log', output);
    });

    minerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[STDERR] ${error}`);
      parseUserMiningShares(error);
      mainWindow?.webContents.send('miner-log', error);
    });

    minerProcess.on('error', (error) => {
      console.error(`Erro ao executar minerador: ${error.message}`);
      mainWindow?.webContents.send('miner-log', `ERRO: ${error.message}`);
      minerProcess = null;
      isSharing = false;
    });

    minerProcess.on('close', (code) => {
      console.log(`Minerador finalizado com código ${code}`);
      minerProcess = null;
      isSharing = false;
      mainWindow?.webContents.send('sharing-status', false);
    });

    mainWindow?.webContents.send('sharing-status', true);
    
  } catch (error) {
    console.error(`Erro ao iniciar mineração: ${error.message}`);
    mainWindow?.webContents.send('miner-log', `ERRO: ${error.message}`);
  }
}

function stopMining() {
  console.log('Parando mineração...');
  if (minerProcess) {
    minerProcess.kill();
    minerProcess = null;
    mainWindow?.webContents.send('sharing-status', false);
  }
  
  isSharing = false;
  mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
}

ipcMain.handle('toggle-sharing', async (_, enabled) => {
  if (!enabled) stopMining();
  else startMining(miningThreads);
  return { success: true };
});

ipcMain.handle('get-sharing-status', async () => {
  return { 
    isSharing, 
    threads: miningThreads,
    totalBigPoints: totalBigPointsToday
  };
});

ipcMain.on('language-changed', () => {
  console.log('Idioma alterado, preservando estado do compartilhamento:', isSharing);
  mainWindow?.webContents.send('sharing-status', isSharing);
  mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
});

ipcMain.on('start-mining-with-threads', (_, threads) => {
  startMining(threads);
});

ipcMain.on('firebase-token-response', (event, token) => {
  // Este listener é tratado dinamicamente em getFirebaseIdToken()
});

app.on('before-quit', (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    return;
  }
  
  mainWindow?.webContents.send('bigpoints-data', totalBigPointsToday);
  syncBigPointsData();
  
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

autoUpdater.autoDownload = true;

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização disponível',
    message: 'Uma nova versão está sendo baixada...',
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'question',
    title: 'Atualização pronta',
    message: 'Atualização baixada. Deseja reiniciar agora para aplicar?',
    buttons: ['Sim', 'Depois'],
  }).then(result => {
    if (result.response === 0) {
      app.isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
  app.quit();
});

ipcMain.handle('debug-email', async () => {
  console.log('[DEBUG] Email atual no main:', currentUserEmail);
  return { email: currentUserEmail };
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});