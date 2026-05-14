// ==========================================
// THEME MANAGER - VERSÃO APRIMORADA
// ==========================================

const VALID_THEMES = ['dark', 'light'];

class ThemeManager {
  constructor() {
    this.currentTheme = this.loadTheme();
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.applyTheme());
    } else {
      this.applyTheme();
    }
  }

  loadTheme() {
    try {
      const stored = localStorage.getItem('bigfootTheme');
      if (VALID_THEMES.includes(stored)) return stored;
    } catch (e) {}
    return 'dark'; // default
  }

  saveTheme(theme) {
    if (!VALID_THEMES.includes(theme)) return;
    try {
      localStorage.setItem('bigfootTheme', theme);
    } catch (e) {}
  }

  applyTheme() {
    // Aplicar tema ao documento
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(this.currentTheme);

    // Aplicar estilos específicos para cada tema
    this.applyThemeSpecificStyles();
    
    console.log(`[THEME] Tema aplicado: ${this.currentTheme}`);
  }

  applyThemeSpecificStyles() {
    if (this.currentTheme === 'light') {
      this.applyLightThemeStyles();
    } else {
      this.removeLightThemeStyles();
    }
  }

  applyLightThemeStyles() {
    // Adicionar meta viewport para melhor renderização
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewport);
    }

    // Garantir que o scrollbar tenha estilo adequado
    document.documentElement.style.colorScheme = 'light';
    
    // Adicionar classe específica para o body
    document.body.classList.add('light-theme-active');
  }

  removeLightThemeStyles() {
    document.documentElement.style.colorScheme = 'dark';
    document.body.classList.remove('light-theme-active');
  }

  toggle() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.saveTheme(this.currentTheme);
    this.applyTheme();
    
    // Disparar evento para outros componentes saberem da mudança
    const event = new CustomEvent('themeChanged', { detail: { theme: this.currentTheme } });
    window.dispatchEvent(event);
    
    return this.currentTheme;
  }

  getCurrentTheme() {
    return this.currentTheme;
  }
}

const themeManager = new ThemeManager();

export function toggleTheme() {
  return themeManager.toggle();
}

export function initializeTheme() {
  return themeManager.getCurrentTheme();
}