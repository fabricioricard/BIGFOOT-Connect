const { contextBridge, ipcRenderer, shell } = require('electron');

// Detecta se é produção
const isProd = !process.argv.find(arg => arg.includes('--inspect')) && !process.defaultApp;

contextBridge.exposeInMainWorld('env', {
  isProd
});

contextBridge.exposeInMainWorld('electronAPI', {
  // APIs existentes
  startMiningWithThreads: (threads) => ipcRenderer.send('start-mining-with-threads', threads), 
  toggleSharing: (state) => ipcRenderer.invoke('toggle-sharing', state),
  registerUser: (email, password) => ipcRenderer.invoke('register-user', email, password), 
  openDashboard: () => ipcRenderer.invoke('open-dashboard'), 
  storeEmail: (email) => ipcRenderer.invoke('store-email', email),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSharing: () => ipcRenderer.invoke('get-sharing-status'),
  
  // APIs para backend - gerenciamento de tokens Firebase
  storeFirebaseToken: (token) => ipcRenderer.invoke('store-firebase-token', token),
  
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

  // Listeners para eventos do main process
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

  // Listener para dados reais de BIG Points
  onBigPointsData: (callback) => {
    ipcRenderer.on('bigpoints-data', (event, data) => {
      callback(data);
    });
  },

  // Listener para solicitações de token Firebase do main process
  onRequestFirebaseToken: (callback) => {
    ipcRenderer.on('request-firebase-token', (event) => {
      callback();
    });
  },

  // Cleanup de listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});