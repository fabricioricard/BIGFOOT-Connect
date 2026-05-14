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
    brandingText1: 'Run a node and earn BIG',
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
    brandingText1: 'Rode um node e ganhe BIG',
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

// ==========================================
// LOGO FALLBACK — substitui onerror inline (violaria CSP)
// ==========================================
(function setupLogoFallback() {
    const logoImg = document.getElementById('logoImg');
    const svgLogo = document.getElementById('svgLogo');
    if (!logoImg || !svgLogo) return;
    logoImg.addEventListener('error', function() {
        logoImg.style.display = 'none';
        svgLogo.classList.add('logo-svg-visible');
    });
    logoImg.addEventListener('load', function() {
        svgLogo.style.display = 'none';
    });
})();

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
// CONFIGURAÇÃO DO FIREBASE — via contextBridge (IPC assíncrono)
// ==========================================
let auth = null;

async function initializeFirebaseFromConfig() {
    try {
        const firebaseConfig = await window.electronAPI?.getFirebaseConfig?.();

        if (!firebaseConfig?.apiKey) {
            showErrorStatic('Erro de configuração. Reinicie o aplicativo.');
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        auth = firebase.auth();
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
        await auth.signOut().catch(() => {});
        return true;
    } catch (e) {
        showErrorStatic('Erro de configuração. Reinicie o aplicativo.');
        return false;
    }
}

// Função auxiliar para exibir erro de forma segura (verifica existência dos elementos)
function showErrorStatic(message) {
    const errorText = document.getElementById('errorText');
    const errorMessage = document.getElementById('errorMessage');
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.classList.add('show');
}

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
// FUNÇÕES DE AUTENTICAÇÃO (SEM LOGS SENSÍVEIS)
// ==========================================
async function loginUser(email, password) {
    const t = translations[currentLang];
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const token = await user.getIdToken();
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
        }
        
        if (window.electronAPI?.loginSuccess) {
            await window.electronAPI.loginSuccess(user.email);
        } else {
            showErrorStatic('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        const messages = {
            'auth/invalid-email': t.invalidEmail,
            'auth/user-not-found': t.userNotFound,
            'auth/wrong-password': t.wrongPassword,
            'auth/too-many-requests': t.tooManyRequests,
            'auth/invalid-credential': t.invalidCredential,
            'auth/user-disabled': t.userDisabled
        };
        
        showErrorStatic(messages[error.code] || t.errorLogin);
        throw error;
    }
}

async function registerUser(email, password) {
    const t = translations[currentLang];
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        if (window.electronAPI?.registerUser) {
            await window.electronAPI.registerUser(email, password);
        }
        
        const token = await user.getIdToken();
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
        }
        
        if (window.electronAPI?.loginSuccess) {
            await window.electronAPI.loginSuccess(user.email);
        } else {
            showErrorStatic('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        const messages = {
            'auth/email-already-in-use': t.emailInUse,
            'auth/invalid-email': t.invalidEmail,
            'auth/weak-password': t.weakPassword,
            'auth/operation-not-allowed': t.operationNotAllowed
        };
        
        showErrorStatic(messages[error.code] || t.errorRegister);
        throw error;
    }
}

async function loginWithGoogle() {
    const t = translations[currentLang];
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        const token = await user.getIdToken();
        
        if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
        }
        
        if (window.electronAPI?.storeFirebaseToken) {
            await window.electronAPI.storeFirebaseToken(token);
        }
        
        if (result.additionalUserInfo?.isNewUser && window.electronAPI?.registerUser) {
            await window.electronAPI.registerUser(user.email, null);
        }
        
        if (window.electronAPI?.loginSuccess) {
            await window.electronAPI.loginSuccess(user.email);
        } else {
            showErrorStatic('Erro ao abrir aplicativo. Reinicie o app.');
        }
        
    } catch (error) {
        const messages = {
            'auth/popup-closed-by-user': t.popupClosed,
            'auth/popup-blocked': t.popupBlocked,
            'auth/account-exists-with-different-credential': t.accountExists,
            'auth/cancelled-popup-request': t.cancelledPopup
        };
        
        showErrorStatic(messages[error.code] || t.errorGoogleLogin);
        throw error;
    }
}

// ==========================================
// INICIALIZAÇÃO QUANDO DOM ESTIVER PRONTO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const firebaseReady = await initializeFirebaseFromConfig();
  if (!firebaseReady) return;

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
      const pwdInput = document.getElementById('userPassword');
      if (pwdInput) {
        pwdInput.autocomplete = isLoginMode ? 'current-password' : 'new-password';
      }
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
  
  // Funções auxiliares seguras
  function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.classList.add('show');
  }

  function hideError() {
    if (errorMessage) errorMessage.classList.remove('show');
  }

  function showLoading() {
    if (submitButton) {
      submitButton.classList.add('loading');
      submitButton.replaceChildren();
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      submitButton.appendChild(spinner);
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
      submitButton.replaceChildren();
      const btnSpan = document.createElement('span');
      btnSpan.textContent = isLoginMode ? t.signIn : t.register;
      submitButton.appendChild(btnSpan);
    }
    if (googleButton) {
      googleButton.style.pointerEvents = '';
      googleButton.style.opacity = '';
    }
    if (emailInput) emailInput.disabled = false;
    if (passwordInput) passwordInput.disabled = false;
  }
});

