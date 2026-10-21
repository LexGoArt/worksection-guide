/* ГК «Доброград» · Worksection guide · interactive viewer
   Renders the same slides as the PDF (js/render.js) and shows them one at a time.
   Desktop / landscape tablet: the 1920×1080 stage scaled to fit, spotlight glides between steps on the same screen.
   Phone / portrait: cropped screenshot with the spotlight on top, the card as readable text below.          */
(function () {
  'use strict';
  var W = 1920, H = 1080;
  var KEY = 'dg-ws-guide-pos-v2';
  var DUR = 420;

  var app = document.getElementById('app');
  var view = document.getElementById('view');
  var deck = document.getElementById('deck');
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var countEl = document.getElementById('count');
  var fill = document.getElementById('progressFill');
  var live = document.getElementById('live');
  var toc = document.getElementById('toc'), tocBack = document.getElementById('tocBack'), tocList = document.getElementById('tocList');
  var resume = document.getElementById('resume');

  var nodes = [], slides = [], cur = -1, total = 0, wide = true, anim = null, lastFocus = null;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function store(v) {
    try { if (v == null) return window.localStorage.getItem(KEY); window.localStorage.setItem(KEY, String(v)); } catch (e) {}
    return null;
  }
  function plain(h) { var d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sectionOf(i) {
    var s = slides[i], secs = (window.STORY.sections || []);
    for (var k = 0; k < secs.length; k++) if (secs[k].id === s.section) return secs[k];
    return null;
  }
  function titleOf(i) {
    var s = slides[i];
    if (s.kind === 'cover') return plain(s.title || (window.STORY.meta || {}).title || 'Обкладинка');
    return plain(s.title || '');
  }

  /* ---------------- boot ---------------- */
  DGRender.run(deck).then(function (built) {
    if (!built) return;
    nodes = built.map(function (b) { return b.node; });
    slides = built.map(function (b) { return b.s; });
    total = nodes.length;
    nodes.forEach(function (n, i) {
      var vi = n.querySelector('.viewport img');
      if (vi && n._spot) vi.alt = 'Знімок екрана Worksection: ' + (n._spot.alt || titleOf(i));
      if (n._spot) n.insertBefore(mobileShot(n), n.firstChild);
      n.setAttribute('aria-hidden', 'true');
      n.setAttribute('aria-label', 'Крок ' + (i + 1) + ' з ' + total + ': ' + titleOf(i));
    });
    buildToc();
    layoutMode();
    var start = fromHash();
    var saved = parseInt(store() || '', 10);
    show(start != null ? start : 0, { instant: true, fromHash: start != null });
    if (start == null && saved > 0 && saved < total) offerResume(saved);
    app.classList.add('ready');
    window.addEventListener('resize', layoutMode);
    window.addEventListener('hashchange', function () { var h = fromHash(); if (h != null && h !== cur) go(h); });
  });

  /* ---------------- hash ---------------- */
  function fromHash() {
    var m = /^#s(\d+)$/.exec(location.hash || '');
    if (!m) return null;
    var n = parseInt(m[1], 10) - 1;
    return n >= 0 && n < total ? n : null;
  }
  function setHash(i) {
    var h = '#s' + (i + 1);
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { try { location.hash = h; } catch (e2) {} }
  }

  /* ---------------- layout mode ---------------- */
  function layoutMode() {
    var w = window.innerWidth, h = window.innerHeight;
    var isWide = w >= 900 && w > h;
    if (isWide !== wide || !app.classList.contains('mode-set')) {
      wide = isWide;
      app.classList.toggle('is-m', !wide);
      app.classList.add('mode-set');
    }
    fit();
  }
  function fit() {
    if (!wide) { deck.style.transform = ''; return; }
    var vw = view.clientWidth, vh = view.clientHeight;
    var k = Math.min(vw / W, vh / H);
    var x = (vw - W * k) / 2, y = (vh - H * k) / 2;
    deck.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
  }

  /* ---------------- navigation ---------------- */
  function go(j, opts) {
    j = Math.max(0, Math.min(total - 1, j));
    if (j === cur) return;
    hideResume();
    show(j, opts || {});
  }
  function show(j, opts) {
    var from = cur;
    if (anim) anim.finish();
    cur = j;
    var A = from >= 0 ? nodes[from] : null, B = nodes[j];
    var instant = opts.instant || reduce || !wide || !A;
    if (A && !instant && canGlide(A, B)) glide(A, B);
    else {
      if (instant) { B.classList.add('instant'); if (A) A.classList.add('instant'); }
      if (A) { A.classList.remove('on'); A.setAttribute('aria-hidden', 'true'); }
      B.classList.add('on');
      if (instant) { void B.offsetWidth; B.classList.remove('instant'); if (A) A.classList.remove('instant'); }
    }
    B.setAttribute('aria-hidden', 'false');
    if (!wide) view.scrollTop = 0;
    updateUi();
    setHash(j);
    if (from >= 0 || opts.fromHash) store(j);   // opening the page on slide 1 must not erase saved progress
    if (from >= 0) live.textContent = 'Крок ' + (j + 1) + ' з ' + total + '. ' + titleOf(j);
  }
  function updateUi() {
    prevBtn.disabled = cur <= 0;
    nextBtn.disabled = cur >= total - 1;
    countEl.innerHTML = (cur + 1) + ' <span class="of">/ ' + total + '</span>';
    countEl.setAttribute('aria-label', 'Крок ' + (cur + 1) + ' з ' + total);
    fill.style.width = (total > 1 ? (cur / (total - 1)) * 100 : 100) + '%';
    var sec = sectionOf(cur);
    var color = sec ? DGRender.secColor(sec) : '#B8963F';
    document.querySelectorAll('[data-part]').forEach(function (p) {
      p.style.setProperty('--sec', color);
      p.querySelector('span').textContent = sec ? 'Частина ' + sec.num + ' · ' + sec.title : 'Правила роботи у Worksection';
    });
    tocList.querySelectorAll('button.it').forEach(function (b) {
      if (+b.dataset.i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    tocList.querySelectorAll('.grp').forEach(function (g) { g.classList.toggle('cur', g.dataset.sec === (slides[cur].section || '_start')); });
  }

  prevBtn.addEventListener('click', function () { go(cur - 1); });
  nextBtn.addEventListener('click', function () { go(cur + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (app.classList.contains('toc-open')) { if (e.key === 'Escape') closeToc(); return; }
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(total - 1); }
  });
  // swipe (touch only)
  var tx = null, ty = 0;
  view.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } else tx = null; }, { passive: true });
  view.addEventListener('touchend', function (e) {
    if (tx == null) return;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------------- resume banner ---------------- */
  function offerResume(i) {
    document.getElementById('resumeText').textContent = 'Продовжити з кроку ' + (i + 1) + '?';
    resume.hidden = false;
    document.getElementById('resumeYes').onclick = function () { hideResume(); go(i); };
    document.getElementById('resumeNo').onclick = function () { hideResume(); };
  }
  function hideResume() { resume.hidden = true; }

  /* ---------------- table of contents ---------------- */
  function buildToc() {
    var html = '', curSec = null, open = false;
    slides.forEach(function (s, i) {
      var key = s.section || '_start';
      if (key !== curSec) {
        if (open) html += '</div>';
        var sec = sectionOf(i), c = sec ? DGRender.secColor(sec) : '#B8963F';
        html += '<div class="grp" data-sec="' + esc(key) + '" style="--c:' + c + ';--ct:' + DGRender.textTone(c) + '"><div class="gh"><i></i>' +
          (sec ? 'Частина ' + esc(sec.num) + ' · ' + esc(sec.title) : 'Початок') + '</div>';
        curSec = key; open = true;
      }
      html += '<button class="it" type="button" data-i="' + i + '"><span class="no">' + (i + 1) + '</span><span>' + esc(titleOf(i)) + '</span></button>';
    });
    if (open) html += '</div>';
    tocList.innerHTML = html;
    tocList.addEventListener('click', function (e) {
      var b = e.target.closest('button.it'); if (!b) return;
      closeToc(); go(+b.dataset.i);
    });
    document.querySelectorAll('[data-toc]').forEach(function (b) { b.addEventListener('click', openToc); });
    document.getElementById('tocClose').addEventListener('click', closeToc);
    tocBack.addEventListener('click', closeToc);
    toc.addEventListener('keydown', function (e) {   // keep focus inside the dialog
      if (e.key !== 'Tab') return;
      var f = toc.querySelectorAll('button'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  function openToc() {
    lastFocus = document.activeElement;
    toc.hidden = false; tocBack.hidden = false;
    void toc.offsetWidth;
    app.classList.add('toc-open'); document.body.classList.add('toc-open');
    var curBtn = tocList.querySelector('button.it[aria-current="step"]') || tocList.querySelector('button.it');
    if (curBtn) { curBtn.scrollIntoView({ block: 'center' }); curBtn.focus({ preventScroll: true }); }
  }
  function closeToc() {
    app.classList.remove('toc-open'); document.body.classList.remove('toc-open');
    var done = function () { if (!document.body.classList.contains('toc-open')) { toc.hidden = true; tocBack.hidden = true; } };
    if (reduce) done(); else setTimeout(done, 330);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- phone: cropped screenshot with spotlight ---------------- */
  function mobileShot(n) {
    var sp = n._spot, nw = sp.nw, nh = sp.nh;
    var T = sp.tg.map(function (t) { return { x: t[0] * nw, y: t[1] * nh, w: t[2] * nw, h: t[3] * nh }; });
    var U = T.length ? T.reduce(function (a, r) {
      var x1 = Math.min(a.x, r.x), y1 = Math.min(a.y, r.y), x2 = Math.max(a.x + a.w, r.x + r.w), y2 = Math.max(a.y + a.h, r.y + r.h);
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }) : { x: 0, y: 0, w: nw, h: nh };
    // crop around the targets with breathing room, aspect between 0.85 and 1.6
    var m = Math.max(nw * .06, .35 * Math.max(U.w, U.h));
    var c = { x: U.x - m, y: U.y - m, w: U.w + 2 * m, h: U.h + 2 * m };
    var a = c.w / c.h;
    if (a < .85) { var nwc = c.h * .85; c.x -= (nwc - c.w) / 2; c.w = nwc; }
    if (a > 1.6) { var nhc = c.w / 1.6; c.y -= (nhc - c.h) / 2; c.h = nhc; }
    if (c.w > nw) { c.x = 0; c.w = nw; } if (c.h > nh) { c.y = 0; c.h = nh; }
    c.x = Math.max(0, Math.min(nw - c.w, c.x)); c.y = Math.max(0, Math.min(nh - c.h, c.y));
    var u = c.w / 100;   // 1 % of the crop width, in native px
    var pad = 1.4 * u, rx = 1.6 * u, ring = .9 * u;
    var holes = T.map(function (r) { return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }; });
    function rr(r, q) {
      q = Math.min(q, r.w / 2, r.h / 2);
      return 'M' + (r.x + q) + ' ' + r.y + 'H' + (r.x + r.w - q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + r.w) + ' ' + (r.y + q) + 'V' + (r.y + r.h - q) +
        'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + r.w - q) + ' ' + (r.y + r.h) + 'H' + (r.x + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + r.x + ' ' + (r.y + r.h - q) +
        'V' + (r.y + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + q) + ' ' + r.y + 'Z';
    }
    var d = 'M' + c.x + ' ' + c.y + 'h' + c.w + 'v' + c.h + 'h' + (-c.w) + 'Z' + holes.map(function (h) { return rr(h, rx); }).join('');
    var svg = '<svg viewBox="' + c.x + ' ' + c.y + ' ' + c.w + ' ' + c.h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" fill="rgb(11,15,6)" fill-opacity=".66" fill-rule="evenodd"/>' +
      holes.map(function (h) {
        var o = ring;
        return '<rect x="' + (h.x - o) + '" y="' + (h.y - o) + '" width="' + (h.w + 2 * o) + '" height="' + (h.h + 2 * o) + '" rx="' + (rx + o) + '" fill="none" stroke="#EBCF94" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
      }).join('');
    if (holes.length > 1) {
      var r = 3.6 * u;
      holes.forEach(function (h, i) {
        // badge on the outer top-left corner of the ring, kept inside the crop
        var cx = Math.max(c.x + r + u, Math.min(c.x + c.w - r - u, h.x - ring));
        var cy = Math.max(c.y + r + u, Math.min(c.y + c.h - r - u, h.y - ring));
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#D7B369" stroke="#1B2412" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
          '<text x="' + cx + '" y="' + (cy + r * .38) + '" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="' + (r * 1.1) + '" fill="#1B2412">' + (i + 1) + '</text>';
      });
    }
    svg += '</svg>';
    var box = document.createElement('div');
    box.className = 'mshot';
    box.style.aspectRatio = c.w + ' / ' + c.h;
    box.innerHTML = '<img src="' + sp.file + '" alt="' + esc('Знімок екрана Worksection: ' + (sp.alt || '')) + '" style="width:' + (nw / c.w * 100) + '%;left:' + (-c.x / c.w * 100) + '%;top:' + (-c.y / c.h * 100) + '%">' + svg;
    return box;
  }

  /* ---------------- desktop: the spotlight glides between steps on the same screen ---------------- */
  function canGlide(A, B) {
    var a = A._geom, b = B._geom;
    if (!a || !b || !A._spot || !B._spot || A._spot.file !== B._spot.file || a.mode !== b.mode) return false;
    var va = a.view, vb = b.view;
    return Math.abs(va.x - vb.x) < 1 && Math.abs(va.y - vb.y) < 1 && Math.abs(va.w - vb.w) < 1 && Math.abs(va.h - vb.h) < 1;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpR(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) }; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function rrect(r, q) {
    q = Math.max(0, Math.min(q, r.w / 2, r.h / 2));
    return 'M' + (r.x + q) + ' ' + r.y + 'H' + (r.x + r.w - q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + r.w) + ' ' + (r.y + q) + 'V' + (r.y + r.h - q) +
      'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + r.w - q) + ' ' + (r.y + r.h) + 'H' + (r.x + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + r.x + ' ' + (r.y + r.h - q) +
      'V' + (r.y + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (r.x + q) + ' ' + r.y + 'Z';
  }
  function glide(A, B) {
    var a = A._geom, b = B._geom, v = b.view;
    var img = B.querySelector('.viewport img'), card = B.querySelector('.card');
    var dimPath = B.querySelector('svg.ov path'), dim = dimPath ? dimPath.getAttribute('fill-opacity') : '.7';
    // where everything starts: the previous step's spotlight, screen position and card
    var fromHoles = b.holes.map(function (h, k) { return a.holes[Math.min(k, a.holes.length - 1)] || { x: h.x + h.w / 2, y: h.y + h.h / 2, w: 0, h: 0 }; });
    var ghost = A.querySelector('.card').cloneNode(true);
    ghost.classList.add('ghost'); ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
    ghost.style.pointerEvents = 'none';
    var tw = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tw.setAttribute('class', 'ov tween'); tw.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    B.insertBefore(tw, card);
    B.appendChild(ghost);
    B.classList.add('instant', 'tw', 'on'); A.classList.add('instant');
    A.classList.remove('on'); A.setAttribute('aria-hidden', 'true');
    void B.offsetWidth;
    B.classList.remove('instant'); A.classList.remove('instant');
    var dx = a.card.x - b.card.x, dy = a.card.y - b.card.y;
    var t0 = null, raf = 0, done = false;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR), e = ease(p);
      var r = lerpR(a.img, b.img, e);
      img.style.left = (r.x - v.x) + 'px'; img.style.top = (r.y - v.y) + 'px'; img.style.width = r.w + 'px'; img.style.height = r.h + 'px';
      var hs = b.holes.map(function (h, k) { return lerpR(fromHoles[k], h, e); });
      var outer = b.radius ? rrect(v, b.radius) : 'M' + v.x + ' ' + v.y + 'H' + (v.x + v.w) + 'V' + (v.y + v.h) + 'H' + v.x + 'Z';
      tw.innerHTML = '<path d="' + outer + hs.map(function (h) { return rrect(h, 12); }).join('') + '" fill="rgb(11,15,6)" fill-opacity="' + dim + '" fill-rule="evenodd"/>' +
        hs.map(function (h) { return '<rect x="' + (h.x - 5) + '" y="' + (h.y - 5) + '" width="' + (h.w + 10) + '" height="' + (h.h + 10) + '" rx="17" fill="none" stroke="#EBCF94" stroke-width="3"/>'; }).join('');
      card.style.transform = 'translate(' + dx * (1 - e) + 'px,' + dy * (1 - e) + 'px)';
      card.style.opacity = Math.min(1, e * 1.25);
      ghost.style.opacity = Math.max(0, 1 - p * 2.2);
      if (p < 1) raf = requestAnimationFrame(frame); else finish();
    }
    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      img.style.left = (b.img.x - v.x) + 'px'; img.style.top = (b.img.y - v.y) + 'px'; img.style.width = b.img.w + 'px'; img.style.height = b.img.h + 'px';
      card.style.transform = ''; card.style.opacity = '';
      if (tw.parentNode) tw.parentNode.removeChild(tw);
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      B.classList.remove('tw');
      anim = null;
    }
    anim = { finish: finish };
    raf = requestAnimationFrame(frame);
  }
})();
