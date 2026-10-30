/* One composition at every 16:9 size.
   Desktop-shaped windows (wider than 900px and wider than 4:3) are laid out on a 1440 × 810 canvas and scaled
   with CSS zoom, so 1280×720, 1920×1080, 2560×1440 and 5120×2880 all show the same picture, only sharper.
   The story fits the whole canvas into the window; the scrolling pages fit the width.
   Narrow or tall windows (phones, tablets in portrait) keep the normal fluid layout. */
(function () {
  var BASE_W = 1440, BASE_H = 810;
  var root = document.documentElement;
  var script = document.currentScript;
  var story = script && script.getAttribute('data-mode') === 'story';
  function fit() {
    var w = window.innerWidth, h = window.innerHeight, z = 1;
    if (w > 900 && w / h > 4 / 3) z = story ? Math.min(w / BASE_W, h / BASE_H) : w / BASE_W;
    root.style.zoom = z === 1 ? '' : z.toFixed(5);
    // vw / vh in the stylesheet follow the zoomed canvas, not the physical window
    root.style.setProperty('--vw', (w / z / 100).toFixed(4) + 'px');
    root.style.setProperty('--vh', (h / z / 100).toFixed(4) + 'px');
    root.classList.toggle('zoomed', z !== 1);
    window.__zoom = z;
  }
  fit();
  window.addEventListener('resize', fit);
  // moving to another page always lands on its top (no restored scroll position, no jump to an old #anchor)
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  function toTop() { if (!location.hash || !document.getElementById(location.hash.slice(1))) window.scrollTo(0, 0); }
  toTop();
  window.addEventListener('DOMContentLoaded', toTop);
  window.addEventListener('pageshow', function (e) { if (e.persisted) window.scrollTo(0, 0); });
})();
