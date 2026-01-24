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
function openExternalLink(url) {
    console.log('[SOCIAL] 🌐 Abrindo link externo:', url);
    
    if (!url) {
        console.error('[SOCIAL] ❌ URL inválida');
        return;
    }
    
    // Valida se é uma URL válida
    try {
        new URL(url);
    } catch (e) {
        console.error('[SOCIAL] ❌ URL mal formatada:', url);
        return;
    }
    
    // Tenta usar a API do Electron primeiro
    if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url)
            .then(result => {
                if (result.success) {
                    console.log('[SOCIAL] ✅ Link aberto via Electron API');
                } else {
                    console.error('[SOCIAL] ❌ Erro ao abrir link:', result.message);
                }
            })
            .catch(error => {
                console.error('[SOCIAL] ❌ Erro na chamada do Electron:', error);
            });
    } 
    // Fallback para método tradicional
    else {
        console.warn('[SOCIAL] ⚠️ Electron API não disponível, usando fallback');
        window.open(url, '_blank', 'noopener,noreferrer');
        console.log('[SOCIAL] ✅ Link aberto via window.open');
    }
}

/**
 * Abre rede social específica
 * @param {string} platform - Nome da plataforma (twitter, youtube, discord, telegram)
 */
export function openSocialLink(platform) {
    const url = SOCIAL_LINKS[platform.toLowerCase()];
    
    if (!url) {
        console.error(`[SOCIAL] ❌ Plataforma desconhecida: ${platform}`);
        return;
    }
    
    openExternalLink(url);
}

/**
 * Inicializa os botões de redes sociais
 */
export function initializeSocialLinks() {
    console.log('[SOCIAL] 🔗 Inicializando links sociais...');
    
    const socialContainer = document.getElementById('socialIcons');
    if (!socialContainer) {
        console.error('[SOCIAL] ❌ Container #socialIcons não encontrado');
        return;
    }
    
    // Pega todos os links dentro do container
    const socialLinks = socialContainer.querySelectorAll('a');
    
    console.log('[SOCIAL] 📱 Links encontrados:', socialLinks.length);
    
    socialLinks.forEach((link, index) => {
        // Remove comportamento padrão
        link.removeAttribute('href');
        link.removeAttribute('target');
        
        // Identifica a plataforma pelo alt da imagem ou aria-label
        const ariaLabel = link.getAttribute('aria-label')?.toLowerCase();
        const img = link.querySelector('img');
        const imgAlt = img?.getAttribute('alt')?.toLowerCase();
        
        const platform = ariaLabel || imgAlt;
        
        console.log(`[SOCIAL] 🎯 Link ${index + 1}: ${platform}`);
        
        // Remove listeners antigos clonando
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        // Adiciona novo listener
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`[SOCIAL] 🖱️ Clicou em: ${platform}`);
            
            // Mapeia o nome para a chave correta
            const platformMap = {
                'x': 'x',
                'youtube': 'youtube',
                'discord': 'discord',
                'telegram': 'telegram'
            };
            
            const key = platformMap[platform];
            if (key) {
                openSocialLink(key);
            } else {
                console.error(`[SOCIAL] ❌ Plataforma não mapeada: ${platform}`);
            }
        });
        
        // Adiciona feedback visual
        newLink.style.cursor = 'pointer';
        newLink.style.transition = 'transform 0.2s, opacity 0.2s';
        
        newLink.addEventListener('mouseenter', () => {
            newLink.style.transform = 'scale(1.15)';
            newLink.style.opacity = '0.8';
        });
        
        newLink.addEventListener('mouseleave', () => {
            newLink.style.transform = 'scale(1)';
            newLink.style.opacity = '1';
        });
    });
    
    console.log('[SOCIAL] ✅ Links sociais inicializados');
}

/**
 * Cleanup dos event listeners
 */
export function cleanupSocialLinks() {
    console.log('[SOCIAL] 🧹 Limpando event listeners');
    // Os listeners são removidos automaticamente quando os elementos são substituídos
}

/**
 * Atualiza URLs das redes sociais (útil para configuração dinâmica)
 * @param {Object} newLinks - Objeto com novos links
 */
export function updateSocialLinks(newLinks) {
    Object.assign(SOCIAL_LINKS, newLinks);
    console.log('[SOCIAL] 🔄 Links atualizados:', SOCIAL_LINKS);
}

/**
 * Obtém todos os links sociais
 * @returns {Object} Objeto com todos os links
 */
export function getSocialLinks() {
    return { ...SOCIAL_LINKS };
}

// Expõe funções globalmente para debug
if (typeof window !== 'undefined') {
    window.socialLinks = {
        open: openSocialLink,
        getAll: getSocialLinks,
        update: updateSocialLinks
    };
}