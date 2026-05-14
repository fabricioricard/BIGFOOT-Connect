// Helper de notificação — usa toast CSS em vez de alert() bloqueante
function showChartError(message) {
  const existing = document.getElementById('chart-error-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'chart-error-toast';
  toast.className = 'toast-notification toast-success';
  toast.style.background = '#cc3333';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function initializeChart(currentLang, translations, auth) {
  let usageChart;
  const usageCtx = document.getElementById('usageChart')?.getContext('2d');

  if (!usageCtx) {
    console.error('[CHART] Canvas não encontrado.');
    return null;
  }

  if (typeof Chart === 'undefined') {
    console.error('[CHART] Chart.js não carregado.');
    return null;
  }

  try {
    // Cria o gráfico IMEDIATAMENTE com dados vazios
    usageChart = new Chart(usageCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: translations[currentLang].bigPointsGraphTitle || 'BIG Earned',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#2563eb',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: translations[currentLang].bigEarned || (currentLang === 'pt' ? 'BIG Ganhos' : 'BIG Earned'),
              font: { size: 14, weight: 'bold' }
            },
            ticks: { font: { size: 12 } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          x: {
            title: {
              display: true,
              text: currentLang === 'pt' ? 'Data' : 'Date',
              font: { size: 14, weight: 'bold' }
            },
            ticks: { font: { size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { size: 13 }, padding: 15 }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#3b82f6',
            borderWidth: 2,
            padding: 12,
            displayColors: true,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              title: (ctx) => currentLang === 'pt' ? `Data: ${ctx[0].label}` : `Date: ${ctx[0].label}`,
              label: (ctx) => `BIG: ${ctx.parsed.y.toFixed(2)}`
            }
          }
        }
      }
    });

    // Garantir que o gráfico ocupe o espaço correto (sem setTimeout)
    requestAnimationFrame(() => {
      usageChart.resize();
      usageChart.update();
    });

  } catch (error) {
    console.error('[CHART] Erro ao inicializar Chart.js:', error);
    showChartError(currentLang === 'pt' ? 'Erro ao inicializar o gráfico.' : 'Error initializing chart.');
    return null;
  }

  // Retorna imediatamente, os dados serão carregados depois via updateChartData()
  return usageChart;
}

// Função para atualizar dados do gráfico - APENAS LEITURA do Firestore
export function updateChartData(usageChart, db, auth, currentLang, translations) {
  const user = auth?.currentUser;
  if (!user || !usageChart) {
    return;
  }

  db.collection("users")
    .doc(user.uid)
    .collection("bigpoints_earnings") // Subcoleção criada pela API backend
    .orderBy("updatedAt", "desc")
    .limit(7)
    .get()
    .then(snapshot => {
      let dados = [];
      
      if (snapshot.empty) {
        // Não cria documento - API backend fará isso quando houver mineração
        dados = [{ date: new Date().toISOString().split('T')[0], amount: 0 }];
      } else {
        snapshot.forEach(doc => {
          const data = doc.id;
          const val = doc.data().bigpoints;
          const bigpoints = (typeof val === 'number' && !isNaN(val)) ? val : 0;
          dados.unshift({ date: data, amount: bigpoints });
        });
      }
      
      return dados;
    })
    .then(dados => {
      if (dados.length === 0) {
        dados = [{ date: new Date().toISOString().split('T')[0], amount: 0 }];
      }
      
      usageChart.data.labels = dados.map(d => d.date);
      usageChart.data.datasets[0].data = dados.map(d => d.amount);
      usageChart.data.datasets[0].label = translations[currentLang].bigPointsGraphTitle || 'BIG Earned';
      
      // Atualiza títulos dos eixos
      usageChart.options.scales.y.title.text = translations[currentLang].bigEarned || (currentLang === 'pt' ? 'BIG Ganhos' : 'BIG Earned');
      usageChart.options.scales.x.title.text = currentLang === 'pt' ? 'Data' : 'Date';
      
      // Correção: chamada direta, sem setTimeout
      usageChart.resize();
      usageChart.update();
    })
    .catch(error => {
      console.error('[CHART] Erro ao carregar dados do Firestore.');
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'permission-denied') {
        console.error('[CHART] Erro de permissão - usuário não tem acesso à subcoleção');
        showChartError(currentLang === 'pt' ? 'Erro de permissão ao carregar histórico de BIG.' : 'Permission error loading BIG history.');
      } else if (error.code === 'unavailable') {
        console.error('[CHART] Firestore indisponível - possível problema de conectividade');
        showChartError(currentLang === 'pt' ? 'Erro de conectividade. Verifique sua conexão.' : 'Connectivity error. Check your internet connection.');
      } else {
        showChartError(currentLang === 'pt' ? 'Erro ao carregar histórico de BIG.' : 'Error loading BIG history.');
      }
    });
}

// Função registrarBigPointsGanhos - REMOVIDA escrita direta no Firestore
export function registrarBigPointsGanhos(db, auth, qtdEmBigPoints) {
  const user = auth?.currentUser;
  if (!user) {
    return;
  }
  
  console.log(`[CHART] BIG processados: ${qtdEmBigPoints} (escrita via API backend)`);
  // Não escreve mais no Firestore - apenas registra o evento
  // A escrita real será feita pelo main.js via API backend com autenticação adequada
}

// Função auxiliar para forçar atualização do gráfico
export function forceChartUpdate(usageChart, db, auth, currentLang, translations) {
  if (usageChart) {
    updateChartData(usageChart, db, auth, currentLang, translations);
  }
}

// Função para limpar dados do gráfico (útil durante logout)
export function clearChartData(usageChart) {
  if (usageChart) {
    usageChart.data.labels = [];
    usageChart.data.datasets[0].data = [];
    usageChart.update();
  }
}