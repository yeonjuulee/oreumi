/* oreum start screen: the app's splash on a phone. Its star is drawn here, not baked into the screen,
   so the first step into the story can round it off into the hook's lone dot (one person). */
(function () {
'use strict';
var cv = document.getElementById('introStar'); if (!cv) return;
var ctx = cv.getContext('2d');
var scene = document.querySelector('.scene-intro'), copy = scene.querySelector('.intro-copy');
var photo = document.getElementById('introPhoto'), phone = document.getElementById('introPhone'), island = document.querySelector('#introPhone .ip-island'), screen = document.getElementById('introScreen'), ui = phone.querySelector('.ip-ui');
var clamp = function (v) { return Math.min(1, Math.max(0, v)); };
var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function mix(a, b, t) { a = rgb(a); b = rgb(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(a[i], b[i], t)); }).join(',') + ')'; }

// assets/brand/symbol-orange.png traced from its centroid: radius at 240 angles (clockwise from +x), longest = 1
var STAR = [0.686,0.723,0.771,0.827,0.861,0.874,0.877,0.871,0.856,0.825,0.8,0.775,0.75,0.726,0.708,0.691,0.672,0.656,0.647,0.642,0.644,0.648,0.665,0.688,0.716,0.746,0.78,0.821,0.86,0.877,0.882,0.88,0.869,0.837,0.796,0.758,0.728,0.697,0.67,0.647,0.623,0.608,0.603,0.6,0.603,0.608,0.626,0.645,0.665,0.689,0.715,0.743,0.772,0.801,0.822,0.829,0.826,0.819,0.798,0.775,0.75,0.725,0.706,0.688,0.667,0.652,0.637,0.624,0.608,0.595,0.587,0.584,0.58,0.585,0.594,0.611,0.626,0.647,0.664,0.687,0.712,0.737,0.764,0.796,0.829,0.851,0.86,0.862,0.853,0.831,0.788,0.748,0.713,0.678,0.65,0.624,0.6,0.589,0.582,0.582,0.586,0.595,0.605,0.62,0.632,0.646,0.663,0.681,0.7,0.722,0.745,0.769,0.796,0.826,0.855,0.889,0.924,0.936,0.94,0.934,0.912,0.866,0.821,0.785,0.749,0.722,0.692,0.668,0.645,0.621,0.605,0.594,0.591,0.591,0.597,0.608,0.624,0.642,0.659,0.679,0.704,0.729,0.753,0.782,0.814,0.849,0.867,0.873,0.869,0.856,0.827,0.786,0.75,0.72,0.689,0.662,0.64,0.616,0.597,0.579,0.561,0.545,0.532,0.516,0.507,0.502,0.499,0.502,0.506,0.515,0.527,0.541,0.555,0.57,0.586,0.605,0.621,0.641,0.665,0.689,0.721,0.746,0.782,0.817,0.862,0.907,0.958,0.99,1.0,0.997,0.985,0.941,0.897,0.853,0.815,0.783,0.749,0.725,0.698,0.675,0.653,0.634,0.614,0.599,0.581,0.569,0.555,0.545,0.537,0.536,0.537,0.54,0.552,0.576,0.618,0.672,0.73,0.796,0.824,0.83,0.835,0.829,0.814,0.785,0.759,0.731,0.708,0.688,0.669,0.651,0.633,0.616,0.603,0.592,0.587,0.584,0.588,0.596,0.618,0.649];
var STAR_MEAN = .708;
// the splash's star in phone px: 14px bezel + its centroid in the 402 × 874 splash (assets/app/01_splash.png), longest radius 56.4
var PW = 430, PH = 902, SX = 14 + 202.4, SY = 14 + 370.1, SR = 56.4;
// the hook's lone dot (js/story.js stage 1, R = 14): dot 1.1R, ring 2.2R, same breathing glow
var DOT = 15.4, RING = 30.8;
// hero-bed.jpg (1672 × 941): its blank screen spans x 1043.5–1269.5, y 140.5–607.5 (a little narrower than the splash,
// so the splash is squeezed to fit). Shown 1.18× cover, the phone placed near the hook dot's spot.
var IW = 1672, IH = 941, IX = 1043.5, IY = 140.5, ISX = 226 / 402, ISY = 467 / 874, IZ = 1.18;

// js/story.js keeps these current: p = this scene's progress (1 once the story has moved on), cx/cy = where the hook's dot sits
var state = window.OreumIntro = { p: 0, cx: 0, cy: 0 };
var W = 0, H = 0, shownAt = -1e9;

