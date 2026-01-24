// ==========================================
// BIGFOOT Connect - Login Script
// ==========================================

// ==========================================
// SISTEMA DE TRADUÇÃO (i18n)
// ==========================================
const translations = {
  en: {
    welcomeBack: 'Welcome back!',
    welcomeSubtitle: 'Sign in to continue your journey',
    createAccount: 'Create your account',
    createSubtitle: 'Join the BIGFOOT community',
    email: 'Email',
    password: 'Password',
    emailPlaceholder: 'your@email.com',
    passwordPlaceholder: '••••••••',
    signIn: 'Sign In',
    register: 'Register',
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    createAccountLink: 'Create account',
    signInLink: 'Sign in',
    brandingText1: 'Share resources and earn rewards',
    brandingText2: 'Join the BIGFOOT community',
    fillAllFields: 'Please fill in all fields.',
    passwordMinLength: 'Password must be at least 6 characters',
    invalidEmail: 'Invalid email.',
    userNotFound: 'User not found. Please sign up first.',
    wrongPassword: 'Incorrect password.',
    tooManyRequests: 'Too many attempts. Try again later.',
    invalidCredential: 'Invalid credentials. Check email and password.',
    userDisabled: 'This account has been disabled.',
    emailInUse: 'Email already registered. Please sign in.',
    weakPassword: 'Weak password. Use at least 6 characters.',
    operationNotAllowed: 'Registration disabled. Contact support.',
    popupClosed: 'Login canceled.',
    popupBlocked: 'Popup blocked. Allow popups for this site.',
    accountExists: 'This account already exists with another login method.',
    cancelledPopup: 'Only one popup can be open at a time.',
    errorGoogleLogin: 'Error signing in with Google.',
    errorLogin: 'Error signing in. Try again.',
    errorRegister: 'Error registering. Try again.'
  },
  pt: {
    welcomeBack: 'Bem-vindo de volta!',
    welcomeSubtitle: 'Entre para continuar sua jornada',
    createAccount: 'Criar sua conta',
    createSubtitle: 'Junte-se à comunidade BIGFOOT',
    email: 'Email',
    password: 'Senha',
    emailPlaceholder: 'seu@email.com',
    passwordPlaceholder: '••••••••',
    signIn: 'Entrar',
    register: 'Cadastrar',
    continueWithGoogle: 'Continuar com Google',
    or: 'ou',
    noAccount: 'Não tem uma conta?',
    haveAccount: 'Já tem uma conta?',
    createAccountLink: 'Criar conta',
    signInLink: 'Fazer login',
    brandingText1: 'Compartilhe recursos e ganhe recompensas',
    brandingText2: 'Junte-se à comunidade BIGFOOT',
    fillAllFields: 'Por favor, preencha todos os campos.',
    passwordMinLength: 'A senha deve ter pelo menos 6 caracteres',
    invalidEmail: 'E-mail inválido.',
    userNotFound: 'Usuário não encontrado. Cadastre-se primeiro.',
    wrongPassword: 'Senha incorreta.',
    tooManyRequests: 'Muitas tentativas. Tente mais tarde.',
    invalidCredential: 'Credenciais inválidas. Verifique email e senha.',
    userDisabled: 'Esta conta foi desativada.',
    emailInUse: 'E-mail já cadastrado. Faça login.',
    weakPassword: 'Senha fraca. Use pelo menos 6 caracteres.',
    operationNotAllowed: 'Cadastro desabilitado. Contate o suporte.',
    popupClosed: 'Login cancelado.',
    popupBlocked: 'Popup bloqueado. Permita popups para este site.',
    accountExists: 'Esta conta já existe com outro método de login.',
    cancelledPopup: 'Apenas um popup pode estar aberto por vez.',
    errorGoogleLogin: 'Erro ao entrar com Google.',
    errorLogin: 'Erro ao entrar. Tente novamente.',
    errorRegister: 'Erro ao cadastrar. Tente novamente.'
  }
};

let currentLang = 'en';
let isLoginMode = true;

// ==========================================
// PARTÍCULAS ANIMADAS
// ==========================================
const particlesContainer = document.getElementById('particles');
if (particlesContainer) {
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAhziJbG5Pxg0UYvq784YH4zXpsdKfh7AY",
    authDomain: "bigfoot-connect.firebaseapp.com",
    projectId: "bigfoot-connect",
    storageBucket: "bigfoot-connect.appspot.com",
    messagingSenderId: "177999879162",
    appId: "1:177999879162:web:a1ea739930cac97475e243"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

console.log('[LOGIN] Configurando persistência...');

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('[LOGIN] ✅ Persistência LOCAL configurada');
    })
    .catch((error) => {
        console.error('[LOGIN] Erro ao configurar persistência:', error);
    });

console.log('[LOGIN] Forçando logout de qualquer sessão anterior...');
auth.signOut().then(() => {
    console.log('[LOGIN] ✅ Sessão anterior encerrada - aguardando novo login');
}).catch((error) => {
    console.log('[LOGIN] Nenhuma sessão ativa para encerrar');
});

