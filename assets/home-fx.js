/* =========================================================
   教学资料库 · 首页特效增强层  (assets/home-fx.js)
   纯叠加：不修改任何既有 DOM 结构、class 或 home.js 的选择器
   - 首屏 Canvas：星空 + 数据雨（限帧、离屏暂停、降级关闭）
   - 鼠标跟随光晕 + 首屏指针视差
   - 标题逐字入场（仅位移/模糊，不依赖透明度）
   - 导航 active 滑动指示条 + 滚动高亮
   - 区块标题逐段点亮（IO）
   - 卡片 3D 倾斜 + 霓虹扫光、按钮发光跟随、回到顶部环形进度
   - 数据带伪元素滚动视差、启动扫描条
   降级：prefers-reduced-motion 时全部不启用；禁用 JS 时本文件不执行，页面完整可读
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var docEl = doc.documentElement;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqFine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  var reduce = !!(mqReduce && mqReduce.matches);
  var fine = !!(mqFine && mqFine.matches);

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------------- 1. 启动扫描条 ---------------- */
  function bootSweep() {
    if (reduce) return;
    var el = doc.createElement('div');
    el.className = 'fx-boot';
    el.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1700);
  }

  /* ---------------- 2. 鼠标跟随光晕 ---------------- */
  function cursorGlow() {
    if (reduce || !fine) return;
    var layer = doc.createElement('div');
    layer.className = 'fx-cursor-layer';
    layer.setAttribute('aria-hidden', 'true');
    var dot = doc.createElement('span');
    dot.className = 'fx-cursor';
    layer.appendChild(dot);
    doc.body.appendChild(layer);

    var tx = window.innerWidth * 0.5, ty = window.innerHeight * 0.35;
    var cx = tx, cy = ty, raf = 0, on = false;

    function tick() {
      raf = 0;
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      dot.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) raf = requestAnimationFrame(tick);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(tick); }

    doc.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; layer.classList.add('is-on'); }
      wake();
    }, { passive: true });
    doc.addEventListener('mouseleave', function () {
      on = false; layer.classList.remove('is-on');
    }, { passive: true });
  }

  /* ---------------- 3. 首屏 Canvas：星空 + 数据雨 ---------------- */
  var FXCanvas = (function () {
    var hero, canvas, ctx, stars = [], rains = [], W = 0, H = 0, dpr = 1;
    var rafId = 0, last = 0, active = false, booted = false;

    function glyph() {
      var s = '0123456789ABCDEF';
      return s.charAt(Math.floor(Math.random() * s.length));
    }

    function seed() {
      var area = W * H;
      var n = clamp(Math.round(area / 15000), 26, 86);
      if (W < 760) n = Math.min(n, 38);
      stars = [];
      for (var i = 0; i < n; i++) {
        var violet = Math.random() < 0.34;
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.45 + 0.5,
          vx: (Math.random() - 0.5) * 0.07,
          vy: -(Math.random() * 0.13 + 0.03),
          a: Math.random() * 0.45 + 0.22,
          ph: Math.random() * 6.2832,
          c: violet ? '168,85,247' : '0,212,255'
        });
      }
      var cols = clamp(Math.round(W / (W < 760 ? 42 : 78)), W < 760 ? 6 : 9, W < 760 ? 12 : 20);
      var step = W < 760 ? 9 : 11;
      rains = [];
      for (var j = 0; j < cols; j++) {
        var len = 6 + Math.floor(Math.random() * 9);
        var chars = [];
        for (var k = 0; k < len; k++) chars.push(glyph());
        rains.push({
          x: (j + 0.5) * (W / cols) + (Math.random() - 0.5) * 12,
          y: Math.random() * H * 1.5 - H * 0.5,
          sp: 0.45 + Math.random() * 1.5,
          step: step,
          size: step - 1,
          chars: chars,
          c: Math.random() < 0.7 ? '0,212,255' : '168,85,247',
          a: 0.10 + Math.random() * 0.16
        });
      }
    }

    function resize() {
      if (!canvas || !hero) return;
      var r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      var i, s, tw;
      for (i = 0; i < stars.length; i++) {
        s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.y < -6) { s.y = H + 6; s.x = Math.random() * W; }
        if (s.x < -6) s.x = W + 6; else if (s.x > W + 6) s.x = -6;
        tw = 0.55 + 0.45 * Math.sin(t / 900 + s.ph);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + s.c + ',' + (s.a * tw).toFixed(3) + ')';
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }

      ctx.textBaseline = 'top';
      for (i = 0; i < rains.length; i++) {
        var r = rains[i];
        r.y += r.sp * 1.5;
        if (r.y - r.chars.length * r.step > H) r.y = -Math.random() * 260;
        ctx.font = r.size + 'px "Cascadia Code",Consolas,monospace';
        for (var k = 0; k < r.chars.length; k++) {
          var yy = r.y - k * r.step;
          if (yy < -14 || yy > H + 14) continue;
          var f = 1 - k / r.chars.length;
          ctx.fillStyle = 'rgba(' + r.c + ',' + (r.a * f).toFixed(3) + ')';
          ctx.fillText(r.chars[k], r.x, yy);
        }
        if (Math.random() < 0.055) {
          r.chars[Math.floor(Math.random() * r.chars.length)] = glyph();
        }
      }
    }

    function loop(t) {
      rafId = requestAnimationFrame(loop);
      if (!active || doc.hidden) return;
      if (t - last < 32) return;   /* ≈30fps 上限 */
      last = t;
      draw(t);
    }

    function start() {
      if (rafId) return;
      last = 0;
      rafId = requestAnimationFrame(loop);
    }

    function init() {
      if (reduce || !doc.createElement('canvas').getContext) return;
      hero = $('.hero');
      if (!hero) return;
      canvas = doc.createElement('canvas');
      canvas.className = 'hero__canvas';
      canvas.setAttribute('aria-hidden', 'true');
      hero.insertBefore(canvas, hero.firstChild);
      ctx = canvas.getContext('2d');
      if (!ctx) { hero.removeChild(canvas); canvas = null; return; }

      resize();
      booted = true;

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            active = e.isIntersecting;
            if (active) start();
          });
        }, { rootMargin: '80px' }).observe(hero);
      } else {
        active = true;
        start();
      }

      doc.addEventListener('visibilitychange', function () {
        if (!doc.hidden && active) start();
      });

      var rt = 0;
      window.addEventListener('resize', function () {
        if (rt) clearTimeout(rt);
        rt = window.setTimeout(function () { rt = 0; resize(); }, 200);
      }, { passive: true });
    }

    return { init: init, isBooted: function () { return booted; } };
  })();

  /* ---------------- 4. 标题逐字入场 ---------------- */
  function splitTitle() {
    if (reduce) return;
    var h1 = $('.hero__title');
    if (!h1 || h1.getAttribute('data-split') === '1') return;

    var full = (h1.textContent || '').replace(/\s+/g, ' ').trim();
    var frag = doc.createDocumentFragment();
    var idx = 0;

    function pushChars(target, text) {
      for (var k = 0; k < text.length; k++) {
        var c = text.charAt(k);
        if (c === ' ' || c === '\n' || c === '\t') {
          target.appendChild(doc.createTextNode(' '));
          continue;
        }
        var sp = doc.createElement('span');
        sp.className = 'ch';
        sp.textContent = c;
        sp.style.setProperty('--ci', idx++);
        target.appendChild(sp);
      }
    }

    Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        pushChars(frag, node.nodeValue || '');
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') { frag.appendChild(doc.createElement('br')); return; }
        var wrap = doc.createElement(node.tagName);
        wrap.className = (node.className ? node.className + ' ' : '') + 'ch-group';
        pushChars(wrap, node.textContent || '');
        frag.appendChild(wrap);
      }
    });

    if (!frag.childNodes.length) return;
    h1.setAttribute('data-split', '1');
    if (full) h1.setAttribute('aria-label', full);
    h1.classList.add('is-split');
    h1.textContent = '';
    h1.appendChild(frag);
  }

  /* ---------------- 5. 首屏指针视差 ---------------- */
  function heroParallax() {
    if (reduce || !fine) return;
    var hero = $('.hero');
    if (!hero) return;
    var inner = $('.hero__inner', hero);
    var particles = $('.hero__particles', hero);
    var lane = $('.hero__lane', hero);

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

    function tick() {
      raf = 0;
      cx += (tx - cx) * 0.10;
      cy += (ty - cy) * 0.10;
      if (inner) inner.style.transform = 'translate3d(' + (cx * 13).toFixed(2) + 'px,' + (cy * 9).toFixed(2) + 'px,0)';
      if (particles) particles.style.transform = 'translate3d(' + (cx * -26).toFixed(2) + 'px,' + (cy * -18).toFixed(2) + 'px,0)';
      if (lane) lane.style.transform = 'translate3d(' + (cx * 34).toFixed(2) + 'px,0,0)';
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(tick);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(tick); }

    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      ty = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
      wake();
    }, { passive: true });
    hero.addEventListener('mouseleave', function () {
      tx = 0; ty = 0; wake();
    }, { passive: true });
  }

  /* ---------------- 6. 导航 active 指示条 + 滚动高亮 ---------------- */
  function navSpy() {
    var navLinks = $('#navLinks');
    if (!navLinks) return;
    var links = $$('a', navLinks);
    if (!links.length) return;

    var ink = doc.createElement('span');
    ink.className = 'nav__ink';
    ink.setAttribute('aria-hidden', 'true');
    navLinks.appendChild(ink);

    var current = null;
    function place(link) {
      if (!link || !fine && window.innerWidth <= 860) { ink.classList.remove('is-on'); return; }
      ink.style.width = link.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + link.offsetLeft + 'px)';
      ink.style.bottom = '0px';
      ink.classList.add('is-on');
    }
    function setActive(hash) {
      var found = null;
      links.forEach(function (a) {
        var hit = a.getAttribute('href') === hash;
        a.classList.toggle('is-active', hit);
        if (hit) found = a;
      });
      if (found && found !== current) { current = found; place(found); }
    }

    var secs = [];
    links.forEach(function (a) {
      var h = a.getAttribute('href') || '';
      if (h.charAt(0) !== '#') return;
      var el = doc.getElementById(h.slice(1));
      if (el) secs.push(el);
    });

    if (secs.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) setActive('#' + e.target.id);
        });
      }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
      secs.forEach(function (s) { io.observe(s); });
    }

    window.addEventListener('resize', function () {
      if (current) place(current);
    }, { passive: true });
  }

  /* ---------------- 7. 区块标题逐段点亮 ---------------- */
  function sectionLit() {
    var heads = $$('.section-head');
    if (!heads.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      heads.forEach(function (h) { h.classList.add('is-lit'); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-lit');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.28, rootMargin: '0px 0px -8% 0px' });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---------------- 8. 卡片 3D 倾斜 + 霓虹扫光 ---------------- */
  function cardFX() {
    var cards = $$('.card');
    if (!cards.length) return;
    var tiltOK = !reduce && fine && window.innerWidth >= 900;

    cards.forEach(function (card) {
      var scan = doc.createElement('span');
      scan.className = 'card__scan';
      scan.setAttribute('aria-hidden', 'true');
      card.appendChild(scan);

      if (!tiltOK) return;
      card.classList.add('is-3d');
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
        var py = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1);
        var rx = (0.5 - py) * 6;
        var ry = (px - 0.5) * 7;
        card.style.transform = 'perspective(900px) translateY(-6px) rotateX(' +
          rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      }, { passive: true });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      }, { passive: true });
    });
  }

  /* ---------------- 9. 按钮发光跟随鼠标 ---------------- */
  function btnGlow() {
    if (reduce || !fine) return;
    $$('.btn, .nav__cta').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--bx', (((e.clientX - r.left) / Math.max(1, r.width)) * 100).toFixed(1) + '%');
        btn.style.setProperty('--by', (((e.clientY - r.top) / Math.max(1, r.height)) * 100).toFixed(1) + '%');
      }, { passive: true });
    });
  }

  /* ---------------- 10. 回到顶部环形进度 ---------------- */
  function toTopRing() {
    var t = $('#toTop');
    if (!t) return;
    var t0 = $('.totop__ring', t);
    if (t0) return;

    var NS = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'totop__ring');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');

    var defs = doc.createElementNS(NS, 'defs');
    var lg = doc.createElementNS(NS, 'linearGradient');
    lg.setAttribute('id', 'totopGrad');
    lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0');
    lg.setAttribute('x2', '1'); lg.setAttribute('y2', '1');
    [['0%', '#00D4FF'], ['55%', '#6366F1'], ['100%', '#A855F7']].forEach(function (s) {
      var st = doc.createElementNS(NS, 'stop');
      st.setAttribute('offset', s[0]);
      st.setAttribute('stop-color', s[1]);
      lg.appendChild(st);
    });
    defs.appendChild(lg);
    svg.appendChild(defs);

    function circle(cls) {
      var c = doc.createElementNS(NS, 'circle');
      c.setAttribute('cx', '24'); c.setAttribute('cy', '24'); c.setAttribute('r', '21.5');
      c.setAttribute('fill', 'none');
      c.setAttribute('class', cls);
      return c;
    }
    var bg = circle('totop__ring-bg');
    var fg = circle('totop__ring-fg');
    var len = 2 * Math.PI * 21.5;
    fg.style.strokeDasharray = len.toFixed(2);
    fg.style.strokeDashoffset = len.toFixed(2);
    svg.appendChild(bg);
    svg.appendChild(fg);
    t.insertBefore(svg, t.firstChild);

    FXCanvas_ring = { node: fg, len: len };
  }
  var FXCanvas_ring = null;

  /* ---------------- 11. 滚动联动（视差 / 环形进度） ---------------- */
  function scrollFX() {
    var band = $('.band');
    var raf = 0, maxScroll = 1;

    function measure() {
      maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);
    }
    function update() {
      raf = 0;
      var y = window.pageYOffset || docEl.scrollTop || 0;

      if (band) {
        var r = band.getBoundingClientRect();
        if (r.bottom > -240 && r.top < window.innerHeight + 240) {
          var rel = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
          band.style.setProperty('--py', ((rel - 0.5) * 120).toFixed(1) + 'px');
          band.style.setProperty('--py2', ((0.5 - rel) * 90).toFixed(1) + 'px');
        }
      }
      var ring = FXCanvas_ring;
      if (ring) {
        var p = clamp(y / maxScroll, 0, 1);
        ring.node.style.strokeDashoffset = (ring.len * (1 - p)).toFixed(2);
      }
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); onScroll(); }, { passive: true });
    window.addEventListener('load', function () { measure(); update(); });
    measure();
    update();
    window.setTimeout(function () { measure(); update(); }, 800);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    try {
      if (!reduce) docEl.classList.add('fx-on');
      splitTitle();
      bootSweep();
      cursorGlow();
      FXCanvas.init();
      heroParallax();
      navSpy();
      sectionLit();
      cardFX();
      btnGlow();
      toTopRing();
      scrollFX();
    } catch (err) {
      /* 特效失败不得影响页面基本功能 */
      if (window.console && console.warn) console.warn('[home-fx] disabled:', err);
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
