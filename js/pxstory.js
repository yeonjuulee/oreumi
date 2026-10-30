/* oreum · pixel layer for the story.
   Every scene after the opening apartment is drawn as pixel art on one canvas per scene, on exactly the grid of
   the opening apartment: 1 pixel = 4 stage px (the 960×540 stage is 240×135 pixels), aligned to the stage.
   Flat colour blocks with a 1px highlight; ordered dithering only for light and for big steps fading out.
   The vector DOM stays in place (hidden) and still drives timing and positions, so every motion of the
   original story carries over; text, labels, bubbles and the phone stay as real HTML on top. */
(function () {
'use strict';
var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
var K0 = '#120C0A', K1 = '#1A1210', K2 = '#20150F', K3 = '#2A170F', K4 = '#3A2116', K5 = '#4A2A1A', K6 = '#5E3622', K7 = '#7A4A32';
var O1 = '#8A3E12', O2 = '#B8550F', O3 = '#E2701F', O4 = '#FF8A3D', O5 = '#FFB27A', O6 = '#FFD3B0';
var C1 = '#F5D7C0', C2 = '#FFE9D9', C3 = '#FFF8F2', M3 = '#8A6E5C', PAGE = '#1C1917';
var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function $(q, c) { return (c || document).querySelector(q); }
function $$(q, c) { return Array.prototype.slice.call((c || document).querySelectorAll(q)); }
function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, v)); }
function seg(p, a, b) { return clamp((p - a) / (b - a)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
var CC = {};
function col(c) {   // '#RRGGBB' or 'rgb(r,g,b)' -> [r,g,b]
  if (CC[c]) return CC[c];
  var v;
  if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  else { var m = c.match(/[\d.]+/g) || [0, 0, 0]; v = [+m[0], +m[1], +m[2]]; }
  return (CC[c] = v);
}
function mix(a, b, t) { var x = col(a), y = col(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(x[i] * (1 - t) + y[i] * t).toString(16)).slice(-2); }).join(''); }

/* ---------- a tiny pixel painter on an ImageData buffer ---------- */
function Buf(w, h) { this.resize(w, h); }
Buf.prototype.resize = function (w, h) {
  this.w = w; this.h = h; this.img = new ImageData(w, h); this.d = this.img.data;
};
Buf.prototype.clear = function () { this.d.fill(0); };
Buf.prototype.p = function (x, y, c, a) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  var v = col(c), i = (y * this.w + x) * 4; this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = a === undefined ? 255 : a;
};
Buf.prototype.r = function (x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
  if (x1 <= x0 || y1 <= y0) return;
  var v = col(c), d = this.d;
  for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) { var k = (j * this.w + i) * 4; d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = 255; }
};
Buf.prototype.d2 = function (x, y, w, h, c, t) {   // ordered dither c at density t
  for (var j = Math.round(y); j < Math.round(y + h); j++) for (var i = Math.round(x); i < Math.round(x + w); i++)
    if ((BAYER[j & 3][i & 3] + .5) / 16 < t) this.p(i, j, c);
};
Buf.prototype.rows = function (y0, y1, fx, c, t) {
  for (var y = Math.round(y0); y < Math.round(y1); y++) { var ab = fx(y);
    for (var x = Math.round(ab[0]); x < Math.round(ab[1]); x++) if (t === undefined || (BAYER[y & 3][x & 3] + .5) / 16 < t) this.p(x, y, c); }
};
Buf.prototype.circ = function (cx, cy, r, c) { for (var j = -r; j <= r; j++) { var w = Math.floor(Math.sqrt(r * r - j * j) + .35); this.r(cx - w, cy + j, w * 2 + 1, 1, c); } };
Buf.prototype.halo = function (x, y, w, h, c, r1, r2, t0) {   // dithered glow around a box, cut at its floor
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (var j = y - r2; j < y + h; j++) for (var i = x - r2; i < x + w + r2; i++) {
    var dx = Math.max(x - i, 0, i - (x + w - 1)), dy = Math.max(y - j, 0, j - (y + h - 1)), dd = Math.sqrt(dx * dx + dy * dy);
    if (dd <= 0 || dd > r2) continue;
    var t = dd <= r1 ? t0 : t0 * (r2 - dd) / (r2 - r1);
    if ((BAYER[j & 3][i & 3] + .5) / 16 < t) this.p(i, j, c);
  }
};
// big step that grows paler toward the bottom: its colour, then 4 steps toward the background, dithered between steps
Buf.prototype.fade = function (x, y, w, h, body, hl, solid, bg) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  var ramp = [body, mix(body, bg, .3), mix(body, bg, .55), mix(body, bg, .75), mix(body, bg, .9), null];
  var y1 = Math.min(Math.round(y + h), this.h), a = y + solid, L = Math.max(1, y1 - a);
  for (var j = Math.max(0, y); j < y1; j++) {
    var u = j < a ? 0 : (j - a) / L, f = u * (ramp.length - 1), k = Math.floor(f), fr = f - k;
    for (var i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
      var c = (BAYER[j & 3][i & 3] + .5) / 16 < fr ? ramp[Math.min(k + 1, ramp.length - 1)] : ramp[k];
      if (c) this.p(i, j, c);
    }
  }
  this.r(x, y, w, 1, hl);
};
Buf.prototype.door = function (x, y, w, h, rim) {   // square door: cream in three bands
  x = Math.round(x); y = Math.round(y); w = Math.max(1, Math.round(w)); h = Math.max(2, Math.round(h));
  if (rim) this.r(x - 1, y - 1, w + 2, h + 1, rim);
  var n1 = Math.max(1, Math.round(h * .35)), n2 = Math.max(1, Math.round(h * .45));
  this.r(x, y, w, n1, C3); this.r(x, y + n1, w, n2, C2); this.r(x, y + n1 + n2, w, h - n1 - n2, O6);
};

