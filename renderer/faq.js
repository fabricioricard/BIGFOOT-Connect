// faq.js - Sistema de FAQ baseado no Whitepaper BIGFOOT Connect

export const faqContent = {
  pt: [
    {
      category: "Básico",
      question: "O que é o BIGFOOT Connect?",
      answer: "App desktop que integra o ecossistema BIGchain. Rode um node, gerencie sua carteira, monitore relays e converta BIG entre BIGchain e Solana."
    },
    {
      category: "Proof of Relay",
      question: "Como funciona o Proof of Relay (PoR)?",
      answer: "Seu node acumula créditos propagando dados pela rede. Com 50 créditos você minera um bloco e recebe 75% da recompensa. Não exige GPU — qualquer computador funciona."
    },
    {
      category: "Proof of Relay",
      question: "Como acumulo créditos de relay?",
      answer: "Automaticamente, enquanto o node está online e conectado a peers. Quanto mais tempo conectado, mais créditos. Mínimo de 50 para minerar."
    },
    {
      category: "Economia do Token",
      question: "Qual é o supply e a emissão de BIG?",
      answer: "Supply máximo de 21M de BIG. Emissão fixa de 1.440 BIG/dia. Halving a cada 4 anos."
    },
    {
      category: "Segurança",
      question: "Meus tokens BIG estão seguros?",
      answer: "Sim. Sua chave privada nunca sai do dispositivo. Comunicações criptografadas com ECDSA."
    },
    {
      category: "Carteira",
      question: "Como funciona a carteira e a bridge?",
      answer: "Envie tokens, veja histórico e converta BIG entre BIGchain e Solana (limite 1.000 BIG/dia). Exporte sua chave privada para backup."
    },
    {
      category: "Problemas",
      question: "Não consigo conectar ao node. O que fazer?",
      answer: "Verifique a internet e se está logado. Se persistir, reinicie o app ou veja se o firewall bloqueia a porta do node."
    },
    {
      category: "Problemas",
      question: "Não estou acumulando créditos de relay.",
      answer: "Tenha pelo menos 3-5 peers ativos. Verifique se o firewall não bloqueia conexões P2P. Créditos só acumulam com o node online."
    }
  ],

  en: [
    {
      category: "Basic",
      question: "What is BIGFOOT Connect?",
      answer: "Desktop app that integrates the BIGchain ecosystem. Run a node, manage your wallet, monitor relays, and convert BIG between BIGchain and Solana."
    },
    {
      category: "Proof of Relay",
      question: "How does Proof of Relay (PoR) work?",
      answer: "Your node accumulates credits by propagating data across the network. With 50 credits you mine a block and earn 75% of the reward. No GPU required — any regular computer works."
    },
    {
      category: "Proof of Relay",
      question: "How do I accumulate relay credits?",
      answer: "Automatically, while your node is online and connected to peers. The longer you stay connected, the more credits you earn. Minimum 50 to start mining."
    },
    {
      category: "Token Economics",
      question: "What is BIG's supply and emission?",
      answer: "Max supply of 21M BIG. Fixed emission of 1,440 BIG/day. Halving every 4 years."
    },
    {
      category: "Security",
      question: "Are my BIG tokens safe?",
      answer: "Yes. Your private key never leaves your device. All communications are encrypted with ECDSA."
    },
    {
      category: "Wallet",
      question: "How does the wallet and bridge work?",
      answer: "Send tokens, view history, and convert BIG between BIGchain and Solana (1,000 BIG/day limit). Export your private key for backup."
    },
    {
      category: "Troubleshooting",
      question: "Can't connect to node. What to do?",
      answer: "Check your internet and make sure you're logged in. If it persists, restart the app or check if your firewall is blocking the node port."
    },
    {
      category: "Troubleshooting",
      question: "Not accumulating relay credits.",
      answer: "Make sure you have at least 3-5 active peers. Check that your firewall isn't blocking P2P connections. Credits only accumulate while the node is online."
    }
  ]
};

// Traduções para a página de FAQ
const faqPageTranslations = {
  pt: {
    title: "Perguntas Frequentes (FAQ)",
    searchPlaceholder: "Buscar perguntas...",
    allCategories: "Todas as Categorias",
    noResults: "Nenhuma pergunta encontrada.",
    categories: {
      "Básico": "Básico",
      "Proof of Relay": "Proof of Relay",
      "Economia do Token": "Economia do Token",
      "Técnico": "Técnico",
      "Segurança": "Segurança",
      "Carteira": "Carteira",
      "Rede": "Rede",
      "Problemas": "Problemas"
    }
  },
  en: {
    title: "Frequently Asked Questions (FAQ)",
    searchPlaceholder: "Search questions...",
    allCategories: "All Categories",
    noResults: "No questions found.",
    categories: {
      "Basic": "Basic",
      "Proof of Relay": "Proof of Relay",
      "Token Economics": "Token Economics",
      "Technical": "Technical",
      "Security": "Security",
      "Wallet": "Wallet",
      "Network": "Network",
      "Troubleshooting": "Troubleshooting"
    }
  }
};

