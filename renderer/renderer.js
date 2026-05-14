import { translations, getCurrentLang, setLanguage, initializeLanguage, t } from './i18n.js';
import { initializeFirebase, setupAuth, handleLogin, handleLogout, handleRegister, handleGoogleLogin, setupAutomaticTokenRenewal } from './auth.js';
import { initializeChart, updateChartData, registrarBigPointsGanhos, forceChartUpdate } from './chart.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { initializeFAQ } from './faq.js';
import { initializeLogs, cleanupLogs, addBlockchainLog } from './logs.js';
import { initUpdateNotifications } from './updateNotifications.js';
import { initializeChat, cleanupChat, updateChatLanguage } from './chat.js';
import { initializeWallet, cleanupWallet } from './wallet.js';
import { initializeSettings, cleanupSettings, updateSettingsLanguage } from './settings.js';
import { initializeProfile, cleanupProfile, updateProfileLanguage } from './profile.js';
import { initializeSocialLinks, cleanupSocialLinks } from './socialLinks.js';

// Inicializa Firebase (async)
initializeFirebase();
const { auth, db } = await setupAuth();

if (window.env?.isProd) {
  ['log', 'debug', 'info', 'warn', 'error'].forEach(method => {
    console[method] = () => {};
  });
}

// ==========================================
// EXPOR FUNÇÕES GLOBALMENTE PARA NAVEGAÇÃO
// ==========================================
window.initializeFAQ = initializeFAQ;
window.initializeWallet = initializeWallet;
window.initializeChat = initializeChat;
window.initializeProfile = initializeProfile;
window.initializeLogs = initializeLogs;
window.initializeSettings = initializeSettings;
window.getCurrentLang = getCurrentLang;
window.cleanupWallet = cleanupWallet;
window.cleanupChat = cleanupChat;
window.cleanupProfile = cleanupProfile;
window.cleanupLogs = cleanupLogs;
window.cleanupSettings = cleanupSettings;

// ==========================================
// ANIMATED DOTS (para status do node)
// ==========================================
class AnimatedDots {
  constructor() {
    this.dotsInterval = null;
    this.currentDots = 0;
    this.isActive = false;
  }

  start(elementId, baseText = 'Syncing', speed = 500) {
    this.stop();
    const element = document.getElementById(elementId);
    if (!element) return;
    this.isActive = true;
    this.dotsInterval = setInterval(() => {
      if (!this.isActive) { return this.stop(); }
      this.currentDots = (this.currentDots + 1) % 4;
      element.textContent = `${baseText}${'.'.repeat(this.currentDots)}`;
      element.classList.add('animated-status');
    }, speed);
  }

  stop() {
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
      this.currentDots = 0;
      this.isActive = false;
      const element = document.getElementById('statusText');
      if (element) element.classList.remove('animated-status');
    }
  }

  isActive() { return this.isActive; }
}

// ==========================================
// CONNECTIVITY MANAGER
// ==========================================
class ConnectivityManager {
  constructor() {
    this.isOnline = true;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (window.electronAPI?.onConnectionRestored) {
      window.electronAPI.onConnectionRestored(() => {
        this.showConnectionRestoredMessage();
        this.refreshUserData();
      });
    }
  }

  showConnectionRestoredMessage() {
    const msg = document.createElement('div');
    msg.id = 'connection-restored-message';
    msg.className = 'toast-notification toast-success';
    msg.textContent = t('connectionRestored') || (getCurrentLang() === 'pt' ? 'Conexão restaurada!' : 'Connection restored!');
    document.body.appendChild(msg);
    setTimeout(() => { msg.classList.add('toast-fade-out'); setTimeout(() => msg.remove(), 300); }, 3000);
  }

  async refreshUserData() {
    if (window.isLoggedIn && window.auth?.currentUser) await window.sendFirebaseTokenToMain?.();
    safeUpdateChart();
  }

  destroy() {
    document.querySelectorAll('#connection-restored-message').forEach(m => m.remove());
  }
}

const animatedDots = new AnimatedDots();
const connectivityManager = new ConnectivityManager();
window.animatedDots = animatedDots;
window.connectivityManager = connectivityManager;

