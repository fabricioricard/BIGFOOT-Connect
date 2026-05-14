import { t, getCurrentLang } from './i18n.js';

let db = null;
let auth = null;
let authListenerSetup = false;
let isProfileRendering = false; // Prevenir renderizações concorrentes
let currentUserUid = null; // Cache do usuário atual

export function initializeProfile(firebaseAuth, firebaseDb) {
  console.log('[Profile] initializeProfile chamado', { auth: !!firebaseAuth, db: !!firebaseDb });
  
  // Validar que os parâmetros foram passados
  if (!firebaseAuth || !firebaseDb) {
    console.error('[Profile] ERRO: auth e db são obrigatórios', { auth: firebaseAuth, db: firebaseDb });
    return;
  }
  
  auth = firebaseAuth;
  db = firebaseDb;

  const profileSection = document.getElementById('page-profile');
  console.log('[Profile] profileSection encontrado?', !!profileSection);
  
  if (!profileSection) {
    console.error('[Profile] ERRO: elemento #page-profile não encontrado no DOM');
    return;
  }

  // Prevenir renderizações múltiplas
  if (isProfileRendering) return;
  
  // Verificar se o usuário mudou
  const user = auth?.currentUser;
  if (user && currentUserUid === user.uid && profileSection.hasChildNodes()) {
    // Já está renderizado para este usuário
    return;
  }

  // Configurar listener AUTH apenas uma vez
  if (!authListenerSetup) {
    authListenerSetup = true;
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        currentUserUid = user.uid;
        renderProfilePage();
        loadUserData(user);
      } else {
        showLoginRequired();
      }
    });
    // Salvar unsubscribe para cleanup posterior
    if (window.__profileAuthUnsubscribe) {
      window.__profileAuthUnsubscribe();
    }
    window.__profileAuthUnsubscribe = unsubscribe;
  }

  if (user) {
    currentUserUid = user.uid;
    renderProfilePage();
    loadUserData(user);
  } else {
    showLoginRequired();
  }
}

function showLoginRequired() {
  const profileSection = document.getElementById('page-profile');
  if (!profileSection) return;

  profileSection.replaceChildren();

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.setAttribute('data-i18n', 'profile');
  title.textContent = t('profile');

  const card = document.createElement('div');
  card.className = 'card profile-login-required';

  const msg = document.createElement('p');
  msg.className = 'profile-login-msg';
  msg.setAttribute('data-i18n', 'loginRequired');
  msg.textContent = t('loginRequired');

  const btn = document.createElement('button');
  btn.className = 'primary-button';
  btn.setAttribute('data-i18n', 'login');
  btn.textContent = t('login');
  btn.addEventListener('click', () => {
    document.getElementById('loginModalBtn')?.click();
  });

  card.appendChild(msg);
  card.appendChild(btn);
  profileSection.appendChild(title);
  profileSection.appendChild(card);
}

function renderProfilePage() {
  console.log('[Profile] renderProfilePage chamado');
  
  // Prevenir renderizações concorrentes
  if (isProfileRendering) {
    console.log('[Profile] Já está renderizando, abortando');
    return;
  }
  isProfileRendering = true;

  const profileSection = document.getElementById('page-profile');
  if (!profileSection) {
    isProfileRendering = false;
    return;
  }

  // Verificar se já está renderizado com o mesmo conteúdo
  const existingHeader = profileSection.querySelector('.card-header');
  if (existingHeader && existingHeader.textContent === t('chatProfileTitle')) {
    isProfileRendering = false;
    return;
  }

  profileSection.replaceChildren();

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.setAttribute('data-i18n', 'profile');
  title.textContent = t('profile');

  const card = document.createElement('div');
  card.className = 'card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';
  cardHeader.setAttribute('data-i18n', 'chatProfileTitle');
  cardHeader.textContent = t('chatProfileTitle');

  const profileSectionDiv = document.createElement('div');
  profileSectionDiv.className = 'profile-section';

  const avatarSelector = document.createElement('div');
  avatarSelector.className = 'avatar-selector';

  const nicknameSection = document.createElement('div');
  nicknameSection.className = 'nickname-section';

  const nickLabel = document.createElement('label');
  nickLabel.htmlFor = 'nicknameInput';
  nickLabel.className = 'form-label';
  nickLabel.setAttribute('data-i18n', 'chatNickname');
  nickLabel.textContent = t('chatNickname');

  const nickInput = document.createElement('input');
  nickInput.type = 'text';
  nickInput.id = 'nicknameInput';
  nickInput.maxLength = 20;
  nickInput.placeholder = t('nicknamePlaceholder');
  nickInput.setAttribute('data-i18n-placeholder', 'nicknamePlaceholder');

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary-button profile-save-btn';
  saveBtn.id = 'saveProfileBtn';
  saveBtn.setAttribute('data-i18n', 'saveProfile');
  saveBtn.textContent = t('saveProfile');

  nicknameSection.appendChild(nickLabel);
  nicknameSection.appendChild(nickInput);
  nicknameSection.appendChild(saveBtn);
  profileSectionDiv.appendChild(avatarSelector);
  profileSectionDiv.appendChild(nicknameSection);
  card.appendChild(cardHeader);
  card.appendChild(profileSectionDiv);
  profileSection.appendChild(title);
  profileSection.appendChild(card);

  addUploadSection();
  setupSaveButton();
  addProfileStyles();
  
  console.log('[Profile] renderProfilePage concluído com sucesso');
  isProfileRendering = false;
}

