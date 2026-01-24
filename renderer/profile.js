import { t, currentLang } from './i18n.js';

let db = null;
let auth = null;
let authListenerSetup = false;

export function initializeProfile(firebaseAuth, firebaseDb) {
  console.log('[PROFILE] Inicializando...');
  auth = firebaseAuth;
  db = firebaseDb;

  const profileSection = document.getElementById('page-profile');
  if (!profileSection) {
    console.error('[PROFILE] #page-profile não encontrado');
    return;
  }

  if (!authListenerSetup) {
    authListenerSetup = true;
    auth.onAuthStateChanged(user => {
      if (user) {
        renderProfilePage();
        loadUserData(user);
      } else {
        showLoginRequired();
      }
    });
  }

  const currentUser = auth?.currentUser;
  if (currentUser) {
    renderProfilePage();
    loadUserData(currentUser);
  } else {
    showLoginRequired();
  }
}

function showLoginRequired() {
  const profileSection = document.getElementById('page-profile');
  if (!profileSection) return;
  
  profileSection.innerHTML = `
    <h1 class="page-title" data-i18n="profile">Profile</h1>
    <div class="card" style="text-align: center; padding: 40px;">
      <p style="font-size: 1.1em; margin-bottom: 20px;" data-i18n="loginRequired">${t('loginRequired')}</p>
      <button class="primary-button" onclick="document.getElementById('loginModalBtn').click();" data-i18n="login">${t('login')}</button>
    </div>
  `;
}

function renderProfilePage() {
  const profileSection = document.getElementById('page-profile');
  if (!profileSection) return;

  profileSection.innerHTML = `
    <h1 class="page-title" data-i18n="profile">Profile</h1>
    <div class="card">
      <div class="card-header" data-i18n="chatProfileTitle">${t('chatProfileTitle')}</div>
      <div class="profile-section">
        <div class="avatar-selector">
          <!-- Será preenchido pela função addUploadSection -->
        </div>
        <div class="nickname-section">
          <label for="nicknameInput" class="form-label" data-i18n="chatNickname">${t('chatNickname')}</label>
          <input type="text" id="nicknameInput" maxlength="20" placeholder="${t('nicknamePlaceholder')}" data-i18n-placeholder="nicknamePlaceholder" />
          <button class="primary-button" id="saveProfileBtn" style="margin-top: 10px;" data-i18n="saveProfile">${t('saveProfile')}</button>
        </div>
      </div>
    </div>
  `;

  addUploadSection();
  setupSaveButton();
  addProfileStyles();
}

// Função pública para atualizar idioma do profile
window.updateProfileLanguage = function() {
  console.log('[PROFILE] 🌐 Atualizando idioma...');
  
  if (auth?.currentUser) {
    renderProfilePage();
    loadUserData(auth.currentUser);
  } else {
    showLoginRequired();
  }
};