// ==========================================
// FUNÇÃO PARA ATUALIZAR IDIOMA
// ==========================================
function updatePageLanguage() {
  const t = translations[currentLang];
  
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const emailLabel = document.getElementById('emailLabel');
  const passwordLabel = document.getElementById('passwordLabel');
  const userEmail = document.getElementById('userEmail');
  const userPassword = document.getElementById('userPassword');
  const buttonText = document.getElementById('buttonText');
  const googleButtonText = document.getElementById('googleButtonText');
  const dividerText = document.getElementById('dividerText');
  const noAccountText = document.getElementById('noAccountText');
  const registerLink = document.getElementById('registerLink');
  const brandingText1 = document.getElementById('brandingText1');
  const brandingText2 = document.getElementById('brandingText2');
  
  if (authTitle) authTitle.textContent = isLoginMode ? t.welcomeBack : t.createAccount;
  if (authSubtitle) authSubtitle.textContent = isLoginMode ? t.welcomeSubtitle : t.createSubtitle;
  if (emailLabel) emailLabel.textContent = t.email;
  if (passwordLabel) passwordLabel.textContent = t.password;
  if (userEmail) userEmail.placeholder = t.emailPlaceholder;
  if (userPassword) userPassword.placeholder = t.passwordPlaceholder;
  if (buttonText) buttonText.textContent = isLoginMode ? t.signIn : t.register;
  if (googleButtonText) googleButtonText.textContent = t.continueWithGoogle;
  if (dividerText) dividerText.textContent = t.or;
  if (noAccountText) noAccountText.textContent = isLoginMode ? t.noAccount : t.haveAccount;
  if (registerLink) registerLink.textContent = isLoginMode ? t.createAccountLink : t.signInLink;
  if (brandingText1) brandingText1.textContent = t.brandingText1;
  if (brandingText2) brandingText2.textContent = t.brandingText2;
  
  const langBtn = document.querySelector('.lang-text');
  const flagIcon = document.querySelector('.lang-btn .flag-icon');
  if (langBtn && flagIcon) {
    if (currentLang === 'en') {
      langBtn.textContent = 'EN';
      flagIcon.textContent = '🇺🇸';
    } else {
      langBtn.textContent = 'PT';
      flagIcon.textContent = '🇧🇷';
    }
  }
  
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === currentLang);
  });
  
  document.documentElement.lang = currentLang;
}