export function initializeFAQ(lang) {
  const currentLang = lang || getCurrentLang();
  const faqPage = document.getElementById('page-faq');
  if (!faqPage) return;

  const t = faqPageTranslations[currentLang] || faqPageTranslations.pt;
  const faqList = faqContent[currentLang] || faqContent.pt;
  const categories = [...new Set(faqList.map(item => item.category))];

  // Constrói toda a UI via createElement — sem innerHTML para evitar XSS e violar CSP
  faqPage.replaceChildren();

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = '❓ ' + t.title;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'faq-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';
  cardHeader.textContent = t.title;

  // Search
  const searchWrap = document.createElement('div');
  searchWrap.id = 'faq-search-wrap';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'faqSearch';
  searchInput.placeholder = t.searchPlaceholder;
  searchWrap.appendChild(searchInput);

  // Filters
  const filtersDiv = document.createElement('div');
  filtersDiv.id = 'faq-filters';

  const allBtn = document.createElement('button');
  allBtn.className = 'category-filter-btn active';
  allBtn.dataset.category = 'all';
  allBtn.textContent = t.allCategories;
  filtersDiv.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-filter-btn';
    btn.dataset.category = cat; // dataset.x é seguro — não interpreta HTML
    btn.textContent = t.categories[cat] || cat;
    filtersDiv.appendChild(btn);
  });

  const faqContainer = document.createElement('div');
  faqContainer.id = 'faqContainer';

  card.appendChild(cardHeader);
  card.appendChild(searchWrap);
  card.appendChild(filtersDiv);
  card.appendChild(faqContainer);
  faqPage.appendChild(title);
  faqPage.appendChild(card);

  renderFAQItems(currentLang, 'all', '');
  setupFAQEventListeners(currentLang);
}

function renderFAQItems(lang, selectedCategory = 'all', searchTerm = '') {
  const currentLang = lang || getCurrentLang();
  const faqContainer = document.getElementById('faqContainer');
  if (!faqContainer) return;

  const t = faqPageTranslations[currentLang] || faqPageTranslations.pt;
  const faqList = faqContent[currentLang] || faqContent.pt;

  const filteredFAQ = faqList.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const lc = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      item.question.toLowerCase().includes(lc) ||
      item.answer.toLowerCase().includes(lc);
    return matchesCategory && matchesSearch;
  });

  // Limpa container
  faqContainer.replaceChildren();

  if (filteredFAQ.length === 0) {
    // Fix 3 & 5: sem innerHTML e sem style inline — usa classe CSS
    const empty = document.createElement('div');
    empty.className = 'faq-no-results';
    empty.textContent = t.noResults;
    faqContainer.appendChild(empty);
    return;
  }

  // Fix 2: constrói cada item via createElement + textContent — sem innerHTML
  filteredFAQ.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'faq-item';

    const details = document.createElement('details');
    details.id = 'faq-' + index;

    const summary = document.createElement('summary');

    const questionSpan = document.createElement('span');

    const questionText = document.createTextNode(item.question + ' ');
    const badge = document.createElement('span');
    badge.className = 'faq-category-badge';
    badge.textContent = t.categories[item.category] || item.category;

    questionSpan.appendChild(questionText);
    questionSpan.appendChild(badge);

    // Fix 6: seta rotacionada via CSS (details[open] .faq-arrow) — sem style.transform inline
    const arrow = document.createElement('span');
    arrow.className = 'faq-arrow';
    arrow.textContent = '▼';

    summary.appendChild(questionSpan);
    summary.appendChild(arrow);

    const answer = document.createElement('p');
    answer.textContent = item.answer; // textContent — seguro contra XSS

    details.appendChild(summary);
    details.appendChild(answer);
    wrapper.appendChild(details);
    faqContainer.appendChild(wrapper);
  });
}

function setupFAQEventListeners(lang) {
  const currentLang = lang || getCurrentLang();
  // Filtro por categoria
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active de todos
      document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
      // Adiciona active no clicado
      this.classList.add('active');
      
      const category = this.getAttribute('data-category');
      const searchTerm = document.getElementById('faqSearch')?.value || '';
      
      renderFAQItems(currentLang, category, searchTerm);
    });
  });
  
  // Busca em tempo real
  const searchInput = document.getElementById('faqSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value;
      const activeCategory = document.querySelector('.category-filter-btn.active')?.getAttribute('data-category') || 'all';
      
      renderFAQItems(currentLang, activeCategory, searchTerm);
    });
  }
}