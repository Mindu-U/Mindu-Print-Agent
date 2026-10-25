(() => {
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem('mindu.print.theme'); } catch {}
  root.dataset.theme = ['light', 'dark'].includes(saved) ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let translator = key => key;
  window.paintTheme = (tx = translator) => {
    translator = tx;
    for (const button of document.querySelectorAll('[data-theme-choice]')) {
      button.setAttribute('aria-pressed', String(root.dataset.theme === button.dataset.themeChoice));
      button.title = tx(button.dataset.themeChoice === 'light' ? 'Light theme' : 'Dark theme');
      button.setAttribute('aria-label', button.title);
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    for (const button of document.querySelectorAll('[data-theme-choice]')) button.addEventListener('click', () => {
      root.dataset.theme = button.dataset.themeChoice;
      try { localStorage.setItem('mindu.print.theme', root.dataset.theme); } catch {}
      for (const item of document.querySelectorAll('[data-theme-choice]')) item.setAttribute('aria-pressed', String(item === button));
    });
    window.paintTheme();
  });
})();