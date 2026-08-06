// ── Backend sync ──────────────────────────────────────────────────────────────

function syncToBackend() {
  if (!localStorage.getItem('token')) return;
  authFetch('/api/me/settings', {
    method: 'PUT',
    body: JSON.stringify({
      theme: localStorage.getItem('theme') || null,
      currency: localStorage.getItem('currency') || 'USD',
      fontSize: localStorage.getItem('font') || null,
    }),
  });
}

function loadFromBackend() {
  if (!localStorage.getItem('token')) return;
  authFetch('/api/me/settings')
    .then((res) => res.json())
    .then((data) => {
      if (data.display_name) {
        const input = document.getElementById('display-name');
        if (input) input.value = data.display_name;
      }
      if (data.notify_orders !== undefined) {
        const el = document.getElementById('toggle-notify-orders');
        if (el) el.checked = data.notify_orders;
      }
      if (data.notify_promotions !== undefined) {
        const el = document.getElementById('toggle-notify-promotions');
        if (el) el.checked = data.notify_promotions;
      }
      if (data.notify_email !== undefined) {
        const el = document.getElementById('toggle-notify-email');
        if (el) el.checked = data.notify_email;
      }
    })
    .catch(() => {});
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function initTabs() {
  const hash = window.location.hash.replace('#', '');
  const valid = ['appearance', 'preferences', 'security'];
  const active = valid.includes(hash) ? hash : 'appearance';

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === active);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'tab-' + active);
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      history.replaceState(null, '', '#' + btn.dataset.tab);
    });
  });
}

// ── BFCache: sync card/chip active states ─────────────────────────────────────

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  const theme = localStorage.getItem('theme') || '';
  document.querySelectorAll('.theme-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.theme === theme);
  });
  const currency = localStorage.getItem('currency') || 'USD';
  document.querySelectorAll('.currency-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.currency === currency);
  });
  const font = localStorage.getItem('font') || '';
  document.querySelectorAll('.font-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.font === font);
  });
  const motionToggle = document.getElementById('toggle-motion');
  if (motionToggle) motionToggle.checked = localStorage.getItem('motion') === 'reduced';
});

// ── Init: Theme ───────────────────────────────────────────────────────────────

function initTheme() {
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
}

// ── Init: Font size ───────────────────────────────────────────────────────────

function initFontSize() {
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
}

// ── Init: Motion ──────────────────────────────────────────────────────────────

function initMotion() {
  const motionToggle = document.getElementById('toggle-motion');
  motionToggle.checked = localStorage.getItem('motion') === 'reduced';
  motionToggle.addEventListener('change', () => {
    if (motionToggle.checked) {
      localStorage.setItem('motion', 'reduced');
      document.documentElement.setAttribute('data-motion', 'reduced');
    } else {
      localStorage.removeItem('motion');
      document.documentElement.removeAttribute('data-motion');
    }
    showToast('Motion preference saved');
  });
}

// ── Init: Currency ────────────────────────────────────────────────────────────

function initCurrency() {
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
}

// ── Init: Display name ────────────────────────────────────────────────────────

function initDisplayName() {
  document.getElementById('display-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!localStorage.getItem('token')) {
      showToast('You must be logged in to save a display name.');
      return;
    }
    const btn = document.getElementById('btn-display-name');
    btn.disabled = true;
    authFetch('/api/me/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName: document.getElementById('display-name').value.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        const msg =
          data.message === 'Display name updated.'
            ? 'Display name saved.'
            : data.message || 'Failed to save.';
        showToast(msg);
      })
      .catch(() => showToast('Failed to save display name.'))
      .finally(() => {
        btn.disabled = false;
      });
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

function saveNotifications() {
  if (!localStorage.getItem('token')) return;
  authFetch('/api/me/notifications', {
    method: 'PUT',
    body: JSON.stringify({
      notifyOrders: document.getElementById('toggle-notify-orders').checked,
      notifyPromotions: document.getElementById('toggle-notify-promotions').checked,
      notifyEmail: document.getElementById('toggle-notify-email').checked,
    }),
  })
    .then(() => showToast('Notification preference saved'))
    .catch(() => {});
}

function initNotifications() {
  document.getElementById('toggle-notify-orders').addEventListener('change', saveNotifications);
  document.getElementById('toggle-notify-promotions').addEventListener('change', saveNotifications);
  document.getElementById('toggle-notify-email').addEventListener('change', saveNotifications);
}

// ── Init: Password change ─────────────────────────────────────────────────────

function initPasswordChange() {
  document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!localStorage.getItem('token')) {
      showToast('You must be logged in to change your password.');
      return;
    }
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.');
      return;
    }
    const btn = document.getElementById('btn-password');
    btn.disabled = true;
    authFetch('/api/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message === 'Password updated successfully.') {
          showToast('Password updated.');
          document.getElementById('password-form').reset();
        } else {
          showToast(data.message || 'Failed to update password.');
        }
      })
      .catch(() => showToast('Failed to update password.'))
      .finally(() => {
        btn.disabled = false;
      });
  });
}

// ── Init: Account deletion ────────────────────────────────────────────────────

function initAccountDeletion() {
  const btnDelete = document.getElementById('btn-delete-account');
  const deleteConfirm = document.getElementById('delete-confirm');
  const btnConfirm = document.getElementById('btn-confirm-delete');
  const btnCancel = document.getElementById('btn-cancel-delete');

  btnDelete.addEventListener('click', () => {
    deleteConfirm.classList.remove('d-none');
    btnDelete.classList.add('d-none');
  });

  btnCancel.addEventListener('click', () => {
    deleteConfirm.classList.add('d-none');
    btnDelete.classList.remove('d-none');
    document.getElementById('delete-confirm-input').value = '';
  });

  btnConfirm.addEventListener('click', () => {
    if (!localStorage.getItem('token')) {
      showToast('You must be logged in to delete your account.');
      return;
    }
    if (document.getElementById('delete-confirm-input').value !== 'DELETE') {
      showToast('Type DELETE to confirm.');
      return;
    }
    btnConfirm.disabled = true;
    authFetch('/api/me', { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.message === 'Account deleted.') {
          localStorage.clear();
          window.location.href = 'noir.html';
        } else {
          showToast(data.message || 'Failed to delete account.');
          btnConfirm.disabled = false;
        }
      })
      .catch(() => {
        showToast('Failed to delete account.');
        btnConfirm.disabled = false;
      });
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadFromBackend();
  initTheme();
  initFontSize();
  initMotion();
  initCurrency();
  initDisplayName();
  initNotifications();
  initPasswordChange();
  initAccountDeletion();
});
