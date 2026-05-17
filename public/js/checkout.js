// Get place order button
const placeOrderButton = document.getElementById('placeOrderButton');

// Add click event listener
placeOrderButton.addEventListener('click', () => {

    // Get shipping form values
    const fullName = document.getElementById('fullName').value.trim();
    const emailAddress = document.getElementById('emailAddress').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const address = document.getElementById('address').value.trim();
    const postalCode = document.getElementById('postalCode').value.trim();

    // Email validation pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Phone number validation pattern
    const phonePattern = /^[0-9]+$/;

    // Check if required fields are empty
    if (
        fullName === '' ||
        emailAddress === '' ||
        phoneNumber === '' ||
        address === '' ||
        postalCode === ''
    ) {
        alert('Please fill in all required shipping information.');
        return;
    }

    // Check if email format is valid 
    if (!emailPattern.test(emailAddress)) {

        alert('Please enter a valid email address.');
        return;
    }

    // Check if phone number contains only numbers
    if (!phonePattern.test(phoneNumber)) {

        alert('Phone number must contain numbers only.');
        return;
    }

    // Success message
    alert('Order placed successfully!');
});

// Get delivery options 
const deliveryOptions = document.querySelectorAll(
    'input[name="delivery"]'
);

// Get summary elements
const deliveryFeeText = document.getElementById('deliveryFee');
const totalPriceText = document.getElementById('totalPrice');

// Base subtotal and GST
const subtotal = 586.23;
const gst = 52.76;

// Add event listener to each delivery option
deliveryOptions.forEach((option) => {

    option.addEventListener('change', () => {

        // Get selected delivery fee
        const deliveryFee = parseFloat(option.value);

        // Calculate total
        const total = subtotal + gst + deliveryFee;

        // Update delivery fee text
        if (deliveryFee === 0) {
            deliveryFeeText.textContent = `Delivery Fee: FREE`;
        } else {
            deliveryFeeText.textContent = `Delivery Fee: $${deliveryFee.toFixed(2)}`;
        }

        // Update total price
        totalPriceText.textContent = `Total: $${total.toFixed(2)}`;
    });
});