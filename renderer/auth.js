let auth, db;

export function initializeFirebase() {
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

  auth = firebase.auth();
  db = firebase.firestore();

  console.log('Firebase inicializado:', firebase.apps[0].name);
  return { auth, db };
}

export function setupAuth(auth, updateText, carregarUsoDiario, toggleModal) {
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      console.log('Persistência LOCAL configurada');
      auth.onAuthStateChanged(async (user) => {
        console.log(user ? `Logado: ${user.email}` : 'Deslogado');
        window.isLoggedIn = !!user;
        
        // Gerencia token quando estado de auth muda
        if (user) {
          // CRÍTICO: Envia email para main process PRIMEIRO
          if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(user.email);
            console.log('[AUTH] Email enviado para main process via onAuthStateChanged:', user.email);
          }
          
          // Usuário logado - obtém token e envia para main
          user.getIdToken(true).then(token => {
            window.firebaseIdToken = token;
            if (window.electronAPI?.storeFirebaseToken) {
              window.electronAPI.storeFirebaseToken(token);
            }
            console.log('[AUTH] Token armazenado após mudança de estado auth');
          }).catch(error => {
            console.error('[AUTH] Erro ao obter token após mudança de estado:', error);
          });
        } else {
          // Usuário deslogado - limpa dados
          if (window.electronAPI?.storeEmail) {
            await window.electronAPI.storeEmail(null);
            console.log('[AUTH] Email limpo do main process');
          }
          
          window.firebaseIdToken = null;
          if (window.electronAPI?.storeFirebaseToken) {
            window.electronAPI.storeFirebaseToken('NO_USER');
          }
          console.log('[AUTH] Token limpo após logout');
        }
        
        updateText();
        if (user) carregarUsoDiario();
      });
    })
    .catch(error => {
      console.error('Persistência falhou:', error.code, error.message);
    });
}

export function handleLogin(event, currentLang, toggleModal, updateText) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const email = document.getElementById('userEmail')?.value.trim();
  const password = document.getElementById('userPassword')?.value;

  if (!email || !password) {
    alert(currentLang === 'pt' ? 'Preencha o e-mail e a senha.' : 'Please fill in email and password.');
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(async (userCredential) => {
      console.log('Login realizado:', userCredential.user.email);
      window.isLoggedIn = true;
      toggleModal('loginModal');

      // CRÍTICO: Envia email IMEDIATAMENTE após login
      if (window.electronAPI?.storeEmail) {
        try {
          await window.electronAPI.storeEmail(userCredential.user.email);
          console.log('[AUTH] Email enviado para main process após login:', userCredential.user.email);
        } catch (emailError) {
          console.error('[AUTH] Erro ao enviar email para main process:', emailError);
        }
      }

      // Obtém token após email
      try {
        const token = await userCredential.user.getIdToken();
        window.firebaseIdToken = token;
        
        if (window.electronAPI?.storeFirebaseToken) {
          window.electronAPI.storeFirebaseToken(token);
        }
        console.log('[AUTH] Token obtido e armazenado após login');
      } catch (tokenError) {
        console.error('[AUTH] Erro ao obter token após login:', tokenError);
      }

      updateText();
    })
    .catch((error) => {
      console.error('Erro de login:', error.code, error.message);
      const messages = {
        'auth/invalid-email': currentLang === 'pt' ? 'E-mail inválido.' : 'Invalid email.',
        'auth/user-not-found': currentLang === 'pt' ? 'Usuário não encontrado.' : 'User not found.',
        'auth/wrong-password': currentLang === 'pt' ? 'Senha incorreta.' : 'Incorrect password.',
        'auth/too-many-requests': currentLang === 'pt' ? 'Muitas tentativas. Tente mais tarde.' : 'Too many attempts. Try again later.',
        'auth/network-request-failed': currentLang === 'pt' ? 'Erro de rede.' : 'Network error.',
        'auth/user-disabled': currentLang === 'pt' ? 'Conta desativada.' : 'Account disabled.',
        'auth/invalid-credential': currentLang === 'pt' ? 'Credenciais inválidas.' : 'Invalid credentials.'
      };
      alert(messages[error.code] || (currentLang === 'pt' ? 'Erro ao entrar.' : 'Login error.'));
    });
}

export function handleLogout(updateText) {
  auth.signOut()
    .then(async () => {
      console.log('Logout concluído');
      window.isLoggedIn = false;
      window.isMining = false;
      window.pktMined = 0;

      // Limpa email do main process
      if (window.electronAPI?.storeEmail) {
        try {
          await window.electronAPI.storeEmail(null);
          console.log('[AUTH] Email limpo do main process após logout');
        } catch (emailError) {
          console.error('[AUTH] Erro ao limpar email do main process:', emailError);
        }
      }

      // Limpa token Firebase
      window.firebaseIdToken = null;
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken('NO_USER');
      }
      console.log('[AUTH] Token limpo após logout');

      if (window.electronAPI?.toggleSharing) {
        window.electronAPI.toggleSharing(false);
      }

      updateText();
    })
    .catch((error) => {
      console.error('Erro no logout:', error.code, error.message);
      alert('Erro ao sair.');
    });
}

