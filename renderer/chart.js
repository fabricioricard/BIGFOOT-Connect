export function initializeChart(currentLang, translations) {
  let usageChart;
  let userInteractedWithGraph = false;

  const usageGraph = document.querySelector('.usage-graph');
  const toggleGraphBtn = document.getElementById('toggleGraphBtn');
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
          label: translations[currentLang].bigPointsGraphTitle || 'BIG Points Earned',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: currentLang === 'pt' ? 'BIG Points Ganhos' : 'BIG Points Earned'
            }
          },
          x: {
            title: {
              display: true,
              text: currentLang === 'pt' ? 'Data' : 'Date'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
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

  if (usageGraph && toggleGraphBtn) {
    // Definir estado inicial baseado no localStorage
    const graphHidden = localStorage.getItem('graphHidden') === 'true';
    usageGraph.classList.toggle('show', !graphHidden);
    toggleGraphBtn.textContent = graphHidden ? translations[currentLang].showGraph : translations[currentLang].toggleGraph;
    toggleGraphBtn.setAttribute('aria-label', graphHidden ? translations[currentLang].showGraph : translations[currentLang].toggleGraph);
    console.log('[CHART] Gráfico configurado com estado inicial:', !graphHidden);

    toggleGraphBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      userInteractedWithGraph = true;
      console.log('[CHART] Botão toggleGraphBtn clicado, estado antes:', usageGraph.classList.contains('show') ? 'Visível' : 'Oculto');
      usageGraph.classList.toggle('show');
      const isVisible = usageGraph.classList.contains('show');
      toggleGraphBtn.textContent = isVisible ? translations[currentLang].toggleGraph : translations[currentLang].showGraph;
      toggleGraphBtn.setAttribute('aria-label', isVisible ? translations[currentLang].toggleGraph : translations[currentLang].showGraph);
      localStorage.setItem('graphHidden', !isVisible);
      console.log('[CHART] Estado do gráfico salvo:', localStorage.getItem('graphHidden'));

      // Atualizar o gráfico apenas se visível
      if (usageChart) {
        setTimeout(() => {
          usageChart.resize();
          usageChart.update();
          console.log('[CHART] Gráfico redesenhado após alternância:', isVisible ? 'Visível' : 'Oculto');
        }, 100);
      }
    });
  } else {
    console.error('[CHART] Elementos toggleGraphBtn ou usageGraph não encontrados:', { toggleGraphBtn, usageGraph });
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
          console.log(`[CHART] Documento - Data: ${data}, BIG Points: ${bigpoints}`);
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
      usageChart.data.datasets[0].label = translations[currentLang].bigPointsGraphTitle || 'BIG Points Earned';
      
      if (document.querySelector('.usage-graph').classList.contains('show')) {
        setTimeout(() => {
          usageChart.resize();
          usageChart.update();
          console.log('[CHART] Gráfico atualizado com dados:', usageChart.data.labels);
        }, 100);
      }
    })
    .catch(error => {
      console.error('[CHART] Erro ao carregar BIG Points diários:', error.code, error.message);
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'permission-denied') {
        console.error('[CHART] Erro de permissão - usuário não tem acesso à subcoleção');
        alert(currentLang === 'pt'
          ? 'Erro de permissão ao carregar histórico de BIG Points.'
          : 'Permission error loading BIG Points history.');
      } else if (error.code === 'unavailable') {
        console.error('[CHART] Firestore indisponível - possível problema de conectividade');
        alert(currentLang === 'pt'
          ? 'Erro de conectividade. Verifique sua conexão com a internet.'
          : 'Connectivity error. Please check your internet connection.');
      } else {
        alert(currentLang === 'pt'
          ? 'Erro ao carregar histórico de BIG Points.'
          : 'Error loading BIG Points history.');
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
  
  console.log(`[CHART] BIG Points processados: ${qtdEmBigPoints} (escrita via API backend)`);
  console.log('[CHART] IMPORTANTE: Dados serão salvos via API backend, não diretamente no Firestore');
  
  // Não escreve mais no Firestore - apenas registra o evento
  // A escrita real será feita pelo main.js via API backend com autenticação adequada
  // Esta função pode ser usada para triggers locais ou logs, se necessário
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
          console.log(`[DEBUG] - ${doc.id}: ${data.bigpoints} BIG Points (${data.updatedAt?.toDate()})`);
        });
      }
    })
    .catch(error => {
      console.error('[DEBUG] Erro ao verificar subcoleção:', error.code, error.message);
    });
}