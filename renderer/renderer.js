import { translations, currentLang, setLanguage, updateThreadOptionsLanguage } from './i18n.js';
import { initializeFirebase, setupAuth, handleLogin, handleLogout, handleRegister, handleGoogleLogin, setupAutomaticTokenRenewal } from './auth.js';
import { initializeChart, updateChartData, registrarBigPointsGanhos, updateToggleButtonText } from './chart.js';
import { initializeTheme, toggleTheme, observeFAQRendering } from './theme.js';
import { renderFAQ } from './faq.js';
import { initUpdateNotifications } from './updateNotifications.js';
import { initializeChat, cleanupChat } from './chat.js';
import { initializeWallet, cleanupWallet } from './wallet.js';
import { initializeSettings, cleanupSettings } from './settings.js';
import { initializeProfile, cleanupProfile } from './profile.js';
import { initializeSocialLinks, cleanupSocialLinks } from './socialLinks.js';
import { initializeContributionSlider, updateSliderLanguage, getCurrentThreads, cleanupSlider } from './contributionSlider.js';

if (window.env?.isProd) {
  ['log', 'debug', 'info', 'warn', 'error'].forEach(method => {
    console[method] = () => {};
  });
}

class AnimatedDots {
  constructor() {
    this.dotsInterval = null;
    this.currentDots = 0;
    this.isActive = false;
  }

  start(elementId, baseText = 'Sharing', speed = 500) {
    this.stop();
    const element = document.getElementById(elementId);
    if (!element) return;
    this.isActive = true;
    this.dotsInterval = setInterval(() => {
      if (!this.isActive) { return this.stop(); }
      this.currentDots = (this.currentDots + 1) % 4;
      element.textContent = `${baseText}${' '.repeat(this.currentDots)}`;
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

class ConnectivityManager {
  constructor() {
    this.isOnline = true;
    this.setupEventListeners();
    console.log('[CONNECTIVITY] Inicializado');
  }

  setupEventListeners() {
    if (window.electronAPI?.onConnectionRestored) {
      window.electronAPI.onConnectionRestored(() => {
        console.log('[CONNECTIVITY] Conexão restaurada');
        this.showConnectionRestoredMessage();
        this.refreshUserData();
      });
    }
  }

  showConnectionRestoredMessage() {
    const msg = document.createElement('div');
    msg.id = 'connection-restored-message';
    msg.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#44bb44;color:white;padding:8px 16px;border-radius:4px;z-index:9999;font-size:14px;`;
    msg.textContent = currentLang === 'pt' ? 'Conexão restaurada!' : 'Connection restored!';
    document.body.appendChild(msg);
    setTimeout(() => { msg.style.opacity = '0'; setTimeout(() => msg.remove(), 300); }, 3000);
  }

  async refreshUserData() {
    if (window.isLoggedIn && firebaseIdToken) await window.sendFirebaseTokenToMain?.();
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

let isCurrentlySharing = false;
let totalBigPointsToday = 0;
let isAppClosing = false;
let firebaseIdToken = null;

// FUNÇÃO SEGURA PARA ATUALIZAR GRÁFICO
function safeUpdateChart() {
  if (!window.isLoggedIn || !window.usageChart || !window.db || !window.auth?.currentUser) return;
  try {
    updateChartData(window.usageChart, window.db, currentLang, translations);
  } catch (err) {
    console.error('[CHART] Erro ao atualizar:', err);
  }
}

// ==========================================
// FUNÇÃO PARA ATUALIZAR ELEMENTOS I18N
// ==========================================
function updateI18nElements() {
  const t = translations[currentLang];
  
  // Atualiza todos os elementos com data-i18n
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (t[key]) {
      // Atualiza o conteúdo do texto
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // Para inputs, não muda o value, apenas placeholder se houver
        if (element.hasAttribute('data-i18n-placeholder')) {
          const placeholderKey = element.getAttribute('data-i18n-placeholder');
          if (t[placeholderKey]) {
            element.placeholder = t[placeholderKey];
          }
        }
      } else {
        element.textContent = t[key];
      }
      console.log(`[i18n] Traduzido: ${key} = ${t[key]}`);
    }
  });
  
  // Atualiza placeholders com data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      element.placeholder = t[key];
      console.log(`[i18n] Placeholder traduzido: ${key} = ${t[key]}`);
    }
  });
  
  console.log('[i18n] ✅ Elementos traduzidos para:', currentLang);
}

