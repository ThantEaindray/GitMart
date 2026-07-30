// gsap-animations.js
// All GSAP animation setup for GitMart — runs on every page.

// ── Guards ────────────────────────────────────────────────────────────────

function isMotionReduced() {
  return document.documentElement.getAttribute('data-motion') === 'reduced';
}

// ── Scroll progress bar ───────────────────────────────────────────────────

let scrollProgressBar;

function onScrollUpdate(self) {
  gsap.set(scrollProgressBar, { scaleX: self.progress });
}

function initScrollProgress() {
  scrollProgressBar = document.createElement('div');
  scrollProgressBar.className = 'scroll-progress';
  document.body.prepend(scrollProgressBar);
  ScrollTrigger.create({ start: 0, end: 'max', scrub: true, onUpdate: onScrollUpdate });
}

// ── Nav slide-down ────────────────────────────────────────────────────────

function initNav() {
  const nav = document.querySelector('.nav');
  if (nav) gsap.from(nav, { y: -56, opacity: 0, duration: 0.55, ease: 'power2.out' });
}

// ── Hero ──────────────────────────────────────────────────────────────────

function initHero() {
  const heroContent = document.querySelector('.hero-content');
  if (!heroContent) return;

  const heroTag = heroContent.querySelector('.hero-tag');
  const heroH1 = heroContent.querySelector('h1');
  const heroP = heroContent.querySelector('p');
  const heroBtns = heroContent.querySelectorAll('.btn-primary, .btn-outline');
  const heroImg = document.querySelector('.hero-img');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  if (heroTag) tl.from(heroTag, { y: 16, opacity: 0, duration: 0.4 }, 0.25);
  if (heroH1) tl.from(heroH1, { y: 28, opacity: 0, duration: 0.6 }, 0.38);
  if (heroP) tl.from(heroP, { y: 18, opacity: 0, duration: 0.45 }, 0.56);
  if (heroBtns.length) tl.from(heroBtns, { y: 14, opacity: 0, duration: 0.4, stagger: 0.1 }, 0.7);
  if (heroImg) tl.from(heroImg, { x: 28, opacity: 0, duration: 0.65 }, 0.42);
}

// ── Auth pages ────────────────────────────────────────────────────────────

function initAuth() {
  const authIntro = document.querySelector('.auth-intro');
  const authCard = document.querySelector('.auth-card');
  if (!authIntro && !authCard) return;

  const authTl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  if (authIntro) authTl.from(authIntro, { x: -24, opacity: 0, duration: 0.55 }, 0.2);
  if (authCard) authTl.from(authCard, { y: 24, opacity: 0, duration: 0.5 }, 0.3);
}

// ── Settings ──────────────────────────────────────────────────────────────

function animateTabBtn(btn, i) {
  gsap.from(btn, { y: 12, opacity: 0, duration: 0.35, ease: 'power2.out', delay: 0.35 + i * 0.06 });
}

function initSettings() {
  const settingsHeading = document.querySelector('.settings-heading');
  if (!settingsHeading) return;

  const targets = [settingsHeading, document.querySelector('.settings-sub')].filter(Boolean);
  gsap.from(targets, {
    y: 18,
    opacity: 0,
    duration: 0.45,
    stagger: 0.08,
    ease: 'power2.out',
    delay: 0.2,
  });
  gsap.utils.toArray('.tab-btn').forEach(animateTabBtn);
}

// ── Section headers (scroll-triggered) ───────────────────────────────────

function animateSectionHeader(el) {
  gsap.from(el, {
    scrollTrigger: { trigger: el, start: 'top 88%' },
    y: 22,
    opacity: 0,
    duration: 0.48,
    ease: 'power2.out',
  });
}

function initSectionHeaders() {
  gsap.utils.toArray('.section-header').forEach(animateSectionHeader);
}

// ── Theme / settings cards ────────────────────────────────────────────────

function initThemeCards() {
  const themeCards = document.querySelectorAll('.theme-card');
  if (!themeCards.length) return;
  gsap.from(themeCards, {
    scrollTrigger: { trigger: themeCards[0], start: 'top 90%' },
    y: 16,
    opacity: 0,
    duration: 0.38,
    stagger: 0.07,
    ease: 'power2.out',
  });
}

// ── Profile / seller sections ─────────────────────────────────────────────

function animateProfileSection(el) {
  gsap.from(el, {
    scrollTrigger: { trigger: el, start: 'top 88%' },
    y: 20,
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out',
  });
}