export async function handleRegister(currentLang, toggleModal, updateText) {
  const email = document.getElementById('userEmail')?.value.trim();
  const password = document.getElementById('userPassword')?.value;

  if (!email || !password) {
    alert(currentLang === 'pt' ? 'Preencha o e-mail e a senha.' : 'Please fill in email and password.');
    return;
  }

  if (!isValidEmail(email)) {
    alert(currentLang === 'pt' ? 'E-mail inválido.' : 'Invalid email.');
    return;
  }

  try {
    const result = await window.electronAPI?.registerUser(email, password);
    if (!result?.success) {
      alert(result?.message || (currentLang === 'pt' ? 'Erro ao cadastrar.' : 'Registration error.'));
      return;
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    console.log('Registro concluído:', email);

    window.isLoggedIn = true;
    toggleModal('loginModal');

    // CRÍTICO: Envia email IMEDIATAMENTE após registro
    if (window.electronAPI?.storeEmail) {
      try {
        await window.electronAPI.storeEmail(email);
        console.log('[AUTH] Email enviado para main process após registro:', email);
      } catch (emailError) {
        console.error('[AUTH] Erro ao enviar email para main process:', emailError);
      }
    }

    // Obtém token após registro bem-sucedido
    try {
      const token = await userCredential.user.getIdToken();
      window.firebaseIdToken = token;
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(token);
      }
      console.log('[AUTH] Token obtido e armazenado após registro');
    } catch (tokenError) {
      console.error('[AUTH] Erro ao obter token após registro:', tokenError);
    }

    updateText();
    alert(currentLang === 'pt' ? 'Cadastro realizado com sucesso!' : 'Registration successful!');
  } catch (error) {
    console.error('Erro ao registrar:', error.code, error.message);
    const messages = {
      'auth/email-already-in-use': currentLang === 'pt' ? 'E-mail já cadastrado.' : 'Email already in use.',
      'auth/invalid-email': currentLang === 'pt' ? 'E-mail inválido.' : 'Invalid email.',
      'auth/weak-password': currentLang === 'pt' ? 'Senha fraca (mínimo 6 caracteres).' : 'Weak password (minimum 6 characters).',
      'auth/network-request-failed': currentLang === 'pt' ? 'Erro de rede.' : 'Network error.',
      'auth/operation-not-allowed': currentLang === 'pt' ? 'Operação não permitida.' : 'Operation not allowed.'
    };
    alert(messages[error.code] || (currentLang === 'pt' ? 'Erro ao cadastrar.' : 'Registration error.'));
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

// Obter token atual do usuário
export async function getCurrentUserToken() {
  const user = auth.currentUser;
  if (!user) {
    console.log('[AUTH] getCurrentUserToken: Nenhum usuário logado');
    return null;
  }

  try {
    const token = await user.getIdToken(true); // Force refresh
    window.firebaseIdToken = token;
    console.log('[AUTH] Token atual obtido');
    return token;
  } catch (error) {
    console.error('[AUTH] Erro ao obter token atual:', error);
    return null;
  }
}

// Verificar se token precisa ser renovado
export async function checkTokenExpiry() {
  const user = auth.currentUser;
  if (!user) {
    console.log('[AUTH] checkTokenExpiry: Nenhum usuário logado');
    return false;
  }

  try {
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expirationTime - currentTime;
    
    // Renova se expira em menos de 5 minutos
    const shouldRenew = timeUntilExpiry < (5 * 60 * 1000);
    
    if (shouldRenew) {
      console.log('[AUTH] Token próximo do vencimento, renovando...');
      const newToken = await user.getIdToken(true);
      window.firebaseIdToken = newToken;
      
      if (window.electronAPI?.storeFirebaseToken) {
        window.electronAPI.storeFirebaseToken(newToken);
      }
      console.log('[AUTH] Token renovado automaticamente');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[AUTH] Erro ao verificar expiração do token:', error);
    return false;
  }
}

// Setup para renovação automática de token
export function setupAutomaticTokenRenewal() {
  console.log('[AUTH] Configurando renovação automática de token...');
  
  // Verifica token a cada 50 minutos
  setInterval(async () => {
    if (window.isLoggedIn && auth.currentUser) {
      try {
        await checkTokenExpiry();
      } catch (error) {
        console.error('[AUTH] Erro na renovação automática:', error);
      }
    }
  }, 50 * 60 * 1000); // 50 minutos
}