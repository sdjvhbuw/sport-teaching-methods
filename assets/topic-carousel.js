/* =========================================================
   教学资料库 · 首页专题轮播（assets/topic-carousel.js）
   ---------------------------------------------------------
   能力：自动轮播 / 左右手动切换 / 圆点指示器 / 触摸滑动 /
         方向键切换 / 悬停·聚焦·切后台·离开视口自动暂停
   原则：
   - 严格渐进增强：本文件不执行时，.cards 保持原双列网格；
     仅做「追加控制条 + 给既有节点加属性」，不改卡片内部结构与文案
   - prefers-reduced-motion 时不启动自动轮播，仅保留手动切换
   - 不触碰 sport-data.js / hire-data.js，不改变 sport.html / hire.html 跳转
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.getElementById('topicCarousel');
  if (!root) return;

  var track = root.querySelector('[data-carousel-track]');
  if (!track) return;

  var slides = Array.prototype.slice.call(track.querySelectorAll('[data-carousel-slide]'));
  if (slides.length < 2) return;

  var prevBtn = root.querySelector('[data-carousel-prev]');
  var nextBtn = root.querySelector('[data-carousel-next]');
  var dotsBox = root.querySelector('[data-carousel-dots]');
  var bar = root.querySelector('[data-carousel-bar]');

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var INTERVAL = 6400;

  var index = 0;
  var timer = 0;
  var hoverPause = false;
  var focusPause = false;
  var dragging = false;
  var dragStartX = 0;
  var dragDx = 0;
  var swallowingClick = false;
  var inView = true;

  /* ---------------- 圆点指示器 ---------------- */
  var dots = [];
  if (dotsBox) {
    slides.forEach(function (slide, i) {
      var titleEl = slide.querySelector('.card__title');
      var name = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : ('专题 ' + (i + 1));
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'topic-carousel__dot';
      btn.setAttribute('aria-label', '切换到第 ' + (i + 1) + ' 个专题：' + name);
      btn.addEventListener('click', function () { goTo(i, true); });
      dotsBox.appendChild(btn);
      dots.push(btn);
    });
  }

  /* ---------------- 应用状态 ---------------- */
  function apply(animate) {
    if (!animate) {
      track.style.transition = 'none';
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
      void track.offsetWidth;
      track.style.transition = '';
    } else {
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
    }
    slides.forEach(function (slide, i) {
      if (i === index) {
        slide.removeAttribute('aria-hidden');
        slide.removeAttribute('tabindex');
      } else {
        slide.setAttribute('aria-hidden', 'true');
        slide.setAttribute('tabindex', '-1');
      }
    });
    dots.forEach(function (dot, i) {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function restartBar() {
    if (!bar || reduce) return;
    root.style.setProperty('--dur', (INTERVAL / 1000) + 's');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
  }

  function goTo(i, user) {
    var n = slides.length;
    index = ((i % n) + n) % n;
    apply(true);
    restartBar();
    if (user) syncTimer(true);
  }

  function next(user) { goTo(index + 1, user); }
  function prev(user) { goTo(index - 1, user); }

  /* ---------------- 自动轮播调度 ---------------- */
  function shouldPause() {
    return reduce || hoverPause || focusPause || dragging || doc.hidden || !inView;
  }

  function stopTimer() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
  }

  function syncTimer(forceRestart) {
    var paused = shouldPause();
    root.classList.toggle('is-paused', paused);
    if (paused) { stopTimer(); return; }
    if (timer && !forceRestart) return;
    stopTimer();
    timer = window.setInterval(next, INTERVAL);
  }

  /* ---------------- 控制条交互 ---------------- */
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(true); });
  if (nextBtn) nextBtn.addEventListener('click', function () { next(true); });

  if (!reduce) {
    root.addEventListener('pointerenter', function () { hoverPause = true; syncTimer(); });
    root.addEventListener('pointerleave', function () { hoverPause = false; syncTimer(); });
  }
  /* 键盘聚焦时暂停自动轮播；但鼠标点击按钮也会让按钮获得焦点，
     这种情况不应暂停，否则点一次箭头后自动轮播就再也不走了 */
  var lastPointer = false;
  root.addEventListener('pointerdown', function () { lastPointer = true; }, true);
  root.addEventListener('keydown', function () { lastPointer = false; }, true);
  root.addEventListener('focusin', function () {
    if (lastPointer) return;
    focusPause = true;
    syncTimer();
  });
  root.addEventListener('focusout', function (e) {
    if (e.relatedTarget && root.contains(e.relatedTarget)) return;
    focusPause = false;
    syncTimer();
  });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { prev(true); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { next(true); e.preventDefault(); }
  });

  doc.addEventListener('visibilitychange', function () { syncTimer(); });

  /* 离开视口即停止计时，避免无谓开销 */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        inView = entry.isIntersecting;
        syncTimer();
      });
    }, { threshold: 0.2 });
    io.observe(root);
  }

  /* ---------------- 触摸滑动（触摸/触控笔，鼠标不启用以免与链接拖拽冲突） ---------------- */
  track.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    dragging = true;
    dragStartX = e.clientX;
    dragDx = 0;
    track.classList.add('is-dragging');
    if (track.setPointerCapture) {
      try { track.setPointerCapture(e.pointerId); } catch (err) { }
    }
    syncTimer();
  });

  track.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dragDx = e.clientX - dragStartX;
    track.style.transform = 'translate3d(calc(' + (-index * 100) + '% + ' + dragDx.toFixed(1) + 'px),0,0)';
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    var width = track.clientWidth || 1;
    var moved = dragDx;
    if (moved <= -width * 0.14) index = (index + 1) % slides.length;
    else if (moved >= width * 0.14) index = (index - 1 + slides.length) % slides.length;
    dragDx = 0;
    if (Math.abs(moved) > 8) swallowingClick = true;
    apply(true);
    restartBar();
    syncTimer(true);
  }

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('pointerleave', function () { if (dragging) endDrag(); });

  /* 滑动结束后吞掉紧随其后的点击，避免误跳转 */
  track.addEventListener('click', function (e) {
    if (!swallowingClick) return;
    swallowingClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  /* ---------------- 初始化 ---------------- */
  /* 前置条件全部就绪后才切换到轮播态：若本文件未执行或中途失败，
     .cards 保持 home.css 原双列网格，两个专题完整可读可点 */
  root.classList.add('is-carousel');
  root.style.setProperty('--dur', (INTERVAL / 1000) + 's');
  apply(false);
  syncTimer();
  restartBar();
})();
