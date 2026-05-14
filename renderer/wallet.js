import { initializeFirebase } from './auth.js';
import { getCurrentLang } from './i18n.js';

let db = null;
let auth = null;

const WEBSITE_URL = 'https://bigfootconnect.tech';
const DASHBOARD_URL = 'https://bigfootconnect.tech/dashboard';

// Format a createdAt value (ISO string, Unix ms, or Date) into a readable date
function formatCreatedDate(createdAt) {
  if (!createdAt) return getCurrentLang() === 'pt' ? 'Não criada' : 'Not created';
  try {
    const d = new Date(
      typeof createdAt === 'number' && createdAt < 1e12
        ? createdAt * 1000   // Unix seconds → ms
        : createdAt           // ISO string or Unix ms
    );
    if (isNaN(d.getTime())) return getCurrentLang() === 'pt' ? 'Data inválida' : 'Invalid date';
    return d.toLocaleDateString(getCurrentLang() === 'pt' ? 'pt-BR' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return getCurrentLang() === 'pt' ? 'Data inválida' : 'Invalid date'; }
}

// Wallet data (carregada do bigchain.exe)
let walletData = {
  address: 'Wallet not created yet',
  balance: 0.00,
  pendingBalance: 0.00,
  transactions: [],
  createdAt: null,
  createdDate: 'Not created',
  notCreated: true
};

export async function initializeWallet() {
  
  try {
    const firebaseResult = await initializeFirebase();
    
    if (firebaseResult?.db && firebaseResult?.auth) {
      db = firebaseResult.db;
      auth = firebaseResult.auth;
    } else {
      console.warn('[WALLET] Firebase não disponível (wallet continua funcionando localmente)');
    }
    
    const walletPage = document.getElementById('page-wallet');
    if (!walletPage) {
      console.error('[WALLET] Elemento #page-wallet não encontrado');
      return;
    }

    await loadWalletData();
    
    renderWalletUI(walletPage);
    addWalletStyles();
    
    // Esconder FAQ quando na página Wallet
    hideFaqOnWalletPage();
    
    if (window.electronAPI?.onWalletCreated) {
      window.electronAPI.onWalletCreated((data) => {
        walletData = {
          address: data.address,
          publicKey: data.publicKey,
          balance: data.balance,
          pendingBalance: data.pendingBalance,
          transactions: [],
          createdAt: data.createdAt,
          createdDate: formatCreatedDate(data.createdAt),
          notCreated: false
        };
        
        renderWalletUI(document.getElementById('page-wallet'));
        showWalletCreatedNotification();
      });
    }
    
    if (window.electronAPI?.onNodeStatsUpdate) {
      window.electronAPI.onNodeStatsUpdate((stats) => {
        if (stats.balance !== undefined && !walletData.notCreated) {
          walletData.balance = stats.balance;
          const balanceEl = document.getElementById('balanceValue');
          if (balanceEl) balanceEl.textContent = walletData.balance.toFixed(2);
        }
      });
    }

  } catch (error) {
    console.error('[WALLET] Erro ao inicializar wallet:', error);
  }

// Listener para nova transação detectada pelo node
if (window.electronAPI?.onNewTransaction) {
  window.electronAPI.onNewTransaction((tx) => {
    if (walletData.notCreated) return;
    // Evitar duplicadas
    if (walletData.transactions.some(t => t.hash === tx.hash)) return;
    walletData.transactions.unshift(tx);
    // Atualizar a lista do histórico se o modal estiver aberto
    const historyList = document.getElementById('historyTransactionsList');
    if (historyList) {
      const txElement = createTransactionItemElement(tx);
      historyList.prepend(txElement);
    }
  });
}
}

function hideFaqOnWalletPage() {
  // Esconder qualquer elemento de FAQ na página Wallet
  const faqSelectors = ['.faq-section', '#faq', '.faq-container', '.faq', '[data-section="faq"]'];
  faqSelectors.forEach(selector => {
    const faqElement = document.querySelector(selector);
    if (faqElement) {
      faqElement.style.display = 'none';
    }
  });
}

function restoreFaqOnExit() {
  const faqSelectors = ['.faq-section', '#faq', '.faq-container', '.faq', '[data-section="faq"]'];
  faqSelectors.forEach(selector => {
    const faqElement = document.querySelector(selector);
    if (faqElement) {
      faqElement.style.display = '';
    }
  });
}

async function loadWalletData() {
  
  try {
    const result = await window.electronAPI.getWalletData();
    
    if (!result.success) {
      walletData = {
        address: getCurrentLang() === 'pt' ? 'Wallet ainda não criada' : 'Wallet not created yet',
        balance: 0.00,
        pendingBalance: 0.00,
        transactions: [],
        createdAt: null,
        createdDate: getCurrentLang() === 'pt' ? 'Não criada' : 'Not created',
        notCreated: true
      };
      
      return;
    }
    
    walletData = {
      address: result.data.address,
      publicKey: result.data.publicKey,
      balance: result.data.balance,
      pendingBalance: result.data.pendingBalance,
      transactions: result.data.transactions || [],
      createdAt: result.data.createdAt,
      createdDate: formatCreatedDate(result.data.createdAt),
      notCreated: false
    };
    
  } catch (error) {
    
    walletData = {
      address: 'Error loading wallet',
      balance: 0.00,
      pendingBalance: 0.00,
      transactions: [],
      createdAt: null,
      createdDate: 'Error',
      notCreated: true
    };
  }
}

function renderWalletUI(container) {
  container.innerHTML = '';
  
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = '💰 ';
  const titleSpan = document.createElement('span');
  titleSpan.setAttribute('data-i18n', 'walletTitle');
  titleSpan.textContent = 'Wallet';
  title.appendChild(titleSpan);
  container.appendChild(title);
  
  const mainContainer = document.createElement('div');
  mainContainer.className = 'wallet-main-container';
  
  if (walletData.notCreated) {
    mainContainer.appendChild(createWalletNotCreatedCard());
  } else {
    mainContainer.appendChild(createBalanceCard());
    mainContainer.appendChild(createActionsRow());
    mainContainer.appendChild(createWalletInfoCard());
  }
  
  container.appendChild(mainContainer);
  
  setupEventListeners();
}

function createWalletNotCreatedCard() {
  const card = document.createElement('div');
  card.className = 'card wallet-not-created-card';

  const icon = document.createElement('div');
  icon.className = 'not-created-icon';
  icon.textContent = '🔐';

  const h2 = document.createElement('h2');
  h2.textContent = getCurrentLang() === 'pt' ? 'Wallet Não Criada' : 'Wallet Not Created';

  const msg = document.createElement('p');
  msg.className = 'not-created-message';
  msg.textContent = getCurrentLang() === 'pt'
    ? 'Sua wallet será criada automaticamente quando você se conectar à rede BIGchain pela primeira vez.'
    : 'Your wallet will be created automatically when you connect to the BIGchain network for the first time.';

  const steps = document.createElement('div');
  steps.className = 'not-created-steps';
  const stepTexts = getCurrentLang() === 'pt'
    ? ['Vá para a página Home', 'Clique em CONECTAR', 'Aguarde a criação da wallet']
    : ['Go to Home page', 'Click CONNECT', 'Wait for wallet creation'];
  stepTexts.forEach((text, i) => {
    const step = document.createElement('div');
    step.className = 'step';
    const num = document.createElement('div');
    num.className = 'step-number';
    num.textContent = String(i + 1);
    const txt = document.createElement('div');
    txt.className = 'step-text';
    txt.textContent = text;
    step.appendChild(num);
    step.appendChild(txt);
    steps.appendChild(step);
  });

  const warning = document.createElement('div');
  warning.className = 'not-created-warning';
  const warnText = document.createElement('span');
  warnText.textContent = getCurrentLang() === 'pt'
    ? 'Sua wallet e chave privada serão geradas localmente e armazenadas com segurança em seu dispositivo.'
    : 'Your wallet and private key will be generated locally and stored securely on your device.';
  warning.appendChild(warnText);

  card.appendChild(icon);
  card.appendChild(h2);
  card.appendChild(msg);
  card.appendChild(steps);
  card.appendChild(warning);
  return card;
}

function createBalanceCard() {
  const card = document.createElement('div');
  card.className = 'card wallet-balance-card';

  const header = document.createElement('div');
  header.className = 'balance-header';
  const label = document.createElement('span');
  label.className = 'balance-label';
  label.textContent = getCurrentLang() === 'pt' ? 'Saldo Total' : 'Total Balance';
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'refresh-btn';
  refreshBtn.id = 'refreshBalanceBtn';
  refreshBtn.title = getCurrentLang() === 'pt' ? 'Atualizar saldo' : 'Refresh balance';
  refreshBtn.appendChild(createRefreshSVG());
  header.appendChild(label);
  header.appendChild(refreshBtn);

  const amount = document.createElement('div');
  amount.className = 'balance-amount';
  const balVal = document.createElement('span');
  balVal.className = 'balance-value';
  balVal.id = 'balanceValue';
  balVal.textContent = walletData.balance.toFixed(2);
  const balCur = document.createElement('span');
  balCur.className = 'balance-currency';
  balCur.textContent = 'BIG';
  amount.appendChild(balVal);
  amount.appendChild(balCur);

  const secondary = document.createElement('div');
  secondary.className = 'balance-secondary';
  const pendItem = document.createElement('div');
  pendItem.className = 'balance-item';
  const pendLabel = document.createElement('span');
  pendLabel.className = 'balance-item-label';
  pendLabel.textContent = getCurrentLang() === 'pt' ? 'Pendente' : 'Pending';
  const pendVal = document.createElement('span');
  pendVal.className = 'balance-item-value';
  pendVal.textContent = walletData.pendingBalance.toFixed(2) + ' BIG';
  pendItem.appendChild(pendLabel);
  pendItem.appendChild(pendVal);
  const divider = document.createElement('div');
  divider.className = 'balance-divider';
  const usdItem = document.createElement('div');
  usdItem.className = 'balance-item';
  const usdLabel = document.createElement('span');
  usdLabel.className = 'balance-item-label';
  usdLabel.textContent = 'USD';
  const usdVal = document.createElement('span');
  usdVal.className = 'balance-item-value';
  usdVal.textContent = '$' + (walletData.balance * 0.01).toFixed(2);
  usdItem.appendChild(usdLabel);
  usdItem.appendChild(usdVal);
  secondary.appendChild(pendItem);
  secondary.appendChild(divider);
  secondary.appendChild(usdItem);

  card.appendChild(header);
  card.appendChild(amount);
  card.appendChild(secondary);
  return card;
}

function createRefreshSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const polyline1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline1.setAttribute('points', '23 4 23 10 17 10');
  const polyline2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline2.setAttribute('points', '1 20 1 14 7 14');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15');
  svg.appendChild(polyline1);
  svg.appendChild(polyline2);
  svg.appendChild(path);
  return svg;
}

function createSendIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '22'); line.setAttribute('y1', '2');
  line.setAttribute('x2', '11'); line.setAttribute('y2', '13');
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');
  svg.appendChild(line);
  svg.appendChild(polygon);
  return svg;
}

function createReceiveIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '22 12 18 12 15 21 9 3 6 12 2 12');
  svg.appendChild(polyline);
  return svg;
}

function createConvertIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle1.setAttribute('cx', '12'); circle1.setAttribute('cy', '12'); circle1.setAttribute('r', '1');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 8v8m4-4H8');
  const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle2.setAttribute('cx', '16'); circle2.setAttribute('cy', '4'); circle2.setAttribute('r', '2');
  const circle3 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle3.setAttribute('cx', '8'); circle3.setAttribute('cy', '20'); circle3.setAttribute('r', '2');
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M9 18.5L15 5.5');
  svg.appendChild(circle1);
  svg.appendChild(path1);
  svg.appendChild(circle2);
  svg.appendChild(circle3);
  svg.appendChild(path2);
  return svg;
}

function createHistoryIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '12 6 12 12 16 14');
  svg.appendChild(circle);
  svg.appendChild(polyline);
  return svg;
}

function createActionsRow() {
  const actionsRow = document.createElement('div');
  actionsRow.className = 'wallet-actions-row';
  
  const sendBtn = document.createElement('button');
  sendBtn.className = 'action-btn action-send';
  sendBtn.appendChild(createSendIconSVG());
  const sendSpan = document.createElement('span');
  sendSpan.textContent = getCurrentLang() === 'pt' ? 'Enviar' : 'Send';
  sendBtn.appendChild(sendSpan);
  
  const receiveBtn = document.createElement('button');
  receiveBtn.className = 'action-btn action-receive';
  receiveBtn.appendChild(createReceiveIconSVG());
  const receiveSpan = document.createElement('span');
  receiveSpan.textContent = getCurrentLang() === 'pt' ? 'Receber' : 'Receive';
  receiveBtn.appendChild(receiveSpan);
  
  const convertBtn = document.createElement('button');
  convertBtn.className = 'action-btn action-convert';
  convertBtn.appendChild(createConvertIconSVG());
  const convertSpan = document.createElement('span');
  convertSpan.textContent = getCurrentLang() === 'pt' ? 'Converter' : 'Convert';
  convertBtn.appendChild(convertSpan);
  
  const historyBtn = document.createElement('button');
  historyBtn.className = 'action-btn action-history';
  historyBtn.appendChild(createHistoryIconSVG());
  const historySpan = document.createElement('span');
  historySpan.textContent = getCurrentLang() === 'pt' ? 'Histórico' : 'History';
  historyBtn.appendChild(historySpan);
  
  actionsRow.appendChild(sendBtn);
  actionsRow.appendChild(receiveBtn);
  actionsRow.appendChild(convertBtn);
  actionsRow.appendChild(historyBtn);
  
  return actionsRow;
}