/* ---------- sprites ---------- */
var SPR = {};
function sprite(n, w) {
  w = Math.round(w) < 24 ? 16 : 32; var k = n + '_' + w;   // two drawn sizes: scenes 16, rooms 32
  if (!SPR[k] && window.PXS && PXS[k]) { var im = new Image(); im.src = PXS[k]; SPR[k] = im; }
  return SPR[k];
}
function stand(ctx, n, w, cx, by, flip, alpha) {   // feet-centre anchored
  var im = sprite(n, w); if (!im || !im.complete || !im.naturalWidth) return;
  ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  var x = Math.round(cx - im.naturalWidth / 2), y = Math.round(by - im.naturalHeight);
  if (flip) { ctx.translate(x + im.naturalWidth, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); }
  else ctx.drawImage(im, x, y);
  ctx.restore();
}
function nOf(img) { var m = (img.getAttribute('src') || '').match(/oreumi(\d)/); if (m) return +m[1]; return /run4/.test(img.getAttribute('src') || '') ? 4 : 1; }

/* ---------- one canvas per scene, on the opening apartment's grid (stage / 240) ---------- */
function Layer(scene) {
  var c = document.createElement('canvas'); c.className = 'px-layer'; c.setAttribute('aria-hidden', 'true');
  scene.insertBefore(c, scene.firstChild);
  this.scene = scene; this.c = c; this.ctx = c.getContext('2d'); this.buf = null; this.stage = $('.stage', scene);
}
Layer.prototype.begin = function () {
  var R = this.scene.getBoundingClientRect(), T = this.stage.getBoundingClientRect(); if (!R.width || !T.width) return false;
  var cell = T.width / 240, dx = T.left - R.left, dy = T.top - R.top;
  var ox = dx - Math.ceil(dx / cell) * cell, oy = dy - Math.ceil(dy / cell) * cell;   // grid lines through the stage corner
  var W = Math.ceil((R.width - ox) / cell), H = Math.ceil((R.height - oy) / cell);
  if (!this.buf || this.buf.w !== W || this.buf.h !== H) { this.buf = new Buf(W, H); this.c.width = W; this.c.height = H; }
  // rects are in screen px; CSS lengths are in layout px (before the page zoom of js/fit.js)
  var z = this.scene.offsetWidth ? R.width / this.scene.offsetWidth : 1;
  var st = this.c.style; st.left = (ox / z) + 'px'; st.top = (oy / z) + 'px'; st.width = (W * cell / z) + 'px'; st.height = (H * cell / z) + 'px';
  this.R = R; this.cell = cell; this.ox = ox; this.oy = oy; this.buf.clear(); this.ctx.imageSmoothingEnabled = false;
  return true;
};
Layer.prototype.rect = function (el) {   // element rect in grid units
  var r = el.getBoundingClientRect(), k = this.cell;
  return { x: (r.left - this.R.left - this.ox) / k, y: (r.top - this.R.top - this.oy) / k, w: r.width / k, h: r.height / k };
};
Layer.prototype.flush = function () { this.ctx.putImageData(this.buf.img, 0, 0); };