// Export para uso no renderer.js
export function updateProfileLanguage() {
  // Não recriar a página inteira, apenas atualizar textos existentes
  updateTextsInPlace();
}

function updateTextsInPlace() {
  // Atualizar textos sem recriar o DOM inteiro
  const title = document.querySelector('#page-profile .page-title');
  if (title) title.textContent = t('profile');
  
  const cardHeader = document.querySelector('#page-profile .card-header');
  if (cardHeader) cardHeader.textContent = t('chatProfileTitle');
  
  const nickLabel = document.querySelector('#page-profile .form-label[for="nicknameInput"]');
  if (nickLabel) nickLabel.textContent = t('chatNickname');
  
  const nickInput = document.getElementById('nicknameInput');
  if (nickInput) nickInput.placeholder = t('nicknamePlaceholder');
  
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) saveBtn.textContent = t('saveProfile');
  
  // Atualizar textos do upload
  const uploadHint = document.querySelector('#page-profile .upload-hint');
  if (uploadHint) uploadHint.textContent = t('uploadHint');
  
  const chooseText = document.querySelector('#page-profile .upload-choose-text');
  if (chooseText) chooseText.textContent = t('chooseAvatar');
  
  const dragText = document.querySelector('#page-profile .upload-drag-text');
  if (dragText) dragText.textContent = t('dragOrClick');
}

function addUploadSection() {
  const avatarSelector = document.querySelector('#page-profile .avatar-selector');
  if (!avatarSelector) return;

  // Verificar se já existe upload section para não duplicar
  if (avatarSelector.querySelector('.custom-avatar-upload')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-avatar-upload';

  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.setAttribute('data-i18n', 'yourAvatar');
  lbl.textContent = t('yourAvatar');

  const hint = document.createElement('p');
  hint.className = 'upload-hint';
  hint.setAttribute('data-i18n', 'uploadHint');
  hint.textContent = t('uploadHint');

  const area = document.createElement('div');
  area.className = 'upload-area';
  area.id = 'uploadArea';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'avatarFileInput';
  fileInput.accept = 'image/*';
  fileInput.className = 'upload-file-input';

  const placeholder = document.createElement('div');
  placeholder.className = 'upload-placeholder';
  placeholder.id = 'uploadPlaceholder';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48'); svg.setAttribute('height', '48');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 8v8m-4-4h8');
  svg.appendChild(circle); svg.appendChild(path);

  const chooseP = document.createElement('p');
  chooseP.className = 'upload-choose-text';
  chooseP.setAttribute('data-i18n', 'chooseAvatar');
  chooseP.textContent = t('chooseAvatar');

  const dragP = document.createElement('p');
  dragP.className = 'upload-drag-text';
  dragP.setAttribute('data-i18n', 'dragOrClick');
  dragP.textContent = t('dragOrClick');

  placeholder.appendChild(svg);
  placeholder.appendChild(chooseP);
  placeholder.appendChild(dragP);

  const preview = document.createElement('div');
  preview.className = 'upload-preview upload-preview--hidden';
  preview.id = 'uploadPreview';

  const previewImg = document.createElement('img');
  previewImg.id = 'previewImage';
  previewImg.src = '';
  previewImg.alt = t('chooseAvatar');

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-upload-btn';
  removeBtn.id = 'removeUploadBtn';
  removeBtn.title = t('removeAvatar');
  removeBtn.textContent = '×';

  preview.appendChild(previewImg);
  preview.appendChild(removeBtn);
  area.appendChild(fileInput);
  area.appendChild(placeholder);
  area.appendChild(preview);

  const status = document.createElement('div');
  status.className = 'upload-status upload-status--hidden';
  status.id = 'uploadStatus';

  wrapper.appendChild(lbl);
  wrapper.appendChild(hint);
  wrapper.appendChild(area);
  wrapper.appendChild(status);
  avatarSelector.appendChild(wrapper);

  setupAvatarUpload();
}

