/* Review tool (temporary): a small panel in the bottom-left corner to jump between scenes and their beats.
   It adds one fixed element on top of the page and its own styles, scoped to #devnav, so removing the
   <script src="js/devnav.js"> line takes it away without moving anything else. */
(function () {
  'use strict';
  if (!window.OreumStory) return;
  var scenes = [].slice.call(document.querySelectorAll('.scene')), starts = [], total = 0;
  scenes.forEach(function (s) { starts.push(total); total += parseFloat(s.dataset.len); });
  var points = [];                                   // every beat: { scene index, global position, label }
  scenes.forEach(function (s, i) {
    var name = s.dataset.chapter || s.dataset.scene;
    (s.dataset.beats || '0').split(',').forEach(function (b, k) {
      points.push({ i: i, x: Math.min(total - .0001, starts[i] + parseFloat(b) * parseFloat(s.dataset.len)), label: (i + 1) + '. ' + name + (k ? ' · ' + (k + 1) : '') });
    });
  });

  var css = document.createElement('style');
  css.textContent =
    '#devnav{position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;gap:4px;align-items:center;padding:6px;border-radius:10px;' +
    'background:rgba(20,17,16,.86);box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 12px/1 system-ui,sans-serif;color:#F4EDE6;zoom:1}' +
    '#devnav button,#devnav select{all:unset;box-sizing:border-box;height:28px;padding:0 9px;border-radius:7px;background:#2E2724;color:#F4EDE6;cursor:pointer;font:600 12px/28px system-ui,sans-serif;white-space:nowrap}' +
    '#devnav select{max-width:220px;overflow:hidden;text-overflow:ellipsis;padding-right:9px}' +
    '#devnav button:hover,#devnav select:hover{background:#FF6A00;color:#1C1917}' +
    '#devnav button:focus-visible,#devnav select:focus-visible{outline:2px solid #FFB682}' +
    '#devnav.min>:not(.dn-tog){display:none}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'devnav'; box.setAttribute('aria-label', '검토용 장면 이동');
  box.innerHTML = '<button type="button" data-a="ps" title="이전 장면">⏮</button>' +
    '<button type="button" data-a="pb" title="이전 순간">◀</button>' +
    '<select aria-label="장면 선택"></select>' +
    '<button type="button" data-a="nb" title="다음 순간">▶</button>' +
    '<button type="button" data-a="ns" title="다음 장면">⏭</button>' +
    '<button type="button" class="dn-tog" data-a="tog" title="접기 / 펴기">–</button>';
  var sel = box.querySelector('select');
  points.forEach(function (p, k) { var o = document.createElement('option'); o.value = k; o.textContent = p.label; sel.appendChild(o); });
  document.body.appendChild(box);
  // keep the panel's own clicks and keys from also moving the story
  ['wheel', 'keydown', 'touchstart', 'touchend'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });

  function cur() { var t = OreumStory.now(), k = 0; points.forEach(function (p, j) { if (p.x <= t + 1e-4) k = j; }); return k; }
  function go(k) { k = Math.max(0, Math.min(points.length - 1, k)); OreumStory.seek(points[k].x); sel.value = k; }
  sel.addEventListener('change', function () { go(+sel.value); sel.blur(); });
  box.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var k = cur(), a = b.dataset.a;
    if (a === 'pb') go(k - 1);
    else if (a === 'nb') go(k + 1);
    else if (a === 'ps') {                          // start of this scene, or of the one before if already there
      var first = function (i) { for (var q = 0; q < points.length; q++) if (points[q].i === i) return q; return 0; };
      var f0 = first(points[k].i); go(k > f0 || OreumStory.now() > points[f0].x + 1e-4 ? f0 : first(points[k].i - 1));
    }
    else if (a === 'ns') { for (var q2 = k + 1; q2 < points.length; q2++) if (points[q2].i > points[k].i) { go(q2); return; } }
    else if (a === 'tog') { box.classList.toggle('min'); b.textContent = box.classList.contains('min') ? '+' : '–'; }
    b.blur();
  });
  setInterval(function () { if (document.activeElement !== sel) sel.value = cur(); }, 400);
})();
