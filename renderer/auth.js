import { translations, getCurrentLang } from './i18n.js';

let auth = null;
let db = null;
let isFirebaseInitialized = false;
let tokenRenewalInterval = null; // ← armazena referência para o intervalo de renovação

// ==========================================
// INICIALIZAR FIREBASE
// ==========================================
export async function initializeFirebase() {
  
  if (isFirebaseInitialized && auth && db) {
    return { auth, db };
  }

  if (typeof firebase === 'undefined') {
    console.error('[FIREBASE] ❌ Firebase SDK não carregado!');
    return { auth: null, db: null };
  }

  try {
    const firebaseConfig = await window.electronAPI?.getFirebaseConfig?.();
    
    if (!firebaseConfig?.apiKey) {
      console.error('[FIREBASE] Config vazia recebida:', firebaseConfig);
      throw new Error('Firebase config não encontrada via contextBridge.');
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    isFirebaseInitialized = true;
    console.log('[FIREBASE] ✅ Inicializado com sucesso!');
    
    return { auth, db };

  } catch (error) {
    console.error('[FIREBASE] ❌ Erro ao inicializar Firebase:', error.message);
    isFirebaseInitialized = false;
    return { auth: null, db: null };
  }
}

// ==========================================
// SETUP AUTH
// ==========================================
export async function setupAuth() {
  const result = await initializeFirebase();
  
  if (!result?.auth || !result?.db) {
    console.error('[AUTH] ❌ Falha ao inicializar Firebase');
    return { auth: null, db: null };
  }

  auth = result.auth;
  db = result.db;

  try {
    // Configura persistência
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Configura listener de autenticação
    auth.onAuthStateChanged(async (user) => {
      window.isLoggedIn = !!user;
      
      if (user) {
        if (window.electronAPI?.storeEmail) {
          try {
            await window.electronAPI.storeEmail(user.email);
          } catch (emailError) {
            console.error('[AUTH] ❌ Erro ao enviar email:', emailError);
          }
        }
        
        try {
          const token = await user.getIdToken(true);
          if (window.electronAPI?.storeFirebaseToken) {
            window.electronAPI.storeFirebaseToken(token);
          }
        } catch (tokenError) {
          console.error('[AUTH] ❌ Erro ao obter token:', tokenError);
        }
      } else {
        if (window.electronAPI?.storeEmail) {
          try {
            await window.electronAPI.storeEmail(null);
          } catch (emailError) {
            console.error('[AUTH] ❌ Erro ao limpar email:', emailError);
          }
        }
        if (window.electronAPI?.storeFirebaseToken) {
          window.electronAPI.storeFirebaseToken('NO_USER');
        }
      }
      
      if (typeof updateText === 'function') {
        updateText();
      }
    });
    return { auth, db };

  } catch (error) {
    console.error('[AUTH] ❌ Erro ao configurar autenticação:', error.message);
    return { auth: null, db: null };
  }
}

// ==========================================
// HANDLE LOGIN
// ==========================================
export async function handleLogin(event, lang, toggleModal, updateText) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const email = document.getElementById('userEmail')?.value.trim();
  const password = document.getElementById('userPassword')?.value;
  const errorElement = document.getElementById('loginError');

  if (!email || !password) {
    const msg = lang === 'pt' ? 'Preencha o e-mail e a senha.' : 'Please fill in email and password.';
    showLoginError(msg);
    return;
  }

  // Limpa mensagem de erro anterior
  if (errorElement) {
    errorElement.style.display = 'none';
  }

  if (!auth) {
    console.error('[AUTH] ❌ Auth não inicializado');
    showLoginError('Authentication system not ready. Please refresh the page.');
    return;
  }

  try {
    // 🔐 Log com e-mail mascarado
    console.log('[AUTH] 📧 Fazendo login com:', maskEmail(email));
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    
    window.isLoggedIn = true;
    toggleModal('loginModal');

    // CRÍTICO: Envia email IMEDIATAMENTE após login
    if (window.electronAPI?.storeEmail) {
      try {
        await window.electronAPI.storeEmail(userCredential.user.email);
      } catch (emailError) {
        console.error('[AUTH] ❌ Erro ao enviar email:', emailError);
      }
    }

    // Obtém token após email
    try {
      const token = await userCredential.user.getIdToken();
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(token);
      }
    } catch (tokenError) {
      console.error('[AUTH] ❌ Erro ao obter token:', tokenError);
    }

    updateText();
    
  } catch (error) {
    console.error('[AUTH] Erro de autenticação.');
    
    const messages = {
      'auth/invalid-email': lang === 'pt' ? 'E-mail inválido.' : 'Invalid email.',
      'auth/user-not-found': lang === 'pt' ? 'Usuário não encontrado.' : 'User not found.',
      'auth/wrong-password': lang === 'pt' ? 'Senha incorreta.' : 'Incorrect password.',
      'auth/too-many-requests': lang === 'pt' ? 'Muitas tentativas. Tente mais tarde.' : 'Too many attempts. Try again later.',
      'auth/network-request-failed': lang === 'pt' ? 'Erro de rede.' : 'Network error.',
      'auth/user-disabled': lang === 'pt' ? 'Conta desativada.' : 'Account disabled.',
      'auth/invalid-credential': lang === 'pt' ? 'Credenciais inválidas.' : 'Invalid credentials.'
    };
    
    showLoginError(messages[error.code] || (lang === 'pt' ? 'Erro ao entrar.' : 'Login error.'));
  }
}

