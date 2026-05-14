const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ==========================================
  // FIREBASE CONFIG (nunca hardcode no renderer)
  // ==========================================
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),

  // ==========================================
  // AUTENTICAÇÃO
  // ==========================================
  loginSuccess: (email) => ipcRenderer.invoke('login-success', email),
  logoutRequested: () => ipcRenderer.invoke('logout-requested'),
  
  // ==========================================
  // BIGCHAIN NODE CONTROL
  // ==========================================
  toggleNode: (state) => ipcRenderer.invoke('toggle-node', state),
  getNodeStatus: () => ipcRenderer.invoke('get-node-status'),
  
  // ==========================================
  // WALLET
  // ==========================================
  getWalletData: () => ipcRenderer.invoke('get-wallet-data'),
  refreshWalletBalance: () => ipcRenderer.invoke('refresh-wallet-balance'),
  exportPrivateKey: (confirmed) => ipcRenderer.invoke('export-private-key', confirmed),
  checkWalletExists: () => ipcRenderer.invoke('check-wallet-exists'),
  sendTransaction: (txData) => ipcRenderer.invoke('send-transaction', txData),
  convertBIG: (data) => ipcRenderer.invoke('convert-big', data), // ⭐ NOVO
  
  // ==========================================
  // LANGUAGE PREFERENCES
  // ==========================================
  saveLanguage: (lang) => ipcRenderer.invoke('save-language', lang),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  
  // ==========================================
  // USER & BACKEND
  // ==========================================
  registerUser: (email, password) => ipcRenderer.invoke('register-user', email, password), 
  storeEmail: (email) => ipcRenderer.invoke('store-email', email),
  storeFirebaseToken: (token) => ipcRenderer.invoke('store-firebase-token', token),
  
  // ==========================================
  // EXTERNAL LINKS
  // ==========================================
  openDashboard: () => ipcRenderer.invoke('open-dashboard'), 
  openExternal: (url) => {
    // Valida protocolo e domínio antes de repassar ao main
    try {
      const parsed = new URL(url);
      const ALLOWED_PROTOCOLS = ['https:'];
      const ALLOWED_DOMAINS = [
        'bigfootconnect.tech', 'api.bigfootconnect.tech',
        'discord.gg', 'x.com', 'twitter.com',
        'youtube.com', 'www.youtube.com',
        't.me', 'telegram.me'
      ];
      const domainOk = ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol) || !domainOk) return Promise.resolve({ success: false, message: 'URL não permitida' });
    } catch { return Promise.resolve({ success: false, message: 'URL inválida' }); }
    return ipcRenderer.invoke('open-external', url);
  },
  
  // ==========================================
  // CONNECTIVITY
  // ==========================================
  checkInternetConnection: () => ipcRenderer.invoke('check-internet-connection'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  
  // ==========================================
  // SYNC & STATUS
  // ==========================================
  forceSync: () => ipcRenderer.invoke('force-sync'),
  getCurrentStatus: () => ipcRenderer.invoke('get-current-status'),
  
  // ==========================================
  // UPDATES
  // ==========================================
  installUpdate: () => ipcRenderer.invoke('install-update'),
  postponeUpdate: () => ipcRenderer.invoke('postpone-update'),
  
  // ==========================================
  // IPC SEND (para eventos específicos)
  // ==========================================
  send: (channel, data) => {
    const validChannels = [
      'language-changed', 
      'firebase-token-response'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // ==========================================
  // LISTENERS - NODE STATUS
  // ==========================================
  
  onNodeStatus: (callback) => {
    ipcRenderer.removeAllListeners('node-status');
    ipcRenderer.on('node-status', (event, status) => { callback(status); });
  },

  onNodeStatsUpdate: (callback) => {
    ipcRenderer.removeAllListeners('node-stats-update');
    ipcRenderer.on('node-stats-update', (event, stats) => { callback(stats); });
  },

  onNodeLog: (callback) => {
    ipcRenderer.removeAllListeners('node-log');
    ipcRenderer.on('node-log', (event, log) => { callback(log); });
  },

  // ==========================================
  // LISTENERS - BIG POINTS & REWARDS
  // ==========================================

  onBigPointsData: (callback) => {
    ipcRenderer.removeAllListeners('bigpoints-data');
    ipcRenderer.on('bigpoints-data', (event, data) => { callback(data); });
  },

  onBlockReward: (callback) => {
    ipcRenderer.removeAllListeners('block-reward');
    ipcRenderer.on('block-reward', (event, data) => { callback(data); });
  },

  onDailyReset: (callback) => {
    ipcRenderer.removeAllListeners('daily-reset');
    ipcRenderer.on('daily-reset', (event, date) => { callback(date); });
  },

  // ==========================================
  // LISTENERS - WALLET
  // ==========================================

  onWalletCreated: (callback) => {
    ipcRenderer.removeAllListeners('wallet-created');
    ipcRenderer.on('wallet-created', (event, data) => { callback(data); });
  },

  onNewTransaction: (callback) => {
    ipcRenderer.removeAllListeners('new-transaction');
    ipcRenderer.on('new-transaction', (event, data) => { callback(data); });
  },

  // ==========================================
  // LISTENERS - SYNC
  // ==========================================

  onSyncSuccess: (callback) => {
    ipcRenderer.removeAllListeners('sync-success');
    ipcRenderer.on('sync-success', (event, data) => { callback(data); });
  },

  onSyncError: (callback) => {
    ipcRenderer.removeAllListeners('sync-error');
    ipcRenderer.on('sync-error', (event, data) => { callback(data); });
  },

  // ==========================================
  // LISTENERS - FIREBASE
  // ==========================================

  onRequestFirebaseToken: (callback) => {
    ipcRenderer.removeAllListeners('request-firebase-token');
    ipcRenderer.on('request-firebase-token', (event) => { callback(); });
  },

  // ==========================================
  // LISTENERS - CONNECTIVITY
  // ==========================================

  onConnectionRestored: (callback) => {
    ipcRenderer.removeAllListeners('connection-restored');
    ipcRenderer.on('connection-restored', (event) => { callback(); });
  },

  // ==========================================
  // LISTENERS - UPDATES
  // ==========================================

  onUpdateNotification: (callback) => {
    ipcRenderer.removeAllListeners('update-notification');
    ipcRenderer.on('update-notification', (event, data) => { callback(data); });
  },

  onUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('update-progress');
    ipcRenderer.on('update-progress', (event, progress) => { callback(progress); });
  },
  
  // ==========================================
  // CLEANUP DE LISTENERS
  // ==========================================
  
  removeAllListeners: (channel) => {
    const validChannels = [
      'node-status', 'node-stats-update', 'node-log',
      'bigpoints-data', 'block-reward', 'daily-reset',
      'wallet-created', 'new-transaction',
      'sync-success', 'sync-error',
      'request-firebase-token', 'connection-restored',
      'update-notification', 'update-progress'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Node listeners
  removeNodeStatusListener: (callback) => ipcRenderer.removeListener('node-status', callback),
  removeNodeStatsUpdateListener: (callback) => ipcRenderer.removeListener('node-stats-update', callback),
  removeNodeLogListener: (callback) => ipcRenderer.removeListener('node-log', callback),
  
  // BIG Points listeners
  removeBigPointsDataListener: (callback) => ipcRenderer.removeListener('bigpoints-data', callback),
  removeBlockRewardListener: (callback) => ipcRenderer.removeListener('block-reward', callback),
  removeDailyResetListener: (callback) => ipcRenderer.removeListener('daily-reset', callback),
  
  // Wallet listeners
  removeWalletCreatedListener: (callback) => ipcRenderer.removeListener('wallet-created', callback),
  removeNewTransactionListener: (callback) => ipcRenderer.removeListener('new-transaction', callback),
  
  // Sync listeners
  removeSyncSuccessListener: (callback) => ipcRenderer.removeListener('sync-success', callback),
  removeSyncErrorListener: (callback) => ipcRenderer.removeListener('sync-error', callback),
  
  // Firebase listeners
  removeRequestFirebaseTokenListener: (callback) => ipcRenderer.removeListener('request-firebase-token', callback),
  
  // Connectivity listeners
  removeConnectionRestoredListener: (callback) => ipcRenderer.removeListener('connection-restored', callback),
  
  // Update listeners
  removeUpdateNotificationListener: (callback) => ipcRenderer.removeListener('update-notification', callback),
  removeUpdateProgressListener: (callback) => ipcRenderer.removeListener('update-progress', callback)
});