// ==========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ==========================================
async function loginUser(email, password) {
    const t = translations[currentLang];
    
    try {
        console.log('[LOGIN] Tentando login para:', email);
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('[LOGIN] ✅ Login bem-sucedido:', user.email);
        
        const token = await user.getIdToken();
        console.log('[LOGIN] Token obtido');
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
            console.log('[LOGIN] Email armazenado no Electron');
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
            console.log('[LOGIN] Token armazenado no Electron');
        }
        
        if (window.electronAPI?.loginSuccess) {
            console.log('[LOGIN] Notificando Electron - abrindo app principal...');
            await window.electronAPI.loginSuccess(user.email);
        } else {
            console.error('[LOGIN] electronAPI.loginSuccess não disponível!');
            window.showError('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        console.error('[LOGIN] ❌ Erro:', error);
        
        const messages = {
            'auth/invalid-email': t.invalidEmail,
            'auth/user-not-found': t.userNotFound,
            'auth/wrong-password': t.wrongPassword,
            'auth/too-many-requests': t.tooManyRequests,
            'auth/invalid-credential': t.invalidCredential,
            'auth/user-disabled': t.userDisabled
        };
        
        window.showError(messages[error.code] || t.errorLogin);
        throw error;
    }
}

async function registerUser(email, password) {
    const t = translations[currentLang];
    
    try {
        console.log('[REGISTER] Iniciando cadastro para:', email);
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('[REGISTER] ✅ Conta Firebase criada:', user.email);
        
        if (window.electronAPI?.registerUser) {
            const result = await window.electronAPI.registerUser(email, password);
            if (!result?.success) {
                console.error('[REGISTER] Erro no backend:', result?.message);
            } else {
                console.log('[REGISTER] ✅ Registrado no backend');
            }
        }
        
        const token = await user.getIdToken();
        console.log('[REGISTER] Token obtido');
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
        }
        
        if (window.electronAPI?.loginSuccess) {
            console.log('[REGISTER] Abrindo app principal...');
            await window.electronAPI.loginSuccess(user.email);
        } else {
            console.error('[REGISTER] electronAPI.loginSuccess não disponível!');
            window.showError('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        console.error('[REGISTER] ❌ Erro:', error);
        
        const messages = {
            'auth/email-already-in-use': t.emailInUse,
            'auth/invalid-email': t.invalidEmail,
            'auth/weak-password': t.weakPassword,
            'auth/operation-not-allowed': t.operationNotAllowed
        };
        
        window.showError(messages[error.code] || t.errorRegister);
        throw error;
    }
}

async function loginWithGoogle() {
    const t = translations[currentLang];
    
    try {
        console.log('[GOOGLE] Iniciando login com Google...');
        
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        console.log('[GOOGLE] ✅ Login bem-sucedido:', user.email);
        
        const token = await user.getIdToken();
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
        }
        
        if (result.additionalUserInfo?.isNewUser && window.electronAPI?.registerUser) {
            console.log('[GOOGLE] Novo usuário - registrando no backend...');
            await window.electronAPI.registerUser(user.email, null);
        }
        
        if (window.electronAPI?.loginSuccess) {
            console.log('[GOOGLE] Abrindo app principal...');
            await window.electronAPI.loginSuccess(user.email);
        } else {
            console.error('[GOOGLE] electronAPI.loginSuccess não disponível!');
            window.showError('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        console.error('[GOOGLE] ❌ Erro:', error);
        
        const messages = {
            'auth/popup-closed-by-user': t.popupClosed,
            'auth/popup-blocked': t.popupBlocked,
            'auth/account-exists-with-different-credential': t.accountExists,
            'auth/cancelled-popup-request': t.cancelledPopup
        };
        
        window.showError(messages[error.code] || t.errorGoogleLogin);
        throw error;
    }
}

// ==========================================
// INICIALIZAÇÃO QUANDO DOM ESTIVER PRONTO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[LOGIN] DOM carregado - inicializando interface...');
  
  const authForm = document.getElementById('authForm');
  const emailInput = document.getElementById('userEmail');
  const passwordInput = document.getElementById('userPassword');
  const submitButton = document.getElementById('submitButton');
  const googleButton = document.getElementById('googleButton');
  const togglePassword = document.getElementById('togglePassword');
  const registerLink = document.getElementById('registerLink');
  const toggleModeBtn = document.getElementById('toggleMode');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  
  const langBtn = document.getElementById('langBtn');
  const langDropdown = document.getElementById('langDropdown');
  const langOptions = document.querySelectorAll('.lang-option');
  
  // Setup do seletor de idioma
  if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
      langDropdown.classList.remove('show');
    });
    
    langDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    langOptions.forEach(option => {
      option.addEventListener('click', () => {
        currentLang = option.dataset.lang;
        updatePageLanguage();
        langDropdown.classList.remove('show');
        console.log('[LANGUAGE] Changed to:', currentLang);
      });
    });
  }
  
  updatePageLanguage();
  
  // Toggle login/cadastro
  if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      updatePageLanguage();
      hideError();
    });
  }
  
  if (registerLink) {
    registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      updatePageLanguage();
      hideError();
    });
  }
  
  // Toggle mostrar/ocultar senha
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
  }
  
  // Submit do formulário
  if (authForm && emailInput && passwordInput) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const t = translations[currentLang];
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        showError(t.fillAllFields);
        return;
      }
      
      if (password.length < 6) {
        showError(t.passwordMinLength);
        return;
      }
      
      showLoading();
      
      try {
        if (isLoginMode) {
          await loginUser(email, password);
        } else {
          await registerUser(email, password);
        }
      } catch (error) {
        console.error('[AUTH] Erro:', error);
        hideLoading();
      }
    });
  }
  
  // Login com Google
  if (googleButton) {
    googleButton.addEventListener('click', async () => {
      showLoading();
      try {
        await loginWithGoogle();
      } catch (error) {
        console.error('[GOOGLE] Erro:', error);
        hideLoading();
      }
    });
  }
  
  // Limpa erro ao digitar
  [emailInput, passwordInput].forEach(input => {
    if (input) {
      input.addEventListener('input', hideError);
    }
  });
  
  // Funções auxiliares
  function showError(message) {
    if (errorText && errorMessage) {
      errorText.textContent = message;
      errorMessage.classList.add('show');
    }
  }

  function hideError() {
    if (errorMessage) {
      errorMessage.classList.remove('show');
    }
  }

  function showLoading() {
    if (submitButton) {
      submitButton.classList.add('loading');
      submitButton.innerHTML = '<div class="spinner"></div>';
    }
    if (googleButton) {
      googleButton.style.pointerEvents = 'none';
      googleButton.style.opacity = '0.6';
    }
    if (emailInput) emailInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
  }

  function hideLoading() {
    const t = translations[currentLang];
    if (submitButton) {
      submitButton.classList.remove('loading');
      submitButton.innerHTML = '<span>' + (isLoginMode ? t.signIn : t.register) + '</span>';
    }
    if (googleButton) {
      googleButton.style.pointerEvents = '';
      googleButton.style.opacity = '';
    }
    if (emailInput) emailInput.disabled = false;
    if (passwordInput) passwordInput.disabled = false;
  }
  
  // Expõe funções globalmente
  window.showError = showError;
  window.hideError = hideError;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  
  console.log('[LOGIN] ✅ Interface inicializada');
});

console.log('[LOGIN] ✅ Script carregado - pronto para autenticação');