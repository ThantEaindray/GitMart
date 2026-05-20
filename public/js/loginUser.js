document.addEventListener('DOMContentLoaded', () => {
  // Get the login form and warning message elements
  const loginForm = document.getElementById('loginForm');
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');

  // Show validation or backend error messages
  const showWarning = (message) => {
    warningText.textContent = message;
    warningCard.classList.remove('d-none');
  };

  // Hide warning before sending a new request
  const hideWarning = () => {
    warningText.textContent = '';
    warningCard.classList.add('d-none');
  };

  // Stop the script if the login form is not found
  if (!loginForm) {
    console.error('loginForm not found. Check login.html.');
    return;
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideWarning();

    // Read user input from the form
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    // Basic frontend validation before calling backend
    if (!username || !password) {
      showWarning('Username and password are required.');
      return;
    }

    // Send login details to backend
    fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        rememberMe,
      }),
    })
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data,
        }))
      )
      .then(({ status, data }) => {
        console.log('Login response:', status, data);

        // Save login session details if login succeeds
        if (status === 200 && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('loggedInUserId', data.userId);
          localStorage.setItem('username', data.username);
          localStorage.setItem('isStaff', data.isStaff);

          fetch('/api/me/settings', {
            headers: { 'Authorization': `Bearer ${data.token}` },
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
        } else {
          showWarning(data.message || data.error || 'Login failed.');
        }
      })
      .catch((error) => {
        console.error('Login error:', error);
        showWarning('Something went wrong. Please try again.');
      });
  });
});