/* ======================================================
   두 개의 방: the two rooms (drawn once, 132×74, placed on the room box)
   ====================================================== */
var RK = 240 / 132;
function roomBuf() {   // a 240×135 buffer addressed in the 132×74 design grid
  var q = new Buf(240, 135);
  q.X = function (x) { return Math.round((x - 101) * RK); }; q.Y = function (y) { return Math.round((y - 30) * RK); };
  q.R = function (x, y, w, h, c) {
    var x0 = q.X(x), y0 = q.Y(y), x1 = w === 1 ? x0 + 1 : q.X(x + w), y1 = h === 1 ? y0 + 1 : q.Y(y + h);
    q.r(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), c);
  };
  q.P = function (x, y, c) { q.r(q.X(x), q.Y(y), 1, 1, c); };
  q.ROWS = function (y0, y1, fx, c, t) {   // design-row spans → screen rows
    for (var y = q.Y(y0); y < q.Y(y1); y++) { var yy = y / RK + 30, ab = fx(yy);
      for (var x = q.X(ab[0]); x < q.X(ab[1]); x++) if (t === undefined || (BAYER[y & 3][x & 3] + .5) / 16 < t) q.p(x, y, c); }
  };
  q.CIRC = function (cx, cy, r, c) { var X = q.X(cx), Y = q.Y(cy), rr = Math.round(r * RK); for (var j = -rr; j <= rr; j++) { var w = Math.floor(Math.sqrt(rr * rr - j * j) + .35); q.r(X - w, Y + j, w * 2 + 1, 1, c); } };
  return q;
}
function roomA() {
  var q = roomBuf(), R = q.R, Pp = q.P;
  R(101, 30, 132, 74, K3); R(101, 85, 132, 19, K2); R(101, 85, 132, 1, K4);
  R(106, 38, 42, 47, K4);
  q.ROWS(66, 85, function (y) { return [115 - (y - 66) * .25, 137 + (y - 66) * .25]; }, K5, .5);
  R(110, 41, 32, 1, K6); R(111, 42, 30, 24, K5);
  for (var i = 112; i < 141; i += 3) R(i, 42, 1, 24, K4);
  R(111, 65, 30, 1, K4); R(125, 42, 1, 24, C1); R(125, 66, 1, 19, K7);
  q.ROWS(85, 104, function (y) { return [124 + (y - 85) * .55, 127 + (y - 85) * .85]; }, K6);
  q.CIRC(153, 46, 3, K5); Pp(153, 46, C1); Pp(154, 45, C1); Pp(153, 47, C1);
  R(165, 81, 8, 6, K5); R(165, 81, 8, 1, K6); Pp(164, 80, K6); Pp(173, 80, K6);
  R(177, 83, 47, 6, K4); R(177, 83, 47, 1, K5); Pp(178, 89, K4); Pp(221, 89, K4);
  R(222, 75, 3, 15, K5); R(222, 75, 3, 1, K6); R(210, 75, 10, 3, K7); R(210, 75, 10, 1, M3);
  for (var X = q.X(178); X < q.X(212); X++) {   // blanket lump, one screen column at a time
    var x = X / RK + 101, top = q.Y(77 + 1.2 * Math.sin((x - 178) / 5.5) + (x < 181 || x > 208 ? 1 : 0));
    q.r(X, top, 1, q.Y(85) - top, O1); q.p(X, top, O2);
  }
  [[124, 93, 'bag'], [138, 92, 'cup'], [131, 97, 'bottle'], [146, 96, 'cup'], [170, 96, 'phone'], [180, 98, 'bottle'], [186, 95, 'cup'], [198, 97, 'bag']].forEach(function (t) {
    var x = t[0], y = t[1];
    if (t[2] === 'bag') { R(x, y + 1, 4, 3, K5); R(x + 1, y, 2, 1, K5); Pp(x + 2, y - 1, K6); }
    if (t[2] === 'cup') { R(x, y, 3, 3, C1); R(x, y + 1, 3, 1, O3); R(x, y, 3, 1, C3); }
    if (t[2] === 'bottle') { R(x, y, 4, 1, C2); R(x + 1, y, 1, 1, O3); Pp(x + 4, y, O4); }
    if (t[2] === 'phone') R(x, y, 1, 2, C3);
  });
  [[0, 0], [1, 0], [0, 1], [239, 0], [238, 0], [239, 1], [0, 134], [1, 134], [0, 133], [239, 134], [238, 134], [239, 133]].forEach(function (c) { q.d[(c[1] * 240 + c[0]) * 4 + 3] = 0; });
  return q;
}
function roomB() {
  var q = roomBuf(), R = q.R, Pp = q.P;
  R(101, 30, 132, 74, K4); R(101, 85, 132, 19, K3);
  [[102, 221, K5], [117, 206, K6], [131, 191, K7]].forEach(function (l) {
    q.ROWS(44, 104, function (y) { return [161 + (l[0] - 161) * (y - 43) / 61, 161 + (l[1] - 161) * (y - 43) / 61]; }, l[2]);
  });
  R(101, 85, 132, 1, K6);
  R(161, 30, 1, 9, K6); R(158, 39, 7, 3, K6); R(157, 41, 9, 1, K6); R(158, 39, 7, 1, K7); R(160, 42, 2, 1, C3);
  R(114, 41, 24, 1, K6); R(115, 42, 22, 23, K6); R(116, 43, 20, 21, K1); R(125, 43, 1, 21, K5); R(116, 53, 20, 1, K5); R(132, 46, 2, 2, C3);
  R(110, 41, 5, 25, O2); R(110, 41, 1, 25, O1); R(137, 41, 5, 25, O2); R(141, 41, 1, 25, O1);
  R(199, 53, 17, 32, K6); R(200, 54, 15, 31, K5); R(202, 56, 11, 11, K4); R(203, 57, 9, 9, K5); R(202, 70, 11, 12, K4); R(203, 71, 9, 10, K5);
  Pp(202, 69, O4); R(198, 85, 19, 1, K6); R(202, 84, 3, 1, C2); R(206, 84, 3, 1, C2);
  R(109, 75, 2, 15, K6); R(109, 83, 40, 5, K5); R(109, 83, 40, 1, K6); Pp(110, 88, K5); Pp(147, 88, K5);
  R(111, 79, 37, 4, C2); R(113, 76, 9, 3, C3); R(135, 78, 13, 5, O4); R(135, 78, 13, 1, O5); R(137, 78, 1, 5, O5);
  R(160, 78, 17, 1, C1); R(161, 79, 1, 8, C1); R(175, 79, 1, 8, C1); R(163, 76, 2, 2, C2); R(170, 76, 3, 2, C2);
  [[171, 72], [170, 73], [172, 73], [169, 74], [173, 74], [171, 74], [171, 75]].forEach(function (p) { Pp(p[0], p[1], O2); });
  Pp(181, 74, C1); Pp(183, 76, C1);
  [[0, 0], [1, 0], [0, 1], [239, 0], [238, 0], [239, 1], [0, 134], [1, 134], [0, 133], [239, 134], [238, 134], [239, 133]].forEach(function (c) { q.d[(c[1] * 240 + c[0]) * 4 + 3] = 0; });
  return q;
}
var ROOMS = null;
function toCanvas(b) { var c = document.createElement('canvas'); c.width = b.w; c.height = b.h; c.getContext('2d').putImageData(b.img, 0, 0); return c; }