function initProfileSections() {
  gsap.utils
    .toArray('.profile-header, .profile-details, .seller-profile')
    .forEach(animateProfileSection);
}

// ── Dynamic card observer ─────────────────────────────────────────────────
// Watches for cards injected by page JS (noir.js, listings.js, etc.)
// and animates + attaches hover effects as they appear.

function isTrackedCard(node) {
  if (node.nodeType !== 1) return false;
  const cls = node.classList;
  return (
    cls.contains('card') ||
    cls.contains('order-card') ||
    cls.contains('rv-card') ||
    cls.contains('sp-rv-card')
  );
}

function onCardsAdded(mutations) {
  const batch = [];
  for (let i = 0; i < mutations.length; i++) {
    const added = mutations[i].addedNodes;
    for (let j = 0; j < added.length; j++) {
      if (isTrackedCard(added[j])) batch.push(added[j]);
    }
  }
  if (!batch.length) return;
  gsap.from(batch, {
    opacity: 0,
    y: 20,
    duration: 0.38,
    stagger: 0.07,
    ease: 'power2.out',
    clearProps: 'all',
  });
  batch.forEach(attachCardHover);
}

function initCardObserver() {
  const mo = new MutationObserver(onCardsAdded);
  mo.observe(document.body, { childList: true, subtree: true });
}

// ── Skeleton loaders ──────────────────────────────────────────────────────
// Uses MutationObserver so skeletons appear AFTER page JS clears the container
// (e.g. noir.js does grid.innerHTML = '' synchronously on startup).

function isLoadingState(el) {
  if (!el || el.children.length === 0) return true;
  for (let i = 0; i < el.children.length; i++) {
    const cls = el.children[i].className || '';
    if (
      cls.indexOf('status-text') < 0 &&
      cls.indexOf('orders-status') < 0 &&
      el.children[i].tagName.toLowerCase() !== 'p'
    )
      return false;
  }
  return true;
}

function makeCardSkeleton() {
  const sk = document.createElement('div');
  sk.className = 'sk-card';
  sk.innerHTML =
    '<div class="sk-img"></div>' +
    '<div class="sk-body">' +
    '<div class="sk-line" style="width:72%"></div>' +
    '<div class="sk-line sk-line-sm" style="width:44%"></div>' +
    '</div>';
  return sk;
}

function makeOrderSkeleton() {
  const sk = document.createElement('div');
  sk.className = 'sk-order';
  sk.innerHTML =
    '<div class="sk-line" style="width:55%"></div>' +
    '<div class="sk-line sk-line-sm" style="width:38%"></div>' +
    '<div class="sk-line sk-line-sm" style="width:28%"></div>';
  return sk;
}

function fillWithSkeletons(el, count, makeFn) {
  el.innerHTML = '';
  for (let i = 0; i < count; i++) el.appendChild(makeFn());
}

// Factory that creates a MutationObserver for a single container.
// Inner named functions share state via the enclosing scope.
function makeSkeletonWatcher(el, count, makeFn) {
  if (!el) return;
  let busy = false;
  let watcher;

  function onContainerChange() {
    if (busy) return;
    if (isLoadingState(el)) {
      busy = true;
      fillWithSkeletons(el, count, makeFn);
      busy = false;
    } else {
      watcher.disconnect();
    }
  }

  watcher = new MutationObserver(onContainerChange);
  watcher.observe(el, { childList: true });
}

function initSkeletonLoaders() {
  makeSkeletonWatcher(document.getElementById('products-grid'), 8, makeCardSkeleton);
  makeSkeletonWatcher(document.getElementById('listingsGrid'), 8, makeCardSkeleton);
  makeSkeletonWatcher(document.getElementById('wishlistGrid'), 6, makeCardSkeleton);
  makeSkeletonWatcher(document.getElementById('ordersList'), 4, makeOrderSkeleton);
}

// ── Hamburger nav ─────────────────────────────────────────────────────────

let hamburger = null;
let navMenu = null;
let menuOpen = false;

function isMobile() {
  return window.innerWidth <= 768;
}

function syncMenuState() {
  if (isMobile()) {
    gsap.set(navMenu, { height: 0, overflow: 'hidden' });
    menuOpen = false;
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
  } else {
    gsap.set(navMenu, { clearProps: 'height,overflow' });
  }
}

