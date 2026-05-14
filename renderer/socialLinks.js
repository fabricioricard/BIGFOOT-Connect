// ==========================================
// MÓDULO DE GERENCIAMENTO DE LINKS SOCIAIS
// ==========================================

const SOCIAL_LINKS = {
    x: 'https://x.com/BIGFOOT_Connect',
    youtube: 'https://www.youtube.com/@BIGFOOTConnect',
    discord: 'https://discord.gg/mkfmncN5Sa',
    telegram: 'https://t.me/+qrkA9s2VTxVhMzcx'
};

/**
 * Abre link externo no navegador do usuário
 * @param {string} url - URL a ser aberta
 */
// Domínios permitidos — deve espelhar a whitelist do preload.js e main.js
const ALLOWED_PROTOCOLS = ['https:'];
const ALLOWED_DOMAINS = [
    'x.com', 'twitter.com',
    'www.youtube.com', 'youtube.com',
    'discord.gg',
    't.me', 'telegram.me'
];

function isUrlSafe(url) {
    try {
        const parsed = new URL(url);
        if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false;
        return ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
    } catch (e) {
        return false;
    }
}

function openExternalLink(url) {
    // Fix 1: valida protocolo e domínio antes de qualquer abertura
    if (!url || !isUrlSafe(url)) return;

    // Tenta usar a API do Electron primeiro (já valida novamente no preload)
    if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url).catch(() => {});
    } else {
        // Fallback — apenas https: já garantido por isUrlSafe
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

/**
 * Abre rede social específica
 * @param {string} platform - Nome da plataforma (twitter, youtube, discord, telegram)
 */
export function openSocialLink(platform) {
    const url = SOCIAL_LINKS[platform.toLowerCase()];
    
    if (!url) {
        return;
    }
    
    openExternalLink(url);
}

/**
 * Inicializa os botões de redes sociais
 */
export function initializeSocialLinks() {
    
    const socialContainer = document.getElementById('socialIcons');
    if (!socialContainer) {
        return;
    }
    
    // Pega todos os links dentro do container
    const socialLinks = socialContainer.querySelectorAll('a');
    
    
    socialLinks.forEach((link, index) => {
        // Remove comportamento padrão
        link.removeAttribute('href');
        link.removeAttribute('target');
        
        // Identifica a plataforma pelo alt da imagem ou aria-label
        const ariaLabel = link.getAttribute('aria-label')?.toLowerCase();
        const img = link.querySelector('img');
        const imgAlt = img?.getAttribute('alt')?.toLowerCase();
        
        const platform = ariaLabel || imgAlt;
        
        // Remove listeners antigos clonando
        const newLink = link.cloneNode(true);
        // Fix 8: restaura acessibilidade após remover href/target
        newLink.setAttribute('role', 'button');
        newLink.setAttribute('tabindex', '0');
        link.parentNode.replaceChild(newLink, link);
        
        // Adiciona novo listener
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Fix 4 & 7: valida platform contra whitelist de chaves do SOCIAL_LINKS
            const VALID_PLATFORMS = Object.keys(SOCIAL_LINKS);
            const key = VALID_PLATFORMS.includes(platform) ? platform : null;
            if (key) {
                openSocialLink(key);
            }
        });
        
        // Fix 5: feedback visual via classe CSS — sem style inline (viola CSP)
        newLink.classList.add('social-link-btn');
    });
}

/**
 * Cleanup dos event listeners
 */
export function cleanupSocialLinks() {
    // Os listeners são removidos automaticamente quando os elementos são substituídos
}

/**
 * Atualiza URLs das redes sociais (útil para configuração dinâmica)
 * @param {Object} newLinks - Objeto com novos links
 */
export function updateSocialLinks(newLinks) {
    // Fix 2: valida cada URL antes de aplicar — previne injeção de javascript: ou file://
    if (!newLinks || typeof newLinks !== 'object') return;
    Object.entries(newLinks).forEach(([key, url]) => {
        if (Object.prototype.hasOwnProperty.call(SOCIAL_LINKS, key) && isUrlSafe(url)) {
            SOCIAL_LINKS[key] = url;
        }
    });
}

/**
 * Obtém todos os links sociais
 * @returns {Object} Objeto com todos os links
 */
export function getSocialLinks() {
    return { ...SOCIAL_LINKS };
}

// window.socialLinks removido — expunha updateSocialLinks que permitia injeção de URLs arbitrárias