function drawBuilding(L, p) {
  var sc = L.scene, ph = +(sc.dataset.phase || 0);
  L.c.style.opacity = ph > 0 ? 1 : 0;
  if (!L.begin()) return;
  L.flush();
  if (ph === 0) return;
  if (!ROOMS) {   // the two rooms, drawn on the grid (js/pxsprites.js); falls back to the built-in drawing
    if (window.PXROOM) { ROOMS = ['a', 'b'].map(function (k) { var im = new Image(); im.src = PXROOM[k]; return im; }); }
    else ROOMS = [toCanvas(roomA()), toCanvas(roomB())];
  }
  if (ROOMS[ph - 1].complete === false) return;
  var room = $(ph === 1 ? '.room-a' : '.room-b', sc), r = L.rect(room), ctx = L.ctx;
  ctx.drawImage(ROOMS[ph - 1], Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.w * 135 / 240));
  var who = $('.r-oru', room);
  if (who) {
    var wr = L.rect(who), flip = ph === 2 && /scaleX\(-1\)|matrix\(-1/.test(getComputedStyle(who).transform);
    stand(ctx, ph === 1 ? 1 : 2, wr.w, wr.x + wr.w / 2, wr.y + wr.h, flip);
  }
}

/* ======================================================
   문 밖의 벽: the opening's apartment with 4 floors (floor = one stair step, the 4F terrace = top of the wall),
   one big wall, square doors. Grid = the stage's 240×135 (1 pixel = 4 stage px), extended to the screen edge.
   ====================================================== */