function createWalletInfoCard() {
  const card = document.createElement('div');
  card.className = 'card wallet-info-card';

  const infoHeader = document.createElement('div');
  infoHeader.className = 'wallet-info-header';
  const h3 = document.createElement('h3');
  h3.textContent = getCurrentLang() === 'pt' ? 'Informações da Wallet' : 'Wallet Information';
  infoHeader.appendChild(h3);
  card.appendChild(infoHeader);

  const addrItem = buildInfoRow(
    getCurrentLang() === 'pt' ? 'Endereço' : 'Address',
    null, true
  );
  const addrCode = addrItem.querySelector('.info-value-code');
  if (addrCode) {
    addrCode.id = 'walletAddress';
    addrCode.textContent = walletData.address;
    const copyBtn = addrItem.querySelector('.copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyAddress);
  }
  card.appendChild(addrItem);

  const pkItem = buildInfoRow(
    getCurrentLang() === 'pt' ? 'Chave Privada' : 'Private Key',
    null, true, true
  );
  const pkCode = pkItem.querySelector('.info-value-code');
  if (pkCode) {
    pkCode.id = 'walletPrivateKey';
    pkCode.className = 'private-key hidden';
    pkCode.textContent = '***************************';
    const toggleBtn = pkItem.querySelector('.toggle-visibility-btn');
    if (toggleBtn) {
      toggleBtn.id = 'togglePrivateKeyBtn';
      toggleBtn.addEventListener('click', togglePrivateKey);
    }
    const copyPkBtn = pkItem.querySelectorAll('.copy-btn')[1] || pkItem.querySelector('.copy-btn');
    if (copyPkBtn) copyPkBtn.addEventListener('click', copyPrivateKey);
  }
  const warnDiv = document.createElement('div');
  warnDiv.className = 'warning-text';
  const warnSpan = document.createElement('span');
  warnSpan.textContent = getCurrentLang() === 'pt'
    ? 'Nunca compartilhe sua chave privada com ninguém!'
    : 'Never share your private key with anyone!';
  warnDiv.appendChild(warnSpan);
  pkItem.appendChild(warnDiv);
  card.appendChild(pkItem);

  const dateItem = document.createElement('div');
  dateItem.className = 'wallet-info-item';
  const dateLabelDiv = document.createElement('div');
  dateLabelDiv.className = 'wallet-info-label';
  const dateLabelSpan = document.createElement('span');
  dateLabelSpan.textContent = getCurrentLang() === 'pt' ? 'Criada em' : 'Created';
  dateLabelDiv.appendChild(dateLabelSpan);
  const dateValDiv = document.createElement('div');
  dateValDiv.className = 'wallet-info-value';
  const dateSpan = document.createElement('span');
  dateSpan.textContent = walletData.createdDate;
  dateValDiv.appendChild(dateSpan);
  dateItem.appendChild(dateLabelDiv);
  dateItem.appendChild(dateValDiv);
  card.appendChild(dateItem);
  return card;
}

function buildInfoRow(label, value, hasCopyBtn, hasToggle) {
  const item = document.createElement('div');
  item.className = 'wallet-info-item';
  const labelDiv = document.createElement('div');
  labelDiv.className = 'wallet-info-label';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  labelDiv.appendChild(labelSpan);
  const valDiv = document.createElement('div');
  valDiv.className = 'wallet-info-value' + (hasToggle ? ' private-key-container' : '');
  const code = document.createElement('code');
  code.className = 'info-value-code';
  if (value) code.textContent = value;
  valDiv.appendChild(code);
  if (hasToggle) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-visibility-btn';
    toggleBtn.appendChild(createEyeIconSVG());
    valDiv.appendChild(toggleBtn);
  }
  if (hasCopyBtn) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.appendChild(createCopyIconSVG());
    valDiv.appendChild(copyBtn);
  }
  item.appendChild(labelDiv);
  item.appendChild(valDiv);
  return item;
}

function createEyeIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('id', 'eyeIcon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '3');
  svg.appendChild(path);
  svg.appendChild(circle);
  return svg;
}

function createCopyIconSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '9'); rect.setAttribute('y', '9');
  rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
  rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
  svg.appendChild(rect);
  svg.appendChild(path);
  return svg;
}

function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshBalanceBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshBalance);
  }
  
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    const spanText = btn.querySelector('span')?.textContent?.toLowerCase() || '';
    
    if (spanText.includes('enviar') || spanText.includes('send')) {
      btn.addEventListener('click', openSendModal);
    } else if (spanText.includes('receber') || spanText.includes('receive')) {
      btn.addEventListener('click', openReceiveModal);
    } else if (spanText.includes('converter') || spanText.includes('convert')) {
      btn.addEventListener('click', openConvertModal);
    } else if (spanText.includes('histórico') || spanText.includes('history')) {
      btn.addEventListener('click', openHistoryModal);
    }
  });
}

function openSendModal() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  showSendModal();
}

function openReceiveModal() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  showReceiveModal();
}

function openConvertModal() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  showConvertModal();
}

function showConvertModal() {
  const existingModal = document.getElementById('convertModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'convertModal';
  modal.className = 'wallet-modal';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-action', 'closeConvertModal');

  const content = document.createElement('div');
  content.className = 'modal-content';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  h2.appendChild(createConvertHeaderSVG());
  h2.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Converter BIG para SPL' : 'Convert BIG to SPL')));
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('data-action', 'closeConvertModal');
  closeBtn.textContent = '×';
  header.appendChild(h2);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  const info = document.createElement('div');
  info.className = 'convert-info';
  const p1 = document.createElement('p');
  p1.innerHTML = getCurrentLang() === 'pt'
    ? 'Você será direcionado ao <strong>Dashboard</strong> para concluir a conversão dos seus tokens BIG para SPL (Solana).'
    : 'You will be redirected to the <strong>Dashboard</strong> to complete the conversion of your BIG tokens to SPL (Solana).';
  const p2 = document.createElement('p');
  p2.textContent = getCurrentLang() === 'pt'
    ? 'O processo é rápido e seguro. Após a conversão, os tokens SPL aparecerão na sua carteira Solana.'
    : 'The process is fast and secure. After conversion, the SPL tokens will appear in your Solana wallet.';
  info.appendChild(p1);
  info.appendChild(p2);

  const options = document.createElement('div');
  options.className = 'convert-options';
  options.style.justifyContent = 'center';
  options.style.gap = '0';
  const continueBtn = document.createElement('button');
  continueBtn.id = 'continueConvertBtn';
  continueBtn.appendChild(createExternalLinkSVG());
  continueBtn.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Abrir Dashboard' : 'Open Dashboard')));
  options.appendChild(continueBtn);

  body.appendChild(info);
  body.appendChild(options);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(overlay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  continueBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
    openDashboard();
  });

  const closeActions = ['closeConvertModal'];
  closeActions.forEach(action => {
    const elements = modal.querySelectorAll(`[data-action="${action}"]`);
    elements.forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      });
    });
  });

  setTimeout(() => modal.classList.add('show'), 10);
}

function createConvertHeaderSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#00D9FF');
  svg.setAttribute('stroke-width', '2');
  const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle1.setAttribute('cx', '12'); circle1.setAttribute('cy', '12'); circle1.setAttribute('r', '1');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 8v8m4-4H8');
  const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle2.setAttribute('cx', '16'); circle2.setAttribute('cy', '4'); circle2.setAttribute('r', '2');
  const circle3 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle3.setAttribute('cx', '8'); circle3.setAttribute('cy', '20'); circle3.setAttribute('r', '2');
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M9 18.5L15 5.5');
  svg.appendChild(circle1);
  svg.appendChild(path1);
  svg.appendChild(circle2);
  svg.appendChild(circle3);
  svg.appendChild(path2);
  return svg;
}

function createExternalLinkSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '15 3 21 3 21 9');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '10'); line.setAttribute('y1', '14');
  line.setAttribute('x2', '21'); line.setAttribute('y2', '3');
  svg.appendChild(path);
  svg.appendChild(polyline);
  svg.appendChild(line);
  return svg;
}

function openHistoryModal() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  showHistoryModal();
}