// ==========================================
// HANDLE GOOGLE LOGIN
// ==========================================
export async function handleGoogleLogin(lang, toggleModal, updateText) {
  
  if (!auth) {
    console.error('[AUTH] ❌ Auth não inicializado');
    showLoginError('Authentication system not ready. Please refresh the page.');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    const result = await auth.signInWithPopup(provider);
    
    // 🔐 Log com e-mail mascarado
    console.log('[AUTH] 📧 Login Google bem-sucedido para:', maskEmail(result.user.email));
    
    window.isLoggedIn = true;
    toggleModal('loginModal');

    // CRÍTICO: Envia email IMEDIATAMENTE após login
    if (window.electronAPI?.storeEmail) {
      try {
        await window.electronAPI.storeEmail(result.user.email);
      } catch (emailError) {
        console.error('[AUTH] ❌ Erro ao enviar email:', emailError);
      }
    }

    // Obtém token após email
    try {
      const token = await result.user.getIdToken();
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(token);
      }
    } catch (tokenError) {
      console.error('[AUTH] ❌ Erro ao obter token:', tokenError);
    }

    updateText();
    
    // Se for primeiro login com Google, pode registrar no backend
    // (o backend deve tratar password como opcional para login Google)
    if (result.additionalUserInfo?.isNewUser) {
      if (window.electronAPI?.registerUser) {
        await window.electronAPI.registerUser(result.user.email, null);
      }
    }
    
  } catch (error) {
    console.error('[AUTH] Erro de autenticação.');
    
    const messages = {
      'auth/popup-closed-by-user': lang === 'pt' ? 'Login cancelado.' : 'Login cancelled.',
      'auth/popup-blocked': lang === 'pt' ? 'Popup bloqueado. Permita popups para este site.' : 'Popup blocked. Please allow popups.',
      'auth/cancelled-popup-request': lang === 'pt' ? 'Requisição cancelada.' : 'Request cancelled.',
      'auth/network-request-failed': lang === 'pt' ? 'Erro de rede.' : 'Network error.',
      'auth/account-exists-with-different-credential': lang === 'pt' 
        ? 'Esta conta já existe com outro método de login.' 
        : 'Account exists with different sign-in method.',
      'auth/operation-not-allowed': lang === 'pt' 
        ? 'Login com Google não está habilitado.' 
        : 'Google sign-in not enabled.'
    };
    
    if (error.code !== 'auth/popup-closed-by-user') {
      showLoginError(messages[error.code] || (lang === 'pt' ? 'Erro ao entrar com Google.' : 'Google login error.'));
    }
  }
}

