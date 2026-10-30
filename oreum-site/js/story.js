/* oreum story — one screen.
   Wheel / swipe / keys / buttons move a virtual position P along the whole story (no page scroll).
   P is split into scenes by data-len; the active scene gets a local progress p (0 → 1). */
(function () {
  'use strict';

  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('story-root');

  /* ---------- stage scaling ---------- */
  function fitPhone() {
    var ph = $('#missionPhone'); if (!ph) return;
    var copy = ph.parentNode, lines = $('.lines', copy);
    ph.style.zoom = 1;
    var sc = copy.parentNode, cs = getComputedStyle(sc);
    var linesH = lines.offsetHeight;
    $$('.line', lines).forEach(function (l) { linesH = Math.max(linesH, l.offsetHeight); });
    lines.style.height = linesH + 'px';
    var avail = sc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - linesH + 2;
    ph.style.zoom = clamp(avail / ph.offsetHeight, .5, 1.35).toFixed(3);
  }
  function fitStages() {
    fitPhone();
    $$('.stage-wrap').forEach(function (wrap) {
      var s = Math.min(wrap.clientWidth / 960, wrap.clientHeight / 540);
      var st = wrap.querySelector('.stage');
      st.style.setProperty('--s', Math.max(0.2, s).toFixed(4));
      /* bleed: the drawing runs on past the stage to the screen's right and bottom edges
         (top and left stay at the stage box, so nothing behind the copy shows) */
      if (wrap.classList.contains('bleed')) {
        var r = st.getBoundingClientRect(), k = r.width / 960;   // on-screen px per stage unit (includes page zoom)
        var R = Math.max(0, (window.innerWidth - r.right) / k), Bt = Math.max(0, (window.innerHeight - r.bottom) / k);
        st.style.setProperty('--br', (R + 2).toFixed(1)); st.style.setProperty('--bb', (Bt + 2).toFixed(1));
      }
    });
  }

  /* ======================================================
     01 HOOK: dots gather → school → stadium → Jeju → 4.7만 spill over
     (canvas keeps animating while this scene is on screen)
     ====================================================== */
  var cv = $('#dots'), ctx = cv.getContext('2d'), hks = $$('.hk'), hookN = $('#hookN');
  var hookScene = $('.scene-hook');
  var MAXP = 7170;
  var W = 0, H = 0, hookStage = 0, stageAt = 0, R = 14, la = 0, hookShownAt = 0;
  var seedH = 11;
  function rndH() { seedH = (seedH * 16807) % 2147483647; return seedH / 2147483647; }
  var HOOK_FONT = '"Pretendard", "Noto Sans KR", sans-serif';

  var STAGES = [
    { n: 0, r: 14 },
    { n: 1, r: 14 },
    { n: 1000, r: 2.6, shape: 'school', label: '1,000명 · 한 학교 전교생', legend: '● 1개 = 1명' },
    { n: 2400, r: 1.9, shape: 'stadium', label: '2.4만 명 · 잠실야구장 가득', legend: '● 1개 = 10명' },
    { n: 6700, r: 1.35, shape: 'jeju', label: '67만 명 · 제주도 전체 인구', legend: '● 1개 = 100명' },
    { n: 7170, r: 1.35, shape: 'jeju', spill: true, label: '67만 명 · 제주도 전체 인구', legend: '● 1개 = 100명' },
    { n: 7170, r: 1.35, shape: 'jeju', spill: true, dim: true },
    { n: 1, r: 1.35, shape: 'jeju', leave: true }            // 점들이 흩어지고 준호만 창문으로 이동
  ];
  var LEAVE_AT = 0.9;
  function stageOf(p) { return p < 0.05 ? 0 : p < 0.17 ? 1 : p < 0.35 ? 2 : p < 0.57 ? 3 : p < 0.79 ? 4 : p < 0.85 ? 5 : p < LEAVE_AT ? 6 : 7; }
  var hookP = 0, leaveFrom = null;

  /* 제주 해안선 (지도에서 따라 그린 윤곽, y는 실제 비율에 맞게 눌러 줌) + 우도 */
  var JEJU = [[-0.95, 0.063], [-0.934, 0.032], [-0.893, 0.011], [-0.844, -0.01], [-0.811, -0.03], [-0.77, -0.047], [-0.738, -0.071], [-0.705, -0.106], [-0.689, -0.133], [-0.656, -0.154], [-0.615, -0.181], [-0.591, -0.208], [-0.55, -0.219], [-0.509, -0.229], [-0.46, -0.239], [-0.411, -0.247], [-0.362, -0.261], [-0.313, -0.274], [-0.264, -0.284], [-0.215, -0.298], [-0.183, -0.315], [-0.147, -0.328], [-0.109, -0.321], [-0.069, -0.324], [-0.028, -0.335], [0.021, -0.348], [0.07, -0.359], [0.119, -0.37], [0.16, -0.38], [0.201, -0.394], [0.217, -0.414], [0.258, -0.421], [0.307, -0.428], [0.364, -0.442], [0.429, -0.442], [0.486, -0.444], [0.552, -0.439], [0.617, -0.437], [0.666, -0.431], [0.699, -0.411], [0.731, -0.387], [0.772, -0.366], [0.805, -0.352], [0.846, -0.332], [0.87, -0.304], [0.862, -0.27], [0.881, -0.236], [0.908, -0.211], [0.927, -0.192], [0.952, -0.167], [0.957, -0.137], [0.927, -0.119], [0.895, -0.115], [0.875, -0.092], [0.875, -0.051], [0.859, -0.016], [0.837, 0.011], [0.805, 0.045], [0.772, 0.077], [0.735, 0.107], [0.712, 0.134], [0.682, 0.155], [0.633, 0.173], [0.576, 0.184], [0.519, 0.196], [0.454, 0.214], [0.397, 0.241], [0.331, 0.252], [0.266, 0.265], [0.209, 0.282], [0.152, 0.299], [0.095, 0.319], [0.038, 0.337], [-0.028, 0.348], [-0.093, 0.359], [-0.15, 0.367], [-0.207, 0.367], [-0.264, 0.359], [-0.313, 0.351], [-0.362, 0.348], [-0.42, 0.343], [-0.477, 0.337], [-0.534, 0.337], [-0.583, 0.347], [-0.624, 0.367], [-0.648, 0.395], [-0.659, 0.429], [-0.681, 0.447], [-0.705, 0.429], [-0.73, 0.398], [-0.757, 0.378], [-0.787, 0.356], [-0.819, 0.329], [-0.852, 0.299], [-0.881, 0.265], [-0.909, 0.23], [-0.93, 0.189], [-0.942, 0.148], [-0.947, 0.107]];
  var UDO = [[0.947, -0.339], [0.968, -0.352], [0.996, -0.348], [1.017, -0.329], [1.02, -0.304], [1.009, -0.284], [0.989, -0.269], [0.963, -0.271], [0.948, -0.291], [0.94, -0.315]];
  var UDO_C = UDO.reduce(function (a, q) { return [a[0] + q[0] / UDO.length, a[1] + q[1] / UDO.length]; }, [0, 0]);
  function nearUdo(x, y, k) { return inPoly(UDO_C[0] + (x - UDO_C[0]) / k, UDO_C[1] + (y - UDO_C[1]) / k, UDO); }
  function onJeju(x, y) { return inPoly(x, y, JEJU) || inPoly(x, y, UDO); }
  function inPoly(x, y, P, k) {
    k = k || 1;
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      var xi = P[i][0] * k, yi = P[i][1] * k, xj = P[j][0] * k, yj = P[j][1] * k;
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  var HOME = [0, .62];
  function segDist(px_, py_, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, t = clamp(((px_ - ax) * dx + (py_ - ay) * dy) / (dx * dx + dy * dy));
    return Math.hypot(px_ - ax - t * dx, py_ - ay - t * dy);
  }
  function fieldDist(x, y) {
    var dx = x - HOME[0], dy = y - HOME[1], r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (a <= -Math.PI / 4 && a >= -3 * Math.PI / 4) return r - 1;
    var c = Math.SQRT1_2;
    return Math.min(segDist(x, y, HOME[0], HOME[1], HOME[0] - c, HOME[1] - c), segDist(x, y, HOME[0], HOME[1], HOME[0] + c, HOME[1] - c));
  }
  function inStadium(x, y) { var d = fieldDist(x, y); return d > .07 && d < .42 && y < .95; }
  function sample(n, test, box, anchor) {
    var out = [], guard = 0;
    while (out.length < n && guard++ < n * 600) {
      var x = box[0] + rndH() * (box[2] - box[0]), y = box[1] + rndH() * (box[3] - box[1]);
      if (test(x, y)) out.push([x, y]);
    }
    out.sort(function (a, b) { return a[0] - b[0]; });
    var best = 0, bd = 1e9;
    out.forEach(function (q, i) { var d = Math.hypot(q[0] - anchor[0], q[1] - anchor[1]); if (d < bd) { bd = d; best = i; } });
    var tmp = out[0]; out[0] = out[best]; out[best] = tmp;   // 준호(0번)는 눈에 띄는 자리로
    return out;
  }
  /* ===== dot terrain map: every shape is a regular grid of dots (one dot per person / 10 / 100),
     each dot has an "elevation" that sets its size and colour, and thin contour lines trace the land ===== */
  function gridPts(sp, test, box) {
    var o = [];
    for (var y = box[1] + sp / 2; y < box[3]; y += sp) for (var x = box[0] + sp / 2; x < box[2]; x += sp) if (test(x, y)) o.push([x, y]);
    return o;
  }
  function gridShape(n, test, box, anchor, elev) {
    var lo = 0.002, hi = 0.3;
    for (var it = 0; it < 32; it++) { var m = (lo + hi) / 2; if (gridPts(m, test, box).length >= n) lo = m; else hi = m; }
    // keep exactly n: drop the lowest dots at the shape's edge, so the grid has no holes
    var all = gridPts(lo, test, box).map(function (q, i) { return { q: q, i: i, v: elev(q[0], q[1]) }; });
    all.sort(function (a, b) { return b.v - a.v || a.i - b.i; });
    var out = all.slice(0, n).sort(function (a, b) { return a.i - b.i; }).map(function (o) { return o.q; });
    var best = 0, bd = 1e9;
    out.forEach(function (q, i) { var d = Math.hypot(q[0] - anchor[0], q[1] - anchor[1]); if (d < bd) { bd = d; best = i; } });
    var tmp = out[0]; out[0] = out[best]; out[best] = tmp;       // 준호(0번)
    out.spacing = lo;
    out.shade = out.map(function (q) { return clamp(elev(q[0], q[1]), 0.12, 1); });
    return out;
  }
  // school: a plain rectangular building, 50 × 20 dots = 1,000 people, centred on the stage.
  // 4 floors × 10 window bays (windows = small dark dots), a front door in the middle.
  var SCH = { cols: 50, rows: 20, w: 1.6 };
  SCH.sp = SCH.w / SCH.cols; SCH.h = SCH.sp * SCH.rows;
  function schoolShape() {
    var out = [], shade = [], sp = SCH.sp;
    for (var r = 0; r < SCH.rows; r++) for (var c = 0; c < SCH.cols; c++) {
      var x = -SCH.w / 2 + (c + .5) * sp, y = -SCH.h / 2 + (r + .5) * sp;
      var floorRow = r % 5, bay = c % 5;                                  // 10 bays of 5 columns
      var win = floorRow >= 1 && floorRow <= 3 && bay >= 1 && bay <= 3;
      var door = c >= 22 && c <= 27 && r >= 16;                           // centred: columns 22–27
      out.push([x, y]);
      shade.push(door ? .14 : (win ? .24 : .92 - (r / SCH.rows) * .32));
    }
    // 준호 (index 0): a wall dot on the right of the second floor
    var k = 12 * SCH.cols + 35, t = out[0]; out[0] = out[k]; out[k] = t; t = shade[0]; shade[0] = shade[k]; shade[k] = t;
    out.spacing = sp; out.shade = shade;
    return out;
  }
  // Jeju: elevation rises toward 한라산, with a few small oreum hills
  var HALLA = [.02, .0];
  var OREUMS = [[-.6, .08, .07], [.56, -.1, .06], [.34, .18, .055], [-.36, -.18, .06], [.78, -.16, .05]];
  function jejuR(x, y) {                                            // 0 at 한라산 … 1 at the coast (scaled coastline)
    var lo = 0, hi = 1.6;
    for (var i = 0; i < 12; i++) { var k = (lo + hi) / 2; if (inPoly(HALLA[0] + (x - HALLA[0]) / k, HALLA[1] + (y - HALLA[1]) / k, JEJU)) hi = k; else lo = k; }
    return hi;
  }
  function jejuElev(x, y) {
    var e = Math.pow(1 - Math.min(1, jejuR(x, y)), 1.3);
    OREUMS.forEach(function (o) { var d = Math.hypot(x - o[0], y - o[1]) / o[2]; if (d < 1) e = Math.max(e, .38 + .3 * (1 - d * d)); });
    return .15 + .85 * e;
  }
  /* the 4.7만 who don't fit: evenly spaced dots on rows that run parallel to the coast (offset curves),
     like extra contour lines in the sea; 우도's water is left clear */
  /* the 4.7만 who don't fit: evenly spaced dots on rows that run around the edge of the FILLED island
     (traced from the island's own dots, not the coast polygon), so the ring hugs what you see */
  function islandEdge(land) {
    var cx = 0, cy = 0, main = land.filter(function (q) { return inPoly(q[0], q[1], JEJU); });
    main.forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= main.length; cy /= main.length;
    var N = 160, far = [];
    main.forEach(function (q) {
      var a = Math.atan2((q[1] - cy) * 2.2, q[0] - cx), b = Math.floor((a + Math.PI) / (2 * Math.PI) * N) % N;
      var d = Math.hypot(q[0] - cx, (q[1] - cy) * 2.2);
      if (!far[b] || d > far[b][2]) far[b] = [q[0], q[1], d];
    });
    var P = far.filter(Boolean).map(function (q) { return [q[0], q[1]]; });
    for (var r = 0; r < 4; r++) P = P.map(function (q, i) { var a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
    return P;
  }
  function coastRows(n, land, offsets) {
    var sp = land.spacing, P = islandEdge(land);
    var area = 0; P.forEach(function (q, i) { var b = P[(i + 1) % P.length]; area += q[0] * b[1] - b[0] * q[1]; });
    var sgn = area > 0 ? -1 : 1;                      // outward normal for this winding
    function row(d) {
      var o = P.map(function (q, i) {
        var a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length];
        var tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
        return [q[0] + sgn * ty / L * d, q[1] - sgn * tx / L * d];
      });
      for (var r = 0; r < 3; r++) o = o.map(function (q, i) { var a = o[(i - 1 + o.length) % o.length], b = o[(i + 1) % o.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
      return o;
    }
    // keep every ring dot clear of the filled dots (bays and the 우도 strait)
    var cell = sp * 2, hash = {};
    land.forEach(function (q) { var k = Math.floor(q[0] / cell) + ',' + Math.floor(q[1] / cell); (hash[k] = hash[k] || []).push(q); });
    function clear(x, y, r) {
      var gx = Math.floor(x / cell), gy = Math.floor(y / cell), R = Math.ceil(r / cell);
      for (var i = -R; i <= R; i++) for (var j = -R; j <= R; j++) {
        var l = hash[(gx + i) + ',' + (gy + j)]; if (!l) continue;
        for (var k = 0; k < l.length; k++) if (Math.hypot(l[k][0] - x, l[k][1] - y) < r) return false;
      }
      return true;
    }
    // outward = the side where the offset line is clear of the land
    var cnt = function (o) { return o.filter(function (q) { return clear(q[0], q[1], sp * 1.5); }).length; };
    var r0 = row(offsets[0] * sp); sgn = -sgn; var r1 = row(offsets[0] * sp); if (cnt(r0) > cnt(r1)) sgn = -sgn;
    var rows = offsets.map(function (k) { return row(k * sp); });
    function place(step) {
      var out = [];
      rows.forEach(function (o, ri) {
        var carry = (ri % 2) * step / 2;
        for (var i = 0; i < o.length; i++) {
          var a = o[i], b = o[(i + 1) % o.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = carry;
          while (t < L) {
            var x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L;
            if (!nearUdo(x, y, 2.4) && clear(x, y, sp * (offsets[0] - .6))) out.push([x, y]);
            t += step;
          }
          carry = t - L;
        }
      });
      return out;
    }
    var lo = .004, hi = .2;
    for (var it = 0; it < 36; it++) { var m = (lo + hi) / 2; if (place(m).length >= n) lo = m; else hi = m; }
    var pts = place(lo), extra = pts.length - n;
    for (var e = 0; e < extra; e++) pts.splice(Math.floor((e + .5) * pts.length / extra) % pts.length, 1);
    pts = pts.slice(0, n);
    pts.spacing = lo;
    pts.shade = pts.map(function () { return .55; });
    return pts;
  }
  var SHAPES = {
    school: schoolShape(),
    stadium: gridShape(2400, inStadium, [-1.2, -.85, 1.2, .95], [.45, -.62], function (x, y) { return 1 - .75 * (fieldDist(x, y) - .07) / .35; }),
    jeju: gridShape(6700, onJeju, [-1, -.5, 1.1, .5], [-.3, .05], jejuElev),
    // the 4.7만 who don't fit: a loose ring of dots all around the coast (clear of 우도)
  };
  SHAPES.spill = coastRows(470, SHAPES.jeju, [2.6, 4.2, 5.8]);
  // terrain colours: burnt → light orange → peach (the brand orange #FF6A00 is not used; 준호 is white)
  var TERRAIN = ['#8A4A26', '#B0602F', '#D47838', '#F2924E', '#FFB682', '#FFDCC4'];
  var dsh = new Float32Array(MAXP);
  for (var dsi = 0; dsi < MAXP; dsi++) dsh[dsi] = .5;
  function stageR(S) { return S.shape ? SHAPES[S.shape].spacing * HB * .54 : S.r * clamp(HB / 360, .6, 1); }
  function dotShade(i, st) {
    var S = STAGES[st];
    if (!S.shape) return .8;
    if (S.spill && i >= 6700) return SHAPES.spill.shade[i - 6700];
    return SHAPES[S.shape].shade[i] || .5;
  }

  /* background: a faint field of dots over the whole screen (land / sea) */
  var bgDots = document.createElement('canvas');
  function buildBg(dpr) {
    bgDots.width = W * dpr; bgDots.height = H * dpr;
    var g = bgDots.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var sp = W > 760 ? 12 : 10;
    g.fillStyle = 'rgba(255,233,217,.09)'; g.beginPath();
    for (var y = sp / 2; y < H; y += sp) for (var x = sp / 2; x < W; x += sp) { g.moveTo(x + 1, y); g.arc(x, y, 1, 0, 6.2832); }
    g.fill();
  }
  var dpx = new Float32Array(MAXP), dpy = new Float32Array(MAXP), dpa = new Float32Array(MAXP);
  var outPos = [], spd = new Float32Array(MAXP), ph = new Float32Array(MAXP);
  for (var di = 0; di < MAXP; di++) { var ang = rndH() * 6.2832; outPos.push([Math.cos(ang) * 2.6, Math.sin(ang) * 2.6]); spd[di] = .045 + rndH() * .05; ph[di] = rndH() * 6.2832; }
  var hcx = 0, hcy = 0, HB = 1;

  function sizeHook() {
    W = cv.clientWidth; H = cv.clientHeight;
    var zf = W ? cv.getBoundingClientRect().width / W : 1;          // page zoom: draw at the real on-screen resolution
    var dpr = Math.min(4, (window.devicePixelRatio || 1) * zf);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var wide = W > 760;
    hcx = wide ? W * .725 : W / 2; hcy = wide ? H * .47 : H * .3;
    HB = wide ? Math.min(W * .195, H * .35) : Math.min(W * .4, H * .2);
    for (var i = 0; i < MAXP; i++) if (dpa[i] < .01) { dpx[i] = hcx + outPos[i][0] * HB * 2; dpy[i] = hcy + outPos[i][1] * HB * 2; }
    buildBg(dpr);
  }
  function dotTarget(i, st) {
    var S = STAGES[st];
    if (S.leave) return (i === 0 || i === D2) ? SHAPES.jeju[i] : null;
    if (i >= S.n) return null;
    if (st === 1) return [0, 0];
    if (S.spill && i >= 6700) return SHAPES.spill[i - 6700];
    return SHAPES[S.shape][i];
  }
  function hookLabel(txt, legend, x, y, a) {
    ctx.font = '700 14px ' + HOOK_FONT;
    var tw = ctx.measureText(txt).width;
    ctx.font = '600 12px ' + HOOK_FONT;
    var lw = legend ? ctx.measureText(legend).width + 14 : 0;
    ctx.fillStyle = 'rgba(28,25,23,' + (.85 * a) + ')';
    ctx.fillRect(x - 2, y - 20, tw + lw + 18, 26);
    ctx.font = '700 14px ' + HOOK_FONT;
    ctx.fillStyle = 'rgba(255,233,217,' + a + ')';
    ctx.fillText(txt, x + 7, y - 2);
    if (legend) { ctx.font = '600 12px ' + HOOK_FONT; ctx.fillStyle = 'rgba(255,170,110,' + a + ')'; ctx.fillText(legend, x + tw + 21, y - 2); }
  }

  // 1층 창문(캐릭터 자리)의 화면 좌표 — 캔버스는 화면 전체를 덮으므로 그대로 쓴다
  function windowSpot(sel) {
    var w = $(sel || '.u-a .w').getBoundingClientRect(), c = cv.getBoundingClientRect(), f = c.width ? cv.clientWidth / c.width : 1;   // screen px → canvas px
    return { x: (w.left - c.left + w.width / 2) * f, y: (w.top - c.top + w.height / 2) * f, size: w.width * f };
  }

  /* contour lines for each shape (drawn in shape units, faded in with the labels) */
  function smoothPoly(pts) {        // closed curve through the midpoints, so contours read as terrain, not polygons
    ctx.beginPath();
    for (var i = 0; i <= pts.length; i++) {
      var a = pts[i % pts.length], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a[0], a[1], mx, my);
    }
    ctx.closePath();
  }
  function XY(u, v) { return [hcx + u * HB, hcy + v * HB]; }
  function drawContours(S, a) {
    if (a < .02) return;
    ctx.save(); ctx.lineWidth = 1;
    if (S.shape === 'jeju') {
      // sea: rings around the coast, fading out
      [1.1, 1.22, 1.36].forEach(function (k, i) {
        ctx.strokeStyle = 'rgba(255,233,217,' + (.16 - i * .045) * a + ')';
        smoothPoly(JEJU.map(function (q) { return XY(HALLA[0] + (q[0] - HALLA[0]) * k, HALLA[1] + (q[1] - HALLA[1]) * k); })); ctx.stroke();
      });
      // land: coastline, then rising contours toward 한라산
      [1, .8, .6, .42, .26, .12].forEach(function (k, i) {
        ctx.strokeStyle = 'rgba(255,233,217,' + (i === 0 ? .55 : .3) * a + ')'; ctx.lineWidth = i === 0 ? 1.4 : 1;
        smoothPoly(JEJU.map(function (q) { return XY(HALLA[0] + (q[0] - HALLA[0]) * k, HALLA[1] + (q[1] - HALLA[1]) * k); })); ctx.stroke();
      });
      // 우도: its own coastline and one ring of sea
      [[1, .55], [1.6, .12]].forEach(function (r) {
        ctx.strokeStyle = 'rgba(255,233,217,' + r[1] * a + ')'; ctx.lineWidth = r[0] === 1 ? 1.4 : 1;
        smoothPoly(UDO.map(function (q) { return XY(UDO_C[0] + (q[0] - UDO_C[0]) * r[0], UDO_C[1] + (q[1] - UDO_C[1]) * r[0]); })); ctx.stroke();
      });
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,233,217,' + .32 * a + ')';
      OREUMS.forEach(function (o) { [1, .55].forEach(function (s) { var p = XY(o[0], o[1]); ctx.beginPath(); ctx.ellipse(p[0], p[1], o[2] * HB * s, o[2] * HB * s * .7, 0, 0, 6.2832); ctx.stroke(); }); });
      var h = XY(HALLA[0], HALLA[1]);
      ctx.fillStyle = 'rgba(255,248,242,' + .9 * a + ')'; ctx.font = '700 12px ' + HOOK_FONT; ctx.fillText('▲ 한라산', h[0] + 8, h[1] - 6);
    } else if (S.shape === 'stadium') {
      var c = Math.SQRT1_2, H0 = XY(HOME[0], HOME[1]);
      // the field: grass in faint dots, the diamond and bases in white
      ctx.fillStyle = 'rgba(160,170,140,' + .12 * a + ')';
      var gs = SHAPES.stadium.spacing;
      for (var gy = -.4; gy < .62; gy += gs) for (var gx = -.75; gx < .75; gx += gs) {
        var dx = gx - HOME[0], dy = gy - HOME[1], an = Math.atan2(dy, dx);
        if (Math.hypot(dx, dy) < .98 && an <= -Math.PI / 4 && an >= -3 * Math.PI / 4) { var gp = XY(gx, gy); ctx.fillRect(gp[0] - .9, gp[1] - .9, 1.8, 1.8); }
      }
      ctx.strokeStyle = 'rgba(255,248,242,' + .7 * a + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); var d1 = XY(HOME[0], HOME[1] - .6), d2 = XY(.3, HOME[1] - .3), d3 = XY(-.3, HOME[1] - .3);
      ctx.moveTo(H0[0], H0[1]); ctx.lineTo(d2[0], d2[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d3[0], d3[1]); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); var lf = XY(HOME[0] - c, HOME[1] - c), rf = XY(HOME[0] + c, HOME[1] - c);
      ctx.moveTo(lf[0], lf[1]); ctx.lineTo(H0[0], H0[1]); ctx.lineTo(rf[0], rf[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(H0[0], H0[1], .55 * HB, -Math.PI / 4, -3 * Math.PI / 4, true); ctx.strokeStyle = 'rgba(255,248,242,' + .3 * a + ')'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,242,' + .9 * a + ')';
      [H0, d1, d2, d3].forEach(function (b) { ctx.fillRect(b[0] - 3, b[1] - 3, 6, 6); });
      // the stands: contour rings between the seat tiers. Each ring is a true offset of the field
      // (arc at home plate, both foul lines, round corners at the foul poles, the outfield arc),
      // pushed out by half a dot so the outer / inner dots sit inside their lines.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hcy + .95 * HB + 1); ctx.clip();
      var half = SHAPES.stadium.spacing * .55, LP = XY(HOME[0] - c, HOME[1] - c), RP = XY(HOME[0] + c, HOME[1] - c);
      [.07 - half, .155, .24, .33, .42 + half].forEach(function (d, i) {
        var r = d * HB;
        ctx.strokeStyle = 'rgba(255,233,217,' + (i === 0 || i === 4 ? .5 : .2) * a + ')'; ctx.lineWidth = i === 0 || i === 4 ? 1.4 : 1;
        ctx.beginPath();
        ctx.arc(H0[0], H0[1], r, Math.PI / 4, 3 * Math.PI / 4);               // behind home plate
        ctx.lineTo(LP[0] - r * c, LP[1] + r * c);                              // along the left foul line
        ctx.arc(LP[0], LP[1], r, 3 * Math.PI / 4, 5 * Math.PI / 4);            // round the left foul pole
        ctx.arc(H0[0], H0[1], HB + r, -3 * Math.PI / 4, -Math.PI / 4);         // the outfield
        ctx.arc(RP[0], RP[1], r, -Math.PI / 4, Math.PI / 4);                   // round the right foul pole
        ctx.closePath(); ctx.stroke();                                         // back along the right foul line
      });
      // the stands end at the bottom: close them with a line
      var yb = hcy + .95 * HB;
      ctx.strokeStyle = 'rgba(255,233,217,' + .5 * a + ')'; ctx.lineWidth = 1.4;
      var xb = Math.sqrt(Math.max(0, Math.pow((.42 + half) * HB, 2) - Math.pow(yb - H0[1], 2)));
      ctx.beginPath(); ctx.moveTo(H0[0] - xb, yb); ctx.lineTo(H0[0] + xb, yb); ctx.stroke();
      ctx.restore();
    } else if (S.shape === 'school') {
      var hw = SCH.w / 2 + SCH.sp * .6, hh = SCH.h / 2 + SCH.sp * .6;
      var p = XY(-hw, -hh), q = XY(hw, hh);
      ctx.strokeStyle = 'rgba(255,233,217,' + .5 * a + ')'; ctx.lineWidth = 1.4;
      ctx.strokeRect(p[0], p[1], q[0] - p[0], q[1] - p[1]);                       // the building
      var r0 = XY(-hw - .03, -hh - .035), r1 = XY(hw + .03, -hh - .035);
      ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();   // roof line
      ctx.strokeStyle = 'rgba(255,233,217,' + .2 * a + ')'; ctx.lineWidth = 1;
      for (var fl = 1; fl < 4; fl++) {                                            // floor lines
        var fy = -SCH.h / 2 + fl * 5 * SCH.sp, f1 = XY(-hw, fy), f2 = XY(hw, fy);
        ctx.beginPath(); ctx.moveTo(f1[0], f1[1]); ctx.lineTo(f2[0], f2[1]); ctx.stroke();
      }
      var g1 = XY(-hw - .08, hh), g2 = XY(hw + .08, hh);                            // ground
      ctx.strokeStyle = 'rgba(255,233,217,' + .45 * a + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.stroke();
    }
    ctx.restore();
  }

  /* heroes: the lone first dot (stage 1), then two people picked out of the 71.7만 — 준호 and 도희 (stage 6+) */
  var D2 = (function () { var best = 1, bd = 1e9; SHAPES.jeju.forEach(function (q, i) { if (i === 0) return; var d = Math.hypot(q[0] - .42, q[1] + .1); if (d < bd) { bd = d; best = i; } }); return best; })();
  var HEROES = [{ i: 0, name: '준호', win: '.u-a .w' }, { i: D2, name: '도희', win: '.u-b .w' }];
  function heroesOf(st) { var S = STAGES[st]; if (st === 1) return [HEROES[0]]; return (S.dim || S.leave) ? HEROES : []; }
  function drawHook(now) {
    var S = STAGES[hookStage], hs = heroesOf(hookStage), isHero = {};
    hs.forEach(function (h) { isHero[h.i] = h; });
    // 떠나는 단계: 준호 → 1층 창, 도희 → 2층 창 (스크롤 진행도로 위치를 정한다)
    var leaveT = 0;
    if (S.leave) {
      leaveT = ease(seg(hookP, LEAVE_AT + 0.02, 1));
      hs.forEach(function (h) {
        var from = SHAPES.jeju[h.i], spot = windowSpot(h.win);
        h.spot = spot;
        dpx[h.i] = lerp(hcx + from[0] * HB, spot.x, leaveT);
        dpy[h.i] = lerp(hcy + from[1] * HB, spot.y, leaveT);
      });
    }
    R += (stageR(S) - R) * .08;
    la += ((now - stageAt > 700 ? 1 : 0) - la) * .08;
    ctx.clearRect(0, 0, W, H);
    if (S.shape && !S.leave) drawContours(S, la * (S.dim ? .4 : 1));

    // soft white light around each hero (breathing)
    hs.forEach(function (h, n) {
      var a0 = dpa[h.i]; if (a0 < .02) return;
      var gx = dpx[h.i], gy = dpy[h.i], pulse = .5 + .5 * Math.sin(now / 650 + n * 1.7);
      var gr = Math.max(R * 2.2, 10) * (3.2 + pulse * 1.2) + (S.dim ? 24 : 0);
      if (h.spot) gr = lerp(gr, h.spot.size * 1.3, leaveT);
      var glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      glow.addColorStop(0, 'rgba(255,255,255,' + (.42 * a0) + ')');
      glow.addColorStop(.45, 'rgba(255,248,242,' + (.14 * a0) + ')');
      glow.addColorStop(1, 'rgba(255,248,242,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 6.2832); ctx.fill();
    });

    // dots, batched by terrain colour
    var paths = TERRAIN.map(function () { return []; }), solo = [];
    for (var i = 0; i < MAXP; i++) {
      var tg = dotTarget(i, hookStage);
      var tx = hcx + (tg ? tg[0] : outPos[i][0]) * HB, ty = hcy + (tg ? tg[1] : outPos[i][1]) * HB;
      var k = reduced ? 1 : spd[i];
      if (!(S.leave && isHero[i])) { dpx[i] += (tx - dpx[i]) * k; dpy[i] += (ty - dpy[i]) * k; }
      dpa[i] += ((tg ? 1 : 0) - dpa[i]) * (reduced ? 1 : .07);
      if (tg) dsh[i] += (dotShade(i, hookStage) - dsh[i]) * (reduced ? 1 : .08);
      if (dpa[i] < .02 || isHero[i]) continue;
      if (dpa[i] < .95 || S.dim || (S.spill && i >= 6700)) { solo.push(i); continue; }
      paths[Math.min(TERRAIN.length - 1, Math.floor(dsh[i] * TERRAIN.length))].push(i);
    }
    paths.forEach(function (list, ci) {
      if (!list.length) return;
      ctx.fillStyle = TERRAIN[ci]; ctx.beginPath();
      list.forEach(function (i) { var rd = R * (.42 + .58 * dsh[i]); ctx.moveTo(dpx[i] + rd, dpy[i]); ctx.arc(dpx[i], dpy[i], rd, 0, 6.2832); });
      ctx.fill();
    });
    solo.forEach(function (si) {
      var a = dpa[si], col = TERRAIN[Math.min(TERRAIN.length - 1, Math.floor(dsh[si] * TERRAIN.length))];
      if (S.spill && si >= 6700) col = '#FFDCC4';
      ctx.globalAlpha = S.dim ? a * .22 : a;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(dpx[si], dpy[si], R * (.42 + .58 * dsh[si]), 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (S.label && la > .02) {
      var top = { school: -.43, stadium: -.85, jeju: -.62 }[S.shape];
      var left = { school: -.82, stadium: -1.1, jeju: -1.05 }[S.shape];
      hookLabel(S.label, S.legend, hcx + left * HB, hcy + top * HB - 12, la);
      if (S.spill) hookLabel('+ 4.7만 명 · 섬에 다 담기지 못해요', '', Math.min(W - 270, hcx + .25 * HB), hcy + (W > 760 ? .62 : .6) * HB, la);
    }

    // heroes: a white dot with a white ring (+ their names once two are picked out)
    hs.forEach(function (h) {
      var a0 = dpa[h.i]; if (a0 < .02) return;
      var x0 = dpx[h.i], y0 = dpy[h.i], rr = Math.max(R * 2.2, 10) + (S.dim ? 14 : 0);
      ctx.fillStyle = 'rgba(255,255,255,' + a0 + ')';
      ctx.beginPath(); ctx.arc(x0, y0, Math.max(R * 1.1, 3), 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + a0 + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x0, y0, rr, 0, 6.2832); ctx.stroke();
      if (S.dim || (S.leave && leaveT < .6)) {
        ctx.font = '800 15px ' + HOOK_FONT; ctx.fillStyle = '#fff';
        ctx.fillText(h.name, x0 + rr + 8, y0 + 5);
      }
    });
  }


  // 숫자: 진행도에 맞춰 점 수 × 점 1개가 나타내는 사람 수로
  var KP = [[0, 0], [.05, 0], [.07, 1], [.17, 1], [.23, 1000], [.35, 1000], [.41, 24000], [.57, 24000], [.65, 670000], [.79, 670000], [.81, 717000], [1, 717000]];
  function countAt(p) {
    for (var i = 1; i < KP.length; i++) if (p <= KP[i][0]) {
      var p0 = KP[i - 1][0], a = KP[i - 1][1], p1 = KP[i][0], b = KP[i][1], f = ease(clamp((p - p0) / (p1 - p0 || 1)));
      return Math.round(a > 0 ? a * Math.pow(b / a, f) : a + (b - a) * f);
    }
    return 717000;
  }
  function fmt(n) { if (n < 10000) return n.toLocaleString('ko-KR'); var v = Math.floor(n / 1000) / 10; return (v % 1 ? v.toFixed(1) : v.toFixed(0)) + '만'; }

  var hkShown = -1;
  function updateHook(scene, p) {
    hookP = p;
    scene.classList.toggle('leaving', p >= LEAVE_AT);
    var st = stageOf(p);
    if (st !== hookStage) { hookStage = st; stageAt = performance.now(); la = 0; }
    if (st !== hkShown) { hkShown = st; hks.forEach(function (e) { e.classList.toggle('on', e.dataset.k === String(st)); }); }
    var txt = fmt(countAt(p));
    if (hookN.textContent !== txt) hookN.textContent = txt;
    hookShownAt = performance.now();
  }

  // the canvas only draws while the hook scene is visible (plus its fade-out)
  function hookLoop(now) {
    if (hookScene.classList.contains('active') || now - hookShownAt < 900) drawHook(now);
    requestAnimationFrame(hookLoop);
  }

  /* ======================================================
     S00–S02 apartment: the camera dives into each window, then that room fades in
     ====================================================== */
  var CAM = [
    { z: 1, tx: 0, ty: 10 },
    { z: 6, tx: 480 - 480 * 6, ty: 270 - 452 * 6 },     // 1F window
    { z: 6, tx: 480 - 480 * 6, ty: 270 - 364 * 6 }      // 2F window
  ];
  var roomOru = $('#roomOru'), sigh = $('#sigh');
  // 2층 방 바닥 위의 길: 방 안쪽 → 현관 앞 → 돌아서 몇 걸음 (stage px)
  var RB = { start: [330, 424], door: [630, 424], back: [540, 424] };
  /* pixel prelude → vector: the apartment first appears as pixel art, then on scroll it "resolves" into
     the vector drawing through a mosaic whose blocks shrink from 24px to 1px */
  var aptPx = $('#aptPx'), aptUp = $('#aptUp'), aptArt = $('.apt-art'), pxCtx = aptPx.getContext('2d'), upCtx = aptUp.getContext('2d');
  var upImg = null, upT = -1, buildingP = 0;
  (function snapshot() {
    try {
      var defs = document.querySelector('.fx-defs defs').outerHTML;
      var c = aptArt.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      c.setAttribute('width', 960); c.setAttribute('height', 540); c.removeAttribute('class');
      var imgs = [].slice.call(c.querySelectorAll('image')), left = imgs.length;
      function finish() {
        c.insertAdjacentHTML('afterbegin', defs);
        var im = new Image();
        im.onload = function () { upImg = im; upT = -1; };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
      }
      if (!left) return finish();
      imgs.forEach(function (node) {   // inline the character pngs so they survive inside an svg image
        var src = node.getAttribute('href'), pic = new Image();
        pic.onload = function () { try { var cv = document.createElement('canvas'); cv.width = pic.naturalWidth; cv.height = pic.naturalHeight; cv.getContext('2d').drawImage(pic, 0, 0); node.setAttribute('href', cv.toDataURL('image/png')); } catch (e) { node.remove(); } if (!--left) finish(); };
        pic.onerror = function () { node.remove(); if (!--left) finish(); };
        pic.src = src;
      });
    } catch (e) {}
  })();
  var small = document.createElement('canvas');
  function drawUp(t) {
    if (!upImg) return;
    var b = Math.max(1, Math.round(Math.pow(24, 1 - t)));           // 24px blocks → 1px
    if (b === upT) return; upT = b;
    var w = Math.ceil(960 / b), h = Math.ceil(540 / b);
    small.width = w; small.height = h;
    var sc = small.getContext('2d'); sc.imageSmoothingEnabled = true; sc.clearRect(0, 0, w, h); sc.drawImage(upImg, 0, 0, w, h);
    upCtx.imageSmoothingEnabled = false; upCtx.clearRect(0, 0, 960, 540); upCtx.drawImage(small, 0, 0, w * b, h * b);
  }
  function pxLoop(now) {
    var sc = $('.scene-building');
    if (sc.classList.contains('active') && buildingP < (window.PXStory ? 0.4 : 0.2) && window.OreumPixel) window.OreumPixel.draw(pxCtx, now);
    requestAnimationFrame(pxLoop);
  }
  requestAnimationFrame(pxLoop);
  function updatePrelude(p) {
    buildingP = p;
    var t = seg(p, 0.08, 0.18);                       // 0 = pixel art, 1 = vector
    var e = ease(t);
    if (window.PXStory) {   // pixel story: the apartment stays pixel art; no hand-over to the vector drawing
      aptPx.style.opacity = p < 0.3 ? 1 : 0; aptUp.style.opacity = 0; aptArt.style.opacity = 0; return;
    }
    aptPx.style.opacity = (1 - seg(e, 0, 0.35)).toFixed(3);
    aptUp.style.opacity = (seg(e, 0, 0.25) * (1 - seg(e, 0.85, 1))).toFixed(3);
    aptArt.style.opacity = seg(e, 0.8, 1).toFixed(3);
    if (t > 0 && t < 1) drawUp(e);
  }
  function updateBuilding(scene, p) {
    updatePrelude(p);
    var ph = p < 0.3 ? 0 : (p < 0.62 ? 1 : 2);
    if (scene.dataset.phase !== String(ph)) {
      scene.dataset.phase = ph;
      var apt = $('#apt');
      apt.style.setProperty('--z', CAM[ph].z);
      apt.style.setProperty('--tx', CAM[ph].tx + 'px');
      apt.style.setProperty('--ty', CAM[ph].ty + 'px');
    }
    // 2층 방: 현관까지 걸어가서 → 멈춰 한숨 → 돌아선다
    var walk = ease(seg(p, 0.68, 0.78)), back = ease(seg(p, 0.92, 1));
    var x = lerp(lerp(RB.start[0], RB.door[0], walk), RB.back[0], back);
    var y = lerp(lerp(RB.start[1], RB.door[1], walk), RB.back[1], back);
    var sighing = p >= 0.8 && p < 0.94;
    roomOru.style.setProperty('--x', x.toFixed(1) + 'px');
    roomOru.style.setProperty('--y', y.toFixed(1) + 'px');
    roomOru.style.setProperty('--flip', p >= 0.92 ? -1 : 1);
    roomOru.style.setProperty('--squash', sighing ? 0.93 : 1);
    sigh.style.setProperty('--x', (x - 40).toFixed(1) + 'px');
    sigh.style.setProperty('--y', (y - 124).toFixed(1) + 'px');
    sigh.classList.toggle('on', sighing);
  }

  /* ======================================================
     S03–S04 wall: the youths step out onto their terraces. Support doors stand on top of the wall.
     3F jumps up easily; 1F · 2F can't reach. The oreum symbol breaks the wall into stairs.
     ====================================================== */
  /* 38 × 15 pixel tiles (16px). Columns 0–19 = 1~4단계 (5 columns each, 3(s+1) tiles high);
     columns 20–37 = the plateau that holds the four 지원 프로그램 doors and never falls. */
  var GROUND = 500, B = 16, COLS = 38, ROWS = 15, X0 = 300, SW = 5, PLAT = 20;
  var NC = COLS + 40;                           // + plateau columns past the stage, out to the screen edge
  var TOP = GROUND - ROWS * B;                  // 260: top of the wall
  var WALL_TONES = ['#2C2825', '#332E2A', '#3A3430', '#262220'];
  var STEP_TONES = [                            // same ramp as the big steps: deep orange → orange → light orange → peach
    ['#8E3E0A', '#96420C', '#883B09', '#9A450E'],
    ['#FF6A00', '#F56500', '#FF7410', '#FA6A05'],
    ['#FFAA70', '#FFA264', '#FFB27C', '#FCA468'],
    ['#FFDCC4', '#FFD4B8', '#FFE2CC', '#FCD8BE'],
    ['#FFF1E6', '#FFF8F2', '#FFEBDD', '#FFF4EA']
  ];
  var blocksEl = $('#blocks');
  var blocks = [];
  (function buildBlocks() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < NC; c++) {
        var stepIdx = c < PLAT ? Math.floor(c / SW) : 4;
        var keep = stepIdx === 4 || r < 3 * (stepIdx + 1);
        var seed = (r * 31 + c * 17 + r * c) % 23;
        var d = document.createElement('div');
        d.className = 'blk' + (keep ? ' keep' : '');
        d.style.setProperty('--wc', WALL_TONES[seed % 4]);
        if (keep) d.style.setProperty('--sc', STEP_TONES[stepIdx][(seed * 7) % 4]);
        blocksEl.appendChild(d);
        blocks.push({
          el: d, r: r, c: c, keep: keep, step: stepIdx,
          x: X0 + c * B, y: GROUND - B * (r + 1),
          delay: (ROWS - r) * 0.03 + seed * 0.008,
          drift: (seed - 11) * 4,
          spin: (seed - 11) * 9
        });
      }
    }
  })();

  /* sprite frames: preloaded so swapping src never flickers */
  function frames(prefix, n) { var a = []; for (var i = 1; i <= n; i++) { var im = new Image(); im.src = 'assets/character/sprites/' + prefix + i + '.png'; a.push('assets/character/sprites/' + prefix + i + '.png'); } return a; }
  var HOP1 = frames('hop1-', 7);     // 1단계 오르미: squash → stretch → land
  var RUN4 = frames('run4-', 9);     // 4단계 오르미: 1–6 run cycle, 7 joy, 8 leap, 9 stand
  function setSrc(el, src) { if (el.getAttribute('src') !== src) el.setAttribute('src', src); }

  var HIT = { x: 430, y: 330 };                 // where the symbol strikes the wall (left part, over the future stairs)
  var FLY_FROM = { x: -120, y: 40 };
  var doors = $$('.wall-door');
  var DOOR1 = 656;                              // centre of the first door (3F walks in here)

  // the youths: feet points on their terraces, and where they land on the stairs
  var TX = 222, FLOOR = [494, 406, 318];        // 1F, 2F, 3F terrace floors
  var oru1 = $('#wallOru'), oru2 = $('#wallOru2'), oru3 = $('#wallOru3');
  function put(el, x, y, o, sc) {
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-100%) scale(' + (sc || 1) + ')';
    el.style.opacity = o;
  }
  function arc(a, b, t, h) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - 4 * h * t * (1 - t)]; }
  // a jump that hits the wall face and drops back onto the terrace
  function tryJump(base, t, h) { return [TX + 50 * Math.sin(Math.PI * t), base - h * Math.sin(Math.PI * t)]; }

  // camera move at the end: 1·2단계 grow until they match the step-1 scene (step 1 tread → y 420, riser → x 620)
  var ZS = 154 / (3 * B);
  var ZOOM = { s: ZS, tx: 620 - (X0 + SW * B) * ZS, ty: 420 - (GROUND - 3 * B) * ZS };

  function updateWall(scene, p) {
    var zoom = ease(seg(p, 0.92, 1));            // last 8%: zoom into 1·2단계
    var cam = $('#wallCam');
    cam.style.transform = 'translate(' + (ZOOM.tx * zoom).toFixed(1) + 'px,' + (ZOOM.ty * zoom).toFixed(1) + 'px) scale(' + lerp(1, ZOOM.s, zoom).toFixed(4) + ')';
    var fadeOut = 1 - seg(zoom, 0, 0.5);
    $$('.corner, .terrace, .t-door', scene).forEach(function (el) { el.style.opacity = fadeOut; });
    $('#stepLabels').style.opacity = (p > 0.85 ? 1 : 0) * fadeOut;

    var built = seg(p, 0.12, 0.19) * blocks.length;   // the wall and its doors appear with "청년 지원 프로그램"
    var fly = seg(p, 0.62, 0.67);                // symbol flies in
    var hit = seg(p, 0.67, 0.72);                // impact: shake + crack
    var fallT = seg(p, 0.72, 0.84);              // non-stair tiles fall
    var shake = (p >= 0.67 && p < 0.72) ? Math.sin(p * 2200) * 6 * (1 - hit) : 0;

    blocks.forEach(function (b, i) {
      var appear = clamp(built - i);
      var x = b.x + shake, y = b.y - (1 - appear) * 16, r = 0, o = appear;
      if (!b.keep) {
        if (hit > 0 && fallT === 0) { x += Math.sin(i * 1.7 + p * 420) * 2; y += Math.cos(i * 2.3 + p * 380) * 1; }
        var t = clamp((fallT - b.delay * 0.6) / 0.45);
        if (t > 0) {
          y = b.y + 520 * t * t;
          x = b.x + b.drift * t;
          r = b.spin * t;
          o = 1 - seg(t, 0.5, 1);
        }
      }
      b.el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + r + 'deg)';
      b.el.style.opacity = o;
      if (b.keep) b.el.classList.toggle('lit', p > 0.84 + b.step * 0.008);
    });

    var sg = $('#stairGrain');
    if (!sg.dataset.ready) {
      var pts = [[X0, GROUND]];
      for (var st = 0; st < 4; st++) { pts.push([X0 + st * SW * B, GROUND - 3 * B * (st + 1)]); pts.push([X0 + (st + 1) * SW * B, GROUND - 3 * B * (st + 1)]); }
      pts = [[X0, GROUND], [X0, GROUND - 3 * B]].concat(pts.slice(2));
      pts.push([X0 + PLAT * B, TOP], [X0 + NC * B, TOP], [X0 + NC * B, GROUND]);
      sg.style.clipPath = 'polygon(' + pts.map(function (q) { return q[0] + 'px ' + q[1] + 'px'; }).join(',') + ')';
      sg.dataset.ready = 1;
    }
    sg.style.opacity = (p > 0.85 ? 0.7 : 0) * fadeOut;

    // the four entrances rise with the wall's top row; the first glows as 3F walks in
    var enter = seg(p, 0.43, 0.46) * (1 - seg(p, 0.49, 0.53));
    var rise = clamp(built - (blocks.length - NC));                     // 0 → 1 while the top row lands
    doors.forEach(function (d, k) {
      d.style.opacity = rise * fadeOut;
      d.style.transform = 'translate(' + shake.toFixed(1) + 'px,' + ((1 - rise) * 16).toFixed(1) + 'px)';
    });

    // 3F: steps out, hops onto the wall, walks to the first door and goes in
    var out = seg(p, 0.27, 0.33), pos3, o3 = out, s3 = 1;   // 3F steps out only at "그런데 … 대면"
    if (p < 0.39) pos3 = [lerp(190, TX, out), FLOOR[2]];
    else if (p < 0.42) pos3 = arc([TX, FLOOR[2]], [322, TOP], ease(seg(p, 0.39, 0.42)), 38);
    else if (p < 0.455) pos3 = [lerp(322, DOOR1, ease(seg(p, 0.42, 0.455))), TOP];
    else { var g = seg(p, 0.455, 0.475); pos3 = [DOOR1, TOP]; o3 = 1 - g; s3 = 1 - 0.3 * g; }
    put(oru3, pos3[0], pos3[1], o3 * fadeOut, s3);
    // sprite frame from the motion itself: running while moving, a leap on the jump, standing when still
    var f3 = 'assets/character/oreumi4.png';
    if (p >= 0.39 && p < 0.42) f3 = RUN4[seg(p, 0.39, 0.42) < 0.5 ? 7 : 6];
    else if ((out > 0 && out < 1 && p < 0.39) || (p >= 0.42 && p < 0.475)) f3 = RUN4[Math.floor(pos3[0] / 13) % 6];
    setSrc(oru3, f3);

    // 1F · 2F: step out, try twice to jump the wall (and fall short), then hop onto their own stair
    function youth(el, base, peaks, land, t0) {
      var o = seg(p, 0.02, 0.08), pos;
      if (p < 0.49) pos = [lerp(190, TX, o), base];
      else if (p < 0.59) {                      // three small hops toward the wall that barely leave the floor
        var hp = seg(p, 0.49, 0.585);
        pos = [TX + 6 * Math.sin(Math.PI * Math.min(1, hp * 1.2)), base - peaks[0] * Math.abs(Math.sin(hp * Math.PI * 3)) * (1 - hp * .35)];
      }
      else if (p < t0) pos = [TX + 6 * (1 - seg(p, 0.59, 0.62)), base];
      else pos = arc([TX, base], land, ease(seg(p, t0, t0 + 0.03)), 46);
      put(el, pos[0], pos[1], o * fadeOut);
    }
    youth(oru1, FLOOR[0], [14], [X0 + 46, GROUND - 3 * B], 0.878);         // → 1단계
    youth(oru2, FLOOR[1], [12], [X0 + SW * B + 46, GROUND - 6 * B], 0.884);
    var shiver = p >= 0.49 && p < 0.878;          // they can't reach it: a small trembling while they wait
    oru1.classList.toggle('shiver', shiver); oru2.classList.toggle('shiver', shiver);  // → 2단계

    // oreum symbol: flies in on an arc, strikes the wall, bounces back and fades
    var sym = $('#wallSymbol');
    if (p < 0.62 || p > 0.76) {
      sym.style.opacity = 0;
    } else {
      var sx, sy, rot, sc = 1, so = 1;
      if (fly < 1) {
        var f = fly * fly;                       // accelerates into the wall
        sx = lerp(FLY_FROM.x, HIT.x, f);
        sy = lerp(FLY_FROM.y, HIT.y, f) - Math.sin(fly * Math.PI) * 90;
        rot = 720 * fly;
      } else {
        var bk = ease(seg(p, 0.67, 0.74));
        sx = HIT.x - 60 * bk; sy = HIT.y - 50 * bk + 30 * bk * bk;
        rot = 720 + 40 * bk; sc = 1 + 0.25 * bk; so = 1 - seg(p, 0.71, 0.76);
      }
      sym.style.opacity = so;
      sym.style.transform = 'translate(' + (sx - 35) + 'px,' + (sy - 35) + 'px) rotate(' + rot + 'deg) scale(' + sc + ')';
    }

    // impact ring
    var ring = $('#impact');
    if (hit > 0 && hit < 1) {
      ring.style.opacity = 1 - hit;
      ring.style.transform = 'translate(' + (HIT.x - 40) + 'px,' + (HIT.y - 40) + 'px) scale(' + (0.4 + hit * 2.6) + ')';
    } else {
      ring.style.opacity = 0;
    }
  }

  /* ======================================================
     S05–S07 step 1: thin layers against the next step
     ====================================================== */
  var MISSIONS = ['창문 열고 환기', '양치하기', '8시 기상', '샤워하기', '방 정리', '간단한 요리', '가족과 사진'];
  var S1 = { ground: 420, riser: 620, pitch: 22, left0: 140, dx: 62 };
  // one ramp, darkest at the bottom → lightest at the top (like light rising)
  /* one continuous colour ramp for the whole staircase (S05–S08).
     Level 0 = 1단계 tread, 1 = 2단계, 2 = 3단계, 3 = 4단계. Big steps and the thin layers between them
     take the colour of their own height, so the stairs read as separate steps but one gradient. */
  var RAMP = [[0x8E, 0x3E, 0x0A], [0xFF, 0x6A, 0x00], [0xFF, 0xA8, 0x6C], [0xFF, 0xDC, 0xC4]];   // one ramp: 1단계 deep orange → 4단계 peach
  function rampRGB(L) {
    L = clamp(L, 0, RAMP.length - 1);
    var i = Math.min(RAMP.length - 2, Math.floor(L)), f = L - i;
    return RAMP[i].map(function (v, j) { return Math.round(lerp(v, RAMP[i + 1][j], f)); });
  }
  function rampColor(L, darken) {
    var c = rampRGB(L), k = 1 - (darken || 0);
    return 'rgb(' + c.map(function (v) { return Math.round(v * k); }).join(',') + ')';
  }
  function rampText(L) { var c = rampRGB(L); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 150 ? '#FFF1E6' : '#2A1608'; }
  // mission layers: #FF6A00 → #FFD2B2 (brightest = today's layer)
  var LAYER = [[0xFF, 0x6A, 0x00], [0xFF, 0x96, 0x4C], [0xFF, 0xB6, 0x82], [0xFF, 0xD2, 0xB2]];
  function layerRGB(t) {
    var L = clamp(t) * (LAYER.length - 1), i = Math.min(LAYER.length - 2, Math.floor(L)), f = L - i;
    return LAYER[i].map(function (v, j) { return Math.round(lerp(v, LAYER[i + 1][j], f)); });
  }
  function layerColor(t, a) { var c = layerRGB(t); return a === undefined ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
  function layerText(t) { var c = layerRGB(t); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 165 ? '#FFF8F2' : '#332E2A'; }
  function paintStep(el, L) {                     // big step: its level colour, a touch darker toward the ground
    el.style.background = 'var(--grain) 0 0 / 130px, linear-gradient(180deg, ' + rampColor(L) + ' 0%, ' + rampColor(L, 0.08) + ' 100%)';
  }
  var slabsEl = $('#slabs');
  MISSIONS.forEach(function (m, k) {
    var d = document.createElement('div');
    d.className = 'slab pending';
    d.style.left = (S1.left0 + k * S1.dx) + 'px';
    d.style.width = (S1.riser - S1.left0 - k * S1.dx) + 'px';
    d.style.top = (S1.ground - (k + 1) * S1.pitch) + 'px';
    var lv = (k + 1) / (MISSIONS.length + 1);      // between 1단계 (0) and 2단계 (1): the layers climb the gradient into the next step
    d.style.setProperty('--c', rampColor(lv));
    d.style.setProperty('--c2', rampColor(lv + .12));
    d.style.setProperty('--top', rampColor(lv + .55));
    d.style.setProperty('--tc', rampText(lv));
    d.innerHTML = '<span class="habit">' + m + '</span>';
    slabsEl.appendChild(d);
  });
  var slabEls = $$('.slab', slabsEl);
  var stepOru = $('#stepOru');

  var lastStage1Img = 1, lastSpot = null, hopRaf = 0;
  // the hop plays in time with the 0.8s move between layers (CSS transition on left/top)
  function stopHop() { if (hopRaf) cancelAnimationFrame(hopRaf); hopRaf = 0; }
  function playHop() {
    stopHop();
    var t0 = performance.now(), D = 760;
    (function tick(now) {
      var k = (now - t0) / D;
      if (k >= 1 || lastStage1Img !== 1) { hopRaf = 0; if (lastStage1Img === 1) setSrc(stepOru, 'assets/character/oreumi1.png'); return; }
      setSrc(stepOru, HOP1[Math.min(HOP1.length - 1, Math.floor(k * HOP1.length))]);
      hopRaf = requestAnimationFrame(tick);
    })(t0);
  }

  function step1Count(p) {
    if (p < 0.06) return 0;
    if (p < 0.42) return Math.min(4, 1 + Math.floor(seg(p, 0.06, 0.42) * 4));
    if (p < 0.58) return 4;
    return Math.min(7, 5 + Math.floor(seg(p, 0.58, 0.78) * 3));
  }

  paintStep($('.solid-1'), 0);
  paintStep($('.solid-2'), 1);
  var bTiles = null, lastN = 0;
  function updateStep1(scene, p) {
    // tiles dissolve one by one into the solid gradient steps
    var n = step1Count(p);
    var resting = p >= 0.42 && p < 0.58;
    var top = p >= 0.8;
    // the verification phone: camera shows the mission being done; a new layer = shutter flash + 인증 완료
    var mp = $('#missionPhone');
    if (mp) {
      var mi = Math.max(0, n - 1);
      if (mp.dataset.mi !== String(mi)) {
        $$('.cam-shot, .mp-mission', mp).forEach(function (e) { e.classList.toggle('on', +e.dataset.i === mi); });
        mp.dataset.mi = mi;
      }
      if (n > lastN && n > 0) { mp.classList.remove('snap'); void mp.offsetWidth; mp.classList.add('snap'); }
      mp.classList.toggle('done', n > 0);
      mp.classList.toggle('resting', resting);
    }
    if (n > lastN && n > 0) {
      var fresh = slabEls[n - 1];
      fresh.classList.remove('fresh'); void fresh.offsetWidth; fresh.classList.add('fresh');
    }
    lastN = n;
    slabEls.forEach(function (el, k) {
      el.classList.toggle('pending', k >= n);
      el.classList.toggle('ghost', k >= n && k < n + 2 && !top);
      el.classList.toggle('today', k === n - 1 && !top);
      el.classList.toggle('named', p >= 0.84);
    });

    var x, y;
    if (top) { x = 700; y = S1.ground - 7 * S1.pitch; }
    else if (n === 0) { x = 50; y = S1.ground; }
    else { x = S1.left0 + (n - 1) * S1.dx + 10; y = S1.ground - n * S1.pitch; }
    stepOru.style.left = x + 'px';
    stepOru.style.top = y + 'px';
    stepOru.style.setProperty('--flip', p >= 0.84 ? -1 : 1);

    var want = p >= 0.9 ? 2 : 1;
    if (want !== lastStage1Img) { stopHop(); stepOru.src = 'assets/character/oreumi' + want + '.png'; lastStage1Img = want; }
    var spot = x + ',' + y;
    if (spot !== lastSpot) { if (lastSpot !== null && want === 1 && !reduced) playHop(); lastSpot = spot; }

    scene.classList.toggle('resting', resting);
    var zz = $('.zz', scene);
    zz.style.left = (x + 70) + 'px';
    zz.style.top = (y - 70) + 'px';


    var days = n + (p >= 0.42 ? 1 : 0);
    $('#dday').textContent = top ? '1단계 완료' : (resting ? 'D+' + days + ' · 쉬는 날' : 'D+' + days);
  }

  /* ======================================================
     S08 montage
     ====================================================== */
  var mSlabsEl = $('#mSlabs');
  var M = [{ ground: 430, riser: 360, left0: 50, level: 1 }, { ground: 320, riser: 660, left0: 380, level: 2 }];
  M.forEach(function (g) {
    for (var k = 0; k < 5; k++) {
      var d = document.createElement('div');
      d.className = 'slab pending';
      d.style.left = (g.left0 + k * 54) + 'px';
      d.style.width = (g.riser - g.left0 - k * 54) + 'px';
      d.style.top = (g.ground - (k + 1) * 22) + 'px';
      var lv = g.level + (k + 1) / 6;              // 5 layers between two big steps
      d.style.setProperty('--c', rampColor(lv));
      d.style.setProperty('--c2', rampColor(lv + .12));
      d.style.setProperty('--top', rampColor(lv + .55));
      d.style.setProperty('--tc', rampText(lv));
      mSlabsEl.appendChild(d);
    }
  });
  var mSlabEls = $$('.slab', mSlabsEl);
  paintStep($('.m-s2'), 1);
  paintStep($('.m-s3'), 2);
  paintStep($('.m-s4'), 3);
  $$('.door-floor').forEach(function (el) { paintStep(el, 3); });
  var mOru = $('#mOru');
  var lastMImg = 2, lastName = '';
  // dusk → evening: the room darkens so the door's light stands out
  var BG = [[0x1C, 0x19, 0x17], [0x33, 0x2A, 0x24], [0x1C, 0x19, 0x17]];
  function mixBg(t) {
    var a = t < 0.5 ? BG[0] : BG[1], b = t < 0.5 ? BG[1] : BG[2], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return 'rgb(' + a.map(function (v, i) { return Math.round(lerp(v, b[i], u)); }).join(',') + ')';
  }
  // camera move at the end: the door grows and slides into place as the door scene's door
  var MZ = { s: 2.3, tx: 415 - 840 * 2.3, ty: 40 - 110 * 2.3 };
  /* the climb as keyframes [p, x, y, hop]: a short arc onto each new layer right after it appears,
     a few steps along the tread between the two flights, then the walk to the door */
  var CLIMB = (function () {
    var k = [[0, 30, 430, 0]], x = 30, y = 430;
    function to(pa, pb, nx, ny, hop) { k.push([pa, x, y, 0]); k.push([pb, nx, ny, hop]); x = nx; y = ny; }
    for (var i = 0; i < 5; i++) { var pi = 0.2 + i * 0.052; to(pi + 0.004, pi + 0.048, 58 + 54 * i, 430 - 22 * (i + 1), 7); }
    to(0.47, 0.54, 400, 320, 0);
    for (var j = 0; j < 5; j++) { var q = 0.56 + j * 0.056; to(q + 0.004, q + 0.05, 388 + 54 * j, 320 - 22 * (j + 1), 7); }
    to(0.85, 0.92, 720, 210, 0);
    return k;
  })();
  function climbAt(p) {
    var k = CLIMB;
    if (p <= k[0][0]) return [k[0][1], k[0][2], 1];
    for (var i = 1; i < k.length; i++) {
      if (p <= k[i][0]) {
        var a = k[i - 1], b = k[i], t = b[0] > a[0] ? (p - a[0]) / (b[0] - a[0]) : 1;
        var e = t * t * (3 - 2 * t);              // smoothstep: eases in and out
        if (!b[3]) return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), 1];   // walking along a tread
        // stepping up: the body rises a little ahead of the forward move, with only a small lift over the edge
        var up = Math.min(1, t * 1.6), eu = up * up * (3 - 2 * up);
        return [lerp(a[1], b[1], e), lerp(a[2], b[2], eu) - b[3] * Math.sin(Math.PI * t), 1];
      }
    }
    var L = k[k.length - 1]; return [L[1], L[2], 1];
  }
  function updateMontage(scene, pRaw) {
    var p = clamp(pRaw / 0.85);                  // the climb runs on the first 85%
    var zoom = ease(seg(pRaw, 0.87, 1));
    var mc = $('#mCam'); mc.style.setProperty('--zs', lerp(1, MZ.s, zoom).toFixed(4)); mc.style.setProperty('--zy', (MZ.ty * zoom).toFixed(1) + 'px');
    $('#mCam').style.transform = 'translate(' + (MZ.tx * zoom).toFixed(1) + 'px,' + (MZ.ty * zoom).toFixed(1) + 'px) scale(' + lerp(1, MZ.s, zoom).toFixed(4) + ')';
    var fade = 1 - seg(zoom, 0, 0.4);
    mOru.style.opacity = fade;
    $('#stageName').style.opacity = fade;
    $('#mDoor .ld-sign').style.opacity = fade;
    // door stays just ajar: the next scene opens it the rest of the way
    $('#mDoor').style.setProperty('--open', (0.2 + 0.15 * ease(seg(p, 0.6, 1))).toFixed(3));
    scene.style.background = mixBg(seg(p, 0.1, 0.95));

    var nA = p < 0.2 ? 0 : Math.min(5, 1 + Math.floor(seg(p, 0.2, 0.46) * 5));
    var nB = p < 0.56 ? 0 : Math.min(5, 1 + Math.floor(seg(p, 0.56, 0.84) * 5));
    var todayM = p < 0.56 ? nA - 1 : 5 + nB - 1;
    mSlabEls.forEach(function (el, i) {
      el.classList.toggle('pending', i < 5 ? i >= nA : i - 5 >= nB);
      el.classList.toggle('today', i === todayM && p < 0.86 && (p < 0.48 || p >= 0.56));
    });

    var pos = climbAt(p);
    mOru.style.left = pos[0].toFixed(1) + 'px';
    mOru.style.top = pos[1].toFixed(1) + 'px';
    mOru.style.setProperty('--sq', pos[2].toFixed(3));

    var img = p >= 0.5 ? 3 : 2;
    if (img !== lastMImg) { mOru.src = 'assets/character/oreumi' + img + '.png'; lastMImg = img; }
    var name = p < 0.5 ? '2단계 둘러보기' : (p < 0.86 ? '3단계 마주하기' : '4단계 도전하기');
    var nameEl = $('#stageName');
    if (name !== lastName) {
      nameEl.textContent = name;
      nameEl.classList.remove('flash'); void nameEl.offsetWidth; nameEl.classList.add('flash');
      lastName = name;
    }
  }

  /* ======================================================
     S09 door, S10 epilogue
     ====================================================== */
  // the door swings open in the dark, then its light floods the room and the programs appear
  function updateDoor(scene, p) {
    $('#bigDoor').style.setProperty('--open', (0.35 + 0.65 * ease(seg(p, 0.05, 0.4))).toFixed(3));
    var flood = ease(seg(p, 0.42, 0.7));
    scene.style.setProperty('--flood', flood.toFixed(3));
    scene.classList.toggle('flooded', flood > 0.5);
  }
  function updateEpilogue() {}
  $('#shareBtn').addEventListener('click', function () {
    var msg = $('#shareMsg');
    var url = location.href.split('#')[0];
    function fallback() { msg.textContent = '이 주소를 복사해 전해 주세요: ' + url; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { msg.textContent = '링크를 복사했어요. 안부와 함께 전해 주세요.'; }, fallback);
    } else { fallback(); }
  });

  /* ======================================================
     One-screen engine
     ====================================================== */
  var scenes = $$('.scene');
  var handlers = { intro: function () {}, hook: updateHook, building: updateBuilding, wall: updateWall, step1: updateStep1, montage: updateMontage, door: updateDoor, epilogue: updateEpilogue };
  var starts = [], total = 0;
  scenes.forEach(function (s) { starts.push(total); total += parseFloat(s.dataset.len); });
  var END = total - 0.0001;
  var P = 0, T = 0, active = -1;
  var topbar = $('#topbar'), ui = $('#storyUi'), bar = $('#progressBar'), chapter = $('#chapter');
  var logo = $('.topbar .logo'), logoMode = 'white';
  var hint = $('#hint');

  /* beats: each scene lists its resting points (data-beats, local progress).
     One scroll gesture / swipe / key press moves to the next beat, and the story plays
     smoothly from one beat to the next — so a fast trackpad can't skip past a scene. */
  var beats = [];
  scenes.forEach(function (s, i) {
    (s.dataset.beats || '0').split(',').forEach(function (b) {
      beats.push(Math.min(END, starts[i] + parseFloat(b) * parseFloat(s.dataset.len)));
    });
  });
  beats.sort(function (a, b) { return a - b; });

  /* slow zones (data-slow="a-b:factor"): moments like a jump or walking through a door
     take longer to play, whatever the size of the scroll */
  var slow = [];
  scenes.forEach(function (s, i) {
    (s.dataset.slow || '').split(',').filter(Boolean).forEach(function (z) {
      var m = z.split(':'), r = m[0].split('-'), L = parseFloat(s.dataset.len);
      slow.push([starts[i] + parseFloat(r[0]) * L, starts[i] + parseFloat(r[1]) * L, parseFloat(m[1])]);
    });
  });
  function weight(x) { for (var i = 0; i < slow.length; i++) if (x >= slow[i][0] && x < slow[i][1]) return slow[i][2]; return 1; }

  var tw = null;                                // { from, to, t0, dur, cum }
  var TN = 160;
  function tweenTo(target) {
    target = clamp(target, 0, END);
    hint.classList.add('off');
    var cum = [0];
    for (var i = 1; i <= TN; i++) {
      var x0 = lerp(P, target, (i - 1) / TN), x1 = lerp(P, target, i / TN);
      cum.push(cum[i - 1] + Math.abs(x1 - x0) * weight((x0 + x1) / 2));
    }
    T = target;
    tw = { from: P, to: target, t0: performance.now(), cum: cum, dur: reduced ? 0 : clamp(560 + 340 * cum[TN], 700, 6500) };
    kick();
  }
  // where along the tween we are, given the share of (weighted) distance covered
  function tweenAt(u) {
    var c = tw.cum, w = u * c[TN], i = 1;
    while (i < TN && c[i] < w) i++;
    var f = c[i] > c[i - 1] ? (w - c[i - 1]) / (c[i] - c[i - 1]) : 1;
    return lerp(tw.from, tw.to, (i - 1 + f) / TN);
  }
  function step(dir) {
    var i, target = null;
    if (dir > 0) { for (i = 0; i < beats.length; i++) if (beats[i] > T + 1e-4) { target = beats[i]; break; } }
    else { for (i = beats.length - 1; i >= 0; i--) if (beats[i] < T - 1e-4) { target = beats[i]; break; } }
    if (target !== null) tweenTo(target);
  }

  function render() {
    var idx = 0;
    for (var i = 0; i < scenes.length; i++) if (P >= starts[i]) idx = i;
    var scene = scenes[idx];
    var p = clamp((P - starts[idx]) / parseFloat(scene.dataset.len));
    if (idx !== active) {
      scenes.forEach(function (s, k) { s.classList.toggle('active', k === idx); s.setAttribute('aria-hidden', k === idx ? 'false' : 'true'); });
      chapter.textContent = scene.dataset.chapter;
      active = idx;
    }
    $$('[data-in]', scene).forEach(function (el) {
      var a = parseFloat(el.dataset.in), b = el.dataset.out ? parseFloat(el.dataset.out) : 1.01;
      el.classList.toggle('on', p >= a && p < b);
    });
    handlers[scene.dataset.scene](scene, p);
    if (window.PXStory) window.PXStory.update(scene.dataset.scene, scene, p);

    var onLight = (scene.dataset.scene === 'door' && p > 0.56) || scene.dataset.scene === 'epilogue';
    topbar.classList.toggle('on-light', onLight);
    topbar.classList.toggle('on-intro', scene.dataset.scene === 'intro');
    ui.classList.toggle('on-light', onLight);
    var mode = onLight ? 'orange' : 'white';
    if (mode !== logoMode) { logo.src = 'assets/brand/logo-' + mode + '.png'; logoMode = mode; }
    bar.style.width = (P / END * 100).toFixed(2) + '%';
    $('#prevBtn').disabled = T <= beats[0] + 1e-4;
    $('#nextBtn').disabled = T >= beats[beats.length - 1] - 1e-4;
  }

  var running = false;
  function tick(now) {
    if (tw) {
      var k = tw.dur ? clamp((now - tw.t0) / tw.dur) : 1;
      P = tweenAt(ease(k));
      if (k >= 1) { P = tw.to; tw = null; }
    }
    render();
    if (tw) requestAnimationFrame(tick); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  /* inputs */
  // wheel: one gesture = one beat. Trackpad inertia (a decaying tail) never counts as a new gesture;
  // a new one starts when the push gets stronger again after a pause, or right after the last step has played.
  function busy(now) { return tw && tw.dur && (now - tw.t0) < tw.dur * 0.6; }
  var lastAbs = 0, wheelAcc = 0, wheelLast = 0, wheelLockAt = -1e9, locked = false;
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = performance.now();
    var dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    // a new gesture = a real pause, then a real push (inertia tails and frame hiccups don't count)
    var ad = Math.abs(dy), rising = ad >= 8 && ad > lastAbs * 1.3;
    var gap = now - wheelLast;
    if (((gap > 350 && rising) || (gap > 700 && ad >= 8)) && now - wheelLockAt > 500) { locked = false; wheelAcc = 0; }
    lastAbs = ad;
    wheelLast = now;
    if (locked) {
      if (now - wheelLockAt > 900 && rising && ad > 30 && !busy(now)) { locked = false; wheelAcc = 0; }   // a fresh flick right on the heels of the last one
      else return;
    }
    if (busy(now)) return;                      // the current step is still playing
    wheelAcc += dy;
    if (Math.abs(wheelAcc) >= 36) { step(wheelAcc > 0 ? 1 : -1); locked = true; wheelLockAt = now; wheelAcc = 0; }
  }, { passive: false });

  var touchY = null;
  window.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (touchY === null) return;
    var dy = touchY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 40 && !busy(performance.now())) step(dy > 0 ? 1 : -1);
    touchY = null;
  });

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    var onControl = /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (k === 'ArrowDown' || k === 'PageDown' || ((k === ' ' || k === 'Enter') && !onControl)) { e.preventDefault(); step(1); }
    else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); step(-1); }
    else if (k === 'Home') { e.preventDefault(); tweenTo(beats[0]); }
    else if (k === 'End') { e.preventDefault(); tweenTo(beats[beats.length - 1]); }
  });
  $('#nextBtn').addEventListener('click', function () { step(1); });
  $('#prevBtn').addEventListener('click', function () { step(-1); });
  $('#homeLink').addEventListener('click', function (e) { e.preventDefault(); tweenTo(0); });

  window.addEventListener('resize', function () { fitStages(); sizeHook(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStages);
  fitStages();
  sizeHook();
  render();
  requestAnimationFrame(hookLoop);
})();
