import { t, getCurrentLang, setLanguage } from './i18n.js';
import { updateChatLanguage } from './chat.js';
import { updateProfileLanguage } from './profile.js';

let db = null;
let auth = null;

export function initializeSettings(firebaseAuth, firebaseDb) {
  auth = firebaseAuth;
  db = firebaseDb;
  
  // Cria seletor de idioma
  createLanguageSelector();
}

// ⭐ NOVO: Criar seletor de idioma
function createLanguageSelector() {
  const settingsForm = document.getElementById('settingsForm');
  if (!settingsForm) {
    return;
  }
  
  // Remove seletor existente se houver
  const existing = settingsForm.querySelector('.language-selector-inline');
  if (existing) existing.remove();
  
  // Fix 2: createElement + textContent — sem innerHTML para evitar XSS
  const languageSection = document.createElement('div');
  languageSection.className = 'form-group language-selector-inline';

  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = getCurrentLang() === 'pt' ? 'Idioma:' : 'Language:';

  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'language-buttons';

  const langOptions = [
    { lang: 'en', flag: '🇺🇸', label: 'English' },
    { lang: 'pt', flag: '🇧🇷', label: 'Português' },
  ];

  langOptions.forEach(({ lang, flag, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'language-btn' + (getCurrentLang() === lang ? ' active' : '');
    btn.dataset.lang = lang;
    btn.textContent = flag + ' ';
    const sp = document.createElement('span');
    sp.textContent = label;
    btn.appendChild(sp);
    buttonsDiv.appendChild(btn);
  });

  languageSection.appendChild(lbl);
  languageSection.appendChild(buttonsDiv);
  
  // Insere no início do settingsForm (antes do Dark Mode)
  settingsForm.insertBefore(languageSection, settingsForm.firstChild);
  
  // Event listeners
  const langButtons = languageSection.querySelectorAll('.language-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const newLang = btn.dataset.lang;
      
      // Remove active de todos
      langButtons.forEach(b => b.classList.remove('active'));
      
      // Adiciona active no clicado
      btn.classList.add('active');
      
      // ⭐ CHAMA setLanguage - SALVA NO localStorage E ARQUIVO!
      await setLanguage(newLang);
      
      // localStorage já atualizado por setLanguage() com validação de whitelist
      
      // ⭐ ATUALIZA INTERFACE SEM RELOAD
      updateAllInterface(newLang);
      
      // Mostra notificação
      showLanguageChangedNotification(newLang);
      
      // Notifica main process
      if (window.electronAPI?.send) {
        window.electronAPI.send('language-changed', newLang);
      }
    });
  });
}

// Atualiza toda a interface após troca de idioma
// Fix 1: sem dynamic import() — usa importações estáticas do topo do módulo
// Fix 3 & 8: sem window.* e sem navUpdates hardcoded — usa t() do i18n.js
function updateAllInterface(newLang) {
  // Atualiza todos os elementos com data-i18n usando t() estático
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key, newLang);
    if (translation && translation !== key) {
      el.textContent = translation;
    }
  });

  // Atualiza spans de navegação com data-i18n
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const page = item.getAttribute('data-page');
    const textSpan = item.querySelector('span[data-i18n]');
    if (textSpan && page) {
      const key = textSpan.getAttribute('data-i18n');
      const translation = t(key, newLang);
      if (translation) textSpan.textContent = translation;
    }
  });

  // Atualiza botão de logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.textContent = t('logout', newLang);
  }

  // Fix 9: consulta status do node via API em vez de window.isNodeRunning
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    window.electronAPI?.getNodeStatus?.().then(status => {
      if (status !== undefined) {
        connectBtn.textContent = status
          ? t('disconnect', newLang)
          : t('connect', newLang);
      }
    }).catch(() => {});
  }

  // Atualiza seletor de idioma com novos textos
  createLanguageSelector();

  // Fix 3: chama funções importadas diretamente — sem window.*
  updateChatLanguage();
  updateProfileLanguage();
}

// Notificação de idioma alterado
function showLanguageChangedNotification(lang) {
  const messages = {
    pt: '✅ Idioma alterado para Português',
    en: '✅ Language changed to English'
  };
  
  // Remove notificação existente
  const existing = document.querySelector('.language-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'language-notification';
  notification.textContent = messages[lang];
  
  document.body.appendChild(notification);
  
  // Anima entrada
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Remove após 800ms (antes do reload)
  setTimeout(() => {
    notification.classList.remove('show');
  }, 600);
}

// Export para uso no renderer.js — sem window.*
export function updateSettingsLanguage() {
  createLanguageSelector();
}

export function cleanupSettings() {
}