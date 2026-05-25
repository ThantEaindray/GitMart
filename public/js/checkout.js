/* global authFetch */

const GST_RATE = 0.09;
const CART_STORAGE_KEYS = ['cart', 'checkoutCart', 'cartItems'];

const placeOrderButton = document.getElementById('placeOrderButton');
const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
const paymentOptions = document.querySelectorAll('input[name="payment"]');
const cardDetails = document.querySelector('.card-details');
const cardPaymentRadio = document.getElementById('cardPayment');
const orderItemsEl = document.getElementById('orderItems');
const subtotalPriceText = document.getElementById('subtotalPrice');
const deliveryFeeText = document.getElementById('deliveryFee');
const gstPriceText = document.getElementById('gstPrice');
const totalPriceText = document.getElementById('totalPrice');

let cartItems = [];
let subtotal = 0;
let gst = 0;
let summaryHeightObserver;
let summaryScrollFrame;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = document.querySelector(`[data-error-for="${fieldId}"]`);

  if (field) field.classList.toggle('input-error', Boolean(message));
  if (error) error.textContent = message;
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach((error) => {
    error.textContent = '';
  });
  document.querySelectorAll('.input-error').forEach((field) => {
    field.classList.remove('input-error');
  });
}

function getFieldValue(fieldId) {
  return document.getElementById(fieldId).value.trim();
}

function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function parseMoney(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return Number(cleaned);
  }
  return Number(value ?? 0);
}

function normalizeCartItem(item) {
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  const price = parseMoney(
    item.price ??
      item.unitPrice ??
      item.amount ??
      item.product?.price ??
      item.product?.unitPrice ??
      0,
  );

  return {
    id: item.id ?? item.productId ?? item.name,
    name: item.name ?? item.title ?? 'Cart item',
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
}

function readCartItems() {
  for (const key of CART_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (Array.isArray(items)) return items.map(normalizeCartItem);
    } catch {
      localStorage.removeItem(key);
    }
  }

  return [];
}

function getSelectedDeliveryFee() {
  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  return selectedDelivery ? Number(selectedDelivery.value) : 0;
}

function renderOrderSummary() {
  cartItems = readCartItems();
  subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  gst = subtotal * GST_RATE;

  orderItemsEl.innerHTML = '';

  if (cartItems.length === 0) {
    orderItemsEl.innerHTML = '<p class="status-text">Your cart is empty.</p>';
  } else {
    cartItems.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'order-item';
      row.innerHTML = `
        <p>${item.name} x${item.quantity}</p>
        <p>${formatMoney(item.price * item.quantity)}</p>
      `;
      orderItemsEl.appendChild(row);
    });
  }

  updateCheckoutTotals();
}

function updateCheckoutTotals() {
  const deliveryFee = getSelectedDeliveryFee();
  const total = subtotal + gst + deliveryFee;

  subtotalPriceText.textContent = formatMoney(subtotal);
  deliveryFeeText.textContent = deliveryFee === 0 ? 'FREE' : formatMoney(deliveryFee);
  gstPriceText.textContent = formatMoney(gst);
  totalPriceText.textContent = formatMoney(total);
}

function updateCardDetailsVisibility() {
  const isCardPayment = Boolean(cardPaymentRadio?.checked);
  cardDetails?.classList.toggle('is-visible', isCardPayment);
  cardDetails?.classList.toggle('visible', isCardPayment);

  if (!isCardPayment) {
    ['cardName', 'cardNumber', 'expiryDate', 'cvv'].forEach((fieldId) => {
      setFieldError(fieldId, '');
    });
  }
}

function syncOrderSummaryHeight() {
  const shippingSection = document.getElementById('step-shipping')?.closest('.checkout-section');
  const orderSummary = document.querySelector('.order-summary');
  if (!shippingSection || !orderSummary) return;

  const height = Math.round(shippingSection.getBoundingClientRect().height);
  orderSummary.style.setProperty('--order-summary-max-height', `${height}px`);
  updateOrderSummaryPosition();
}

function updateOrderSummaryPosition() {
  const orderSummary = document.querySelector('.order-summary');
  const shippingSection = document.getElementById('step-shipping')?.closest('.checkout-section');
  const paymentSection = document.getElementById('step-payment')?.closest('.checkout-section');
  if (
    !orderSummary ||
    !shippingSection ||
    !paymentSection ||
    window.matchMedia('(max-width: 860px)').matches
  ) {
    orderSummary?.style.removeProperty('--order-summary-top');
    return;
  }

  const stickyTop = 96;
  const bottomGap = 24;
  const summaryHeight = orderSummary.offsetHeight;
  const shippingTop = shippingSection.getBoundingClientRect().top;
  const paymentBottom = paymentSection.getBoundingClientRect().bottom;
  const maxTop = paymentBottom - summaryHeight - bottomGap;
  const alignedTop = Math.max(stickyTop, shippingTop);
  const nextTop = Math.max(24, Math.min(alignedTop, maxTop));

  orderSummary.style.setProperty('--order-summary-top', `${Math.round(nextTop)}px`);
}

function requestOrderSummaryPosition() {
  if (summaryScrollFrame) return;
  summaryScrollFrame = requestAnimationFrame(() => {
    summaryScrollFrame = null;
    updateOrderSummaryPosition();
  });
}

