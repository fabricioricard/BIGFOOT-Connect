export const translations = {
  pt: {
    // Botões principais
    connect: "🔌 Conectar",
    stop: "🛑 Desconectar",
    disconnect: "🛑 Parar Compartilhamento",
    
    // Status da conexão
    statusDisconnected: "Desconectado",
    statusMining: "Compartilhando", // ✅ Texto base para animação
    statusConnecting: "Conectando",
    statusError: "Erro de Conexão",
    
    // Interface geral
    received: "Você já recebeu:",
    config: "⚙️ Configurações",
    login: "🔐 Login",
    logout: "🚪 Sair",
    networkQuality: "Qualidade da Rede:",
    dashboard: "🖥️ Dashboard",
    selectThreadsLabel: "Nível de Compartilhamento:",
    theme: "🌓 Tema",
    faq: "❓ F.A.Q",
    
    // Modal de configurações
    settingsTitle: "Configurações",
    selectLanguage: "Idioma:",
    languageLabel: "Idioma:",
    save: "Salvar",
    close: "Fechar",
    
    // Modal de login
    loginTitle: "Entrar / Cadastrar",
    orText: "ou",
    emailPlaceholder: "Seu e-mail",
    passwordPlaceholder: "Senha",
    loginBtn: "Entrar",
    registerBtn: "Cadastrar",
    
    // Saudação do usuário
    greeting: "Olá, ",
    
    // Gráfico de uso - ✅ ATUALIZADO para BIG Points
    usageGraphTitle: "Histórico de Compartilhamento",
    bigPointsGraphTitle: "Histórico de BIG Points",
    toggleGraph: "Ocultar Gráfico",
    showGraph: "Mostrar Gráfico",
    
    // Estados de qualidade de rede
    qualityExcellent: "Excelente",
    qualityGood: "Boa",
    qualityFair: "Regular",
    qualityPoor: "Ruim",
    qualityOffline: "Offline",
    
    // Mensagens de status
    connecting: "Conectando ao servidor...",
    connected: "Conectado com sucesso!",
    disconnecting: "Desconectando...",
    disconnected: "Desconectado do servidor",
    error: "Erro na conexão"
  },
  
  en: {
    // Main buttons
    connect: "🔌 Connect",
    stop: "🛑 Disconnect", 
    disconnect: "🛑 Stop Sharing",
    
    // Connection status
    statusDisconnected: "Disconnected",
    statusMining: "Sharing", // ✅ Base text for animation
    statusConnecting: "Connecting",
    statusError: "Connection Error",
    
    // General interface
    received: "You've received:",
    config: "⚙️ Settings",
    login: "🔐 Login",
    logout: "🚪 Logout",
    networkQuality: "Network Quality:",
    dashboard: "🖥️ Dashboard",
    selectThreadsLabel: "Sharing Level:",
    theme: "🌓 Theme",
    faq: "❓ F.A.Q",
    
    // Settings modal
    settingsTitle: "Settings",
    selectLanguage: "Language:",
    languageLabel: "Language:",
    save: "Save",
    close: "Close",
    
    // Login modal
    loginTitle: "Login / Register",
    orText: "or",
    emailPlaceholder: "Your email",
    passwordPlaceholder: "Password",
    loginBtn: "Login",
    registerBtn: "Register",
    
    // User greeting
    greeting: "Hello, ",
    
    // Usage graph - ✅ UPDATED for BIG Points
    usageGraphTitle: "Sharing History",
    bigPointsGraphTitle: "BIG Points History",
    toggleGraph: "Hide Graph",
    showGraph: "Show Graph",
    
    // Network quality states
    qualityExcellent: "Excellent",
    qualityGood: "Good",
    qualityFair: "Fair", 
    qualityPoor: "Poor",
    qualityOffline: "Offline",
    
    // Status messages
    connecting: "Connecting to server...",
    connected: "Successfully connected!",
    disconnecting: "Disconnecting...",
    disconnected: "Disconnected from server",
    error: "Connection error"
  },
  
  // ✅ Adicionando suporte para espanhol (opcional)
  es: {
    // Botones principales
    connect: "🔌 Conectar",
    stop: "🛑 Desconectar",
    disconnect: "🛑 Detener Compartir",
    
    // Estado de conexión
    statusDisconnected: "Desconectado",
    statusMining: "Compartiendo", // ✅ Texto base para animación
    statusConnecting: "Conectando",
    statusError: "Error de Conexión",
    
    // Interfaz general
    received: "Has recibido:",
    config: "⚙️ Configuración",
    login: "🔐 Iniciar Sesión",
    logout: "🚪 Salir",
    networkQuality: "Calidad de Red:",
    dashboard: "🖥️ Panel",
    selectThreadsLabel: "Nivel de Compartir:",
    theme: "🌓 Tema",
    faq: "❓ Preguntas Frecuentes",
    
    // Modal de configuración
    settingsTitle: "Configuración",
    selectLanguage: "Idioma:",
    languageLabel: "Idioma:",
    save: "Guardar",
    close: "Cerrar",
    
    // Modal de login
    loginTitle: "Iniciar Sesión / Registrarse",
    orText: "o",
    emailPlaceholder: "Tu email",
    passwordPlaceholder: "Contraseña",
    loginBtn: "Iniciar Sesión",
    registerBtn: "Registrarse",
    
    // Saludo del usuario
    greeting: "Hola, ",
    
    // Gráfico de uso - ✅ ACTUALIZADO para BIG Points
    usageGraphTitle: "Historial de Compartir",
    bigPointsGraphTitle: "Historial de BIG Points",
    toggleGraph: "Ocultar Gráfico",
    showGraph: "Mostrar Gráfico",
    
    // Estados de calidad de red
    qualityExcellent: "Excelente",
    qualityGood: "Buena",
    qualityFair: "Regular",
    qualityPoor: "Mala",
    qualityOffline: "Sin conexión",
    
    // Mensajes de estado
    connecting: "Conectando al servidor...",
    connected: "¡Conectado exitosamente!",
    disconnecting: "Desconectando...",
    disconnected: "Desconectado del servidor",
    error: "Error de conexión"
  }
};

