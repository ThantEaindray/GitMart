document.addEventListener('DOMContentLoaded', () => {
  // Get logout button if it exists on the page
  const logoutBtn = document.getElementById('logoutBtn');

  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener('click', () => {
    // Clear saved login session from browser
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('username');
    localStorage.removeItem('isStaff');

    // Send user back to login page
    window.location.href = '/html/login.html';
  });
});