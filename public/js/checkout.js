/* global authFetch */

const GST_RATE = 0.09;
const CART_STORAGE_KEYS = ['cart', 'checkoutCart', 'cartItems'];

const placeOrderButton = document.getElementById('placeOrderButton');
const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
const paymentOptions = document.querySelectorAll('input[name="payment"]');
const cardDetails = document.querySelector('.card-details');
const cardPaymentRadio = document.getElementById('cardPayment');
const applePayRadio = document.getElementById('applePay');
const googlePayRadio = document.getElementById('googlePay');
const grabPayRadio = document.getElementById('grabPay');
const applePayModal = document.getElementById('applePayModal');
const applePayClose = document.getElementById('applePayClose');
const applePayCancel = document.getElementById('applePayCancel');
const applePayContinue = document.getElementById('applePayContinue');
const applePayStatus = document.getElementById('applePayStatus');
const applePayTotal = document.getElementById('applePayTotal');
const applePayDelivery = document.getElementById('applePayDelivery');
const applePaySupportNote = document.getElementById('applePaySupportNote');
const googlePayModal = document.getElementById('googlePayModal');
const googlePayClose = document.getElementById('googlePayClose');
const googlePayCancel = document.getElementById('googlePayCancel');
const googlePayContinue = document.getElementById('googlePayContinue');
const googlePayConfirm = document.getElementById('googlePayConfirm');
const googlePayStatus = document.getElementById('googlePayStatus');
const googlePayDetails = document.getElementById('googlePayDetails');
const googlePayTotal = document.getElementById('googlePayTotal');
const googlePayCardForm = document.getElementById('googlePayCardForm');
const googlePayCardName = document.getElementById('googlePayCardName');
const googlePayCardNumber = document.getElementById('googlePayCardNumber');
const googlePayExpiryDate = document.getElementById('googlePayExpiryDate');
const googlePayCvv = document.getElementById('googlePayCvv');
const googlePayCard = document.getElementById('googlePayCard');
const grabPayModal = document.getElementById('grabPayModal');
const grabPayClose = document.getElementById('grabPayClose');
const grabPayCancel = document.getElementById('grabPayCancel');
const grabPayContinue = document.getElementById('grabPayContinue');
const grabPayVerify = document.getElementById('grabPayVerify');
const grabPayResend = document.getElementById('grabPayResend');
const grabPayStatus = document.getElementById('grabPayStatus');
const grabPayTotal = document.getElementById('grabPayTotal');
const grabPayOtpPanel = document.getElementById('grabPayOtpPanel');
const grabPayOtpMessage = document.getElementById('grabPayOtpMessage');
const grabPayOtp = document.getElementById('grabPayOtp');
const orderItemsEl = document.getElementById('orderItems');
const subtotalPriceText = document.getElementById('subtotalPrice');
const deliveryFeeText = document.getElementById('deliveryFee');
const gstPriceText = document.getElementById('gstPrice');
const totalPriceText = document.getElementById('totalPrice');

let cartItems = [];
let subtotal = 0;
let gst = 0;
let cartStorageKey = 'cart';
let cartStorageContainer = null;
let summaryHeightObserver;
let summaryScrollFrame;
let pendingApplePayOrderData = null;
let applePayTimer = null;
let pendingGooglePayOrderData = null;
let googlePayTimer = null;
let pendingGrabPayOrderData = null;
let grabPayTimer = null;

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
  const isOneOff = Boolean(item.isOneOff || item.listingId || (item.title && !item.productId));
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
    productId: item.productId ?? (!isOneOff ? item.id : null),
    listingId: item.listingId ?? (isOneOff ? item.id : null),
    name: item.name ?? item.title ?? 'Cart item',
    price: Number.isFinite(price) ? price : 0,
    quantity: isOneOff ? 1 : Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    isOneOff,
  };
}

