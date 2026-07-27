

// Order history page elements
const ordersList = document.getElementById('ordersList');
const ordersCount = document.getElementById('ordersCount');
const ordersPending = document.getElementById('ordersPending');
const ordersProcessing = document.getElementById('ordersProcessing');
const ordersDelivered = document.getElementById('ordersDelivered');
const refreshOrdersButton = document.getElementById('refreshOrders');

// Current orders shown on the page
let allOrders = [];
let activeFilter = 'all';

// Show short feedback messages.
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// Format prices for display.
function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

// Keep status comparisons consistent.
function normalizeStatus(status) {
  return String(status || 'Pending').toLowerCase();
}

// Frontend options mirror the backend fulfilment rules.
const STATUS_TRANSITIONS = Object.freeze({
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
});

// Show dates in Singapore time.
function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Render the item rows inside a single order.
function renderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="orders-status">No item details were saved for this order.</p>';
  }

  return items
    .map((item) => {
      const quantity = Number(item.quantity || item.qty || 1);
      const price = Number(item.price || item.unitPrice || 0) * quantity;
      return `
        <div class="order-item-row">
          <div class="order-item-name">${item.name || item.title || 'Item'}</div>
          <div class="order-item-qty">Qty ${quantity}</div>
          <div class="order-item-price">${formatMoney(price)}</div>
        </div>
      `;
    })
    .join('');
}

// Build the status dropdown choices.
function createStatusOptions(currentStatus) {
  const safeCurrentStatus = currentStatus || 'Pending';
  const options = [safeCurrentStatus, ...(STATUS_TRANSITIONS[safeCurrentStatus] || [])];
  return options
    .map(
      (status) =>
        `<option value="${status}" ${status === safeCurrentStatus ? 'selected' : ''}>${status}</option>`,
    )
    .join('');
}

function getStatusControlHelp(currentStatus) {
  if (currentStatus === 'Delivered') {
    return 'This order is completed and cannot be changed.';
  }

  if (currentStatus === 'Cancelled') {
    return 'This order has been cancelled and cannot be changed.';
  }

  return 'Select the next valid fulfilment status.';
}

