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
                <p>Address: ${order.address} ${order.unitNumber}</p>
                <p>Postal Code: ${order.postalCode}</p>
                <p>Delivery: ${order.deliveryMethod}</p>
                <p>Payment: ${order.paymentMethod}</p>
                <p>Total: $${Number(order.totalAmount).toFixed(2)}</p>
                <p>
                Status:
                <select class="statusDropdown" data-id="${order.id}">
                    <option value="Pending"
                        ${order.status === 'Pending' ? 'selected' : ''}>
                        Pending
                    </option>

                    <option value="Processing"
                        ${order.status === 'Processing' ? 'selected' : ''}>
                        Processing
                    </option>

                    <option value="Delivered"
                        ${order.status === 'Delivered' ? 'selected' : ''}>
                        Delivered
                    </option>

                    <option value="Cancelled"
                        ${order.status === 'Cancelled' ? 'selected' : ''}>
                        Cancelled
                    </option>
                </select>
                </p>
                <p>Created At: ${
                    new Date(order.createdAt).toLocaleString('en-SG', {
                        timeZone: 'Asia/Singapore',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })
                }</p>
            `;

            ordersList.appendChild(orderCard);

            const statusDropdown =
            orderCard.querySelector('.statusDropdown');
            
            statusDropdown.addEventListener('change', () => {
                
                fetch(`http://localhost:3000/orders/${order.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status: statusDropdown.value,
                    }),
                })
                
                .then((response) => response.json())
                .then((updatedOrder) => {
                    console.log(updatedOrder);
                    
                    alert('Order status updated successfully!');
                })
                
                .catch((error) => {

                    console.error(error);
                    
                    alert('Failed to update order status.');
                });
            });
        });
    })
    .catch((error) => {

        console.error(error);

        ordersList.innerHTML = '<p>Failed to load orders.</p>';
    });