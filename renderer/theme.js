export function initializeTheme() {
  const savedTheme = localStorage.getItem('bigfootTheme') || 'dark';
  console.log('[THEME] Tema salvo:', savedTheme);
  
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    document.body.classList.remove('dark');
    applyLightTheme();
  } else {
    document.body.classList.add('dark');
    document.body.classList.remove('light');
    applyDarkTheme();
  }
}

export function toggleTheme(usageChart) {
  console.log('[THEME] Alternando tema...');
  const currentTheme = localStorage.getItem('bigfootTheme') || 'dark';
  
  if (currentTheme === 'dark') {
    applyLightTheme();
    localStorage.setItem('bigfootTheme', 'light');
  } else {
    applyDarkTheme();
    localStorage.setItem('bigfootTheme', 'dark');
  }
  
  if (usageChart) {
    setTimeout(() => {
      const isLight = currentTheme === 'dark';
      
      usageChart.options.scales.y.grid.color = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
      usageChart.options.scales.x.grid.color = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
      usageChart.options.scales.y.ticks.color = isLight ? '#1e293b' : '#f1f5f9';
      usageChart.options.scales.x.ticks.color = isLight ? '#1e293b' : '#f1f5f9';
      usageChart.options.scales.y.title.color = isLight ? '#0f172a' : '#f1f5f9';
      usageChart.options.scales.x.title.color = isLight ? '#0f172a' : '#f1f5f9';
      usageChart.options.plugins.legend.labels.color = isLight ? '#0f172a' : '#f1f5f9';
      usageChart.options.plugins.tooltip.backgroundColor = isLight ? 'rgba(15, 23, 42, 0.9)' : 'rgba(0, 0, 0, 0.8)';
      usageChart.options.plugins.tooltip.titleColor = '#ffffff';
      usageChart.options.plugins.tooltip.bodyColor = '#ffffff';
      
      usageChart.resize();
      usageChart.update();
      console.log('[THEME] Gráfico redesenhado após mudança de tema');
    }, 100);
  }
}

function applyDarkTheme() {
  console.log('[THEME] Aplicando tema escuro VERDE/PRETO');
  document.body.classList.remove('light');
  document.body.classList.add('dark');
  
  // Cores verde/preto
  document.documentElement.style.setProperty('--bg-color', '#0A0A0A');
  document.documentElement.style.setProperty('--text-color', '#F0F0F0');
  document.documentElement.style.setProperty('--card-color', '#1A1A1A');
  document.documentElement.style.setProperty('--primary-color', '#00FF87');
  document.documentElement.style.setProperty('--accent-color', '#00FF87');
  document.documentElement.style.setProperty('--secondary-accent', '#00D970');
  document.documentElement.style.setProperty('--shadow', '0 4px 12px rgba(0, 0, 0, 0.5)');
  document.documentElement.style.setProperty('--shadow-hover', '0 8px 20px rgba(0, 255, 135, 0.3)');
  document.documentElement.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.7)');
  
  document.body.style.background = '#0A0A0A';
  
  // Remove todos os estilos inline aplicados pelo modo claro
  const elementsToReset = document.querySelectorAll('[style]');
  elementsToReset.forEach(el => {
    if (!el.classList.contains('modal') && !el.classList.contains('page-content')) {
      // Reseta apenas estilos que não são estruturais
      el.style.color = '';
      el.style.background = '';
      el.style.backgroundColor = '';
      el.style.border = '';
      el.style.borderColor = '';
      el.style.borderWidth = '';
      el.style.boxShadow = '';
      el.style.fontWeight = '';
      el.style.fontSize = '';
      el.style.textShadow = '';
    }
  });
  
  // Remove styles dinâmicos
  const dynamicStyles = document.querySelectorAll('#light-theme-placeholders, #light-theme-select-hover');
  dynamicStyles.forEach(style => style.remove());
}