function showSendModal() {
  const existingModal = document.getElementById('sendModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'sendModal';
  modal.className = 'wallet-modal';
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-action', 'closeSendModal');

  const content = document.createElement('div');
  content.className = 'modal-content';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  const sendIcon = createSendIconSVG();
  sendIcon.setAttribute('width', '20');
  sendIcon.setAttribute('height', '20');
  h2.appendChild(sendIcon);
  h2.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Enviar BIG' : 'Send BIG')));
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('data-action', 'closeSendModal');
  closeBtn.textContent = '×';
  header.appendChild(h2);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';

  const formGroup1 = document.createElement('div');
  formGroup1.className = 'form-group';
  const label1 = document.createElement('label');
  label1.textContent = getCurrentLang() === 'pt' ? 'Endereço de destino' : 'Recipient address';
  const input1 = document.createElement('input');
  input1.type = 'text';
  input1.id = 'sendToAddress';
  input1.className = 'form-input';
  input1.placeholder = 'big...';
  input1.autocomplete = 'off';
  formGroup1.appendChild(label1);
  formGroup1.appendChild(input1);

  const formGroup2 = document.createElement('div');
  formGroup2.className = 'form-group';
  const label2 = document.createElement('label');
  label2.textContent = getCurrentLang() === 'pt' ? 'Quantidade (BIG)' : 'Amount (BIG)';
  const wrapper = document.createElement('div');
  wrapper.className = 'amount-input-wrapper';
  const input2 = document.createElement('input');
  input2.type = 'number';
  input2.id = 'sendAmount';
  input2.className = 'form-input';
  input2.step = '0.000001';
  input2.min = '0';
  input2.placeholder = '0.00';
  const maxBtn = document.createElement('button');
  maxBtn.className = 'max-btn';
  maxBtn.id = 'sendMaxBtn';
  maxBtn.textContent = getCurrentLang() === 'pt' ? 'MÁX' : 'MAX';
  wrapper.appendChild(input2);
  wrapper.appendChild(maxBtn);
  formGroup2.appendChild(label2);
  formGroup2.appendChild(wrapper);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-primary';
  confirmBtn.id = 'confirmSendBtn';
  confirmBtn.textContent = getCurrentLang() === 'pt' ? 'Enviar' : 'Send';
  footer.appendChild(confirmBtn);

  body.appendChild(formGroup1);
  body.appendChild(formGroup2);
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  modal.appendChild(overlay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  const amountInput = input2;
  const confirmButton = confirmBtn;
  
  if (maxBtn) {
    maxBtn.addEventListener('click', () => {
      if (amountInput) amountInput.value = walletData.balance.toFixed(6);
    });
  }
  
  if (amountInput) {
    amountInput.addEventListener('input', () => {});
  }
  
  if (confirmButton) {
    confirmButton.addEventListener('click', () => confirmSend(modal));
  }
  
  const closeActions = ['closeSendModal'];
  closeActions.forEach(action => {
    const elements = modal.querySelectorAll(`[data-action="${action}"]`);
    elements.forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      });
    });
  });
  
  setTimeout(() => modal.classList.add('show'), 10);
}

async function confirmSend(modal) {
  const toAddress = modal.querySelector('#sendToAddress')?.value.trim();
  const amount = parseFloat(modal.querySelector('#sendAmount')?.value || 0);
  
  if (!toAddress || !toAddress.startsWith('big')) {
    showWalletError(getCurrentLang() === 'pt' ? 'Endereço inválido!' : 'Invalid address!');
    return;
  }
  
  if (amount <= 0) {
    showWalletError(getCurrentLang() === 'pt' ? 'Quantidade inválida!' : 'Invalid amount!');
    return;
  }
  
  if (amount > walletData.balance) {
    showWalletError(getCurrentLang() === 'pt' ? 'Saldo insuficiente!' : 'Insufficient balance!');
    return;
  }
  
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 300);
  
  const confirmMsg = getCurrentLang() === 'pt'
    ? `Confirma envio de ${amount.toFixed(6)} BIG para:\n${toAddress}?`
    : `Confirm sending ${amount.toFixed(6)} BIG to:\n${toAddress}?`;
  
  if (confirm(confirmMsg)) {
    await executeSend(toAddress, amount);
  }
}

async function executeSend(toAddress, amount) {
  try {
    const result = await window.electronAPI.sendTransaction({
      to: toAddress, amount, from: walletData.address
    });
    
    if (result.success) {
      const newTx = {
        type: 'sent',
        amount: amount,
        address: toAddress,
        date: new Date().toISOString(),
        dateFormatted: formatRelativeDate(new Date().toISOString()),
        hash: result.txHash || 'pending',
        status: 'pending'
      };
      
      walletData.transactions.unshift(newTx);
      
      const historyList = document.getElementById('historyTransactionsList');
      if (historyList) {
        const txElement = createTransactionItemElement(newTx);
        historyList.prepend(txElement);
      }
      
      showWalletError(getCurrentLang() === 'pt' ? '✅ Transação enviada!' : '✅ Transaction sent!');
      await refreshBalance();
    } else {
      showWalletError(getCurrentLang() === 'pt' ? '❌ Erro ao enviar transação.' : '❌ Error sending transaction.');
    }
  } catch (error) {
    console.error('[SEND] Error:', error);
    showWalletError(getCurrentLang() === 'pt' ? '❌ Erro ao enviar transação.' : '❌ Error sending transaction.');
  }
}

