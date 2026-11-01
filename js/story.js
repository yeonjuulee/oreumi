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
      // 문 밖의 벽: drawn at full size on the desktop canvas (a little to the left of the column, so the doors get room)
      if (wrap.closest('.scene-wall') && window.matchMedia('(min-width: 901px) and (min-aspect-ratio: 4/3)').matches) s = 1;
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
  /* the last stage hands over to "두 개의 방": every Jeju dot flies into the dot apartment of the next scene (js/dots.js) */
  var OD = window.OreumDots, APT = OD ? OD.APT : [], NA = APT.length;
  var MAXP = Math.max(7170, NA);
  var aptU = new Float32Array(NA * 2), aptR = 2;
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
    { n: 1, r: 1.35, shape: 'jeju', leave: true }            // 점들이 아파트로 모이고, 준호·도희는 1·2층 창으로
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
  function stageR(S) { if (S.leave && NA) return aptR; return S.shape ? SHAPES[S.shape].spacing * HB * .54 : S.r * clamp(HB / 360, .6, 1); }
  function dotShade(i, st) {
    var S = STAGES[st];
    if (!S.shape) return .8;
    if (S.leave && i < NA) return APT[i].s;
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
    hcx = wide ? W * .725 : W / 2; hcy = wide ? H * .52 : H * .3;
    HB = wide ? Math.min(W * .195, H * .35) : Math.min(W * .4, H * .2);
    for (var i = 0; i < MAXP; i++) if (dpa[i] < .01) { dpx[i] = hcx + outPos[i][0] * HB * 2; dpy[i] = hcy + outPos[i][1] * HB * 2; }
    if (dpa[0] < .01) { dpx[0] = hcx; dpy[0] = hcy; }      // the first dot is born where the start screen's star shrinks to
    if (window.OreumIntro) { window.OreumIntro.cx = hcx; window.OreumIntro.cy = hcy; }
    buildBg(dpr);
  }
  function dotTarget(i, st) {
    var S = STAGES[st];
    if (S.leave) return (i === 0 || i === D2) ? SHAPES.jeju[i] : (i < NA ? [aptU[i * 2], aptU[i * 2 + 1]] : null);
    if (st === 0 && i === 0) return [0, 0];      // the start screen's star lands here as this dot
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
    var leaveT = 0, amap = null;
    if (S.leave && NA) {                      // where the dot apartment sits on screen (hook canvas units → shape units)
      var ar = $('#aptPx').getBoundingClientRect(), cr = cv.getBoundingClientRect(), cf = cr.width ? cv.clientWidth / cr.width : 1;
      amap = { sk: ar.width / 960 * cf, L: (ar.left - cr.left) * cf, T: (ar.top - cr.top) * cf };
      for (var ai = 0; ai < NA; ai++) { aptU[ai * 2] = (amap.L + APT[ai].x * amap.sk - hcx) / HB; aptU[ai * 2 + 1] = (amap.T + APT[ai].y * amap.sk - hcy) / HB; }
      aptR = OD.AS * .54 * amap.sk;
    }
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
    if (S.leave && amap) OD.aptContours(ctx, function (x, y) { return [amap.L + x * amap.sk, amap.T + y * amap.sk]; }, la);

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
    var paths = TERRAIN.map(function () { return []; }), solo = [], custom = {};
    for (var i = 0; i < MAXP; i++) {
      var tg = dotTarget(i, hookStage);
      var tx = hcx + (tg ? tg[0] : outPos[i][0]) * HB, ty = hcy + (tg ? tg[1] : outPos[i][1]) * HB;
      var k = reduced ? 1 : spd[i];
      if (!(S.leave && isHero[i])) { dpx[i] += (tx - dpx[i]) * k; dpy[i] += (ty - dpy[i]) * k; }
      dpa[i] += ((tg ? 1 : 0) - dpa[i]) * (reduced ? 1 : .07);
      if (tg) dsh[i] += (dotShade(i, hookStage) - dsh[i]) * (reduced ? 1 : .08);
      if (dpa[i] < .02 || isHero[i] || (hookStage === 0 && i === 0)) continue;   // stage 0: the start screen's dot is still the one on show
      if (dpa[i] < .95 || S.dim || (S.spill && i >= 6700 && !S.leave)) { solo.push(i); continue; }
      if (S.leave && i < NA && APT[i].c) { var ap = APT[i], near = Math.abs(dsh[i] - ap.s) < .06;
        if (near) { (custom[ap.c] = custom[ap.c] || []).push([i, OD.factor(ap)]); continue; } }
      paths[Math.min(TERRAIN.length - 1, Math.floor(dsh[i] * TERRAIN.length))].push(i);
    }
    paths.forEach(function (list, ci) {
      if (!list.length) return;
      ctx.fillStyle = TERRAIN[ci]; ctx.beginPath();
      list.forEach(function (i) { var rd = R * (.42 + .58 * dsh[i]); ctx.moveTo(dpx[i] + rd, dpy[i]); ctx.arc(dpx[i], dpy[i], rd, 0, 6.2832); });
      ctx.fill();
    });
    Object.keys(custom).forEach(function (col) {
      ctx.fillStyle = col; ctx.beginPath();
      custom[col].forEach(function (q) { var rd = R * q[1], i = q[0]; ctx.moveTo(dpx[i] + rd, dpy[i]); ctx.arc(dpx[i], dpy[i], rd, 0, 6.2832); });
      ctx.fill();
    });
    solo.forEach(function (si) {
      var a = dpa[si], col = TERRAIN[Math.min(TERRAIN.length - 1, Math.floor(dsh[si] * TERRAIN.length))];
      if (S.spill && si >= 6700) col = '#FFDCC4';
      if (S.leave && si < NA && APT[si].c && Math.abs(dsh[si] - APT[si].s) < .06) col = APT[si].c;
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
  var RB = { start: [330, 438], door: [630, 438], back: [540, 438] };   // y: where the bed frame's legs meet the floor
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
  var aptDrawn = '';
  function drawAptDots() {                    // the same dots the hook's last stage lands on, in stage px
    var r = aptPx.getBoundingClientRect(), hr = cv.getBoundingClientRect(), f = hr.width ? cv.clientWidth / hr.width : 1;
    var sk = r.width / 960 * f || 1, key = sk.toFixed(3);
    if (aptDrawn === key) return; aptDrawn = key;
    pxCtx.setTransform(aptPx.width / 960, 0, 0, aptPx.height / 540, 0, 0);
    OD.drawApt(pxCtx, OD.AS * .54, 10 / sk, 3 / sk);
  }
  function pxLoop(now) {
    var sc = $('.scene-building');
    if (sc.classList.contains('active') && buildingP < 0.2 && OD) drawAptDots();
    requestAnimationFrame(pxLoop);
  }
  requestAnimationFrame(pxLoop);
  function updatePrelude(p) {
    buildingP = p;
    var t = seg(p, 0.08, 0.18);                       // 0 = pixel art, 1 = vector
    var e = ease(t);
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
    // 2층 방: 현관 앞까지 걸어간 뒤(스크롤), 문 앞을 왔다 갔다 서성인다(실시간, roomPace)
    RBS.p = p;
    if (p >= 0.78) { if (RBS.t0 === null) RBS.t0 = performance.now(); return; }
    RBS.t0 = null;
    var walk = ease(seg(p, 0.68, 0.78));
    var x = lerp(RB.start[0], RB.door[0], walk), y = RB.start[1];
    var bob = walk > 0 && walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 6)) * 5 : 0;
    roomPose(x, y - bob, 1, 1);
    sigh.classList.remove('on');
  }
  function roomPose(x, y, flip, squash) {
    roomOru.style.setProperty('--x', x.toFixed(1) + 'px');
    roomOru.style.setProperty('--y', y.toFixed(1) + 'px');
    roomOru.style.setProperty('--flip', flip);
    roomOru.style.setProperty('--squash', squash.toFixed(3));
    sigh.style.setProperty('--x', (x - 40).toFixed(1) + 'px');
    sigh.style.setProperty('--y', (y - 124).toFixed(1) + 'px');
  }
  /* 1층: sitting on the floor, the oreumi tosses a piece of trash over its shoulder every few seconds (real time).
     Its body winds up (squash, lean back, spikes in), flings (stretch, lean forward, spikes out), settles; the trash flies
     in an arc, lands with a little bounce, lies there a moment, fades. */
  var TOSS = { svg: $('#roomOruA svg'), items: $$('#roomToss .toss-i'), t0: null, CYC: 3400 };
  if (TOSS.svg) { TOSS.all = TOSS.svg.querySelector('.all'); TOSS.hair = TOSS.svg.querySelector('.hair'); TOSS.face = TOSS.svg.querySelector('.face'); }
  var TOSS_TO = [[690, 512], [742, 524], [612, 524]];
  function tossPose(o) {
    var sx = 1 - o.sq * .55, sy = 1 + o.sq;
    TOSS.all.setAttribute('transform', 'translate(149 161) skewX(' + o.lean.toFixed(2) + ') scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ') translate(-149 -161)');
    TOSS.hair.setAttribute('transform', 'translate(149 161) scale(' + (1 + o.fluff * .08).toFixed(3) + ' ' + (1 + o.fluff * .05).toFixed(3) + ') translate(-149 -161)');
    TOSS.face.setAttribute('transform', 'translate(' + (o.look || 0).toFixed(1) + ' ' + (o.face || 0).toFixed(1) + ')');
  }
  (function roomToss(now) {
    var sc = $('.scene-building');
    if (TOSS.svg && sc.classList.contains('active') && sc.dataset.phase === '1' && !reduced) {
      if (TOSS.t0 === null) TOSS.t0 = now + 1750;   // the room fades in after .75s; the first toss starts 1s after that
      if (now < TOSS.t0) { tossPose({ sq: Math.sin(now / 760) * .02, lean: 0, fluff: 0, face: 0, look: 0 }); TOSS.items.forEach(function (el) { el.style.opacity = 0; }); requestAnimationFrame(roomToss); return; }
      var e = now - TOSS.t0, n = Math.floor(e / TOSS.CYC), t = e % TOSS.CYC, o = { sq: Math.sin(now / 760) * .02, lean: 0, fluff: 0, face: 0, look: 0 };
      var eo = function (v) { return 1 - Math.pow(1 - v, 3); };
      if (t < 380) { var w = eo(t / 380); o.sq = -.16 * w; o.lean = -5 * w; o.fluff = -.4 * w; o.face = 2 * w; o.look = -4 * w; }
      else if (t < 560) { var u = (t - 380) / 180; o.sq = -.16 + .3 * Math.sin(Math.PI * u * .5); o.lean = lerp(-5, 9, eo(u)); o.fluff = Math.sin(Math.PI * u); o.look = lerp(-4, 6, u); }
      else if (t < 1200) { var v = (t - 560) / 640, b = Math.exp(-4 * v) * Math.cos(9 * v); o.sq = .12 * b; o.lean = 9 * Math.pow(1 - v, 2); o.fluff = .3 * b; o.look = 6 * (1 - v); }
      tossPose(o);
      var it = TOSS.items[n % TOSS.items.length], to = TOSS_TO[n % TOSS_TO.length], from = [492, 436];
      TOSS.items.forEach(function (el) { if (el !== it) el.style.opacity = 0; });
      if (t < 470) it.style.opacity = 0;
      else {
        var f = Math.min(1, (t - 470) / 650), x = lerp(from[0], to[0], f), y = lerp(from[1], to[1], f) - 110 * Math.sin(Math.PI * f), rot = 620 * f;
        if (f >= 1) { var g = (t - 1120) / 160; y = to[1] - (g < 1 ? 10 * Math.sin(Math.PI * g) : 0); rot = 620; }
        it.style.transform = 'translate(' + (x - 12).toFixed(1) + 'px,' + (y - 12).toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg)';
        it.style.opacity = t > 3000 ? Math.max(0, 1 - (t - 3000) / 300) : 1;
      }
    } else if (TOSS.svg) TOSS.t0 = null;
    requestAnimationFrame(roomToss);
  })(performance.now());
  /* pacing in front of the door: a few steps right to the door, a stop (a sigh), a few steps back, a short stop, again */
  var RBS = { p: 0, t0: null };
  var PACE = [[0, 1200, RB.door[0], RB.door[0] + 50], [1200, 2100, RB.door[0] + 50, RB.door[0] + 50], [2100, 3700, RB.door[0] + 50, RB.door[0] - 90], [3700, 4300, RB.door[0] - 90, RB.door[0] - 90], [4300, 5000, RB.door[0] - 90, RB.door[0]]];
  (function roomPace(now) {
    if (RBS.t0 !== null && $('.scene-building').classList.contains('active')) {
      var t = reduced ? 1500 : (now - RBS.t0) % 5000, k = 0;
      while (k < PACE.length - 1 && t >= PACE[k][1]) k++;
      var S = PACE[k], u = (t - S[0]) / (S[1] - S[0]), moving = S[2] !== S[3];
      var x = lerp(S[2], S[3], moving ? (u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)) : 0);
      var steps = Math.abs(S[3] - S[2]) / 22, ph = u * steps * Math.PI;
      var bob = moving ? Math.abs(Math.sin(ph)) * 5 : 0;
      var flip = k === 2 || (k === 3) ? -1 : 1;                 // faces the way it walks; at the door it faces the door
      var squash = moving ? 1 - Math.abs(Math.cos(ph)) * .04 : (k === 1 ? .94 + .02 * Math.sin(u * Math.PI) : 1 + Math.sin(now / 500) * .01);
      roomPose(x, RB.door[1] - bob, flip, squash);
      sigh.classList.toggle('on', k === 1 && u > .1 && u < .95);
    }
    requestAnimationFrame(roomPace);
  })(performance.now());

  /* ======================================================
     S03–S04 wall: the youths step out onto their terraces. Support doors stand on top of the wall.
     3F jumps up easily; 1F · 2F can't reach. The oreum symbol breaks the wall into stairs.
     ====================================================== */
  /* 38 × 15 pixel tiles (16px). Columns 0–19 = 1~4단계 (5 columns each, 3(s+1) tiles high);
     columns 20–37 = the plateau that holds the four 지원 프로그램 doors and never falls. */
  var GROUND = 500, B = 16, COLS = 38, ROWS = 15, X0 = 300, SW = 5, PLAT = 20;
  var NC = COLS + 40;                           // + plateau columns past the stage, out to the screen edge
  var TOP = GROUND - ROWS * B;                  // 260: top of the wall
  var WALL_TONES = ['#332E2A', '#332E2A', '#332E2A', '#332E2A'];   // one flat colour: the wall reads as a single slab
  var STEP_TONES = [                            // the stairs' colours (design F: the population page's terrain dots)
    ['#B0602F', '#AA5C2C', '#B66432', '#AD5E2E'],
    ['#D47838', '#CE7434', '#DA7C3C', '#D17636'],
    ['#F2924E', '#EC8E4A', '#F69652', '#EF904C'],
    ['#FFB682', '#FAB27E', '#FFBA86', '#FCB480'],
    ['#FFDCC4', '#FAD8C0', '#FFE0C8', '#FCDAC2']
  ];
  var blocksEl = $('#blocks');
  var wallHt = [], wallHtDone = false;
  (function () {                                 // four step blocks + the plateau, under the step labels
    var host = $('#stairGrain'); if (!host) return;
    for (var s2 = 0; s2 < 5; s2++) {
      var d = document.createElement('div'), x = X0 + s2 * SW * B, top = s2 < 4 ? GROUND - 3 * B * (s2 + 1) : TOP;
      d.className = 'wall-ht';
      d.style.left = x + 'px'; d.style.top = top + 'px';
      d.style.width = (s2 < 4 ? SW * B : (NC - PLAT) * B) + 'px'; d.style.height = (GROUND - top) + 'px';
      d.dataset.fade = GROUND - top; d.dataset.pitch = 6;   // each step fades over its own height, down to the ground
      host.parentNode.insertBefore(d, host);
      wallHt.push(d);
    }
  })();
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
  var RUN4 = frames('run4-', 9);
  var HOP2 = frames('climb3-', 7);
  var HOP2_REST = HOP2[5];           // the standing (basic) figure is frame 6; frames 1 and 7 are the squash before / after a jump     // 2단계 오르미: squash → stretch → land (stepping up the montage stairs)     // 4단계 오르미: 1–6 run cycle, 7 joy, 8 leap, 9 stand
  function setSrc(el, src) { if (el.getAttribute('src') !== src) el.setAttribute('src', src); }

  var HIT = { x: 430, y: 330 };                 // where the symbol strikes the wall (left part, over the future stairs)
  var FLY_FROM = { x: -120, y: 40 };
  var doors = $$('.wall-door');
  var DOOR_L = 656, DOOR_W = 44, DOOR_GAP = 74;  // the four support doors (stage px): left edge of the first, width, pitch
  var DOOR1 = DOOR_L + DOOR_W / 2;              // centre of the first door (3F walks in here)
  doors.forEach(function (d, k) { d.style.left = (DOOR_L + k * DOOR_GAP) + 'px'; });

  // the youths: feet points on their terraces, and where they land on the stairs
  // the 4-storey apartment (assets/building/apartment.svg, 3042 × 4236 drawn at 256px wide, its base on the ground):
  // balcony floors 1F–4F (FLOOR[4] only keeps the unused 5F code quiet)
  var TX = 226, APT_S = 256 / 3042, FLOOR = [3882.93, 2951.61, 2020.29, 1089.96].map(function (y) { return 500 - (4192 - y) * APT_S; }).concat([160]);
  var oru1 = $('#wallOru'), oru2 = $('#wallOru2'), oru3 = $('#wallOru3'), oru4 = $('#wallOru4'), oru5 = $('#wallOru5');
  var WALL_UP = GROUND - TOP;                   // the wall (and its doors) start below the ground and rise this far
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

  /* 1F · 2F (1·2단계 SVG) and 3F (3단계 SVG) on the wall scene. updateWall sets where each one is and what it is doing;
     this loop draws them every frame, so breathing, blinking and the shiver keep going while the page rests. */
  var W1 = null, W2 = null, W3 = null, W4 = null, WS = { p: 0, fade: 1, o: 0 }, WT = { climb: null, tryT: null };
  var O4_SVG = "<svg viewBox=\"-20 -20 322 322\" aria-hidden=\"true\"><g id=\"o4-all\"><g id=\"o4-hair\"><path d=\"M258.207 173.217C258.837 177.087 258.947 182.897 256.157 189.217C250.877 201.187 238.557 205.717 236.897 206.277C236.767 206.317 236.707 206.337 236.707 206.337C236.707 206.337 237.247 207.477 237.737 209.377C238.647 212.937 239.397 219.147 236.127 225.497C231.117 235.227 218.807 237.377 218.807 237.377V237.397C218.817 237.537 218.827 238.367 218.297 239.497C217.037 242.187 212.667 246.537 197.717 247.017C196.997 247.037 196.217 247.067 195.367 247.107C179.517 247.727 142.347 250.047 142.347 250.047C142.347 250.047 116.507 251.297 101.307 249.767C98.0468 249.437 95.2768 248.987 93.3568 248.367C83.0268 245.037 78.9568 237.127 78.5568 236.297C78.5268 236.247 78.5168 236.227 78.5168 236.227C78.5168 236.227 77.1568 236.407 74.8968 236.507C66.8368 236.877 47.3768 236.307 38.2268 223.307C27.4568 208.027 34.7568 195.597 35.0268 195.147H35.0368C35.0368 195.147 34.9968 195.137 34.9268 195.117H34.8968C34.2468 195.027 31.4168 194.577 27.6168 193.127C18.1468 189.507 2.67676 179.647 0.236764 153.567C-3.02324 118.647 28.4168 111.087 30.9368 110.537C31.0468 110.517 31.0967 110.507 31.0967 110.507C31.0967 110.507 29.0669 107.267 27.2069 102.057C23.5469 91.8467 20.5568 74.0867 34.8168 58.3267C58.8268 31.7867 91.0268 52.2867 91.0268 52.2867C91.0268 52.2867 91.0268 52.2367 91.0168 52.1467C90.9568 51.1367 90.6668 45.2567 92.1268 37.7867C94.8468 23.9367 103.607 4.60668 131.007 0.686679C178.007 -6.02332 192.207 38.5867 193.017 41.2867C193.017 41.2867 193.017 41.3167 193.027 41.3267C193.047 41.3867 193.057 41.4167 193.057 41.4167C193.057 41.4167 193.127 41.2967 193.277 41.0767C194.157 39.7567 197.677 34.9367 203.787 32.3567C208.257 30.4767 214.097 29.7967 221.287 32.5667C249.877 43.5867 250.127 86.9267 250.127 86.9267C250.127 86.9267 250.147 86.9267 250.197 86.9267C250.697 86.8667 253.847 86.5467 257.997 87.3267C264.157 88.4667 272.517 91.9967 277.687 102.337C293.907 134.777 256.907 168.377 256.907 168.377H256.917C256.977 168.547 257.737 170.357 258.207 173.227V173.217Z\" fill=\"#FF6A00\"/><path d=\"M219.477 206.176C227.277 222.616 218.057 230.126 218.057 230.126L207.097 231.996C205.617 240.716 200.067 245.006 195.367 247.106C179.517 247.726 142.347 250.046 142.347 250.046C142.347 250.046 116.507 251.296 101.307 249.766C101.627 248.466 101.857 246.956 101.487 246.096C100.727 244.376 91.5471 246.306 85.6571 237.356C75.0271 221.196 92.417 200.246 102.717 197.316C89.537 189.546 87.2871 167.176 87.2871 167.176L223.537 142.516C234.807 169.946 205.327 192.476 205.327 192.476C205.327 192.476 215.547 197.876 219.477 206.176Z\" fill=\"#E04004\"/><path d=\"M203.787 32.3555C201.597 47.1855 197.757 61.4055 192.127 74.9555C194.017 62.6255 194.807 51.0755 193.027 41.3255C193.017 41.3255 193.017 41.2955 193.017 41.2855L203.787 32.3555Z\" fill=\"#E04004\"/><path d=\"M257.997 87.3165C253.647 96.3165 248.477 104.727 242.447 112.517C246.477 103.467 249.497 94.7665 250.197 86.9165C250.697 86.8565 253.847 86.5365 257.997 87.3165Z\" fill=\"#E04004\"/><path d=\"M256.917 168.377C252.787 172.007 247.087 174.947 240.697 177.587C246.637 176.687 252.467 175.217 258.207 173.217L256.917 168.377Z\" fill=\"#E04004\"/><path d=\"M237.738 209.378C233.568 209.708 229.438 209.628 225.348 209.128C229.698 208.608 233.698 207.778 236.828 206.258L236.898 206.278L237.738 209.378Z\" fill=\"#E04004\"/><path d=\"M218.297 239.496C216.237 237.706 214.407 235.726 212.807 233.566C214.837 235.256 216.847 236.656 218.807 237.396L218.297 239.496Z\" fill=\"#E04004\"/><path d=\"M111.227 76.3771C104.907 66.5271 98.3065 57.9071 91.0165 52.1471C90.9565 51.1371 90.6665 45.2571 92.1265 37.7871C100.197 49.9971 106.607 62.8471 111.227 76.3771Z\" fill=\"#E04004\"/><path d=\"M59.507 111.707C49.097 109.987 39.3369 109.217 31.0869 110.637L30.937 110.537C31.047 110.517 31.0969 110.507 31.0969 110.507C31.0969 110.507 29.067 107.267 27.207 102.057C38.427 104.107 49.197 107.287 59.507 111.707Z\" fill=\"#E04004\"/><path d=\"M35.0272 195.147L35.1172 195.127C38.7372 189.627 44.4272 184.427 51.0072 179.367C42.7572 182.997 34.9672 187.607 27.6172 193.127L35.0272 195.147Z\" fill=\"#E04004\"/><path d=\"M78.5964 236.226L78.5565 236.296L78.5165 236.226C78.5165 236.226 77.1565 236.406 74.8965 236.506C75.7065 231.796 76.9665 227.236 78.6865 222.836C78.0365 227.766 77.8064 232.366 78.5964 236.226Z\" fill=\"#E04004\"/></g><path d=\"M109.986 196.176L196.756 192.236C199.2 205 199.2 222 197.416 235.136L194 258.2L103 258.2L103.466 245.326L103.636 242.506C102.4 226 104 210 109.986 196.176Z\" fill=\"#F9EDDE\"/><path d=\"M162.677 253.906C155.917 257.636 154.007 261.036 152.467 268.636L151.217 258.096L146.587 258.566L143.037 268.356L146.417 255.876L162.677 253.906Z\" fill=\"#F8D5B7\"/><g id=\"o4-legL\"><path d=\"M143.037 268.356L146.587 258.566L148.5 248L103.467 245.326L102.267 265.136C102.267 265.136 100.637 267.346 100.097 269.296C99.5266 271.346 99.5667 274.736 101.707 277.136C103.847 279.536 108.217 280.476 110.917 280.886C116.797 281.786 125.237 282.416 133.867 281.126C136.407 280.756 138.717 280.066 140.907 278.676C144.277 276.546 145.017 271.866 143.037 268.356Z\" fill=\"#F9EDDE\"/></g><g id=\"o4-legR\"><path d=\"M190.727 263.907C193.947 254.987 196.197 245.417 197.417 235.137L151.217 249V258.097L152.467 268.637C150.597 272.987 152.707 277.427 157.117 279.097C161.667 280.827 166.517 281.357 171.497 281.367C178.317 281.387 187.787 281.247 192.937 277.367C195.907 275.127 197.037 270.647 194.887 267.467C193.627 265.607 190.727 263.907 190.727 263.907Z\" fill=\"#F9EDDE\"/></g><g id=\"o4-handR\"><path d=\"M217.266 232.016C224.336 225.196 222.996 213.946 216.976 205.226C210.966 196.516 196.756 192.236 196.756 192.236C194.004 195.824 188.5 204 188.5 208C188.5 213 192 227.5 193.5 231C194.7 233.8 196.611 234.924 197.416 235.136C197.416 235.136 198.906 235.706 201.196 236.106C205.356 236.816 212.136 236.956 217.266 232.016Z\" fill=\"#F9EDDE\"/><path d=\"M197.416 235.135C197.626 231.735 197.325 224.715 196.105 218.805C197.905 222.065 200.066 230.635 201.196 236.105C198.906 235.705 197.416 235.135 197.416 235.135Z\" fill=\"#F8D5B7\"/></g><g id=\"o4-handL\"><path d=\"M89.7062 237.686C95.3762 243.636 103.636 242.506 103.636 242.506C105.5 242.506 107.496 241.77 109.5 241C111.741 240.139 113.607 237.34 114.493 236.011L114.5 236C116.5 233 118.5 228 124 224L109.986 196.176C109.986 196.176 96.2261 199.986 88.7161 212.596C82.6361 222.796 84.0362 231.736 89.7062 237.686Z\" fill=\"#F9EDDE\"/><path d=\"M123.935 223.977C123.725 224.157 120.245 227.217 117.495 233.537C115.185 238.847 113.795 240.267 109.755 243.077C107.685 244.517 105.295 245.097 103.465 245.327L103.635 242.507C103.635 242.507 111.295 243.007 116.055 233.647C119.995 225.917 123.705 224.077 123.935 223.977Z\" fill=\"#F8D5B7\"/></g><path d=\"M86.137 161.165C85.687 188.105 109.987 196.175 109.987 196.175C112.325 196.784 118.535 197.971 122.5 198.5C130 199.5 134 200 159 200C179 200 192.505 194.157 196.757 192.235C204.447 188.245 227.827 175.485 226.807 147.825C225.787 120.165 197.267 94.2054 154.997 101.145C114.747 107.765 86.587 134.215 86.137 161.165Z\" fill=\"#F9EDDE\"/><path d=\"M196.755 192.234C193.425 193.884 189.275 194.744 185.125 195.614C189.935 195.464 196.555 195.464 202.165 194.314L196.755 192.234Z\" fill=\"#F8D5B7\"/><path d=\"M109.946 196.186H109.986C113.606 197.376 118.006 197.916 122.576 198.316C112.556 199.086 108.156 198.916 104.426 198.436L109.946 196.186Z\" fill=\"#F8D5B7\"/><g id=\"o4-face\"><g id=\"o4-eyes\"><path d=\"M189.666 156.207C193.891 156.207 197.316 151.77 197.316 146.297C197.316 140.824 193.891 136.387 189.666 136.387C185.441 136.387 182.016 140.824 182.016 146.297C182.016 151.77 185.441 156.207 189.666 156.207Z\" fill=\"black\"/><path d=\"M141.867 160.207C146.092 160.207 149.517 155.77 149.517 150.297C149.517 144.824 146.092 140.387 141.867 140.387C137.642 140.387 134.217 144.824 134.217 150.297C134.217 155.77 137.642 160.207 141.867 160.207Z\" fill=\"black\"/></g><path d=\"M173.757 157.457C173.757 159.807 170.847 162.007 167.267 162.377C163.687 162.747 160.777 161.127 160.777 158.777C160.777 156.427 163.687 154.227 167.267 153.857C170.847 153.487 173.757 155.107 173.757 157.457Z\" fill=\"black\"/><path d=\"M178.867 165.488C178.887 168.878 178.447 171.938 176.837 174.888C176.587 175.338 176.337 175.788 176.067 176.208C173.897 179.648 170.977 181.938 165.267 181.598C158.937 181.218 156.147 176.828 154.867 173.938C154.417 172.908 154.087 171.858 153.867 170.818C153.497 169.008 153.477 167.238 153.717 165.748C153.897 164.618 155.157 164.668 156.347 165.128C160.497 166.738 164.137 166.558 168.317 164.618C171.977 166.208 174.847 165.428 177.117 163.928C178.397 163.078 178.867 164.268 178.867 165.488Z\" fill=\"#F84621\"/><path d=\"M176.067 176.208C173.897 179.648 170.977 181.938 165.267 181.598C158.937 181.218 156.147 176.828 154.867 173.938C154.417 172.908 154.087 171.858 153.867 170.818C158.267 170.008 165.657 170.308 176.067 176.208Z\" fill=\"#FB5E3C\"/></g></g></svg>";
  function wallSvgInit() {
    if (W1) return;
    var cam = $('#wallCam');
    W1 = { o: makeOru('c1', cam, $('#wallOru')), st: { mode: 'idle', op: 0, x: 0, y: 0 }, sh0: 0 };
    W2 = { o: makeOru('c2', cam, $('#wallOru2')), st: { mode: 'idle', op: 0, x: 0, y: 0 }, sh0: 0 };
    var w = M3.el.cloneNode(true); w.className = 'm3-oru wall-m3'; w.style.cssText = 'width:' + (361 * 58 / 321).toFixed(1) + 'px';
    cam.insertBefore(w, $('#wallOru3').nextSibling);
    var g = function (id) { return w.querySelector('#m3-' + id); };
    W3 = { el: w, P: { all: g('all'), hair: g('hair'), hL: g('handL'), hR: g('handR'), fL: g('footL'), fR: g('footR'), eyes: g('eyes'), face: g('face') }, st: { mode: 'idle', op: 0, x: 0, y: 0, sc: 1 } };
    var w4 = document.createElement('div'); w4.className = 'm3-oru wall-o4'; w4.setAttribute('aria-hidden', 'true'); w4.innerHTML = O4_SVG;
    w4.style.cssText = 'width:' + (322 * 54 / 282).toFixed(1) + 'px';
    cam.insertBefore(w4, $('#wallOru4').nextSibling);
    var g4 = function (id) { return w4.querySelector('#o4-' + id); };
    W4 = { el: w4, P: { all: g4('all'), hair: g4('hair'), lL: g4('legL'), lR: g4('legR'), hL: g4('handL'), hR: g4('handR'), eyes: g4('eyes') } };
    (function wallSvgLoop(now) {
      if ($('.scene-wall').classList.contains('active')) {
        var e = WT.climb === null ? -1 : now - WT.climb;
        var f4 = climbFrame(e, now, FLOOR[3], [450, 1250], [1330, 3150], [3150, 3650], DOOR_X0[1], 58, 360 / Math.PI / 2, true);
        wallFour(f4, now);
        W3.st = climbFrame(e, now, FLOOR[2], [1400, 2350], [2480, 4350], [4350, 4850], DOOR_X0[0], 62, 24 / Math.PI, false);
        wallBig(now);
        doorGlow(0, W3.st.glow); doorGlow(1, f4.glow);
        wallSmall(W1, now, 56); wallSmall(W2, now, 54);
      }
      requestAnimationFrame(wallSvgLoop);
    })(performance.now());
  }
  function wallSmall(W, now, w) {
    var st = W.st, o, cfg = W.o.cfg;
    W.o.el.style.opacity = st.op;
    if (!(st.op > 0)) return;
    if (st.mode === 'hop') { o = W.o.jump(st.k); o.lean = 0; }
    else if (st.mode === 'try') {
      // real time from the moment the scroll reaches them: two hops straight up (the second lower),
      // then a light, slow tremble with the eyes half shut — 2.6s, a short rest (eyes still heavy), again
      var t = WT.tryT === null ? 0 : now - WT.tryT - st.delay, gap = 380, j2 = st.jt + gap, shAt = j2 + st.jt + 120;
      if (t < 0 || reduced) { o = W.o.idle(now); W.o.pose(st.x, st.y, w, o, 1); return; }
      if (t < st.jt || (t >= j2 && t < j2 + st.jt)) {
        var hk = t < st.jt ? t / st.jt : (t - j2) / st.jt, hh = t < st.jt ? st.H : st.H * .62;
        o = W.o.jump(hk); o.lean = 0;
        W.o.pose(st.x, st.y - hh * Math.sin(Math.PI * seg(hk, cfg.pre, .8)), w, o, 1); return;
      }
      if (t < shAt) { W.o.pose(st.x, st.y, w, W.o.idle(now), 1); return; }
      var u = (t - shAt) % 4000, k = seg(u, 0, 220) * (1 - seg(u, 2300, 2600));
      o = W.o.idle(now);
      o.sq = -.05 * k + Math.sin(u * .068) * .012 * k; o.lean = Math.sin(u * .047) * .5 * k; o.fluff = Math.sin(u * .083) * .15 * k;
      var heavy = Math.max(k, seg(t - shAt, 0, 220) * .6);
      o.face = -3 * heavy; o.drop = 1.5 * heavy; o.look = 0; o.blink = Math.max(o.blink, .55 * seg(t - shAt, 0, 220));
      var jit = (Math.sin(u * .04) * .5 + Math.sin(u * .096) * .2) * k;
      W.o.pose(st.x + jit, st.y, w, o, 1); return;
    }
    else o = W.o.idle(now);
    W.o.pose(st.x, st.y, w, o, 1);
  }
  function m3T(el, t) { if (el) el.setAttribute('transform', t); }
  var DOOR_X0 = [DOOR1, DOOR1 + DOOR_GAP];
  function doorGlow(k, g) {
    var d = doors[k]; if (!d) return;
    d.style.filter = g > 0.01 ? 'brightness(' + (1 + .25 * g).toFixed(3) + ') drop-shadow(0 0 ' + (16 * g).toFixed(1) + 'px rgba(255, 190, 140, ' + (.85 * g).toFixed(2) + '))' : '';
  }
  /* one climber's frame e ms after the climb started (e < 0: not yet): jump J onto the wall, run R to the door, go in I.
     stride: px per half step (3F) / per full step (4F) */
  function climbFrame(e, now, base, J, R, I, doorX, H, stride, full) {
    var op = WS.fade, eof = function (t) { return 1 - Math.pow(1 - t, 3); };
    if (e < 0 || e < J[0]) return { x: lerp(200, TX, WS.o), y: base, mode: 'idle', op: WS.o * op, sc: 1 };
    if (e < J[1]) {
      var k = (e - J[0]) / (J[1] - J[0]), fly = seg(k, full ? .32 : .3, .8), ef = ease(fly);
      return { x: lerp(TX, 322, ef), y: lerp(base, TOP, ef) - H * Math.sin(Math.PI * fly), mode: 'jump', k: k, op: op, sc: 1 };
    }
    if (e < R[0]) return { x: 322, y: TOP, mode: 'idle', op: op, sc: 1 };
    if (e < R[1]) {
      var u = e - R[0], d = R[1] - R[0], w = u / d, A = .12, v = 1 / (1 - A);
      var ew = w < A ? v * w * w / (2 * A) : (w > 1 - A ? 1 - v * (1 - w) * (1 - w) / (2 * A) : v * (w - A / 2));
      var kk = Math.min(1, u / (full ? 160 : 180)) * (1 - seg(w, full ? .9 : .92, 1) * (full ? .75 : .7));
      var ph = full ? u / 360 * 2 * Math.PI : u / 260 * Math.PI;
      var bob = full ? Math.abs(Math.cos(ph)) * 6 * kk : Math.abs(Math.sin(ph)) * 5 * kk;
      return { x: lerp(322, doorX, ew), y: TOP - bob, mode: 'run', ph: ph, k: kk, op: op, sc: 1 };
    }
    if (e < I[1]) { var g = seg(e, I[0], I[1]); return { x: doorX, y: TOP - 2, mode: 'idle', op: (1 - eof(g)) * op, sc: 1 - .35 * g, glow: Math.sin(Math.PI * Math.min(1, g * 1.2)) }; }
    return { x: doorX, y: TOP, mode: 'idle', op: 0, sc: 1, glow: Math.max(0, 1 - (e - I[1]) / 700) * .4 };
  }
  // 4단계 오르미: legs, hands, body, big hair, eyes
  function wallFour(st, now) {
    var P = W4.P, S = 54 / 282, o;
    W4.el.style.opacity = st.op;
    if (!(st.op > 0)) return;
    if (st.mode === 'jump') {        // wind-up (arms back, knees bend) → spring with arms up, legs tucked → land with legs apart
      var t = st.k, pre = seg(t, 0, .32), fly = seg(t, .32, .8), land = seg(t, .8, 1);
      o = { sq: 0, spread: 0, hair: 0, lean: 0 };
      if (t < .32) { var w = 1 - Math.pow(1 - pre, 3); o.sq = -.16 * w; o.armL = 38 * w; o.armR = -38 * w; o.lean = -3 * w; o.hair = .6 * w; o.spread = .4 * w; }
      else if (t < .8) {
        var up = Math.sin(Math.PI * fly);
        o.sq = lerp(.14, -.02, fly) * (1 - fly * .4); o.armL = lerp(-70, -20, fly); o.armR = lerp(70, 20, fly);
        o.tL = up * .8; o.tR = up * .6; o.legL = -18 * up; o.legR = 10 * up; o.lean = 6 * up; o.hair = lerp(-.9, .5, fly); o.hairRot = -4 * up;
      } else { var b = Math.exp(-5 * land) * Math.cos(land * 9); o.sq = -.15 * b; o.spread = .8 * b; o.hair = .5 * b; o.armL = -10 * b; o.armR = 10 * b; }
    } else if (st.mode === 'run') {  // legs and arms swing opposite, the hair bounces each step
      var s = Math.sin(st.ph), c2 = Math.cos(st.ph * 2), k = st.k;
      // seen from the front: the body stays upright; one foot lifts at a time (tipping a little toward the way it runs),
      // the opposite hand rises with it, and the hair bounces each step
      var tL = Math.max(0, -s) * .7 * k, tR = Math.max(0, s) * .7 * k;
      o = { sq: .03 * c2 * k, spread: 0, tL: tL, tR: tR, legL: -9 * tL, legR: -9 * tR, hLy: -9 * tR, hRy: -9 * tL,
        armL: 6 * tR, armR: -6 * tL, lean: 0, hair: (.45 * c2 - .08) * k, hairRot: 0 };
    } else {
      var br = reduced ? 0 : Math.sin(now / 560) * .015;
      o = { sq: br, spread: 0, hair: -br * 4, blink: !reduced && (now % 3400) < 140 ? 1 : 0 };
    }
    var sc = st.sc || 1;
    W4.el.style.transform = 'translate(' + (st.x - 161 * S).toFixed(1) + 'px,' + (st.y - 301 * S).toFixed(1) + 'px)';
    m3T(P.all, 'translate(141 281) skewX(' + (-(o.lean || 0)).toFixed(2) + ') scale(' + ((1 - o.sq * .5) * sc).toFixed(3) + ' ' + ((1 + o.sq) * sc).toFixed(3) + ') translate(-141 -281)');
    m3T(P.lL, 'translate(' + (o.spread * -8) + ' ' + (-(o.tL || 0) * 16) + ') rotate(' + (o.legL || 0).toFixed(1) + ' 124 250)');
    m3T(P.lR, 'translate(' + (o.spread * 8) + ' ' + (-(o.tR || 0) * 16) + ') rotate(' + (o.legR || 0).toFixed(1) + ' 172 250)');
    m3T(P.hL, 'translate(0 ' + (o.hLy || 0).toFixed(1) + ') rotate(' + (o.armL || 0).toFixed(1) + ' 112 204)');
    m3T(P.hR, 'translate(0 ' + (o.hRy || 0).toFixed(1) + ') rotate(' + (o.armR || 0).toFixed(1) + ' 194 200)');
    m3T(P.hair, 'rotate(' + (o.hairRot || 0).toFixed(2) + ' 141 200) translate(141 200) scale(' + (1 + (o.hair || 0) * .03).toFixed(3) + ' ' + (1 - (o.hair || 0) * .05).toFixed(3) + ') translate(-141 -200)');
    m3T(P.eyes, 'translate(0 148) scale(1 ' + (1 - (o.blink || 0) * .88).toFixed(3) + ') translate(0 -148)');
  }
  function wallBig(now) {
    var st = W3.st, P = W3.P, S = 58 / 321, o;
    W3.el.style.opacity = st.op;
    if (!(st.op > 0)) return;
    if (st.mode === 'jump') {
      var t = st.k, pre = seg(t, 0, .3), fly = seg(t, .3, .8), land = seg(t, .8, 1);
      o = { sq: 0, lift: 0, arms: 0, hair: 0, spread: 0, lean: 0 };
      if (t < .3) { o.sq = -.2 * (1 - Math.pow(1 - seg(pre, .3, 1), 3)); o.arms = .55 * Math.sin(Math.PI * Math.min(1, pre / .75)) - .35 * seg(pre, .75, 1); o.spread = seg(pre, .3, 1); o.hair = .5 * seg(pre, .3, 1); }
      else if (t < .8) { o.sq = lerp(.18, -.02, fly) * (1 - fly * .4); o.lift = Math.sin(Math.PI * Math.min(1, fly * 1.15)); o.arms = -.35 * (1 - fly) - .1 * Math.sin(Math.PI * fly); o.hair = lerp(-.8, .4, fly); o.lean = 6 * Math.sin(Math.PI * fly); }
      else { var b = Math.exp(-5 * land) * Math.cos(land * 9); o.sq = -.16 * b; o.spread = .6 * b; o.hair = .4 * b; }
    } else if (st.mode === 'run') {
      // one foot at a time, both arms up and down together each step, face steady, the spikes sway
      var s = Math.sin(st.ph), k = st.k, arms = .32 * (.5 - .5 * Math.cos(st.ph * 2)) * k;
      o = { sq: 0, lL: Math.max(0, s) * .9 * k, lR: Math.max(0, -s) * .9 * k, aL: arms, aR: arms, hair: .45 * Math.cos(st.ph * 2) * k, hairRot: 3.2 * s * k, spread: 0, lean: 0 };
    } else {
      var br = reduced ? 0 : Math.sin(now / 520) * .018;
      o = { sq: br, lift: 0, arms: 0, hair: -br * 4, spread: 0, blink: !reduced && (now % 3200) < 140 ? 1 : 0 };
    }
    var sc = st.sc || 1;
    W3.el.style.transform = 'translate(' + (st.x - 180 * S).toFixed(1) + 'px,' + (st.y - 237 * S).toFixed(1) + 'px)';
    m3T(P.all, 'translate(160 217) skewX(' + (o.lean || 0).toFixed(2) + ') scale(' + ((1 - o.sq * .55) * sc).toFixed(3) + ' ' + ((1 + o.sq) * sc).toFixed(3) + ') translate(-160 -217)');
    var lL = o.lL === undefined ? o.lift : o.lL, lR = o.lR === undefined ? o.lift : o.lR;
    m3T(P.fL, 'translate(' + (-o.spread * 10 + lL * 8) + ' ' + (-lL * 14) + ') rotate(' + (lL * 18) + ' 135 200)');
    m3T(P.fR, 'translate(' + (o.spread * 10 - lR * 8) + ' ' + (-lR * 14) + ') rotate(' + (-lR * 18) + ' 185 200)');
    var aL = o.aL === undefined ? o.arms : o.aL, aR = o.aR === undefined ? o.arms : o.aR;
    m3T(P.hL, 'rotate(' + (aL * 62) + ' 118 178) translate(' + (-aL * 6) + ' ' + (-Math.abs(aL) * 10) + ')');
    m3T(P.hR, 'rotate(' + (-aR * 62) + ' 202 178) translate(' + (aR * 6) + ' ' + (-Math.abs(aR) * 10) + ')');
    m3T(P.hair, 'rotate(' + (o.hairRot || 0).toFixed(2) + ' 160 150) translate(160 112) scale(' + (1 + o.hair * .025).toFixed(3) + ' ' + (1 - o.hair * .05).toFixed(3) + ') translate(-160 -112)');
    m3T(P.eyes, 'translate(0 149) scale(1 ' + (1 - (o.blink || 0) * .88).toFixed(3) + ') translate(0 -149)');
  }

  function updateWall(scene, p) {
    var zoom = ease(seg(p, 0.88, 1));            // zoom into 1·2단계: starts at 0.88 for transition to step1
    var cam = $('#wallCam');
    if (zoom > 0) {                              // aim at the step-1 scene's stage as it sits on screen (its layout differs per screen size)
      var wr = scene.querySelector('.stage').getBoundingClientRect(), sr = $('.scene-step1 .stage').getBoundingClientRect();
      var sw = wr.width / 960, s1 = sr.width / 960;
      if (sw > 0 && s1 > 0) {
        var zs = 154 / (3 * B) * s1 / sw;
        ZOOM = { s: zs, tx: (sr.left + S1.riser * s1 - wr.left) / sw - (X0 + SW * B) * zs, ty: (sr.top + 420 * s1 - wr.top) / sw - (GROUND - 3 * B) * zs };
      }
    }
    cam.style.transform = 'translate(' + (ZOOM.tx * zoom).toFixed(1) + 'px,' + (ZOOM.ty * zoom).toFixed(1) + 'px) scale(' + lerp(1, ZOOM.s, zoom).toFixed(4) + ')';
    var fadeOut = 1 - seg(zoom, 0, 0.5);
    $$('.corner, .terrace, .t-door, .apt', scene).forEach(function (el) { el.style.opacity = fadeOut; });
    $('#stepLabels').style.opacity = (p > 0.82 ? 1 : 0) * fadeOut;

    // "정부에서도 …": only the four doors, standing on the ground. "하지만 … 대면": the wall grows up under them and lifts them
    // 벽과 문이 "누군가에게는 쉽게 올라갈 수 있는 높이지만,"에 맞춰 최종 높이까지 일치하여 도달하도록 타이밍 조정
    var doorIn = seg(p, 0.13, 0.19);
    var rise = ease(seg(p, 0.22, 0.31));       // the whole wall is up within "하지만 그 모든 지원은 …"
    var lift = (1 - rise) * WALL_UP;
    blocksEl.style.clipPath = rise < 1 ? 'polygon(-600px -600px, 3600px -600px, 3600px ' + GROUND + 'px, -600px ' + GROUND + 'px)' : '';
    var built = blocks.length;
    var hit = seg(p, 0.77, 0.805);              // impact: shake + crack
    var fallT = seg(p, 0.78, 0.845);            // non-stair tiles fall
    var shake = (p >= 0.77 && p < 0.805) ? Math.sin(p * 2200) * 7 * (1 - hit) : 0;

    blocks.forEach(function (b, i) {
      var appear = clamp(built - i);
      var x = b.x + shake, y = b.y + lift, r = 0, o = rise > 0 ? 1 : 0;
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
      if (b.keep) {
        var lit = p > 0.81 + b.step * 0.008;
        b.el.classList.toggle('lit', lit);
        if (lit && wallHt[b.step]) b.el.style.opacity = 0;    // the halftone step takes over from its tiles
      }
    });
    // the stairs as dots, like the next scenes: one halftone block per step (and the plateau), solid at the tread,
    // the dots shrinking down to the ground
    if (!wallHtDone && p > 0.6) { wallHt.forEach(function (el, s2) { paintStep(el, s2); }); wallHtDone = true; }
    wallHt.forEach(function (el, s2) { el.style.opacity = p > 0.81 + s2 * 0.008 ? 1 : 0; /* stays through the zoom into the next scene */ });

    var sg = $('#stairGrain');
    sg.style.display = 'none';                   // (the grain overlay is replaced by the dots)
    if (!sg.dataset.ready) {
      var pts = [[X0, GROUND]];
      for (var st = 0; st < 4; st++) { pts.push([X0 + st * SW * B, GROUND - 3 * B * (st + 1)]); pts.push([X0 + (st + 1) * SW * B, GROUND - 3 * B * (st + 1)]); }
      pts = [[X0, GROUND], [X0, GROUND - 3 * B]].concat(pts.slice(2));
      pts.push([X0 + PLAT * B, TOP], [X0 + NC * B, TOP], [X0 + NC * B, GROUND]);
      sg.style.clipPath = 'polygon(' + pts.map(function (q) { return q[0] + 'px ' + q[1] + 'px'; }).join(',') + ')';
      sg.dataset.ready = 1;
    }
    sg.style.opacity = (p > 0.82 ? 0.7 : 0) * fadeOut;

    // the four entrances rise with the wall's top row; the first glows as 3F walks in
    var enter = seg(p, 0.44, 0.475) * (1 - seg(p, 0.49, 0.53));
    // on the ground the doors stand big (104 × 140, no signs); as the wall lifts them they shrink to their place on top
    var dk = ease(seg(p, 0.22, 0.31));
    doors.forEach(function (d, k) {
      var a = clamp(doorIn * 1.6 - k * 0.2);
      var dw = lerp(104, DOOR_W, dk), dh = lerp(140, 60, dk);
      d.style.width = dw.toFixed(1) + 'px'; d.style.height = dh.toFixed(1) + 'px';
      d.style.top = (TOP - dh).toFixed(1) + 'px';
      d.style.left = lerp(436 + k * 124, DOOR_L + k * DOOR_GAP, dk).toFixed(1) + 'px';
      var sg = d.querySelector('.ld-sign'); if (sg) sg.style.opacity = (1 - seg(dk, 0, .4)).toFixed(2);   // signs only on the big doors of "지원 프로그램"
      d.style.opacity = a * fadeOut;
      d.style.transform = 'translate(' + shake.toFixed(1) + 'px,' + (lift - (1 - a) * 14).toFixed(1) + 'px)';
    });

    // 3F · 4F · 5F: they step out with the others, then (at "누군가에게는 쉽게 …") each hops onto the wall
    // and walks into a door of their own: 5F → door 3, 4F → door 2, 3F → door 1. 1F · 2F can't reach.
    function climber(el, base, jump, walkEnd, doorX, h) {
      var o = seg(p, 0.02, 0.08), pos, op = o, sc = 1, moving = false;
      if (p < jump) { pos = [lerp(200, TX, o), base]; moving = o > 0 && o < 1; }
      else if (p < jump + 0.025) pos = arc([TX, base], [322, TOP], ease(seg(p, jump, jump + 0.025)), h);
      else if (p < walkEnd) {
        var w = ease(seg(p, jump + 0.025, walkEnd)); pos = [lerp(322, doorX, w), TOP]; moving = true;
        if (el !== oru5) pos[1] -= Math.abs(Math.sin(w * Math.PI * 7)) * 4;   // little bounces while walking
      }
      else { var g = seg(p, walkEnd, walkEnd + 0.015); pos = [doorX, TOP]; op = 1 - g; sc = 1 - 0.3 * g; }
      put(el, pos[0], pos[1], op * fadeOut, sc);
      return { pos: pos, op: op * fadeOut, sc: sc, moving: moving, jumping: p >= jump && p < jump + 0.025, jt: seg(p, jump, jump + 0.025) };
    }
    var DOOR_X = [DOOR1, DOOR1 + DOOR_GAP, DOOR1 + DOOR_GAP * 2];
    var c5 = climber(oru5, FLOOR[4], 0.41, 0.465, DOOR_X[2], 26);
    climber(oru4, FLOOR[3], 0.418, 0.47, DOOR_X[1], 30);
    var c3 = climber(oru3, FLOOR[2], 0.426, 0.475, DOOR_X[0], 40);
    // 4F (4단계 SVG) and 3F (3단계 SVG) jump onto the wall and run into doors 2 and 1. They play in real time, like the
    // mockup, from the moment the scroll reaches "누군가에게는 쉽게 …" (p 0.40); past 0.49 they are already inside.
    wallSvgInit();
    WS.p = p; WS.fade = fadeOut; WS.o = seg(p, 0.02, 0.08);
    var nowT = performance.now();
    if (p < 0.40) WT.climb = null; else if (p >= 0.49) WT.climb = -1e9; else if (WT.climb === null) WT.climb = nowT;
    if (p >= 0.49 && p < 0.60) { if (WT.tryT === null) WT.tryT = nowT; } else WT.tryT = null;
    oru4.style.opacity = 0; oru5.style.opacity = 0;   // 5F is left out for now (the building will become 4 storeys)
    // 5F runs with the sprite frames: a leap on the jump, running while it moves, standing when still
    var f5 = 'assets/character/oreumi4.png';
    if (c5.jumping) f5 = RUN4[c5.jt < 0.5 ? 7 : 6];
    else if (c5.moving) f5 = RUN4[Math.floor(c5.pos[0] / 13) % 6];
    setSrc(oru5, f5);

    // 1F · 2F: step out, try hops, wait for help, then hop onto their own stair
    function youth(el, base, peaks, land, t0, isOru1) {
      var o = seg(p, 0.02, 0.08), pos, W = isOru1 ? W1 : W2, cfg = W.o.cfg, st;
      var jt = seg(p, t0, t0 + 0.025);
      var sc = 1;
      // two hops straight up at the wall (the second lower), then a gentle shiver with half-shut eyes; later the hop onto their stair
      // (0.49–0.60 plays in real time like the mockup: see wallSmall)
      if (p < 0.49) st = { x: lerp(200, TX, o), y: base, mode: 'idle' };
      else if (p < 0.60) st = { x: TX, y: base, mode: 'try', H: peaks[0], delay: isOru1 ? 250 : 0, jt: isOru1 ? 1050 : 900 };
      else if (p < t0) st = { x: TX, y: base, mode: 'idle' };
      else {
        pos = arc([TX, base], land, ease(seg(jt, cfg.pre, .8)), 46);
        st = { x: pos[0], y: pos[1], mode: jt < 1 ? 'hop' : 'idle', k: jt };
      }
      st.op = o * fadeOut; W.st = st;
      put(el, st.x, st.y, 0, 1);
    }
    // they hop on only once the stairs have formed and all four have turned to their colour (last step lit at 0.834)
    youth(oru1, FLOOR[0], [20], [X0 + 46, GROUND - 3 * B], 0.845, true);         // → 1단계 (lands at 0.870)
    youth(oru2, FLOOR[1], [26], [X0 + SW * B + 46, GROUND - 6 * B], 0.853, false); // → 2단계 (lands at 0.878)
    oru3.style.opacity = 0;                      // 1F–3F are drawn by the SVG oreumi (wallSvgLoop); the imgs only hold their place

    // oreum symbol:
    // 1) "오름이 도와줄게요" (0.60 ~ 0.73): 아파트 위쪽 상공에 등장하여 머묾
    // 2) "오를 수 있는 네 개의 계단으로" (0.73 ~ 0.81): 아파트 위쪽에서 벽으로 날아가 벽을 부수고 계단 형성
    var sym = $('#wallSymbol');
    var ring = $('#impact');
    var HOVER = { x: 180, y: 80 };                // 아파트 위쪽 상공 위치

    if (p < 0.60 || p > 0.82) {
      sym.style.opacity = 0;
      ring.style.opacity = 0;
    } else if (p < 0.73) {
      // 1. "이제 오름이 도와줄게요!" 구간: 아파트 위쪽에 등장하여 부유
      var flyIn = seg(p, 0.60, 0.66);
      var sx, sy, rot, sc = 1.15;
      if (flyIn < 1) {
        var fi = ease(flyIn);
        sx = lerp(FLY_FROM.x, HOVER.x, fi);
        sy = lerp(FLY_FROM.y, HOVER.y, fi) - Math.sin(fi * Math.PI) * 35;
        rot = lerp(-120, 0, fi);
      } else {
        var hoverP = p - 0.66;
        sx = HOVER.x + Math.sin(hoverP * 30) * 3;
        sy = HOVER.y + Math.sin(hoverP * 45) * 5;
        rot = Math.sin(hoverP * 25) * 5;
        sc = 1.15 + Math.sin(hoverP * 45) * 0.05;
      }
      var so = seg(p, 0.60, 0.63);
      sym.style.opacity = so;
      sym.style.transform = 'translate(' + (sx - 35) + 'px,' + (sy - 35) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      ring.style.opacity = 0;
    } else {
      // 2. 아파트 위쪽에서 벽(HIT)으로 날아가 벽을 부숨
      var charge = seg(p, 0.73, 0.77);
      var sx, sy, rot, sc = 1.15, so = 1;
      if (charge < 1) {
        var f = charge * charge;
        sx = lerp(HOVER.x, HIT.x, f);
        sy = lerp(HOVER.y, HIT.y, f) - Math.sin(charge * Math.PI) * 40;
        rot = 720 * charge;
        sc = lerp(1.15, 1.25, charge);
      } else {
        var bk = ease(seg(p, 0.77, 0.81));
        sx = HIT.x - 55 * bk;
        sy = HIT.y - 45 * bk + 25 * bk * bk;
        rot = 720 + 40 * bk;
        sc = 1.25 + 0.2 * bk;
        so = 1 - seg(p, 0.78, 0.82);
      }
      sym.style.opacity = so;
      sym.style.transform = 'translate(' + (sx - 35) + 'px,' + (sy - 35) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';

      // impact ring
      if (hit > 0 && hit < 1) {
        ring.style.opacity = 1 - hit;
        ring.style.transform = 'translate(' + (HIT.x - 40) + 'px,' + (HIT.y - 40) + 'px) scale(' + (0.4 + hit * 2.8).toFixed(2) + ')';
      } else {
        ring.style.opacity = 0;
      }
    }
  }

  /* ======================================================
     S05–S07 step 1: thin layers against the next step
     ====================================================== */
  var MISSIONS = ['창문 열고 환기', '양치하기', '8시 기상', '샤워하기', '방 정리', '간단한 요리', '가족과 사진'];
  var S1 = { ground: 420, riser: 680, pitch: 22, left0: 100, dx: 76 };   // wider layers: 1단계 runs to x 680, 2단계 starts there
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
  /* stairs, design F: each big step is a round-dot halftone — solid at the tread, the dots shrinking all the way
     down to the bottom of the screen — with a faint second print a hair off register in the mid-tones.
     Colours are the population page's terrain dots. The mission layers are flat slabs (CSS .slab, --c). */
  var HTONE = ['#B0602F', '#D47838', '#F2924E', '#FFB682', '#FFDCC4'];
  function htLayerColor(L) { var i = Math.min(3, Math.floor(L)), f = L - Math.floor(L); return f > .5 ? HTONE[i + 1] : HTONE[i]; }
  var htSteps = [];
  function drawHalftone(el, L) {
    var W = el.offsetWidth; if (!W) return;
    var st = el.closest('.stage'), bb = st ? parseFloat(st.style.getPropertyValue('--bb')) || 0 : 0;
    var top = el.offsetTop, fade = el.dataset.fade ? +el.dataset.fade : Math.max(140, 540 + bb - top);   // every step fades all the way to the bottom of the screen (or to its own data-fade)
    if (!el.dataset.fade && el.offsetHeight < fade + 4) el.style.height = Math.ceil(fade + 4) + 'px';
    var H = el.offsetHeight;
    var key = W + 'x' + H + ':' + Math.round(fade); if (el.dataset.ht === key) return; el.dataset.ht = key;
    var K = el.dataset.fade ? 5 : 2, cv = document.createElement('canvas');   // the wall's steps get zoomed in on: draw them sharper
    cv.width = Math.ceil(W * K); cv.height = Math.ceil(H * K);
    var c = cv.getContext('2d'); c.scale(K, K);
    var i = Math.min(4, Math.round(L)), col = HTONE[i], ghost = [HTONE[i + 1], i ? HTONE[i - 1] : '#8A4A26'], P = +(el.dataset.pitch || 10);
    function prof(y) { var k = clamp(1.1 - y / fade); return Math.max(.012, k * k * k); }   // never 0: the smallest dots reach the floor
    var solidTo = 0;
    for (var y = P / 2; y < H; y += P) { if (prof(y) >= .985) solidTo = y + P / 2; else break; }
    c.fillStyle = col; c.fillRect(0, 0, W, solidTo);
    [[col, 0, 0, 1]].forEach(function (ps) {        // one print: a single dot per grid point
      c.globalAlpha = ps[3]; c.fillStyle = ps[0]; c.beginPath();
      for (var y2 = solidTo + P / 2; y2 < H; y2 += P) {
        var k = prof(y2);
        if (ps[3] < 1 && (k < .08 || k > .7)) continue;
        var rr = Math.max(.35, P * .72 * Math.sqrt(k));
        for (var x = P / 2; x < W; x += P) { c.moveTo(x + ps[1] + rr, y2 + ps[2]); c.arc(x + ps[1], y2 + ps[2], rr, 0, 6.2832); }
      }
      c.fill();
    });
    c.globalAlpha = 1; c.fillStyle = HTONE[Math.min(4, i + 1)]; c.fillRect(0, 0, W, P / 5);        // the tread edge
    el.style.background = 'url(' + cv.toDataURL('image/png') + ') 0 0 / ' + W + 'px ' + H + 'px no-repeat';
    el.classList.add('ht');
  }
  function paintStep(el, L) { htSteps.push([el, L]); drawHalftone(el, L); }
  window.addEventListener('resize', function () { setTimeout(function () { htSteps.forEach(function (q) { drawHalftone(q[0], q[1]); }); }, 60); });
  var slabsEl = $('#slabs');
  MISSIONS.forEach(function (m, k) {
    var d = document.createElement('div');
    d.className = 'slab pending';
    d.style.left = (S1.left0 + k * S1.dx) + 'px';
    d.style.width = (S1.riser - S1.left0 - k * S1.dx) + 'px';
    d.style.top = (S1.ground - (k + 1) * S1.pitch) + 'px';
    var lv = (k + 1) / (MISSIONS.length + 1);      // between 1단계 (0) and 2단계 (1): the layers climb the gradient into the next step
    d.style.setProperty('--c', htLayerColor(lv));
    d.style.setProperty('--c2', rampColor(lv + .12));
    d.style.setProperty('--top', rampColor(lv + .55));
    d.style.setProperty('--tc', rampText(lv));
    d.innerHTML = '<span class="habit">' + m + '</span>';
    slabsEl.appendChild(d);
  });
  var slabEls = $$('.slab', slabsEl);
  var stepOru = $('#stepOru');

  /* 1·2단계 SVG 오르미: hair (spikes), face and eyes move separately — same motion as the jump mockup.
     x = centre, y = the feet line, w = drawn width of the spikes (stage px). */
  var ORU_SVG = {"c1": "<svg viewBox=\"-20 -30 339 202\" aria-hidden=\"true\"><g class=\"all\"><g class=\"hair\"><path d=\"M298.559 143.74C298.989 147.85 284.859 156.96 242.719 159.47C206.979 161.59 185.079 161.15 149.289 161.15C113.499 161.15 91.5995 161.59 55.8495 159.47C13.7095 156.96 -0.420518 147.85 0.00948151 143.74C0.369482 140.28 11.0695 138.5 16.3095 137.78C11.1695 133.3 -1.54052 120.17 0.389483 116.29C2.79948 111.46 18.3195 112.01 26.1395 113.12C17.0695 103.48 9.37948 88.51 12.8095 83.92C17.0195 78.33 43.3395 87.66 43.9795 87.88C39.7095 78.76 33.7895 51.33 40.0295 47.64C46.3895 43.88 66.6795 54.43 77.1595 62.66C76.0395 51.03 78.2595 22.61 87.0795 19.86C95.8995 17.11 116.839 34.6 123.649 43.96C122.879 32.42 139.359 0.31 149.289 0C159.209 0.31 175.689 32.42 174.929 43.96C181.729 34.6 202.679 17.11 211.489 19.86C220.309 22.61 222.539 51.03 221.409 62.66C231.889 54.43 252.189 43.88 258.549 47.64C264.78 51.33 258.859 78.76 254.589 87.88C255.229 87.66 281.559 78.33 285.759 83.92C289.199 88.51 281.509 103.48 272.439 113.12C280.259 112.01 295.78 111.46 298.18 116.29C300.12 120.17 287.409 133.3 282.259 137.78C287.499 138.5 298.209 140.28 298.559 143.74Z\" fill=\"#FF6A00\"/><path d=\"M297.179 146.5C292.699 151.05 276.949 157.43 242.729 159.47C206.989 161.59 185.089 161.15 149.299 161.15C113.509 161.15 91.6091 161.59 55.8591 159.47C19.9491 157.33 4.3691 150.4 0.829102 145.85C37.0591 161.83 89.3191 157.79 150.559 157.91C215.049 158.03 269.499 158.64 297.179 146.5Z\" fill=\"#E04004\"/><path d=\"M33.0096 140.95C26.9396 138.93 21.2496 137.65 16.3196 137.78C14.2996 136.02 11.1096 132.92 8.09961 129.58C17.7696 132.39 26.2496 136.06 33.0096 140.95Z\" fill=\"#E04004\"/><path d=\"M43.4791 117.66C37.5291 115.11 31.0791 113.02 26.1491 113.14L26.1191 113.12H26.1491C24.0191 110.86 21.9691 108.3 20.1191 105.66C29.4991 108.68 38.3991 112.91 43.4791 117.66Z\" fill=\"#E04004\"/><path d=\"M58.5898 98.2498C53.9298 93.7498 48.6498 89.4998 43.9998 87.8698L43.9498 87.7998L43.9298 87.7598C42.9098 85.5298 41.7898 82.2498 40.7598 78.5098C48.5598 84.7298 55.4998 91.9398 58.5898 98.2498Z\" fill=\"#E04004\"/><path d=\"M88.9797 76.8105C85.5297 71.1205 81.3796 65.5105 77.1696 62.6605C76.9296 60.1505 76.8396 56.8605 76.9396 53.2305C82.8296 61.2605 87.5897 69.9305 88.9797 76.8105Z\" fill=\"#E04004\"/><path d=\"M132.19 61.9704C130.12 55.0704 127.31 48.0604 123.69 43.9404L123.63 43.1904V43.1404C123.63 40.5004 124.38 36.9904 125.66 33.1104C129.82 43.4004 132.63 54.1604 132.19 61.9704Z\" fill=\"#E04004\"/><path d=\"M186.87 31.75C181.98 44.01 174.88 56.41 167.68 62.46C171.3 56.22 174.47 49.38 174.99 43.91L182.44 35.71C183.83 34.39 185.32 33.05 186.87 31.75Z\" fill=\"#E04004\"/><path d=\"M233.72 54.5898C227.21 65.1998 218.94 75.2798 211.42 79.8598C215.92 74.2498 220.09 67.9798 221.43 62.6498H221.44C224.79 60.0098 229.14 57.1498 233.72 54.5898Z\" fill=\"#E04004\"/><path d=\"M263.63 85.0596C257.48 92.5196 250.42 99.1096 244.26 102.04C248.73 97.5296 252.95 92.4096 254.63 87.8696C255.09 87.7096 258.84 86.3896 263.63 85.0596Z\" fill=\"#E04004\"/><path d=\"M285.279 112.39C275.679 117.67 264.989 121.78 257.249 122.02C263.179 119.67 269.129 116.65 272.479 113.13L273.019 113.04C276.369 112.6 280.939 112.27 285.279 112.39Z\" fill=\"#E04004\"/><path d=\"M291.469 139.51C282.989 142.48 274.069 144.33 267.779 143.6C273.269 142.31 278.859 140.43 282.249 137.78H282.269C284.689 138.11 288.279 138.67 291.469 139.51Z\" fill=\"#E04004\"/></g><g class=\"face\"><g class=\"eyes\"><path d=\"M189.4 131.09C189.4 136.13 183.82 140.21 176.93 140.21C170.04 140.21 164.46 136.13 164.46 131.09H189.4Z\" fill=\"black\"/><path d=\"M134.12 131.09C134.12 136.13 128.54 140.21 121.65 140.21C114.76 140.21 109.18 136.13 109.18 131.09H134.12Z\" fill=\"black\"/></g><path d=\"M149.29 148.4C152.874 148.4 155.78 146.493 155.78 144.14C155.78 141.787 152.874 139.88 149.29 139.88C145.705 139.88 142.8 141.787 142.8 144.14C142.8 146.493 145.705 148.4 149.29 148.4Z\" fill=\"black\"/></g></g></svg>", "c2": "<svg viewBox=\"-20 -30 339 202\" aria-hidden=\"true\"><g class=\"all\"><g class=\"hair\"><path d=\"M298.56 143.74C298.99 147.85 284.859 156.96 242.719 159.47C206.979 161.59 185.079 161.15 149.289 161.15C113.499 161.15 91.5995 161.59 55.8495 159.47C13.7095 156.96 -0.420518 147.85 0.00948151 143.74C0.369482 140.28 11.0695 138.5 16.3095 137.78C11.1695 133.3 -1.54051 120.17 0.389486 116.29C2.79949 111.46 18.3195 112.01 26.1395 113.12C17.0695 103.48 9.37947 88.51 12.8095 83.92C17.0195 78.33 43.3395 87.66 43.9795 87.88C39.7095 78.76 33.7895 51.33 40.0295 47.64C46.3895 43.88 66.6795 54.43 77.1595 62.66C76.0395 51.03 78.2595 22.61 87.0795 19.86C95.8995 17.11 116.839 34.6 123.649 43.96C122.879 32.42 139.359 0.31 149.289 0C159.209 0.31 175.689 32.42 174.929 43.96C181.729 34.6 202.679 17.11 211.489 19.86C220.309 22.61 222.539 51.03 221.409 62.66C231.889 54.43 252.189 43.88 258.549 47.64C264.78 51.33 258.859 78.76 254.589 87.88C255.229 87.66 281.559 78.33 285.759 83.92C289.199 88.51 281.51 103.48 272.44 113.12C280.26 112.01 295.78 111.46 298.18 116.29C300.12 120.17 287.409 133.3 282.259 137.78C287.499 138.5 298.21 140.28 298.56 143.74Z\" fill=\"#FF6A00\"/><path d=\"M297.179 146.5C292.699 151.05 276.949 157.43 242.729 159.47C206.989 161.59 185.089 161.15 149.299 161.15C113.509 161.15 91.6091 161.59 55.8591 159.47C19.9491 157.33 4.3691 150.4 0.829102 145.85C37.0591 161.83 89.3191 157.79 150.559 157.91C215.049 158.03 269.499 158.64 297.179 146.5Z\" fill=\"#E04004\"/><path d=\"M33.0096 140.95C26.9396 138.93 21.2496 137.65 16.3196 137.78C14.2996 136.02 11.1096 132.92 8.09961 129.58C17.7696 132.39 26.2496 136.06 33.0096 140.95Z\" fill=\"#E04004\"/><path d=\"M43.4792 117.66C37.5292 115.11 31.0791 113.02 26.1491 113.14L26.1191 113.12H26.1491C24.0191 110.86 21.9691 108.3 20.1191 105.66C29.4991 108.68 38.3992 112.91 43.4792 117.66Z\" fill=\"#E04004\"/><path d=\"M58.5898 98.2498C53.9298 93.7498 48.6498 89.4998 43.9998 87.8698L43.9498 87.7998L43.9298 87.7598C42.9098 85.5298 41.7898 82.2498 40.7598 78.5098C48.5598 84.7298 55.4998 91.9398 58.5898 98.2498Z\" fill=\"#E04004\"/><path d=\"M88.9797 76.8105C85.5297 71.1205 81.3797 65.5105 77.1697 62.6605C76.9297 60.1505 76.8396 56.8605 76.9396 53.2305C82.8296 61.2605 87.5897 69.9305 88.9797 76.8105Z\" fill=\"#E04004\"/><path d=\"M132.19 61.9704C130.12 55.0704 127.31 48.0604 123.69 43.9404L123.63 43.1904V43.1404C123.63 40.5004 124.38 36.9904 125.66 33.1104C129.82 43.4004 132.63 54.1604 132.19 61.9704Z\" fill=\"#E04004\"/><path d=\"M186.87 31.75C181.98 44.01 174.88 56.41 167.68 62.46C171.3 56.22 174.47 49.38 174.99 43.91L182.44 35.71C183.83 34.39 185.32 33.05 186.87 31.75Z\" fill=\"#E04004\"/><path d=\"M233.72 54.5898C227.21 65.1998 218.94 75.2798 211.42 79.8598C215.92 74.2498 220.09 67.9798 221.43 62.6498H221.44C224.79 60.0098 229.14 57.1498 233.72 54.5898Z\" fill=\"#E04004\"/><path d=\"M263.63 85.0596C257.48 92.5196 250.42 99.1096 244.26 102.04C248.73 97.5296 252.95 92.4096 254.63 87.8696C255.09 87.7096 258.84 86.3896 263.63 85.0596Z\" fill=\"#E04004\"/><path d=\"M285.28 112.39C275.68 117.67 264.99 121.78 257.25 122.02C263.18 119.67 269.13 116.65 272.48 113.13L273.02 113.04C276.37 112.6 280.94 112.27 285.28 112.39Z\" fill=\"#E04004\"/><path d=\"M291.469 139.51C282.989 142.48 274.069 144.33 267.779 143.6C273.269 142.31 278.859 140.43 282.249 137.78H282.269C284.689 138.11 288.279 138.67 291.469 139.51Z\" fill=\"#E04004\"/></g><g class=\"face\"><path d=\"M211.459 135.85C211.459 157.56 183.619 160.16 149.289 160.16C114.959 160.16 87.1191 157.56 87.1191 135.85C87.1191 114.14 114.959 96.54 149.289 96.54C183.619 96.54 211.459 114.14 211.459 135.85Z\" fill=\"#F9EDDE\"/><g class=\"eyes\"><path d=\"M172.689 145.63C176.914 145.63 180.339 141.193 180.339 135.72C180.339 130.246 176.914 125.81 172.689 125.81C168.464 125.81 165.039 130.246 165.039 135.72C165.039 141.193 168.464 145.63 172.689 145.63Z\" fill=\"black\"/><path d=\"M125.889 145.63C130.114 145.63 133.539 141.193 133.539 135.72C133.539 130.246 130.114 125.81 125.889 125.81C121.664 125.81 118.239 130.246 118.239 135.72C118.239 141.193 121.664 145.63 125.889 145.63Z\" fill=\"black\"/></g><path d=\"M149.29 151.14C152.874 151.14 155.78 149.233 155.78 146.88C155.78 144.527 152.874 142.62 149.29 142.62C145.705 142.62 142.8 144.527 142.8 146.88C142.8 149.233 145.705 151.14 149.29 151.14Z\" fill=\"black\"/></g></g></svg>"};
  var ORU_CFG = {
    c1: { jt: 1050, pre: .38, H: 28, squash: .22, duck: 0, peek: 5, damp: 4, eyeY: 135, breath: 760, blinks: false, look: false },
    c2: { jt: 900, pre: .3, H: 40, squash: .16, duck: 8, peek: 7, damp: 5, eyeY: 135, breath: 520, blinks: true, look: true, hairLead: true, keepFaceW: true }
  };
  function makeOru(key, parent, after) {
    var box = document.createElement('div'); box.className = 'svg-oru'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = ORU_SVG[key];
    if (after) parent.insertBefore(box, after.nextSibling); else parent.appendChild(box);
    var q = function (c) { return box.querySelector('.' + c); }, cfg = ORU_CFG[key];
    var P = { all: q('all'), hair: q('hair'), face: q('face'), eyes: q('eyes'), svg: box.querySelector('svg') };
    function T(el, t) { if (el) el.setAttribute('transform', t); }
    function pose(x, y, w, o, flip) {
      var S = w / 299;
      box.style.width = (339 * S).toFixed(1) + 'px';
      box.style.transform = 'translate(' + (x - 169.5 * S).toFixed(1) + 'px,' + (y - 191 * S).toFixed(1) + 'px)';
      P.svg.style.transform = flip === -1 ? 'scaleX(-1)' : '';
      var bodySq = cfg.hairLead ? o.sq * .45 : o.sq, sx = 1 - bodySq * .55, sy = 1 + bodySq;
      T(P.all, 'translate(149 161) skewX(' + o.lean.toFixed(2) + ') scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ') translate(-149 -161)');
      var hx = 1 + o.fluff * (cfg.hairLead ? .05 : .08), hy = 1 + o.fluff * .05;
      if (cfg.hairLead) hy = 1 + o.fluff * .14 + Math.max(0, o.sq) * 1.4 - Math.max(0, -o.sq) * .5;
      T(P.hair, 'translate(149 161) scale(' + hx.toFixed(3) + ' ' + hy.toFixed(3) + ') translate(-149 -161)');
      var fy = o.face > 0 ? -o.face : 0, fsy = o.face < 0 ? 1 + o.face * .03 : 1, fsx = cfg.keepFaceW ? 1 / sx : (o.face < 0 ? fsy : 1);
      if (cfg.keepFaceW) fsy = fsy / sy * (1 + bodySq * .35);
      T(P.face, 'translate(' + (o.look || 0).toFixed(1) + ' ' + (fy + (o.drop || 0)).toFixed(1) + ') translate(149 159) scale(' + fsx.toFixed(3) + ' ' + fsy.toFixed(3) + ') translate(-149 -159)');
      T(P.eyes, 'translate(0 ' + cfg.eyeY + ') scale(1 ' + (1 - (o.blink || 0) * .85).toFixed(3) + ') translate(0 ' + (-cfg.eyeY) + ')');
    }
    function jump(t) {                           // body pose through one jump, t 0–1
      var pe = cfg.pre, pre = seg(t, 0, pe), fly = seg(t, pe, .8), land = seg(t, .8, 1), eo = function (v) { return 1 - Math.pow(1 - v, 3); };
      var o = { sq: 0, lean: 0, fluff: 0, face: 0, look: 0 };
      if (t < pe) { o.sq = -cfg.squash * eo(pre); o.lean = -4 * pre; o.fluff = -.5 * pre; o.face = -cfg.duck * eo(pre); }
      else if (t < .8) {
        o.sq = lerp(.16, -.02, fly) * (1 - fly * .4); o.lean = 8 * Math.sin(Math.PI * fly) * (1 - fly * .5);
        o.fluff = Math.sin(Math.PI * Math.min(1, fly * 1.2)); o.face = cfg.peek * Math.sin(Math.PI * fly);
      } else { var b2 = Math.exp(-cfg.damp * land) * Math.cos(land * 9); o.sq = -cfg.squash * .85 * b2; o.fluff = -.4 * b2; o.face = -cfg.duck * .6 * b2; }
      return o;
    }
    function jumpXY(a, b, t) {                   // where it is through one jump (arc between two spots)
      var fly = seg(t, cfg.pre, .8), e = fly * fly * (3 - 2 * fly);
      return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - cfg.H * Math.sin(Math.PI * fly)];
    }
    function idle(now) {
      var br = reduced ? 0 : Math.sin(now / cfg.breath) * .02;
      var look = cfg.look && !reduced ? 5 * Math.sin(now / 1700) * (Math.sin(now / 900) > .3 ? 1 : .2) : 0;
      return { sq: br, lean: 0, fluff: br * 3, face: 0, look: look, blink: cfg.blinks && !reduced && (now % 3100) < 140 ? 1 : 0 };
    }
    function pop() { box.classList.remove('pop'); void box.offsetWidth; if (!reduced) box.classList.add('pop'); }
    return { el: box, cfg: cfg, pose: pose, jump: jump, jumpXY: jumpXY, idle: idle, pop: pop };
  }

  var S1A = makeOru('c1', stepOru.parentNode, stepOru), S1B = makeOru('c2', stepOru.parentNode, stepOru);
  var hopK = -1, exitF = -1;
  // the SVG oreumi follows the (hidden) #stepOru box every frame, so the CSS move between layers still applies
  (function s1Loop(now) {
    var sc = $('.scene-step1');
    if (sc && sc.classList.contains('active')) {
      var cs = getComputedStyle(stepOru), L = parseFloat(cs.left) || 0, Tt = parseFloat(cs.top) || 0, w = stepOru.offsetWidth || 76;
      var two = lastStage1Img === 2, cur = two ? S1B : S1A, other = two ? S1A : S1B;
      var flip = parseFloat(stepOru.style.getPropertyValue('--flip')) || 1;
      var k = two ? exitF : hopK;
      cur.el.style.opacity = cs.opacity; other.el.style.opacity = 0;
      cur.pose(L + w / 2, Tt + (two ? 6 : 4), two ? w * 360 / 380 : w * 74 / 76, k >= 0 ? cur.jump(k) : cur.idle(now), flip < 0 ? -1 : 1);
    }
    requestAnimationFrame(s1Loop);
  })(performance.now());
  // the grown oreumi in 숨고르기 is drawn at the same on-screen size as in 계속 오름 (the stages are scaled differently)
  function lv2Width() {
    var a = $('.scene-step1 .stage').getBoundingClientRect().width, b = $('.scene-montage .stage').getBoundingClientRect().width;
    var mw = 80;                                 // .m-oru.spr width (계속 오름's sprite size)
    return a && b ? Math.round(mw * b / a) : 84;
  }
  window.addEventListener('resize', function () { if (stepOru.classList.contains('lv2')) stepOru.style.width = lv2Width() + 'px'; });

  var lastStage1Img = 1, lastSpot = null, hopRaf = 0;
  // the hop plays in time with the 0.8s move between layers (CSS transition on left/top)
  function stopHop() { if (hopRaf) cancelAnimationFrame(hopRaf); hopRaf = 0; hopK = -1; }
  /* a jump onto the next layer: squash on the spot (frames 1–3), spring up along an arc (4–5), land (6–7) */
  var HOP_MS = 900, HOP_H = 34;                 // jump length (ms) and height (stage px)
  function jumpPos(a, b, k) {
    var m = clamp((k - .3) / .5), e = m * m * (3 - 2 * m);
    return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - HOP_H * Math.sin(Math.PI * m)];
  }
  function playHop(from, to) {
    stopHop();
    var t0 = performance.now();
    stepOru.style.transition = 'none';
    (function tick(now) {
      var k = (now - t0) / S1A.cfg.jt;
      if (k >= 1 || lastStage1Img !== 1) {
        hopRaf = 0; hopK = -1; stepOru.style.left = to[0] + 'px'; stepOru.style.top = to[1] + 'px'; stepOru.style.transition = '';
        if (lastStage1Img === 1) setSrc(stepOru, 'assets/character/oreumi1.png'); return;
      }
      var q = S1A.jumpXY(from, to, k); hopK = k;
      stepOru.style.left = q[0].toFixed(1) + 'px'; stepOru.style.top = q[1].toFixed(1) + 'px';
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
    // the phone beside the stairs: one app screen per layer (assets/app/step1/shot-N.png, N = layers climbed);
    // a screen that isn't there yet falls back to shot-0
    var shot = $('#stepShot img');
    if (shot) {
      var want = 'assets/app/step1/shot-' + n + '.png';
      if (shot.dataset.want !== want) {
        shot.dataset.want = want;
        var probe = new Image();
        probe.onload = function () { if (shot.dataset.want === want) shot.src = want; };
        probe.onerror = function () { if (shot.dataset.want === want) shot.src = 'assets/app/step1/shot-0.png'; };
        probe.src = want;
      }
    }
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
      el.classList.toggle('today', k === n - 1 && !top);
    });

    var x, y;
    if (top) { x = S1.riser + 16; y = S1.ground - 7 * S1.pitch; }
    else if (n === 0) { x = 50; y = S1.ground; }
    else { x = S1.left0 + (n - 1) * S1.dx + 10; y = S1.ground - n * S1.pitch; }
    stepOru.style.setProperty('--flip', p >= 0.84 ? -1 : 1);
    var want = p >= 0.9 ? 2 : 1;
    if (want !== lastStage1Img) {
      // reaching 2단계: the oreumi grows into the next stage's figure (the 계속 오름 scene's resting frame)
      stopHop();
      stepOru.src = want === 2 ? HOP2_REST : 'assets/character/oreumi1.png';
      stepOru.classList.toggle('lv2', want === 2);
      stepOru.style.width = want === 2 ? lv2Width() + 'px' : '';
      stepOru.classList.remove('evolve'); void stepOru.offsetWidth;
      if (want === 2 && lastStage1Img === 1 && !reduced) S1B.pop();
      lastStage1Img = want;
    }
    var spot = x + ',' + y;
    if (spot !== lastSpot) {
      var prev = lastSpot ? lastSpot.split(',').map(Number) : null;
      // one layer up: jump there; anything else (going back, skipping, resting) just moves
      if (prev && want === 1 && !reduced && y < prev[1] && prev[1] - y <= S1.pitch + 1) playHop(prev, [x, y]);
      else if (!hopRaf) { stepOru.style.left = x + 'px'; stepOru.style.top = y + 'px'; }
      lastSpot = spot;
    }
    // after growing: the next scroll sends the oreumi off to the right (toward the next stairs) before the page turns,
    // in little hops along 2단계's tread
    var exitT = seg(p, 0.965, 1);
    if (exitT > 0 && want === 2) {
      var br = parseFloat(scene.querySelector('.stage').style.getPropertyValue('--br')) || 0;
      var hops = 4, hp = exitT * hops, f = hp - Math.floor(hp);
      var ex = lerp(S1.riser + 16, 960 + br + 12, exitT), ey = y - 26 * Math.sin(Math.PI * f) * (exitT < 1 ? 1 : 0);
      stepOru.style.transition = 'none';
      stepOru.style.left = ex.toFixed(1) + 'px'; stepOru.style.top = ey.toFixed(1) + 'px';
      stepOru.classList.remove('evolve');
      exitF = exitT < 1 ? f : -1;
      lastSpot = 'exit';
    } else if (lastSpot === 'exit') {
      exitF = -1;
      stepOru.style.transition = ''; stepOru.style.left = x + 'px'; stepOru.style.top = y + 'px'; setSrc(stepOru, want === 2 ? HOP2_REST : 'assets/character/oreumi1.png'); lastSpot = x + ',' + y;
    }

    scene.classList.toggle('resting', resting);
    var zz = $('.zz', scene);
    zz.style.left = (x + 70) + 'px';
    zz.style.top = (y - 70) + 'px';
    // 준호's speech bubble while he climbs the first layers; gone once he rests
    var say = $('#oruSay') || (function () { var d = document.createElement('div'); d.className = 'oru-say'; d.id = 'oruSay'; d.innerHTML = '<span></span>'; $('.scene-step1 .stage').appendChild(d); return d; })(), sayTxt = resting || p >= 0.42 ? '' : ['일상 붕괴형', '씻고, 정리하고, 기상 등', '작은 미션을 수행하며'][n] || '일상 습관을 채우게 됩니다';
    say.style.left = (x + 38) + 'px';
    say.style.top = (y - 74) + 'px';
    if (sayTxt) { var sp = say.firstChild; if (sp.textContent !== sayTxt) { sp.textContent = sayTxt; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); } }
    say.classList.toggle('on', !!sayTxt);


    var days = n + (p >= 0.42 ? 1 : 0);
    $('#dday').textContent = top ? '1단계 완료' : (resting ? 'D+' + days + ' · 쉬는 날' : 'D+' + days);
  }

  /* ======================================================
     S08 montage
     ====================================================== */
  var mSlabsEl = $('#mSlabs');
  var M = [{ ground: 430, riser: 420, left0: 72, dx: 72, level: 1 }, { ground: 320, riser: 840, left0: 492, dx: 72, level: 2 }];   // 2·3단계 420 wide, 4단계 from 840; the first layer sits 72 in from its step's edge, each next one 72 further   // 2단계 starts at x 60 so all three big steps are 300 wide
  M.forEach(function (g) {
    for (var k = 0; k < 5; k++) {
      var d = document.createElement('div');
      d.className = 'slab pending';
      d.style.left = (g.left0 + k * g.dx) + 'px';
      d.style.width = (g.riser - g.left0 - k * g.dx) + 'px';
      d.style.top = (g.ground - (k + 1) * 22) + 'px';
      var lv = g.level + (k + 1) / 6;              // 5 layers between two big steps
      d.style.setProperty('--c', htLayerColor(lv));
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
  /* 3단계 오르미 (계속 오름, 3단계 → 4단계): one SVG with its feet, hands, body, hair and eyes moving separately.
     The jump follows the same timing as the sprite jump (wind-up with the arms .0–.3, flight .3–.8, landing .8–1). */
  var M3 = (function () {
    var w = document.createElement('div'); w.className = 'm3-oru'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<svg viewBox="-20 -20 361 257" aria-hidden="true"><g id="m3-all"><g id="m3-footL"><path d="M154.813 191.16C154.813 191.16 152.663 193.95 152.783 200.33C152.873 205.34 153.543 208.13 153.543 210.25C153.543 212.37 153.263 216.96 135.493 216.96C117.723 216.96 115.273 215.12 113.103 210.53C110.933 205.95 113.383 200.42 114.803 195.79C116.223 191.16 115.273 181.81 115.273 181.81L154.813 191.16Z" fill="#F9EDDE"/><path d="M152.923 203.49C152.923 203.55 152.923 203.6 152.933 203.66C147.643 198.57 141.123 194.51 131.773 195.36C124.573 196.02 121.953 203.47 112.433 204.1C112.873 201.27 113.993 198.39 114.793 195.8C116.213 191.17 115.263 181.81 115.263 181.81L154.803 191.17C154.803 191.17 152.653 193.95 152.773 200.33C152.783 200.93 152.803 201.49 152.833 202.03V202.19C152.863 202.65 152.893 203.08 152.923 203.49Z" fill="#F8D5B7"/></g><g id="m3-footR"><path d="M165.992 191.16C165.992 191.16 168.142 193.95 168.022 200.33C167.932 205.34 167.262 208.13 167.262 210.25C167.262 212.38 167.542 216.96 185.312 216.96C203.072 216.96 205.532 215.12 207.702 210.53C209.872 205.95 207.422 200.42 206.002 195.79C204.582 191.16 205.532 181.81 205.532 181.81L165.992 191.16Z" fill="#F9EDDE"/><path d="M167.882 203.49C167.882 203.55 167.882 203.6 167.872 203.66C173.162 198.57 179.682 194.51 189.032 195.36C196.232 196.02 198.852 203.47 208.372 204.1C207.932 201.27 206.812 198.39 206.012 195.8C204.592 191.17 205.542 181.81 205.542 181.81L166.002 191.17C166.002 191.17 168.152 193.95 168.032 200.33C168.022 200.93 168.002 201.49 167.972 202.03V202.19C167.942 202.65 167.912 203.08 167.882 203.49Z" fill="#F8D5B7"/></g><g id="m3-body"><path d="M230.703 151.76C230.703 177.04 199.233 194.54 160.403 194.54C121.573 194.54 90.1025 177.04 90.1025 151.76C90.1025 126.48 121.573 105.98 160.403 105.98C199.233 105.98 230.703 126.48 230.703 151.76Z" fill="#F9EDDE"/><g id="m3-hair"><path d="M37.0831 135.72C31.3631 142.62 28.6831 148.54 26.2231 154.02C26.2231 154.02 24.3731 152.76 21.6631 150.63L37.0831 135.72Z" fill="#E04004"/><path d="M124.833 61.7799C118.203 55.7999 112.413 52.8699 107.053 50.1899C107.253 49.7799 108.223 47.8299 109.843 44.9199L124.833 61.7799Z" fill="#E04004"/><path d="M221.223 70.2004C219.453 61.4204 216.533 55.6104 213.812 50.2604C214.032 50.1404 216.043 49.1104 219.213 47.6504L221.223 70.2004Z" fill="#E04004"/><path d="M283.243 109.05C285.483 100.47 285.443 94 285.353 88.04C285.833 88.29 287.663 89.26 290.253 90.76L283.243 109.05Z" fill="#E04004"/><path d="M296.153 159.6L275.663 163.88C284.173 161.1 289.603 157.52 294.603 154.2H294.643C294.843 154.82 295.493 156.86 296.153 159.6Z" fill="#E04004"/><path d="M270.133 184.12C269.993 184.09 269.913 184.07 269.913 184.07C269.913 184.07 269.033 185.54 267.563 187.54L255.143 176.98C260.883 180.86 265.643 182.48 270.043 183.95L270.133 184.12Z" fill="#E04004"/><path d="M65.8031 177.05L53.3231 187.66C51.7931 185.6 50.8831 184.07 50.8831 184.07H50.873L50.9031 184.02C55.3031 182.55 60.0631 180.93 65.8031 177.05Z" fill="#E04004"/><path d="M294.583 154.02C294.583 154.02 301.183 173.42 295.683 180.59C289.763 188.32 269.913 184.07 269.913 184.07C269.913 184.07 262.263 196.82 254.303 198.4C245.583 200.12 233.173 193.73 233.173 193.73C239.783 181.92 233.143 165.57 215.043 165.43C217.843 158.96 223.603 154.52 228.803 151.08L228.593 147.58C227.053 131.53 212.963 119.77 198.283 113.53C186.263 108.41 173.363 106.04 160.403 106.22C147.443 106.04 134.543 108.41 122.523 113.53C107.843 119.77 93.7528 131.53 92.2128 147.58L92.0028 151.08C97.1928 154.52 102.963 158.96 105.763 165.43C87.6528 165.57 81.0128 181.92 87.6328 193.73C87.6328 193.73 75.2228 200.12 66.5028 198.4C58.5328 196.82 50.8828 184.07 50.8828 184.07C50.8828 184.07 31.0428 188.32 25.1128 180.59C19.6228 173.42 26.2228 154.02 26.2228 154.02C26.2228 154.02 -2.47716 134.48 0.172836 118.89C2.50284 105.1 35.5728 87.97 35.5728 87.97C35.5728 87.97 35.8928 45.92 51.1928 37.6C66.5028 29.29 107.013 50.27 107.013 50.27C107.013 50.27 131.303 0 160.403 0C189.503 0 213.793 50.27 213.793 50.27C213.793 50.27 254.293 29.29 269.603 37.6C284.913 45.92 285.223 87.97 285.223 87.97C285.223 87.97 318.293 105.1 320.633 118.89C323.273 134.48 294.583 154.02 294.583 154.02Z" fill="#FF6A00"/><path d="M56.2833 81.9697C47.4033 83.1497 41.4132 85.6697 35.8932 88.0197L35.5732 87.9097C35.5832 87.5397 35.6133 85.4897 35.7933 82.4197L56.2833 81.9697Z" fill="#E04004"/><path d="M37.0831 135.72C31.3631 142.62 28.6831 148.54 26.2231 154.02C26.2231 154.02 24.3731 152.76 21.6631 150.63L37.0831 135.72Z" fill="#E04004"/><path d="M56.2833 81.9697C47.4033 83.1497 41.4132 85.6697 35.8932 88.0197L35.5732 87.9097C35.5832 87.5397 35.6133 85.4897 35.7933 82.4197L56.2833 81.9697Z" fill="#E04004"/><path d="M65.8031 177.05L53.3231 187.66C51.7931 185.6 50.8831 184.07 50.8831 184.07H50.873L50.9031 184.02C55.3031 182.55 60.0631 180.93 65.8031 177.05Z" fill="#E04004"/><path d="M241.913 144.07L228.543 147.06C228.733 149.35 228.803 151.03 228.803 151.03L228.853 151.04C232.283 148.66 236.023 146.11 241.913 144.06V144.07Z" fill="#E04004"/><path d="M78.8926 144.07L92.2626 147.06C92.0726 149.35 92.0026 151.03 92.0026 151.03L91.9526 151.04C88.5226 148.66 84.7826 146.11 78.8926 144.06V144.07Z" fill="#E04004"/><path d="M124.833 61.7799C118.203 55.7999 112.413 52.8699 107.053 50.1899C107.253 49.7799 108.223 47.8299 109.843 44.9199L124.833 61.7799Z" fill="#E04004"/><path d="M221.224 70.2004C219.454 61.4204 216.533 55.6104 213.813 50.2604C214.033 50.1404 216.044 49.1104 219.214 47.6504L221.224 70.2004Z" fill="#E04004"/><path d="M270.133 184.119C269.993 184.089 269.913 184.069 269.913 184.069C269.913 184.069 269.033 185.539 267.563 187.539L255.143 176.979C260.883 180.859 265.643 182.479 270.043 183.949L270.133 184.119Z" fill="#E04004"/><path d="M283.243 109.05C285.483 100.47 285.443 94 285.353 88.04C285.833 88.29 287.663 89.26 290.253 90.76L283.243 109.05Z" fill="#E04004"/><path d="M296.153 159.6L275.663 163.88C284.173 161.1 289.603 157.52 294.603 154.2H294.643C294.843 154.82 295.493 156.86 296.153 159.6Z" fill="#E04004"/></g><g id="m3-handR"><path d="M191.434 184.36C191.434 194.9 200.264 203.45 213.624 203.45C226.984 203.45 235.814 194.9 235.814 184.36C235.814 173.82 226.984 165.27 213.624 165.27C200.264 165.27 191.434 173.82 191.434 184.36Z" fill="#F9EDDE"/></g><g id="m3-handL"><path d="M129.373 184.36C129.373 194.9 120.543 203.45 107.183 203.45C93.8232 203.45 84.9932 194.9 84.9932 184.36C84.9932 173.82 93.8232 165.27 107.183 165.27C120.543 165.27 129.373 173.82 129.373 184.36Z" fill="#F9EDDE"/></g><g id="m3-face"><g id="m3-eyes"><path d="M183.802 159.15C188.027 159.15 191.452 154.713 191.452 149.24C191.452 143.767 188.027 139.33 183.802 139.33C179.577 139.33 176.152 143.767 176.152 149.24C176.152 154.713 179.577 159.15 183.802 159.15Z" fill="black"/><path d="M137.003 159.15C141.227 159.15 144.653 154.713 144.653 149.24C144.653 143.767 141.227 139.33 137.003 139.33C132.778 139.33 129.353 143.767 129.353 149.24C129.353 154.713 132.778 159.15 137.003 159.15Z" fill="black"/></g><path d="M160.403 164.65C163.987 164.65 166.893 162.743 166.893 160.39C166.893 158.037 163.987 156.13 160.403 156.13C156.819 156.13 153.913 158.037 153.913 160.39C153.913 162.743 156.819 164.65 160.403 164.65Z" fill="black"/><path d="M165.783 173.86C165.783 174.33 165.733 174.77 165.643 175.18C165.093 177.65 162.953 178.91 160.403 178.91C157.853 178.91 155.703 177.65 155.153 175.18C155.063 174.77 155.013 174.33 155.013 173.86C155.013 170.52 157.423 168.81 160.403 168.81C163.383 168.81 165.783 170.52 165.783 173.86Z" fill="#F84621"/><path d="M165.642 175.179C165.092 177.649 162.952 178.909 160.402 178.909C157.852 178.909 155.702 177.649 155.152 175.179C155.702 172.709 157.842 171.449 160.402 171.449C162.962 171.449 165.092 172.709 165.642 175.179Z" fill="#FB5E3C"/></g></g></g></svg>';
    mOru.parentNode.insertBefore(w, mOru.nextSibling);
    var g = function (id) { return w.querySelector('#m3-' + id); };
    return { el: w, all: g('all'), hair: g('hair'), hL: g('handL'), hR: g('handR'), fL: g('footL'), fR: g('footR'), eyes: g('eyes'), x: 0, y: 0, on: false, jumping: false };
  })();
  var M3S = 84 / 321;                            // svg units → stage px (≈ the 2단계 sprite's size)
  function m3Set(el, t) { el.setAttribute('transform', t); }
  function m3Pose(cx, y, o) {
    M3.el.style.transform = 'translate(' + (cx - 180 * M3S).toFixed(1) + 'px,' + (y - 237 * M3S).toFixed(1) + 'px)';
    var sx = 1 - o.sq * .5, sy = 1 + o.sq;
    m3Set(M3.all, 'translate(160 217) scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ') translate(-160 -217)');
    m3Set(M3.fL, 'translate(' + (-o.spread * 10 + o.lift * 8) + ' ' + (-o.lift * 14) + ') rotate(' + (o.lift * 18) + ' 135 200)');
    m3Set(M3.fR, 'translate(' + (o.spread * 10 - o.lift * 8) + ' ' + (-o.lift * 14) + ') rotate(' + (-o.lift * 18) + ' 185 200)');
    m3Set(M3.hL, 'rotate(' + (o.arms * 62) + ' 118 178) translate(' + (-o.arms * 6) + ' ' + (-o.arms * 10) + ')');
    m3Set(M3.hR, 'rotate(' + (-o.arms * 62) + ' 202 178) translate(' + (o.arms * 6) + ' ' + (-o.arms * 10) + ')');
    m3Set(M3.hair, 'translate(160 112) scale(' + (1 + o.hair * .025).toFixed(3) + ' ' + (1 - o.hair * .05).toFixed(3) + ') translate(-160 -112)');
    m3Set(M3.eyes, 'translate(0 149) scale(1 ' + (1 - (o.blink || 0) * .88).toFixed(3) + ') translate(0 -149)');
  }
  function m3Jump(t) {
    var pre = seg(t, 0, .3), fly = seg(t, .3, .8), land = seg(t, .8, 1), o = { sq: 0, lift: 0, arms: 0, hair: 0, spread: 0 };
    if (t < .3) {
      o.sq = -.16 * (1 - Math.pow(1 - seg(pre, .3, 1), 3));
      o.arms = .5 * Math.sin(Math.PI * Math.min(1, pre / .75)) - .3 * seg(pre, .75, 1);
      o.spread = seg(pre, .3, 1); o.hair = .4 * seg(pre, .3, 1);
    } else if (t < .8) {
      o.sq = lerp(.14, -.02, fly) * (1 - fly * .4); o.lift = Math.sin(Math.PI * Math.min(1, fly * 1.15));
      o.arms = -.3 * (1 - fly) - .1 * Math.sin(Math.PI * fly); o.hair = lerp(-.7, .4, fly);
    } else { var b2 = Math.exp(-5 * land) * Math.cos(land * 9); o.sq = -.14 * b2; o.spread = .6 * b2; o.hair = .4 * b2; }
    return o;
  }
  function m3Idle(now) {
    var br = reduced ? 0 : Math.sin(now / 520) * .018;
    return { sq: br, lift: 0, arms: 0, hair: -br * 4, spread: 0, blink: !reduced && (now % 3200) < 140 ? 1 : 0 };
  }
  (function m3Loop(now) {                        // breathing and blinking while it stands still
    if (M3.on && !M3.jumping && $('.scene-montage').classList.contains('active')) m3Pose(M3.x, M3.y, m3Idle(now));
    requestAnimationFrame(m3Loop);
  })(performance.now());
  var M2 = makeOru('c2', mOru.parentNode, mOru);
  var M2J = -1, M2X = 0, M2Y = 0, M2O = 0;
  (function m2Loop(now) {                        // 2단계: breathing, blinking and looking around between jumps
    if ($('.scene-montage').classList.contains('active')) {
      M2.el.style.opacity = M2O;
      if (M2O > 0) M2.pose(M2X, M2Y, 80 * 360 / 380, M2J >= 0 ? M2.jump(M2J) : M2.idle(now));
    }
    requestAnimationFrame(m2Loop);
  })(performance.now());
  var lastMImg = 2, lastName = '';
  // dusk → evening: the room darkens so the door's light stands out
  var BG = [[0x1C, 0x19, 0x17], [0x33, 0x2A, 0x24], [0x1C, 0x19, 0x17]];
  function mixBg(t) {
    var a = t < 0.5 ? BG[0] : BG[1], b = t < 0.5 ? BG[1] : BG[2], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return 'rgb(' + a.map(function (v, i) { return Math.round(lerp(v, b[i], u)); }).join(',') + ')';
  }
  // camera move at the end: the door grows and slides into place as the door scene's door
  var MZ = { s: 2.3, tx: 415 - 840 * 2.3, ty: 140 - 110 * 2.3 };   // lands on the door scene's door (415, 140)
  /* the climb as keyframes [p, x, y, hop]: a short arc onto each new layer right after it appears,
     a few steps along the tread between the two flights, then the walk to the door */
  var CLIMB = (function () {
    var k = [[0, 30, 430, 0]], x = 30, y = 430;
    function to(pa, pb, nx, ny, hop) { k.push([pa, x, y, 0]); k.push([pb, nx, ny, hop]); x = nx; y = ny; }
    for (var i = 0; i < 5; i++) { var pi = 0.2 + i * 0.052; to(pi + 0.004, pi + 0.048, 100 + 72 * i, 430 - 22 * (i + 1), 7); }
    to(0.47, 0.54, 460, 320, 0);
    for (var j = 0; j < 5; j++) { var q = 0.56 + j * 0.052; to(q + 0.004, q + 0.048, 520 + 72 * j, 320 - 22 * (j + 1), 7); }
    to(0.85, 0.92, 836, 210, 0);
    return k;
  })();
  function climbAt(p) {
    var k = CLIMB;
    if (p <= k[0][0]) return [k[0][1], k[0][2], 1, -1];
    for (var i = 1; i < k.length; i++) {
      if (p <= k[i][0]) {
        var a = k[i - 1], b = k[i], t = b[0] > a[0] ? (p - a[0]) / (b[0] - a[0]) : 1;
        var e = t * t * (3 - 2 * t);              // smoothstep: eases in and out
        if (!b[3]) return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), 1, -1];   // walking along a tread
        // stepping up, like 숨고르기: squash on the spot, spring up along an arc, land
        var q = jumpPos([a[1], a[2]], [b[1], b[2]], t);
        return [q[0], q[1], 1, t];
      }
    }
    var L = k[k.length - 1]; return [L[1], L[2], 1, -1];
  }
  function updateMontage(scene, pRaw) {
    var p = clamp(pRaw / 0.85);                  // the climb runs on the first 85%
    var zoom = ease(seg(pRaw, 0.87, 1));
    if (zoom > 0) {                              // land on the door scene's door (415, 140), measured on screen
      var ms = scene.querySelector('.stage').getBoundingClientRect(), ds = $('.scene-door .stage').getBoundingClientRect();
      var sm = ms.width / 960, sd = ds.width / 960;
      if (sm > 0 && sd > 0) { var zs2 = 2.3 * sd / sm; MZ = { s: zs2, tx: (ds.left + 415 * sd - ms.left) / sm - 840 * zs2, ty: (ds.top + 140 * sd - ms.top) / sm - 110 * zs2 }; MZ.tx += 840 * zs2 - 880 * zs2; }
    }
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
    if (pRaw < 0.06) {                           // arriving from 숨고르기: three little hops in from the left edge
      var et = pRaw / 0.06, hp2 = et * 3, f2 = hp2 - Math.floor(hp2);
      pos = [lerp(-110, 30, et), 430 - 24 * Math.sin(Math.PI * f2), 1, et < 1 ? f2 : -1];
    }
    mOru.style.left = pos[0].toFixed(1) + 'px';
    mOru.style.top = pos[1].toFixed(1) + 'px';
    mOru.style.setProperty('--sq', pos[2].toFixed(3));

    var img = 2;   // oreumi2.png throughout 2단계→3단계 (matching 숨고르기's climbing style)
    // 2단계 & 3단계: the hop sprite plays through each step up (like 1단계's), and rests on its first frame
    var src = pos[3] >= 0 ? HOP2[Math.min(HOP2.length - 1, Math.floor(pos[3] * HOP2.length))] : HOP2_REST;
    setSrc(mOru, src);
    mOru.classList.toggle('spr', true);
    // from 3단계 on (once it has walked onto 3단계's tread), the SVG 3단계 오르미 takes over
    var use3 = p >= 0.5;
    if (use3 !== M3.on) {
      M3.el.classList.remove('pop'); void M3.el.offsetWidth;
      if (use3 && !reduced) M3.el.classList.add('pop');
      M3.on = use3;
    }
    mOru.style.opacity = 0;                      // the sprite box only carries the position now
    M2O = use3 ? 0 : fade; M2X = pos[0] + 40; M2Y = pos[1]; M2J = pos[3];
    M3.el.style.opacity = use3 ? fade : 0;
    M3.x = pos[0] + 40; M3.y = pos[1]; M3.jumping = pos[3] >= 0;
    if (use3) m3Pose(M3.x, M3.y, M3.jumping ? m3Jump(pos[3]) : m3Idle(performance.now()));
    lastMImg = img;
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
  var handlers = { intro: function (scene, p) { if (window.OreumIntro) window.OreumIntro.p = p; }, hook: updateHook, building: updateBuilding, wall: updateWall, step1: updateStep1, montage: updateMontage, door: updateDoor, epilogue: updateEpilogue };
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
    // data-pace on a scene: how much slower its moves play (1 = normal, 2 = twice as slow)
    // data-even on a scene: play its moves at a steady speed (only the very start and end ease), so every jump takes the same time
    var pace = 1, even = false; scenes.forEach(function (sc, si) { var lo = starts[si], hi = lo + parseFloat(sc.dataset.len); if (Math.max(P, target) > lo && Math.min(P, target) < hi && target > lo && target <= hi) { pace = Math.max(pace, parseFloat(sc.dataset.pace) || 1); even = even || !!sc.dataset.even; } });
    tw = { from: P, to: target, t0: performance.now(), cum: cum, even: even, dur: reduced ? 0 : clamp(560 + 340 * cum[TN], 700, 6500) * pace };
    kick();
  }
  // where along the tween we are, given the share of (weighted) distance covered
  function evenEase(t) {                        // steady in the middle, a short ease at each end (8%)
    var a = .08, v = 1 / (1 - a);              // speed in the middle
    if (t < a) return v * t * t / (2 * a);
    if (t > 1 - a) return 1 - v * (1 - t) * (1 - t) / (2 * a);
    return v * (t - a / 2);
  }
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
    if (window.OreumIntro && scene.dataset.scene !== 'intro') window.OreumIntro.p = 1;   // the start screen's star has become the hook's dot
    handlers[scene.dataset.scene](scene, p);

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
      P = tweenAt(tw.even ? evenEase(k) : ease(k));
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

  // jump straight to a point of the story (used by the review tool js/devnav.js; nothing else calls it)
  window.OreumStory = { seek: function (x) { tw = null; T = P = clamp(x, 0, END); render(); }, now: function () { return T; } };
  window.addEventListener('resize', function () { fitStages(); sizeHook(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStages);
  fitStages();
  htSteps.forEach(function (q) { drawHalftone(q[0], q[1]); });   // again, now that the screen's bottom edge (--bb) is known
  sizeHook();
  render();
  requestAnimationFrame(hookLoop);
})();