// ==========================================
// FUNÇÃO PÚBLICA PARA INICIALIZAR PÁGINAS
// Chamada pelo sistema de navegação de emergência
// ==========================================
window.initializePage = function(pageId) {
  console.log('[PAGE] 🎬 Inicializando página:', pageId);
  
  if (pageId === 'profile') {
    console.log('[PAGE] 👤 Inicializando Profile...');
    cleanupProfile();
    initializeProfile(window.auth, window.db);
    console.log('[PAGE] ✅ Profile inicializado');
  } else if (pageId === 'settings') {
    console.log('[PAGE] ⚙️ Inicializando Settings...');
    cleanupSettings();
    initializeSettings(window.auth, window.db);
    setupLogoutButton();
    console.log('[PAGE] ✅ Settings inicializado');
  } else if (pageId === 'wallet') {
    console.log('[PAGE] 💼 Inicializando Wallet...');
    cleanupWallet();
    initializeWallet();
    console.log('[PAGE] ✅ Wallet inicializado');
  } else if (pageId === 'chat') {
    console.log('[PAGE] 💬 Chat já está inicializado globalmente');
  } else if (pageId === 'home') {
    console.log('[PAGE] 🏠 Home - atualizando gráfico...');
    safeUpdateChart();
  }
  
  console.log('[PAGE] ✅ Inicialização concluída');
};

// Função pública para atualizar Wallet quando idioma muda
window.updateWalletLanguage = function() {
  const walletPage = document.getElementById('page-wallet');
  if (walletPage && walletPage.classList.contains('active')) {
    console.log('[WALLET] 🌐 Atualizando idioma...');
    initializeWallet();
  }
};

// Função pública para atualizar Profile quando idioma muda
window.updateProfileLanguage = function() {
  const profilePage = document.getElementById('page-profile');
  if (profilePage && profilePage.classList.contains('active')) {
    console.log('[PROFILE] 🌐 Atualizando idioma...');
    initializeProfile(window.auth, window.db);
  }
};

// Também expõe as funções de cleanup
window.cleanupWallet = cleanupWallet;
window.cleanupSettings = cleanupSettings;
window.cleanupChat = cleanupChat;
window.cleanupProfile = cleanupProfile;

// ==========================================
// FUNÇÃO: SETUP DO BOTÃO DE LOGOUT
// ==========================================
function setupLogoutButton() {
  setTimeout(() => {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!logoutBtn) {
      console.log('[LOGOUT] ℹ️ Botão de logout não encontrado (normal - está na sidebar)');
      return;
    }
    
    if (logoutBtn.hasAttribute('data-logout-configured')) {
      console.log('[LOGOUT] ℹ️ Botão já configurado');
      return;
    }
    
    logoutBtn.setAttribute('data-logout-configured', 'true');
    console.log('[LOGOUT] 🔧 Configurando botão de logout');
    
    logoutBtn.addEventListener('click', async () => {
      const t = translations[currentLang];
      const confirmMessage = currentLang === 'pt'
        ? 'Tem certeza que deseja sair?\n\nSeus dados de mineração serão salvos automaticamente.'
        : 'Are you sure you want to log out?\n\nYour mining data will be saved automatically.';
      
      const confirmLogout = confirm(confirmMessage);
      
      if (!confirmLogout) {
        return;
      }
      
      try {
        console.log('[LOGOUT] 🚪 Iniciando processo de logout...');
        
        logoutBtn.disabled = true;
        const originalText = logoutBtn.textContent;
        logoutBtn.textContent = currentLang === 'pt' ? '🔄 Saindo...' : '🔄 Logging out...';
        
        if (isCurrentlySharing) {
          console.log('[LOGOUT] ⛏️ Parando mineração...');
          try {
            await window.electronAPI?.toggleSharing(false);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error('[LOGOUT] ❌ Erro ao parar mineração:', err);
          }
        }
        
        if (firebase && firebase.auth()) {
          console.log('[LOGOUT] 🔥 Fazendo logout no Firebase...');
          try {
            await firebase.auth().signOut();
            console.log('[LOGOUT] ✅ Firebase logout concluído');
          } catch (err) {
            console.error('[LOGOUT] ❌ Erro no Firebase logout:', err);
          }
        }
        
        window.isLoggedIn = false;
        firebaseIdToken = null;
        
        console.log('[LOGOUT] 📡 Notificando Electron...');
        if (window.electronAPI?.logoutRequested) {
          await window.electronAPI.logoutRequested();
          console.log('[LOGOUT] ✅ Logout concluído');
        } else {
          console.error('[LOGOUT] ❌ electronAPI.logoutRequested não disponível!');
          throw new Error('Electron API não disponível');
        }
        
      } catch (error) {
        console.error('[LOGOUT] ❌ Erro:', error);
        
        logoutBtn.disabled = false;
        logoutBtn.textContent = originalText;
        
        const errorMessage = currentLang === 'pt'
          ? 'Erro ao fazer logout. Tente novamente.'
          : 'Error logging out. Please try again.';
        
        alert(errorMessage);
      }
    });
    
    console.log('[LOGOUT] ✅ Botão configurado');
    
  }, 200);
}