// ==========================================
// HANDLE LOGOUT
// ==========================================
export async function handleLogout(updateText) {
  
  if (!auth) {
    console.error('[AUTH] ❌ Auth não inicializado');
    return;
  }

  try {
    // 1. Cancela o intervalo de renovação de token
    if (tokenRenewalInterval) {
      clearInterval(tokenRenewalInterval);
      tokenRenewalInterval = null;
      console.log('[AUTH] 🔄 Renovação automática de token interrompida');
    }

    // 2. Faz logout do Firebase
    await auth.signOut();
    
    window.isLoggedIn = false;
    window.isMining = false;

    // 3. Limpa email do main process
    if (window.electronAPI?.storeEmail) {
      try {
        await window.electronAPI.storeEmail(null);
      } catch (emailError) {
        console.error('[AUTH] ❌ Erro ao limpar email:', emailError);
      }
    }

    // 4. Limpa token Firebase
    if (window.electronAPI?.storeFirebaseToken) {
      window.electronAPI.storeFirebaseToken('NO_USER');
    }

    // 5. Para o node se estiver rodando
    if (window.electronAPI?.toggleNode) {
      await window.electronAPI.toggleNode(false);
    }

    updateText();
    
    // 6. Chama o IPC para fazer logout completo
    if (window.electronAPI?.logoutRequested) {
      try {
        const result = await window.electronAPI.logoutRequested();
        console.log('[AUTH] ✅ Logout completo:', result);
      } catch (error) {
        console.error('[AUTH] ❌ Erro ao chamar IPC logout:', error);
        window.location.reload();
      }
    } else {
      console.warn('[AUTH] ⚠️ electronAPI.logoutRequested não disponível, recarregando...');
      window.location.reload();
    }
    
  } catch (error) {
    console.error('[AUTH] Erro de autenticação.');
    showLoginError('Erro ao sair.');
  }
}

// ==========================================
// HANDLE REGISTER
// ==========================================
export async function handleRegister(lang, toggleModal, updateText) {
  
  const email = document.getElementById('userEmail')?.value.trim();
  const password = document.getElementById('userPassword')?.value;

  if (!email || !password) {
    showLoginError(lang === 'pt' ? 'Preencha o e-mail e a senha.' : 'Please fill in email and password.');
    return;
  }

  if (!isValidEmail(email)) {
    showLoginError(lang === 'pt' ? 'E-mail inválido.' : 'Invalid email.');
    return;
  }

  // 🔐 Validação de senha forte
  if (!isStrongPassword(password)) {
    showLoginError(lang === 'pt' 
      ? 'Senha fraca. Use no mínimo 8 caracteres, incluindo letras e números.' 
      : 'Weak password. Use at least 8 characters, including letters and numbers.');
    return;
  }

  if (!auth) {
    console.error('[AUTH] ❌ Auth não inicializado');
    showLoginError('Authentication system not ready. Please refresh the page.');
    return;
  }

  try {
    // Registra no backend primeiro (se existir)
    if (window.electronAPI?.registerUser) {
      const result = await window.electronAPI.registerUser(email, password);
      if (!result?.success) {
        showLoginError(result?.message || (lang === 'pt' ? 'Erro ao cadastrar.' : 'Registration error.'));
        return;
      }
    }

    // 🔐 Log com e-mail mascarado
    console.log('[AUTH] 📧 Criando conta com:', maskEmail(email));
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);

    window.isLoggedIn = true;
    toggleModal('loginModal');

    // CRÍTICO: Envia email IMEDIATAMENTE após registro
    if (window.electronAPI?.storeEmail) {
      try {
        await window.electronAPI.storeEmail(email);
      } catch (emailError) {
        console.error('[AUTH] ❌ Erro ao enviar email:', emailError);
      }
    }

    // Obtém token após registro bem-sucedido
    try {
      const token = await userCredential.user.getIdToken();
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(token);
      }
    } catch (tokenError) {
      console.error('[AUTH] ❌ Erro ao obter token:', tokenError);
    }

    updateText();
    showLoginError(lang === 'pt' ? '✅ Cadastro realizado com sucesso!' : '✅ Registration successful!');
    
  } catch (error) {
    console.error('[AUTH] Erro de autenticação.');
    
    const messages = {
      'auth/email-already-in-use': lang === 'pt' ? 'E-mail já cadastrado.' : 'Email already in use.',
      'auth/invalid-email': lang === 'pt' ? 'E-mail inválido.' : 'Invalid email.',
      'auth/weak-password': lang === 'pt' ? 'Senha fraca (mínimo 6 caracteres).' : 'Weak password (minimum 6 characters).',
      'auth/network-request-failed': lang === 'pt' ? 'Erro de rede.' : 'Network error.',
      'auth/operation-not-allowed': lang === 'pt' ? 'Operação não permitida.' : 'Operation not allowed.'
    };
    
    showLoginError(messages[error.code] || (lang === 'pt' ? 'Erro ao cadastrar.' : 'Registration error.'));
  }
}

