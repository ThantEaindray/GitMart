(function () {
  if (document.documentElement.getAttribute('data-motion') === 'reduced') return;
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  // ── Nav ──────────────────────────────────────────────────────────────────
  var nav = document.querySelector('.nav');
  if (nav) gsap.from(nav, { y: -56, opacity: 0, duration: 0.55, ease: 'power2.out' });

  // ── Hero (noir/home page) ─────────────────────────────────────────────────
  var heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    var heroTag = heroContent.querySelector('.hero-tag');
    var heroH1 = heroContent.querySelector('h1');
    var heroP = heroContent.querySelector('p');
    var heroBtns = heroContent.querySelectorAll('.btn-primary, .btn-outline');
    var heroImg = document.querySelector('.hero-img');
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    if (heroTag) tl.from(heroTag, { y: 16, opacity: 0, duration: 0.4 }, 0.25);
    if (heroH1) tl.from(heroH1, { y: 28, opacity: 0, duration: 0.6 }, 0.38);
    if (heroP) tl.from(heroP, { y: 18, opacity: 0, duration: 0.45 }, 0.56);
    if (heroBtns.length) tl.from(heroBtns, { y: 14, opacity: 0, duration: 0.4, stagger: 0.1 }, 0.7);
    if (heroImg) tl.from(heroImg, { x: 28, opacity: 0, duration: 0.65 }, 0.42);
  }

  // ── Auth pages (login / register) ─────────────────────────────────────────
  var authIntro = document.querySelector('.auth-intro');
  var authCard = document.querySelector('.auth-card');
  if (authIntro || authCard) {
    var authTl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    if (authIntro) authTl.from(authIntro, { x: -24, opacity: 0, duration: 0.55 }, 0.2);
    if (authCard) authTl.from(authCard, { y: 24, opacity: 0, duration: 0.5 }, 0.3);
  }

  // ── Settings heading ──────────────────────────────────────────────────────
  var settingsHeading = document.querySelector('.settings-heading');
  if (settingsHeading) {
    gsap.from([settingsHeading, document.querySelector('.settings-sub')].filter(Boolean), {
      y: 18, opacity: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', delay: 0.2,
    });
    gsap.utils.toArray('.tab-btn').forEach(function (btn, i) {
      gsap.from(btn, { y: 12, opacity: 0, duration: 0.35, ease: 'power2.out', delay: 0.35 + i * 0.06 });
    });
  }

  // ── Section headers (scroll-triggered) ───────────────────────────────────
  gsap.utils.toArray('.section-header').forEach(function (el) {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 88%' },
      y: 22, opacity: 0, duration: 0.48, ease: 'power2.out',
    });
  });

  // ── Static theme / settings cards ────────────────────────────────────────
  var themeCards = document.querySelectorAll('.theme-card');
  if (themeCards.length) {
    gsap.from(themeCards, {
      scrollTrigger: { trigger: themeCards[0], start: 'top 90%' },
      y: 16, opacity: 0, duration: 0.38, stagger: 0.07, ease: 'power2.out',
    });
  }

  // ── Profile / seller page sections ───────────────────────────────────────
  gsap.utils.toArray('.profile-header, .profile-details, .seller-profile').forEach(function (el) {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 88%' },
      y: 20, opacity: 0, duration: 0.5, ease: 'power2.out',
    });
  });

  // ── Dynamic card observer ─────────────────────────────────────────────────
  // Watches for cards injected by listings.js, noir.js, wishlist.js, orders.js,
  // reviews.js etc. and animates them as they appear.
  var CARD_CLASSES = new Set(['card', 'order-card', 'rv-card', 'sp-rv-card']);

  var mo = new MutationObserver(function (mutations) {
    var batch = [];
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        var cls = node.classList;
        if (CARD_CLASSES.has('card') && cls.contains('card')) batch.push(node);
        else if (cls.contains('order-card')) batch.push(node);
        else if (cls.contains('rv-card')) batch.push(node);
        else if (cls.contains('sp-rv-card')) batch.push(node);
      }
    }
    if (batch.length) {
      gsap.from(batch, { opacity: 0, y: 20, duration: 0.38, stagger: 0.07, ease: 'power2.out', clearProps: 'all' });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // ── Exposed helpers ───────────────────────────────────────────────────────
  window.gsapAnimations = {
    // Call after programmatically toggling a heart to give it a bounce
    heartBounce: function (el) {
      gsap.fromTo(
        el,
        { scale: 1 },
        { scale: 1.45, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1, onComplete: function () { gsap.set(el, { scale: 1 }); } },
      );
    },
    // Animate a NodeList or array of already-rendered cards (call after full re-render)
    fadeInCards: function (selector) {
      var els = document.querySelectorAll(selector);
      if (els.length) gsap.from(els, { opacity: 0, y: 20, duration: 0.38, stagger: 0.07, ease: 'power2.out' });
    },
  };
})();
