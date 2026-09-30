/* =========================================================
   教学资料库（多专题）   交互脚本
   专题一：中学体育游戏教学法 · 专项分类整理
   专题二：信息技术教师招聘信息 · 2027届
   原生 JavaScript，零外部依赖，支持 file:// 直接打开
   内容层：内置轻量 Markdown 渲染器（直渲染 SITE_DATA.sections[].md 原文切片）
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.SITE_DATA;
  if (!DATA) return;

  var SECTIONS = DATA.sections || [];
  var REFS = DATA.references || [];
  var BY_ID = {};
  SECTIONS.forEach(function (s) { BY_ID[s.id] = s; });

  /* 专题映射：section id → 所属专题名（由 meta.nav 派生，不新增任何文案） */
  var TOPIC_OF = {};
  (DATA.nav || []).forEach(function (t) {
    if (!t || t.topic === undefined) return;
    (t.groups || []).forEach(function (g) {
      (g.items || []).forEach(function (id) { TOPIC_OF[id] = t.topic; });
    });
  });

  /* 章节标签：体育章节沿用两位序号(lane)，招聘章节使用中文阶段标签(laneLabel) */
  function laneText(sec) {
    if (!sec) return "";
    return sec.laneLabel || sec.lane || "";
  }

  /* 源文档目录锚点 → 站内路由（依据各章节真实标题建立映射，不新增任何文字） */
  var ANCHOR_ROUTES = {};
  function normAnchor(s) {
    return String(s == null ? "" : s)
      .replace(/[#\s、（）()·．.，,。…—－\-]/g, "")
      .toLowerCase();
  }
  SECTIONS.forEach(function (s) {
    if (s.h1) ANCHOR_ROUTES[normAnchor(s.h1)] = s.id;
  });

  var articleEl = document.getElementById("article");
  var navGroupsEl = document.getElementById("navGroups");
  var tocListEl = document.getElementById("tocList");
  var barEl = document.getElementById("progressBar");
  var menuBtn = document.getElementById("menuBtn");
  var scrimEl = document.getElementById("scrim");
  var inputEl = document.getElementById("searchInput");
  var resultsEl = document.getElementById("searchResults");
  var laneEl = document.getElementById("topbarLane");
  var titleEl = document.getElementById("topbarTitle");

  var currentView = "";
  var booted = false;
  var pendingHighlight = null;
  var INDEX = [];
  var observer = null;
  var PARSED = {};

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(s) {
    var t = esc(s);
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\[([^\]]+)\]\(([^)]*)\)/g, function (m, text, href) {
      if (href.charAt(0) === "#") {
        var route = ANCHOR_ROUTES[normAnchor(href.slice(1))];
        if (route) return '<a href="#/' + route + '">' + text + "</a>";
        return text;
      }
      return '<a href="' + href + '" rel="noopener">' + text + "</a>";
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/【(\d+)】/g, function (m, n) {
      return '<a class="ref-link" href="#/refs/' + n + '" data-ref="' + n + '">【' + n + "】</a>";
    });
    return t;
  }

  function stripMd(s) {
    return String(s == null ? "" : s)
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function idOf(secId, bi) { return "b-" + secId + "-" + bi; }

  /* =========================================================
     轻量 Markdown 解析（标题 / 列表 / 表格 / 引用 / 代码块 / 分割线 / 段落）
     段落文本原样保留，不做任何改写
     ========================================================= */
  function splitRow(line) {
    var cells = line.trim().split("|");
    if (cells.length && !cells[0].trim()) cells.shift();
    if (cells.length && !cells[cells.length - 1].trim()) cells.pop();
    return cells.map(function (c) { return c.trim(); });
  }

  function parseBlocks(md) {
    var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
    var blocks = [];
    var buf = [];
    var i = 0;

    function flush() {
      if (buf.length) {
        blocks.push({ type: "p", text: buf.join("\n") });
        buf = [];
      }
    }

    while (i < lines.length) {
      var t = lines[i].trim();

      if (!t) { flush(); i++; continue; }

      if (t.slice(0, 3) === "```") {
        flush();
        i++;
        var code = [];
        while (i < lines.length && lines[i].trim().slice(0, 3) !== "```") {
          code.push(lines[i]);
          i++;
        }
        i++;
        blocks.push({ type: "code", lines: code });
        continue;
      }

      if (/^-{3,}$/.test(t)) { flush(); blocks.push({ type: "hr" }); i++; continue; }

      var h = /^(#{1,6})\s+(.*)$/.exec(t);
      if (h) { flush(); blocks.push({ type: "h", level: h[1].length, text: h[2].trim() }); i++; continue; }

      if (/^>\s?/.test(t)) {
        flush();
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          q.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        blocks.push({ type: "quote", lines: q });
        continue;
      }

      if (t.indexOf("|") >= 0 && i + 1 < lines.length && /^\|[\s:\-|]+\|$/.test(lines[i + 1].trim())) {
        flush();
        var head = splitRow(t);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim().indexOf("|") >= 0) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        blocks.push({ type: "table", head: head, rows: rows });
        continue;
      }

      if (/^[-*]\s+/.test(t)) {
        flush();
        var ul = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          ul.push(lines[i].trim().replace(/^[-*]\s+/, ""));
          i++;
        }
        blocks.push({ type: "ul", items: ul });
        continue;
      }

      if (/^\d+\.\s+/.test(t)) {
        flush();
        var ol = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          ol.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          i++;
        }
        blocks.push({ type: "ol", items: ol });
        continue;
      }

      buf.push(t);
      i++;
    }

    flush();
    return blocks;
  }

  /* ---------------- 块 → HTML ---------------- */
  function headHtml(b, id) {
    var lvl = b.level <= 3 ? "h2" : "h3";
    var toc = b.level <= 3 ? "2" : "3";
    return (
      '<' + lvl + ' class="' + lvl + '" id="' + id + '" data-toc="' + toc + '">' +
        inline(b.text) +
      "</" + lvl + ">"
    );
  }

  function bodyHtml(b, id, alertCtx) {
    var out = [];
    var k;

    switch (b.type) {
      case "p":
        if (/^（?性别效应/.test(b.text)) {
          out.push('<p class="sex-note" id="' + id + '">' + inline(b.text) + "</p>");
        } else {
          out.push('<p class="prose" id="' + id + '">' + inline(b.text) + "</p>");
        }
        break;

      case "quote":
        out.push('<blockquote class="quote" id="' + id + '">');
        (b.lines || []).forEach(function (l) { out.push("<p>" + inline(l) + "</p>"); });
        out.push("</blockquote>");
        break;

      case "ul":
      case "ol":
        var tag = b.type === "ol" ? "ol" : "ul";
        var cls = "list" + (alertCtx && b.type !== "ol" ? " list--alert" : "");
        out.push("<" + tag + ' class="' + cls + '">');
        (b.items || []).forEach(function (it) {
          out.push("<li>" + inline(it) + "</li>");
        });
        out.push("</" + tag + ">");
        break;

      case "table":
        out.push('<div class="table-wrap" id="' + id + '"><table>');
        if (b.head && b.head.length) {
          out.push("<thead><tr>");
          b.head.forEach(function (th) { out.push('<th scope="col">' + inline(th) + "</th>"); });
          out.push("</tr></thead>");
        }
        out.push("<tbody>");
        (b.rows || []).forEach(function (row) {
          out.push("<tr>");
          for (k = 0; k < b.head.length; k++) {
            out.push("<td>" + inline(row[k] == null ? "" : row[k]) + "</td>");
          }
          out.push("</tr>");
        });
        out.push("</tbody></table></div>");
        out.push('<p class="scroll-hint">表格可左右滑动查看</p>');
        break;

      case "code":
        var isFlow = (b.lines || []).some(function (l) { return l.trim() === "↓"; });
        if (isFlow) {
          var steps = (b.lines || []).filter(function (l) {
            return l.trim() && l.trim() !== "↓";
          });
          out.push('<ol class="flow" id="' + id + '">');
          steps.forEach(function (s) { out.push("<li>" + inline(s.trim()) + "</li>"); });
          out.push("</ol>");
        } else {
          out.push('<pre class="code" id="' + id + '"><code>' + esc((b.lines || []).join("\n")) + "</code></pre>");
        }
        break;

      case "hr":
        out.push('<hr class="rule">');
        break;

      default:
        if (b.text) out.push('<p class="prose" id="' + id + '">' + inline(b.text) + "</p>");
    }

    return out.join("");
  }

  function refListHtml() {
    var out = ['<ol class="reflist">'];
    REFS.forEach(function (r) {
      var body = String(r.raw || "").replace(/^【\d+】/, "");
      out.push(
        '<li class="ref-item" id="ref-' + r.n + '">' +
          '<span class="ref-num">【' + r.n + "】</span>" +
          '<span class="ref-body">' + esc(body) + "</span>" +
        "</li>"
      );
    });
    out.push("</ol>");
    return out.join("");
  }

  /* ---------------- 渲染视图 ---------------- */
  function renderSection(sec) {
    var blocks = PARSED[sec.id] || [];
    var out = [];

    out.push('<header class="sec-head">');
    var lt = laneText(sec);
    if (lt) out.push('<p class="sec-lane">' + esc(lt) + "</p>");
    out.push('<h1 class="sec-title">' + esc(sec.h1 || sec.title) + "</h1>");
    out.push("</header>");

    var alertCtx = false;
    blocks.forEach(function (b, bi) {
      var id = idOf(sec.id, bi);
      if (b.type === "h") {
        alertCtx = b.text.indexOf("注意事项") >= 0;
        out.push(headHtml(b, id));
        return;
      }
      out.push(bodyHtml(b, id, alertCtx));
    });

    if (sec.id === "refs") out.push(refListHtml());

    articleEl.innerHTML = out.join("");
  }

  /* ---------------- 侧栏导航 ---------------- */
  function navItemHtml(s) {
    var tag = laneText(s);
    return (
      '<a class="nav-item" href="#/' + s.id + '" data-view="' + s.id + '">' +
        (tag
          ? '<span class="lane-no">' + esc(tag) + "</span>"
          : '<span class="lane-no lane-no--none">·</span>') +
        '<span class="lane-name">' + esc(s.title) + "</span>" +
      "</a>"
    );
  }

  function buildNav() {
    if (navGroupsEl.getAttribute("data-built") === "1") return;
    var html = [];
    var nav = DATA.nav || [];
    var isTopics = !!(nav.length && nav[0] && nav[0].topic !== undefined);

    function pushGroups(groups) {
      (groups || []).forEach(function (g) {
        html.push('<div class="nav-group">');
        html.push('<p class="nav-group__title">' + esc(g.group) + "</p>");
        (g.items || []).forEach(function (id) {
          var s = BY_ID[id];
          if (!s) return;
          html.push(navItemHtml(s));
        });
        html.push("</div>");
      });
    }

    if (isTopics) {
      nav.forEach(function (t, ti) {
        html.push('<div class="nav-topic' + (ti === 0 ? " nav-topic--first" : "") + '">');
        html.push('<p class="nav-topic__name">' + esc(t.topic) + "</p>");
        if (t.note) html.push('<p class="nav-topic__note">' + esc(t.note) + "</p>");
        html.push("</div>");
        pushGroups(t.groups);
      });
    } else {
      pushGroups(nav);
    }

    navGroupsEl.innerHTML = html.join("");
    navGroupsEl.setAttribute("data-built", "1");
  }

  function markNav(view) {
    var items = navGroupsEl.querySelectorAll(".nav-item");
    Array.prototype.forEach.call(items, function (a) {
      if (a.getAttribute("data-view") === view) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  /* ---------------- 本页目录 ---------------- */
  function setTocActive(links, id) {
    Object.keys(links).forEach(function (key) {
      if (key === id) links[key].setAttribute("aria-current", "true");
      else links[key].removeAttribute("aria-current");
    });
  }

  function buildToc() {
    if (observer) { observer.disconnect(); observer = null; }

    var heads = articleEl.querySelectorAll("[data-toc]");
    if (!heads.length) { tocListEl.innerHTML = ""; return; }

    var html = [];
    Array.prototype.forEach.call(heads, function (h) {
      var lvl = h.getAttribute("data-toc");
      html.push(
        '<li class="toc__item toc__item--' + lvl + '">' +
          '<a href="#/' + currentView + '" data-target="' + h.id + '">' + esc(h.textContent) + "</a>" +
        "</li>"
      );
    });
    tocListEl.innerHTML = html.join("");

    var links = {};
    Array.prototype.forEach.call(tocListEl.querySelectorAll("a"), function (a) {
      links[a.getAttribute("data-target")] = a;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var t = document.getElementById(a.getAttribute("data-target"));
        if (t) t.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
      });
    });

    if (typeof IntersectionObserver !== "function") return;

    var visible = [];
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = visible.indexOf(en.target.id);
        if (en.isIntersecting) { if (i < 0) visible.push(en.target.id); }
        else if (i >= 0) { visible.splice(i, 1); }
      });
      var first = null;
      Array.prototype.forEach.call(heads, function (h) {
        if (!first && visible.indexOf(h.id) >= 0) first = h.id;
      });
      if (first) setTocActive(links, first);
    }, { rootMargin: "-12% 0px -72% 0px" });

    Array.prototype.forEach.call(heads, function (h) { observer.observe(h); });
  }

  /* ---------------- 检索索引（基于原文切片） ---------------- */
  function blockText(b) {
    switch (b.type) {
      case "h": return b.text;
      case "p": return b.text;
      case "quote": return (b.lines || []).join(" ");
      case "ul":
      case "ol": return (b.items || []).join(" ");
      case "table":
        return (b.head || []).join(" ") + " " + (b.rows || []).map(function (r) { return r.join(" "); }).join(" ");
      case "code": return (b.lines || []).join(" ");
      default: return b.text || "";
    }
  }

  function buildIndex() {
    INDEX = [];
    var seen = {};
    SECTIONS.forEach(function (sec) {
      (PARSED[sec.id] || []).forEach(function (b, bi) {
        if (b.type === "hr") return;
        var text = stripMd(blockText(b));
        if (!text) return;
        var id = idOf(sec.id, bi);
        if (seen[id]) return;
        seen[id] = 1;
        INDEX.push({
          id: id,
          view: sec.id,
          secTitle: (TOPIC_OF[sec.id] ? TOPIC_OF[sec.id] + " · " : "") + sec.title,
          text: text
        });
      });
    });
    REFS.forEach(function (r) {
      INDEX.push({
        id: "ref-" + r.n,
        view: "refs",
        secTitle: "参考文献与原文出处",
        text: "【" + r.n + "】" + String(r.raw || "").replace(/^【\d+】/, "")
      });
    });
  }

  /* ---------------- 检索交互 ---------------- */
  function snippet(text, terms) {
    var i;
    var low = text.toLowerCase();
    var at = -1;
    for (i = 0; i < terms.length; i++) {
      at = low.indexOf(terms[i]);
      if (at >= 0) break;
    }
    var start = at > 40 ? at - 24 : 0;
    var body = text.slice(start, start + 90);
    if (start > 0) body = "…" + body;
    if (start + 90 < text.length) body = body + "…";
    var safe = esc(body);
    for (i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (!t) continue;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      safe = safe.replace(re, "<mark>$1</mark>");
    }
    return safe;
  }

  function runSearch() {
    var q = (inputEl.value || "").trim();
    if (!q) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      return;
    }

    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = [];
    var i, j, ok;

    for (i = 0; i < INDEX.length && hits.length < 40; i++) {
      var low = INDEX[i].text.toLowerCase();
      ok = true;
      for (j = 0; j < terms.length; j++) {
        if (low.indexOf(terms[j]) < 0) { ok = false; break; }
      }
      if (ok) hits.push(INDEX[i]);
    }

    if (!hits.length) {
      resultsEl.innerHTML = '<p class="hit hit--empty">未找到匹配条目，可换用更短的关键词，例如“垫球”“SWOT”“特岗”“教资”。</p>';
      resultsEl.hidden = false;
      return;
    }

    var html = ['<p class="hit-count">命中 ' + hits.length + " 条</p>"];
    hits.forEach(function (e) {
      html.push(
        '<a class="hit" href="#/' + e.view + '" data-hl="' + e.id + '">' +
          '<span class="hit__meta">' + esc(e.secTitle) + "</span>" +
          '<span class="hit__text">' + snippet(e.text, terms) + "</span>" +
        "</a>"
      );
    });
    resultsEl.innerHTML = html.join("");
    resultsEl.hidden = false;
  }

  /* ---------------- 高亮定位 ---------------- */
  function applyHighlight(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) { window.scrollTo(0, 0); return; }
    el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
    el.classList.add("is-target");
    window.setTimeout(function () { el.classList.remove("is-target"); }, 2400);
  }

  /* ---------------- 抽屉 ---------------- */
  function openDrawer() {
    document.body.classList.add("nav-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    if (!document.body.classList.contains("nav-open")) return;
    document.body.classList.remove("nav-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  /* ---------------- 动效 ---------------- */
  function animate() {
    articleEl.classList.remove("is-boot", "is-switch");
    if (reduced()) return;

    if (!booted) {
      booted = true;
      var kids = articleEl.children;
      var i;
      for (i = 0; i < kids.length && i < 8; i++) {
        kids[i].style.animationDelay = Math.min(i * 55, 380) + "ms";
      }
      void articleEl.offsetWidth;
      articleEl.classList.add("is-boot");
    } else {
      void articleEl.offsetWidth;
      articleEl.classList.add("is-switch");
    }
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    /* 兜底视图取当前数据的第一章，兼容各专题分页面（不再硬编码 overview） */
    var DEFAULT_VIEW = (DATA.sections[0] && DATA.sections[0].id) || "overview";
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var parts = raw.split("/");
    var view = parts[0] || DEFAULT_VIEW;
    var sub = parts[1] || "";
    if (!BY_ID[view]) { view = DEFAULT_VIEW; sub = ""; }

    var sec = BY_ID[view];
    renderSection(sec);
    currentView = view;
    markNav(view);
    buildToc();

    if (laneEl) laneEl.textContent = laneText(sec);
    if (titleEl) titleEl.textContent = TOPIC_OF[view] || ((DATA.meta && DATA.meta.title) || "");
    document.title = (sec.h1 || sec.title) + " · " + (TOPIC_OF[view] || ((DATA.meta && DATA.meta.title) || "教学资料库"));
    document.documentElement.setAttribute("data-view", view);

    var target = sub ? "ref-" + sub : pendingHighlight;
    pendingHighlight = null;

    if (target) applyHighlight(target);
    else window.scrollTo(0, 0);

    animate();
    closeDrawer();
    updateProgress();
  }

  /* ---------------- 进度条 ---------------- */
  var ticking = false;

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (barEl) barEl.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      updateProgress();
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateProgress);

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      if (document.body.classList.contains("nav-open")) closeDrawer();
      else openDrawer();
    });
  }
  if (scrimEl) scrimEl.addEventListener("click", closeDrawer);

  if (inputEl) {
    inputEl.addEventListener("input", runSearch);
    inputEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { inputEl.value = ""; runSearch(); }
    });
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeDrawer();
  });

  document.addEventListener("click", function (ev) {
    if (!resultsEl || resultsEl.hidden) return;
    if (ev.target.closest && ev.target.closest(".search")) return;
    resultsEl.hidden = true;
  });

  if (resultsEl) {
    resultsEl.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest("a.hit") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      var view = href.replace(/^#\//, "");
      pendingHighlight = a.getAttribute("data-hl");
      inputEl.value = "";
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      closeDrawer();
      if (location.hash === "#/" + view) route();
      else location.hash = "#/" + view;
    });
  }

  if (articleEl) {
    articleEl.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest("a") : null;
      if (a) closeDrawer();
    });
  }

  /* ---------------- 启动 ---------------- */
  SECTIONS.forEach(function (s) { PARSED[s.id] = parseBlocks(s.md); });
  buildNav();
  buildIndex();
  route();
})();
