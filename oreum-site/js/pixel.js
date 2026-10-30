/* oreum · pixel apartment for "두 개의 방" — the '달밤의 게임보이' (A) drawing, 240×135 over the 960×540 stage
   (1 pixel = 4 stage px). Moved 20px right so the moon clears the title. */
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
    bands: function (x, y, w, h, cols) { var n = cols.length, bh = h / n; for (var k = 0; k < n; k++) P.r(x, y + Math.round(k * bh), w, Math.ceil(bh) + 1, cols[k]); },
    c: function (cx, cy, r, c) { ctx.fillStyle = c; for (var j = -r; j <= r; j++) { var w = Math.floor(Math.sqrt(r * r - j * j) + .35); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); } },
    txt: function (s, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, (y | 0) - 4, 3, 1); ctx.fillRect((x | 0) + 1, (y | 0) - 3, 1, 1); ctx.fillRect(x | 0, (y | 0) - 2, 3, 1); }
  };
  return P;
}
function clipDraw(ctx, im, x, y, cx, cy, cw, ch) { if (!im.complete) return; ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip(); ctx.drawImage(im, x, y); ctx.restore(); }

/* ---------------- A : moonlit game-boy (240×135) ---------------- */
function sceneA(ctx, t) {
  var P = painter(ctx), K = ['#1A1210', '#3A2116', '#B8550F', '#FF8A3D', '#FFE9D9'];
  var R = rng(7);
  ctx.clearRect(0, 0, 240, 135);   // sky = the page itself, so the picture has no box
  for (var i = 0; i < 46; i++) { var sx = R() * 240 | 0, sy = R() * 70 | 0, sv = R(); if (!reduced && Math.sin(t / 600 + i * 1.7) < -0.2) continue; P.p(sx, sy, sv > .85 ? K[4] : sv > .5 ? K[3] : K[2]); }
  // moon: flat disc, two craters, one ring of dithered glow
  for (var j = -22; j <= 22; j++) for (var k = -22; k <= 22; k++) { var dd = Math.hypot(k, j); if (dd > 15 && dd < 20) { var X = 56 + k, Y = 30 + j; if ((BAYER[Y & 3][X & 3] + .5) / 16 < (20 - dd) / 5 * .35) P.p(X, Y, K[1]); } }
  P.c(56, 30, 14, K[4]); P.c(51, 27, 2, '#F5D7C0'); P.c(61, 35, 3, '#F5D7C0'); P.r(63, 24, 2, 2, '#F5D7C0');
  // hills + pines, flat
  for (var x = 0; x < 240; x++) { var h = Math.round(104 + Math.sin(x / 19) * 3 + Math.sin(x / 7) * 1.2); P.r(x, h, 1, 112 - h, K[1]); }
  [[10, 16], [24, 12], [36, 18], [200, 14], [218, 20], [232, 13]].forEach(function (p) { for (var q = 0; q < p[1]; q++) { var w = Math.round(q / p[1] * 5); P.r(p[0] - w, 112 - p[1] + q, w * 2 + 1, 1, '#120C0A'); } });
  P.r(0, 112, 240, 1, K[1]); P.d(0, 113, 240, 2, '#120C0A', K[1], .3);
  // apartment: flat facade, simple window grid
  var bx = 92, by = 32, bw = 84, fh = 16, bh = 80;
  P.r(bx - 3, by - 3, bw + 6, 3, K[2]); P.r(bx + 58, by - 9, 12, 6, K[2]);
  P.r(bx, by, bw, bh, '#4A2A1A'); P.r(bx, by, 2, bh, '#5E3622'); P.r(bx + bw - 2, by, 2, bh, '#3A2116');
  var lit = { '4-0': 1, '3-2': 1, '2-0': 1, '1-1': 2, '0-1': 3 };
  for (var f = 0; f < 5; f++) {
    var fy = by + 2 + f * fh; P.r(bx, fy + fh - 2, bw, 1, '#3A2116');
    for (var b = 0; b < 3; b++) {
      var wx = bx + 7 + b * 26, wy = fy + 1, st = lit[(4 - f) + '-' + b] || 0;
      P.r(wx - 1, wy - 1, 20, 13, '#2A170F');
      var flick = !reduced && st === 1 && Math.sin(t / 430 + f * 3 + b) > .97;
      P.r(wx, wy, 18, 11, st === 0 ? '#1A1210' : st === 3 ? '#20150F' : flick ? K[2] : K[3]);
      if (st === 1 || st === 2) { P.r(wx, wy, 18, 2, '#FFB27A'); }
    }
    P.r(bx + bw, fy + 11, 11, 1, K[4]); P.r(bx + bw, fy + 6, 11, 1, K[3]); for (var q2 = 0; q2 < 5; q2++) P.r(bx + bw + 1 + q2 * 2, fy + 7, 1, 4, K[2]);
  }
  // 2F peeking + "!"
  var w2x = bx + 33, w2y = by + 2 + 3 * fh + 1;
  clipDraw(ctx, S.A2, w2x - 1, w2y - 3, w2x, w2y, 18, 11);
  var bob = reduced ? 0 : Math.round(Math.sin(t / 260));
  P.r(w2x + 5, w2y - 13 + bob, 9, 9, K[4]); P.r(w2x + 6, w2y - 12 + bob, 7, 7, '#1A1210'); P.r(w2x + 9, w2y - 11 + bob, 1, 3, K[4]); P.r(w2x + 9, w2y - 7 + bob, 1, 1, K[4]); P.r(w2x + 8, w2y - 4 + bob, 2, 2, K[4]);
  // 1F curled + phone + z
  var w1x = bx + 33, w1y = by + 2 + 4 * fh + 1;
  clipDraw(ctx, S.A1, w1x - 2, w1y - 1, w1x, w1y, 18, 11);
  if (reduced || Math.sin(t / 180) > -.6) P.r(w1x + 14, w1y + 7, 2, 1, K[4]);
  var zt = (t / 1400) % 1; P.txt('z', w1x + 19 + Math.round(zt * 4), Math.round(w1y - zt * 10), zt < .8 ? K[3] : K[2]);
  // door + lamp
  P.r(bx + 8, by + bh - 12, 11, 12, K[3]); P.r(bx + 8, by + bh - 12, 11, 2, '#FFB27A'); P.r(bx + 6, by + bh - 13, 15, 1, K[2]);
  for (var l = 0; l < 6; l++) P.d(bx + 13 - (6 + l * 2) / 2, 112 + l, 6 + l * 2, 1, '#120C0A', '#4A2614', .5 - l * .07);
  var lx = 212; P.r(lx, 68, 1, 44, K[2]); P.r(lx - 4, 66, 6, 2, K[2]); P.r(lx - 5, 68, 3, 2, K[4]);
  for (var y = 70; y < 112; y++) { var ww = Math.round((y - 70) * .45) + 2; P.d(lx - 4 - ww / 2, y, ww, 1, K[1], '#5A2E16', .3); }
}


function draw(ctx, t) {
  ctx.clearRect(0, 0, 240, 135);
  ctx.save(); ctx.translate(20, 0); sceneA(ctx, t); ctx.restore();
  // the hills and ground continue under the left 20px
  for (var x = 0; x < 20; x++) { var h = Math.round(104 + Math.sin((x - 20) / 19) * 3 + Math.sin((x - 20) / 7) * 1.2); ctx.fillStyle = '#3A2116'; ctx.fillRect(x, h, 1, 112 - h); }
  ctx.fillStyle = '#3A2116'; ctx.fillRect(0, 112, 20, 1);
  for (var y = 113; y < 115; y++) for (var x2 = 0; x2 < 20; x2++) { ctx.fillStyle = (BAYER[y & 3][x2 & 3] + .5) / 16 < .3 ? '#3A2116' : '#120C0A'; ctx.fillRect(x2, y, 1, 1); }
}
window.OreumPixel = { draw: draw, sprites: S };
})();
