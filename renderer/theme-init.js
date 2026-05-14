// theme-init.js — aplica o tema antes da renderização (evita FOWT)
(function() {
  var theme = localStorage.getItem('bigfootTheme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();