// ==========================================
// VARIÁVEIS GLOBAIS DO NODE
// ==========================================
let isNodeRunning = false;
let totalBigPointsToday = 0;
let isAppClosing = false;
let currentNodeStats = {
  connected: false,
  peers: 0,
  blockHeight: 0,
  balance: 0,
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

// ==========================================
// OTIMIZAÇÕES DE PERFORMANCE
// ==========================================
let chartInitialized = false;
let chartLoadTimeout = null;
let lastChartUpdate = 0;
const CHART_UPDATE_DEBOUNCE = 2000;

// ==========================================
// FUNÇÃO SEGURA PARA ATUALIZAR GRÁFICO (OTIMIZADA)
// ==========================================
function safeUpdateChart() {
  if (!window.isLoggedIn) return;
  if (!window.usageChart) return;
  if (!window.db) return;
  if (!window.auth?.currentUser) return;
  
  const now = Date.now();
  if (now - lastChartUpdate < CHART_UPDATE_DEBOUNCE) {
    if (chartLoadTimeout) clearTimeout(chartLoadTimeout);
    chartLoadTimeout = requestAnimationFrame(() => {
      safeUpdateChart();
    });
    return;
  }
  lastChartUpdate = now;
  
  try {
    updateChartData(window.usageChart, window.db, window.auth, getCurrentLang(), translations);
  } catch (err) {
    if (!window.env?.isProd) console.error('[CHART] ❌ Erro ao atualizar:', err);
  }
}

// ==========================================
// FUNÇÃO PARA ATUALIZAR ELEMENTOS I18N
// ==========================================
function updateI18nElements() {
  const langTranslations = translations[getCurrentLang()];
  
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (langTranslations[key]) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.hasAttribute('data-i18n-placeholder')) {
          const placeholderKey = element.getAttribute('data-i18n-placeholder');
          if (langTranslations[placeholderKey]) {
            element.placeholder = langTranslations[placeholderKey];
          }
        }
      } else {
        element.textContent = langTranslations[key];
      }
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (langTranslations[key]) {
      element.placeholder = langTranslations[key];
    }
  });
}

// ==========================================
// FUNÇÃO PÚBLICA PARA INICIALIZAR PÁGINAS
// ==========================================
window.initializePage = function(pageId) {
  if (!window.auth || !window.db) {
    const retry = setInterval(() => {
      if (window.auth && window.db) {
        clearInterval(retry);
        window.initializePage(pageId);
      }
    }, 100);
    return;
  }

  if (pageId === 'profile') {
    cleanupProfile();
    initializeProfile(window.auth, window.db);
  } else if (pageId === 'logs') {
    cleanupLogs();
    initializeLogs(getCurrentLang());
  } else if (pageId === 'settings') {
    cleanupSettings();
    initializeSettings(window.auth, window.db);
    setupLogoutButton();
  } else if (pageId === 'faq') {
    initializeFAQ(getCurrentLang());
  } else if (pageId === 'wallet') {
    cleanupWallet();
    initializeWallet();
  } else if (pageId === 'chat') {
    // chat já está inicializado globalmente
  } else if (pageId === 'home') {
    safeUpdateChart();
  }
};

// ==========================================
// MODAL DE CONFIRMAÇÃO
// ==========================================
function showConfirmModal(message, onConfirm) {
  const existing = document.getElementById('confirm-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'confirm-modal-overlay';
  overlay.className = 'confirm-modal-overlay';

  const box = document.createElement('div');
  box.className = 'confirm-modal-box';

  const text = document.createElement('p');
  text.className = 'confirm-modal-text';
  text.textContent = message;

  const btnRow = document.createElement('div');
  btnRow.className = 'confirm-modal-buttons';

  const btnConfirm = document.createElement('button');
  btnConfirm.className = 'confirm-modal-btn confirm-modal-btn--confirm';
  btnConfirm.textContent = t('confirm');

  const btnCancel = document.createElement('button');
  btnCancel.className = 'confirm-modal-btn confirm-modal-btn--cancel';
  btnCancel.textContent = t('cancel');

  btnConfirm.addEventListener('click', () => { overlay.remove(); onConfirm(); });
  btnCancel.addEventListener('click', () => overlay.remove());

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnConfirm);
  box.appendChild(text);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ==========================================
// SETUP DO BOTÃO DE LOGOUT
// ==========================================
function setupLogoutButton() {
  requestAnimationFrame(() => {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!logoutBtn) return;
    if (logoutBtn.hasAttribute('data-logout-configured')) return;
    
    logoutBtn.setAttribute('data-logout-configured', 'true');
    
    logoutBtn.addEventListener('click', async () => {
      const confirmMessage = t('confirmLogoutMessage') || (getCurrentLang() === 'pt'
        ? 'Tem certeza que deseja sair?\n\nSeus dados serão salvos automaticamente.'
        : 'Are you sure you want to log out?\n\nYour data will be saved automatically.');

      showConfirmModal(confirmMessage, async () => {
        if (isNodeRunning && window.electronAPI?.toggleNode) {
          await window.electronAPI.toggleNode(false);
        }
        handleLogout(updateText);
      });
    });
  });
}

