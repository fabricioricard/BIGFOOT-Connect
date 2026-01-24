import { t, currentLang } from './i18n.js';

let db = null;
let auth = null;

export function initializeSettings(firebaseAuth, firebaseDb) {
  console.log('[SETTINGS] Inicializando...');
  auth = firebaseAuth;
  db = firebaseDb;
  
  // Settings agora é apenas configurações gerais (idioma, tema, etc)
  console.log('[SETTINGS] ✅ Página de configurações gerais pronta');
}

// Função pública para atualizar idioma do settings
window.updateSettingsLanguage = function() {
  console.log('[SETTINGS] 🌐 Atualizando idioma...');
  // Settings não tem conteúdo dinâmico para atualizar
  // Apenas os elementos com data-i18n serão atualizados automaticamente
};

export function cleanupSettings() {
  console.log('[SETTINGS] Cleanup');
}