function readCartState() {
  for (const key of CART_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (Array.isArray(items)) {
        return {
          key,
          container: Array.isArray(parsed) ? null : parsed,
          rawItems: items,
          items: items.map(normalizeCartItem),
        };
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  return {
    key: 'cart',
    container: null,
    rawItems: [],
    items: [],
  };
}

function readCartItems() {
  const state = readCartState();
  cartStorageKey = state.key;
  cartStorageContainer = state.container;
  return state.items;
}

function writeCartItems(nextItems) {
  if (cartStorageContainer) {
    localStorage.setItem(
      cartStorageKey,
      JSON.stringify({
        ...cartStorageContainer,
        items: nextItems,
      }),
    );
    return;
  }

  localStorage.setItem(cartStorageKey, JSON.stringify(nextItems));
}

function updateCartQuantity(index, nextQuantity) {
  const state = readCartState();
  const nextItems = [...state.rawItems];
  const item = nextItems[index];
  if (!item) return;
  const normalizedItem = normalizeCartItem(item);

  if (nextQuantity <= 0) {
    nextItems.splice(index, 1);
  } else {
    nextItems[index] = {
      ...item,
      quantity: normalizedItem.isOneOff ? 1 : nextQuantity,
      isOneOff: item.isOneOff || normalizedItem.isOneOff,
    };
  }

  cartStorageKey = state.key;
  cartStorageContainer = state.container;
  writeCartItems(nextItems);
  renderOrderSummary();
}

function formatPhoneNumber(value) {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('65')) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 8);
  const firstBlock = digits.slice(0, 4);
  const secondBlock = digits.slice(4, 8);
  return ['+65', firstBlock, secondBlock].filter(Boolean).join(' ');
}

function formatUnitNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (!digits) return value.startsWith('#') ? '#' : '';

  const floor = digits.slice(0, 2);
  const unit = digits.slice(2, 6);
  return digits.length >= 2 ? `#${floor}-${unit}` : `#${floor}`;
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').substring(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiryDate(value) {
  let digits = value.replace(/\D/g, '').substring(0, 4);
  if (digits.length >= 2) digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function getCardBrand(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Card';
}

function clearGooglePayErrors() {
  ['googlePayCardName', 'googlePayCardNumber', 'googlePayExpiryDate', 'googlePayCvv'].forEach(
    (fieldId) => setFieldError(fieldId, ''),
  );
}

function validateGooglePayCardDetails() {
  clearGooglePayErrors();

  let isValid = true;
  const cardName = googlePayCardName?.value.trim() || '';
  const cardNumber = googlePayCardNumber?.value.replace(/\D/g, '') || '';
  const expiryDate = googlePayExpiryDate?.value.trim() || '';
  const cvv = googlePayCvv?.value.replace(/\D/g, '') || '';

  if (!cardName) {
    setFieldError('googlePayCardName', 'Name on card is required.');
    isValid = false;
  }

  if (!cardNumber) {
    setFieldError('googlePayCardNumber', 'Card number is required.');
    isValid = false;
  } else if (!/^[0-9]{16}$/.test(cardNumber)) {
    setFieldError('googlePayCardNumber', 'Card number must contain exactly 16 digits.');
    isValid = false;
  }

  if (!expiryDate) {
    setFieldError('googlePayExpiryDate', 'Expiry date is required.');
    isValid = false;
  } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate)) {
    setFieldError('googlePayExpiryDate', 'Expiry date must follow MM/YY format.');
    isValid = false;
  }

  if (!cvv) {
    setFieldError('googlePayCvv', 'CVV is required.');
    isValid = false;
  } else if (!/^[0-9]{3}$/.test(cvv)) {
    setFieldError('googlePayCvv', 'CVV must be a 3-digit number.');
    isValid = false;
  }

  return isValid;
}

function getSelectedDeliveryFee() {
  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  return selectedDelivery ? Number(selectedDelivery.value) : 0;
}

