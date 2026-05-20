function syncToBackend() {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/me/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      theme: localStorage.getItem('theme') || null,
      currency: localStorage.getItem('currency') || 'USD',
      fontSize: localStorage.getItem('font') || null,
    }),
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  // ── Theme ──
  const currentTheme = localStorage.getItem('theme') || '';
  document.querySelectorAll('.theme-card').forEach((card) => {
    if (card.dataset.theme === currentTheme) card.classList.add('active');
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
      showToast('Theme saved');
      syncToBackend();
    });
  });

  // ── Currency ──
  const currentCurrency = localStorage.getItem('currency') || 'USD';
  document.querySelectorAll('.currency-chip').forEach((chip) => {
    if (chip.dataset.currency === currentCurrency) chip.classList.add('active');
    chip.addEventListener('click', () => {
      localStorage.setItem('currency', chip.dataset.currency);
      document.querySelectorAll('.currency-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      showToast('Currency saved');
      syncToBackend();
    });
  });

  // ── Font size ──
  const currentFont = localStorage.getItem('font') || '';
  document.querySelectorAll('.font-chip').forEach((chip) => {
    if (chip.dataset.font === currentFont) chip.classList.add('active');
    chip.addEventListener('click', () => {
      const font = chip.dataset.font;
      if (font) {
        localStorage.setItem('font', font);
        document.documentElement.setAttribute('data-font', font);
      } else {
        localStorage.removeItem('font');
        document.documentElement.removeAttribute('data-font');
      }
      document.querySelectorAll('.font-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      showToast('Text size saved');
      syncToBackend();
    });
  });
});
