/* =========================================================
   教学资料库 · 登录 / 注册前端逻辑（assets/login.js）
   ---------------------------------------------------------
   职责（纯前端，不伪造后端）：
   1) 登录 / 注册双表单切换（tab 键盘可操作）
   2) 邮箱 / 密码前端校验（失焦即时校验 + 提交整体校验 + 内联错误）
   3) 密码显隐切换、注册密码强度提示
   4) 「记住我」：仅在本机保存邮箱，绝不保存密码
   5) 提交状态反馈（进行中 / 成功 / 失败）
   6) 本机浏览计数：用于验证浏览量统计口径，后端接入后由服务端统一统计
   约束：不读取、不校验任何真实账号，不做网络请求，不写入 Cookie
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.getElementById('authPanel');
  if (!root) return;

  /* ---------------- 本机存储（不可用时静默降级为内存） ---------------- */
  var memory = {};
  var store = (function () {
    try {
      var k = '__tl_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  function read(key) {
    try {
      if (store) return store.getItem(key);
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    } catch (e) { return null; }
  }
  function write(key, val) {
    try {
      if (store) store.setItem(key, val);
      else memory[key] = val;
    } catch (e) { memory[key] = val; }
  }
  function drop(key) {
    try {
      if (store) store.removeItem(key);
      delete memory[key];
    } catch (e) { delete memory[key]; }
  }

  var K_MAIL = 'tl.auth.rememberedEmail';
  var K_STAT = 'tl.auth.localStats';

  /* ---------------- DOM ---------------- */
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-auth-tab]'));
  var panes = {
    login: doc.getElementById('authLogin'),
    register: doc.getElementById('authRegister')
  };
  var statusBox = doc.getElementById('authStatus');
  var statLine = doc.getElementById('localStats');

  /* ---------------- 工具 ---------------- */
  function fieldOf(el) {
    return el && el.closest ? el.closest('.field') : null;
  }

  function setFieldError(el, msg, showValid) {
    var field = fieldOf(el);
    if (!field) return;
    var errEl = field.querySelector('.field__err');
    if (msg) {
      field.classList.add('field--invalid');
      field.classList.remove('field--valid');
      el.setAttribute('aria-invalid', 'true');
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    } else {
      field.classList.remove('field--invalid');
      el.removeAttribute('aria-invalid');
      if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
      field.classList.toggle('field--valid', !!showValid && !!el.value.trim());
    }
  }

  function clearField(el) { setFieldError(el, '', false); }

  function setStatus(tone, text) {
    if (!statusBox) return;
    if (!text) {
      statusBox.hidden = true;
      statusBox.textContent = '';
      statusBox.removeAttribute('data-tone');
      return;
    }
    statusBox.hidden = false;
    statusBox.setAttribute('data-tone', tone);
    statusBox.textContent = text;
  }

  /* ---------------- 校验规则 ---------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function emailError(v) {
    var s = (v || '').trim();
    if (!s) return '请输入邮箱地址';
    if (/\s/.test(s)) return '邮箱地址不能包含空格';
    if (s.length > 254) return '邮箱地址过长（不超过 254 个字符）';
    if (!EMAIL_RE.test(s)) return '邮箱格式不正确，请检查是否缺少 @ 或域名后缀';
    return '';
  }

  function passwordError(v) {
    if (!v) return '请输入密码';
    if (v.length < 8) return '密码至少 8 位字符';
    if (v.length > 64) return '密码不超过 64 位字符';
    return '';
  }

  function strengthOf(v) {
    if (!v) return 0;
    var s = 0;
    if (v.length >= 8) s += 1;
    if (v.length >= 12) s += 1;
    if (/[A-Za-z]/.test(v) && /\d/.test(v)) s += 1;
    if (/[^A-Za-z0-9]/.test(v)) s += 1;
    if (s <= 1) return 1;
    if (s <= 3) return 2;
    return 3;
  }

  var STRENGTH_TEXT = { 1: '强度：偏弱（建议 12 位以上并混合数字与符号）', 2: '强度：中等（可再增加长度或符号）', 3: '强度：良好' };

  /* ---------------- 密码显隐 ---------------- */
  root.addEventListener('click', function (e) {
    var eye = e.target.closest ? e.target.closest('[data-eye]') : null;
    if (!eye) return;
    var input = doc.getElementById(eye.getAttribute('data-eye'));
    if (!input) return;
    var toText = input.type === 'password';
    input.type = toText ? 'text' : 'password';
    eye.setAttribute('aria-pressed', toText ? 'true' : 'false');
    eye.setAttribute('aria-label', toText ? '隐藏密码' : '显示密码');
    input.focus({ preventScroll: true });
  });

  /* ---------------- 注册密码强度 ---------------- */
  var registerPane = panes.register;
  if (registerPane) {
    var regPw = doc.getElementById('regPassword');
    var meter = doc.getElementById('pwMeter');
    var meterText = meter ? meter.querySelector('.pw-meter__text') : null;
    if (regPw && meter) {
      regPw.addEventListener('input', function () {
        var lv = strengthOf(regPw.value);
        if (lv) {
          meter.setAttribute('data-level', String(lv));
          if (meterText) meterText.textContent = STRENGTH_TEXT[lv];
        } else {
          meter.removeAttribute('data-level');
          if (meterText) meterText.textContent = '强度：至少 8 位，建议混合大小写、数字与符号';
        }
      });
    }
  }

  /* ---------------- 表单切换 ---------------- */
  function switchView(name, focusTab) {
    if (!panes[name]) return;
    Object.keys(panes).forEach(function (key) {
      panes[key].hidden = key !== name;
    });
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-auth-tab') === name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    setStatus('', '');
    if (focusTab) {
      var active = tabs.filter(function (t) { return t.getAttribute('data-auth-tab') === name; })[0];
      if (active) active.focus({ preventScroll: true });
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { switchView(tab.getAttribute('data-auth-tab'), false); });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var i = tabs.indexOf(tab);
      var n = (e.key === 'ArrowRight' ? i + 1 : i - 1 + tabs.length) % tabs.length;
      switchView(tabs[n].getAttribute('data-auth-tab'), true);
      e.preventDefault();
    });
  });

  /* ---------------- 本机浏览计数（统计口径验证） ---------------- */
  var stats = { views: 0, likes: 0, last: '' };
  try {
    var raw = read(K_STAT);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        stats.views = Number(parsed.views) || 0;
        stats.likes = Number(parsed.likes) || 0;
        stats.last = typeof parsed.last === 'string' ? parsed.last : '';
      }
    }
  } catch (e) { /* 忽略脏数据 */ }

  stats.views += 1;
  write(K_STAT, JSON.stringify(stats));

  if (statLine) {
    statLine.textContent = '本机浏览记录：第 ' + stats.views + ' 次打开 · 仅统计当前浏览器，后端接入后由服务端统一记录浏览量与点赞量';
  }

  /* ---------------- 「记住我」回填 ---------------- */
  var remembered = read(K_MAIL) || '';
  if (remembered) {
    var li = doc.getElementById('loginEmail');
    var ri = doc.getElementById('regEmail');
    var rc = doc.getElementById('loginRemember');
    if (li && !li.value) li.value = remembered;
    if (ri && !ri.value) ri.value = remembered;
    if (rc) rc.checked = true;
  }

  /* ---------------- 失焦即时校验 ---------------- */
  ['loginEmail', 'regEmail'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function () {
      var v = el.value.trim();
      if (!v) { clearField(el); return; }
      setFieldError(el, emailError(v), true);
    });
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true') setFieldError(el, emailError(el.value), true);
    });
  });

  ['loginPassword', 'regPassword'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function () {
      var v = el.value;
      if (!v) { clearField(el); return; }
      setFieldError(el, passwordError(v), true);
    });
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true') setFieldError(el, passwordError(el.value), true);
    });
  });

  ['regConfirm', 'regEmail'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) el.addEventListener('input', function () {
      if (id === 'regEmail') {
        var c = doc.getElementById('regConfirm');
        if (c && c.value && c.getAttribute('aria-invalid') === 'true') {
          setFieldError(c, c.value !== el.value.trim() ? '两次输入的密码不一致' : '', true);
        }
      }
    });
  });

  /* ---------------- 提交 ---------------- */
  function focusFirstInvalid(form) {
    var bad = form.querySelector('.field--invalid .field__input');
    if (bad) bad.focus({ preventScroll: false });
  }

  function submitLogin(form) {
    var email = doc.getElementById('loginEmail');
    var pw = doc.getElementById('loginPassword');
    var remember = doc.getElementById('loginRemember');

    var eErr = emailError(email.value);
    var pErr = passwordError(pw.value);
    setFieldError(email, eErr, !eErr);
    setFieldError(pw, pErr, !pErr);

    if (eErr || pErr) {
      setStatus('error', '请先修正表单中标出的问题，再继续提交。');
      focusFirstInvalid(form);
      return false;
    }
    if (remember && remember.checked) write(K_MAIL, email.value.trim());
    else drop(K_MAIL);

    return { email: email.value.trim(), password: pw.value };
  }

  function submitRegister(form) {
    var email = doc.getElementById('regEmail');
    var pw = doc.getElementById('regPassword');
    var cf = doc.getElementById('regConfirm');
    var agree = doc.getElementById('regAgree');

    var eErr = emailError(email.value);
    var pErr = passwordError(pw.value);
    var cErr = cf.value ? (cf.value !== pw.value ? '两次输入的密码不一致' : '') : '请再次输入密码以确认';

    setFieldError(email, eErr, !eErr);
    setFieldError(pw, pErr, !pErr);
    setFieldError(cf, cErr, !cErr);

    if (eErr || pErr || cErr) {
      setStatus('error', '请先修正表单中标出的问题，再继续提交。');
      focusFirstInvalid(form);
      return false;
    }
    if (agree && !agree.checked) {
      setStatus('error', '请先勾选同意《服务条款与隐私说明》。');
      agree.focus({ preventScroll: false });
      return false;
    }

    write(K_MAIL, email.value.trim());
    return { email: email.value.trim(), password: pw.value };
  }

  function runSubmit(form) {
    if (form.classList.contains('is-busy')) return;
    var kind = form.getAttribute('data-auth-form');
    var payload = kind === 'register' ? submitRegister(form) : submitLogin(form);
    if (!payload) return;

    var btn = form.querySelector('.auth-submit');
    var label = form.querySelector('.auth-submit__label');
    var original = label ? label.textContent : '';

    form.classList.add('is-busy');
    if (btn) btn.disabled = true;
    if (label) label.textContent = kind === 'register' ? '正在创建账号…' : '正在验证…';
    setStatus('info', kind === 'register' ? '正在校验注册信息，请稍候…' : '正在校验登录信息，请稍候…');

    /* 纯静态站点：此处不发起任何网络请求，仅做前端流程演示 */
    window.setTimeout(function () {
      form.classList.remove('is-busy');
      if (btn) btn.disabled = false;
      if (label) label.textContent = original;

      var now = new Date();
      var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

      if (kind === 'register') {
        setStatus('ok', '注册信息校验通过（演示模式，尚未写入后端）。邮箱已记在本机，切换到「登录」即可直接使用。提交时间 ' + stamp + '。');
      } else {
        var prev = stats.last ? '上次校验：' + stats.last + '；' : '';
        stats.last = stamp;
        write(K_STAT, JSON.stringify(stats));
        setStatus('ok', '登录信息校验通过（演示模式，尚未对接后端）。' + prev + '本次校验 ' + stamp + '。接入后端后即可完成真实登录并记录浏览量、点赞量。');
      }
    }, 900);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  Array.prototype.slice.call(root.querySelectorAll('[data-auth-form]')).forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      runSubmit(form);
    });
  });

  /* ---------------- 初始化 ---------------- */
  switchView('login', false);
})();