// ==========================================
// RENOVAÇÃO AUTOMÁTICA DE TOKEN
// ==========================================
export function setupAutomaticTokenRenewal() {
  
  if (!auth) {
    console.error('[AUTH] ❌ Auth não inicializado');
    return;
  }

  // Cancela qualquer intervalo anterior
  if (tokenRenewalInterval) {
    clearInterval(tokenRenewalInterval);
  }

  // Verifica token a cada 50 minutos
  tokenRenewalInterval = setInterval(async () => {
    if (window.isLoggedIn && auth.currentUser) {
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult();
        const expirationTime = new Date(tokenResult.expirationTime).getTime();
        const currentTime = new Date().getTime();
        const timeUntilExpiry = expirationTime - currentTime;
        
        // Renova se expira em menos de 5 minutos
        if (timeUntilExpiry < (5 * 60 * 1000)) {
          const newToken = await auth.currentUser.getIdToken(true);
          
          if (window.electronAPI?.storeFirebaseToken) {
            window.electronAPI.storeFirebaseToken(newToken);
          }
        }
      } catch (error) {
        console.error('[AUTH] ❌ Erro na renovação automática:', error);
      }
    }
  }, 50 * 60 * 1000); // 50 minutos

  console.log('[AUTH] 🔄 Renovação automática de token configurada');
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function showLoginError(message) {
  const errorElement = document.getElementById('loginError');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

function isStrongPassword(password) {
  // Mínimo 8 caracteres, pelo menos 1 letra e 1 número
  return typeof password === 'string' && password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Mascara e‑mail para exibição segura em logs.
 * Exemplo: "fabricio@gmail.com" → "fa***@gmail.com"
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'e-mail inválido';
  return email.replace(/(.{2}).*(@.*)/, '$1***$2');
}

// Obter token atual do usuário
export async function getCurrentUserToken() {
  if (!auth || !auth.currentUser) {
    return null;
  }

  try {
    const token = await auth.currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error('[AUTH] Erro ao obter token atual:', error);
    return null;
  }
}

// Verificar se token precisa ser renovado
export async function checkTokenExpiry() {
  if (!auth || !auth.currentUser) {
    return false;
  }

  try {
    const tokenResult = await auth.currentUser.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expirationTime - currentTime;
    
    // Renova se expira em menos de 5 minutos
    const shouldRenew = timeUntilExpiry < (5 * 60 * 1000);
    
    if (shouldRenew) {
      const newToken = await auth.currentUser.getIdToken(true);
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(newToken);
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[AUTH] Erro ao verificar expiração do token:', error);
    return false;
  }
}

// Getters
export function getAuth() {
  return auth;
}

export function getDb() {
  return db;
}

export function isInitialized() {
  return isFirebaseInitialized;
}