// ==========================================
// ATUALIZAR STATS DO NODE NA UI
// ==========================================
function updateNodeStatsUI(stats) {
  if (isAppClosing) return;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  const setColorClass = (id, condition) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('text-success', 'text-muted', 'text-gold', 'text-warning');
    if (condition === 'success') el.classList.add('text-success');
    else if (condition === 'muted') el.classList.add('text-muted');
    else if (condition === 'gold') el.classList.add('text-gold');
    else if (condition === 'warning') el.classList.add('text-warning');
  };

  setEl('statPeers', stats.peers || 0);
  setEl('statBlocks', stats.blockHeight || 0);
  setEl('statBalance', `${(stats.balance || 0).toFixed(4)} BIG`);
  setEl('statRelays', stats.relayCount || 0);

  if (stats.miningReward > 0) {
    setEl('statReward', `${stats.miningReward.toFixed(4)} BIG`);
  }

  if (stats.totalSupply !== undefined) {
    setEl('statSupply', `${(stats.totalSupply || 0).toFixed(1)} / 21M`);
  }

  const credits = stats.relayCredits || 0;
  setEl('porCredits', `${credits} / 50`);
  setColorClass('porCredits', credits >= 50 ? 'success' : 'warning');

  const score = stats.relayScore || 0;
  setEl('porScore', score.toFixed(1));
  setColorClass('porScore', score > 0 ? 'success' : 'muted');

  const bonus = stats.scoreBonus || 1.0;
  const bonusPct = Math.round((bonus - 1) * 100);
  setEl('porBonus', bonusPct > 0 ? `+${bonusPct}%` : '0%');
  setColorClass('porBonus', bonusPct > 0 ? 'success' : 'muted');

  setEl('porEmission', `${(stats.dailyEmission || 1440).toFixed(0)} ${t('bigPerDay')}`);

  const leaderEl = document.getElementById('porLeader');
  if (leaderEl) {
    leaderEl.textContent = stats.isLeader ? '👑 Leader' : t('waiting');
    leaderEl.classList.remove('text-gold', 'text-muted');
    leaderEl.classList.add(stats.isLeader ? 'text-gold' : 'text-muted');
  }

  const canMineIndicator = document.getElementById('canMineIndicator');
  const canMineText = document.getElementById('canMineText');
  if (canMineIndicator && canMineText) {
    if (stats.canMine) {
      canMineIndicator.classList.add('ready');
      canMineIndicator.classList.remove('not-ready');
      canMineText.textContent = stats.isLeader ? t('mining') : t('readyWaitingTurn');
      canMineText.classList.remove('text-muted');
      canMineText.classList.add('text-success');
    } else {
      canMineIndicator.classList.remove('ready');
      canMineIndicator.classList.add('not-ready');
      canMineText.textContent = t('accumulatingProofs');
      canMineText.classList.remove('text-success');
      canMineText.classList.add('text-muted');
    }
  }

  currentNodeStats = { ...stats };
}

// ==========================================
// ATUALIZAR UI DO NODE (ON/OFF)
// ==========================================
function updateNodeUI(isRunning) {
  if (isAppClosing) return;
  const connectBtn = document.getElementById('connectBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');

  if (isRunning) {
    connectBtn.textContent = t('disconnect');
    connectBtn.className = 'big-button disconnect';
    animatedDots.start('statusText', t('syncing'), 600);
    statusText.className = 'status sharing';
    statusDot.className = 'status-dot active';
  } else {
    connectBtn.textContent = t('connect');
    connectBtn.className = 'big-button';
    animatedDots.stop();
    statusText.textContent = t('statusDisconnected');
    statusText.className = 'status stopped';
    statusDot.className = 'status-dot';
  }
  connectBtn.disabled = !window.isLoggedIn;
}