function onHamburgerClick() {
  if (!isMobile()) return;
  menuOpen = !menuOpen;
  hamburger.classList.toggle('active', menuOpen);
  hamburger.setAttribute('aria-expanded', String(menuOpen));
  if (menuOpen) {
    gsap.to(navMenu, { height: 'auto', duration: 0.35, ease: 'power2.out' });
  } else {
    gsap.to(navMenu, { height: 0, duration: 0.25, ease: 'power2.in' });
  }
}

function onNavLinkClick() {
  if (!isMobile() || !menuOpen) return;
  menuOpen = false;
  hamburger.classList.remove('active');
  hamburger.setAttribute('aria-expanded', 'false');
  gsap.to(navMenu, { height: 0, duration: 0.2, ease: 'power2.in' });
}

function attachNavLinkClose(link) {
  link.addEventListener('click', onNavLinkClick);
}

function initHamburger() {
  hamburger = document.querySelector('.nav-hamburger');
  navMenu = document.querySelector('.nav-collapse');
  if (!hamburger || !navMenu) return;

  syncMenuState();
  window.addEventListener('resize', syncMenuState);
  hamburger.addEventListener('click', onHamburgerClick);
  navMenu.querySelectorAll('a').forEach(attachNavLinkClose);
}

// ── Card hover: lift + 3D tilt ────────────────────────────────────────────

// Event handlers use `this` which refers to the card element at call time.
function onCardMouseEnter() {
  gsap.set(this, { transformPerspective: 700 });
  gsap.to(this, { y: -5, duration: 0.25, ease: 'power2.out' });
}

function onCardMouseMove(e) {
  const rect = this.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  gsap.to(this, {
    rotateY: x * 14,
    rotateX: -y * 10,
    duration: 0.25,
    ease: 'power2.out',
    overwrite: 'auto',
  });
}

function onCardMouseLeave() {
  gsap.to(this, { y: 0, rotateX: 0, rotateY: 0, duration: 0.45, ease: 'power2.out' });
}

function attachCardHover(card) {
  if (card._hoverAttached) return;
  card._hoverAttached = true;
  card.addEventListener('mouseenter', onCardMouseEnter);
  card.addEventListener('mousemove', onCardMouseMove);
  card.addEventListener('mouseleave', onCardMouseLeave);
}

function attachAllCardHovers() {
  document.querySelectorAll('.card, .order-card, .rv-card, .sp-rv-card').forEach(attachCardHover);
}

// ── Button press: scale feedback + click ripple ───────────────────────────

// Factory returns a named handler bound to the pressed button.
function makeScaleUpHandler(btn) {
  function onMouseUp() {
    gsap.to(btn, { scale: 1, duration: 0.22, ease: 'back.out(2)' });
    document.removeEventListener('mouseup', onMouseUp);
  }
  return onMouseUp;
}

function onButtonMouseDown(e) {
  const btn = e.target.closest('.btn-primary, .btn-outline, .icon-btn');
  if (!btn) return;
  gsap.to(btn, { scale: 0.93, duration: 0.1, ease: 'power2.in' });
  document.addEventListener('mouseup', makeScaleUpHandler(btn));
}

// Factory returns a named onComplete bound to the navigation href (if any).
function makeRippleComplete(href) {
  function onRippleComplete() {
    // `this` in a GSAP onComplete is the tween; .targets()[0] is the ripple element.
    this.targets()[0].remove();
    if (href) window.location.href = href;
  }
  return onRippleComplete;
}

function onButtonClick(e) {
  const btn = e.target.closest('.btn-primary, .btn-outline');
  if (!btn) return;

  const href = btn.tagName.toLowerCase() === 'a' ? btn.getAttribute('href') : null;
  const isNav = href && href !== '#' && !href.startsWith('javascript');
  if (isNav) e.preventDefault();

  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.left = e.clientX - rect.left + 'px';
  ripple.style.top = e.clientY - rect.top + 'px';
  ripple.style.background = btn.classList.contains('btn-outline')
    ? 'var(--accent)'
    : 'rgba(255,255,255,0.9)';
  btn.appendChild(ripple);

  gsap.fromTo(
    ripple,
    { scale: 0, opacity: 0.6 },
    {
      scale: 40,
      opacity: 0,
      duration: isNav ? 0.32 : 0.55,
      ease: 'power1.out',
      onComplete: makeRippleComplete(isNav ? href : null),
    },
  );
}

function attachIconBtnHover(btn) {
  btn.addEventListener('mouseenter', function () {
    gsap.to(this, { scale: 1.14, duration: 0.18, ease: 'power2.out' });
  });
  btn.addEventListener('mouseleave', function () {
    gsap.to(this, { scale: 1, duration: 0.2, ease: 'power2.out' });
  });
}

