const apiUrl = '.'; // Adjust this URL if your API is hosted elsewhere

// Function to populate the somethings table
function populateSomethingsTable() {
  fetch(`${apiUrl}/somethings`)
    .then((response) => response.json())
    .then((somethings) => {
      const somethingsTableBody = document.getElementById('somethingsTableBody');
      const rowTemplate = document.getElementById('somethingRowTemplate').content;
      somethingsTableBody.innerHTML = ''; // Clear existing rows

      somethings.forEach((something) => {
        const row = document.importNode(rowTemplate, true);
        row.querySelector('.something-id').textContent = something.id;
        row.querySelector('.something-name').textContent = something.name;
        row.querySelector('.delete-button').onclick = function () {
          deleteSomething(something.id);
        };

        somethingsTableBody.appendChild(row);
      });
    })
    .catch((error) => console.error('Error fetching somethings:', error));
}

// Function to add a new something
function addSomething(event) {
  event.preventDefault();
  const somethingName = document.getElementById('somethingName').value;

  fetch(`${apiUrl}/somethings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: somethingName,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(() => {
      populateSomethingsTable(); // Refresh the table
      document.getElementById('somethingForm').reset(); // Reset the form
    })
    .catch((error) => console.error('Error adding something:', error));
}

// Function to delete a something
function deleteSomething(id) {
  fetch(`${apiUrl}/somethings/${id}`, {
    method: 'DELETE',
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      populateSomethingsTable(); // Refresh the table
    })
    .catch((error) => console.error('Error deleting something:', error));
}

document.addEventListener('DOMContentLoaded', () => {
  // Event listener for form submission
  document.getElementById('somethingForm').addEventListener('submit', addSomething);

  // Populate the somethings table on page load
  populateSomethingsTable();
});