// ==========================================
// INICIALIZAR APP (OTIMIZADO)
// ==========================================
async function initializeApp() {
  if (typeof initializeLanguage === 'function') {
    try {
      const lang = await initializeLanguage();
    } catch (error) {
      if (!window.env?.isProd) console.error('[APP] ❌ Erro ao carregar idioma:', error);
    }
  }

  initializeFirebase();
  const { auth, db } = await setupAuth();
  
  if (!auth || !db) {
    if (!window.env?.isProd) console.error('[APP] ❌ Erro crítico: Firebase não inicializado!');
    return;
  }
  
  let _auth = auth;
  let _db = db;
  Object.defineProperty(window, 'auth', { get: () => _auth, configurable: false });
  Object.defineProperty(window, 'db',   { get: () => _db,   configurable: false });

  initializeTheme();
  window.usageChart = null;

  initUpdateNotifications();
  initializeSocialLinks();
  initializeChat();

  setupNodeListeners();
  setupFirebaseTokenManagement();
  setupAutomaticTokenRenewal();
  setupEventListeners();

  requestAnimationFrame(() => {
    window.initializePage('home');

    if (!chartInitialized && !window.usageChart) {
      chartInitialized = true;
      window.usageChart = initializeChart(getCurrentLang(), translations, window.auth);
    }
    
    if (chartLoadTimeout) clearTimeout(chartLoadTimeout);
    chartLoadTimeout = requestAnimationFrame(() => {
      safeUpdateChart();
    });
    
    const statusText = document.getElementById('statusText');
    if (statusText && !isNodeRunning) {
      statusText.textContent = t('statusDisconnected');
    }
  });

  updateText();
  updateNodeStatsUI(currentNodeStats); // ⭐ força os textos no idioma inicial
}

// ==========================================
// SETUP LISTENERS DO NODE
// ==========================================
function setupNodeListeners() {
  if (!window.electronAPI) return;

  window.electronAPI.onNodeStatus?.(status => {
    isNodeRunning = status;
    window.isNodeRunning = status;
    updateNodeUI(status);
  });

  window.electronAPI.onNodeStatsUpdate?.(stats => {
    updateNodeStatsUI(stats);
  });

  window.electronAPI.onBlockReward?.(data => {
    totalBigPointsToday += data.earned;
    
    if (window.isLoggedIn && data.earned > 0) {
      registrarBigPointsGanhos(data.earned, window.db);
    }
    
    safeUpdateChart();
    showRewardNotification(data.earned);
  });

  window.electronAPI.onNodeLog?.(log => {});

  requestAnimationFrame(async () => {
    try {
      const status = await window.electronAPI.getNodeStatus();
      if (status.nodeRunning) {
        isNodeRunning = true;
        window.isNodeRunning = true;
        totalBigPointsToday = status.totalBigPoints || 0;
        updateNodeUI(true);
        if (status.nodeStats) {
          updateNodeStatsUI(status.nodeStats);
        }
      }
    } catch (err) {
      if (!window.env?.isProd) console.error('[INIT] Erro ao obter status:', err);
    }
  });
}

// ==========================================
// NOTIFICAÇÃO DE RECOMPENSA
// ==========================================
function showRewardNotification(amount) {
  const msg = document.createElement('div');
  msg.className = 'toast-notification toast-reward';
  msg.textContent = getCurrentLang() === 'pt' 
    ? `🎉 +${amount.toFixed(2)} BIG ganhos!` 
    : `🎉 +${amount.toFixed(2)} BIG earned!`;
  document.body.appendChild(msg);
  setTimeout(() => {
    msg.classList.add('toast-fade-out');
    setTimeout(() => msg.remove(), 300);
  }, 3000);
}

// ==========================================
// FIREBASE TOKEN MANAGEMENT
// ==========================================
function setupFirebaseTokenManagement() {
  window.electronAPI?.onRequestFirebaseToken?.(() => sendFirebaseTokenToMain());
}

async function sendFirebaseTokenToMain() {
  try {
    const user = window.auth?.currentUser;
    if (!user) return window.electronAPI.send('firebase-token-response', 'NO_USER');
    const token = await user.getIdToken(true);
    window.electronAPI.send('firebase-token-response', token);
    window.electronAPI.storeFirebaseToken?.(token);
  } catch (error) {
    if (!window.env?.isProd) console.error('[TOKEN] Erro ao enviar token:', error);
    window.electronAPI.send('firebase-token-response', 'ERROR');
  }
}
window.sendFirebaseTokenToMain = sendFirebaseTokenToMain;

// ==========================================
// ATUALIZAR TEXTOS
// ==========================================
function updateText() {
  if (isAppClosing) return;
  const currentLanguage = getCurrentLang();
  const connectBtn = document.getElementById('connectBtn');
  const authButtons = document.getElementById('authButtons');
  const languageSelect = document.getElementById('languageSelect');
  const statusText = document.getElementById('statusText');

  if (connectBtn) {
    connectBtn.textContent = isNodeRunning ? t('disconnect') : t('connect');
    connectBtn.className = isNodeRunning ? 'big-button disconnect' : 'big-button';
    connectBtn.disabled = !window.isLoggedIn;
  }
  
  if (statusText && !isNodeRunning) {
    statusText.textContent = t('statusDisconnected');
  }

  if (authButtons) {
    authButtons.replaceChildren();
    const btn = document.createElement('button');
    btn.className = 'icon-button';
    if (window.isLoggedIn) {
      btn.id = 'logoutBtn';
      btn.textContent = t('logout');
    } else {
      btn.id = 'loginModalBtn';
      btn.textContent = t('login');
    }
    authButtons.appendChild(btn);
  }

  if (languageSelect) languageSelect.value = currentLanguage;
  
  updateI18nElements();
}

