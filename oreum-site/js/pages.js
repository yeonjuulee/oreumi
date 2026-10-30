/* oreum info pages (plan · design): reveal on scroll, colour copy, app-screen carousel */
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = Array.prototype.slice.call(document.querySelectorAll('.rv'));
  if (reduced || !('IntersectionObserver' in window)) els.forEach(function (e) { e.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }
  var toast = document.getElementById('toast'), tt;
  function say(m) { if (!toast) return; toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 1600); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (el) {
    function copy() {
      var v = el.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { say(v + ' 복사했어요'); }, function () { say(v); });
      else say(v);
    }
    el.addEventListener('click', copy);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  });
  // drag to scroll the app screens
  Array.prototype.forEach.call(document.querySelectorAll('[data-hscroll]'), function (box) {
    var down = false, sx = 0, sl = 0;
    box.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = box.scrollLeft; box.classList.add('drag'); });
    window.addEventListener('pointerup', function () { down = false; box.classList.remove('drag'); });
    window.addEventListener('pointermove', function (e) { if (down) box.scrollLeft = sl - (e.clientX - sx) / (window.__zoom || 1); });
  });
})();
/* design 전용: 앱 화면 캐러셀 (assets/app/ 의 실제 화면, 피그마 보드 순서) */
(function () {
  'use strict';
  var box = document.getElementById('appScroll');
  if (!box) return;
  var SCREENS = [["01_splash", "스플래시"], ["02_diagnosis", "자가진단"], ["03_diagnosis-done", "자가진단 완료"], ["04_home", "홈"], ["05_home-sheet", "홈 · 오늘의 미션"], ["06_home-decorate", "홈 꾸미기"], ["07_chapter", "챕터"], ["08_mission-camera", "미션 인증"], ["09_mission-loading", "인증 확인 중"], ["10_mission-done", "인증 완료"], ["11_mission-fail", "인증 실패"], ["12_unlock", "배경 해금"], ["13_unlock-popup", "배경 팝업"], ["14_revive-onboarding", "부활 온보딩"], ["15_revive", "부활 미션"], ["16_mission-streak", "연속 활동 달성"], ["17_streak", "연속 활동"], ["18_reward", "리워드 · 환급모드"], ["19_reward-history", "리워드 내역"], ["20_mypage", "마이페이지"], ["21_profile", "프로필"]];
  box.innerHTML = SCREENS.map(function (s) {
    return '<figure class="item"><img class="shot" src="assets/app/' + s[0] + '.png" alt="오름 앱 ' + s[1] + ' 화면" loading="lazy" width="402" height="874"><em>' + s[1] + '</em></figure>';
  }).join('');
})();
