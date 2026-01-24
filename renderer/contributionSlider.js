import { t, currentLang } from './i18n.js';

let currentLevel = 4;
let onLevelChangeCallback = null;

const levels = {
  1: {
    nameKey: 'levelLow',
    icon: '🔋',
    cpu: '~25%',
    threads: 1,
    descKey: 'levelLowDesc',
    color: '#3b82f6'
  },
  2: {
    nameKey: 'levelMedium',
    icon: '⚡',
    cpu: '~45%',
    threads: 2,
    descKey: 'levelMediumDesc',
    color: '#8b5cf6'
  },
  3: {
    nameKey: 'levelHigh',
    icon: '🔥',
    cpu: '~60%',
    threads: 3,
    descKey: 'levelHighDesc',
    color: '#ec4899'
  },
  4: {
    nameKey: 'levelMaximum',
    icon: '🚀',
    cpu: '~70%',
    threads: 4,
    descKey: 'levelMaximumDesc',
    color: '#00ff87'
  }
};

export function initializeContributionSlider(onChange) {
  console.log('[SLIDER] Inicializando contribution slider...');
  
  onLevelChangeCallback = onChange;
  
  // Renderiza o HTML do slider
  renderSlider();
  
  // Adiciona estilos
  addSliderStyles();
  
  // Setup event listeners
  setupSliderEvents();
  
  // Carrega nível salvo
  const savedLevel = localStorage.getItem('contributionLevel');
  if (savedLevel) {
    currentLevel = parseInt(savedLevel);
    updateSlider(currentLevel, false);
  } else {
    updateSlider(4, false);
  }
  
  console.log('[SLIDER] ✅ Slider inicializado');
}

function renderSlider() {
  const container = document.getElementById('threadSelectorContainer');
  if (!container) {
    console.error('[SLIDER] Container #threadSelectorContainer não encontrado');
    return;
  }
  
  container.innerHTML = `
    <div class="contribution-slider-wrapper">
      <div class="slider-header">
        <div class="current-level" id="sliderCurrentLevel">🚀 Maximum</div>
        <div class="level-info">
          <div class="info-item">
            <span class="info-label" data-i18n="cpuUsageLabel">CPU Usage</span>
            <span class="info-value" id="sliderCpuUsage">~70%</span>
          </div>
        </div>
      </div>

      <div class="slider-track-container">
        <div class="slider-track">
          <div class="slider-progress" id="sliderProgress"></div>
        </div>
        <input 
          type="range" 
          min="1" 
          max="4" 
          value="4" 
          class="slider-input" 
          id="contributionSliderInput"
        >
        <div class="slider-thumb" id="sliderThumb">
          <span id="sliderThumbIcon">🚀</span>
        </div>
      </div>

      <div class="level-markers">
        <div class="marker" data-level="1">
          <div class="marker-dot level-1" style="background: #3b82f6;"></div>
          <span class="marker-label level-1" data-i18n="levelLow">🔋 Low</span>
        </div>
        <div class="marker" data-level="2">
          <div class="marker-dot level-2" style="background: #8b5cf6;"></div>
          <span class="marker-label level-2" data-i18n="levelMedium">⚡ Medium</span>
        </div>
        <div class="marker" data-level="3">
          <div class="marker-dot level-3" style="background: #ec4899;"></div>
          <span class="marker-label level-3" data-i18n="levelHigh">🔥 High</span>
        </div>
        <div class="marker active" data-level="4">
          <div class="marker-dot level-4" style="background: #00ff87;"></div>
          <span class="marker-label level-4" data-i18n="levelMaximum">🚀 Maximum</span>
        </div>
      </div>

      <div class="level-description" id="sliderDescription" data-i18n="levelMaximumDesc">
        Maximum performance - Best for dedicated mining
      </div>
    </div>
  `;
}

function setupSliderEvents() {
  const slider = document.getElementById('contributionSliderInput');
  const markers = document.querySelectorAll('.marker');
  
  if (slider) {
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      updateSlider(value, true);
    });
  }
  
  markers.forEach(marker => {
    marker.addEventListener('click', () => {
      const level = parseInt(marker.dataset.level);
      const slider = document.getElementById('contributionSliderInput');
      if (slider) {
        slider.value = level;
        updateSlider(level, true);
      }
    });
  });
}

