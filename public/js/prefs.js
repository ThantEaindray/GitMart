function applyPrefs() {
  const theme = localStorage.getItem('theme');
  const font = localStorage.getItem('font');
  const motion = localStorage.getItem('motion');
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
  if (font) document.documentElement.setAttribute('data-font', font);
  else document.documentElement.removeAttribute('data-font');
  if (motion === 'reduced') document.documentElement.setAttribute('data-motion', 'reduced');
  else document.documentElement.removeAttribute('data-motion');
}

window.addEventListener('pageshow', function (e) {
  if (e.persisted) applyPrefs();
});
