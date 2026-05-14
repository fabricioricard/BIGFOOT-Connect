// logs.js — BIGchain node log viewer
import { t, getCurrentLang } from './i18n.js';

let autoScrollEnabled = true;

const LOG_COLORS = {
  block:      '#00FF87',
  relay:      '#00D9FF',
  peer:       '#4A90E2',
  wallet:     '#9B59B6',
  sync:       '#1ABC9C',
  warning:    '#F5A623',
  error:      '#E74C3C',
  info:       '#888888',
  mining:     '#FFD700',
  registered: '#00D084',
};

// Real logs from bigchain.exe output
let bigchainLogs = [];
const MAX_LOGS = 200;

// Tradução dos tipos de log (legendas)
const logTypeLabels = {
  block: 'logTypeBlock',
  relay: 'logTypeRelay',
  peer: 'logTypePeer',
  wallet: 'logTypeWallet',
  sync: 'logTypeSync',
  mining: 'logTypeMining',
  registered: 'logTypeRegistered',
  warning: 'logTypeWarning',
  error: 'logTypeError',
};

// ──────────────────────────────────────────────
// CLASSIFY LOG LINE
// ──────────────────────────────────────────────
function classifyLog(line) {
  if (line.includes('🎉') || (line.includes('Block #') && line.includes('+'))) return 'block';
  if (line.includes('📥') || line.includes('accepted from network')) return 'block';
  if (line.includes('📡') || line.includes('Relay')) return 'relay';
  if (line.includes('🔗') || line.includes('Peer identified') || line.includes('Connected to')) return 'peer';
  if (line.includes('❌') && line.includes('Peer')) return 'peer';
  if (line.includes('🔐') || line.includes('Wallet') || line.includes('Balance') || line.includes('balance')) return 'wallet';
  if (line.includes('💾') || line.includes('Blockchain loaded') || line.includes('🔄') || line.includes('Chain')) return 'sync';
  if (line.includes('🌱') || line.includes('Genesis')) return 'sync';
  if (line.includes('⛏️') || line.includes('mining') || line.includes('Mining')) return 'mining';
  if (line.includes('📤') || line.includes('Node registered')) return 'registered';
  if (line.includes('⚠️') || line.includes('Warning') || line.includes('Error saving')) return 'warning';
  if (line.includes('❌') || line.includes('Error') || line.includes('failed')) return 'error';
  if (line.includes('🚀') || line.includes('Starting') || line.includes('HTTP API')) return 'info';
  return 'info';
}

// ──────────────────────────────────────────────
// ADD LOG
// ──────────────────────────────────────────────
function addLog(line) {
  if (!line || line.trim() === '') return;
  const type = classifyLog(line);
  bigchainLogs.push({
    timestamp: new Date(),
    type,
    message: line.trim(),
  });
  if (bigchainLogs.length > MAX_LOGS) bigchainLogs.shift();
}