function size() {
  W = cv.clientWidth; H = cv.clientHeight;
  var zf = W ? cv.getBoundingClientRect().width / W : 1;          // page zoom: draw at the real on-screen resolution
  var dpr = Math.min(4, (window.devicePixelRatio || 1) * zf);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(now) {
  var p = state.p, wide = W > 760;
  var cx = state.cx || (wide ? W * .725 : W / 2), cy = state.cy || (wide ? H * .47 : H * .3);
  // at rest the star sits right on the dot's spot (wide), or the phone stands below the copy (narrow)
  var s, x0, y0, held = wide && W / H >= 1.3 && photo.complete && photo.naturalWidth, asp = 1, sx = SX, sy = SY;
  scene.classList.toggle('held', !!held);
  if (!held) island.style.opacity = '';
  if (held) {                                                     // the photo covers the screen; the splash sits on its phone
    var c = Math.max(W / IW, H / IH) * IZ;
    var ox = Math.min(0, Math.max(W - IW * c, W * .7 - (IX + 113) * c)), oy = Math.min(0, Math.max(H - IH * c, H * .47 - (IY + 233) * c));
    photo.style.transform = 'translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px) scale(' + c.toFixed(4) + ')';
    s = ISX * c; asp = ISY / ISX; sx = SX - 14; sy = SY - 14;
    x0 = ox + (IX + sx * ISX) * c; y0 = oy + (IY + sy * ISY) * c;
  } else if (wide) { s = Math.min(H * .74 / PH, W * .3 / PW); x0 = cx; y0 = cy; }
  else { s = Math.min(H * .4 / PH, W * .56 / PW); x0 = W / 2; y0 = H - 100 - (PH - SY) * s; }

  // copy steps away first
  copy.style.opacity = 1 - seg(p, 0, .28);
  copy.style.translate = '0 ' + (-24 * ease(seg(p, 0, .3))).toFixed(1) + 'px';
  copy.style.visibility = p > .3 ? 'hidden' : '';
  // the phone stays where it is: its screen switches off and it fades, only its star stays lit in the night
  phone.style.transform = 'translate(' + (x0 - sx * s).toFixed(1) + 'px,' + (y0 - sy * s * asp).toFixed(1) + 'px) scale(' + s.toFixed(4) + ',' + (s * asp).toFixed(4) + ')';
  phone.style.opacity = 1 - seg(p, .18, .4);
  if (held) {
    photo.style.opacity = phone.style.opacity;
    phone.style.opacity = 1 - seg(p, .38, .48);                   // its dark screen stays solid until the photo is gone (no white showing through)
    island.style.opacity = 1 - seg(p, .2, .34);
  }
  ui.style.opacity = 1 - seg(p, 0, .16);
  screen.style.backgroundColor = mix('#FFFFFF', '#1C1917', ease(seg(p, .04, .26)));

  // the star: points round off, it shrinks to one dot, turns from brand orange to the story's peach
  var a = ease(seg(p, .14, .62)), b = ease(seg(p, .2, .78)), m = ease(seg(p, .3, .86));
  var x = lerp(x0, cx, m), y = lerp(y0, cy, m), sc = lerp(SR * s, DOT / STAR_MEAN, b), rot = -.45 * ease(seg(p, .1, .8));
  var g = seg(p, .72, 1), pulse = .5 + .5 * Math.sin(now / 650);
  ctx.clearRect(0, 0, W, H);
  if (g > 0) {                                                    // the hook's soft light, breathing in step with it
    var gr = RING * (3.2 + pulse * 1.2), glow = ctx.createRadialGradient(x, y, 0, x, y, gr);
    glow.addColorStop(0, 'rgba(255,255,255,' + (.42 * g) + ')');
    glow.addColorStop(.45, 'rgba(255,248,242,' + (.14 * g) + ')');
    glow.addColorStop(1, 'rgba(255,248,242,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, gr, 0, 6.2832); ctx.fill();
  }
  ctx.fillStyle = mix('#FF6A00', '#FFFFFF', ease(seg(p, .4, .85)));          // ends as the hook's white dot
  ctx.beginPath();
  for (var i = 0; i < STAR.length; i++) {
    var t = i / STAR.length * 6.2832 + rot, r = sc * lerp(STAR[i], STAR_MEAN, a);
    if (i) ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); else ctx.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
  }
  ctx.closePath(); ctx.fill();
  if (g > 0) {                                                    // and its ring, opening out from the dot
    ctx.strokeStyle = 'rgba(255,255,255,' + g + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, lerp(DOT, RING, easeOut(g)), 0, 6.2832); ctx.stroke();
  }
}

// draws while the start screen is on (plus its fade-out, so it stays in step with the hook's dot)
function loop(now) {
  if (scene.classList.contains('active')) shownAt = now;
  if (now - shownAt < 900) draw(now);
  requestAnimationFrame(loop);
}
window.addEventListener('resize', size);
size(); requestAnimationFrame(loop);
document.getElementById('introStart').addEventListener('click', function () { var n = document.getElementById('nextBtn'); if (n) n.click(); });
})();