function updateSlider(value, triggerCallback = true) {
  currentLevel = value;
  localStorage.setItem('contributionLevel', value);
  
  const level = levels[value];
  const percentage = ((value - 1) / 3) * 100;
  
  // Update DOM elements
  const progress = document.getElementById('sliderProgress');
  const thumb = document.getElementById('sliderThumb');
  const thumbIcon = document.getElementById('sliderThumbIcon');
  const currentLevelEl = document.getElementById('sliderCurrentLevel');
  const cpuUsage = document.getElementById('sliderCpuUsage');
  const description = document.getElementById('sliderDescription');
  const markers = document.querySelectorAll('.marker');
  
  if (progress) {
    progress.style.width = percentage + '%';
    progress.style.background = `linear-gradient(90deg, #3b82f6, ${level.color})`;
  }
  
  if (thumb) {
    thumb.style.left = percentage + '%';
    thumb.style.boxShadow = `0 4px 20px ${level.color}80`;
  }
  
  if (thumbIcon) {
    thumbIcon.textContent = level.icon;
  }
  
  if (currentLevelEl) {
    currentLevelEl.textContent = `${level.icon} ${t(level.nameKey)}`;
    currentLevelEl.style.color = level.color;
  }
  
  if (cpuUsage) {
    cpuUsage.textContent = level.cpu;
  }
  
  if (description) {
    description.textContent = t(level.descKey);
  }
  
  // Update markers
  markers.forEach(marker => {
    if (parseInt(marker.dataset.level) === value) {
      marker.classList.add('active');
    } else {
      marker.classList.remove('active');
    }
  });
  
  // Trigger callback
  if (triggerCallback && onLevelChangeCallback) {
    onLevelChangeCallback(level.threads);
  }
  
  console.log(`[SLIDER] Nível atualizado: ${value} (${level.threads} threads)`);
}

export function updateSliderLanguage() {
  console.log('[SLIDER] 🌐 Atualizando idioma do slider...');
  updateSlider(currentLevel, false);
}

export function getCurrentLevel() {
  return currentLevel;
}

export function getCurrentThreads() {
  return levels[currentLevel].threads;
}

function addSliderStyles() {
  if (document.getElementById('contribution-slider-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'contribution-slider-styles';
  style.textContent = `
    .contribution-slider-wrapper {
      width: 100%;
      padding: 20px 0;
    }

    .slider-header {
      text-align: center;
      margin-bottom: 25px;
    }

    .current-level {
      font-size: 1.8em;
      font-weight: 700;
      margin: 10px 0;
      text-shadow: 0 0 20px rgba(0, 255, 135, 0.5);
    }

    .level-info {
      display: flex;
      justify-content: center;
      margin-top: 15px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      font-size: 0.9em;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .info-label {
      color: #888;
      font-size: 0.85em;
    }

    .info-value {
      font-weight: 600;
      font-size: 1.1em;
      color: #00ff87;
    }

    .slider-track-container {
      position: relative;
      margin: 30px 0;
    }

    .slider-track {
      position: relative;
      height: 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      overflow: hidden;
    }

    .slider-progress {
      position: absolute;
      height: 100%;
      border-radius: 10px;
      transition: all 0.3s ease;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #00ff87);
    }

    .slider-input {
      position: absolute;
      width: 100%;
      height: 12px;
      top: 0;
      left: 0;
      opacity: 0;
      cursor: pointer;
      z-index: 10;
    }

    .slider-thumb {
      position: absolute;
      width: 32px;
      height: 32px;
      background: white;
      border-radius: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 4px 20px rgba(0, 255, 135, 0.6);
      transition: all 0.3s ease;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      z-index: 5;
      pointer-events: none;
    }

    .slider-input:hover + .slider-thumb {
      transform: translate(-50%, -50%) scale(1.2);
      box-shadow: 0 6px 30px rgba(0, 255, 135, 0.8);
    }

    .level-markers {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      padding: 0 5px;
    }

    .marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      opacity: 0.5;
    }

    .marker.active {
      opacity: 1;
      transform: scale(1.1);
    }

    .marker-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .marker:hover .marker-dot {
      transform: scale(1.3);
    }

    .marker.active .marker-dot {
      box-shadow: 0 0 15px currentColor;
    }

    .marker-label {
      font-size: 0.85em;
      font-weight: 600;
      white-space: nowrap;
    }

    .level-1 { color: #3b82f6; }
    .level-2 { color: #8b5cf6; }
    .level-3 { color: #ec4899; }
    .level-4 { color: #00ff87; }

    .level-description {
      text-align: center;
      margin-top: 20px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      font-size: 0.9em;
      color: #aaa;
      min-height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1.4;
    }

    @media (max-width: 640px) {
      .current-level {
        font-size: 1.5em;
      }
      
      .marker-label {
        font-size: 0.75em;
      }
    }
  `;
  document.head.appendChild(style);
}

export function cleanupSlider() {
  console.log('[SLIDER] Cleanup');
  onLevelChangeCallback = null;
}