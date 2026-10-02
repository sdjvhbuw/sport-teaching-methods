/* =========================================================
   教学资料库 · 首页特效增强层 2 (assets/home-fx2.js)
   纯叠加：不修改任何既有 DOM 结构、class 或 home.js / home-fx.js 的选择器
   - 卡片/特性块：注入霓虹描边流光 + 点阵光晕，跟随鼠标 --mx/--my
   - 标题字符：注入 --i 供 hover 逐个跳动使用
   - 点击涟漪、鼠标拖尾星点、页脚数据光束
   降级：prefers-reduced-motion 时全部不启用；禁用 JS 时本文件不执行，页面完整可读
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqFine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  var reduce = !!(mqReduce && mqReduce.matches);
  var fine = !!(mqFine && mqFine.matches);

  if (reduce) return;

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- 1. 卡片：霓虹描边流光 + 点阵光晕 ---------- */
  function cardLayers() {
    var cards = $$('.card,.feature,.note');
    cards.forEach(function (card) {
      var cs = window.getComputedStyle(card);
      if (cs.position === 'static') card.style.position = 'relative';
      if (card.style.overflow && card.style.overflow !== 'visible') card.style.overflow = 'visible';

      if (!card.querySelector(':scope > .fx2-rim')) {
        var rim = doc.createElement('i');
        rim.className = 'fx2-rim';
        rim.setAttribute('aria-hidden', 'true');
        card.appendChild(rim);
      }
      if (!card.querySelector(':scope > .fx2-mesh')) {
        var mesh = doc.createElement('i');
        mesh.className = 'fx2-mesh';
        mesh.setAttribute('aria-hidden', 'true');
        card.appendChild(mesh);
      }

      if (!fine) return;
      var raf = 0, lx = 0, ly = 0;
      card.addEventListener('pointermove', function (e) {
        lx = e.clientX; ly = e.clientY;
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = 0;
          var b = card.getBoundingClientRect();
          if (!b.width || !b.height) return;
          card.style.setProperty('--mx', ((lx - b.left) / b.width * 100).toFixed(1) + '%');
          card.style.setProperty('--my', ((ly - b.top) / b.height * 100).toFixed(1) + '%');
        });
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      }, { passive: true });
    });
  }

  /* ---------- 2. 标题字符序号（hover 逐个跳动） ---------- */
  function titleIndex() {
    $$('.hero__title .ch').forEach(function (ch, i) {
      ch.style.setProperty('--i', String(i));
    });
  }

  /* ---------- 3. 点击涟漪 ---------- */
  function ripples() {
    doc.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      [['fx2-ripple', 0], ['fx2-ripple fx2-ripple--violet', 0]].forEach(function (spec) {
        var el = doc.createElement('i');
        el.className = spec[0];
        el.setAttribute('aria-hidden', 'true');
        el.style.transform = '';
        el.style.left = e.clientX + 'px';
        el.style.top = e.clientY + 'px';
        doc.body.appendChild(el);
        window.setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1100);
      });
    }, { passive: true });
  }

  /* ---------- 4. 鼠标拖尾星点 ---------- */
  function trail() {
    if (!fine) return;
    var last = 0, alive = 0, MAX = 14;
    doc.addEventListener('pointermove', function (e) {
      var now = Date.now();
      if (now - last < 62 || alive >= MAX) return;
      last = now;
      var el = doc.createElement('i');
      el.className = 'fx2-trail';
      el.setAttribute('aria-hidden', 'true');
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
      doc.body.appendChild(el);
      alive++;
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        alive--;
      }, 820);
    }, { passive: true });
  }

  /* ---------- 5. 页脚数据光束 ---------- */
  function footerFX() {
    var foot = doc.querySelector('.foot');
    if (!foot) return;
    var cs = window.getComputedStyle(foot);
    if (cs.position === 'static') foot.style.position = 'relative';

    if (!foot.querySelector(':scope > .fx2-foot-beam')) {
      var beam = doc.createElement('i');
      beam.className = 'fx2-foot-beam';
      beam.setAttribute('aria-hidden', 'true');
      var line = doc.createElement('i');
      line.className = 'fx2-foot-glow';
      line.setAttribute('aria-hidden', 'true');
      beam.appendChild(line);
      foot.insertBefore(beam, foot.firstChild);
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      cardLayers();
      titleIndex();
      ripples();
      trail();
      footerFX();
    } catch (err) {
      /* 特效失败不得影响页面基本功能 */
      if (window.console && console.warn) console.warn('[home-fx2] disabled:', err);
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