function setupAvatarUpload() {
  const area = document.getElementById('uploadArea');
  const input = document.getElementById('avatarFileInput');
  const ph = document.getElementById('uploadPlaceholder');
  const remove = document.getElementById('removeUploadBtn');

  if (ph) {
    ph.addEventListener('click', () => input.click());
  }
  
  if (area) {
    area.addEventListener('dragover', e => { 
      e.preventDefault(); 
      area.classList.add('drag-over'); 
    });
    
    area.addEventListener('dragleave', () => {
      area.classList.remove('drag-over');
    });
    
    area.addEventListener('drop', e => {
      e.preventDefault(); 
      area.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }
  
  if (input) {
    input.addEventListener('change', e => { 
      if (e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });
  }
  
  if (remove) {
    remove.addEventListener('click', e => { 
      e.stopPropagation(); 
      clearCustomUpload(); 
    });
  }
}

function handleFile(file) {
  const max = 2 * 1024 * 1024;
  const ok = ['image/png','image/jpeg','image/jpg','image/gif','image/webp'];
  
  if (!ok.includes(file.type)) {
    return showStatus(t('invalidFormat'), 'error');
  }
  
  if (file.size > max) {
    return showStatus(t('fileTooLarge'), 'error');
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;
      const maxSize = 200;
      
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedData = canvas.toDataURL('image/jpeg', 0.7);
      const sizeInBytes = Math.round((compressedData.length * 3) / 4);
      
      if (sizeInBytes > 500000) {
        return showStatus(t('imageTooLarge'), 'error');
      }
      
      const previewImg = document.getElementById('previewImage');
      const ph = document.getElementById('uploadPlaceholder');
      const prev = document.getElementById('uploadPreview');
      
      if (previewImg && ph && prev) {
        previewImg.src = compressedData;
        ph.classList.add('upload-placeholder--hidden');
        prev.classList.remove('upload-preview--hidden');
        prev.dataset.imageData = compressedData;
        prev.dataset.fileName = file.name;
      }
      
      const sizeKB = Math.round(sizeInBytes/1024);
      showStatus(`${t('avatarLoaded')} (${sizeKB}KB)`, 'success');
    };
    
    img.onerror = () => {
      showStatus(t('errorLoadingImage'), 'error');
    };
    
    img.src = e.target.result;
  };
  
  reader.readAsDataURL(file);
}

function clearCustomUpload() {
  const ph = document.getElementById('uploadPlaceholder');
  const prev = document.getElementById('uploadPreview');
  const img = document.getElementById('previewImage');
  const inp = document.getElementById('avatarFileInput');
  const st = document.getElementById('uploadStatus');
  
  if (ph) ph.classList.remove('upload-placeholder--hidden');
  if (prev) {
    prev.classList.add('upload-preview--hidden');
    prev.dataset.imageData = '';
    prev.dataset.fileName = '';
  }
  if (img) img.src = '';
  if (inp) inp.value = '';
  if (st) st.classList.add('upload-status--hidden');
}

function showStatus(msg, type) {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'upload-status ' + type;
  el.classList.remove('upload-status--hidden');
  setTimeout(() => {
    el.classList.add('upload-status--hidden');
  }, 5000);
}

function showProfileError(message) {
  const status = document.getElementById('uploadStatus');
  if (status) {
    status.textContent = message;
    status.className = 'upload-status error';
    status.classList.remove('upload-status--hidden');
    setTimeout(() => status.classList.add('upload-status--hidden'), 5000);
  }
}

function setupSaveButton() {
  const btn = document.getElementById('saveProfileBtn');
  if (!btn) return;

  btn.textContent = t('saveProfile');
  btn.setAttribute('data-i18n', 'saveProfile');

  // Remover listener antigo se existir
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  newBtn.addEventListener('click', async () => {
    const user = auth?.currentUser;
    if (!user) {
      return showProfileError(t('loginFirst'));
    }

    const nick = document.getElementById('nicknameInput')?.value.trim();
    if (!nick || nick.length < 3) {
      return showProfileError(t('nicknameMin'));
    }

    const preview = document.getElementById('uploadPreview');
    if (!preview?.dataset.imageData) {
      return showProfileError(t('chooseAvatarFirst'));
    }

    newBtn.disabled = true;
    const old = newBtn.textContent;
    newBtn.textContent = t('saving');

    try {
      const base64Data = preview.dataset.imageData;
      const sizeInBytes = Math.round((base64Data.length * 3) / 4);
      
      if (sizeInBytes > 900000) {
        newBtn.disabled = false;
        newBtn.textContent = old;
        return showProfileError(t('avatarTooLarge'));
      }
      
      const avatarData = { 
        type: 'custom', 
        data: base64Data
      };

      // Prepare timestamp based on Firebase SDK version
      let timestampValue;
      if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
        timestampValue = firebase.firestore.FieldValue.serverTimestamp();
      } else {
        // Fallback: use current date se Firebase não estiver disponível
        timestampValue = new Date();
      }

      await db.collection('users').doc(user.uid).set({
        nickname: nick,
        avatar: avatarData,
        updatedAt: timestampValue
      }, { merge: true });

      // Atualizar cache
      localStorage.setItem('profile_' + user.uid, JSON.stringify({
        nickname: nick,
        avatarType: 'custom'
      }));

      newBtn.textContent = t('saved');
      setTimeout(() => { 
        newBtn.disabled = false; 
        newBtn.textContent = old; 
      }, 2000);
    } catch (e) {
      showProfileError(t('errorSavingProfile'));
      newBtn.disabled = false;
      newBtn.textContent = old;
    }
  });
}

async function loadUserData(user) {
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    const data = snap.data();
    if (!data) return;

    const inp = document.getElementById('nicknameInput');
    if (inp && data.nickname) {
      inp.value = data.nickname;
    }

    if (data.avatar && data.avatar.type === 'custom' && data.avatar.data) {
      const prev = document.getElementById('uploadPreview');
      const img = document.getElementById('previewImage');
      const ph = document.getElementById('uploadPlaceholder');
      
      if (prev && img && ph) {
        img.src = data.avatar.data;
        ph.classList.add('upload-placeholder--hidden');
        prev.classList.remove('upload-preview--hidden');
        prev.dataset.imageData = data.avatar.data;
      }
    }
  } catch (e) { 
    // Silenciar erro
  }
}