var WB = null, WC = null, WA = null;
var G = 124, BX = 8, BW = 84, FH = 16, NF = 4, BY = G - (2 + NF * FH);
var TERR = [119, 103, 87, 71], TOPW = 71, WALLX = 108, STEPW = 20, PLATX = 168, TCX = BX + BW + 5;
var DOORS = [173, 194, 215, 236], DW = 12, DH = 17;
var STEPC = [[O2, O3], [O4, O5], [O5, O6]];
var CHUNKS = null, SYM = null;
function symbolSprite() {
  if (SYM !== null) return SYM;
  var im = $('#wallSymbol'); if (!im || !im.complete || !im.naturalWidth) return null;
  var n = 16, c = document.createElement('canvas'); c.width = n; c.height = n;
  var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(im, 0, 0, n, n);
  try {   // hard-edged, one flat orange
    var d = x.getImageData(0, 0, n, n);
    for (var i = 0; i < d.data.length; i += 4) { var a = d.data[i + 3]; if (a > 110) { d.data[i] = 255; d.data[i + 1] = 138; d.data[i + 2] = 61; d.data[i + 3] = 255; } else d.data[i + 3] = 0; }
    x.putImageData(d, 0, 0);
  } catch (e) {}
  SYM = c; return SYM;
}
function apartment(q, fade) {   // the opening apartment's parts, unchanged in size and colour, one floor less
  if (fade <= 0) return;
  function R(x, y, w, h, c) { if (fade >= 1) q.r(x, y, w, h, c); else for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if ((BAYER[j & 3][i & 3] + .5) / 16 < fade) q.p(i, j, c); }
  var bh = 2 + NF * FH;
  R(BX - 3, BY - 3, BW + 6, 3, O2); R(BX + 58, BY - 9, 12, 6, O2);
  R(BX, BY, BW, bh, K5); R(BX, BY, 2, bh, K6); R(BX + BW - 2, BY, 2, bh, K4);
  var lit = { '3-2': 1, '2-0': 1, '1-1': 2, '0-1': 3 };
  for (var f = 0; f < NF; f++) {
    var fy = BY + 2 + f * FH; R(BX, fy + FH - 2, BW, 1, K4);
    for (var b = 0; b < 3; b++) {
      var wx = BX + 7 + b * 26, wy = fy + 1, st = lit[(NF - 1 - f) + '-' + b] || 0;
      R(wx - 1, wy - 1, 20, 13, K3); R(wx, wy, 18, 11, st === 0 ? K1 : st === 3 ? K2 : O4);
      if (st === 1 || st === 2) R(wx, wy, 18, 2, O5);
    }
    R(BX + BW, fy + 11, 11, 1, C2); R(BX + BW, fy + 6, 11, 1, O4);
    for (var k = 0; k < 5; k++) R(BX + BW + 1 + k * 2, fy + 7, 1, 4, O2);
  }
  R(BX + 8, BY + bh - 12, 11, 12, O4); R(BX + 8, BY + bh - 12, 11, 2, O5); R(BX + 6, BY + bh - 13, 15, 1, O2);
  for (var l = 0; l < 4; l++) for (var i2 = 0; i2 < 6 + l * 2; i2++) { var xx = BX + 13 - (6 + l * 2) / 2 + i2, yy = G + 1 + l; if ((BAYER[yy & 3][Math.round(xx) & 3] + .5) / 16 < (.5 - l * .1) * fade) q.p(xx, yy, '#4A2614'); }
}
function placeWallLabels(sc) {   // DOM labels follow the pixel doors and steps (stage px = grid × 4)
  if (sc.dataset.pxPlaced) return; sc.dataset.pxPlaced = 1;
  $$('.wall-door', sc).forEach(function (d, i) { d.style.left = (DOORS[i] * 4) + 'px'; d.style.top = ((TOPW - DH) * 4) + 'px'; d.style.width = (DW * 4) + 'px'; d.style.height = (DH * 4) + 'px'; });
  // step names in one row under the ground line, each centred under its step
  $$('#stepLabels > span', sc).forEach(function (s, i) { s.style.left = ((WALLX + i * STEPW + STEPW / 2) * 4) + 'px'; s.style.top = ((G + 4) * 4) + 'px'; s.style.transform = 'translateX(-50%)'; });
}
function drawWall(L, p) {
  var sc = L.scene; placeWallLabels(sc);
  if (!L.begin()) return;
  if (!WB) { WB = new Buf(300, 135); WC = document.createElement('canvas'); WC.width = 300; WC.height = 135; }
  var q = WB; q.clear();
  var zoom = ease(seg(p, 0.92, 1)), fadeOut = 1 - seg(zoom, 0, 0.5);
  var built = seg(p, 0.12, 0.19), hit = seg(p, 0.67, 0.72), fallT = seg(p, 0.72, 0.84);
  var shake = (p >= 0.67 && p < 0.72) ? Math.round(Math.sin(p * 2200) * 2 * (1 - hit)) : 0;

  q.r(0, G, 300, 1, K4); q.d2(0, G + 1, 300, 2, K0, 1); q.d2(0, G + 1, 300, 2, K4, .3);
  if (!WA) { var ab = new Buf(300, 135); apartment(ab, 1); WA = document.createElement('canvas'); WA.width = 300; WA.height = 135; WA.getContext('2d').putImageData(ab.img, 0, 0); }

  var hWall = Math.round((G - TOPW) * built);
  if (hWall > 0) {
    var top = G - hWall;
    for (var x = WALLX; x < 300; x++) {
      var xs = x + shake, stepI = x < PLATX ? Math.floor((x - WALLX) / STEPW) : -1;
      var broken = stepI >= 0 && fallT > 0;
      var y0 = broken ? Math.max(top, TERR[stepI]) : top;
      var lit = stepI >= 0 ? p > 0.84 + stepI * 0.008 : p > 0.876;
      var body = K4, hl = K5;
      if (lit) { if (stepI >= 0) { body = STEPC[stepI][0]; hl = STEPC[stepI][1]; } else { body = C2; hl = C3; } }
      q.r(xs, y0, 1, G - y0, body); q.p(xs, y0, hl);
      if (x === WALLX || (broken && lit && (x - WALLX) % STEPW === 0) || (lit && x === PLATX)) q.r(xs, y0, 1, G - y0, hl);
    }
    if (built >= 1) DOORS.forEach(function (dx) { q.door(dx + shake, TOPW - DH, DW, DH); });
  }
  if (hit > 0 && fallT === 0) {   // cracks
    [[116, 78], [126, 84], [138, 75], [150, 90], [120, 96], [136, 104], [158, 82]].forEach(function (c, i) {
      if (hit > i / 9) for (var k = 0; k < 4; k++) q.p(c[0] + shake + (k & 1) - (k >> 1), c[1] + k, K1);
    });
  }
  if (fallT > 0 && fallT < 1) {   // the broken part falls in chunks
    if (!CHUNKS) {
      CHUNKS = [];
      for (var cx = WALLX; cx < PLATX; cx += 3) { var si = Math.floor((cx - WALLX) / STEPW);
        for (var cy = TOPW; cy < TERR[si]; cy += 3) CHUNKS.push([cx, cy, (cx * 31 + cy * 17) % 23]); }
    }
    CHUNKS.forEach(function (c) {
      var t = clamp((fallT - ((G - c[1]) / (G - TOPW)) * 0.25 - c[2] * 0.008) / 0.45);
      var yy = c[1] + 160 * t * t, xx = c[0] + (c[2] - 11) * 0.7 * t;
      if (t < 1 && yy < G) q.r(xx, yy, 3, 3, (c[2] & 1) ? K4 : K5);
    });
  }
  if (hit > 0 && hit < 1) {   // impact ring
    var rr = Math.round(3 + hit * 16);
    for (var a2 = 0; a2 < 64; a2++) { var ang = a2 / 64 * Math.PI * 2; if ((a2 & 1) || hit < .5) q.p(138 + Math.cos(ang) * rr, 88 + Math.sin(ang) * rr, C2); }
  }
  var symC = symbolSprite(), sym = null;
  if (symC && p >= 0.62 && p <= 0.76) {
    var fly = seg(p, 0.62, 0.67), sx, sy, so = 1;
    if (fly < 1) { var f = fly * fly; sx = lerp(-30, 138, f); sy = lerp(10, 88, f) - Math.sin(fly * Math.PI) * 24; }
    else { var bk = ease(seg(p, 0.67, 0.74)); sx = 138 - 15 * bk; sy = 88 - 12 * bk + 8 * bk * bk; so = 1 - seg(p, 0.71, 0.76); }
    sym = [sx, sy, so, Math.floor(fly * 8) % 4];
  }

  // place the world on the camera box (1:1 at rest, follows the camera zoom at the end)
  var cam = L.rect($('#wallCam', sc)), s = cam.w / 240;
  WC.getContext('2d').putImageData(q.img, 0, 0);
  var ctx = L.ctx; L.flush();
  ctx.save(); ctx.imageSmoothingEnabled = false;
  var T = function () { ctx.setTransform(s, 0, 0, s, Math.round(cam.x), Math.round(cam.y)); };
  T(); ctx.globalAlpha = fadeOut; ctx.drawImage(WA, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(WC, 0, 0);
  if (sym) { ctx.globalAlpha = sym[2]; ctx.translate(Math.round(sym[0]), Math.round(sym[1])); ctx.rotate(sym[3] * Math.PI / 2); ctx.drawImage(symC, -8, -8); ctx.globalAlpha = 1; T(); }
  // 1F 준호 · 2F 도희: out on their terraces → small hops that fall short → onto the step of their own height
  function youth(n, fl, t0, w) {
    var o = seg(p, 0.02, 0.08), base = TERR[fl], land = [WALLX + fl * STEPW + STEPW / 2, TERR[fl]], pos;
    if (p < 0.49) pos = [lerp(TCX - 6, TCX, o), base];
    else if (p < 0.59) { var hp = seg(p, 0.49, 0.585); pos = [TCX + 2 * Math.sin(Math.PI * Math.min(1, hp * 1.2)), base - 4 * Math.abs(Math.sin(hp * Math.PI * 3)) * (1 - hp * .35)]; }
    else if (p < t0) pos = [TCX, base];
    else { var t = ease(seg(p, t0, t0 + 0.03)); pos = [lerp(TCX, land[0], t), lerp(base, land[1], t) - 4 * 14 * t * (1 - t)]; }
    if (p >= 0.49 && p < t0 && !reduced && (Math.floor(performance.now() / 90) & 1)) pos[0] += 1;
    stand(ctx, n, w, pos[0], pos[1], false, o);
  }
  youth(1, 0, 0.878, 16); youth(2, 1, 0.884, 15);
  // 3F: steps out, jumps onto the wall top, walks to the first door and goes in
  var out = seg(p, 0.27, 0.33), pos3, o3 = out;
  if (p < 0.39) pos3 = [lerp(TCX - 6, TCX, out), TERR[2]];
  else if (p < 0.42) { var t3 = ease(seg(p, 0.39, 0.42)); pos3 = [lerp(TCX, PLATX + 6, t3), lerp(TERR[2], TOPW, t3) - 4 * 12 * t3 * (1 - t3)]; }
  else if (p < 0.455) pos3 = [lerp(PLATX + 6, DOORS[0] + DW / 2, ease(seg(p, 0.42, 0.455))), TOPW];
  else { pos3 = [DOORS[0] + DW / 2, TOPW]; o3 = 1 - seg(p, 0.455, 0.475); }
  if (o3 > 0) stand(ctx, 4, 15, pos3[0], pos3[1], false, o3 * fadeOut);
  ctx.restore();
}

/* ======================================================
   1단계 · 계속 오름: big steps fade out downward; thin layers stay flat
   ====================================================== */
var SLAB1 = [[O2, O3], [O2, O3], [O3, O4], [O3, O4], [O3, O4], [O4, O5], [O4, O5]];
var SLABM = [[O4, O5], [O4, O5], [O5, O6], [O5, O6], [O5, O6], [O6, C1], [O6, C1], [C1, C2], [C1, C2], [C2, C3]];
function slabs(L, list, colors, floors) {
  // thin layers stacked without gaps: each one is filled down to whatever lies right under it
  var q = L.buf, items = [];
  (floors || []).forEach(function (f) { items.push({ x: Math.round(f.x), x2: Math.round(f.x + f.w), y: Math.round(f.y), floor: true }); });
  list.forEach(function (e, i) {
    var cs = getComputedStyle(e); if (+cs.opacity < .2 || cs.visibility === 'hidden') return;
    var r = L.rect(e), it = { x: Math.round(r.x), x2: Math.round(r.x + r.w), y: Math.round(r.y), h: Math.max(3, Math.round(r.h) + 1), i: i,
      ghost: e.classList.contains('pending'), show: !e.classList.contains('pending') || e.classList.contains('ghost') };
    if (it.show) items.push(it);
  });
  items.forEach(function (it) {
    if (it.floor) return;
    var w = it.x2 - it.x;
    if (it.ghost) { for (var xx = it.x; xx < it.x2; xx += 2) q.p(xx, it.y, K5); q.r(it.x, it.y, 1, 3, K5); return; }
    var bottom = it.y + it.h;
    items.forEach(function (o) { if (o === it || o.ghost) return; if (o.y > it.y && o.x < it.x2 && o.x2 > it.x) bottom = Math.min(bottom, o.y); });
    var c = colors[Math.min(it.i, colors.length - 1)];
    q.r(it.x, it.y, w, Math.max(2, bottom - it.y), c[0]); q.r(it.x, it.y, w, 1, c[1]);
  });
}
function bgOf(sc) { var b = getComputedStyle(sc).backgroundColor; var v = col(b); return (b.indexOf('rgba') === 0 && /,\s*0\)$/.test(b)) ? PAGE : '#' + v.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join(''); }
function drawStep1(L, p) {
  if (!L.begin()) return;
  var sc = L.scene, q = L.buf, bg = bgOf(sc);
  var s1 = L.rect($('.solid-1', sc)), s2 = L.rect($('.solid-2', sc));
  q.fade(s1.x, s1.y, s1.w, s1.h, O1, O2, 11, bg);
  q.fade(s2.x, s2.y, s2.w, s2.h, O4, O5, 25, bg);
  slabs(L, $$('#slabs .slab', sc), SLAB1, [s1, s2]);
  L.flush();
  var o = $('#stepOru', sc); if (o) { var r = L.rect(o), fl = /matrix\(-1|scaleX\(-1\)/.test(getComputedStyle(o).transform); if (+getComputedStyle(o).opacity > .05) stand(L.ctx, nOf(o), r.w, r.x + r.w / 2, r.y + r.h, fl); }
}
function drawMontage(L, p) {
  if (!L.begin()) return;
  var sc = L.scene, q = L.buf, bg = bgOf(sc);
  var floors = [];
  [['.m-s2', O4, O5, 11], ['.m-s3', O5, O6, 18], ['.m-s4', C2, C3, 29]].forEach(function (t) {
    var e = $(t[0], sc); if (!e) return; var r = L.rect(e); floors.push(r); q.fade(r.x, r.y, r.w, r.h, t[1], t[2], t[3], bg);
  });
  slabs(L, $$('#mSlabs .slab', sc), SLABM, floors);
  var d = $('#mDoor .wd-open', sc);
  if (d) { var dr = L.rect(d); q.door(dr.x, dr.y, dr.w, dr.h); q.r(Math.round(dr.x) - 1, Math.round(dr.y + dr.h), Math.round(dr.w) + 2, 1, C1); }
  L.flush();
  var o = $('#mOru', sc); if (o) { var r = L.rect(o); if (+getComputedStyle(o).opacity > .05) stand(L.ctx, nOf(o), r.w, r.x + r.w / 2, r.y + r.h, /matrix\(-1/.test(getComputedStyle(o).transform)); }
}
function drawDoor(L, p, epi) {
  if (!L.begin()) return;
  var sc = L.scene, q = L.buf, d = $('.big-door .wd-open', sc); if (!d) return;
  var r = L.rect(d), light = epi || sc.classList.contains('flooded') || p > 0.56;
  if (epi) { q.halo(r.x, r.y, r.w, r.h, C2, 5, 22, .6); q.door(r.x, r.y, r.w, r.h, C1); }
  else { q.halo(r.x, r.y, r.w, r.h, light ? C1 : K6, 5, 22, .6); q.halo(r.x, r.y, r.w, r.h, light ? C2 : O2, 2, 7, .7); q.door(r.x, r.y, r.w, r.h, C3); }
  L.flush();
}

/* ---------- wiring ---------- */
var DRAW = { building: drawBuilding, wall: drawWall, step1: drawStep1, montage: drawMontage, door: function (L, p) { drawDoor(L, p, false); }, epilogue: function (L, p) { drawDoor(L, p, true); } };
var layers = {}, state = { name: null, p: 0 };
function layer(name) {
  if (!layers[name]) { var sc = $('.scene-' + name); if (!sc) return null; layers[name] = new Layer(sc); }
  return layers[name];
}
function frame() {
  requestAnimationFrame(frame);
  if (state.name && DRAW[state.name]) { var L = layer(state.name); if (L) DRAW[state.name](L, state.p); }
}
window.PXStory = { update: function (name, scene, p) { state.name = name; state.p = p; } };
document.documentElement.classList.add('px-story');
requestAnimationFrame(frame);
})();
