import { initializeFirebase } from './auth.js';
import { t, currentLang } from './i18n.js';

let db = null;
let auth = null;

const WEBSITE_URL = 'https://bigfootconnect.tech';

export function initializeWallet() {
    console.log('[WALLET] Inicializando...');
    
    const firebaseApp = initializeFirebase();
    if (!firebaseApp || !firebaseApp.db || !firebaseApp.auth) {
        console.error('[WALLET] Firebase não inicializado.');
        return;
    }
    
    db = firebaseApp.db;
    auth = firebaseApp.auth;
    
    const walletPage = document.getElementById('page-wallet');
    if (!walletPage) {
        console.error('[WALLET] Elemento page-wallet não encontrado.');
        return;
    }

    renderWalletUI(walletPage);
    addWalletStyles();
}

function renderWalletUI(container) {
    container.innerHTML = '';
    
    const title = document.createElement('h1');
    title.className = 'page-title';
    title.textContent = '💼 ' + t('walletTitle');
    title.setAttribute('data-i18n', 'walletTitle');
    container.appendChild(title);
    
    const mainContainer = document.createElement('div');
    mainContainer.className = 'wallet-redirect-container';
    
    const card = document.createElement('div');
    card.className = 'card wallet-redirect-card';
    
    const icon = document.createElement('div');
    icon.className = 'redirect-icon';
    icon.textContent = '🌐';
    card.appendChild(icon);
    
    const heading = document.createElement('h2');
    heading.textContent = t('walletConnectTitle');
    heading.setAttribute('data-i18n', 'walletConnectTitle');
    card.appendChild(heading);
    
    const description = document.createElement('p');
    description.className = 'redirect-description';
    description.textContent = t('walletDescription');
    description.setAttribute('data-i18n', 'walletDescription');
    card.appendChild(description);
    
    const features = document.createElement('div');
    features.className = 'features-list';
    features.innerHTML = `
        <div class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span data-i18n="walletFeature1">${t('walletFeature1')}</span>
        </div>
        <div class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span data-i18n="walletFeature2">${t('walletFeature2')}</span>
        </div>
        <div class="feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span data-i18n="walletFeature3">${t('walletFeature3')}</span>
        </div>
    `;
    card.appendChild(features);
    
    const button = document.createElement('button');
    button.className = 'primary-button redirect-button';
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        <span data-i18n="walletOpenButton">${t('walletOpenButton')}</span>
    `;
    button.addEventListener('click', openWebsite);
    card.appendChild(button);
    
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';
    urlDisplay.innerHTML = `
        <span class="url-label" data-i18n="walletUrlLabel">${t('walletUrlLabel')}</span>
        <code class="url-code">${WEBSITE_URL}</code>
        <button class="copy-url-btn" id="copyUrlBtn" title="${currentLang === 'pt' ? 'Copiar URL' : 'Copy URL'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        </button>
    `;
    card.appendChild(urlDisplay);
    
    mainContainer.appendChild(card);
    container.appendChild(mainContainer);
    
    const copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyUrl);
    }
}

function openWebsite() {
    const url = WEBSITE_URL + '/wallet';
    
    console.log('[WALLET] 🌐 Abrindo no navegador externo:', url);
    
    // Tenta usar a API do Electron primeiro
    if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url);
        console.log('[WALLET] ✅ Aberto via Electron API');
    } 
    // Fallback para método tradicional
    else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('[WALLET] ✅ Aberto via link tradicional');
    }
}

function copyUrl() {
    navigator.clipboard.writeText(WEBSITE_URL).then(() => {
        const copyBtn = document.getElementById('copyUrlBtn');
        if (!copyBtn) return;
        
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        copyBtn.style.background = '#10b981';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('[WALLET] Erro ao copiar:', err);
    });
}

function addWalletStyles() {
    if (document.getElementById('wallet-redirect-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'wallet-redirect-styles';
    style.textContent = `
        .wallet-redirect-container {
            max-width: 500px;
            margin: 0 auto;
            padding: 0;
        }
        
        .wallet-redirect-card {
            text-align: center;
            padding: 1.1rem 1rem;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15));
            border: 2px solid rgba(139, 92, 246, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .wallet-redirect-card::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--primary-color), #3b82f6);
        }
        
        .redirect-icon {
            font-size: 2.2rem;
            margin-bottom: 0.5rem;
            animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }
        
        .wallet-redirect-card h2 {
            font-size: 1.15em;
            margin: 0 0 0.5rem;
            background: linear-gradient(135deg, var(--primary-color), #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .redirect-description {
            color: #d1d5db;
            font-size: 0.82em;
            line-height: 1.35;
            margin: 0 0 0.9rem;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .features-list {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            margin: 0.9rem 0;
            text-align: left;
            max-width: 360px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .feature-item {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 0.5rem 0.8rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 7px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        
        .feature-item:hover {
            background: rgba(139, 92, 246, 0.2);
            border-color: rgba(139, 92, 246, 0.4);
            transform: translateX(5px);
        }
        
        .feature-item svg {
            flex-shrink: 0;
            color: #10b981;
            width: 15px;
            height: 15px;
        }
        
        .feature-item span {
            color: #e5e7eb;
            font-size: 0.81em;
        }
        
        .redirect-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0.7rem 1.6rem;
            font-size: 0.95em;
            margin: 0.8rem 0 0.6rem 0;
            background: linear-gradient(135deg, var(--primary-color), #3b82f6);
            border: none;
            color: #fff;
            font-weight: 600;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            border-radius: 8px;
        }
        
        .redirect-button::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }
        
        .redirect-button:hover::before {
            width: 300px;
            height: 300px;
        }
        
        .redirect-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
        }
        
        .redirect-button svg {
            z-index: 1;
            width: 17px;
            height: 17px;
        }
        
        .redirect-button span {
            z-index: 1;
        }
        
        .url-display {
            margin-top: 0.9rem;
            padding: 0.65rem;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 7px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            flex-wrap: wrap;
        }
        
        .url-label {
            color: #9ca3af;
            font-size: 0.72em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .url-code {
            font-family: "Courier New", monospace;
            color: var(--primary-color);
            font-size: 0.84em;
            padding: 0.2rem 0.6rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            display: inline-block;
        }
        
        .copy-url-btn {
            padding: 0.3rem 0.55rem;
            background: rgba(139, 92, 246, 0.2);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 5px;
            color: #a78bfa;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        
        .copy-url-btn:hover {
            background: rgba(139, 92, 246, 0.3);
            border-color: rgba(139, 92, 246, 0.5);
            transform: translateY(-2px);
        }
        
        @media (max-width: 640px) {
            .wallet-redirect-container {
                padding: 0;
            }
            
            .wallet-redirect-card {
                padding: 1rem 0.9rem;
            }
            
            .redirect-icon {
                font-size: 2rem;
            }
            
            .wallet-redirect-card h2 {
                font-size: 1.1em;
            }
            
            .redirect-description {
                font-size: 0.8em;
            }
            
            .redirect-button {
                padding: 0.65rem 1.4rem;
                font-size: 0.9em;
            }
            
            .feature-item span {
                font-size: 0.78em;
            }
        }
    `;
    document.head.appendChild(style);
}

export function cleanupWallet() {
    console.log('[WALLET] Cleanup');
}

export async function addBigTokenContribution(userId, amount) {
    console.log('[WALLET] Contribuição registrada:', userId, amount);
}