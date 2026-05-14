(function() {
    function initEmergencyNav() {
        const navItems = document.querySelectorAll('.sidebar-item');
        const pages = document.querySelectorAll('.page-content');

        if (navItems.length === 0 || pages.length === 0) {
            return;
        }

        // 🔧 CONTROLAR VISIBILIDADE COM CLASSES CSS, NÃO COM ESTILOS INLINE
        function hidePageContent(pageId) {
            const page = document.getElementById(pageId);
            if (page) {
                page.classList.remove('active');
                page.classList.add('hidden-page');
            }
        }

        function showPageContent(pageId) {
            const page = document.getElementById(pageId);
            if (page) {
                page.classList.remove('hidden-page');
                page.classList.add('active');
            }
        }

        // 🔧 AJUSTAR SCROLL SEM DELETAR CONTEÚDO (usando classes em vez de style inline)
        function fixPageScrolling() {
            const mainWrapper = document.querySelector('.main-content-wrapper');
            const homePage = document.getElementById('page-home');
            const isHomeActive = homePage && homePage.classList.contains('active');
            
            if (mainWrapper) {
                if (isHomeActive) {
                    mainWrapper.classList.add('overflow-hidden');
                    mainWrapper.classList.remove('overflow-auto');
                } else {
                    mainWrapper.classList.add('overflow-auto');
                    mainWrapper.classList.remove('overflow-hidden');
                }
            }
            
            document.body.classList.add('overflow-hidden');
            document.documentElement.classList.add('overflow-hidden');
            
            // Garantir que wallet page não force scroll extra
            const walletPage = document.getElementById('page-wallet');
            if (walletPage && walletPage.classList.contains('active')) {
                walletPage.style.overflow = 'visible';
                walletPage.style.height = 'auto';
                walletPage.style.minHeight = 'auto';
            }
        }

        // 🔧 GERENCIAR VISIBILIDADE SEM DELETAR CONTEÚDO
        function managePageVisibility(activePageId) {
            const allPages = document.querySelectorAll('.page-content');
            allPages.forEach(page => {
                if (page.id === activePageId) {
                    showPageContent(page.id);
                } else {
                    hidePageContent(page.id);
                }
            });
            
            // Ajustar scroll
            fixPageScrolling();
        }

        // Clonar e configurar eventos
        navItems.forEach((item) => {
            const pageId = item.getAttribute('data-page');

            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Atualizar active na sidebar
                document.querySelectorAll('.sidebar-item').forEach(nav => {
                    nav.classList.remove('active');
                });
                newItem.classList.add('active');

                // Mostrar apenas a página clicada
                const targetPageId = 'page-' + pageId;
                managePageVisibility(targetPageId);

                // Inicializar a página específica (com requestAnimationFrame em vez de setTimeout)
                requestAnimationFrame(() => {
                    if (pageId === 'faq' && window.initializeFAQ) {
                        const faqPage = document.getElementById('page-faq');
                        if (faqPage) {
                            faqPage.style.display = 'block';
                        }
                        const lang = typeof getCurrentLang === 'function' ? getCurrentLang() : 'en';
                        window.initializeFAQ(lang);
                    } else if (pageId === 'wallet' && window.initializeWallet) {
                        window.initializeWallet();
                    } else if (pageId === 'chat' && window.initializeChat) {
                        window.initializeChat();
                    } else if (pageId === 'profile' && window.initializeProfile) {
                        const firebaseAuth = window.firebaseAuth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
                        const firebaseDb = window.firebaseDb || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
                        window.initializeProfile(firebaseAuth, firebaseDb);
                    } else if (pageId === 'logs' && window.initializeLogs) {
                        window.initializeLogs();
                    } else if (window.initializePage) {
                        window.initializePage(pageId);
                    }
                    
                    fixPageScrolling();
                });
            });
        });

        // Inicializar mostrando apenas a Home
        const homePage = document.getElementById('page-home');
        const allPages = document.querySelectorAll('.page-content');
        
        allPages.forEach(page => {
            if (page.id === 'page-home') {
                page.classList.remove('hidden-page');
                page.classList.add('active');
            } else {
                page.classList.add('hidden-page');
                page.classList.remove('active');
            }
        });
        
        // Garantir que a Home está ativa na sidebar
        const homeNav = document.querySelector('.sidebar-item[data-page="home"]');
        if (homeNav) {
            homeNav.classList.add('active');
        }
        
        fixPageScrolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEmergencyNav);
    } else {
        initEmergencyNav();
    }
})();