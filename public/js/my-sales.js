// My Sales page — orders that include one or more of the seller's own
// listings. Reuses orders.css's card/tab/badge styling, but each card only
// ever shows the caller's own items out of an order (a buyer's cart can mix
// listings from several sellers in one checkout), and the status is
// read-only here — updating fulfilment status stays the buyer's page.
const salesList = document.getElementById('salesList');
const salesOrderCount = document.getElementById('salesOrderCount');
const salesItemCount = document.getElementById('salesItemCount');
const salesRevenue = document.getElementById('salesRevenue');
const refreshSalesButton = document.getElementById('refreshSales');

let allSales = [];
let activeSalesFilter = 'all';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalizeStatus(status) {
  return String(status || 'Pending').toLowerCase();
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function saleTotal(sale) {
  return sale.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function buildTextEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function buildItemRow(item) {
  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.appendChild(buildTextEl('div', 'order-item-name', item.itemName));
  row.appendChild(buildTextEl('div', 'order-item-qty', `Qty ${item.quantity}`));
  row.appendChild(buildTextEl('div', 'order-item-price', formatMoney(item.price * item.quantity)));
  return row;
}

function buildSaleCard(sale) {
  const status = normalizeStatus(sale.status);
  const total = saleTotal(sale);

  const card = document.createElement('article');
  card.className = 'order-card';
  card.dataset.status = status;

  const header = document.createElement('div');
  header.className = 'order-card-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-label', `Toggle order ${sale.orderId}`);

  const main = document.createElement('div');
  main.className = 'order-main';

  const idRow = document.createElement('div');
  idRow.className = 'order-id-row';
  idRow.appendChild(buildTextEl('span', 'order-id', `Order #${sale.orderId}`));
  const badge = buildTextEl('span', `status-badge ${status}`, sale.status || 'Pending');
  idRow.appendChild(badge);
  main.appendChild(idRow);

  main.appendChild(buildTextEl('div', 'order-date', formatDate(sale.createdAt)));
  main.appendChild(buildTextEl('div', 'order-address', `Buyer: ${sale.buyerName}`));

  const side = document.createElement('div');
  side.className = 'order-side';
  side.appendChild(buildTextEl('span', 'order-total', formatMoney(total)));
  const chevron = document.createElement('i');
  chevron.className = 'bi bi-chevron-down order-chevron';
  side.appendChild(chevron);

  header.appendChild(main);
  header.appendChild(side);

  const body = document.createElement('div');
  body.className = 'order-card-body';
  const bodyInner = document.createElement('div');
  bodyInner.className = 'order-body-inner';

  const itemsList = document.createElement('div');
  itemsList.className = 'order-items-list';
  sale.items.forEach((item) => itemsList.appendChild(buildItemRow(item)));
  bodyInner.appendChild(itemsList);

  const priceSummary = document.createElement('div');
  priceSummary.className = 'order-price-summary';
  const totalRow = document.createElement('div');
  totalRow.className = 'order-price-total-row';
  totalRow.appendChild(buildTextEl('span', 'order-price-total-label', 'Your total'));
  totalRow.appendChild(buildTextEl('span', 'order-price-total-value', formatMoney(total)));
  priceSummary.appendChild(totalRow);
  bodyInner.appendChild(priceSummary);

  body.appendChild(bodyInner);
  card.appendChild(header);
  card.appendChild(body);

  header.addEventListener('click', () => card.classList.toggle('open'));
  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    card.classList.toggle('open');
  });

  return card;
}

function updateSummary() {
  const itemCount = allSales.reduce(
    (sum, sale) => sum + sale.items.reduce((s, item) => s + item.quantity, 0),
    0,
  );
  const revenue = allSales.reduce((sum, sale) => sum + saleTotal(sale), 0);

  salesOrderCount.textContent = allSales.length;
  salesItemCount.textContent = itemCount;
  salesRevenue.textContent = formatMoney(revenue);
}

function updateFilterCounts() {
  const counts = allSales.reduce(
    (totals, sale) => {
      const status = normalizeStatus(sale.status);
      totals.all += 1;
      totals[status] = (totals[status] || 0) + 1;
      return totals;
    },
    { all: 0, pending: 0, processing: 0, delivered: 0, cancelled: 0 },
  );

  document.querySelectorAll('[data-count]').forEach((countBadge) => {
    countBadge.textContent = counts[countBadge.dataset.count] || 0;
  });
}

function getEmptySalesMessage(filter) {
  const messages = {
    all: 'No sales yet. Once a buyer checks out with one of your listings, it will show up here.',
    pending: 'No pending sales right now.',
    processing: 'No processing sales at the moment.',
    delivered: 'No delivered sales yet.',
    cancelled: 'No cancelled sales right now.',
  };
  return messages[filter] || 'No sales match this view.';
}

function renderSales() {
  updateSummary();
  updateFilterCounts();

  const filtered =
    activeSalesFilter === 'all'
      ? allSales
      : allSales.filter((sale) => normalizeStatus(sale.status) === activeSalesFilter);

  salesList.innerHTML = '';

  if (filtered.length === 0) {
    salesList.appendChild(
      buildTextEl('p', 'orders-status', getEmptySalesMessage(activeSalesFilter)),
    );
    return;
  }

  filtered.forEach((sale) => salesList.appendChild(buildSaleCard(sale)));
}

async function loadSales() {
  if (!localStorage.getItem('token')) {
    salesList.innerHTML = '';
    salesList.appendChild(buildTextEl('p', 'orders-status', 'Please log in to view your sales.'));
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  salesList.innerHTML = '';
  salesList.appendChild(buildTextEl('p', 'orders-status', 'Loading sales...'));

  try {
    const response = await authFetch('/api/orders/sales');
    const sales = await response.json();

    if (!response.ok) throw new Error(sales.message || 'Failed to load sales.');
    allSales = Array.isArray(sales) ? sales : [];
    renderSales();
  } catch (error) {
    console.error(error);
    salesList.innerHTML = '';
    salesList.appendChild(buildTextEl('p', 'orders-status', 'Failed to load sales.'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.orders-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      activeSalesFilter = tab.dataset.filter;
      renderSales();
    });
  });

  refreshSalesButton.addEventListener('click', loadSales);
  loadSales();
});