function isApplePaySupported() {
  return Boolean(
    window.ApplePaySession &&
    typeof window.ApplePaySession.canMakePayments === 'function' &&
    window.ApplePaySession.canMakePayments(),
  );
}

function renderOrderSummary() {
  cartItems = readCartItems();
  subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  gst = subtotal * GST_RATE;

  orderItemsEl.innerHTML = '';

  if (cartItems.length === 0) {
    orderItemsEl.innerHTML = '<p class="status-text">Your cart is empty.</p>';
  } else {
    cartItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'order-item';
      row.dataset.cartIndex = String(index);
      const quantityControls = item.isOneOff
        ? `
            <span class="order-item-qty">x1</span>
            <button type="button" class="order-remove-btn" data-cart-action="remove" aria-label="Remove ${item.name}">
              Remove
            </button>
          `
        : `
            <button type="button" class="order-qty-btn" data-cart-action="decrease" aria-label="Decrease ${item.name} quantity">
              <i class="bi bi-dash"></i>
            </button>
            <span class="order-item-qty">x${item.quantity}</span>
            <button type="button" class="order-qty-btn" data-cart-action="increase" aria-label="Increase ${item.name} quantity">
              <i class="bi bi-plus"></i>
            </button>
            <button type="button" class="order-remove-btn" data-cart-action="remove" aria-label="Remove ${item.name}">
              Remove
            </button>
          `;
      row.innerHTML = `
        <div class="order-item-info">
          <p class="order-item-name">${item.name}</p>
          <div class="order-item-controls" aria-label="${item.name} quantity controls">
            ${quantityControls}
          </div>
        </div>
        <p class="order-item-price">${formatMoney(item.price * item.quantity)}</p>
      `;
      orderItemsEl.appendChild(row);
    });
  }

  updateCheckoutTotals();
  placeOrderButton.disabled = cartItems.length === 0;
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
  if (phoneNumber && !/^\+65\s\d{4}\s\d{4}$/.test(phoneNumber)) {
    setFieldError('phoneNumber', 'Use this format: +65 9086 2744.');
    isValid = false;
  }

  const postalCode = getFieldValue('postalCode');
  if (postalCode && !/^[0-9]{6}$/.test(postalCode)) {
    setFieldError('postalCode', 'Postal code must be exactly 6 digits.');
    isValid = false;
  }

  const unitNumber = getFieldValue('unitNumber');
  if (!unitNumber.replace(/\D/g, '')) {
    setFieldError('unitNumber', 'Unit number is required.');
    isValid = false;
  } else if (!/^#\d{2}-\d{2,4}$/.test(unitNumber)) {
    setFieldError('unitNumber', 'Use this format: #12-345.');
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

function getCheckoutOrderData() {
  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  const deliveryFee = Number(selectedDelivery.value);

  return {
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
}

function getSelectedDeliveryDetails() {
  const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
  const deliveryOption = selectedDelivery?.closest('.delivery-option');

  return {
    name:
      deliveryOption?.querySelector('.delivery-name')?.textContent.trim() || 'Standard Delivery',
    eta:
      deliveryOption?.querySelector('.delivery-eta')?.textContent.replace(/\s+/g, ' ').trim() || '',
    price: deliveryOption?.querySelector('.delivery-price')?.textContent.trim() || 'FREE',
  };
}

function updateApplePayDeliveryDetails() {
  if (!applePayDelivery) return;

  const delivery = getSelectedDeliveryDetails();
  const deliveryName = document.createElement('span');
  const deliveryMeta = document.createElement('span');

  deliveryName.className = 'apple-pay-delivery-name';
  deliveryName.textContent = delivery.name;

  deliveryMeta.className = 'apple-pay-delivery-meta';
  deliveryMeta.textContent = [delivery.eta, delivery.price].filter(Boolean).join(' · ');

  applePayDelivery.replaceChildren(deliveryName, deliveryMeta);
}

function openApplePayModal(orderData) {
  pendingApplePayOrderData = orderData;
  clearTimeout(applePayTimer);

  if (applePayTotal) applePayTotal.textContent = formatMoney(orderData.totalAmount);
  updateApplePayDeliveryDetails();
  if (applePayStatus) applePayStatus.textContent = 'Ready to pay with Apple Pay.';
  if (applePayContinue) {
    applePayContinue.disabled = false;
    applePayContinue.textContent = 'Pay with Apple Pay';
  }
  if (applePaySupportNote) {
    applePaySupportNote.textContent = isApplePaySupported()
      ? 'Apple Pay is available on this browser or device.'
      : 'Apple Pay works best on Safari with a compatible Apple device. You may still simulate approval for this checkout demo, or choose Google Pay, GrabPay, or another method.';
  }

  applePayModal?.classList.add('visible');
  applePayModal?.setAttribute('aria-hidden', 'false');
}

function closeApplePayModal() {
  clearTimeout(applePayTimer);
  pendingApplePayOrderData = null;
  applePayModal?.classList.remove('visible');
  applePayModal?.setAttribute('aria-hidden', 'true');
}

function openGooglePayModal(orderData) {
  pendingGooglePayOrderData = orderData;
  clearTimeout(googlePayTimer);

  if (googlePayTotal) googlePayTotal.textContent = formatMoney(orderData.totalAmount);
  if (googlePayStatus) googlePayStatus.textContent = 'Ready for Google Pay.';
  if (googlePayContinue) {
    googlePayContinue.hidden = false;
    googlePayContinue.disabled = false;
  }
  if (googlePayConfirm) {
    googlePayConfirm.hidden = true;
    googlePayConfirm.disabled = false;
  }
  googlePayCardForm?.removeAttribute('hidden');
  googlePayDetails?.setAttribute('hidden', '');
  clearGooglePayErrors();

  googlePayModal?.classList.add('visible');
  googlePayModal?.setAttribute('aria-hidden', 'false');
}

function closeGooglePayModal() {
  clearTimeout(googlePayTimer);
  pendingGooglePayOrderData = null;
  googlePayModal?.classList.remove('visible');
  googlePayModal?.setAttribute('aria-hidden', 'true');
}

function openGrabPayModal(orderData) {
  pendingGrabPayOrderData = orderData;
  clearTimeout(grabPayTimer);

  if (grabPayTotal) grabPayTotal.textContent = formatMoney(orderData.totalAmount);
  if (grabPayStatus) grabPayStatus.textContent = 'Ready for GrabPay.';
  if (grabPayOtp) grabPayOtp.value = '';
  setFieldError('grabPayOtp', '');
  grabPayOtpPanel?.setAttribute('hidden', '');
  if (grabPayContinue) {
    grabPayContinue.hidden = false;
    grabPayContinue.disabled = false;
    grabPayContinue.textContent = 'Continue with GrabPay';
  }
  if (grabPayVerify) {
    grabPayVerify.hidden = true;
    grabPayVerify.disabled = false;
  }

  grabPayModal?.classList.add('visible');
  grabPayModal?.setAttribute('aria-hidden', 'false');
}

function closeGrabPayModal() {
  clearTimeout(grabPayTimer);
  pendingGrabPayOrderData = null;
  grabPayModal?.classList.remove('visible');
  grabPayModal?.setAttribute('aria-hidden', 'true');
}

async function submitOrder(orderData) {
  placeOrderButton.disabled = true;

  if (!localStorage.getItem('token')) {
    showToast('Please log in before checking out.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  try {
    const response = await authFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Failed to place order.';

      if (/phone/i.test(errorMessage)) {
        setFieldError('phoneNumber', errorMessage);
      } else if (/unit/i.test(errorMessage)) {
        setFieldError('unitNumber', errorMessage);
      } else if (/postal/i.test(errorMessage)) {
        setFieldError('postalCode', errorMessage);
      } else {
        setFieldError('cart', errorMessage);
      }

      return;
    }

    closeApplePayModal();
    closeGooglePayModal();
    closeGrabPayModal();
    localStorage.removeItem('purchasedItems');
    localStorage.removeItem('checkoutCart');
    localStorage.removeItem('cart');
    localStorage.removeItem('cartItems');
    window.location.href = 'orders.html';
  } catch (error) {
    console.error(error);
    setFieldError('cart', 'Failed to place order.');
  } finally {
    if (cartItems.length > 0) placeOrderButton.disabled = false;
  }
}

async function handleApplePayContinue() {
  if (!pendingApplePayOrderData || !applePayContinue || !applePayStatus) return;

  if (!localStorage.getItem('token')) {
    closeApplePayModal();
    showToast('Please log in before checking out.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  renderOrderSummary();
  if (!validateCheckout()) {
    closeApplePayModal();
    return;
  }

  pendingApplePayOrderData = getCheckoutOrderData();
  applePayContinue.disabled = true;
  applePayStatus.textContent = 'Checking Apple Pay availability...';

  applePayTimer = setTimeout(() => {
    applePayStatus.textContent = 'Waiting for Touch ID, Face ID, or Apple Watch approval...';

    applePayTimer = setTimeout(() => {
      applePayStatus.textContent = 'Apple Pay approved successfully.';

      applePayTimer = setTimeout(() => {
        submitOrder(pendingApplePayOrderData);
      }, 700);
    }, 1200);
  }, 700);
}

async function handleGooglePayContinue() {
  if (!pendingGooglePayOrderData || !googlePayContinue || !googlePayStatus) return;

  if (!localStorage.getItem('token')) {
    closeGooglePayModal();
    showToast('Please log in before checking out.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  renderOrderSummary();
  if (!validateCheckout()) {
    closeGooglePayModal();
    return;
  }

  if (!validateGooglePayCardDetails()) return;

  pendingGooglePayOrderData = getCheckoutOrderData();
  if (googlePayTotal) {
    googlePayTotal.textContent = formatMoney(pendingGooglePayOrderData.totalAmount);
  }
  if (googlePayCard && googlePayCardNumber) {
    const digits = googlePayCardNumber.value.replace(/\D/g, '');
    googlePayCard.textContent = `${getCardBrand(digits)} •••• ${digits.slice(-4)}`;
  }

  googlePayContinue.disabled = true;
  googlePayStatus.textContent = 'Opening Google Pay...';

  googlePayTimer = setTimeout(() => {
    googlePayCardForm?.setAttribute('hidden', '');
    googlePayDetails?.removeAttribute('hidden');
    googlePayContinue.hidden = true;
    if (googlePayConfirm) googlePayConfirm.hidden = false;
    googlePayStatus.textContent = 'Review payment details and confirm payment.';
  }, 900);
}

async function handleGooglePayConfirm() {
  if (!pendingGooglePayOrderData || !googlePayConfirm || !googlePayStatus) return;

  googlePayConfirm.disabled = true;
  googlePayStatus.textContent = 'Google Pay approved successfully.';

  googlePayTimer = setTimeout(() => {
    submitOrder(pendingGooglePayOrderData);
  }, 700);
}

async function handleGrabPayContinue() {
  if (!pendingGrabPayOrderData || !grabPayContinue || !grabPayStatus) return;

  if (!localStorage.getItem('token')) {
    closeGrabPayModal();
    showToast('Please log in before checking out.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
    return;
  }

  renderOrderSummary();
  if (!validateCheckout()) {
    closeGrabPayModal();
    return;
  }

  pendingGrabPayOrderData = getCheckoutOrderData();
  if (grabPayTotal) {
    grabPayTotal.textContent = formatMoney(pendingGrabPayOrderData.totalAmount);
  }

  grabPayContinue.disabled = true;
  grabPayStatus.textContent = 'Opening GrabPay...';

  grabPayTimer = setTimeout(() => {
    const phoneNumber = pendingGrabPayOrderData.phoneNumber || 'your phone number';
    if (grabPayOtpMessage) {
      grabPayOtpMessage.textContent = `Enter the 6-digit OTP sent to ${phoneNumber}.`;
    }
    grabPayOtpPanel?.removeAttribute('hidden');
    grabPayContinue.hidden = true;
    if (grabPayVerify) grabPayVerify.hidden = false;
    grabPayOtp?.focus();
    grabPayStatus.textContent = 'OTP sent. Enter the code to approve GrabPay.';
  }, 900);
}

async function handleGrabPayVerify() {
  if (!pendingGrabPayOrderData || !grabPayVerify || !grabPayStatus) return;

  // Demo GrabPay OTP for testing: 123456
  const otp = grabPayOtp?.value.trim() || '';
  if (otp !== '123456') {
    setFieldError('grabPayOtp', 'Invalid OTP. Please try again.');
    grabPayStatus.textContent = 'Invalid OTP. Please try again.';
    return;
  }

  setFieldError('grabPayOtp', '');
  grabPayVerify.disabled = true;
  grabPayStatus.textContent = 'Verifying GrabPay OTP...';

  grabPayTimer = setTimeout(() => {
    grabPayStatus.textContent = 'GrabPay approved successfully.';

    grabPayTimer = setTimeout(() => {
      submitOrder(pendingGrabPayOrderData);
    }, 700);
  }, 900);
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

  const orderData = getCheckoutOrderData();
  if (applePayRadio?.checked) {
    openApplePayModal(orderData);
    return;
  }

  if (googlePayRadio?.checked) {
    openGooglePayModal(orderData);
    return;
  }

  if (grabPayRadio?.checked) {
    openGrabPayModal(orderData);
    return;
  }

  await submitOrder(orderData);
}

function initCheckout() {
  renderOrderSummary();
  updateCardDetailsVisibility();
  watchOrderSummaryHeight();

  deliveryOptions.forEach((option) => {
    option.addEventListener('change', updateCheckoutTotals);
  });

  paymentOptions.forEach((option) => {
    option.addEventListener('change', () => {
      updateCardDetailsVisibility();
      if (option.id === 'applePay' && option.checked) {
        closeGooglePayModal();
        closeGrabPayModal();
        openApplePayModal(getCheckoutOrderData());
      } else if (option.id === 'googlePay' && option.checked) {
        closeApplePayModal();
        closeGrabPayModal();
        openGooglePayModal(getCheckoutOrderData());
      } else if (option.id === 'grabPay' && option.checked) {
        closeApplePayModal();
        closeGooglePayModal();
        openGrabPayModal(getCheckoutOrderData());
      } else {
        closeApplePayModal();
        closeGooglePayModal();
        closeGrabPayModal();
      }
    });
  });

  document.querySelector('[data-payment="applePay"]')?.addEventListener('click', () => {
    setTimeout(() => {
      if (applePayRadio?.checked) openApplePayModal(getCheckoutOrderData());
    }, 0);
  });

  document.querySelector('[data-payment="googlePay"]')?.addEventListener('click', () => {
    setTimeout(() => {
      if (googlePayRadio?.checked) openGooglePayModal(getCheckoutOrderData());
    }, 0);
  });

  document.querySelector('[data-payment="grabPay"]')?.addEventListener('click', () => {
    setTimeout(() => {
      if (grabPayRadio?.checked) openGrabPayModal(getCheckoutOrderData());
    }, 0);
  });

  ['cardName', 'cardNumber', 'expiryDate', 'cvv'].forEach((fieldId) => {
    document.getElementById(fieldId).addEventListener('input', () => {
      cardPaymentRadio.checked = true;
      updateCardDetailsVisibility();
    });
  });

  placeOrderButton.addEventListener('click', handlePlaceOrder);
  applePayContinue?.addEventListener('click', handleApplePayContinue);
  applePayClose?.addEventListener('click', closeApplePayModal);
  applePayCancel?.addEventListener('click', closeApplePayModal);
  applePayModal?.addEventListener('click', (event) => {
    if (event.target === applePayModal) closeApplePayModal();
  });
  googlePayContinue?.addEventListener('click', handleGooglePayContinue);
  googlePayConfirm?.addEventListener('click', handleGooglePayConfirm);
  googlePayClose?.addEventListener('click', closeGooglePayModal);
  googlePayCancel?.addEventListener('click', closeGooglePayModal);
  googlePayModal?.addEventListener('click', (event) => {
    if (event.target === googlePayModal) closeGooglePayModal();
  });
  grabPayContinue?.addEventListener('click', handleGrabPayContinue);
  grabPayVerify?.addEventListener('click', handleGrabPayVerify);
  grabPayClose?.addEventListener('click', closeGrabPayModal);
  grabPayCancel?.addEventListener('click', closeGrabPayModal);
  grabPayModal?.addEventListener('click', (event) => {
    if (event.target === grabPayModal) closeGrabPayModal();
  });
  grabPayOtp?.addEventListener('input', () => {
    grabPayOtp.value = grabPayOtp.value.replace(/\D/g, '').substring(0, 6);
    setFieldError('grabPayOtp', '');
  });
  grabPayResend?.addEventListener('click', () => {
    if (grabPayOtp) grabPayOtp.value = '';
    setFieldError('grabPayOtp', '');
    if (grabPayStatus) grabPayStatus.textContent = 'OTP resent. Enter the code to approve GrabPay.';
    showToast('OTP resend successfully.');
    grabPayOtp?.focus();
  });
  grabPayOtp?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleGrabPayVerify();
    }
  });
  googlePayCardNumber?.addEventListener('input', () => {
    googlePayCardNumber.value = formatCardNumber(googlePayCardNumber.value);
    setFieldError('googlePayCardNumber', '');
  });
  googlePayExpiryDate?.addEventListener('input', () => {
    googlePayExpiryDate.value = formatExpiryDate(googlePayExpiryDate.value);
    setFieldError('googlePayExpiryDate', '');
  });
  googlePayCvv?.addEventListener('input', () => {
    googlePayCvv.value = googlePayCvv.value.replace(/\D/g, '').substring(0, 3);
    setFieldError('googlePayCvv', '');
  });
  googlePayCardName?.addEventListener('input', () => {
    setFieldError('googlePayCardName', '');
  });

  orderItemsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;

    const row = button.closest('.order-item');
    const index = Number(row?.dataset.cartIndex);
    const item = cartItems[index];
    if (!item) return;

    if (button.dataset.cartAction === 'increase') {
      updateCartQuantity(index, item.quantity + 1);
    }

    if (button.dataset.cartAction === 'decrease') {
      updateCartQuantity(index, item.quantity - 1);
    }

    if (button.dataset.cartAction === 'remove') {
      updateCartQuantity(index, 0);
    }
  });

  const phoneInput = document.getElementById('phoneNumber');
  phoneInput?.addEventListener('input', () => {
    phoneInput.value = formatPhoneNumber(phoneInput.value);
    setFieldError('phoneNumber', '');
  });

  const unitInput = document.getElementById('unitNumber');
  unitInput?.addEventListener('focus', () => {
    if (!unitInput.value) unitInput.value = '#';
  });
  unitInput?.addEventListener('input', () => {
    unitInput.value = formatUnitNumber(unitInput.value);
    setFieldError('unitNumber', '');
  });
}

window.updateCheckoutTotals = updateCheckoutTotals;
document.addEventListener('DOMContentLoaded', initCheckout);
