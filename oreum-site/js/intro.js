/* oreum start screen: a night of pixel apartment blocks, one window lit with 오르미 asleep inside */
(function () {
'use strict';
var cv = document.getElementById('introPx'); if (!cv) return;
var a = cv.getContext('2d');
var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
var O1 = new Image(); O1.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAANCAYAAACtpZ5jAAAAcklEQVR4nGNgIBLsCOX/T6xaBgYGBiZSFJNiOE6Dd4Ty/4cZhM1AZHmSDMblSlwGoouxYJP0WP2RkZCFuAyEAawuJjWisDmGkVyDCFlCUqog1lAGBhKTGzEA5nuqGwwDTITCd9JFVqLE0AHNIo+a5qEAAI9+MkbhzQikAAAAAElFTkSuQmCC';
function rng(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
var R = rng(11), BL = [], x = 150;
while (x < 330) { var w = 28 + Math.floor(R() * 18), h = 70 + Math.floor(R() * 70); BL.push([x, 180 - h, w, h, Math.floor(R() * 1000)]); x += w + 4 + Math.floor(R() * 6); }
var LIT = { b: 2, c: 1, r: 3 };
function draw(t) {
  a.fillStyle = '#1C1917'; a.fillRect(0, 0, 320, 180);
  var r = rng(3); for (var i = 0; i < 50; i++) { var sx = r() * 320 | 0, sy = r() * 80 | 0, v = r(); if (!reduced && Math.sin(t / 700 + i * 2) < -.3) continue; a.fillStyle = v > .8 ? '#FFE9D9' : '#5C4A3E'; a.fillRect(sx, sy, 1, 1); }
  BL.forEach(function (B, bi) {
    a.fillStyle = '#2A2220'; a.fillRect(B[0], B[1], B[2], B[3]); a.fillStyle = '#3A302A'; a.fillRect(B[0], B[1], B[2], 1);
    var cols = Math.floor((B[2] - 4) / 7), rows = Math.floor((B[3] - 6) / 9);
    for (var rr = 0; rr < rows; rr++) for (var cc = 0; cc < cols; cc++) {
      var wx = B[0] + 3 + cc * 7, wy = B[1] + 5 + rr * 9, lit = (bi === LIT.b && rr === LIT.r && cc === LIT.c);
      var dim = ((B[4] + rr * 7 + cc * 13) % 17 === 0) && (reduced || Math.sin(t / 3000 + bi + rr) > -.5);
      if (lit) {
        var g = .5 + .5 * Math.sin(t / 900);
        for (var j = -8; j < 14; j++) for (var i2 = -8; i2 < 13; i2++) { var d = Math.hypot(i2 - 2, j - 3); if (d > 4 && d < 10) { var X = wx + i2, Y = wy + j; if ((BAYER[Y & 3][X & 3] + .5) / 16 < (10 - d) / 6 * .25 * (.7 + .3 * g)) { a.fillStyle = '#5A3016'; a.fillRect(X, Y, 1, 1); } } }
      }
      a.fillStyle = lit ? '#FF8A3D' : dim ? '#4A3A32' : '#161212'; a.fillRect(wx, wy, 5, 6);
      if (lit) { a.fillStyle = '#FFB27A'; a.fillRect(wx, wy, 5, 1); }
    }
  });
  a.fillStyle = '#120E0D'; a.fillRect(0, 176, 320, 4);
  var B = BL[LIT.b], wx2 = B[0] + 3 + LIT.c * 7, wy2 = B[1] + 5 + LIT.r * 9, ix = wx2 - 34, iy = wy2 - 34;
  a.fillStyle = '#FFE9D9'; a.fillRect(ix - 1, iy - 1, 30, 22); a.fillStyle = '#FF8A3D'; a.fillRect(ix, iy, 28, 20); a.fillStyle = '#FFB27A'; a.fillRect(ix, iy, 28, 3);
  if (O1.complete) a.drawImage(O1, ix + 3, iy + 20 - O1.height);
  a.fillStyle = '#FFE9D9'; for (var k = 0; k < 6; k++) a.fillRect(ix + 28 + k, iy + 20 + k * 2, 1, 1);
  var zt = (t / 1500) % 1; a.fillStyle = zt < .8 ? '#FFE9D9' : '#B9A79C'; a.font = '6px monospace'; a.fillText('z', ix + 22 + zt * 3, iy + 8 - zt * 6);
}
var scene = document.querySelector('.scene-intro');
function loop(t) { if (scene.classList.contains('active')) draw(t); requestAnimationFrame(loop); }
O1.onload = function () { draw(performance.now()); };
draw(0); requestAnimationFrame(loop);
document.getElementById('introStart').addEventListener('click', function () { var n = document.getElementById('nextBtn'); if (n) n.click(); });
})();
