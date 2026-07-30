document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  const usernameText = document.getElementById('profileUsername');
  const emailText = document.getElementById('profileEmail');
  const staffText = document.getElementById('profileStaff');
  const createdText = document.getElementById('profileCreatedOn');
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');

  const profileImagePreview = document.getElementById('profileImagePreview');
  const profileImageInput = document.getElementById('profileImageInput');
  const uploadProfileImageBtn = document.getElementById('uploadProfileImageBtn');
  const removeProfileImageBtn = document.getElementById('removeProfileImageBtn');

  let selectedProfileImageBase64 = null;

  const showWarning = (message) => {
    if (warningCard && warningText) {
      warningText.textContent = message;
      warningCard.classList.remove('d-none');
    }
  };

  const getProfileImageStorageKey = () => {
    const userId = localStorage.getItem('loggedInUserId') || 'current';
    return 'profileImage_' + userId;
  };

  const showProfileImage = (imageData) => {
    if (!profileImagePreview || !imageData) return;

    const src = imageData.startsWith('data:image/')
      ? imageData
      : `data:image/jpeg;base64,${imageData}`;

    profileImagePreview.innerHTML = `
    <img src="${src}" alt="Profile image" />
  `;
  };

  if (!token) {
    window.location.href = '/html/login.html';
    return;
  }

  authFetch('/api/me')
    .then((response) =>
      response.json().then((data) => ({
        status: response.status,
        data,
      })),
    )
    .then(({ status, data }) => {
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

      if (usernameText) usernameText.textContent = data.username;
      if (emailText) emailText.textContent = data.email;
      if (staffText) staffText.textContent = data.isStaff ? 'Staff' : 'Normal User';

      if (createdText) {
        const date = data.created_on ? new Date(data.created_on).toLocaleDateString() : '-';
        createdText.textContent = date;
      }

      if (data.profile_image) {
        showProfileImage(data.profile_image);
        localStorage.setItem(
          getProfileImageStorageKey(),
          `data:image/jpeg;base64,${data.profile_image}`,
        );
      } else {
        const savedProfileImage = localStorage.getItem(getProfileImageStorageKey());
        if (savedProfileImage) {
          showProfileImage(savedProfileImage);
        }
      }
    })
    .catch((error) => {
      console.error('Profile error:', error);
      showWarning('Failed to load profile.');
    });

  if (profileImageInput) {
    profileImageInput.addEventListener('change', () => {
      const file = profileImageInput.files[0];

      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showWarning('Please choose a valid image file.');
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        selectedProfileImageBase64 = reader.result;
        localStorage.setItem(getProfileImageStorageKey(), reader.result);
        showProfileImage(reader.result);
      };

      reader.readAsDataURL(file);
    });
  }

  if (uploadProfileImageBtn) {
    uploadProfileImageBtn.addEventListener('click', () => {
      if (!selectedProfileImageBase64) {
        showWarning('Please choose an image first.');
        return;
      }

      authFetch('/api/me/profile-image', {
        method: 'PUT',
        body: JSON.stringify({
          imageBase64: selectedProfileImageBase64,
        }),
      })
        .then((response) =>
          response.json().then((data) => ({
            status: response.status,
            data,
          })),
        )
        .then(({ status, data }) => {
          if (status !== 200) {
            showWarning(data.message || data.error || 'Failed to upload profile image.');
            return;
          }

          if (data.profile_image) {
            const savedImage = `data:image/jpeg;base64,${data.profile_image}`;
            localStorage.setItem(getProfileImageStorageKey(), savedImage);
            showProfileImage(savedImage);
          } else if (selectedProfileImageBase64) {
            localStorage.setItem(getProfileImageStorageKey(), selectedProfileImageBase64);
            showProfileImage(selectedProfileImageBase64);
          }

          selectedProfileImageBase64 = null;
          showWarning('Profile image updated successfully.');
        })
        .catch((error) => {
          console.error('Profile image upload error:', error);
          showWarning('Something went wrong while uploading profile image.');
        });
    });
  }

  if (removeProfileImageBtn) {
    removeProfileImageBtn.addEventListener('click', () => {
      authFetch('/api/me/profile-image', { method: 'DELETE' })
        .then((response) => response.json().then((data) => ({ status: response.status, data })))
        .then(({ status, data }) => {
          if (status !== 200) {
            showWarning(data.message || 'Failed to remove profile image.');
            return;
          }
          if (profileImagePreview) {
            profileImagePreview.innerHTML = '<i class="bi bi-person"></i>';
          }
          localStorage.removeItem(getProfileImageStorageKey());
          selectedProfileImageBase64 = null;
          showWarning('Profile photo removed.');
        })
        .catch(() => showWarning('Something went wrong while removing profile image.'));
    });
  }
});