function applyLightTheme() {
  console.log('[THEME] Aplicando tema claro');
  document.body.classList.remove('dark');
  document.body.classList.add('light');
  
  // Cores para tema claro
  document.documentElement.style.setProperty('--bg-color', '#ffffff');
  document.documentElement.style.setProperty('--text-color', '#1f2937');
  document.documentElement.style.setProperty('--card-color', '#f9fafb');
  document.documentElement.style.setProperty('--primary-color', '#2563eb');
  document.documentElement.style.setProperty('--accent-color', '#059669');
  document.documentElement.style.setProperty('--shadow', '0 4px 12px rgba(0, 0, 0, 0.08)');
  document.documentElement.style.setProperty('--shadow-hover', '0 8px 20px rgba(0, 0, 0, 0.12)');
  document.documentElement.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.15)');
  
  document.body.style.background = '#ffffff';
  
  setTimeout(() => applyLightStyles(), 100);
}

function applyLightStyles() {
  // Logo
  const brandLeft = document.querySelector('.brand-left');
  if (brandLeft) {
    brandLeft.style.color = '#000000';
    brandLeft.style.fontWeight = '900';
    brandLeft.style.textShadow = 'none';
  }
  
  const brandRight = document.querySelector('.brand-right');
  if (brandRight) {
    brandRight.style.color = '#10b981';
    brandRight.style.fontWeight = '700';
    brandRight.style.textShadow = 'none';
  }
  
  // Inputs e selects
  document.querySelectorAll('input, select').forEach(input => {
    input.style.background = '#ffffff';
    input.style.borderColor = '#10b981';
    input.style.color = '#0f172a';
    input.style.borderWidth = '2px';
    input.style.fontWeight = '500';
  });
  
  // Thread selector
  const threadSel = document.querySelector('#threadSelector');
  if (threadSel) {
    threadSel.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23059669' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")";
    threadSel.style.backgroundRepeat = 'no-repeat';
    threadSel.style.backgroundPosition = 'right 14px center';
    threadSel.style.fontWeight = '600';
  }
  
  // Status
  const statusCont = document.querySelector('.status-container');
  if (statusCont) {
    statusCont.style.background = '#dcfce7';
    statusCont.style.borderColor = '#10b981';
    statusCont.style.borderWidth = '3px';
    statusCont.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
  }
  
  const statusTxt = document.querySelector('.status');
  if (statusTxt) {
    statusTxt.style.color = '#065f46';
    statusTxt.style.fontWeight = '800';
    statusTxt.style.fontSize = '1.1rem';
  }
  
  // Labels
  const labels = ['#languageLabel', '#themeLabel', '.tokens strong'];
  labels.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) {
      el.style.color = '#065f46';
      el.style.fontWeight = '800';
      el.style.fontSize = '1.05rem';
    }
  });
  
  // Modais
  document.querySelectorAll('.modal-content').forEach(modal => {
    modal.style.background = '#ffffff';
    modal.style.border = '2px solid #10b981';
    modal.style.boxShadow = '0 20px 40px rgba(16, 185, 129, 0.15)';
  });
  
  document.querySelectorAll('.modal-content h3').forEach(title => {
    title.style.color = '#0f172a';
  });
  
  // Card headers e títulos
  document.querySelectorAll('.card-header').forEach(header => {
    header.style.color = '#065f46';
    header.style.fontWeight = '700';
    header.style.borderBottomColor = '#10b981';
  });
  
  document.querySelectorAll('.page-title').forEach(title => {
    title.style.color = '#065f46';
    title.style.fontWeight = '800';
  });
  
  // Dividers
  document.querySelectorAll('.divider').forEach(div => {
    div.style.color = '#475569';
  });
  
  // Close buttons
  document.querySelectorAll('.close').forEach(btn => {
    btn.style.color = '#0f172a';
    btn.style.fontWeight = '700';
  });
  
  // Placeholder styles
  if (!document.getElementById('light-theme-placeholders')) {
    const style = document.createElement('style');
    style.id = 'light-theme-placeholders';
    style.textContent = `
      body.light input::placeholder {
        color: #64748b !important;
        opacity: 1 !important;
        font-weight: 500 !important;
      }
      body.light input:focus, body.light select:focus {
        border-color: #059669 !important;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export function observeFAQRendering() {
  // Função mantida para compatibilidade
  console.log('[THEME] observeFAQRendering chamado');
}