// ==========================================
// i18n.js — Sistema de internacionalização
// ==========================================

export const translations = {
  pt: {
    // NAVEGAÇÃO PRINCIPAL
    navHome: "Início",
    navWallet: "Carteira",
    navChat: "Chat",
    navProfile: "Perfil",
    navLogs: "Logs",
    navSettings: "Configurações",
    navFAQ: "FAQ",
    
    // AUTENTICAÇÃO
    login: "🔐 Entrar",
    logout: "🚪 Sair",
    loginTitle: "Entrar / Criar Conta",
    emailPlaceholder: "Seu e-mail",
    passwordPlaceholder: "Senha",
    loginBtn: "Entrar",
    registerBtn: "Criar Conta",
    googleLoginText: "Continuar com Google",
    orText: "ou",
    
    // PÁGINA INÍCIO / NODE
    home: "Início",
    nodeControl: "Controle do Nó",
    connect: "CONECTAR",
    disconnect: "DESCONECTAR",
    statusDisconnected: "Desconectado",
    statusConnecting: "Conectando...",
    statusConnected: "Conectado",
    statusError: "Erro de Conexão",
    
    // Node Stats
    peers: "Conexões",
    blocks: "Blocos",
    balance: "Saldo",
    relays: "Retransmissões",
    rewardBlock: "⛏️ Recompensa/Bloco",
    supply: "📊 Oferta",
    
    // Proof of Relay
    proofOfRelayStatus: "Status de Mineração PoR",
    requiredRelays: "Retransmissões Necessárias",
    readyToMine: "✅ Pronto para minerar!",
    accumulatingProofs: "⏳ Acumulando provas de retransmissão...",
    creditsCost: "Créditos (custo 50):",
    relayScore: "Pontuação de Retransmissão:",
    scoreBonus: "Bônus de Pontuação:",
    dailyEmission: "Emissão Diária:",
    roundRobin: "Rodízio:",
    waiting: "Aguardando",
    readyWaitingTurn: "✅ Pronto — aguardando vez",
    mining: "⛏️ Minerando...",

    // Gráfico
    bigPointsGraphTitle: "BIG Ganhos",
    bigEarned: "BIG Ganhos",
    bigPerDay: "BIG/dia",
    
    // Histórico
    bigHistory: "Histórico de BIG",
    noTransactionsYet: "Nenhuma transação ainda",
    
    // CARTEIRA
    wallet: "Carteira",
    totalBalance: "Saldo Total",
    availableBalance: "Saldo Disponível",
    pending: "Pendente",
    send: "Enviar",
    receive: "Receber",
    history: "Histórico",
    walletInformation: "Informações da Carteira",
    address: "Endereço",
    privateKey: "Chave Privada",
    neverSharePrivateKey: "⚠️ Nunca compartilhe sua chave privada!",
    created: "Criada em",
    sendBig: "Enviar BIG",
    recipientAddress: "Endereço do Destinatário",
    amount: "Quantia",
    networkFee: "Taxa de Rede",
    total: "Total",
    maxButton: "MÁXIMO",
    invalidAddress: "Endereço inválido",
    insufficientBalance: "Saldo insuficiente",
    sendConfirm: "Confirmar Envio",
    receiveBig: "Receber BIG",
    yourAddress: "Seu Endereço",
    copyAddress: "Copiar Endereço",
    addressCopied: "✅ Endereço copiado!",
    onlySendBig: "⚠️ Envie apenas BIG para este endereço",
    transactionHistory: "Histórico de Transações",
    allTransactions: "Todas",
    sentTransactions: "Enviadas",
    receivedTransactions: "Recebidas",
    sent: "Enviado",
    received: "Recebido",
    noTransactions: "Nenhuma transação ainda",
    transactionsWillAppear: "Suas transações aparecerão aqui",
    
    // CHAT
    chat: "Chat",
    chatWelcome: "Bem-vindo ao chat da comunidade BIG!",
    chatDisclaimer: "Mantenha o respeito e boas práticas.",
    chatPlaceholder: "Digite sua mensagem...",
    chatSend: "Enviar",
    chatError: "Erro ao enviar mensagem. Tente novamente.",
    loginRequired: "Faça login para enviar mensagens.",
    chatYou: "você",
    chatDeleteConfirm: "Deseja excluir esta mensagem?",
    chatDeleteError: "Erro ao excluir mensagem.",
    chatDeleteSuccess: "Mensagem excluída!",
    
    // PERFIL
    profile: "Perfil",
    profileTitle: "Meu Perfil",
    chatProfileTitle: "Perfil do Chat",
    yourAvatar: "Seu Avatar",
    uploadHint: "PNG, JPG ou GIF - Máx. 2 MB",
    chooseAvatar: "Escolher Avatar",
    dragOrClick: "Clique ou arraste uma imagem",
    removeAvatar: "Remover",
    chatNickname: "Apelido no Chat",
    nicknamePlaceholder: "Digite seu apelido",
    saveProfile: "Salvar Perfil",
    avatarLoaded: "Avatar carregado",
    invalidFormat: "Formato inválido. Use PNG, JPG ou GIF",
    fileTooLarge: "Arquivo muito grande. Máximo: 2 MB",
    imageTooLarge: "Imagem muito grande. Use uma resolução menor.",
    avatarTooLarge: "Avatar muito grande. Reduza o tamanho.",
    errorLoadingImage: "Erro ao carregar imagem",
    loginFirst: "Faça login primeiro",
    nicknameMin: "Apelido deve ter no mínimo 3 caracteres",
    chooseAvatarFirst: "Escolha um avatar antes de salvar",
    saving: "Salvando...",
    saved: "✅ Salvo!",
    errorSavingProfile: "Erro ao salvar perfil",
    
    // CONFIGURAÇÕES
    settings: "Configurações",
    settingsTitle: "Configurações",
    generalSettings: "Configurações Gerais",
    language: "Idioma",
    darkMode: "Modo Escuro",
    
    // LOGS
    logsTitle: "📋 Saída do Nó BIGchain",
    logsAutoScroll: " Auto-rolagem",
    logsClear: "Limpar",
    logsEmpty: "Nenhum log ainda — conecte o nó para ver a saída aqui.",
    logTypeBlock: "⛏️ Bloco",
    logTypeRelay: "📡 Retransmissão",
    logTypePeer: "🔗 Par",
    logTypeWallet: "💰 Carteira",
    logTypeSync: "🔄 Sincronização",
    logTypeMining: "⛏️ Mineração",
    logTypeRegistered: "📤 Registrado",
    logTypeWarning: "⚠️ Aviso",
    logTypeError: "❌ Erro",
    
    // MENSAGENS GERAIS
    loading: "Carregando...",
    error: "Erro",
    success: "Sucesso",
    save: "Salvar",
    cancel: "Cancelar",
    close: "Fechar",
    confirm: "Confirmar",
    back: "Voltar",
    next: "Próximo",
    finish: "Concluir",
    syncing: "Sincronizando",
    confirmLogoutMessage: "Tem certeza que deseja sair?\n\nSeus dados serão salvos automaticamente.",
    connectionRestored: "Conexão restaurada!",
    loginFirstToConnect: "Faça login primeiro.",
  },
  
  en: {
    // MAIN NAVIGATION
    navHome: "Home",
    navWallet: "Wallet",
    navChat: "Chat",
    navProfile: "Profile",
    navLogs: "Logs",
    navSettings: "Settings",
    navFAQ: "FAQ",
    
    // AUTHENTICATION
    login: "🔐 Login",
    logout: "🚪 Logout",
    loginTitle: "Login / Sign Up",
    emailPlaceholder: "Your email",
    passwordPlaceholder: "Password",
    loginBtn: "Login",
    registerBtn: "Sign Up",
    googleLoginText: "Continue with Google",
    orText: "or",
    
    // HOME PAGE / NODE
    home: "Home",
    nodeControl: "Node Control",
    connect: "CONNECT",
    disconnect: "DISCONNECT",
    statusDisconnected: "Disconnected",
    statusConnecting: "Connecting...",
    statusConnected: "Connected",
    statusError: "Connection Error",
    
    // Node Stats
    peers: "Peers",
    blocks: "Blocks",
    balance: "Balance",
    relays: "Relays",
    rewardBlock: "⛏️ Reward/Block",
    supply: "📊 Supply",
    
    // Proof of Relay
    proofOfRelayStatus: "PoR Mining Status",
    requiredRelays: "Required Relays",
    readyToMine: "✅ Ready to mine!",
    accumulatingProofs: "⏳ Accumulating relay proofs...",
    creditsCost: "Credits (cost 50):",
    relayScore: "Relay Score:",
    scoreBonus: "Score Bonus:",
    dailyEmission: "Daily Emission:",
    roundRobin: "Round-Robin:",
    waiting: "Waiting",
    readyWaitingTurn: "✅ Ready — waiting for turn",
    mining: "⛏️ Mining...",

    // Graph
    bigPointsGraphTitle: "BIG Earned",
    bigEarned: "BIG Earned",
    bigPerDay: "BIG/day",
    
    // History
    bigHistory: "BIG History",
    noTransactionsYet: "No transactions yet",
    
    // WALLET
    wallet: "Wallet",
    totalBalance: "Total Balance",
    availableBalance: "Available Balance",
    pending: "Pending",
    send: "Send",
    receive: "Receive",
    history: "History",
    walletInformation: "Wallet Information",
    address: "Address",
    privateKey: "Private Key",
    neverSharePrivateKey: "⚠️ Never share your private key!",
    created: "Created",
    sendBig: "Send BIG",
    recipientAddress: "Recipient Address",
    amount: "Amount",
    networkFee: "Network Fee",
    total: "Total",
    maxButton: "MAX",
    invalidAddress: "Invalid address",
    insufficientBalance: "Insufficient balance",
    sendConfirm: "Confirm Send",
    receiveBig: "Receive BIG",
    yourAddress: "Your Address",
    copyAddress: "Copy Address",
    addressCopied: "✅ Address copied!",
    onlySendBig: "⚠️ Only send BIG to this address",
    transactionHistory: "Transaction History",
    allTransactions: "All",
    sentTransactions: "Sent",
    receivedTransactions: "Received",
    sent: "Sent",
    received: "Received",
    noTransactions: "No transactions yet",
    transactionsWillAppear: "Your transactions will appear here",
    
    // CHAT
    chat: "Chat",
    chatWelcome: "Welcome to BIG community chat!",
    chatDisclaimer: "Keep it respectful and follow best practices.",
    chatPlaceholder: "Type your message...",
    chatSend: "Send",
    chatError: "Error sending message. Please try again.",
    loginRequired: "Please login to send messages.",
    chatYou: "you",
    chatDeleteConfirm: "Delete this message?",
    chatDeleteError: "Error deleting message.",
    chatDeleteSuccess: "Message deleted!",
    
    // PROFILE
    profile: "Profile",
    profileTitle: "My Profile",
    chatProfileTitle: "Chat Profile",
    yourAvatar: "Your Avatar",
    uploadHint: "PNG, JPG or GIF - Max. 2 MB",
    chooseAvatar: "Choose Avatar",
    dragOrClick: "Click or drag an image",
    removeAvatar: "Remove",
    chatNickname: "Chat Nickname",
    nicknamePlaceholder: "Enter your nickname",
    saveProfile: "Save Profile",
    avatarLoaded: "Avatar loaded",
    invalidFormat: "Invalid format. Use PNG, JPG or GIF",
    fileTooLarge: "File too large. Maximum: 2 MB",
    imageTooLarge: "Image too large. Use a smaller resolution.",
    avatarTooLarge: "Avatar too large. Reduce file size.",
    errorLoadingImage: "Error loading image",
    loginFirst: "Please login first",
    nicknameMin: "Nickname must be at least 3 characters",
    chooseAvatarFirst: "Choose an avatar before saving",
    saving: "Saving...",
    saved: "✅ Saved!",
    errorSavingProfile: "Error saving profile",
    
    // SETTINGS
    settings: "Settings",
    settingsTitle: "Settings",
    generalSettings: "General Settings",
    language: "Language",
    darkMode: "Dark Mode",
    
    // LOGS
    logsTitle: "📋 BIGchain Node Output",
    logsAutoScroll: " Auto-scroll",
    logsClear: "Clear",
    logsEmpty: "No logs yet — connect the node to see output here.",
    logTypeBlock: "⛏️ Block",
    logTypeRelay: "📡 Relay",
    logTypePeer: "🔗 Peer",
    logTypeWallet: "💰 Wallet",
    logTypeSync: "🔄 Sync",
    logTypeMining: "⛏️ Mining",
    logTypeRegistered: "📤 Registered",
    logTypeWarning: "⚠️ Warning",
    logTypeError: "❌ Error",
    
    // GENERAL MESSAGES
    loading: "Loading...",
    error: "Error",
    success: "Success",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    finish: "Finish",
    syncing: "Syncing",
    confirmLogoutMessage: "Are you sure you want to log out?\n\nYour data will be saved automatically.",
    connectionRestored: "Connection restored!",
    loginFirstToConnect: "Log in first.",
  }
};

