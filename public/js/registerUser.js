document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const warningCard  = document.getElementById('warningCard');
  const warningText  = document.getElementById('warningText');

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
    input.classList.remove('input-valid');
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

  const clearAllErrors = () => {
    ['username', 'email', 'password', 'confirmPassword'].forEach(clearFieldError);
    hideWarning();
  };

  // Clear field error as soon as user types in it
  ['username', 'email', 'password', 'confirmPassword'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => clearFieldError(id));
  });

  // ── Live password requirements ─────────────────────────────────────────

  const updateReq = (id, met) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('met', met);
    el.querySelector('i').className = `bi bi-${met ? 'check-circle-fill' : 'x-circle'}`;
  };

  document.getElementById('password')?.addEventListener('input', (e) => {
    const val = e.target.value;
    updateReq('req-length', val.length >= 8);
    updateReq('req-number', /\d/.test(val));
    updateReq('req-upper',  /[A-Z]/.test(val));
  });

  if (!registerForm) {
    console.error('registerForm not found.');
    return;
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearAllErrors();

    const username        = document.getElementById('username').value.trim();
    const email           = document.getElementById('email').value.trim();
    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    let valid = true;

    if (!username) {
      showFieldError('username', 'Username is required.');
      valid = false;
    } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showFieldError('username', 'Username must be 3–20 characters (letters, numbers, underscores only).');
      valid = false;
    }

    if (!email) {
      showFieldError('email', 'Email is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email', 'Please enter a valid email address.');
      valid = false;
    }

    if (!password) {
      showFieldError('password', 'Password is required.');
      valid = false;
    } else if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      showFieldError('password', 'Password does not meet all requirements below.');
      valid = false;
    }

    if (!confirmPassword) {
      showFieldError('confirmPassword', 'Please confirm your password.');
      valid = false;
    } else if (password && password !== confirmPassword) {
      showFieldError('confirmPassword', 'Passwords do not match.');
      valid = false;
    }

    if (!valid) return;

    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
      .then((response) =>
        response.json().then((data) => ({ status: response.status, data }))
      )
      .then(({ status, data }) => {
        if (status === 201) {
          // Redirect to login with a success flag — user logs in manually
          window.location.href = '/html/login.html?registered=1';
        } else if (status === 409) {
          // Duplicate username or email — show on the relevant field
          const msg = data.message || '';
          if (msg.toLowerCase().includes('username')) {
            showFieldError('username', 'This username is already taken.');
          } else if (msg.toLowerCase().includes('email')) {
            showFieldError('email', 'An account with this email already exists.');
          } else {
            showWarning(msg);
          }
        } else {
          showWarning(data.message || data.error || 'Registration failed.');
        }
      })
      .catch(() => showWarning('Something went wrong. Please try again.'));
  });
});