function watchOrderSummaryHeight() {
  syncOrderSummaryHeight();

  if (summaryHeightObserver) summaryHeightObserver.disconnect();
  const shippingSection = document.getElementById('step-shipping')?.closest('.checkout-section');
  if (!shippingSection || typeof ResizeObserver === 'undefined') return;

  summaryHeightObserver = new ResizeObserver(syncOrderSummaryHeight);
  summaryHeightObserver.observe(shippingSection);
  window.addEventListener('resize', syncOrderSummaryHeight);
  window.addEventListener('scroll', requestOrderSummaryPosition, { passive: true });
}

function validateCheckout() {
  clearFieldErrors();

  const requiredFields = [
    ['fullName', 'Full name is required.'],
    ['emailAddress', 'Email address is required.'],
    ['phoneNumber', 'Phone number is required.'],
    ['address', 'Address is required.'],
    ['postalCode', 'Postal code is required.'],
  ];

  let isValid = true;

  requiredFields.forEach(([fieldId, message]) => {
    if (!getFieldValue(fieldId)) {
      setFieldError(fieldId, message);
      isValid = false;
    }
  });

  const emailAddress = getFieldValue('emailAddress');
  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    setFieldError('emailAddress', 'Enter a valid email address.');
    isValid = false;
  }

  const phoneNumber = getFieldValue('phoneNumber');
  if (phoneNumber && !/^[0-9]+$/.test(phoneNumber)) {
    setFieldError('phoneNumber', 'Phone number must contain numbers only.');
    isValid = false;
  }

  const postalCode = getFieldValue('postalCode');
  if (postalCode && !/^[0-9]{6}$/.test(postalCode)) {
    setFieldError('postalCode', 'Postal code must be exactly 6 digits.');
    isValid = false;
  }

  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  if (!selectedDelivery) {
    setFieldError('delivery', 'Select a delivery method.');
    isValid = false;
  }

  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  if (!selectedPayment) {
    setFieldError('payment', 'Select a payment method.');
    isValid = false;
  }

  if (selectedPayment?.id === 'cardPayment') {
    const cardFields = [
      ['cardName', 'Name on card is required.'],
      ['cardNumber', 'Card number is required.'],
      ['expiryDate', 'Expiry date is required.'],
      ['cvv', 'CVV is required.'],
    ];

    cardFields.forEach(([fieldId, message]) => {
      if (!getFieldValue(fieldId)) {
        setFieldError(fieldId, message);
        isValid = false;
      }
    });

    const cardNumber = getFieldValue('cardNumber').replace(/\D/g, '');
    if (cardNumber && !/^[0-9]{16}$/.test(cardNumber)) {
      setFieldError('cardNumber', 'Card number must contain exactly 16 digits.');
      isValid = false;
    }

    const expiryDate = getFieldValue('expiryDate');
    if (expiryDate && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate)) {
      setFieldError('expiryDate', 'Expiry date must follow MM/YY format.');
      isValid = false;
    }

    const cvv = getFieldValue('cvv');
    if (cvv && !/^[0-9]{3}$/.test(cvv)) {
      setFieldError('cvv', 'CVV must be a 3-digit number.');
      isValid = false;
    }
  }

  if (cartItems.length === 0) {
    setFieldError('cart', 'Your cart is empty.');
    isValid = false;
  }

  return isValid;
}

async function handlePlaceOrder() {
  if (!localStorage.getItem('token')) {
    showToast('Please log in before checking out.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  renderOrderSummary();
  if (!validateCheckout()) return;

  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  const deliveryFee = Number(selectedDelivery.value);

  const orderData = {
    fullName: getFieldValue('fullName'),
    emailAddress: getFieldValue('emailAddress'),
    phoneNumber: getFieldValue('phoneNumber'),
    address: getFieldValue('address'),
    unitNumber: getFieldValue('unitNumber'),
    postalCode: getFieldValue('postalCode'),
    deliveryNotes: getFieldValue('deliveryNotes'),
    deliveryMethod: selectedDelivery.parentElement.textContent.trim(),
    paymentMethod: selectedPayment.parentElement.textContent.trim(),
    items: cartItems,
    subtotal,
    deliveryFee,
    gst,
    totalAmount: subtotal + gst + deliveryFee,
  };

  try {
    const response = await authFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    const data = await response.json();

    if (!response.ok) {
      setFieldError('cart', data.message || data.error || 'Failed to place order.');
      return;
    }

    localStorage.removeItem('checkoutCart');
    localStorage.removeItem('cart');
    localStorage.removeItem('cartItems');
    window.location.href = 'orders.html';
  } catch (error) {
    console.error(error);
    setFieldError('cart', 'Failed to place order.');
  }
}

function initCheckout() {
  renderOrderSummary();
  updateCardDetailsVisibility();
  watchOrderSummaryHeight();

  deliveryOptions.forEach((option) => {
    option.addEventListener('change', updateCheckoutTotals);
  });

  paymentOptions.forEach((option) => {
    option.addEventListener('change', updateCardDetailsVisibility);
  });

  ['cardName', 'cardNumber', 'expiryDate', 'cvv'].forEach((fieldId) => {
    document.getElementById(fieldId).addEventListener('input', () => {
      cardPaymentRadio.checked = true;
      updateCardDetailsVisibility();
    });
  });

  placeOrderButton.addEventListener('click', handlePlaceOrder);
}

window.updateCheckoutTotals = updateCheckoutTotals;
document.addEventListener('DOMContentLoaded', initCheckout);
