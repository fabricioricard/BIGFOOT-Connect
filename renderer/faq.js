export const faqContent = {
  pt: [
    {
      question: "O que é o BIGFOOT Connect?",
      answer: "É uma aplicação descentralizada para contribuir com poder computacional e ganhar tokens BIG."
    },
    {
      question: "Como faço para contribuir com poder computacional?",
      answer: "Basta fazer login e ativar o botão conectar para começar a contribuir."
    },
    {
      question: "Como recebo recompensas?",
      answer: "Você recebe tokens BIG proporcionalmente ao poder computacional contribuído, tempo online e estabilidade da conexão."
    }
  ],
  en: [
    {
      question: "What is BIGFOOT Connect?",
      answer: "It's a decentralized application to contribute computational power and earn BIG tokens."
    },
    {
      question: "How do I contribute computational power?",
      answer: "Just log in and activate the connect button to start contributing."
    },
    {
      question: "How do I receive rewards?",
      answer: "You receive BIG tokens proportionally to the computational power contributed, online time, and connection stability."
    }
  ]
};

export function renderFAQ(currentLang, faqSection) {
  console.log('Renderizando FAQ, idioma:', currentLang);
  if (!faqSection) {
    console.error('Elemento faqSection não encontrado');
    return;
  }
  const faqList = faqContent[currentLang] || faqContent.pt;
  const openStates = Array.from(faqSection.querySelectorAll('details')).map(det => det.open);
  faqSection.innerHTML = '';
  faqList.forEach(({ question, answer }, index) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = question;
    const p = document.createElement('p');
    p.textContent = answer;
    details.appendChild(summary);
    details.appendChild(p);
    faqSection.appendChild(details);
    if (openStates[index]) details.open = true;
  });
}