let _currentLang = 'en';

export function getCurrentLang() {
  return _currentLang;
}

export async function initializeLanguage() {
  if (window.electronAPI?.getLanguage) {
    try {
      const savedLang = await window.electronAPI.getLanguage();
      if (translations[savedLang]) {
        _currentLang = savedLang;
      }
    } catch (error) {
      const stored = localStorage.getItem('bigfootLang');
      if (translations[stored]) {
        _currentLang = stored;
      }
    }
  } else {
    const stored = localStorage.getItem('bigfootLang');
    if (translations[stored]) {
      _currentLang = stored;
    }
  }

  const htmlElement = document.documentElement;
  if (htmlElement) {
    const langMap = { pt: 'pt-BR', en: 'en-US' };
    htmlElement.lang = langMap[_currentLang] || 'en-US';
  }

  return _currentLang;
}

export async function setLanguage(lang) {
  if (!translations[lang]) {
    lang = 'en';
  }

  _currentLang = lang;
  localStorage.setItem('bigfootLang', lang);

  if (window.electronAPI?.saveLanguage) {
    try {
      await window.electronAPI.saveLanguage(lang);
    } catch (error) {
      // localStorage já garante a persistência mínima
    }
  }

  const htmlElement = document.documentElement;
  if (htmlElement) {
    const langMap = { pt: 'pt-BR', en: 'en-US' };
    htmlElement.lang = langMap[lang] || 'en-US';
  }

  return _currentLang;
}

export function t(key, lang = _currentLang) {
  const translation = translations[lang];
  if (translation && translation[key]) {
    return translation[key];
  }
  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }
  return key;
}