function addUploadSection() {
  const avatarSelector = document.querySelector('#page-profile .avatar-selector');
  if (!avatarSelector) return;

  const html = `
    <div class="custom-avatar-upload">
      <label class="form-label" data-i18n="yourAvatar">${t('yourAvatar')}</label>
      <p class="upload-hint" data-i18n="uploadHint">${t('uploadHint')}</p>
      <div class="upload-area" id="uploadArea">
        <input type="file" id="avatarFileInput" accept="image/*" style="display:none">
        <div class="upload-placeholder" id="uploadPlaceholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8m-4-4h8"/>
          </svg>
          <p style="font-size: 1.1em; margin-top: 8px;" data-i18n="chooseAvatar">${t('chooseAvatar')}</p>
          <p style="font-size: 0.85em; opacity: 0.7;" data-i18n="dragOrClick">${t('dragOrClick')}</p>
        </div>
        <div class="upload-preview" id="uploadPreview" style="display:none">
          <img id="previewImage" src="" alt="${t('chooseAvatar')}">
          <button class="remove-upload-btn" id="removeUploadBtn" title="${t('removeAvatar')}">×</button>
        </div>
      </div>
      <div class="upload-status" id="uploadStatus" style="display:none"></div>
    </div>`;
  
  avatarSelector.innerHTML = html;
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
  
  input.addEventListener('change', e => { 
    if (e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });
  
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
      
      previewImg.src = compressedData;
      ph.style.display = 'none';
      prev.style.display = 'flex';
      prev.dataset.imageData = compressedData;
      prev.dataset.fileName = file.name;
      
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
  
  ph.style.display = 'flex';
  prev.style.display = 'none';
  prev.dataset.imageData = '';
  prev.dataset.fileName = '';
  img.src = '';
  inp.value = '';
  st.style.display = 'none';
}

function showStatus(msg, type) {
  const el = document.getElementById('uploadStatus');
  el.textContent = msg;
  el.className = 'upload-status ' + type;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

function setupSaveButton() {
  const btn = document.getElementById('saveProfileBtn');
  if (!btn) return;

  btn.textContent = t('saveProfile');
  btn.setAttribute('data-i18n', 'saveProfile');

  btn.addEventListener('click', async () => {
    const user = auth?.currentUser;
    if (!user) {
      return alert(t('loginFirst'));
    }

    const nick = document.getElementById('nicknameInput')?.value.trim();
    if (!nick || nick.length < 3) {
      return alert(t('nicknameMin'));
    }

    const preview = document.getElementById('uploadPreview');
    if (!preview?.dataset.imageData) {
      return alert(t('chooseAvatarFirst'));
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = t('saving');

    try {
      const base64Data = preview.dataset.imageData;
      const sizeInBytes = Math.round((base64Data.length * 3) / 4);
      
      console.log('[PROFILE] Tamanho do avatar:', Math.round(sizeInBytes/1024), 'KB');
      
      if (sizeInBytes > 900000) {
        btn.disabled = false;
        btn.textContent = old;
        return alert(t('avatarTooLarge'));
      }
      
      const avatarData = { 
        type: 'custom', 
        data: base64Data
      };

      await db.collection('users').doc(user.uid).set({
        nickname: nick,
        avatar: avatarData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('[PROFILE] Perfil salvo com sucesso!');

      localStorage.setItem('profile_' + user.uid, JSON.stringify({
        nickname: nick,
        avatar: base64Data
      }));

      btn.textContent = t('saved');
      setTimeout(() => { 
        btn.disabled = false; 
        btn.textContent = old; 
      }, 2000);
    } catch (e) {
      console.error('[SAVE PROFILE] Erro:', e);
      alert(`${t('errorSavingProfile')} ${e.message}`);
      btn.disabled = false;
      btn.textContent = old;
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
        ph.style.display = 'none';
        prev.style.display = 'flex';
        prev.dataset.imageData = data.avatar.data;
      }
    }
  } catch (e) { 
    console.error('[PROFILE] Erro ao carregar dados:', e); 
  }
}

function addProfileStyles() {
  if (document.getElementById('profile-styles')) return;
  
  const s = document.createElement('style');
  s.id = 'profile-styles';
  s.textContent = `
    /* Controle de altura da página Profile */
    #page-profile {
      overflow: visible;
      max-height: calc(100vh - 100px);
    }
    
    #page-profile .page-title {
      margin-bottom: 10px;
      font-size: 1.5rem;
    }
    
    #page-profile .card {
      padding: 16px !important;
      max-height: calc(100vh - 160px);
      overflow: visible;
    }
    
    #page-profile .card-header {
      margin-bottom: 8px;
      padding-bottom: 6px;
      font-size: 0.95rem;
    }
    
    .avatar-selector {
      margin-bottom: 14px;
    }
    .custom-avatar-upload { 
      margin-top: 0;
      padding-top: 0;
    }
    .upload-hint { 
      color: #9ca3af; 
      font-size: 0.82em; 
      margin: 5px 0 10px; 
    }
    .upload-area { 
      border: 2px dashed rgba(255,255,255,0.3); 
      border-radius: 12px; 
      padding: 28px; 
      min-height: 140px; 
      transition: all 0.3s ease; 
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .upload-area:hover { 
      border-color: #00FF87; 
      background: rgba(0,255,135,0.05); 
      transform: translateY(-2px);
    }
    .upload-area.drag-over { 
      border-color: #00FF87; 
      background: rgba(0,255,135,0.12); 
      transform: scale(1.02);
    }
    .upload-placeholder { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center;
      color: #9ca3af; 
      text-align: center;
    }
    .upload-placeholder svg { 
      opacity: 0.5;
      margin-bottom: 8px;
      width: 38px;
      height: 38px;
    }
    .upload-placeholder p {
      margin: 2px 0;
      font-size: 0.9em;
    }
    .upload-preview { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      position: relative; 
    }
    .upload-preview img { 
      max-width: 130px; 
      max-height: 130px; 
      border-radius: 50%; 
      border: 3px solid #00FF87; 
      box-shadow: 0 4px 20px rgba(0,255,135,0.3); 
    }
    .remove-upload-btn { 
      position: absolute;
      top: -5px; 
      right: calc(50% - 70px); 
      width: 26px; 
      height: 26px; 
      background: #ef4444; 
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px; 
      font-weight: bold;
      line-height: 1;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .remove-upload-btn:hover {
      background: #dc2626;
      transform: scale(1.15);
    }
    .upload-status { 
      margin-top: 8px; 
      padding: 7px 12px; 
      font-size: 0.82em; 
      border-radius: 7px;
      text-align: center;
      font-weight: 500;
    }
    .upload-status.success { 
      background: rgba(16,185,129,0.15); 
      color: #10b981; 
      border: 1px solid rgba(16,185,129,0.3);
    }
    .upload-status.error { 
      background: rgba(239,68,68,0.15); 
      color: #ef4444; 
      border: 1px solid rgba(239,68,68,0.3);
    }
    
    #page-profile .nickname-section {
      margin-top: 10px;
    }
    
    #page-profile .form-label {
      margin-bottom: 5px;
      font-size: 0.88rem;
    }
    
    #page-profile #nicknameInput {
      margin-bottom: 6px;
      padding: 10px 14px;
    }
    
    #page-profile .primary-button {
      margin-top: 6px !important;
      padding: 10px 16px;
      font-size: 0.92rem;
    }
  `;
  document.head.appendChild(s);
}

export function cleanupProfile() {
  authListenerSetup = false;
  console.log('[PROFILE] Cleanup');
}

// Funções exportadas para uso no chat e outras partes do app
export function getUserProfile(user) {
  if (!user) return null;
  const s = localStorage.getItem('profile_' + user.uid);
  if (s) {
    try { 
      return JSON.parse(s); 
    } catch (e) {
      return null;
    }
  }
  const defaultName = currentLang === 'pt' ? 'Usuário' : 'User';
  return { 
    nickname: user.displayName || user.email?.split('@')[0] || defaultName, 
    avatar: '👤' 
  };
}

export function getDisplayNameForChat(user) {
  if (!user) return currentLang === 'pt' ? 'Anônimo' : 'Anonymous';
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
    
    const defaultName = currentLang === 'pt' ? 'Usuário' : 'User';
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