function showReceiveModal() {
  const existingModal = document.getElementById('receiveModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'receiveModal';
  modal.className = 'wallet-modal';
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-action', 'closeReceiveModal');

  const content = document.createElement('div');
  content.className = 'modal-content';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  const recIcon = createReceiveIconSVG();
  recIcon.setAttribute('width', '20');
  recIcon.setAttribute('height', '20');
  h2.appendChild(recIcon);
  h2.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Receber BIG' : 'Receive BIG')));
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('data-action', 'closeReceiveModal');
  closeBtn.textContent = '×';
  header.appendChild(h2);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body receive-modal-body';

  const qrContainer = document.createElement('div');
  qrContainer.className = 'qr-container';
  qrContainer.id = 'qrcode';
  body.appendChild(qrContainer);

  const addrContainer = document.createElement('div');
  addrContainer.className = 'address-container';
  const code = document.createElement('code');
  code.className = 'receive-address';
  code.id = 'receiveAddress';
  code.textContent = walletData.address;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-address-btn';
  copyBtn.id = 'copyReceiveAddressBtn';
  copyBtn.appendChild(createCopyIconSVG());
  copyBtn.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Copiar' : 'Copy')));
  addrContainer.appendChild(code);
  addrContainer.appendChild(copyBtn);

  const info = document.createElement('div');
  info.className = 'receive-info';
  const infoIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  infoIcon.setAttribute('width', '16');
  infoIcon.setAttribute('height', '16');
  infoIcon.setAttribute('viewBox', '0 0 24 24');
  infoIcon.setAttribute('fill', 'none');
  infoIcon.setAttribute('stroke', 'currentColor');
  infoIcon.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '12'); line1.setAttribute('y1', '8'); line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '12'); line2.setAttribute('y1', '16'); line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '16');
  infoIcon.appendChild(circle);
  infoIcon.appendChild(line1);
  infoIcon.appendChild(line2);
  const infoSpan = document.createElement('span');
  infoSpan.textContent = getCurrentLang() === 'pt' 
    ? 'Envie apenas BIG para este endereço. Enviar outros ativos pode resultar em perda de fundos.' 
    : 'Only send BIG to this address. Sending other assets may result in loss of funds.';
  info.appendChild(infoIcon);
  info.appendChild(infoSpan);

  body.appendChild(addrContainer);
  body.appendChild(info);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(overlay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  generateQRCode(walletData.address);

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(walletData.address);
    showCopyFeedback(getCurrentLang() === 'pt' ? 'Endereço copiado!' : 'Address copied!');
  });
  
  const closeActions = ['closeReceiveModal'];
  closeActions.forEach(action => {
    const elements = modal.querySelectorAll(`[data-action="${action}"]`);
    elements.forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      });
    });
  });
  
  setTimeout(() => modal.classList.add('show'), 10);
}

function showHistoryModal() {
  const existingModal = document.getElementById('historyModal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'historyModal';
  modal.className = 'wallet-modal';
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-action', 'closeHistoryModal');

  const content = document.createElement('div');
  content.className = 'modal-content modal-content-large';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  const histIcon = createHistoryIconSVG();
  histIcon.setAttribute('width', '20');
  histIcon.setAttribute('height', '20');
  h2.appendChild(histIcon);
  h2.appendChild(document.createTextNode(' ' + (getCurrentLang() === 'pt' ? 'Histórico de Transações' : 'Transaction History')));
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('data-action', 'closeHistoryModal');
  closeBtn.textContent = '×';
  header.appendChild(h2);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body history-modal';

  const filters = document.createElement('div');
  filters.className = 'history-filters';
  const allBtn = createFilterButton('all', getCurrentLang() === 'pt' ? 'Todas' : 'All', true);
  const sentBtn = createFilterButton('sent', getCurrentLang() === 'pt' ? 'Enviadas' : 'Sent');
  sentBtn.prepend(createSendSmallIcon());
  const recvBtn = createFilterButton('received', getCurrentLang() === 'pt' ? 'Recebidas' : 'Received');
  recvBtn.prepend(createReceiveSmallIcon());
  filters.appendChild(allBtn);
  filters.appendChild(sentBtn);
  filters.appendChild(recvBtn);

  const list = document.createElement('div');
  list.className = 'transactions-list';
  list.id = 'historyTransactionsList';

  if (walletData.transactions && walletData.transactions.length > 0) {
    walletData.transactions.forEach(tx => {
      list.appendChild(createTransactionItemElement(tx));
    });
  } else {
    const empty = createEmptyTransactions();
    list.appendChild(empty);
  }

  const historyInfo = document.createElement('div');
  historyInfo.className = 'history-info';
  const infoIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  infoIcon.setAttribute('width', '16');
  infoIcon.setAttribute('height', '16');
  infoIcon.setAttribute('viewBox', '0 0 24 24');
  infoIcon.setAttribute('fill', 'none');
  infoIcon.setAttribute('stroke', 'currentColor');
  infoIcon.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '12'); line1.setAttribute('y1', '8'); line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '12'); line2.setAttribute('y1', '16'); line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '16');
  infoIcon.appendChild(circle);
  infoIcon.appendChild(line1);
  infoIcon.appendChild(line2);
  const infoSpan = document.createElement('span');
  infoSpan.textContent = getCurrentLang() === 'pt' 
    ? 'As transações são atualizadas automaticamente quando o node está conectado' 
    : 'Transactions are updated automatically when the node is connected';
  historyInfo.appendChild(infoIcon);
  historyInfo.appendChild(infoSpan);

  body.appendChild(filters);
  body.appendChild(list);
  body.appendChild(historyInfo);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(overlay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  setupHistoryFilters(modal);
  
  const closeActions = ['closeHistoryModal'];
  closeActions.forEach(action => {
    const elements = modal.querySelectorAll(`[data-action="${action}"]`);
    elements.forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      });
    });
  });
  
  setTimeout(() => modal.classList.add('show'), 10);
}

