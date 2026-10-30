/* oreum service page — "나의 시작점 찾기" quiz.
   Start step: 1시간 이상 외출한 날이 주 0~1일이면 1단계, 그 외에는 2단계. Q2~Q4는 현재 참고용(판정 기준 확정 전). */
(function () {
  'use strict';
  var form = document.getElementById('quiz');
  var out = document.getElementById('quizResult');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var get = function (n) { var el = form.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : null; };
    var q1 = get('q1'), q2 = get('q2'), q3 = get('q3'), q4 = get('q4');
    if (!q1 || !q2 || !q3 || !q4) {
      out.textContent = '아직 답하지 않은 질문이 있어요. 네 질문 모두 골라 주세요.';
      return;
    }
    var step1 = q1 === 'low';
    out.innerHTML = step1
      ? '<strong>1단계 숨고르기</strong>부터 시작해 보세요. 창문 열기처럼 아주 작은 일상부터 다시 쌓아요.'
      : '<strong>2단계 둘러보기</strong>부터 시작해 보세요. 일상은 이어지고 있으니, 집 앞으로 한 걸음부터요.';
  });

  form.addEventListener('change', function () {
    if (out.textContent.indexOf('아직') === 0) out.textContent = '네 질문에 답하면 시작할 계단을 알려드려요.';
  });
})();

/* hero phone: the app's home screens, one after another every second */
(function () {
  var shots = Array.prototype.slice.call(document.querySelectorAll('.phone-shots img'));
  if (shots.length < 2) return;
  var i = 0;
  setInterval(function () {
    shots[i].classList.remove('on');
    i = (i + 1) % shots.length;
    shots[i].classList.add('on');
  }, 1000);
})();