function initializeApp() {
  console.log('[APP] ========================================');
  console.log('[APP] 🚀 INICIALIZANDO APLICAÇÃO');
  console.log('[APP] ========================================');
  
  // NÃO configura navegação aqui - já está no script inline do HTML
  console.log('[APP] ℹ️ Navegação gerenciada pelo sistema de emergência');

  const { auth, db } = initializeFirebase();
  window.auth = auth;
  window.db = db;
  console.log('[APP] ✅ Firebase inicializado');

  const usageChart = initializeChart(currentLang, translations);
  window.usageChart = usageChart;
  console.log('[APP] ✅ Gráfico inicializado');

  initializeTheme();
  console.log('[APP] ✅ Tema inicializado');
  
  initUpdateNotifications();
  console.log('[APP] ✅ Notificações inicializadas');
  
  initializeChat();
  console.log('[APP] ✅ Chat inicializado');
  
  initializeSocialLinks();
  console.log('[APP] ✅ Links sociais inicializados');
  
  initializeContributionSlider((threads) => {
    console.log('[APP] 🎚️ Nível alterado para:', threads, 'threads');
    localStorage.setItem('contributionLevel', Math.ceil(threads / 1));
    
    if (isCurrentlySharing && window.electronAPI?.updateMiningThreads) {
      window.electronAPI.updateMiningThreads(threads);
    }
  });
  console.log('[APP] ✅ Contribution slider inicializado');

  setupAuth(auth, updateText, safeUpdateChart, toggleModal);
  console.log('[APP] ✅ Auth configurado');
  
  setupFirebaseTokenManagement();
  setupAutomaticTokenRenewal();
  console.log('[APP] ✅ Token management configurado');

  if (window.electronAPI) {
    window.electronAPI.onAppClosing?.(() => { 
      isAppClosing = true; 
      animatedDots.stop(); 
      connectivityManager.destroy(); 
      cleanupChat(); 
      cleanupWallet(); 
      cleanupSettings();
      cleanupProfile();
      cleanupSocialLinks();
    });
    
    window.electronAPI.onSharingStatus?.(status => { 
      isCurrentlySharing = status; 
      window.isMining = status; 
      updateSharingUI(status); 
    });
    
    window.electronAPI.onBigPointsData?.(data => { 
      totalBigPointsToday = data; 
      safeUpdateChart(); 
    });

    setTimeout(async () => {
      try {
        const status = await window.electronAPI.getSharing();
        if (status.isSharing) { 
          isCurrentlySharing = true; 
          window.isMining = true; 
          totalBigPointsToday = status.totalBigPoints || 0; 
          updateSharingUI(true); 
        }
      } catch (err) { 
        console.error('[INIT] Erro ao obter status:', err); 
      }
    }, 500);
  }

  function setupFirebaseTokenManagement() {
    window.electronAPI?.onRequestFirebaseToken?.(() => sendFirebaseTokenToMain());
  }

  async function sendFirebaseTokenToMain() {
    try {
      const user = auth.currentUser;
      if (!user) return window.electronAPI.send('firebase-token-response', 'NO_USER');
      const token = await user.getIdToken(true);
      firebaseIdToken = token;
      window.electronAPI.send('firebase-token-response', token);
      window.electronAPI.storeFirebaseToken?.(token);
    } catch (error) {
      console.error('[TOKEN] Erro ao enviar token:', error);
      window.electronAPI.send('firebase-token-response', 'ERROR');
    }
  }
  window.sendFirebaseTokenToMain = sendFirebaseTokenToMain;

  function updateSharingUI(isSharing) {
    if (isAppClosing) return;
    const t = translations[currentLang];
    const connectBtn = document.getElementById('connectBtn');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (isSharing) {
      connectBtn.textContent = t.stop;
      connectBtn.className = 'big-button disconnect';
      animatedDots.start('statusText', t.statusMining || 'Mining', 600);
      statusText.className = 'status sharing';
      statusDot.className = 'status-dot active';
    } else {
      connectBtn.textContent = t.connect;
      connectBtn.className = 'big-button';
      animatedDots.stop();
      statusText.textContent = t.statusDisconnected;
      statusText.className = 'status stopped';
      statusDot.className = 'status-dot';
    }
    connectBtn.disabled = !window.isLoggedIn;
  }

  function updateText() {
    if (isAppClosing) return;
    const t = translations[currentLang];
    const connectBtn = document.getElementById('connectBtn');
    const authButtons = document.getElementById('authButtons');
    const languageSelect = document.getElementById('languageSelect');
    const statusText = document.getElementById('statusText');

    if (connectBtn) {
      connectBtn.textContent = isCurrentlySharing ? t.stop : t.connect;
      connectBtn.className = isCurrentlySharing ? 'big-button disconnect' : 'big-button';
      connectBtn.disabled = !window.isLoggedIn;
    }
    
    // Atualiza o status text
    if (statusText && !isCurrentlySharing) {
      statusText.textContent = t.statusDisconnected;
    }

    if (authButtons) {
      authButtons.innerHTML = window.isLoggedIn
        ? `<button class="icon-button" id="logoutBtn">${t.logout}</button>`
        : `<button class="icon-button" id="loginModalBtn">${t.login}</button>`;
    }

    if (languageSelect) languageSelect.value = currentLang;
    
    // Atualiza elementos com data-i18n
    updateI18nElements();
  }

  function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  }

  document.getElementById('themeToggle')?.addEventListener('change', () => toggleTheme(usageChart));
  
  document.getElementById('connectBtn')?.addEventListener('click', async () => {
    if (!window.isLoggedIn) {
      const msg = currentLang === 'pt' ? 'Faça login primeiro.' : 'Log in first.';
      return alert(msg);
    }
    
    const newState = !isCurrentlySharing;
    const threads = getCurrentThreads();
    
    console.log(`[CONNECT] ${newState ? 'Iniciando' : 'Parando'} mineração com ${threads} threads`);
    
    if (window.electronAPI?.startMiningWithThreads) {
      try {
        if (newState) {
          await window.electronAPI.startMiningWithThreads(threads);
        } else {
          await window.electronAPI.toggleSharing(false);
        }
      } catch (err) {
        console.error('[CONNECT] Erro:', err);
      }
    } else {
      isCurrentlySharing = newState;
      window.isMining = newState;
      updateSharingUI(newState);
    }
  });

  document.getElementById('closeLoginModal')?.addEventListener('click', () => toggleModal('loginModal'));
  
  document.getElementById('languageSelect')?.addEventListener('change', () => {
    setLanguage(document.getElementById('languageSelect').value);
    window.electronAPI?.send('language-changed');
    setTimeout(() => {
      updateText();
      if (window.usageChart && window.db) {
        safeUpdateChart();
      }
      if (window.updateWalletLanguage) {
        window.updateWalletLanguage();
      }
      if (window.updateChatLanguage) {
        window.updateChatLanguage();
      }
      if (window.updateSettingsLanguage) {
        window.updateSettingsLanguage();
      }
      if (window.updateProfileLanguage) {
        window.updateProfileLanguage();
      }
      if (window.updateSliderLanguage) {
        updateSliderLanguage();
      }
    }, 50);
  });

  document.getElementById('registerBtn')?.addEventListener('click', () => handleRegister(currentLang, toggleModal, updateText));
  document.getElementById('googleLoginBtn')?.addEventListener('click', e => { 
    e.preventDefault(); 
    handleGoogleLogin(currentLang, toggleModal, updateText); 
  });
  document.getElementById('loginForm')?.addEventListener('submit', e => handleLogin(e, currentLang, toggleModal, updateText));

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
    cleanupSocialLinks();
    cleanupSlider();
  });

  setTimeout(() => {
    console.log('[APP] 🎬 Inicializando página Home...');
    window.initializePage('home');
    safeUpdateChart();
    const statusText = document.getElementById('statusText');
    if (statusText && !isCurrentlySharing) {
      statusText.textContent = translations[currentLang].statusDisconnected;
    }
  }, 100);

  updateText();
  
  console.log('[APP] ========================================');
  console.log('[APP] ✅ APLICAÇÃO INICIALIZADA COM SUCESSO');
  console.log('[APP] ========================================');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

export function getConnectionStatus() {
  return { 
    isSharing: isCurrentlySharing, 
    hasAnimation: animatedDots.isActive(), 
    language: currentLang, 
    totalBigPoints: totalBigPointsToday, 
    isOnline: true 
  };
}

export function forceStopConnection() {
  if (isCurrentlySharing) {
    isCurrentlySharing = false;
    window.isMining = false;
    updateSharingUI(false);
  }
}

window.electronAPI?.debugEmail?.().then(console.log);