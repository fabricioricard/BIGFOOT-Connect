// animated-dots.js
// Script para animar os pontos de "Compartilhando..."

class AnimatedDots {
  constructor() {
    this.dotsInterval = null;
    this.currentDots = 0;
  }

  // Inicia a animação de pontos
  start(elementId, baseText = 'Sharing') {
    this.stop(); // Para qualquer animação anterior
    
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Elemento ${elementId} não encontrado`);
      return;
    }

    this.dotsInterval = setInterval(() => {
      this.currentDots = (this.currentDots + 1) % 4; // 0, 1, 2, 3
      const dots = '.'.repeat(this.currentDots);
      element.textContent = `${baseText}${dots}`;
    }, 500); // Muda a cada 500ms
  }

  // Para a animação de pontos
  stop() {
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
      this.currentDots = 0;
    }
  }

  // Atualiza o texto base mantendo a animação
  updateBaseText(elementId, newBaseText) {
    if (this.dotsInterval) {
      // Se está animando, apenas muda o texto base
      const element = document.getElementById(elementId);
      if (element) {
        this.start(elementId, newBaseText);
      }
    }
  }
}

// Instância global para uso no app
window.animatedDots = new AnimatedDots();

// Função utilitária para uso fácil
window.startSharingAnimation = (elementId, baseText) => {
  window.animatedDots.start(elementId, baseText);
};

window.stopSharingAnimation = () => {
  window.animatedDots.stop();
};

// Integração com o sistema de tradução existente
window.updateSharingStatus = (isSharing, translations) => {
  const statusElement = document.getElementById('sharing-status');
  if (!statusElement) return;

  if (isSharing) {
    // Inicia animação com texto traduzido
    const baseText = translations.sharing || 'Sharing';
    window.animatedDots.start('sharing-status', baseText);
  } else {
    // Para animação e mostra status parado
    window.animatedDots.stop();
    statusElement.textContent = translations.stopped || 'Stopped';
  }
};

// Event listener para mudança de idioma
document.addEventListener('DOMContentLoaded', () => {
  // Monitora mudanças de idioma
  const originalChangeLanguage = window.changeLanguage;
  if (originalChangeLanguage) {
    window.changeLanguage = function(language) {
      // Salva estado atual da animação
      const wasAnimating = window.animatedDots.dotsInterval !== null;
      
      // Chama função original de mudança de idioma
      const result = originalChangeLanguage.call(this, language);
      
      // Se estava animando, reinicia com novo idioma
      if (wasAnimating) {
        // Aguarda um pouco para as traduções serem aplicadas
        setTimeout(() => {
          // Notifica o main process sobre mudança de idioma
          window.electronAPI.send('language-changed');
          
          // Verifica status atual e atualiza animação
          window.electronAPI.invoke('get-sharing-status').then(status => {
            if (status.isSharing) {
              const translations = getCurrentTranslations(); // Função que deve existir no seu código
              window.updateSharingStatus(true, translations);
            }
          });
        }, 100);
      }
      
      return result;
    };
  }
});

// Função auxiliar para obter traduções atuais (adapte conforme seu sistema)
function getCurrentTranslations() {
  // Esta função deve retornar as traduções atuais
  // Adapte conforme o sistema de tradução do seu app
  const currentLang = localStorage.getItem('language') || 'en';
  
  const translations = {
    'en': {
      sharing: 'Sharing',
      stopped: 'Stopped',
      connect: 'Connect',
      disconnect: 'Disconnect'
    },
    'pt': {
      sharing: 'Compartilhando',
      stopped: 'Parado',
      connect: 'Conectar',
      disconnect: 'Desconectar'
    },
    'es': {
      sharing: 'Compartiendo',
      stopped: 'Detenido',
      connect: 'Conectar',
      disconnect: 'Desconectar'
    }
  };
  
  return translations[currentLang] || translations['en'];
}