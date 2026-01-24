export function initializeChart(currentLang, translations) {
  let usageChart;
  let userInteractedWithGraph = false;
  const usageCtx = document.getElementById('usageChart')?.getContext('2d');

  if (!usageCtx) {
    console.error('[CHART] Elemento <canvas id="usageChart"> não encontrado ou contexto 2D inválido.');
    alert(currentLang === 'pt' ? 'Erro: Canvas do gráfico não encontrado.' : 'Error: Graph canvas not found.');
    return null;
  }

  if (typeof Chart === 'undefined') {
    console.error('[CHART] Chart.js não foi carregado.');
    alert(currentLang === 'pt' ? 'Erro: Chart.js não carregado.' : 'Error: Chart.js not loaded.');
    return null;
  }

  console.log('[CHART] Canvas usageChart encontrado, inicializando Chart.js');
  try {
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
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: currentLang === 'pt' ? 'Data' : 'Date',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 11
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: {
                size: 13
              },
              padding: 15
            }
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
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              title: function(context) {
                return currentLang === 'pt' ? `Data: ${context[0].label}` : `Date: ${context[0].label}`;
              },
              label: function(context) {
                const value = context.parsed.y;
                return `BIG: ${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
    console.log('[CHART] Gráfico inicializado com sucesso:', usageChart);
    setTimeout(() => {
      usageChart.resize();
      usageChart.update();
      console.log('[CHART] Gráfico redesenhado após inicialização');
    }, 100);
  } catch (error) {
    console.error('[CHART] Erro ao inicializar Chart.js:', error.message, error.stack);
    alert(currentLang === 'pt' ? 'Erro ao inicializar o gráfico.' : 'Error initializing chart.');
    return null;
  }

  // O gráfico agora está sempre visível dentro de um card, não precisa de lógica de toggle.
  // Apenas garante que o resize ocorra.
  if (usageChart) {
    setTimeout(() => {
      usageChart.resize();
      usageChart.update();
      console.log('[CHART] Gráfico redesenhado após inicialização');
    }, 100);
  }

  return usageChart;
}

// Função para atualizar dados do gráfico - APENAS LEITURA do Firestore
export function updateChartData(usageChart, db, currentLang, translations) {
  const user = firebase.auth().currentUser;
  if (!user || !usageChart) {
    console.log('[CHART] Saindo de updateChartData: usuário ou usageChart não disponível');
    if (!usageChart) {
      console.error('[CHART] Gráfico não inicializado.');
    }
    return;
  }

  console.log('[CHART] Acessando Firestore para UID:', user.uid);
  db.collection("users")
    .doc(user.uid)
    .collection("bigpoints_earnings") // Subcoleção criada pela API backend
    .orderBy("updatedAt", "desc")
    .limit(7)
    .get()
    .then(snapshot => {
      console.log('[CHART] Dados do Firestore recebidos, documentos:', snapshot.size);
      let dados = [];
      
      if (snapshot.empty) {
        console.log('[CHART] Nenhum documento encontrado na subcoleção bigpoints_earnings');
        // Não cria documento - API backend fará isso quando houver mineração
        dados = [{ date: new Date().toISOString().split('T')[0], amount: 0 }];
      } else {
        snapshot.forEach(doc => {
          const data = doc.id;
          const bigpoints = doc.data().bigpoints || 0;
          console.log(`[CHART] Documento - Data: ${data}, BIG: ${bigpoints}`);
          dados.unshift({ date: data, amount: bigpoints });
        });
      }
      
      return dados;
    })
    .then(dados => {
      console.log('[CHART] Dados para o gráfico:', dados);
      if (dados.length === 0) {
        dados = [{ date: new Date().toISOString().split('T')[0], amount: 0 }];
      }
      
      usageChart.data.labels = dados.map(d => d.date);
      usageChart.data.datasets[0].data = dados.map(d => d.amount);
      usageChart.data.datasets[0].label = translations[currentLang].bigPointsGraphTitle || 'BIG Earned';
      
      // Atualiza títulos dos eixos
      usageChart.options.scales.y.title.text = translations[currentLang].bigEarned || (currentLang === 'pt' ? 'BIG Ganhos' : 'BIG Earned');
      usageChart.options.scales.x.title.text = currentLang === 'pt' ? 'Data' : 'Date';
      
      setTimeout(() => {
        usageChart.resize();
        usageChart.update();
        console.log('[CHART] Gráfico atualizado com dados:', usageChart.data.labels);
      }, 100);
    })
    .catch(error => {
      console.error('[CHART] Erro ao carregar BIG diários:', error.code, error.message);
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'permission-denied') {
        console.error('[CHART] Erro de permissão - usuário não tem acesso à subcoleção');
        alert(currentLang === 'pt'
          ? 'Erro de permissão ao carregar histórico de BIG.'
          : 'Permission error loading BIG history.');
      } else if (error.code === 'unavailable') {
        console.error('[CHART] Firestore indisponível - possível problema de conectividade');
        alert(currentLang === 'pt'
          ? 'Erro de conectividade. Verifique sua conexão com a internet.'
          : 'Connectivity error. Please check your internet connection.');
      } else {
        alert(currentLang === 'pt'
          ? 'Erro ao carregar histórico de BIG.'
          : 'Error loading BIG history.');
      }
    });
}

// Função registrarBigPointsGanhos - REMOVIDA escrita direta no Firestore
export function registrarBigPointsGanhos(db, qtdEmBigPoints) {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log('[CHART] registrarBigPointsGanhos: Nenhum usuário logado');
    return;
  }
  
  console.log(`[CHART] BIG processados: ${qtdEmBigPoints} (escrita via API backend)`);
  console.log('[CHART] IMPORTANTE: Dados serão salvos via API backend, não diretamente no Firestore');
  
  // Não escreve mais no Firestore - apenas registra o evento
  // A escrita real será feita pelo main.js via API backend com autenticação adequada
  // Esta função pode ser usada para triggers locais ou logs, se necessário
}

// Função para atualizar texto do botão quando idioma muda
export function updateToggleButtonText(currentLang, translations) {
  // Função removida, pois o botão de toggle do gráfico foi removido do HTML
  console.log('[CHART] updateToggleButtonText: Função desnecessária removida.');
}

// Função auxiliar para forçar atualização do gráfico
export function forceChartUpdate(usageChart, db, currentLang, translations) {
  console.log('[CHART] Forçando atualização do gráfico...');
  if (usageChart) {
    updateChartData(usageChart, db, currentLang, translations);
  }
}

// Função para limpar dados do gráfico (útil durante logout)
export function clearChartData(usageChart) {
  if (usageChart) {
    console.log('[CHART] Limpando dados do gráfico');
    usageChart.data.labels = [];
    usageChart.data.datasets[0].data = [];
    usageChart.update();
  }
}

// Função para verificar status da subcoleção (debug)
export function checkBigPointsCollection(db, currentLang) {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log('[DEBUG] Usuário não logado para verificar coleção');
    return;
  }

  console.log('[DEBUG] Verificando subcoleção bigpoints_earnings...');
  
  db.collection("users")
    .doc(user.uid)
    .collection("bigpoints_earnings")
    .get()
    .then(snapshot => {
      console.log(`[DEBUG] Subcoleção possui ${snapshot.size} documentos`);
      
      if (snapshot.empty) {
        console.log('[DEBUG] Subcoleção vazia - aguardando dados da API backend');
      } else {
        console.log('[DEBUG] Documentos encontrados:');
        snapshot.forEach(doc => {
          const data = doc.data();
          console.log(`[DEBUG] - ${doc.id}: ${data.bigpoints} BIG (${data.updatedAt?.toDate()})`);
        });
      }
    })
    .catch(error => {
      console.error('[DEBUG] Erro ao verificar subcoleção:', error.code, error.message);
    });
}