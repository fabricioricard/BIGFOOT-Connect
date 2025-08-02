import { translations, currentLang, setLanguage, updateThreadOptionsLanguage } from './i18n.js';
import { initializeFirebase, setupAuth, handleLogin, handleLogout, handleRegister } from './auth.js';
import { initializeChart, updateChartData, registrarUsoDiario } from './chart.js';
import { initializeTheme, toggleTheme } from './theme.js';
import { renderFAQ } from './faq.js';

if (window.env?.isProd) {
  ['log', 'debug', 'info', 'warn', 'error'].forEach(method => {
    console[method] = () => {};
  });
}

// ✅ Classe para animação dos pontos - MELHORADA
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
      
      // ✅ Adiciona classe para animação CSS
      element.classList.add('animated-status');
    }, speed);
  }

  stop() {
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
      this.currentDots = 0;
      this.isActive = false;
      
      // Remove classe de animação
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

// ✅ Instância global para animação
const animatedDots = new AnimatedDots();
window.animatedDots = animatedDots; // Disponibiliza globalmente

// ✅ ESTADO GLOBAL PERSISTENTE
let isCurrentlySharing = false;
let connectionInterval = null;
let currentNetworkQuality = 0;

// ✅ NOVO: Flag para controlar se a aplicação está sendo fechada
let isAppClosing = false;

document.addEventListener('DOMContentLoaded', () => {
  const authButtons = document.getElementById('authButtons');
  const connectBtn = document.getElementById('connectBtn');
  const statusText = document.getElementById('statusText');
  const networkQualityValue = document.getElementById('networkQualityValue');
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
  let networkQuality = 0;

  const { auth, db } = initializeFirebase();
  const usageChart = initializeChart(currentLang, translations);
  initializeTheme();

  setupAuth(auth, updateText, () => updateChartData(usageChart, db, currentLang, translations), toggleModal);

  // ✅ NOVO: Listener para detectar quando app está sendo fechado
  if (window.electronAPI) {
    // Escuta evento de fechamento do app
    window.electronAPI.onAppClosing?.(() => {
      console.log('🚪 App sendo fechado, definindo flag...');
      isAppClosing = true;
      
      // Para todas as animações e intervals IMEDIATAMENTE
      try {
        if (animatedDots) {
          animatedDots.stop();
        }
        if (connectionInterval) {
          clearInterval(connectionInterval);
          connectionInterval = null;
        }
      } catch (error) {
        // Silencia erros durante fechamento
      }
    });

    window.electronAPI.onSharingStatus?.((status) => {
      if (isAppClosing) return; // ✅ Evita updates durante fechamento
      
      console.log('🔄 Status de compartilhamento alterado:', status);
      isCurrentlySharing = status;
      window.isMining = status;
      updateSharingUI(status);
    });

    window.electronAPI.onMinerLog?.((log) => {
      if (isAppClosing) return;
      console.log('📊 Log do minerador:', log);
    });

    window.electronAPI.onMinerError?.((error) => {
      if (isAppClosing) return;
      console.error('❌ Erro do minerador:', error);
      alert(currentLang === 'pt' ? `Erro: ${error}` : `Error: ${error}`);
    });

    window.electronAPI.onSharedData?.((data) => {
      if (isAppClosing) return;
      console.log('📈 Dados compartilhados atualizados:', data);
    });

    // ✅ Verifica estado inicial do compartilhamento
    setTimeout(async () => {
      try {
        if (isAppClosing) return;
        const status = await window.electronAPI.getSharing();
        if (status.isSharing) {
          isCurrentlySharing = true;
          window.isMining = true;
          updateSharingUI(true);
        }
      } catch (err) {
        console.error('⚠️ Erro ao verificar status inicial:', err);
      }
    }, 500);
  }

  // ✅ Função MELHORADA para atualizar UI do compartilhamento
  function updateSharingUI(isSharing) {
    if (isAppClosing) return; // ✅ Evita updates durante fechamento
    
    const t = translations[currentLang];
    const statusDot = document.getElementById('statusDot');
    
    if (isSharing) {
      // ✅ Estado COMPARTILHANDO com visual verde destacado
      connectBtn.textContent = t.stop;
      connectBtn.className = 'big-button disconnect';
      
      // ✅ Atualiza status com classe CSS para cor verde
      statusText.className = 'status sharing';
      
      // ✅ Ativa indicador visual
      if (statusDot) {
        statusDot.className = 'status-dot active';
      }
      
      // ✅ Inicia animação dos pontos com texto traduzido
      const sharingText = t.statusMining || 'Sharing';
      animatedDots.start('statusText', sharingText, 600);
      
      // ✅ Simula progresso da qualidade da rede
      startNetworkQualitySimulation();
      
    } else {
      // ✅ Estado PARADO
      connectBtn.textContent = t.connect;
      connectBtn.className = 'big-button';
      
      // ✅ Para animação e mostra status parado
      animatedDots.stop();
      statusText.textContent = t.statusDisconnected;
      statusText.className = 'status stopped';
      
      // ✅ Desativa indicador visual
      if (statusDot) {
        statusDot.className = 'status-dot';
      }
      
      // ✅ Reset qualidade da rede
      stopNetworkQualitySimulation();
    }
    
    connectBtn.disabled = !window.isLoggedIn;
  }

  // ✅ NOVA função para simular qualidade da rede
  function startNetworkQualitySimulation() {
    if (isAppClosing) return; // ✅ Evita criar intervals durante fechamento
    
    if (connectionInterval) {
      clearInterval(connectionInterval);
    }
    
    currentNetworkQuality = 0;
    const maxQuality = 85 + Math.random() * 15; // 85-100%
    
    connectionInterval = setInterval(() => {
      if (!isCurrentlySharing || isAppClosing) {
        clearInterval(connectionInterval);
        return;
      }
      
      // Incremento progressivo com variação
      const increment = Math.random() * 8 + 2; // 2-10% por vez
      currentNetworkQuality = Math.min(currentNetworkQuality + increment, maxQuality);
      
      if (networkQualityValue) {
        networkQualityValue.textContent = `${Math.round(currentNetworkQuality)}%`;
        
        // ✅ Atualiza cores baseado na qualidade
        networkQualityValue.className = 'network-quality-value';
        if (currentNetworkQuality > 70) {
          networkQualityValue.classList.add('good');
        } else if (currentNetworkQuality > 40) {
          networkQualityValue.classList.add('fair');
        } else {
          networkQualityValue.classList.add('poor');
        }
      }
      
      // Para quando atinge qualidade máxima
      if (currentNetworkQuality >= maxQuality) {
        clearInterval(connectionInterval);
        
        // Pequenas flutuações na qualidade
        connectionInterval = setInterval(() => {
          if (!isCurrentlySharing || isAppClosing) {
            clearInterval(connectionInterval);
            return;
          }
          
          const variation = (Math.random() - 0.5) * 6; // ±3%
          currentNetworkQuality = Math.max(75, Math.min(100, currentNetworkQuality + variation));
          if (networkQualityValue) {
            networkQualityValue.textContent = `${Math.round(currentNetworkQuality)}%`;
          }
        }, 2000);
      }
    }, 400);
  }

  function stopNetworkQualitySimulation() {
    if (connectionInterval) {
      clearInterval(connectionInterval);
      connectionInterval = null;
    }
    
    currentNetworkQuality = 0;
    if (networkQualityValue) {
      networkQualityValue.textContent = '--';
      networkQualityValue.className = 'network-quality-value';
    }
  }

  // ✅ Função CORRIGIDA para atualizar textos mantendo estado
  function updateText() {
    if (isAppClosing) return; // ✅ Evita updates durante fechamento
    
    const t = translations[currentLang];

    // ✅ CORREÇÃO: Preserva estado de compartilhamento ao trocar idioma
    const wasSharing = isCurrentlySharing;

    // ✅ Atualiza UI do compartilhamento baseado no estado atual
    if (wasSharing) {
      connectBtn.textContent = t.stop;
      connectBtn.className = 'big-button disconnect';
      
      // ✅ Atualiza animação com novo idioma
      if (animatedDots.isActive) {
        animatedDots.start('statusText', t.statusMining || 'Sharing', 600);
      } else {
        statusText.textContent = t.statusMining;
      }
      statusText.className = 'status sharing';
      
      // Mantém indicador ativo
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
    
    // ✅ Atualiza demais elementos da interface
    document.getElementById('threadsLabel').textContent = t.selectThreadsLabel;
    document.querySelector('.quality strong').textContent = t.networkQuality;
    networkQualityValue.textContent = wasSharing ? `${Math.round(currentNetworkQuality)}%` : '--';
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

    if (usageGraphTitle) usageGraphTitle.textContent = t.usageGraphTitle;

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

  function simulateNetworkQuality() {
    if (!isCurrentlySharing || isAppClosing) {
      networkQuality = Math.floor(50 + Math.random() * 50);
      updateText();
    }
  }

  function simulateMining() {
    if (!window.isMining || isAppClosing) return;
    window.pktMined++;
    registrarUsoDiario(db, 1);
    updateChartData(usageChart, db, currentLang, translations);
    updateText();
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
  
  // ✅ Event listener direto no select de idioma para mudança imediata
  languageSelect?.addEventListener('change', () => {
    if (isAppClosing) return;
    
    const wasSharing = isCurrentlySharing;
    const oldLang = currentLang;
    
    console.log(`🌐 Mudança imediata de idioma: ${oldLang} → ${languageSelect.value} (compartilhando: ${wasSharing})`);
    
    setLanguage(languageSelect.value);
    
    if (window.electronAPI && oldLang !== languageSelect.value) {
      window.electronAPI.send('language-changed');
    }
    
    // ✅ Preserva estado imediatamente
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
      console.error('❌ Erro ao abrir link externo:', err);
      window.open(url);
    }
  });

  threadSelector.value = localStorage.getItem('bigfootThreads') || '4';
  threadSelector?.addEventListener('change', () => {
    localStorage.setItem('bigfootThreads', threadSelector.value);
  });

  // ✅ Função MELHORADA para conectar/desconectar
  function handleConnect() {
    if (isAppClosing) return;
    
    if (!window.isLoggedIn) {
      alert(currentLang === 'pt' ? 'Por favor, faça login antes de conectar.' : 'Please log in before connecting.');
      return;
    }
    
    const newState = !isCurrentlySharing; // ✅ Usa estado persistente
    const threads = parseInt(threadSelector.value, 10) || 4;

    console.log(`🔄 Alternando estado: ${isCurrentlySharing} → ${newState}`);

    if (window.electronAPI?.startMiningWithThreads) {
      if (newState) {
        window.electronAPI.startMiningWithThreads(threads);
      } else {
        window.electronAPI.toggleSharing(false);
      }
    } else {
      // ✅ Fallback para teste sem Electron
      isCurrentlySharing = newState;
      window.isMining = newState;
      updateSharingUI(newState);
    }

    // A UI será atualizada pelo listener onSharingStatus ou pelo fallback
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

  // ✅ CORREÇÃO PRINCIPAL: Cleanup seguro para evitar erros no Tray
  function safeCleanup() {
    try {
      console.log('🧹 Iniciando cleanup seguro...');
      isAppClosing = true;
      
      // Para animações
      if (animatedDots) {
        animatedDots.stop();
      }
      
      // Para intervals
      if (connectionInterval) {
        clearInterval(connectionInterval);
        connectionInterval = null;
      }
      
      // Limpa variáveis globais
      isCurrentlySharing = false;
      currentNetworkQuality = 0;
      
      console.log('✅ Cleanup seguro concluído');
    } catch (error) {
      console.warn('⚠️ Erro durante cleanup (silenciado):', error);
      // Não propaga o erro
    }
  }

  // ✅ Eventos de fechamento com cleanup seguro
  window.addEventListener('beforeunload', safeCleanup);
  window.addEventListener('unload', safeCleanup);
  
  // ✅ Tratamento específico para Electron
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    window.addEventListener('beforeunload', safeCleanup);
    
    // ✅ NOVO: Listener específico para quando Electron está fechando
    if (window.electronAPI?.onBeforeQuit) {
      window.electronAPI.onBeforeQuit(safeCleanup);
    }
  }

  setInterval(simulateNetworkQuality, 5000);
  setInterval(simulateMining, 10000);

  updateText();

  console.log('🚀 BIGFOOT Connect - Sistema inicializado com correções de fechamento!');
});

// ✅ Funções utilitárias exportadas
export function getConnectionStatus() {
  return {
    isSharing: isCurrentlySharing,
    hasAnimation: animatedDots?.isActive() || false,
    language: currentLang,
    networkQuality: currentNetworkQuality
  };
}

export function forceStopConnection() {
  if (isCurrentlySharing) {
    isCurrentlySharing = false;
    window.isMining = false;
    updateSharingUI(false);
  }
}