// ──────────────────────────────────────────────
// RENDER
// ──────────────────────────────────────────────
function renderLogs() {
  const container = document.getElementById('logsContent');
  if (!container) return;

  container.replaceChildren();

  if (bigchainLogs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'logs-empty';
    empty.textContent = t('logsEmpty');   // ← traduzido
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  bigchainLogs
    .slice()
    .reverse()
    .forEach(log => {
      const color = LOG_COLORS[log.type] || LOG_COLORS.info;
      const t2 = log.timestamp;
      const time = `${String(t2.getHours()).padStart(2,'0')}:${String(t2.getMinutes()).padStart(2,'0')}:${String(t2.getSeconds()).padStart(2,'0')}`;

      const row = document.createElement('div');
      row.className = 'log-row';
      row.style.setProperty('--log-color', color);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.textContent = time;

      const msgSpan = document.createElement('span');
      msgSpan.className = 'log-msg';
      msgSpan.style.setProperty('--log-color', color);
      msgSpan.textContent = log.message;

      row.appendChild(timeSpan);
      row.appendChild(msgSpan);
      fragment.appendChild(row);
    });

  container.appendChild(fragment);

  if (autoScrollEnabled) {
    const scrollEl = document.getElementById('logsContainer');
    if (scrollEl) scrollEl.scrollTop = 0;
  }
}

// ──────────────────────────────────────────────
// UPDATE STATIC TEXTS (chamado ao mudar idioma)
// ──────────────────────────────────────────────
function updateStaticTexts() {
  // Header title
  const headerTitle = document.querySelector('#page-logs .card-header span');
  if (headerTitle) headerTitle.textContent = t('logsTitle');

  // Auto-scroll label
  const autoScrollLabel = document.querySelector('.logs-autoscroll-label');
  if (autoScrollLabel && autoScrollLabel.childNodes[1]) {
    autoScrollLabel.childNodes[1].textContent = ' ' + t('logsAutoScroll');
  }

  // Clear button
  const clearBtn = document.getElementById('clearLogsBtn');
  if (clearBtn) clearBtn.textContent = t('logsClear');

  // Legend items
  const legendItems = document.querySelectorAll('.logs-legend-item');
  legendItems.forEach(item => {
    const typeKey = item.dataset.logType;
    if (typeKey && logTypeLabels[typeKey]) {
      item.textContent = t(logTypeLabels[typeKey]);
    }
  });

  // Empty state message (se estiver visível)
  const emptyMsg = document.querySelector('.logs-empty');
  if (emptyMsg) emptyMsg.textContent = t('logsEmpty');
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
export function initializeLogs(lang) {
  const currentLang = lang || getCurrentLang();

  const logsPage = document.getElementById('page-logs');
  if (!logsPage) return;

  logsPage.replaceChildren();

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = 'Logs';

  const card = document.createElement('div');
  card.className = 'card';

  // Header
  const header = document.createElement('div');
  header.className = 'card-header logs-header';

  const headerTitle = document.createElement('span');
  headerTitle.textContent = t('logsTitle');          // ← traduzido

  const controls = document.createElement('div');
  controls.className = 'logs-controls';

  const autoScrollLabel = document.createElement('label');
  autoScrollLabel.className = 'logs-autoscroll-label';

  const autoScrollCheck = document.createElement('input');
  autoScrollCheck.type = 'checkbox';
  autoScrollCheck.id = 'autoScrollCheck';
  autoScrollCheck.checked = true;
  autoScrollCheck.className = 'logs-autoscroll-check';

  autoScrollLabel.appendChild(autoScrollCheck);
  autoScrollLabel.appendChild(document.createTextNode(' ' + t('logsAutoScroll'))); // ← traduzido

  const clearBtn = document.createElement('button');
  clearBtn.className = 'icon-button logs-clear-btn';
  clearBtn.id = 'clearLogsBtn';
  clearBtn.textContent = t('logsClear');             // ← traduzido

  controls.appendChild(autoScrollLabel);
  controls.appendChild(clearBtn);
  header.appendChild(headerTitle);
  header.appendChild(controls);

  // Log container
  const logsContainer = document.createElement('div');
  logsContainer.id = 'logsContainer';
  logsContainer.className = 'logs-container';

  const logsContent = document.createElement('div');
  logsContent.id = 'logsContent';
  logsContainer.appendChild(logsContent);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'logs-legend';

  const legendTypes = ['block', 'relay', 'peer', 'wallet', 'sync', 'mining', 'registered', 'warning', 'error'];
  legendTypes.forEach(type => {
    const span = document.createElement('span');
    span.className = 'logs-legend-item';
    span.dataset.logType = type;                    // guarda o tipo para atualização futura
    span.textContent = t(logTypeLabels[type]);      // ← traduzido
    span.style.setProperty('--log-color', LOG_COLORS[type]);
    legend.appendChild(span);
  });

  card.appendChild(header);
  card.appendChild(logsContainer);
  card.appendChild(legend);
  logsPage.appendChild(title);
  logsPage.appendChild(card);

  document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
    bigchainLogs = [];
    renderLogs();
  });

  document.getElementById('autoScrollCheck')?.addEventListener('change', (e) => {
    autoScrollEnabled = e.target.checked;
  });

  // Wire into real node output
  if (window.electronAPI?.onNodeLog) {
    window.electronAPI.onNodeLog((line) => {
      addLog(line);
      const activePage = document.querySelector('.page-content.active');
      if (activePage?.id === 'page-logs') renderLogs();
    });
  }

  renderLogs();
}

// Função pública para atualizar textos após mudança de idioma
export function updateLogsLanguage(lang) {
  // Apenas atualiza textos estáticos; os logs já exibidos permanecem iguais
  updateStaticTexts();
}

export function cleanupLogs() {
  // Cleanup de listeners é gerenciado pelo preload.js via removeAllListeners
}

export function addBlockchainLog(type, message) {
  addLog(`[${type.toUpperCase()}] ${message}`);
  const activePage = document.querySelector('.page-content.active');
  if (activePage?.id === 'page-logs') renderLogs();
}

// Expor para que o renderer.js possa chamar quando o idioma mudar
window.updateLogsLanguage = updateLogsLanguage;