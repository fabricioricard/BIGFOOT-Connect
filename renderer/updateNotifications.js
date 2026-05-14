// ==========================================
// BIGFOOT Connect — Update Notification UI
// ==========================================

// Fix 2: CSS movido para update-notifications.css — sem injeção inline

// ── Helpers ────────────────────────────────────────────────────────────────

// Helper DOM — evita innerHTML em todo o módulo
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // textContent escapa tudo
  return e;
}

// Fix 1: sanitiza version para garantir que só caracteres seguros passem
function sanitizeVersion(version) {
  if (!version || typeof version !== 'string') return '—';
  // Aceita apenas dígitos, pontos e hífens (ex: "1.2.3", "2.0.0-beta.1")
  return /^[\d.\-a-zA-Z]+$/.test(version) ? version : '—';
}

function dismissCard(card) {
  card.classList.remove('upd-visible');
  card.classList.add('upd-hiding');
  setTimeout(() => card.remove(), 500);
}

function showIn(card, container) {
  container.appendChild(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('upd-visible')));
}

function showUpdateAvailable(data, container) {
  container.replaceChildren();
  const card = el('div', 'upd-card');
  const accent = el('div', 'upd-accent upd-accent-download');
  const body = el('div', 'upd-body');
  body.appendChild(el('div', 'upd-icon-wrap upd-icon-dl', '⬇️'));
  const cnt = el('div', 'upd-content');
  cnt.appendChild(el('div', 'upd-label upd-label-dl', 'Downloading Update'));
  cnt.appendChild(el('div', 'upd-title', 'New Version'));
  // Fix 1: version via textContent — sem innerHTML, previne XSS via supply chain
  const ver = el('div', 'upd-version');
  ver.textContent = 'v';
  const strong = el('strong', '', sanitizeVersion(data.version));
  ver.appendChild(strong);
  ver.appendChild(document.createTextNode(' is being fetched...'));
  cnt.appendChild(ver);
  const row = el('div', 'upd-progress-row');
  row.appendChild(el('span', 'upd-progress-label', 'Progress'));
  const pct = el('span', 'upd-progress-pct', '0%');
  pct.id = 'updateProgressText';
  row.appendChild(pct);
  cnt.appendChild(row);
  const bar = el('div', 'upd-bar');
  const fill = el('div', 'upd-bar-fill');
  fill.id = 'updateProgressFill';
  bar.appendChild(fill);
  cnt.appendChild(bar);
  cnt.appendChild(el('div', 'upd-hint', 'Install button will appear when download completes.'));
  body.appendChild(cnt);
  card.appendChild(accent);
  card.appendChild(body);
  showIn(card, container);
}

function showUpdateReady(data, container) {
  container.replaceChildren();
  const card = el('div', 'upd-card upd-card-ready');
  const body = el('div', 'upd-body');
  body.appendChild(el('div', 'upd-accent'));
  const closeBtn = el('button', 'upd-close', '✕');
  closeBtn.title = 'Dismiss';
  body.appendChild(closeBtn);
  body.appendChild(el('div', 'upd-icon-wrap', '✅'));
  const cnt = el('div', 'upd-content');
  cnt.appendChild(el('div', 'upd-label', 'Update Ready'));
  cnt.appendChild(el('div', 'upd-title', 'Install Now'));
  // Fix 1: version via textContent — sem innerHTML
  const ver = el('div', 'upd-version');
  ver.textContent = 'v';
  const strong = el('strong', '', sanitizeVersion(data.version));
  ver.appendChild(strong);
  ver.appendChild(document.createTextNode(' downloaded & verified'));
  cnt.appendChild(ver);
  const btns = el('div', 'upd-buttons');
  const installBtn = el('button', 'upd-btn upd-btn-primary', '🚀 Install Now');
  const laterBtn = el('button', 'upd-btn upd-btn-secondary', '⏰ Later');
  btns.appendChild(installBtn);
  btns.appendChild(laterBtn);
  cnt.appendChild(btns);
  body.appendChild(cnt);
  card.appendChild(body);
  showIn(card, container);

  installBtn.addEventListener('click', async function () {
    this.disabled = true;
    // Fix 6: textContent em vez de innerHTML no botão de instalar
    this.textContent = '⏳ Installing...';
    if (window.electronAPI?.installUpdate) await window.electronAPI.installUpdate();
  });

  const later = async () => {
    if (window.electronAPI?.postponeUpdate) await window.electronAPI.postponeUpdate();
    dismissCard(card);
  };
  laterBtn.addEventListener('click', later);
  closeBtn.addEventListener('click', later);
}

function showUpdateError(data, container) {
  container.replaceChildren();
  const card = el('div', 'upd-card');
  const body = el('div', 'upd-body');
  body.appendChild(el('div', 'upd-accent upd-accent-error'));
  const closeBtn = el('button', 'upd-close', '✕');
  closeBtn.title = 'Dismiss';
  body.appendChild(closeBtn);
  body.appendChild(el('div', 'upd-icon-wrap upd-icon-err', '⚠️'));
  const cnt = el('div', 'upd-content');
  cnt.appendChild(el('div', 'upd-label upd-label-err', 'Update Failed'));
  cnt.appendChild(el('div', 'upd-title', 'Download Error'));
  // Fix 8: mensagem genérica — não expõe data.message interno ao usuário
  const msg = el('div', 'upd-version upd-version-error',
    'Could not download the update. Please try again later.');
  cnt.appendChild(msg);
  // Fix 4: classe CSS em vez de style="width:100%"
  const dismissBtn = el('button', 'upd-btn upd-btn-secondary upd-btn-full', 'Dismiss');
  cnt.appendChild(dismissBtn);
  body.appendChild(cnt);
  card.appendChild(body);
  showIn(card, container);

  const dismiss = () => dismissCard(card);
  dismissBtn.addEventListener('click', dismiss);
  closeBtn.addEventListener('click', dismiss);
  setTimeout(() => { if (card.parentNode) dismissCard(card); }, 12000);
}

function updateProgressBar(progress) {
  const fill = document.getElementById('updateProgressFill');
  const text = document.getElementById('updateProgressText');
  const pct = Math.round(progress.percent || 0);
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${pct}%`;
}

export function initUpdateNotifications() {
  // Fix 2: CSS carregado via update-notifications.css no index.html
  const container = document.createElement('div');
  container.id = 'update-notifications';
  document.body.appendChild(container);

  if (window.electronAPI?.onUpdateNotification) {
    window.electronAPI.onUpdateNotification((data) => {
      if      (data.type === 'available')  showUpdateAvailable(data, container);
      else if (data.type === 'downloaded') showUpdateReady(data, container);
      else if (data.type === 'error')      showUpdateError(data, container);
    });
  }

  if (window.electronAPI?.onUpdateProgress) {
    window.electronAPI.onUpdateProgress((progress) => updateProgressBar(progress));
  }
}