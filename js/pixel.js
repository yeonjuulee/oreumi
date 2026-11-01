/* oreum · pixel prelude for "두 개의 방": the apartment drawn as a 240×135 pixel scene laid exactly over the
   960×540 vector stage (1 pixel = 4 stage px), then "upscaled" into the vector drawing on scroll. */
(function () {
'use strict';
var SP = {"A1": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAANCAYAAACtpZ5jAAAAcklEQVR4nGNgIBLsCOX/T6xaBgYGBiZSFJNiOE6Dd4Ty/4cZhM1AZHmSDMblSlwGoouxYJP0WP2RkZCFuAyEAawuJjWisDmGkVyDCFlCUqog1lAGBhKTGzEA5nuqGwwDTITCd9JFVqLE0AHNIo+a5qEAAI9+MkbhzQikAAAAAElFTkSuQmCC", "A2": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAOCAYAAAAvxDzwAAAAm0lEQVR4nGNgIAB2hPL/J6QGGTARYxgphuI1EJfhMEyUgfgUE+NSnC4kNexggJFaBnms/sjIwMDAwEKpQeiA6EghFsC9TC0XMuIzyN1Uj4Ehfg6q4MIUhp2nL+E2EJfr3KecwuuSnTlmGGIeqz8yYg1Dd1M9uGvQXYehBgnsCOX/z4TVy1Bv7jx9Ca+h2ADWSMEadugALSxh6RAAOyBDgbAFGcYAAAAASUVORK5CYII=", "B1": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAQCAYAAAAI0W+oAAAAnElEQVR4nLWUwQ2AIAxFP8YzJwZwGsdgEqdhDAbxzACcWABPNdUIKY28EzH0P2iKwCDJ2zpaAwCLpkgj64qSt5WHtgQSsehGvSDp7YxW8MUWiqE6WhNrK/i9UULvYI/W8XDtdHVFf4cSfJjuns4QEVsoZqHFTAkwuXU8W/Vn0CAWxWxF35oiSdt44HG6IQEx/G5itthdEYXPHLImF3baSSHAigTXAAAAAElFTkSuQmCC", "B2": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAPCAYAAADgbT9oAAAAv0lEQVR4nGNgIAI8iOP7T4w6ZMBErKGkGk7QYGyWwNj4LMNqMD4N6AbiUstIiqG4gMKiTxjmkBQU+AC6T5iQJXDZToyh6GIshBSQC6gWFOgA7m1CrpXX0YezH165SNhgfAbK6+gzMJj5MjAYRmBKzozGawEjLtfK6+gzMKQvxe8sHIYrLPrEiDuMoYbmZxYwMJxfgRA/vwIihqQGHTyI4/vPQlRKMIxANZwAUFj0iRFn5Mkn1WAPW2SAJShg+QAAs95WrRtKMBkAAAAASUVORK5CYII=", "B4": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9klEQVR4nGNgwAMexPH9fxDH9x+fGnTAiMsgbOIKiz5hVY/XQFJchM0CJmI1YwPYLGcipIBUAHcypYbBvM9IjGHySTUMDIYRqIIzoxkeXrmIYSjeMJTX0WeQn3wF07DzKxgY0pdi1YM/UmCazq9ANQzdAnQDsUW/vI4+ggMzYGY0ToNgZjAxMJAQIWa+KK6Tn3wF1WIGHF6W19HHHkZ4vIpiILqXH165iBpuuACWmCaY9eQnX8Fq1sNcHTgb2UEsuAzDmvawAHTf4XQhLpfBNfLLESx5UMD/j4/+wzADAwPD/wNdKHycFpFiATGuo6j4ooqBhMIOAHPFaODEHxliAAAAAElFTkSuQmCC"};
var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
var S = {}; Object.keys(SP).forEach(function (k) { var im = new Image(); im.src = SP[k]; S[k] = im; });
function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function painter(ctx) {
  var P = {
    r: function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    p: function (x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
    d: function (x, y, w, h, c1, c2, t) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var X = x + i, Y = y + j; P.p(X, Y, (BAYER[Y & 3][X & 3] + .5) / 16 < t ? c2 : c1); } },
    c: function (cx, cy, r, c) { ctx.fillStyle = c; for (var j = -r; j <= r; j++) { var w = Math.floor(Math.sqrt(r * r - j * j) + .35); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); } },
    txt: function (s, x, y, c) { ctx.fillStyle = c; ctx.font = '8px monospace'; ctx.fillText(s, x, y); }
  };
  return P;
}
function clipDraw(ctx, im, x, y, cx, cy, cw, ch) { if (!im.complete) return; ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip(); ctx.drawImage(im, x, y); ctx.restore(); }

/* geometry matches the vector apartment: building x 300–660 / y 60–500, 5 floors of 88, windows 84×52 */
function draw(ctx, t) {
  var P = painter(ctx), K = ['#1A1210', '#3A2116', '#B8550F', '#FF8A3D', '#FFE9D9'];
  var R = rng(7);
  ctx.clearRect(0, 0, 240, 135);
  for (var i = 0; i < 46; i++) { var sx = R() * 240 | 0, sy = R() * 60 | 0, sv = R(); if (!reduced && Math.sin(t / 600 + i * 1.7) < -0.2) continue; P.p(sx, sy, sv > .85 ? K[4] : sv > .5 ? K[3] : K[2]); }
  // moon (vector: 860,74)
  for (var j = -20; j <= 20; j++) for (var k = -20; k <= 20; k++) { var dd = Math.hypot(k, j); if (dd > 7 && dd < 14) { var X = 215 + k, Y = 18 + j; if ((BAYER[Y & 3][X & 3] + .5) / 16 < (14 - dd) / 7 * .35) P.p(X, Y, K[1]); } }
  P.c(215, 18, 6, K[4]); P.p(213, 16, '#F5D7C0'); P.r(216, 19, 2, 2, '#F5D7C0');
  // ground (vector y 500)
  P.r(0, 125, 240, 1, K[1]); P.d(0, 126, 240, 2, '#120C0A', K[1], .3);
  [[18, 14], [32, 10], [44, 16], [226, 12]].forEach(function (p) { for (var q = 0; q < p[1]; q++) { var w = Math.round(q / p[1] * 4); P.r(p[0] - w, 125 - p[1] + q, w * 2 + 1, 1, '#120C0A'); } });
  // building
  var bx = 75, by = 15, bw = 90, bh = 110;
  P.r(bx - 2, by - 3, bw + 4, 3, K[2]); P.r(bx + 70, by - 9, 11, 6, K[2]);
  P.r(bx, by, bw, bh, '#4A2A1A'); P.r(bx, by, 2, bh, '#5E3622'); P.r(bx + bw - 2, by, 2, bh, '#3A2116');
  var lit = { '3-0': 1, '2-2': 1, '4-2': 4, '2-1': 4, '1-2': 4, '0-1': 3 };   // same lit / dim windows as the vector drawing
  for (var f = 0; f < 5; f++) {
    var fy = by + f * 22; if (f) P.r(bx, fy, bw, 1, '#3A2116');
    for (var b = 0; b < 3; b++) {
      var wx = 80 + b * 30, wy = fy + 4, st = lit[(4 - f) + '-' + b] || 0;
      P.r(wx - 1, wy - 1, 23, 15, '#2A170F');
      var flick = !reduced && st === 1 && Math.sin(t / 430 + f * 3 + b) > .97;
      P.r(wx, wy, 21, 13, st === 0 ? '#1A1210' : st === 3 ? '#20150F' : st === 4 ? '#5E4638' : flick ? K[2] : K[3]);
      if (st === 1) P.r(wx, wy, 21, 2, '#FFB27A');
      P.r(wx + 10, wy, 1, 13, st === 1 ? K[2] : '#2A170F');
    }
    P.r(bx + bw - 1, fy + 20, 18, 2, K[4]); P.r(bx + bw - 1, fy + 14, 17, 1, K[3]); for (var q2 = 0; q2 < 7; q2++) P.r(bx + bw + 1 + q2 * 2, fy + 15, 1, 5, K[2]);
  }
  // 2F (middle window, y 338–390) — 도희 peeking + "!"
  var w2x = 110, w2y = by + 3 * 22 + 4;
  P.r(w2x, w2y, 21, 13, K[3]); P.r(w2x, w2y, 21, 2, '#FFB27A');
  clipDraw(ctx, S.A2, w2x, w2y, w2x, w2y, 21, 13);
  var bob = reduced ? 0 : Math.round(Math.sin(t / 260));
  P.r(w2x + 6, w2y - 12 + bob, 9, 9, K[4]); P.r(w2x + 7, w2y - 11 + bob, 7, 7, '#1A1210'); P.r(w2x + 10, w2y - 10 + bob, 1, 3, K[4]); P.r(w2x + 10, w2y - 6 + bob, 1, 1, K[4]); P.r(w2x + 9, w2y - 3 + bob, 2, 2, K[4]);
  // 1F (middle window, y 426–478) — 준호 curled + phone + z
  var w1x = 110, w1y = by + 4 * 22 + 4;
  clipDraw(ctx, S.A1, w1x - 1, w1y + 1, w1x, w1y, 21, 13);
  if (reduced || Math.sin(t / 180) > -.6) P.r(w1x + 16, w1y + 9, 2, 1, K[4]);
  var zt = (t / 1400) % 1; P.txt('z', w1x + 22 + Math.round(zt * 4), Math.round(w1y + 2 - zt * 10), zt < .8 ? K[3] : K[2]);
  // entrance (vector door 340–380, y 442–500)
  P.r(85, 111, 10, 14, K[3]); P.r(85, 111, 10, 2, '#FFB27A'); P.r(83, 109, 14, 1, K[2]);
  for (var l = 0; l < 6; l++) P.d(90 - (10 + l * 2) / 2, 126 + l, 10 + l * 2, 1, '#120C0A', '#4A2614', .5 - l * .07);
  // street lamp (vector 812)
  var lx = 203; P.r(lx, 82, 1, 43, K[2]); P.r(lx - 1, 81, 6, 2, K[2]); P.r(lx + 1, 83, 4, 1, K[4]);
  for (var y = 84; y < 125; y++) { var ww = Math.round((y - 84) * .45) + 2; P.d(lx + 3 - ww / 2, y, ww, 1, K[1], '#5A2E16', .3); }
}
window.OreumPixel = { draw: draw, sprites: S };
})();
