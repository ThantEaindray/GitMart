document.addEventListener('DOMContentLoaded', () => {
  // Get the register form and warning message elements
  const registerForm = document.getElementById('registerForm');
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');

  // Display error messages to the user
  const showWarning = (message) => {
    warningText.textContent = message;
    warningCard.classList.remove('d-none');
  };

  // Clear old warning messages
  const hideWarning = () => {
    warningText.textContent = '';
    warningCard.classList.add('d-none');
  };

  // Stop the script if the register form is not found
  if (!registerForm) {
    console.error('registerForm not found. Check register.html.');
    return;
  }

  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideWarning();

    // Read values from the register form
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Basic frontend validation before sending to backend
    if (!username || !email || !password || !confirmPassword) {
      showWarning('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      showWarning('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showWarning('Passwords do not match.');
      return;
    }

    // Send registration details to backend
    fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    })
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data,
        }))
      )
      .then(({ status, data }) => {
        console.log('Register response:', status, data);

        // Auto-login the user after successful registration
        if (status === 200 && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('loggedInUserId', data.userId);
          localStorage.setItem('username', data.username);
          localStorage.setItem('isStaff', data.isStaff);

          window.location.href = '/html/profile.html';
        } else {
          showWarning(data.message || data.error || 'Registration failed.');
        }
      })
      .catch((error) => {
        console.error('Register error:', error);
        showWarning('Something went wrong. Please try again.');
      });
  });
});