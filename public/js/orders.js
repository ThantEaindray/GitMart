// Get orders list container
const ordersList = document.getElementById('ordersList');

// Load orders from backend
fetch('http://localhost:3000/orders')
    .then((response) => response.json())
    .then((orders) => {

        ordersList.innerHTML = '';

        if (orders.length === 0) {
            ordersList.innerHTML = '<p>No orders found.</p>';
            return;
        }

        orders.forEach((order) => {

            const orderCard = document.createElement('div');
            orderCard.className = 'checkout-section';

            orderCard.innerHTML = `
                <h3>Order #${order.id}</h3>
                <p>Customer: ${order.fullName}</p>
                <p>Email: ${order.emailAddress}</p>
                <p>Phone: ${order.phoneNumber}</p>
                <p>Delivery: ${order.deliveryMethod}</p>
                <p>Payment: ${order.paymentMethod}</p>
                <p>Total: $${Number(order.totalAmount).toFixed(2)}</p>
                <p>Status: ${order.status}</p>
                <p>Created At: ${order.createdAt}</p>
            `;

            ordersList.appendChild(orderCard);
        });
    })
    .catch((error) => {

        console.error(error);

        ordersList.innerHTML = '<p>Failed to load orders.</p>';
    });