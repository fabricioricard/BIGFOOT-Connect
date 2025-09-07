import { translations, currentLang, setLanguage, updateThreadOptionsLanguage } from './i18n.js';
import { initializeFirebase, setupAuth, handleLogin, handleLogout, handleRegister, setupAutomaticTokenRenewal } from './auth.js';
import { initializeChart, updateChartData, registrarBigPointsGanhos } from './chart.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { renderFAQ } from './faq.js';

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
      if (!this.isActive) {
        this.stop();
        return;
      }
      
      this.currentDots = (this.currentDots + 1) % 4;
      const dots = '.'.repeat(this.currentDots);
      element.textContent = `${baseText}${dots}`;
      
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
      if (element) {
        element.classList.remove('animated-status');
      }
    }
  }

  isActive() {
    return this.isActive;
  }
}

const animatedDots = new AnimatedDots();
window.animatedDots = animatedDots;

// Estado global persistente
let isCurrentlySharing = false;
let totalBigPointsToday = 0;
let isAppClosing = false;
let firebaseIdToken = null; // Token Firebase para API backend

document.addEventListener('DOMContentLoaded', () => {
  const authButtons = document.getElementById('authButtons');
  const connectBtn = document.getElementById('connectBtn');
  const statusText = document.getElementById('statusText');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const faqSection = document.getElementById('faqSection');
  const languageSelect = document.getElementById('languageSelect');
  const threadSelector = document.getElementById('threadSelector');
  const themeBtn = document.getElementById('themeBtn');
  const settingsModal = document.getElementById('settingsModal');
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const closeSettingsModal = document.getElementById('closeSettingsModal');
  const closeLoginModal = document.getElementById('closeLoginModal');
  const registerBtn = document.getElementById('registerBtn');
  const userGreeting = document.getElementById('userGreeting');
  const usageGraphTitle = document.getElementById('usageGraphTitle');
  const faqBtn = document.getElementById('faqBtn');

  window.isLoggedIn = false;
  window.isMining = false;
  window.pktMined = 0;

  const { auth, db } = initializeFirebase();
  const usageChart = initializeChart(currentLang, translations);
  initializeTheme();

  setupAuth(auth, updateText, () => updateChartData(usageChart, db, currentLang, translations), toggleModal);

  // Setup para gerenciar token Firebase
  setupFirebaseTokenManagement();
  
  // Setup para renovar token periodicamente
  setupAutomaticTokenRenewal();

  if (window.electronAPI) {
    window.electronAPI.onAppClosing?.(() => {
      console.log('[RENDERER] App sendo fechado, definindo flag...');
      isAppClosing = true;
      
      try {
        if (animatedDots) {
          animatedDots.stop();
        }
      } catch (error) {
        // Silencia erros durante fechamento
      }
    });

    window.electronAPI.onSharingStatus?.((status) => {
      if (isAppClosing) return;
      
      console.log('[RENDERER] Status de compartilhamento alterado:', status);
      isCurrentlySharing = status;
      window.isMining = status;
      updateSharingUI(status);
    });

    window.electronAPI.onMinerLog?.((log) => {
      if (isAppClosing) return;
      console.log('[RENDERER] Log do minerador:', log);
    });

    window.electronAPI.onMinerError?.((error) => {
      if (isAppClosing) return;
      console.error('[RENDERER] Erro do minerador:', error);
      alert(currentLang === 'pt' ? `Erro: ${error}` : `Error: ${error}`);
    });

    // Listener para dados reais de BIG Points
    window.electronAPI.onBigPointsData?.((data) => {
      if (isAppClosing) return;
      console.log('[RENDERER] BIG Points atualizados (dados reais):', data);
      totalBigPointsToday = data;
      
      // Atualiza gráfico quando há dados novos
      if (data > 0 && window.isLoggedIn) {
        // Não registra mais diretamente - apenas atualiza gráfico
        updateChartData(usageChart, db, currentLang, translations);
      }
    });

    // Verifica estado inicial do compartilhamento
    setTimeout(async () => {
      try {
        if (isAppClosing) return;
        const status = await window.electronAPI.getSharing();
        if (status.isSharing) {
          isCurrentlySharing = true;
          window.isMining = true;
          totalBigPointsToday = status.totalBigPoints || 0;
          updateSharingUI(true);
        }
      } catch (err) {
        console.error('[RENDERER] Erro ao verificar status inicial:', err);
      }
    }, 500);
  }

  // Configurar gerenciamento de token Firebase
  function setupFirebaseTokenManagement() {
    if (window.electronAPI) {
      // Escuta solicitações de token do main process
      window.electronAPI.onRequestFirebaseToken?.(() => {
        console.log('[RENDERER] Main process solicitou token Firebase');
        sendFirebaseTokenToMain();
      });
    }
  }

  // Obter e enviar token para main process
  async function sendFirebaseTokenToMain() {
    try {
      const user = auth.currentUser;
      
      if (!user) {
        console.log('[RENDERER] Usuário não logado, enviando NO_USER');
        window.electronAPI.send('firebase-token-response', 'NO_USER');
        return;
      }

      // Obtém token ID atualizado
      const token = await user.getIdToken(true); // force refresh = true
      firebaseIdToken = token;
      
      console.log('[RENDERER] Token Firebase obtido e enviado');
      
      // Envia token para main process
      window.electronAPI.send('firebase-token-response', token);
      
      // Também armazena no main process para uso futuro
      window.electronAPI.storeFirebaseToken?.(token);
      
    } catch (error) {
      console.error('[RENDERER] Erro ao obter token Firebase:', error);
      window.electronAPI.send('firebase-token-response', 'ERROR');
    }
  }

  function updateSharingUI(isSharing) {
    if (isAppClosing) return;
    
    const t = translations[currentLang];
    const statusDot = document.getElementById('statusDot');
    
    if (isSharing) {
      connectBtn.textContent = t.stop;
      connectBtn.className = 'big-button disconnect';
      
      statusText.className = 'status sharing';
      
      if (statusDot) {
        statusDot.className = 'status-dot active';
      }
      
      const sharingText = t.statusMining || 'Mining';
      animatedDots.start('statusText', sharingText, 600);
      
    } else {
      connectBtn.textContent = t.connect;
      connectBtn.className = 'big-button';
      
      animatedDots.stop();
      statusText.textContent = t.statusDisconnected;
      statusText.className = 'status stopped';
      
      if (statusDot) {
        statusDot.className = 'status-dot';
      }
    }
    
    connectBtn.disabled = !window.isLoggedIn;
  }

  function updateText() {
    if (isAppClosing) return;
    
    const t = translations[currentLang];

    const wasSharing = isCurrentlySharing;

    if (wasSharing) {
      connectBtn.textContent = t.stop;
      connectBtn.className = 'big-button disconnect';
      
      if (animatedDots.isActive) {
        animatedDots.start('statusText', t.statusMining || 'Mining', 600);
      } else {
        statusText.textContent = t.statusMining;
      }
      statusText.className = 'status sharing';
      
      const statusDot = document.getElementById('statusDot');
      if (statusDot) {
        statusDot.className = 'status-dot active';
      }
    } else {
      connectBtn.textContent = t.connect;
      connectBtn.className = 'big-button';
      statusText.textContent = t.statusDisconnected;
      statusText.className = 'status stopped';
    }

    connectBtn.disabled = !window.isLoggedIn;
    
    document.getElementById('threadsLabel').textContent = t.selectThreadsLabel;
    dashboardBtn.textContent = t.dashboard;
    themeBtn.textContent = t.theme;
    document.getElementById('settingsTitle').textContent = t.settingsTitle;
    document.querySelector('label[for="languageSelect"]').textContent = t.selectLanguage;
    document.getElementById('loginTitle').textContent = t.loginTitle;
    document.getElementById('userEmail').placeholder = t.emailPlaceholder;
    document.getElementById('userPassword').placeholder = t.passwordPlaceholder;
    document.getElementById('loginBtn').textContent = t.loginBtn;
    registerBtn.textContent = t.registerBtn;
    document.getElementById('orText').textContent = t.orText;

    if (usageGraphTitle) usageGraphTitle.textContent = t.bigPointsGraphTitle || t.usageGraphTitle;

    if (window.isLoggedIn && userGreeting) {
      const user = auth.currentUser;
      if (user?.email) {
        userGreeting.textContent = `${t.greeting}${user.email}`;
        userGreeting.classList.add('show');
      } else {
        userGreeting.textContent = '';
        userGreeting.classList.remove('show');
      }
    } else if (userGreeting) {
      userGreeting.textContent = '';
      userGreeting.classList.remove('show');
    }

    authButtons.innerHTML = window.isLoggedIn
      ? `<button class="icon-button" id="logoutBtn">${t.logout}</button>
         <button class="icon-button" id="settingsBtn">${t.config}</button>`
      : `<button class="icon-button" id="loginModalBtn">${t.login}</button>
         <button class="icon-button" id="settingsBtn">${t.config}</button>`;

    if (faqBtn) faqBtn.textContent = t.faq;

    languageSelect.value = currentLang;
    threadSelector.setAttribute('aria-label', t.selectThreadsLabel);
    updateThreadOptionsLanguage(threadSelector);
    renderFAQ(currentLang, faqSection);
  }

  function toggleModal(id) {
    if (isAppClosing) return;
    const modal = document.getElementById(id);
    if (!modal) return;
    const isOpen = modal.style.display === 'flex';
    document.querySelectorAll('.modal').forEach(m => (m.style.display = 'none'));
    if (!isOpen) modal.style.display = 'flex';
  }

  themeBtn?.addEventListener('click', () => toggleTheme(usageChart));
  connectBtn?.addEventListener('click', handleConnect);
  dashboardBtn?.addEventListener('click', openDashboard);
  closeSettingsModal?.addEventListener('click', () => toggleModal('settingsModal'));
  closeLoginModal?.addEventListener('click', () => toggleModal('loginModal'));
  
  languageSelect?.addEventListener('change', () => {
    if (isAppClosing) return;
    
    const wasSharing = isCurrentlySharing;
    const oldLang = currentLang;
    
    console.log(`[RENDERER] Mudança imediata de idioma: ${oldLang} → ${languageSelect.value} (compartilhando: ${wasSharing})`);
    
    setLanguage(languageSelect.value);
    
    if (window.electronAPI && oldLang !== languageSelect.value) {
      window.electronAPI.send('language-changed');
    }
    
    setTimeout(() => {
      if (isAppClosing) return;
      if (wasSharing) {
        isCurrentlySharing = true;
        window.isMining = true;
        updateSharingUI(true);
      }
      updateText();
    }, 100);
  });

  registerBtn?.addEventListener('click', () => handleRegister(currentLang, toggleModal, updateText));
  loginForm?.addEventListener('submit', (e) => handleLogin(e, currentLang, toggleModal, updateText));

  authButtons?.addEventListener('click', (event) => {
    if (isAppClosing) return;
    const target = event.target;
    switch (target.id) {
      case 'settingsBtn':
        toggleModal('settingsModal');
        break;
      case 'logoutBtn':
        handleLogout(updateText);
        break;
      case 'loginModalBtn':
        toggleModal('loginModal');
        break;
    }
  });

  faqBtn?.addEventListener('click', () => {
    if (isAppClosing) return;
    if (faqSection.classList.contains('show')) {
      faqSection.classList.remove('show');
    } else {
      faqSection.classList.add('show');
    }
  });

  document.addEventListener('click', (e) => {
    if (!faqBtn.contains(e.target) && !faqSection.contains(e.target)) {
    }
  });

  document.addEventListener('click', (e) => {
    if (isAppClosing) return;
    const link = e.target.closest('a[target="_blank"]');
    if (!link) return;
    e.preventDefault();
    const url = link.href;
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url);
      }
    } catch (err) {
      console.error('[RENDERER] Erro ao abrir link externo:', err);
      window.open(url);
    }
  });

  threadSelector.value = localStorage.getItem('bigfootThreads') || '4';
  threadSelector?.addEventListener('change', () => {
    localStorage.setItem('bigfootThreads', threadSelector.value);
  });

  function handleConnect() {
    if (isAppClosing) return;
    
    if (!window.isLoggedIn) {
      alert(currentLang === 'pt' ? 'Por favor, faça login antes de conectar.' : 'Please log in before connecting.');
      return;
    }
    
    const newState = !isCurrentlySharing;
    const threads = parseInt(threadSelector.value, 10) || 4;

    console.log(`[RENDERER] Alternando estado: ${isCurrentlySharing} → ${newState}`);

    if (window.electronAPI?.startMiningWithThreads) {
      if (newState) {
        window.electronAPI.startMiningWithThreads(threads);
      } else {
        window.electronAPI.toggleSharing(false);
      }
    } else {
      // Fallback para teste sem Electron
      isCurrentlySharing = newState;
      window.isMining = newState;
      updateSharingUI(newState);
    }
  }

  function openDashboard() {
    if (isAppClosing) return;
    if (window.electronAPI?.openDashboard) {
      window.electronAPI.openDashboard();
    } else {
      alert(currentLang === 'pt' ? 'Erro: API do Electron não disponível.' : 'Error: Electron API not available.');
    }
  }

  window.addEventListener('offline', () => {
    if (!isAppClosing) {
      alert(currentLang === 'pt' ? 'Sem conexão com a internet.' : 'No internet connection.');
    }
  });

  function safeCleanup() {
    try {
      console.log('[RENDERER] Iniciando cleanup seguro...');
      isAppClosing = true;
      
      if (animatedDots) {
        animatedDots.stop();
      }
      
      isCurrentlySharing = false;
      totalBigPointsToday = 0;
      firebaseIdToken = null;
      
      console.log('[RENDERER] Cleanup seguro concluído');
    } catch (error) {
      console.warn('[RENDERER] Erro durante cleanup (silenciado):', error);
    }
  }

  window.addEventListener('beforeunload', safeCleanup);
  window.addEventListener('unload', safeCleanup);
  
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    window.addEventListener('beforeunload', safeCleanup);
    
    if (window.electronAPI?.onBeforeQuit) {
      window.electronAPI.onBeforeQuit(safeCleanup);
    }
  }

  updateText();

  console.log('[RENDERER] BIGFOOT Connect - Sistema inicializado com API backend integrada!');
});

export function getConnectionStatus() {
  return {
    isSharing: isCurrentlySharing,
    hasAnimation: animatedDots?.isActive() || false,
    language: currentLang,
    totalBigPoints: totalBigPointsToday
  };
}

window.electronAPI.debugEmail?.().then(console.log);

export function forceStopConnection() {
  if (isCurrentlySharing) {
    isCurrentlySharing = false;
    window.isMining = false;
    updateSharingUI(false);
  }
}