// ==========================================
// SISTEMA DE ATUALIZAÇÃO NA TELA DE LOGIN
// ==========================================
(function initLoginUpdateNotifications() {

  const container = document.createElement('div');
  container.id = 'update-notifications';
  document.body.appendChild(container);

  if (!window.electronAPI) return;

  function dismiss(card) {
    card.classList.remove('upd-visible');
    card.classList.add('upd-hiding');
    setTimeout(() => card.remove(), 500);
  }

  function showIn(card) {
    container.innerHTML = '';
    container.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('upd-visible')));
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function buildDownloadCard(version) {
    const card = el('div', 'upd-card');
    const body = el('div', 'upd-body');
    body.appendChild(el('div', 'upd-accent upd-accent-download'));
    body.appendChild(el('div', 'upd-icon-wrap upd-icon-dl', '⬇️'));
    const cnt = el('div', 'upd-content');
    cnt.appendChild(el('div', 'upd-label upd-label-dl', 'Downloading Update'));
    cnt.appendChild(el('div', 'upd-title', 'New Version'));
    const ver = el('div', 'upd-version');
    ver.textContent = 'v'; const strong = el('strong', '', version || '—'); ver.appendChild(strong);
    ver.appendChild(document.createTextNode(' is being fetched...'));
    cnt.appendChild(ver);
    const row = el('div', 'upd-progress-row');
    row.appendChild(el('span', 'upd-progress-label', 'Progress'));
    const pct = el('span', 'upd-progress-pct', '0%'); pct.id = 'updateProgressText';
    row.appendChild(pct); cnt.appendChild(row);
    const bar = el('div', 'upd-bar'); const fill = el('div', 'upd-bar-fill'); fill.id = 'updateProgressFill';
    bar.appendChild(fill); cnt.appendChild(bar);
    cnt.appendChild(el('div', 'upd-hint', 'Install button will appear when download completes.'));
    body.appendChild(cnt); card.appendChild(body);
    return card;
  }

  function buildReadyCard(version) {
    const card = el('div', 'upd-card upd-card-ready');
    const body = el('div', 'upd-body');
    body.appendChild(el('div', 'upd-accent'));
    const closeBtn = el('button', 'upd-close', '✕'); closeBtn.id = 'updCloseBtn'; body.appendChild(closeBtn);
    body.appendChild(el('div', 'upd-icon-wrap', '✅'));
    const cnt = el('div', 'upd-content');
    cnt.appendChild(el('div', 'upd-label', 'Update Ready'));
    cnt.appendChild(el('div', 'upd-title', 'Install Now'));
    const ver = el('div', 'upd-version');
    ver.textContent = 'v'; const strong = el('strong', '', version || '—'); ver.appendChild(strong);
    ver.appendChild(document.createTextNode(' downloaded & verified'));
    cnt.appendChild(ver);
    const btns = el('div', 'upd-buttons');
    const installBtn = el('button', 'upd-btn upd-btn-primary', '🚀 Install Now'); installBtn.id = 'installUpdateBtn';
    const laterBtn = el('button', 'upd-btn upd-btn-secondary', '⏰ Later'); laterBtn.id = 'postponeUpdateBtn';
    btns.appendChild(installBtn); btns.appendChild(laterBtn);
    cnt.appendChild(btns); body.appendChild(cnt); card.appendChild(body);
    return card;
  }

  function buildErrorCard(message) {
    const card = el('div', 'upd-card');
    const body = el('div', 'upd-body');
    body.appendChild(el('div', 'upd-accent upd-accent-error'));
    const closeBtn = el('button', 'upd-close', '✕'); closeBtn.id = 'updErrClose'; body.appendChild(closeBtn);
    body.appendChild(el('div', 'upd-icon-wrap upd-icon-err', '⚠️'));
    const cnt = el('div', 'upd-content');
    cnt.appendChild(el('div', 'upd-label upd-label-err', 'Update Failed'));
    cnt.appendChild(el('div', 'upd-title', 'Download Error'));
    const msg = el('div', 'upd-version', message ? message.slice(0, 70) : 'Could not download the update.');
    msg.classList.add('upd-version-error'); cnt.appendChild(msg);
    const dismissBtn = el('button', 'upd-btn upd-btn-secondary upd-btn-full', 'Dismiss'); dismissBtn.id = 'dismissErrorBtn';
    cnt.appendChild(dismissBtn); body.appendChild(cnt); card.appendChild(body);
    return card;
  }

  window.electronAPI.onUpdateNotification((data) => {
    if (data.type === 'available') {
      const card = buildDownloadCard(data.version);
      showIn(card);
    } else if (data.type === 'downloaded') {
      const card = buildReadyCard(data.version);
      showIn(card);
      card.querySelector('#installUpdateBtn').addEventListener('click', async function () {
        this.disabled = true;
        this.innerHTML = '<span class="upd-spin">⏳</span> Installing...';
        await window.electronAPI.installUpdate?.();
      });
      const later = async () => { await window.electronAPI.postponeUpdate?.(); dismiss(card); };
      card.querySelector('#postponeUpdateBtn').addEventListener('click', later);
      card.querySelector('#updCloseBtn').addEventListener('click', later);
    } else if (data.type === 'error') {
      const card = buildErrorCard(data.message);
      showIn(card);
      const d = () => dismiss(card);
      card.querySelector('#dismissErrorBtn').addEventListener('click', d);
      card.querySelector('#updErrClose').addEventListener('click', d);
      setTimeout(() => { if (card.parentNode) dismiss(card); }, 12000);
    }
  });

  if (window.electronAPI.onUpdateProgress) {
    window.electronAPI.onUpdateProgress((progress) => {
      const fill = document.getElementById('updateProgressFill');
      const text = document.getElementById('updateProgressText');
      const pct = Math.round(progress.percent || 0);
      if (fill) fill.style.width = `${pct}%`;
      if (text) text.textContent = `${pct}%`;
    });
  }
})();