function createFilterButton(filterValue, text, isActive = false) {
  const btn = document.createElement('button');
  btn.className = 'filter-btn' + (isActive ? ' active' : '');
  btn.dataset.filter = filterValue;
  btn.textContent = text;
  return btn;
}

function createSendSmallIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '22'); line.setAttribute('y1', '2');
  line.setAttribute('x2', '11'); line.setAttribute('y2', '13');
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');
  svg.appendChild(line);
  svg.appendChild(polygon);
  return svg;
}

function createReceiveSmallIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '22 12 18 12 15 21 9 3 6 12 2 12');
  svg.appendChild(polyline);
  return svg;
}

function createEmptyTransactions() {
  const empty = document.createElement('div');
  empty.className = 'empty-transactions';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  const lines = [
    ['12', '2', '12', '6'], ['12', '18', '12', '22'],
    ['4.93', '4.93', '7.76', '7.76'], ['16.24', '16.24', '19.07', '19.07'],
    ['2', '12', '6', '12'], ['18', '12', '22', '12'],
    ['4.93', '19.07', '7.76', '16.24'], ['16.24', '7.76', '19.07', '4.93']
  ];
  lines.forEach(([x1, y1, x2, y2]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    svg.appendChild(line);
  });
  const p = document.createElement('p');
  p.textContent = getCurrentLang() === 'pt' ? 'Nenhuma transação ainda' : 'No transactions yet';
  const hint = document.createElement('span');
  hint.className = 'empty-hint';
  hint.textContent = getCurrentLang() === 'pt' ? 'Suas transações aparecerão aqui' : 'Your transactions will appear here';
  empty.appendChild(svg);
  empty.appendChild(p);
  empty.appendChild(hint);
  return empty;
}

function createTransactionItemElement(tx) {
  const isSent = tx.type === 'sent';
  const typeClass = isSent ? 'tx-sent' : 'tx-received';
  const typeText = isSent
    ? (getCurrentLang() === 'pt' ? 'Enviado' : 'Sent')
    : (getCurrentLang() === 'pt' ? 'Recebido' : 'Received');
  const amountSign = isSent ? '-' : '+';
  const amountClass = isSent ? 'amount-negative' : 'amount-positive';
  const displayDate = tx.dateFormatted || formatRelativeDate(tx.date);
  const addressDisplay = tx.address ? (tx.address.substring(0, 16) + '...') : 'Unknown';

  const item = document.createElement('div');
  item.className = `transaction-item ${typeClass}`;
  item.dataset.type = tx.type;

  const icon = document.createElement('div');
  icon.className = 'tx-icon';
  icon.textContent = isSent ? '↑' : '↓';

  const details = document.createElement('div');
  details.className = 'tx-details';

  const main = document.createElement('div');
  main.className = 'tx-main';
  const typeSpan = document.createElement('span');
  typeSpan.className = 'tx-type';
  typeSpan.textContent = typeText;
  const amountSpan = document.createElement('span');
  amountSpan.className = `tx-amount ${amountClass}`;
  amountSpan.textContent = `${amountSign} ${tx.amount.toFixed(2)} BIG`;
  main.appendChild(typeSpan);
  main.appendChild(amountSpan);

  const secondary = document.createElement('div');
  secondary.className = 'tx-secondary';
  const addrSpan = document.createElement('span');
  addrSpan.className = 'tx-address';
  addrSpan.textContent = addressDisplay;
  const dateSpan = document.createElement('span');
  dateSpan.className = 'tx-date';
  dateSpan.textContent = displayDate;
  secondary.appendChild(addrSpan);
  secondary.appendChild(dateSpan);

  details.appendChild(main);
  details.appendChild(secondary);

  if (tx.hash) {
    const hashDiv = document.createElement('div');
    hashDiv.className = 'tx-hash';
    hashDiv.title = tx.hash;
    hashDiv.textContent = 'TX: ' + tx.hash.substring(0, 16) + '...';
    details.appendChild(hashDiv);
  }

  const status = document.createElement('div');
  status.className = `tx-status ${tx.status || 'confirmed'}`;
  const dot = document.createElement('span');
  dot.className = `status-dot ${tx.status === 'pending' ? 'pending' : 'confirmed'}`;
  status.appendChild(dot);

  item.appendChild(icon);
  item.appendChild(details);
  item.appendChild(status);

  return item;
}

function setupHistoryFilters(modal) {
  const filterButtons = modal.querySelectorAll('.filter-btn');
  const transactionsList = modal.querySelector('#historyTransactionsList');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      const allTx = transactionsList.querySelectorAll('.transaction-item');
      
      allTx.forEach(tx => {
        if (filter === 'all') {
          tx.style.display = '';
        } else {
          tx.style.display = tx.dataset.type === filter ? '' : 'none';
        }
      });
    });
  });
}

async function refreshBalance() {
  const refreshBtn = document.getElementById('refreshBalanceBtn');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  
  try {
    const result = await window.electronAPI.getWalletData();
    if (result.success) {
      walletData.balance = result.data.balance;
      walletData.pendingBalance = result.data.pendingBalance || 0;
      walletData.transactions = result.data.transactions || [];
      
      const balanceEl = document.getElementById('balanceValue');
      if (balanceEl) balanceEl.textContent = walletData.balance.toFixed(2);
      
      const pendingEl = document.querySelector('.balance-item-value');
      if (pendingEl) pendingEl.textContent = walletData.pendingBalance.toFixed(2) + ' BIG';
      
      const historyList = document.getElementById('historyTransactionsList');
      if (historyList) {
        historyList.replaceChildren();
        if (walletData.transactions.length > 0) {
          walletData.transactions.forEach(tx => {
            historyList.appendChild(createTransactionItemElement(tx));
          });
        } else {
          historyList.appendChild(createEmptyTransactions());
        }
      }
    }
  } catch (error) {
    console.error('[REFRESH] Error:', error);
  } finally {
    if (refreshBtn) {
      setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    }
  }
}