// ==========================================
// MODAL
// ==========================================
function toggleModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

// ==========================================
// SETUP EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  const themeToggle = document.getElementById('themeToggle');
  const VALID_THEMES = ['dark', 'light'];
  const rawTheme = localStorage.getItem('bigfootTheme');
  const savedTheme = VALID_THEMES.includes(rawTheme) ? rawTheme : 'dark';
  if (themeToggle) {
    themeToggle.checked = (savedTheme === 'dark');
  }
  
  document.getElementById('themeToggle')?.addEventListener('change', () => {
    if (window.usageChart) {
      toggleTheme(window.usageChart);
    } else {
      toggleTheme();
    }
  });
  
  document.getElementById('connectBtn')?.addEventListener('click', async () => {
    if (!window.isLoggedIn) {
      const msg = t('loginFirstToConnect') || (getCurrentLang() === 'pt' ? 'Faça login primeiro.' : 'Log in first.');
      return alert(msg);
    }
    
    const newState = !isNodeRunning;
    if (!window.env?.isProd) console.log(`[CONNECT] ${newState ? 'Ligando' : 'Desligando'} node`);
    
    if (window.electronAPI?.toggleNode) {
      try {
        await window.electronAPI.toggleNode(newState);
      } catch (err) {
        if (!window.env?.isProd) console.error('[CONNECT] Erro:', err);
      }
    } else {
      isNodeRunning = newState;
      window.isNodeRunning = newState;
      updateNodeUI(newState);
    }
  });

  document.getElementById('closeLoginModal')?.addEventListener('click', () => toggleModal('loginModal'));
  
  document.getElementById('languageSelect')?.addEventListener('change', () => {
    const newLang = document.getElementById('languageSelect').value;
    if (['pt', 'en'].includes(newLang)) {
      setLanguage(newLang);
      localStorage.setItem('bigfootLang', newLang);
      window.electronAPI?.send('language-changed', newLang);
      
      requestAnimationFrame(() => {
        updateI18nElements();
        updateText();
        
        // ⭐ Atualiza os textos dos Logs se a página estiver ativa
        if (document.getElementById('page-logs')?.classList.contains('active')) {
          window.updateLogsLanguage?.(newLang);
        }
        
        // ⭐ Atualiza os textos dinâmicos do Node Stats imediatamente
        updateNodeStatsUI(currentNodeStats);
      });
    }
  });

  document.getElementById('registerBtn')?.addEventListener('click', () => handleRegister(getCurrentLang(), toggleModal, updateText));
  
  document.getElementById('googleLoginBtn')?.addEventListener('click', e => { 
    e.preventDefault(); 
    handleGoogleLogin(getCurrentLang(), toggleModal, updateText); 
  });
  
  document.getElementById('loginForm')?.addEventListener('submit', e => handleLogin(e, getCurrentLang(), toggleModal, updateText));

  document.getElementById('authButtons')?.addEventListener('click', e => {
    if (e.target.id === 'logoutBtn') handleLogout(updateText);
    if (e.target.id === 'loginModalBtn') toggleModal('loginModal');
  });

  window.addEventListener('beforeunload', () => { 
    isAppClosing = true; 
    animatedDots.stop(); 
    connectivityManager.destroy(); 
    cleanupChat(); 
    cleanupWallet(); 
    cleanupSettings();
    cleanupProfile();
    cleanupLogs();
    cleanupSocialLinks();
  });
}

// ==========================================
// EXPORTS
// ==========================================
export function getConnectionStatus() {
  return { 
    isNodeRunning: isNodeRunning,
    nodeStats: currentNodeStats,
    hasAnimation: animatedDots.isActive(), 
    language: getCurrentLang(), 
    totalBigPoints: totalBigPointsToday, 
    isOnline: true 
  };
}

export function forceStopConnection() {
  if (isNodeRunning) {
    isNodeRunning = false;
    window.isNodeRunning = false;
    updateNodeUI(false);
  }
}

// ==========================================
// INICIAR APP
// ==========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}