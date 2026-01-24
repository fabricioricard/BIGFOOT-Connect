const { contextBridge, ipcRenderer, shell } = require('electron');

// Detecta se é produção
const isProd = !process.argv.find(arg => arg.includes('--inspect')) && !process.defaultApp;

contextBridge.exposeInMainWorld('env', {
  isProd
});

contextBridge.exposeInMainWorld('electronAPI', {
  // ==========================================
  // NOVOS HANDLERS DE AUTENTICAÇÃO
  // ==========================================
  loginSuccess: (email) => ipcRenderer.invoke('login-success', email),
  logoutRequested: () => ipcRenderer.invoke('logout-requested'),
  
  // ==========================================
  // APIs EXISTENTES
  // ==========================================
  startMiningWithThreads: (threads) => ipcRenderer.send('start-mining-with-threads', threads), 
  toggleSharing: (state) => ipcRenderer.invoke('toggle-sharing', state),
  registerUser: (email, password) => ipcRenderer.invoke('register-user', email, password), 
  openDashboard: () => ipcRenderer.invoke('open-dashboard'), 
  storeEmail: (email) => ipcRenderer.invoke('store-email', email),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSharing: () => ipcRenderer.invoke('get-sharing-status'),
  
  // APIs para backend - gerenciamento de tokens Firebase
  storeFirebaseToken: (token) => ipcRenderer.invoke('store-firebase-token', token),
  
  // APIs para conectividade
  checkInternetConnection: () => ipcRenderer.invoke('check-internet-connection'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  
  // APIs para UPDATE
  installUpdate: () => ipcRenderer.invoke('install-update'),
  postponeUpdate: () => ipcRenderer.invoke('postpone-update'),
  
  // Listener para mudanças de idioma e comunicação IPC
  send: (channel, data) => {
    const validChannels = [
      'language-changed', 
      'start-mining-with-threads', 
      'firebase-token-response'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // ==========================================
  // LISTENERS PARA EVENTOS DO MAIN PROCESS
  // ==========================================
  
  onSharingStatus: (callback) => {
    ipcRenderer.on('sharing-status', (event, status) => {
      callback(status);
    });
  },
  
  onMinerLog: (callback) => {
    ipcRenderer.on('miner-log', (event, log) => {
      callback(log);
    });
  },
  
  onMinerError: (callback) => {
    ipcRenderer.on('miner-error', (event, error) => {
      callback(error);
    });
  },
  
  onBigPointsData: (callback) => {
    ipcRenderer.on('bigpoints-data', (event, data) => {
      callback(data);
    });
  },
  
  onRequestFirebaseToken: (callback) => {
    ipcRenderer.on('request-firebase-token', (event) => {
      callback();
    });
  },
  
  onConnectionRestored: (callback) => {
    ipcRenderer.on('connection-restored', (event) => {
      callback();
    });
  },
  
  onUpdateNotification: (callback) => {
    ipcRenderer.on('update-notification', (event, data) => {
      callback(data);
    });
  },
  
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, progress) => {
      callback(progress);
    });
  },
  
  // ==========================================
  // CLEANUP DE LISTENERS
  // ==========================================
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  removeSharingStatusListener: (callback) => ipcRenderer.removeListener('sharing-status', callback),
  removeBigPointsDataListener: (callback) => ipcRenderer.removeListener('bigpoints-data', callback),
  removeMinerLogListener: (callback) => ipcRenderer.removeListener('miner-log', callback),
  removeRequestFirebaseTokenListener: (callback) => ipcRenderer.removeListener('request-firebase-token', callback),
  removeConnectionRestoredListener: (callback) => ipcRenderer.removeListener('connection-restored', callback),
  removeUpdateNotificationListener: (callback) => ipcRenderer.removeListener('update-notification', callback),
  removeUpdateProgressListener: (callback) => ipcRenderer.removeListener('update-progress', callback)
});