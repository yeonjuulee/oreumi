/* oreum service page — "나의 시작점 찾기": the app's first four questions, one at a time.
   A유형(1단계): 하루 외출 0~1회 + 대화 주 0~1일.  B유형(2단계): 외출 3회 이하이면서 A가 아닌 경우.
   일반군(서비스 대상 아님): 외출 4회 이상, 또는 3개월 미만, 또는 일상에 어려움이 없음. */
(function () {
  'use strict';
  var form = document.getElementById('quiz');
  if (!form) return;
  var steps = Array.prototype.slice.call(form.querySelectorAll('.sq-step'));
  var bar = document.getElementById('sqBar'), prev = document.getElementById('sqPrev'), next = document.getElementById('sqNext');
  var out = document.getElementById('quizResult');
  var cur = 0, N = 4;
  function val(n) { var el = form.querySelector('input[name="q' + n + '"]:checked'); return el ? el.value : null; }
  function judge() {
    var out1 = +val(1), talk = +val(2), dur = +val(3), hard = val(4);
    if (out1 >= 4 || dur < 3 || hard === 'no') return 'G';
    return (out1 <= 1 && talk <= 1) ? 'A' : 'B';
  }
  var RESULT = {
    A: '<span class="pill">A유형 · 일상 붕괴형</span><h4>1단계 숨고르기부터 시작해요</h4><p>창문 열기, 제때 일어나기처럼 아주 작은 일상부터 하루 한 칸씩 다시 쌓아요.</p>',
    B: '<span class="pill">B유형 · 외출 장벽형</span><h4>2단계 둘러보기부터 시작해요</h4><p>일상은 이어지고 있으니 1단계는 건너뛰고, 집 앞 산책처럼 문 밖으로 한 걸음부터 시작해요.</p>',
    G: '<span class="pill pill-gray">일반군</span><h4>지금은 오름의 서비스 대상이 아니에요</h4><p>A·B 유형에 해당하지 않아 일반군으로 분류돼요. 오름은 고립·은둔 상태의 청년을 위한 서비스예요. 일자리나 교육 지원이 필요하다면 고용24, 지역 청년센터의 청년 지원 프로그램을 바로 이용해 보세요.</p>'
  };
  function show() {
    steps.forEach(function (s, i) { s.classList.toggle('on', i === cur); });
    bar.style.width = (Math.min(cur + 1, N) / N * 100) + '%';
    prev.disabled = cur === 0;
    if (cur === N) { out.innerHTML = RESULT[judge()]; next.textContent = '다시 하기'; next.disabled = false; prev.textContent = '이전'; }
    else { next.textContent = cur === N - 1 ? '결과 보기' : '다음'; next.disabled = !val(cur + 1); }
  }
  next.addEventListener('click', function () {
    if (cur === N) { form.reset(); cur = 0; show(); return; }
    if (!val(cur + 1)) return;
    cur++; show();
  });
  prev.addEventListener('click', function () { if (cur > 0) { cur--; show(); } });
  form.addEventListener('change', function () { next.disabled = !val(cur + 1); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  show();
})();

/* hero phone: the app's home screens, one after another every 2 seconds, the oreumi beside it changes with the place */
(function () {
  var shots = Array.prototype.slice.call(document.querySelectorAll('.phone-shots img'));
  if (shots.length < 2) return;
  var orus = Array.prototype.slice.call(document.querySelectorAll('.hero-oru img'));
  var i = 0;
  setInterval(function () {
    shots[i].classList.remove('on'); if (orus[i]) orus[i].classList.remove('on');
    i = (i + 1) % shots.length;
    shots[i].classList.add('on'); if (orus[i]) orus[i].classList.add('on');
  }, 2000);
})();

/* widget mockup: show images one by one every 2 seconds with clickable dots */
(function () {
  var shots = Array.prototype.slice.call(document.querySelectorAll('.widget-mockup img'));
  if (shots.length < 2) return;
  var dots = Array.prototype.slice.call(document.querySelectorAll('.widget-dots .dot'));
  var idx = 0;
  var timer = null;

  function show(nextIdx) {
    shots[idx].classList.remove('on');
    if (dots[idx]) {
      dots[idx].classList.remove('on');
      dots[idx].setAttribute('aria-selected', 'false');
    }
    idx = (nextIdx !== undefined) ? nextIdx : (idx + 1) % shots.length;
    shots[idx].classList.add('on');
    if (dots[idx]) {
      dots[idx].classList.add('on');
      dots[idx].setAttribute('aria-selected', 'true');
    }
  }

  function start() {
    stop();
    timer = setInterval(function () {
      show();
    }, 2000);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  dots.forEach(function (dot, k) {
    dot.addEventListener('click', function () {
      show(k);
      start();
    });
  });

  start();
})();