// ✅ Configuração do idioma atual
export let currentLang = localStorage.getItem('bigfootLang') || 'pt';

// ✅ Função para definir idioma
export function setLanguage(lang) {
  console.log('🌐 Salvando idioma:', lang);
  
  // Valida se o idioma é suportado
  if (!translations[lang]) {
    console.warn(`Idioma ${lang} não suportado, usando 'pt' como padrão`);
    lang = 'pt';
  }
  
  currentLang = lang;
  localStorage.setItem('bigfootLang', currentLang);
  
  // Atualiza o atributo lang do HTML
  const htmlElement = document.documentElement;
  if (htmlElement) {
    const langMap = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    htmlElement.lang = langMap[lang] || 'pt-BR';
  }
}

// ✅ Função para obter tradução específica
export function t(key, lang = currentLang) {
  const translation = translations[lang];
  if (!translation) {
    console.warn(`Idioma ${lang} não encontrado, usando 'pt'`);
    return translations.pt[key] || key;
  }
  
  return translation[key] || translations.pt[key] || key;
}

// ✅ Função para atualizar opções do seletor de threads
export function updateThreadOptionsLanguage(threadSelector) {
  if (!threadSelector) {
    console.warn('Thread selector não encontrado');
    return;
  }
  
  console.log('🔄 Atualizando opções de threads, idioma:', currentLang);
  
  const options = threadSelector.querySelectorAll('option');
  options.forEach(option => {
    // Pega o texto traduzido baseado no idioma atual
    const label = currentLang === 'en' ? option.dataset.en : 
                  currentLang === 'es' ? option.dataset.es || option.dataset.pt :
                  option.dataset.pt;
    
    // Mantém o emoji original
    const emoji = option.textContent.match(/^[^\s]+/);
    const emojiPrefix = emoji ? emoji[0] + ' ' : '';
    
    option.textContent = `${emojiPrefix}${label}`;
  });
}

// ✅ Função para obter lista de idiomas disponíveis
export function getAvailableLanguages() {
  return Object.keys(translations).map(code => ({
    code,
    name: {
      pt: 'Português',
      en: 'English', 
      es: 'Español'
    }[code] || code.toUpperCase()
  }));
}

// ✅ Função para detectar idioma do navegador
export function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0]; // Pega apenas 'pt' de 'pt-BR'
  
  // Retorna o idioma se suportado, senão retorna 'pt' como padrão
  return translations[langCode] ? langCode : 'pt';
}

// ✅ Inicialização automática baseada no navegador (se não há preferência salva)
if (!localStorage.getItem('bigfootLang')) {
  const detectedLang = detectBrowserLanguage();
  setLanguage(detectedLang);
}

// ✅ Disponibiliza as traduções globalmente para uso em outros scripts
if (typeof window !== 'undefined') {
  window.translations = translations;
  window.currentLang = currentLang;
  window.t = t;
}