function openDashboard() {
  if (window.electronAPI?.openDashboard) {
    window.electronAPI.openDashboard();
  } else {
    window.open(DASHBOARD_URL, '_blank', 'noopener,noreferrer');
  }
}

function generateQRCode(address) {
  const qrcodeEl = document.getElementById('qrcode');
  if (!qrcodeEl) return;
  
  qrcodeEl.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'qr-placeholder';
  const inner = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'qr-placeholder-title';
  title.textContent = 'QR Code';
  const addr = document.createElement('div');
  addr.className = 'qr-placeholder-addr';
  addr.textContent = address.substring(0, 20) + '...';
  const hint = document.createElement('div');
  hint.className = 'qr-placeholder-hint';
  hint.textContent = 'Escaneie para receber';
  inner.appendChild(title);
  inner.appendChild(addr);
  inner.appendChild(hint);
  placeholder.appendChild(inner);
  qrcodeEl.appendChild(placeholder);
}

function showWalletError(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showWalletCreatedNotification() {
  const notification = document.createElement('div');
  notification.className = 'wallet-created-notification';
  const icon = document.createElement('div');
  icon.className = 'notification-icon';
  icon.textContent = '🎉';
  const content = document.createElement('div');
  content.className = 'notification-content';
  const title = document.createElement('div');
  title.className = 'notification-title';
  title.textContent = getCurrentLang() === 'pt' ? 'Wallet Criada!' : 'Wallet Created!';
  const message = document.createElement('div');
  message.className = 'notification-message';
  message.textContent = getCurrentLang() === 'pt' 
    ? 'Sua wallet foi criada com sucesso!' 
    : 'Your wallet has been created successfully!';
  content.appendChild(title);
  content.appendChild(message);
  notification.appendChild(icon);
  notification.appendChild(content);
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

function showCopyFeedback(message) {
  const feedback = document.createElement('div');
  feedback.className = 'copy-feedback';
  feedback.textContent = message;
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.classList.add('fade-out');
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return getCurrentLang() === 'pt' ? 'Agora mesmo' : 'Just now';
  } else if (diffMins < 60) {
    return getCurrentLang() === 'pt' ? `${diffMins} min atrás` : `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return getCurrentLang() === 'pt' ? `${diffHours}h atrás` : `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return getCurrentLang() === 'pt' ? '1 dia atrás' : '1 day ago';
  } else if (diffDays < 30) {
    return getCurrentLang() === 'pt' ? `${diffDays} dias atrás` : `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(getCurrentLang() === 'pt' ? 'pt-BR' : 'en-US');
  }
}

// Funções internas — não mais expostas no window

async function copyAddress() {
  const address = document.getElementById('walletAddress')?.textContent;
  if (!address || walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  
  navigator.clipboard.writeText(address).then(() => {
    showCopyFeedback(getCurrentLang() === 'pt' ? 'Endereço copiado!' : 'Address copied!');
  });
}

async function copyPrivateKey() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  
  const privateKey = document.getElementById('walletPrivateKey')?.textContent;
  if (!privateKey || privateKey === '***************************') {
    showWalletError(getCurrentLang() === 'pt' ? 'Revele a chave privada primeiro' : 'Reveal private key first');
    return;
  }
  
  const confirmed = confirm(
    getCurrentLang() === 'pt' 
      ? 'ATENÇÃO: Nunca compartilhe sua chave privada! Deseja copiar?' 
      : 'WARNING: Never share your private key! Copy anyway?'
  );
  
  if (confirmed) {
    navigator.clipboard.writeText(privateKey).then(() => {
      showCopyFeedback(getCurrentLang() === 'pt' ? 'Chave privada copiada!' : 'Private key copied!');
    });
  }
}

async function togglePrivateKey() {
  if (walletData.notCreated) {
    showWalletError(getCurrentLang() === 'pt' ? 'Wallet ainda não foi criada' : 'Wallet not created yet');
    return;
  }
  
  const privateKeyEl = document.getElementById('walletPrivateKey');
  const eyeIcon = document.querySelector('#togglePrivateKeyBtn svg');
  
  if (!privateKeyEl) return;
  
  if (privateKeyEl.classList.contains('hidden')) {
    try {
      const result = await window.electronAPI.exportPrivateKey(true);
      
      if (result.success) {
        privateKeyEl.textContent = result.privateKey;
        privateKeyEl.classList.remove('hidden');
        privateKeyEl.classList.add('revealed');
        setTimeout(() => privateKeyEl.classList.remove('revealed'), 600);
        
        if (eyeIcon) {
          eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        }
      } else {
        showWalletError(getCurrentLang() === 'pt' ? 'Operação cancelada' : 'Operation cancelled');
      }
    } catch (error) {
      showWalletError(getCurrentLang() === 'pt' ? 'Erro ao carregar chave privada' : 'Error loading private key');
    }
  } else {
    privateKeyEl.textContent = '***************************';
    privateKeyEl.classList.add('hidden');
    
    if (eyeIcon) {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    }
  }
}

function addWalletStyles() {
  // CSS deve estar no wallet.css
}

export function cleanupWallet() {
  restoreFaqOnExit();
}