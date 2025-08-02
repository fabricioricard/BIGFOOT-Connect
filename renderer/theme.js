export function initializeTheme() {
  const savedTheme = localStorage.getItem('bigfootTheme');
  console.log('Tema salvo:', savedTheme);

  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  } else {
    document.body.classList.add('light');
    document.body.classList.remove('dark');
  }

  updateTheme();
}

export function toggleTheme(usageChart) {
  console.log('Alternando tema...');
  const isDark = document.body.classList.contains('dark');

  if (isDark) {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    localStorage.setItem('bigfootTheme', 'light');
  } else {
    document.body.classList.remove('light');
    document.body.classList.add('dark');
    localStorage.setItem('bigfootTheme', 'dark');
  }

  updateTheme();

  if (usageChart && document.querySelector('.usage-graph').classList.contains('show')) {
    setTimeout(() => {
      usageChart.resize();
      usageChart.update();
      console.log('Gráfico redesenhado após mudança de tema');
    }, 100);
  }
}

export function updateTheme() {
  console.log('Atualizando tema');
  document.body.style.backgroundColor = document.body.classList.contains('dark') ? '#1f2937' : '#f3f4f6';
  document.body.style.color = document.body.classList.contains('dark') ? '#f3f4f6' : '#1f2937';
  const cards = document.querySelectorAll('.modal-content, .faq, .usage-graph');
  cards.forEach(card => {
    card.style.backgroundColor = document.body.classList.contains('dark') ? '#374151' : 'white';
  });
}