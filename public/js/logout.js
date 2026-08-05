document.addEventListener('DOMContentLoaded', () => {
  // Get logout button if it exists on the page
  const logoutBtn = document.getElementById('logoutBtn');

  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener('click', () => {
    // Tell backend to revoke the refresh token and clear the httpOnly cookie
    fetch('/api/logout', { method: 'POST' }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('loggedInUserId');
      localStorage.removeItem('username');
      localStorage.removeItem('isStaff');
      window.location.href = '/html/login.html';
    });
  });
});
