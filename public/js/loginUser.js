document.addEventListener('DOMContentLoaded', () => {
  const loginForm   = document.getElementById('loginForm');
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');
  const successCard = document.getElementById('successCard');

  // Show post-registration success banner if redirected from register page
  if (successCard && new URLSearchParams(window.location.search).get('registered') === '1') {
    successCard.classList.remove('d-none');
  }

  const showWarning = (msg) => {
    warningText.textContent = msg;
    warningCard.classList.remove('d-none');
  };

  const hideWarning = () => {
    warningText.textContent = '';
    warningCard.classList.add('d-none');
  };

  // ── Inline field errors ────────────────────────────────────────────────

  const showFieldError = (fieldId, msg) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.add('input-error');
    let err = input.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
  };

  const clearFieldError = (fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.remove('input-error');
    const err = input.parentElement.querySelector('.field-error');
    if (err) err.textContent = '';
  };

  ['username', 'password'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      clearFieldError(id);
      hideWarning();
    });
  });

  if (!loginForm) {
    console.error('loginForm not found. Check login.html.');
    return;
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideWarning();
    ['username', 'password'].forEach(clearFieldError);

    const username   = document.getElementById('username').value.trim();
    const password   = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    let valid = true;
    if (!username) { showFieldError('username', 'Username is required.'); valid = false; }
    if (!password) { showFieldError('password', 'Password is required.'); valid = false; }
    if (!valid) return;

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe }),
    })
      .then((response) =>
        response.json().then((data) => ({ status: response.status, data }))
      )
      .then(({ status, data }) => {
        if (status === 200 && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('loggedInUserId', data.userId);
          localStorage.setItem('username', data.username);
          localStorage.setItem('isStaff', data.isStaff);

          fetch('/api/me/settings', {
            headers: { Authorization: `Bearer ${data.token}` },
          })
            .then((r) => r.json())
            .then((prefs) => {
              if (prefs.theme) localStorage.setItem('theme', prefs.theme);
              else localStorage.removeItem('theme');
              if (prefs.currency) localStorage.setItem('currency', prefs.currency);
              if (prefs.font_size) localStorage.setItem('font', prefs.font_size);
              else localStorage.removeItem('font');
            })
            .catch(() => {})
            .finally(() => {
              window.location.href = '/html/profile.html';
            });
        } else if (status === 404) {
          showFieldError('username', 'No account found with that username.');
        } else if (status === 401) {
          showFieldError('password', 'Incorrect password.');
        } else {
          showWarning(data.message || data.error || 'Login failed.');
        }
      })
      .catch(() => showWarning('Something went wrong. Please try again.'));
  });
});
