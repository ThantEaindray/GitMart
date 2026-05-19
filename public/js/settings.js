document.addEventListener('DOMContentLoaded', () => {
  const current = localStorage.getItem('theme') || '';

  document.querySelectorAll('.theme-card').forEach((card) => {
    if (card.dataset.theme === current) card.classList.add('active');

    card.addEventListener('click', () => {
      const theme = card.dataset.theme;

      if (theme) {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      } else {
        localStorage.removeItem('theme');
        document.documentElement.removeAttribute('data-theme');
      }

      document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
});