// Render timestamped fulfilment updates for buyer tracking.
function renderStatusTimeline(statusHistory = []) {
  if (!Array.isArray(statusHistory) || statusHistory.length === 0) {
    return '<p class="orders-status timeline-empty">No tracking updates are available yet.</p>';
  }

  return `
    <div class="order-timeline" aria-label="Order tracking timeline">
      ${statusHistory
        .map((entry) => {
          const status = normalizeStatus(entry.status);
          return `
            <div class="timeline-entry">
              <span class="timeline-dot ${status}" aria-hidden="true"></span>
              <div class="timeline-copy">
                <div class="timeline-row">
                  <span class="timeline-status">${entry.status || 'Pending'}</span>
                  <span class="timeline-date">${formatDate(entry.createdAt)}</span>
                </div>
                <p class="timeline-note">${entry.note || 'Order tracking was updated.'}</p>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

// Render one expandable order card.
function renderOrder(order) {
  const status = normalizeStatus(order.status);
  const total = Number(order.totalAmount || order.total || 0);
  const card = document.createElement('article');
  card.className = 'order-card';
  card.dataset.status = status;

  card.innerHTML = `
    <div class="order-card-header" role="button" tabindex="0" aria-label="Toggle order ${order.id}">
      <div class="order-main">
        <div class="order-id-row">
          <span class="order-id">Order #${order.id}</span>
          <span class="status-badge ${status}">${status}</span>
        </div>
        <div class="order-date">${formatDate(order.createdAt)}</div>
        <div class="order-address">${order.fullName || 'Customer'} - ${order.address || 'No address'} ${order.unitNumber || ''}</div>
      </div>
      <div class="order-side">
        <span class="order-total">${formatMoney(total)}</span>
        <i class="bi bi-chevron-down order-chevron"></i>
      </div>
    </div>

    <div class="order-card-body">
      <div class="order-body-inner">
        <div class="order-items-list">${renderItems(order.items)}</div>

        <div class="order-detail-grid">
          <div class="order-detail-block">
            <p class="order-detail-title">Shipping</p>
            <p class="order-detail-line">${order.fullName || '-'}</p>
            <p class="order-detail-line muted">${order.emailAddress || '-'}</p>
            <p class="order-detail-line muted">${order.phoneNumber || '-'}</p>
            <p class="order-detail-line muted">${order.address || '-'} ${order.unitNumber || ''}</p>
            <p class="order-detail-line muted">Postal ${order.postalCode || '-'}</p>
          </div>
          <div class="order-detail-block">
            <p class="order-detail-title">Delivery & Payment</p>
            <p class="order-detail-line">${order.deliveryMethod || '-'}</p>
            <p class="order-detail-line muted">${order.paymentMethod || '-'}</p>
            <p class="order-detail-line muted">${order.deliveryNotes || 'No delivery notes.'}</p>
          </div>
        </div>

        <section class="order-tracking-panel" aria-label="Order tracking updates">
          <p class="order-detail-title">Tracking Timeline</p>
          ${renderStatusTimeline(order.statusHistory)}
        </section>

        <div class="order-actions">
          <div class="status-control">
            <label for="status-${order.id}">Status</label>
            <select class="status-dropdown" id="status-${order.id}" data-id="${order.id}">
              ${createStatusOptions(order.status || 'Pending')}
            </select>
            <p class="status-help">${getStatusControlHelp(order.status || 'Pending')}</p>
          </div>

          <div class="order-price-summary">
            <div class="order-price-row">
              <span class="order-price-label">Subtotal</span>
              <span class="order-price-value">${formatMoney(order.subtotal)}</span>
            </div>
            <div class="order-price-row">
              <span class="order-price-label">Delivery</span>
              <span class="order-price-value">${Number(order.deliveryFee || 0) === 0 ? 'FREE' : formatMoney(order.deliveryFee)}</span>
            </div>
            <div class="order-price-row">
              <span class="order-price-label">GST</span>
              <span class="order-price-value">${formatMoney(order.gst)}</span>
            </div>
            <hr class="order-price-divider" />
            <div class="order-price-total-row">
              <span class="order-price-total-label">Total</span>
              <span class="order-price-total-value">${formatMoney(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Let users open and close the order details.
  card.querySelector('.order-card-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Let keyboard users open and close the order details.
  card.querySelector('.order-card-header').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    card.classList.toggle('open');
  });

  // Update order status from the dropdown.
  const statusDropdown = card.querySelector('.status-dropdown');
  statusDropdown.addEventListener('click', (event) => event.stopPropagation());
  statusDropdown.addEventListener('change', async () => {
    try {
      const response = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: statusDropdown.value }),
      });
      const updatedOrder = await response.json();

      if (!response.ok) {
        throw new Error(updatedOrder.message || 'Failed to update order status.');
      }

      order.status = updatedOrder.status;
      order.statusHistory = updatedOrder.statusHistory;
      showToast('Order status updated.');
      renderOrders();
    } catch (error) {
      console.error(error);
      showToast('Failed to update order status.');
      statusDropdown.value = order.status;
    }
  });

  return card;
}

// Update the summary numbers at the top of the page.
function updateSummary() {
  const pendingCount = allOrders.filter(
    (order) => normalizeStatus(order.status) === 'pending',
  ).length;
  const processingCount = allOrders.filter(
    (order) => normalizeStatus(order.status) === 'processing',
  ).length;
  const deliveredCount = allOrders.filter(
    (order) => normalizeStatus(order.status) === 'delivered',
  ).length;

  ordersCount.textContent = allOrders.length;
  ordersPending.textContent = pendingCount;
  ordersProcessing.textContent = processingCount;
  ordersDelivered.textContent = deliveredCount;
}

// Render the order list using the active filter.
function renderOrders() {
  updateSummary();
  const filtered =
    activeFilter === 'all'
      ? allOrders
      : allOrders.filter((order) => normalizeStatus(order.status) === activeFilter);

  ordersList.innerHTML = '';

  if (filtered.length === 0) {
    ordersList.innerHTML = '<p class="orders-status">No orders match this view.</p>';
    return;
  }

  filtered.forEach((order) => {
    ordersList.appendChild(renderOrder(order));
  });
}

// Load the current user's order history.
async function loadOrders() {
  if (!localStorage.getItem('token')) {
    showToast('Please log in to view orders.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  ordersList.innerHTML = '<p class="orders-status">Loading orders...</p>';

  try {
    const response = await authFetch('/api/orders');
    const orders = await response.json();

    if (!response.ok) throw new Error(orders.message || orders.error || 'Failed to load orders.');
    allOrders = Array.isArray(orders) ? orders : [];
    renderOrders();
  } catch (error) {
    console.error(error);
    ordersList.innerHTML = '<p class="orders-status">Failed to load orders.</p>';
  }
}

// Wire up filters and initial order loading.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.orders-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      renderOrders();
    });
  });

  refreshOrdersButton.addEventListener('click', loadOrders);
  loadOrders();
});
