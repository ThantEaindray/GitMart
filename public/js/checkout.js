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

    // Card number validation pattern
    const cardNumberPattern = /^[0-9]{16}$/;

    // Expiry date validation pattern
    const expiryDatePattern = /^(0[1-9]|1[0-2])\/\d{2}$/;

    // CVV validation pattern
    const cvvPattern = /^[0-9]{3}$/;

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

    // Get selected payment method
    const selectedPayment =
        document.querySelector(`input[name="payment"]:checked`);

    // Check if payment method is selected
    if (!selectedPayment) {
        alert('Please select a payment method.');
        return;
    }

    // Check card details if Visa/Mastercard selected
    if (selectedPayment.id === `cardPayment`) {

        const cardName =
            document.getElementById(`cardName`).value.trim();

        const cardNumber =
            document.getElementById(`cardNumber`).value.trim();

        const expiryDate =
            document.getElementById(`expiryDate`).value.trim();

        const cvv =
            document.getElementById(`cvv`).value.trim();

        // Check if card fields are empty
        if (
            cardName === '' ||
            cardNumber === '' ||
            expiryDate === '' ||
            cvv === '' 
        ) {
            alert('Please fill in all card details.');
            return;
        }

        // Check if card number contains only numbers
        if (!cardNumberPattern.test(cardNumber)) {
            alert('Card number must contain exactly 16 digits.');
            return;
        }

        // Check if CVV is valid
        if (!cvvPattern.test(cvv)) {
            alert('CVV must be a 3-digit number.');
            return;
        }

        // Check if expiry date format is valid
        if (!expiryDatePattern.test(expiryDate)) {
            alert('Expiry date must follow MM/YY format.');
            return;
        }
    }

    // Create order object
    const orderData = {
        fullName,
        emailAddress,
        phoneNumber,
        address,
        postalCode,
    };

    // Send order data to backend
    fetch('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then((response) => response.json())
    .then((data) => {

        // Show success message
        alert('Order placed successfully!');

        console.log(data);
    })
    .catch((error) => {

        console.error(error);

        alert('Failed to place order.');
    });
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



// Get card payment radio button
const cardPaymentRadio =
    document.getElementById('cardPayment');

// Get card input fields
const cardInputs = [
    document.getElementById('cardName'),
    document.getElementById('cardNumber'),
    document.getElementById('expiryDate'),
    document.getElementById('cvv')
];

// Automatically select card payment
cardInputs.forEach((input) => {

    input.addEventListener('input', () => {
        cardPaymentRadio.checked = true;
    });
});