function addProfileStyles() {
  // CSS movido para profile.css
}

export function cleanupProfile() {
  // Desregistrar o listener de autenticação
  if (window.__profileAuthUnsubscribe) {
    window.__profileAuthUnsubscribe();
    window.__profileAuthUnsubscribe = null;
  }
  authListenerSetup = false;
  isProfileRendering = false;
  currentUserUid = null;
}

// Funções exportadas para uso no chat
export function getUserProfile(user) {
  if (!user) return null;
  const s = localStorage.getItem('profile_' + user.uid);
  if (s) {
    try {
      const parsed = JSON.parse(s);
      const defaultName = getCurrentLang() === 'pt' ? 'Usuário' : 'User';
      return {
        nickname: (typeof parsed.nickname === 'string' && parsed.nickname.length <= 20)
          ? parsed.nickname
          : user.displayName || user.email?.split('@')[0] || defaultName,
        avatar: '👤'
      };
    } catch (e) {
      return null;
    }
  }
  const defaultName = getCurrentLang() === 'pt' ? 'Usuário' : 'User';
  return {
    nickname: user.displayName || user.email?.split('@')[0] || defaultName,
    avatar: '👤'
  };
}

export function getDisplayNameForChat(user) {
  if (!user) return getCurrentLang() === 'pt' ? 'Anônimo' : 'Anonymous';
  const p = getUserProfile(user);
  return p.nickname;
}

export async function getUserProfileFromFirestore(user) {
  if (!user || !db) return null;
  try {
    const d = (await db.collection('users').doc(user.uid).get()).data();
    if (!d) return null;
    
    let av = '👤';
    if (d.avatar?.type === 'custom' && d.avatar.data) {
      av = d.avatar.data;
    }
    
    const defaultName = getCurrentLang() === 'pt' ? 'Usuário' : 'User';
    return { 
      nickname: d.nickname || user.displayName || user.email?.split('@')[0] || defaultName, 
      avatar: av, 
      avatarData: d.avatar 
    };
  } catch (e) { 
    return getUserProfile(user); 
  }
}

export function getAvatarDisplay(avatarData) {
  if (!avatarData) {
    return { type: 'text', content: '👤' };
  }
  
  if (typeof avatarData === 'string') {
    if (avatarData.startsWith('data:image')) {
      return { type: 'image', content: avatarData };
    } else {
      return { type: 'text', content: avatarData };
    }
  }
  
  if (avatarData.type === 'custom' && avatarData.data) {
    return { type: 'image', content: avatarData.data };
  }
  
  return { type: 'text', content: '👤' };
}