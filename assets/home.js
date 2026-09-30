/* =========================================================
   教学资料库 · 首页交互
   顶部导航 / 滚动进入 / 数字强调 / 鼠标光晕 / 回到顶部
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 1. 顶部导航吸顶 + 移动菜单 ---------- */
  var nav = $('#nav');
  var burger = $('#navBurger');

  function syncNav() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.pageYOffset > 24);
  }
  syncNav();

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('#navLinks a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 2. 滚动进入动画（含同组错峰） ---------- */
  var revealItems = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var groupSeen = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var parent = el.parentElement;
        var idx = groupSeen.get(parent) || 0;
        groupSeen.set(parent, idx + 1);
        el.style.transitionDelay = Math.min(idx, 5) * 90 + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealItems.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 3. 数字（数值恒为 HTML 真值，仅入场位移强调） ----------
     不做从 0 起步的计数：无论是否执行 JS、动画是否受限，首屏统计与数据带
     始终直接显示真实数值；滚动进入的动效只作用于位移，不改变数值本身。
     ------------------------------------------------------------------ */
  var nums = $$('.stat__num,.number__num');
  if (nums.length && !reduceMotion && 'IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-pop');
        nio.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { nio.observe(el); });
  }

  /* ---------- 4. 卡片鼠标光晕 ---------- */
  if (!reduceMotion && window.matchMedia && window.matchMedia('(hover:hover)').matches) {
    $$('.card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '0%');
      });
    });
  }

  /* ---------- 5. 滚动进度条 + 回到顶部 ---------- */
  var bar = $('#scrollBar');
  var toTop = $('#toTop');
  var ticking = false;

  function onScroll() {
    syncNav();
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(window.pageYOffset / max, 1) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (toTop) toTop.classList.toggle('is-on', window.pageYOffset > window.innerHeight * 0.8);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
})();