function initButtonInteractions() {
  document.addEventListener('mousedown', onButtonMouseDown);
  document.addEventListener('click', onButtonClick);
  document.querySelectorAll('.icon-btn').forEach(attachIconBtnHover);
}

// ── Dashboard / orders counter animation ─────────────────────────────────

const STAT_IDS = [
  'stat-total',
  'stat-active',
  'stat-sold',
  'stat-avg',
  'stat-views',
  'ordersCount',
  'ordersPending',
  'ordersSpend',
];

// Factory creates a self-contained observer + animation for one stat element.
function makeStatCounter(el) {
  let animated = false;
  let statObserver;
  let originalText, prefix, suffix, isDecimal;
  const counter = { val: 0 };

  function onStatUpdate() {
    el.textContent =
      prefix + (isDecimal ? counter.val.toFixed(2) : Math.round(counter.val)) + suffix;
  }

  function onStatComplete() {
    el.textContent = originalText;
  }

  function onStatChange() {
    if (animated) return;
    originalText = el.textContent.trim();
    const num = parseFloat(originalText.replace(/[^0-9.]/g, ''));
    if (!num || num <= 0) return;
    animated = true;
    statObserver.disconnect();
    isDecimal = originalText.indexOf('.') > -1;
    prefix = originalText.match(/^[^\d]*/)[0];
    suffix = originalText.match(/[^\d.]*$/)[0];
    counter.val = 0;
    gsap.to(counter, {
      val: num,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: onStatUpdate,
      onComplete: onStatComplete,
    });
  }

  statObserver = new MutationObserver(onStatChange);
  statObserver.observe(el, { childList: true, characterData: true, subtree: true });
}

function watchStatElement(id) {
  const el = document.getElementById(id);
  if (el) makeStatCounter(el);
}

function initCounterAnimation() {
  STAT_IDS.forEach(watchStatElement);
}

// ── Nav sliding underline indicator ──────────────────────────────────────

let navIndicator = null;
let navLinksEl = null;

function onNavLinkMouseEnter() {
  if (window.innerWidth <= 768) return;
  const navRect = navLinksEl.getBoundingClientRect();
  const linkRect = this.getBoundingClientRect();
  gsap.to(navIndicator, {
    left: linkRect.left - navRect.left,
    width: linkRect.width,
    opacity: 1,
    duration: 0.25,
    ease: 'power2.out',
  });
}

function onNavLinksMouseLeave() {
  gsap.to(navIndicator, { opacity: 0, duration: 0.2 });
}

function attachNavLinkIndicator(link) {
  link.addEventListener('mouseenter', onNavLinkMouseEnter);
}

function initNavIndicator() {
  navLinksEl = document.querySelector('.nav-links');
  if (!navLinksEl) return;
  navIndicator = document.createElement('div');
  navIndicator.className = 'nav-indicator';
  navLinksEl.style.position = 'relative';
  navLinksEl.appendChild(navIndicator);
  navLinksEl.querySelectorAll('a').forEach(attachNavLinkIndicator);
  navLinksEl.addEventListener('mouseleave', onNavLinksMouseLeave);
}

// ── Exposed helpers ───────────────────────────────────────────────────────

function onHeartBounceComplete() {
  // `this` is the GSAP tween; restore exact scale on the animated element.
  gsap.set(this.targets()[0], { scale: 1 });
}

function heartBounce(el) {
  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.45,
      duration: 0.14,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: onHeartBounceComplete,
    },
  );
}

function fadeInCards(selector) {
  const els = document.querySelectorAll(selector);
  if (els.length)
    gsap.from(els, { opacity: 0, y: 20, duration: 0.38, stagger: 0.07, ease: 'power2.out' });
}

function exposeHelpers() {
  window.gsapAnimations = { heartBounce, fadeInCards };
}

// ── Boot ──────────────────────────────────────────────────────────────────

function initAnimations() {
  if (isMotionReduced() || typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  initScrollProgress();
  initNav();
  initHero();
  initAuth();
  initSettings();
  initSectionHeaders();
  initThemeCards();
  initProfileSections();
  initCardObserver();
  initSkeletonLoaders();
  initHamburger();
  attachAllCardHovers();
  initButtonInteractions();
  initCounterAnimation();
  initNavIndicator();
  exposeHelpers();
}

initAnimations();
