/* ГК «Доброград» · Worksection spotlight guide · renderer
   Loads shots.js (window.SHOTS) + storyboard (window.STORY, file from ?story=, default storyboard.js)
   and renders every slide as a 1920×1080 page. Sets <html data-ready="1"> when done.
   Layout warnings are collected in <script id="layout-warnings" type="application/json">. */
(function () {
  'use strict';
  var W = 1920, H = 1080;
  var SEC = { gold: '#B8963F', bud: '#C96F1E', akt: '#2F8051', kom: '#2A64A6', ink: '#23301E', red: '#C8382E' };
  var FLOW = { new: '#D23A3A', work: '#E2B93B', wait: '#9AA1A9', agree: '#C98FAE', ok: '#3D7DD0', info: '#5B4FA8',
               done: '#4E9A3E', ink: '#23301E', red: '#C8382E', gold: '#B8963F' };
  var LOGO = window.DG_LOGO || '../img/logo.svg';   // the web viewer sets DG_LOGO
  var WARN = [];
  function warn(id, msg) { WARN.push(id + ': ' + msg); try { console.warn('[layout] ' + id + ': ' + msg); } catch (e) {} }

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // body/rich text: storyboard is trusted HTML (b, br, ul/li, «»). {1} {2} {3} -> neat gold numerals.
  function rich(s) { return String(s == null ? '' : s).replace(/\{([1-9])\}/g, '<span class="n">$1</span>'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function emb(cls) { return '<span class="' + (cls || 'emb') + '"><img src="' + LOGO + '" alt=""></span>'; }
  function secColor(sec) { return (sec && SEC[sec.color]) || SEC.gold; }
  function hex(n) { return '#' + n.map(function (v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join(''); }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  // darken a colour until it reads as text on the warm ivory backgrounds (WCAG ≥ 4.5 : 1)
  var TEXT_TONE = { '#B8963F': '#7A5A1C' };
  function textTone(c) {
    if (TEXT_TONE[c]) return TEXT_TONE[c];
    var v = rgb(c), k = 0, out = c;
    while (contrast(out, '#EFE8D6') < 4.6 && k < 20) { k++; out = hex(v.map(function (x) { return x * (1 - .05 * k); })); }
    return (TEXT_TONE[c] = out);
  }
  // chip with readable label: dark text if it wins, else darken the chip until white text passes
  function chip(c) {
    var dark = '#1E2616';
    if (contrast(c, dark) >= 4.5 && contrast(c, dark) >= contrast(c, '#FFFFFF')) return { bg: c, fg: dark };
    var v = rgb(c), k = 0, bg = c;
    while (contrast(bg, '#FFFFFF') < 4.5 && k < 20) { k++; bg = hex(v.map(function (x) { return x * (1 - .04 * k); })); }
    return { bg: bg, fg: '#FFFFFF' };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function overlapArea(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function inflate(r, d, dy) { dy = dy == null ? d : dy; return { x: r.x - d, y: r.y - dy, w: r.w + 2 * d, h: r.h + 2 * dy }; }
  function union(rs) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    rs.forEach(function (r) { x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    function f(c) { return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
  }

  var ICON = {
    pointer: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 3.5l13.2 6.3c.8.4.7 1.5-.1 1.8l-5.4 1.6-2.3 5.3c-.3.8-1.5.8-1.8-.1L4 4.7c-.3-.8.5-1.5 1-1.2z" fill="#1B2412"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    xs: '<svg class="m" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="14" fill="#F3D5CE"/><path d="M10.5 10.5l9 9M19.5 10.5l-9 9" stroke="#C8382E" stroke-width="2.6" stroke-linecap="round"/></svg>',
    cs: '<svg class="m" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="14" fill="#D3E6CB"/><path d="M9.5 15.5l3.8 3.8 7.4-8" stroke="#4E9A3E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 56 24" fill="none"><path d="M2 12h48" stroke="#B8963F" stroke-width="3" stroke-linecap="round"/><path d="M42 4l9 8-9 8" stroke="#B8963F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 30 30" fill="none"><path d="M24 15H7M13 8l-7 7 7 7" stroke="#EBCF94" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 30 30" fill="none"><path d="M6 15h17M17 8l7 7-7 7" stroke="#EBCF94" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="#B8963F" stroke-width="1.8"/><path d="M14 3v5h5M9 13h7M9 17h5" stroke="#B8963F" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  function actionHTML(s) { return s.action ? '<div class="action"><span class="ic">' + ICON.pointer + '</span><span>' + rich(s.action) + '</span></div>' : ''; }
  function tipHTML(s) { return s.tip ? '<div class="tip"><span class="ic">i</span><span>' + rich(s.tip) + '</span></div>' : ''; }

  /* ---------------- boot ----------------
     PDF (render.html): loads the storyboard named in ?story= and renders into #deck.
     Web viewer: sets window.DG_WEB = true before this file; it calls DGRender.run(deckEl) itself. */
  var DECK = null;
  if (window.DG_WEB) {
    window.DGRender = {
      run: function (deck) { DECK = deck; return main(); },
      rich: rich, esc: esc, SEC: SEC, secColor: secColor, textTone: textTone, actionHTML: actionHTML, tipHTML: tipHTML,
      warnings: function () { return WARN.slice(); }
    };
  } else {
    var params = new URLSearchParams(location.search);
    var storyFile = params.get('story') || 'storyboard.js';
    var sc = document.createElement('script');
    sc.src = storyFile;
    sc.onload = function () { main().catch(function (e) { fatal('Помилка рендеру: ' + e.message); console.error(e); }); };
    sc.onerror = function () { fatal('Не вдалося завантажити сценарій «' + storyFile + '»'); };
    document.head.appendChild(sc);
  }

  function fatal(msg) {
    var d = DECK || document.getElementById('deck'); d.innerHTML = '';
    var s = el('section', 'slide err', esc(msg)); d.appendChild(s);
    document.documentElement.setAttribute('data-ready', '1');
    return built;
  }

  function loadImg(src) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { res({ ok: true, w: i.naturalWidth, h: i.naturalHeight }); };
      i.onerror = function () { res({ ok: false, w: 1456, h: 819 }); };
      i.src = src;
    });
  }

  async function main() {
    var STORY = window.STORY, SHOTS = window.SHOTS || {};
    if (!STORY || !STORY.slides) return fatal('Сценарій не містить window.STORY.slides');
    var sections = {}; (STORY.sections || []).forEach(function (s, i) { s._i = i; sections[s.id] = s; });
    var slides = STORY.slides, total = slides.length;

    // step counters per section (spot only)
    var cnt = {}, k = {};
    slides.forEach(function (s) { if (s.kind === 'spot') cnt[s.section] = (cnt[s.section] || 0) + 1; });
    slides.forEach(function (s) { if (s.kind === 'spot') { k[s.section] = (k[s.section] || 0) + 1; s._k = k[s.section]; s._m = cnt[s.section]; } });

    // preload screenshots
    var sizes = {}, files = {};
    slides.forEach(function (s) { if (s.kind === 'spot' && SHOTS[s.shot]) files[SHOTS[s.shot].file] = 1; });
    await Promise.all(Object.keys(files).map(function (f) { return loadImg(f).then(function (r) { sizes[f] = r; if (!r.ok) warn('image', 'cannot load ' + f); }); }));

    var deck = DECK || document.getElementById('deck');
    var built = [];
    slides.forEach(function (s, i) {
      var ctx = { i: i, total: total, sec: sections[s.section], sections: STORY.sections || [], meta: STORY.meta || {}, SHOTS: SHOTS, sizes: sizes };
      var node;
      try {
        var fn = R[s.kind];
        node = fn ? fn(s, ctx) : errSlide(s, 'Невідомий тип слайду: ' + s.kind);
      } catch (e) { console.error(e); node = errSlide(s, 'Помилка: ' + e.message); }
      node.style.setProperty('--sec', secColor(ctx.sec));
      node.style.setProperty('--sec-t', textTone(secColor(ctx.sec)));
      node.style.setProperty('--sec-fg', contrast(secColor(ctx.sec), '#FFFFFF') >= 4.5 ? '#FFFDF5' : '#1E2616');
      node.setAttribute('data-id', s.id || ('#' + (i + 1)));
      node._s = s; node._ctx = ctx;
      deck.appendChild(node);
      built.push({ s: s, node: node, ctx: ctx });
    });

    // fonts
    try {
      await Promise.all([
        document.fonts.load('800 42px Montserrat', 'АБВ іїєґ'), document.fonts.load('700 18px Montserrat', 'АБВ'),
        document.fonts.load('600 16px Montserrat', 'АБВ'), document.fonts.load('500 16px Montserrat', 'АБВ'),
        document.fonts.load('400 27px Inter', 'АБВ іїєґ'), document.fonts.load('600 26px Inter', 'АБВ'),
        document.fonts.load('500 21px Inter', 'АБВ'), document.fonts.load('700 26px Inter', 'АБВ'),
        document.fonts.load('italic 500 48px "Cormorant Garamond"', 'АБВ'), document.fonts.load('500 600px "Cormorant Garamond"', '0123456789')
      ]);
    } catch (e) { warn('fonts', e.message); }
    await document.fonts.ready;

    // second pass: layout that needs measured text
    built.forEach(function (b) {
      try {
        if (b.s.kind === 'spot' && b.node._layout) b.node._layout();
        if (b.node._fit) b.node._fit();
      } catch (e) { console.error(e); warn(b.s.id, 'layout error ' + e.message); }
    });

    var w = document.createElement('script'); w.type = 'application/json'; w.id = 'layout-warnings';
    w.textContent = JSON.stringify(WARN); document.body.appendChild(w);

    if (!window.DG_WEB && !window.matchMedia('print').matches) {
      var z = Math.min(1, (window.innerWidth - 48) / W);
      document.documentElement.style.setProperty('--screen-zoom', z);
    }
    document.documentElement.setAttribute('data-ready', '1');
    return built;
  }

  function errSlide(s, msg) { return el('section', 'slide err', esc((s && s.id ? s.id + ' · ' : '') + msg)); }

  function footStatic(ctx) {
    var sec = ctx.sec;
    var left = sec ? '<span class="sec"><span class="dot"></span>Частина ' + esc(sec.num) + ' · ' + esc(sec.title) + '</span>' : '<span></span>';
    return '<div class="foot">' + left + '<span class="pg"><span><b>' + (ctx.i + 1) + '</b> / ' + ctx.total + '</span>' + emb() + '</span></div>';
  }
  function kickerHTML(ctx, extra) {
    var sec = ctx.sec; if (!sec) return '';
    return '<div class="kicker"><span class="chip"></span>Частина ' + esc(sec.num) + ' · ' + esc(extra || sec.title) + '</div>';
  }

  /* fit: shrink a container with CSS zoom until it fits its box */
  function fitter(node, sel, warnId) {
    node._fit = function () {
      var c = node.querySelector(sel); if (!c) return;
      var z = 1;
      while ((c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1) && z > .78) { z -= .03; c.firstElementChild.style.zoom = z; }
      if (z < 1) { warn(warnId, 'content shrunk to ' + Math.round(z * 100) + '%' + (z <= .78 ? ' (STILL OVERFLOWS)' : '')); return; }
      // sparse slide: grow content (up to +28%) so short lists read larger
      var inner = c.firstElementChild;
      while (z < 1.5) {
        inner.style.zoom = z + .04;
        if (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1 || inner.getBoundingClientRect().height > c.clientHeight * .9) { inner.style.zoom = z; break; }
        z += .04;
      }
    };
  }

  /* ================= kinds ================= */
  var R = {};

  R.cover = function (s, ctx) {
    var m = ctx.meta || {};
    var n = el('section', 'slide cover dark');
    var sub = s.subtitle || m.subtitle || '';
    function plain(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    if (sub && s.body && plain(s.body).indexOf(plain(sub)) >= 0) sub = '';
    var bodyHasHint = /Гортайте/i.test(s.body || '');
    n.innerHTML =
      '<div class="frame"></div>' +
      '<div class="wm"><img src="' + LOGO + '" alt=""></div>' +
      '<div class="inner">' +
        '<img class="logo" src="' + LOGO + '" alt="ГК «Доброград»">' +
        '<div class="kick">ГК «Доброград» · Інструкція</div>' +
        '<h1>' + rich(s.title || m.title || '') + '</h1>' +
        (sub ? '<div class="sub">' + rich(sub) + '</div>' : '') +
        (s.body ? '<div class="lead">' + rich(s.body) + '</div>' : '') +
      '</div>' +
      '<div class="hint"><span class="keys"><span class="key">' + ICON.left + '</span><span class="key">' + ICON.right + '</span></span>' +
        (bodyHasHint ? '' : '<span>Гортайте стрілками</span>') + '</div>' +
      '<div class="ver">' + esc([m.version ? 'Версія ' + m.version : '', m.date || ''].filter(Boolean).join(' · ')) + '</div>';
    return n;
  };

  R.section = function (s, ctx) {
    var sec = ctx.sec || { num: '', title: '' };
    var n = el('section', 'slide section');
    var bl = (s.bullets || []).slice(0, 4);
    n.innerHTML =
      '<div class="panel"><div class="plabel">Частина</div><div class="pwm"><img src="' + LOGO + '" alt=""></div><div class="num">' + esc(sec.num) + '</div></div>' +
      '<div class="right">' +
        '<div class="of">Частина ' + esc(sec.num) + (ctx.sections.length ? ' <span class="lc">з</span> ' + ctx.sections.length : '') + '</div>' +
        '<h1>' + rich(s.title || sec.title) + '</h1>' +
        '<div class="rule"></div>' +
        (s.body ? '<div class="lead">' + rich(s.body) + '</div>' : '') +
        (bl.length ? '<div class="inlist"><div class="lab">У цій частині</div><ol>' + bl.map(function (b, i) {
          return '<li><span class="i">' + String(i + 1).padStart(2, '0') + '</span><span>' + rich(b) + '</span></li>'; }).join('') + '</ol></div>' : '') +
      '</div>' + footStatic(ctx);
    // two-digit numbers need a smaller numeral
    if (String(sec.num).length > 1) n.querySelector('.num').style.fontSize = '440px';
    return n;
  };

  function paper(s, ctx, cls, contentHTML) {
    var n = el('section', 'slide paper ' + cls);
    n.innerHTML =
      '<div class="hd">' + kickerHTML(ctx) + '<h1>' + rich(s.title) + '</h1>' + (s.body ? '<div class="lead">' + rich(s.body) + '</div>' : '') + '</div>' +
      '<div class="content"><div class="cin">' + contentHTML +
        ((s.action || s.tip) ? '<div class="after">' + actionHTML(s) + tipHTML(s) + '</div>' : '') +
      '</div></div>' + footStatic(ctx);
    fitter(n, '.content', s.id);
    return n;
  }

  R.compare = function (s, ctx) {
    function col(c, def) {
      c = c || {}; var bad = (c.tone || def) === 'bad';
      return '<div class="col ' + (bad ? 'bad' : 'good') + '"><div class="ch"><span class="badge">' + (bad ? ICON.x : ICON.check) + '</span>' +
        esc(c.title || (bad ? 'Так не робимо' : 'Так робимо')) + '</div><ul>' + (c.items || []).map(function (it) {
          var t = typeof it === 'string' ? { text: it } : it;
          return '<li>' + (bad ? ICON.xs : ICON.cs) + '<span>' + rich(t.text) + (t.note ? '<span class="note">' + rich(t.note) + '</span>' : '') + '</span></li>';
        }).join('') + '</ul></div>';
    }
    return paper(s, ctx, 'k-compare', '<div class="cmp">' + col(s.left, 'bad') + col(s.right, 'good') + '</div>');
  };

  R.flow = function (s, ctx) {
    var st = (s.steps || []).slice(0, 6), h = '<div class="flow">';
    st.forEach(function (x, i) {
      var c = FLOW[x.color] || SEC[x.color] || FLOW.ink;
      var cc = chip(c), fg = cc.fg; c = cc.bg;
      if (i) h += '<div class="ar">' + ICON.arrow + '</div>';
      h += '<div class="st"><div class="idx">КРОК ' + (i + 1) + '</div><div class="box" style="background:' + c + ';color:' + fg + '"><span class="lbl">' + rich(x.label) + '</span></div>' +
        (x.sub ? '<div class="sub">' + rich(x.sub) + '</div>' : '') + '</div>';
    });
    h += '</div>';
    var n = paper(s, ctx, 'k-flow', h);
    if (st.length >= 5) n.classList.add('dense');
    var fit0 = n._fit;
    n._fit = function () {   // shrink a label until its longest word fits the box
      n.querySelectorAll('.flow .box').forEach(function (b) {
        var cs = getComputedStyle(b), fs = parseFloat(cs.fontSize), lb = b.firstElementChild;
        var avail = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
        while (lb && lb.getBoundingClientRect().width > avail && fs > 18) { fs -= 1; b.style.fontSize = fs + 'px'; }
      });
      fit0();
    };
    return n;
  };

  R.grid = function (s, ctx) {
    var it = (s.items || []).slice(0, 6), n = it.length;
    var cols = s.columns || (n <= 4 ? n : 3);
    var h = '<div class="grid" style="--cols:' + cols + '">' + it.map(function (x) {
      return '<div class="gc" style="--c:' + (SEC[x.color] || FLOW[x.color] || SEC.gold) + ';--ct:' + textTone(SEC[x.color] || FLOW[x.color] || SEC.gold) + '"><h3>' + rich(x.title) + '</h3>' +
        (x.sub ? '<div class="gs">' + rich(x.sub) + '</div>' : '') +
        ((x.list && x.list.length) ? '<ul>' + x.list.map(function (l) { return '<li>' + rich(l) + '</li>'; }).join('') + '</ul>' : '') +
        (x.groups || []).map(function (g) { return '<div class="gg"><div class="gl">' + rich(g.label) + '</div><ul>' + g.list.map(function (l) { return '<li>' + rich(l) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>';
    }).join('') + '</div>';
    return paper(s, ctx, 'k-grid', h);
  };

  R.checklist = function (s, ctx) {
    var it = (s.items || []).slice(0, 11), two = it.length > 6;
    var rows = two ? Math.ceil(it.length / 2) : it.length;
    var h = '<ol class="chk" style="grid-template-columns:' + (two ? '1fr 1fr' : 'minmax(0,1300px)') + ';grid-template-rows:repeat(' + rows + ',auto);grid-auto-flow:column">' +
      it.map(function (x, i) { return '<li><span class="box"></span><span class="no">' + String(i + 1).padStart(2, '0') + '</span><span>' + rich(x) + '</span></li>'; }).join('') + '</ol>';
    var n = paper(s, ctx, 'k-check', h);
    if (two) n.querySelectorAll('.chk li').forEach(function (li) { li.style.fontSize = '27px'; li.style.padding = '16px 24px'; });
    return n;
  };

  R.template = function (s, ctx) {
    var h = '<div class="tpl"><div class="sheet2"></div><div class="sheet"><div class="fold"></div>' +
      (s.heading ? '<div class="meta">' + ICON.doc + '<span>' + rich(s.heading) + '</span></div>' : '') +
      '<dl>' + (s.lines || []).map(function (l) { return '<dt>' + rich(l.k) + '</dt><dd>' + rich(l.v) + '</dd>'; }).join('') + '</dl></div></div>';
    return paper(s, ctx, 'k-template', h);
  };

  R.statement = function (s, ctx) {
    var n = el('section', 'slide statement dark');
    var sec = ctx.sec;
    n.innerHTML = '<div class="inner">' + emb('seal') +
      (sec ? '<div class="kicker"><span class="chip"></span>Частина ' + esc(sec.num) + ' · ' + esc(sec.title) + '</div>' : '') +
      '<h1>' + rich(s.title) + '</h1><div class="rule"></div>' + (s.body ? '<div class="lead">' + rich(s.body) + '</div>' : '') +
      ((s.action || s.tip) ? '<div style="margin-top:36px;max-width:1100px">' + actionHTML(s) + '</div>' : '') +
      '</div>' + footStatic(ctx);
    return n;
  };

  /* ================= SPOT =================
     The screen lives in a "frame" (1920×1024); the 56 px band below holds the fixed part chip + page counter.
     Modes: full  – 16:9 shot fills the frame; zoomed in (camera) when targets are small so UI text is readable
            side  – tall/square shot in a column (also zoomed), card on the free side
            inset – 16:9 shot at ~62 % width beside the card (huge targets)                                   */
  var RING = 5;                 // gap between hole and gold ring
  var HALO = 14;                // outer faint ring offset
  var FH = 1024;                // frame height (band below)
  var SMAX = 1.75;              // max magnification vs. native screenshot pixels
  var GUT = 40;
  var CW = 640;                 // ONE card width for every spot slide
  var DIM = .70;

  function rr(r, rad) {
    var x = r.x, y = r.y, w = r.w, h = r.h, q = Math.min(rad, w / 2, h / 2);
    return 'M' + (x + q) + ' ' + y + 'H' + (x + w - q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (x + w) + ' ' + (y + q) + 'V' + (y + h - q) +
      'A' + q + ' ' + q + ' 0 0 1 ' + (x + w - q) + ' ' + (y + h) + 'H' + (x + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + x + ' ' + (y + h - q) +
      'V' + (y + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (x + q) + ' ' + y + 'Z';
  }

  R.spot = function (s, ctx) {
    var n = el('section', 'slide spot');
    var shot = ctx.SHOTS[s.shot];
    if (!shot) { warn(s.id, 'unknown shot ' + s.shot); return errSlide(s, 'Немає скріну «' + s.shot + '»'); }
    var sz = ctx.sizes[shot.file] || { w: 1456, h: 819 };
    var nw = sz.w, nh = sz.h, aspect = nw / nh;
    var keys = (Array.isArray(s.spot) ? s.spot : (s.spot ? [s.spot] : [])).slice(0, 3);
    var tg = keys.map(function (key) { var t = shot.targets && shot.targets[key]; if (!t) warn(s.id, 'unknown target ' + key + ' in ' + s.shot); return t; }).filter(Boolean);
    if (!tg.length) warn(s.id, 'no valid spotlight targets');
    var pad0 = s.pad != null ? +s.pad : 12;
    var pos = s.cardPos || 'auto';
    var dim = s.dim != null ? +s.dim : DIM;
    n._spot = { file: shot.file, nw: nw, nh: nh, tg: tg, keys: keys, alt: shot.desc || '' };
    var mcx = tg.length ? tg.reduce(function (a, t) { return a + t[0] + t[2] / 2; }, 0) / tg.length : .5;
    // union of targets in native px
    var U = tg.length ? union(tg.map(function (t) { return { x: t[0] * nw, y: t[1] * nh, w: t[2] * nw, h: t[3] * nh }; })) : { x: nw / 2, y: nh / 2, w: 1, h: 1 };

    // ---- card content
    var sec = ctx.sec || { num: '', title: '' };
    var dots = ''; for (var d = 1; d <= (s._m || 1); d++) dots += '<i class="' + (d === s._k ? 'on' : d < s._k ? 'past' : '') + '"></i>';
    var single = (s._m || 1) <= 1;   // a part with one step: no «Крок 1 з 1», no dots
    var kick = '<div class="kicker"><span class="chip"></span>Частина ' + esc(sec.num) + (single ? '' : ' · Крок ' + (s._k || 1) + ' <span class="lc">з</span> ' + (s._m || 1)) + '</div>';
    var title = '<h2>' + rich(s.title) + '</h2>';
    var body = s.body ? '<div class="body">' + rich(s.body) + '</div>' : '';
    var foot = single ? '' : '<div class="cfoot"><div class="dots">' + dots + '</div></div>';
    var STD = kick + title + body + actionHTML(s) + tipHTML(s) + foot;
    var WIDE = '<div class="colA">' + kick + title + foot + '</div><div class="colB">' + body + actionHTML(s) + tipHTML(s) + '</div>';
    var card = el('div', 'card');
    n.appendChild(card);
    // fixed footer band: part chip (left) + page counter (right), never over the screen
    n.insertAdjacentHTML('beforeend', '<div class="band"></div>' + footStatic(ctx));

    /* ---------- geometry ---------- */
    function holesFor(view, img, S) {
      // view: visible rect (slide px); img: full image rect (slide px, may exceed view)
      var lim = { x: view.x + RING + 3, y: view.y + RING + 3, w: view.w - 2 * (RING + 3), h: view.h - 2 * (RING + 3) };
      // targets that overlap in the data (e.g. two stacked groups) are split at the middle of their overlap
      var T = tg.map(function (t) { return { x: img.x + t[0] * img.w, y: img.y + t[1] * img.h, w: t[2] * img.w, h: t[3] * img.h }; });
      for (var a = 0; a < T.length; a++) for (var b = a + 1; b < T.length; b++) {
        var A = T[a], Bq = T[b], ow = Math.min(A.x + A.w, Bq.x + Bq.w) - Math.max(A.x, Bq.x), oh = Math.min(A.y + A.h, Bq.y + Bq.h) - Math.max(A.y, Bq.y);
        if (ow <= 0 || oh <= 0) continue;
        var top = A.y <= Bq.y ? A : Bq, bot = top === A ? Bq : A, lef = A.x <= Bq.x ? A : Bq, rig = lef === A ? Bq : A;
        if (oh <= ow) { var my = Math.max(top.y, bot.y) + oh / 2 - 14; top.h = my - top.y; var nb = my + 28; bot.h = bot.y + bot.h - nb; bot.y = nb; }
        else { var mx = Math.max(lef.x, rig.x) + ow / 2 - 14; lef.w = mx - lef.x; var nr = mx + 28; rig.w = rig.x + rig.w - nr; rig.x = nr; }
      }
      function mk(pad) {
        return T.map(function (r) {
          var x = r.x - pad, y = r.y - pad, w = r.w + 2 * pad, h = r.h + 2 * pad;
          var x1 = Math.max(x, lim.x), y1 = Math.max(y, lim.y), x2 = Math.min(x + w, lim.x + lim.w), y2 = Math.min(y + h, lim.y + lim.h);
          return { x: x1, y: y1, w: Math.max(8, x2 - x1), h: Math.max(8, y2 - y1) };
        });
      }
      // shrink padding until neighbouring rings stop touching each other
      var pad = pad0, holes = mk(pad);
      function clash(hs) { for (var i = 0; i < hs.length; i++) for (var j = i + 1; j < hs.length; j++) if (hit(inflate(hs[i], RING + 3), inflate(hs[j], RING + 3))) return true; return false; }
      while (clash(holes) && pad > 2) { pad -= 2; holes = mk(pad); }
      var raw = T;
      // optional s.avoid: other targets of the shot that number markers must not cover
      var avoid = (s.avoid || []).map(function (k) { return shot.targets && shot.targets[k]; }).filter(Boolean)
        .map(function (t) { return { x: img.x + t[0] * img.w, y: img.y + t[1] * img.h, w: t[2] * img.w, h: t[3] * img.h }; });
      return { holes: holes, raw: raw, avoid: avoid, rings: holes.map(function (h) { return inflate(h, RING + 2); }) };
    }
    function camera(view, iw, ih, fx, fy) {   // place image so native point U-centre lands at (fx, fy), image always covering the view
      var ucx = (U.x + U.w / 2) / nw * iw, ucy = (U.y + U.h / 2) / nh * ih;
      var x = iw <= view.w ? view.x + (view.w - iw) / 2 : clamp(fx - ucx, view.x + view.w - iw, view.x);
      var y = ih <= view.h ? view.y + (view.h - ih) / 2 : clamp(fy - ucy, view.y + view.h - ih, view.y);
      return { x: x, y: y, w: iw, h: ih };
    }
    function geomFull(S, hint, vy) {
      var view = { x: 0, y: 0, w: W, h: FH };
      var iw = nw * S, ih = nh * S;
      var fx = hint === 'left' ? (W + 780) / 2 : hint === 'right' ? (W - 780) / 2 : W / 2;
      var fy = vy === 't' ? 1e5 : vy === 'b' ? -1e5 : FH / 2;
      var img = camera(view, iw, ih, fx, fy);
      var g = holesFor(view, img, S); g.mode = 'full'; g.view = view; g.img = img; g.S = S; g.radius = 0;
      return g;
    }
    function geomSide(mode, S) {
      var side = (pos === 'left' || pos === 'right') ? pos : (mcx >= .5 ? 'right' : 'left');   // side of the CARD
      var view, img;
      if (mode === 'side') {
        // tall / square screen: framed like the inset one, screen + card centred as one group
        var colMax = W - (CW + 80 + 48);
        var iw = nw * S, ih = nh * S, cw = Math.min(iw, colMax);
        var gx = Math.max(24, (W - (cw + 80 + CW)) / 2);
        view = { x: side === 'right' ? gx : gx + CW + 80, y: 0, w: cw, h: Math.min(ih, FH - 48) };
        view.y = (FH - view.h) / 2;
        img = camera(view, iw, ih, view.x + view.w / 2, view.y + view.h / 2);
      } else {
        // framed screen beside the card; zoomed in (cropped) on the target when that keeps it <= 60 % of the slide
        var w2 = Math.round(W * .62), Sfit2 = w2 / nw;
        var Sz = Math.max(Sfit2, Math.min(2.4, S || 0));
        var iw2 = nw * Sz, ih2 = nh * Sz, h2 = Math.min(ih2, FH - 2 * GUT);
        if (Sz === Sfit2 && ih2 > FH - 2 * GUT) { h2 = FH - 2 * GUT; w2 = h2 * nw / nh; iw2 = w2; ih2 = h2; Sz = w2 / nw; }
        var gx2 = Math.max(24, (W - (w2 + 56 + CW)) / 2);
        view = { x: side === 'right' ? gx2 : gx2 + CW + 56, y: (FH - h2) / 2, w: w2, h: h2 };
        img = camera(view, iw2, ih2, view.x + view.w / 2, view.y + view.h / 2); S = Sz;
      }
      var g = holesFor(view, img, S); g.mode = mode; g.view = view; g.img = img; g.side = side; g.S = S;
      g.radius = 16;   // side and inset share one framed look
      g.fx = side === 'right' ? view.x + view.w : 0; g.fw = side === 'right' ? W - g.fx : view.x;
      return g;
    }
    function visibleOK(g) {   // every target fully inside the view (with a little air)
      var v = g.view, im = g.img;   // a target touching the screenshot's own edge is fine when that edge is shown
      return g.raw.every(function (r) {
        return (r.x >= v.x + 6 || im.x >= v.x - .5) && (r.y >= v.y + 6 || im.y >= v.y - .5) &&
               (r.x + r.w <= v.x + v.w - 6 || im.x + im.w <= v.x + v.w + .5) && (r.y + r.h <= v.y + v.h - 6 || im.y + im.h <= v.y + v.h + .5);
      })
        || g.S <= Math.max(W / nw, FH / nh) + .001;
    }

    function draw(G) {
      var v = G.view, img = G.img;
      var wrap = el('div', 'viewport' + (G.radius ? ' inset' : ''));
      wrap.style.cssText = 'left:' + v.x + 'px;top:' + v.y + 'px;width:' + v.w + 'px;height:' + v.h + 'px';
      var im = el('img', 'shot'); im.src = shot.file; im.alt = '';
      im.style.cssText = 'left:' + (img.x - v.x) + 'px;top:' + (img.y - v.y) + 'px;width:' + img.w + 'px;height:' + img.h + 'px';
      wrap.appendChild(im);
      var cut = G.holes.map(function (h) { return { x: h.x, y: h.y, w: h.w, h: h.h }; });
      for (var i = 0; i < cut.length; i++) for (var j = i + 1; j < cut.length; j++) {
        if (hit(inflate(cut[i], 2), cut[j])) { cut[i] = union([cut[i], cut[j]]); cut.splice(j, 1); i = -1; break; }
      }
      var dPath = (G.radius ? rr(v, G.radius) : 'M' + v.x + ' ' + v.y + 'H' + (v.x + v.w) + 'V' + (v.y + v.h) + 'H' + v.x + 'Z') + cut.map(function (h) { return rr(h, 12); }).join('');
      var edge = '';
      if (G.radius) edge = '<path d="' + rr(inflate(v, .5), G.radius + .5) + '" fill="none" stroke="#D7B369" stroke-opacity=".4" stroke-width="1"/>';
      if (false) { var ex = G.side === 'right' ? v.x + v.w : v.x; edge = '<line x1="' + ex + '" y1="' + v.y + '" x2="' + ex + '" y2="' + (v.y + v.h) + '" stroke="#D7B369" stroke-opacity=".4" stroke-width="1"/>'; }
      // rings: the faint halo is clipped to the view so it never runs off the screen edge
      var cid = 'v' + ctx.i;
      var svg = '<svg class="ov" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="' + cid + '"><rect x="' + v.x + '" y="' + v.y + '" width="' + v.w + '" height="' + v.h + '"/></clipPath></defs>' +
        '<path class="dim" d="' + dPath + '" fill="rgb(11,15,6)" fill-opacity="' + dim + '" fill-rule="evenodd"/>' + edge +
        '<g clip-path="url(#' + cid + ')">' + G.holes.map(function (h) {
          return '<rect x="' + (h.x - HALO) + '" y="' + (h.y - HALO) + '" width="' + (h.w + 2 * HALO) + '" height="' + (h.h + 2 * HALO) + '" rx="' + (12 + HALO) + '" class="halo" fill="none" stroke="#D7B369" stroke-opacity=".3" stroke-width="1.5"/>';
        }).join('') + '</g>' +
        G.holes.map(function (h) {
          var small = h.w * h.h < 260 * 90, o3 = HALO + 9;
          return (small ? '<rect x="' + (h.x - o3) + '" y="' + (h.y - o3) + '" width="' + (h.w + 2 * o3) + '" height="' + (h.h + 2 * o3) + '" rx="' + (12 + o3) + '" class="halo" fill="none" stroke="#D7B369" stroke-opacity=".2" stroke-width="2" clip-path="url(#' + cid + ')"/>' : '') +
            '<rect x="' + (h.x - RING) + '" y="' + (h.y - RING) + '" width="' + (h.w + 2 * RING) + '" height="' + (h.h + 2 * RING) + '" rx="' + (12 + RING) + '" class="ring" fill="none" stroke="#EBCF94" stroke-width="' + (small ? 4 : 3) + '"/>' +
            (small ? '' : '');
        }).join('') + '<g class="lead"></g></svg>';
      n.insertBefore(wrap, card);
      card.insertAdjacentHTML('beforebegin', svg);
    }

    n._layout = function () {
      var cache = {};
      function apply(wd, variant) {
        card.className = 'card' + (variant === 'wide' ? ' wide' : '');
        card.innerHTML = variant === 'wide' ? WIDE : STD;
        card.style.width = wd + 'px';
      }
      function measure(wd, variant) {
        var key = variant + wd; if (cache[key]) return cache[key];
        apply(wd, variant);
        return (cache[key] = card.offsetHeight);
      }
      var B0 = { x: 56, y: 48, w: W - 112, h: FH - 48 - 32 };   // card bounds inside the frame

      function placeSide(G) {
        var cw = CW, ch = measure(cw, 'std');
        var Bu = G.rings.length ? union(G.rings) : { x: 0, y: FH / 2, w: 0, h: 0 };
        var y = clamp(Bu.y + Bu.h / 2 - ch / 2, B0.y, B0.y + B0.h - ch);
        if (ch > B0.h) y = (FH - ch) / 2;
        var gap = G.mode === 'inset' ? 56 : 80;   // room for the connector / a number marker
        var cx = G.side === 'right' ? G.view.x + G.view.w + gap : G.view.x - gap - cw;
        cx = clamp(cx, 24, W - 24 - cw);
        return { x: cx, y: y, w: cw, h: ch, v: 'std', side: G.side };
      }

      function placeFull(G, scan) {
        var avoid = G.rings.map(function (r) { return inflate(r, G.rings.length > 1 ? 72 : 30); });
        var bounds = B0;
        function inside(r) { return r.x >= bounds.x - .5 && r.y >= bounds.y - .5 && r.x + r.w <= bounds.x + bounds.w + .5 && r.y + r.h <= bounds.y + bounds.h + .5; }
        function free(r) { return inside(r) && !avoid.some(function (a) { return hit(a, r); }); }
        if (!avoid.length) { var h0 = measure(CW, 'std'); return { x: (W - CW) / 2, y: (FH - h0) / 2, w: CW, h: h0, v: 'std', side: 'center' }; }
        var B2 = union(avoid);
        var space = { right: bounds.x + bounds.w - (B2.x + B2.w), left: B2.x - bounds.x, below: bounds.y + bounds.h - (B2.y + B2.h), above: B2.y - bounds.y };
        var order = ['right', 'left', 'below', 'above'].sort(function (a, b) {
          function sc(k) { return (k === 'left' || k === 'right') ? space[k] / 680 : space[k] / 420; }
          return sc(b) - sc(a);
        });
        var map = { left: 'left', right: 'right', top: 'above', bottom: 'below' };
        if (map[pos]) order = [map[pos]].concat(order.filter(function (o) { return o !== map[pos]; }));
        function tryAt(anchor, sd) {
          var opts = [[CW, 'std']];
          var cx = anchor.x + anchor.w / 2, cy = anchor.y + anchor.h / 2;
          for (var j = 0; j < opts.length; j++) {
            var wd = Math.min(opts[j][0], bounds.w), hh = measure(wd, opts[j][1]), r;
            if (sd === 'right') r = { x: anchor.x + anchor.w, y: clamp(cy - hh / 2, bounds.y, bounds.y + bounds.h - hh) };
            if (sd === 'left') r = { x: anchor.x - wd, y: clamp(cy - hh / 2, bounds.y, bounds.y + bounds.h - hh) };
            if (sd === 'below') r = { x: clamp(cx - wd / 2, bounds.x, bounds.x + bounds.w - wd), y: anchor.y + anchor.h };
            if (sd === 'above') r = { x: clamp(cx - wd / 2, bounds.x, bounds.x + bounds.w - wd), y: anchor.y - hh };
            r.w = wd; r.h = hh; r.v = opts[j][1]; r.side = sd;
            if (free(r)) return r;
            // slide along the target only while the card still faces it (stays adjacent)
            if (sd === 'left' || sd === 'right') {
              for (var yy = Math.max(bounds.y, anchor.y - hh + 60); yy <= Math.min(bounds.y + bounds.h - hh, anchor.y + anchor.h - 60); yy += 12) { var r2 = { x: r.x, y: yy, w: wd, h: hh, v: r.v, side: sd }; if (free(r2)) return r2; }
            } else {
              for (var xx = Math.max(bounds.x, anchor.x - wd + 80); xx <= Math.min(bounds.x + bounds.w - wd, anchor.x + anchor.w - 80); xx += 12) { var r3 = { x: xx, y: r.y, w: wd, h: hh, v: r.v, side: sd }; if (free(r3)) return r3; }
            }
          }
          return null;
        }
        var chosen = null;
        if (pos === 'center') { var hc = measure(CW, 'std'); chosen = { x: (W - CW) / 2, y: (FH - hc) / 2, w: CW, h: hc, v: 'std', side: 'center' }; }
        for (var oi = 0; !chosen && oi < order.length; oi++) chosen = tryAt(B2, order[oi]);
        for (var hi = 0; !chosen && hi < avoid.length; hi++) for (var oj = 0; !chosen && oj < order.length; oj++) chosen = tryAt(avoid[hi], order[oj]);
        if (!chosen && scan && false) {   // no free-floating cards: adjacent placement or a different framing
          var best = null, bc = { x: B2.x + B2.w / 2, y: B2.y + B2.h / 2 };
          [[680, 'std'], [560, 'std'], [1180, 'wide'], [1640, 'wide']].forEach(function (o) {
            var hh = measure(o[0], o[1]);
            for (var y2 = bounds.y; y2 <= bounds.y + bounds.h - hh; y2 += 16) for (var x2 = bounds.x; x2 <= bounds.x + bounds.w - o[0]; x2 += 16) {
              var r = { x: x2, y: y2, w: o[0], h: hh, v: o[1], side: 'free' };
              if (!free(r)) continue;
              var dd = Math.hypot(x2 + o[0] / 2 - bc.x, y2 + hh / 2 - bc.y);
              if (!best || dd < best.d) { best = r; best.d = dd; }
            }
          });
          chosen = best;
        }
        return chosen;
      }

      /* choose mode + magnification: largest zoom (≤ SMAX) at which the card still fits beside the targets */
      var G = null, chosen = null;
      var Sfit = Math.max(W / nw, FH / nh);
      if (aspect >= 1.6 && s.layout !== 'inset') {
        // legibility: each hole >= ~160x60 px (target + padding), never past 2.4x native pixels;
        // a huge target stays <= 60 % of the frame (beyond that: smaller screen beside the card)
        var Sneed = tg.reduce(function (a, t) { return Math.max(a, Math.max(136 / Math.max(1, t[2] * nw), 36 / Math.max(1, t[3] * nh))); }, 0);
        var Scap = Math.min(.6 * W / Math.max(1, U.w), .6 * FH / Math.max(1, U.h));
        var Shi = s.zoom ? Math.max(Sfit, s.zoom * Sfit) : Math.max(Sfit, Math.min(2.4, Math.max(SMAX, Sneed), Scap));
        var huge = !s.zoom && tg.some(function (t) { return t[2] * nw * Sfit > .68 * W || t[3] * nh * Sfit > .68 * FH; });
        var hints = mcx >= .5 ? ['left', 'right', 'c'] : ['right', 'left', 'c'];
        var vys = ['c', 't', 'b'];
        for (var S = Shi; !huge && !chosen && S >= Sfit - .001; S = (S - .08 < Sfit && S > Sfit + .001) ? Sfit : S - .08) {
          for (var hk = 0; hk < hints.length && !chosen; hk++) for (var vk = 0; vk < vys.length && !chosen; vk++) {
            var g = geomFull(S, hints[hk], vys[vk]);
            if (!visibleOK(g)) continue;
            var c = placeFull(g, S <= Sfit + .001 && vk === 0);
            if (c) { G = g; chosen = c; }
          }
          if (s.zoom && !chosen && S <= Sfit + .001) break;
        }
        if (!chosen) { G = geomSide('inset', Math.min(.6 * W / Math.max(1, U.w), .6 * FH / Math.max(1, U.h))); chosen = placeSide(G); }   // big targets: framed screen beside the card
      } else if (aspect >= 1.6) {
        G = geomSide('inset', Math.min(.6 * W / Math.max(1, U.w), .6 * FH / Math.max(1, U.h))); chosen = placeSide(G);
      } else {
        // tall / square shot: column; zoom while the targets still fit the column
        var S0 = FH / nh, Sbest = S0, colMax = W - (CW + 80 + 48);
        var SneedC = tg.reduce(function (a, t) { return Math.max(a, Math.max(136 / Math.max(1, t[2] * nw), 36 / Math.max(1, t[3] * nh))); }, 0);
        for (var S2 = Math.max(S0, Math.min(2.4, Math.max(SMAX, SneedC))); S2 > S0; S2 -= .05) {
          if (U.w * S2 <= Math.min(nw * S2, colMax) - 120 && U.h * S2 <= FH - 160) { Sbest = S2; break; }
        }
        if (s.zoom) Sbest = Math.max(S0, Math.min(Sbest, S0 * s.zoom));
        G = geomSide('side', Sbest); chosen = placeSide(G);
      }
      draw(G);
      var rings = G.rings, holes = G.holes;
      n.setAttribute('data-layout', G.mode + ' ×' + (G.S || 0).toFixed(2));

      apply(chosen.w, chosen.v);
      card.style.left = Math.round(chosen.x) + 'px'; card.style.top = Math.round(chosen.y) + 'px';
      if (card.offsetHeight > FH - 40) warn(s.id, 'card taller than the screen area (' + card.offsetHeight + 'px) - shorten text');
      var cb = card.getBoundingClientRect(), sb = n.getBoundingClientRect(), zf = sb.width / W || 1;
      if ((cb.bottom - sb.top) / zf > FH + .5 || (cb.right - sb.left) / zf > W + .5 || cb.top < sb.top - .5 || cb.left < sb.left - .5)
        warn(s.id, 'card is clipped by the footer band or slide edge - shorten text');
      var C = { x: chosen.x, y: chosen.y, w: chosen.w, h: card.offsetHeight };
      n._geom = { mode: G.mode, view: G.view, img: G.img, holes: holes, raw: G.raw, card: C, S: G.S, side: G.side || null, radius: G.radius || 0 };   // used by the web viewer
      rings.forEach(function (r) { if (overlapArea(r, C) > 0) warn(s.id, 'card overlaps a spotlight'); });
      if (G.mode === 'full' && pos !== 'auto' && pos !== 'center') {
        var want = { left: 'left', right: 'right', top: 'above', bottom: 'below' }[pos];
        if (want && chosen.side !== want) warn(s.id, 'cardPos=' + pos + ' did not fit, used ' + chosen.side);
      }

      // ---- connector from the card to the nearest target (always)
      if (rings.length >= 1) {
        var ccx = C.x + C.w / 2, ccy = C.y + C.h / 2, near = 0, nd = Infinity;
        holes.forEach(function (h, hi2) { var d2 = Math.hypot(h.x + h.w / 2 - ccx, h.y + h.h / 2 - ccy); if (d2 < nd) { nd = d2; near = hi2; } });
        var gl = n.querySelector('g.lead'), R0 = inflate(holes[near], RING), pts = null;
        var rcx = R0.x + R0.w / 2, rcy = R0.y + R0.h / 2;
        if (C.x >= R0.x + R0.w && rcy > C.y + 28 && rcy < C.y + C.h - 28) pts = [[C.x, rcy], [R0.x + R0.w, rcy]];
        else if (C.x + C.w <= R0.x && rcy > C.y + 28 && rcy < C.y + C.h - 28) pts = [[C.x + C.w, rcy], [R0.x, rcy]];
        else if (C.y >= R0.y + R0.h && rcx > C.x + 28 && rcx < C.x + C.w - 28) pts = [[rcx, C.y], [rcx, R0.y + R0.h]];
        else if (C.y + C.h <= R0.y && rcx > C.x + 28 && rcx < C.x + C.w - 28) pts = [[rcx, C.y + C.h], [rcx, R0.y]];
        else if (C.x >= R0.x + R0.w || C.x + C.w <= R0.x) {
          var right = C.x >= R0.x + R0.w, ex2 = right ? C.x + 64 : C.x + C.w - 64, sx = right ? R0.x + R0.w : R0.x;
          if (rcy < C.y) pts = [[ex2, C.y], [ex2, rcy], [sx, rcy]];
          else if (rcy > C.y + C.h) pts = [[ex2, C.y + C.h], [ex2, rcy], [sx, rcy]];
        }
        if (pts) {
          var len = 0; for (var pi = 1; pi < pts.length; pi++) len += Math.abs(pts[pi][0] - pts[pi - 1][0]) + Math.abs(pts[pi][1] - pts[pi - 1][1]);
          var end = pts[pts.length - 1];
          if (len >= 30) gl.innerHTML = '<polyline points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" fill="none" stroke="#D7B369" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="6" fill="#D7B369"/>';
        }
      }

      // ---- numbered markers (2–3 targets): always OUTSIDE the ring, on the freest side
      var placed = [];
      if (rings.length > 1) {
        var view = G.view, D = 50, h2 = D / 2, gap = h2 + HALO + 4, cg = 5;
        rings.forEach(function (rg, idx) {
          var R0 = inflate(holes[idx], RING);
          var cand = [];
          if (G.mode !== 'full') {   // in the gutter between screen and card, joined to the ring by a short line
            var gx = G.side === 'right' ? view.x + view.w + 14 + h2 : view.x - 14 - h2;
            cand.push(['g', gx, R0.y + R0.h / 2]);
          }
          cand = cand.concat([
            // corner badge: sits on the ring corner, inner part only over the empty padding
            ['tl', R0.x - cg, R0.y - cg], ['tr', R0.x + R0.w + cg, R0.y - cg], ['bl', R0.x - cg, R0.y + R0.h + cg], ['br', R0.x + R0.w + cg, R0.y + R0.h + cg],
            ['l', R0.x - gap, R0.y + R0.h / 2], ['r', R0.x + R0.w + gap, R0.y + R0.h / 2],
            ['t', R0.x + R0.w / 2, R0.y - gap], ['b', R0.x + R0.w / 2, R0.y + R0.h + gap],
            ['l', R0.x - gap, R0.y + h2 + 4], ['r', R0.x + R0.w + gap, R0.y + h2 + 4],
            ['tl', R0.x - gap * .72, R0.y - gap * .72], ['tr', R0.x + R0.w + gap * .72, R0.y - gap * .72],
            ['bl', R0.x - gap * .72, R0.y + R0.h + gap * .72], ['br', R0.x + R0.w + gap * .72, R0.y + R0.h + gap * .72]
          ]);
          var best = null;
          cand.forEach(function (c, ci) {
            var mr = { x: c[1] - h2, y: c[2] - h2, w: D, h: D };
            var cost = ci;
            if (c[0] === 'g') {   // the joining line must not cross another target
              var ly = c[2], lx1 = Math.min(c[1], R0.x + R0.w), lx2 = Math.max(c[1], R0.x);
              var line = { x: Math.min(c[1], R0.x + R0.w / 2), y: ly - 2, w: Math.abs(c[1] - (R0.x + R0.w / 2)), h: 4 };
              G.holes.forEach(function (o, j) { if (j !== idx && hit(inflate(o, RING), line)) cost += 3000; });
              c.line = G.side === 'right' ? [R0.x + R0.w, ly, c[1] - h2, ly] : [c[1] + h2, ly, R0.x, ly];
            } else if (G.mode !== 'full') cost += overlapArea(G.view, mr) * .4;   // prefer the free area over the screen
            if (mr.x < 10 || mr.y < 10 || mr.x + D > W - 10 || mr.y + D > FH - 10) cost += 5000;   // never clipped by the slide edge or footer band
            cost += overlapArea(inflate(C, 10), mr) * 20;
            G.holes.forEach(function (o, j) { if (j !== idx) cost += overlapArea(inflate(o, RING + 3), mr) * 10; });
            G.raw.forEach(function (o) { cost += overlapArea(o, mr) * 10; });   // never on target content (own included)
            (G.avoid || []).forEach(function (o) { cost += overlapArea(inflate(o, 6), mr) * 10; });   // nor on buttons the slide asks to keep clear
            placed.forEach(function (p) { cost += overlapArea(inflate(p, 8), mr) * 20; });
            if (!best || cost < best.cost) { best = mr; best.cost = cost; best.line = c.line || null; }
          });
          // graceful fallback: least-bad spot is always used; warn only if it lands on target text or the card
          var bad = overlapArea(inflate(C, 4), best) + G.raw.reduce(function (a, o) { return a + overlapArea(o, best); }, 0);
          if (bad > 300) warn(s.id, 'marker ' + (idx + 1) + ' overlaps a target or the card');
          placed.push(best);
          if (best.line && best.line[2] - best.line[0] > 4) {
            n.querySelector('g.lead').insertAdjacentHTML('beforeend', '<line x1="' + best.line[0] + '" y1="' + best.line[1] + '" x2="' + best.line[2] + '" y2="' + best.line[3] + '" stroke="#D7B369" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>');
          }
          var mk = el('div', 'marker', String(idx + 1)); mk.style.left = best.x + 'px'; mk.style.top = best.y + 'px';
          n.appendChild(mk);
        });
      }
    };
    return n;
  };
})();
