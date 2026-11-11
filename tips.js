/* 올인 던전 — 설명 말풍선. [data-tip] 요소에 마우스를 올리거나 포커스하면 뜨고,
   폰은 420ms 길게 누르면 뜨며 그때의 클릭은 막는다(짧게 누르면 원래 동작). */
(function () {
  'use strict';
  const HOLD_MS = 420;
  const MARGIN = 8;
  const TOUCH_MOUSE_GAP = 800; // 터치 뒤에 따라오는 가짜 마우스 이벤트 무시
  let el = null;
  let anchor = null;
  let timer = 0;
  let suppressUntil = 0; // 길게 누른 뒤 클릭이 안 오면 저절로 풀린다
  const CLICK_WINDOW_MS = 700;
  const clickSuppressed = () => Date.now() < suppressUntil;
  let lastTouch = 0;

  const target = (n) => (n && n.closest ? n.closest('[data-tip]') : null);

  function hide() {
    clearTimeout(timer);
    anchor = null;
    if (el) { el.remove(); el = null; }
  }

  function show(t) {
    hide();
    el = document.createElement('div');
    el.className = 'tip';
    el.setAttribute('role', 'tooltip');
    el.textContent = t.dataset.tip;
    anchor = t;
    document.body.appendChild(el);
    const r = t.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    const above = r.top - h - 6 >= MARGIN;
    const top = above ? r.top - h - 6 : Math.min(r.bottom + 6, vh - h - MARGIN);
    el.style.left = `${clamp(r.left + r.width / 2 - w / 2, MARGIN, Math.max(MARGIN, vw - w - MARGIN))}px`;
    el.style.top = `${clamp(top, MARGIN, Math.max(MARGIN, vh - h - MARGIN))}px`;
  }

  const onMouse = (fn) => (e) => { if (Date.now() - lastTouch > TOUCH_MOUSE_GAP) fn(e); };

  document.addEventListener('mouseover', onMouse((e) => { const t = target(e.target); if (t) show(t); }));
  document.addEventListener('mouseout', onMouse((e) => { if (target(e.target) && !target(e.relatedTarget)) hide(); }));
  document.addEventListener('focusin', (e) => { const t = target(e.target); if (t && e.target.matches(':focus-visible')) show(t); });
  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
  // 다시 그리면서 기준 요소가 사라지면 mouseout·blur 가 오지 않는다
  new MutationObserver(() => { if (anchor && !anchor.isConnected) hide(); }).observe(document.body, { childList: true, subtree: true });
  const dropStale = () => { if (anchor && !anchor.isConnected) hide(); };
  document.addEventListener('mousedown', () => { suppressUntil = 0; dropStale(); }, true);
  document.addEventListener('keydown', () => { suppressUntil = 0; dropStale(); }, true);

  document.addEventListener('touchstart', (e) => {
    lastTouch = Date.now();
    suppressUntil = 0;
    hide();
    const t = target(e.target);
    if (t) timer = setTimeout(() => { show(t); suppressUntil = Infinity; }, HOLD_MS);
  }, { passive: true });
  const endTouch = () => { lastTouch = Date.now(); clearTimeout(timer); };
  const endHold = () => { endTouch(); if (suppressUntil === Infinity) suppressUntil = Date.now() + CLICK_WINDOW_MS; };
  document.addEventListener('touchend', endHold);
  document.addEventListener('touchcancel', () => { endTouch(); suppressUntil = 0; });
  document.addEventListener('touchmove', endTouch, { passive: true });
  document.addEventListener('contextmenu', (e) => { if (target(e.target) && Date.now() - lastTouch < 2000) e.preventDefault(); });

  // 캡처 단계: 길게 눌러 말풍선을 띄운 뒤의 클릭은 게임 동작까지 가지 않게 막는다
  document.addEventListener('click', (e) => {
    if (clickSuppressed()) {
      suppressUntil = 0;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    hide();
  }, true);
})();
