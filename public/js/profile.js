document.addEventListener('DOMContentLoaded', () => {
  // Get token from localStorage to check if user is logged in
  const token = localStorage.getItem('token');

  // Get profile display elements
  const usernameText = document.getElementById('profileUsername');
  const emailText = document.getElementById('profileEmail');
  const staffText = document.getElementById('profileStaff');
  const createdText = document.getElementById('profileCreatedOn');
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');

  // Show profile loading/session errors
  const showWarning = (message) => {
    if (warningCard && warningText) {
      warningText.textContent = message;
      warningCard.classList.remove('d-none');
    } else {
      alert(message);
    }
  };

  // If no token exists, user should log in first
  if (!token) {
    window.location.href = '/html/login.html';
    return;
  }

  // Request current user details from protected backend route
  authFetch('/api/me')
    .then((response) =>
      response.json().then((data) => ({
        status: response.status,
        data,
      }))
    )
    .then(({ status, data }) => {
      console.log('Current user response:', status, data);

      // If token is invalid/expired, clear session and redirect to login
      if (status !== 200) {
        localStorage.removeItem('token');
        localStorage.removeItem('loggedInUserId');
        localStorage.removeItem('username');
        localStorage.removeItem('isStaff');

        showWarning(data.message || data.error || 'Session expired. Please log in again.');

        setTimeout(() => {
          window.location.href = '/html/login.html';
        }, 1000);

        return;
      }

      // Display user details on the profile page
      if (usernameText) usernameText.textContent = data.username;
      if (emailText) emailText.textContent = data.email;
      if (staffText) staffText.textContent = data.isStaff ? 'Staff' : 'Normal User';

      if (createdText) {
        const date = data.created_on ? new Date(data.created_on).toLocaleDateString() : '-';
        createdText.textContent = date;
      }
    })
    .catch((error) => {
      console.error('Profile error:', error);
      showWarning('Failed to load profile.');
    });
});