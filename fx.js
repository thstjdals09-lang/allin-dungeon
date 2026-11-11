/* 올인 던전 — 연출(애니메이션·효과음). game.js 가 화면을 그린 뒤 FX.run(이벤트, 옵션)을 부른다.
   anime.js 는 비동기로 온다. 아직 안 왔거나 못 왔거나 '동작 줄이기' 설정이면 움직임은 건너뛰고,
   화면은 그린 그대로 완성된 상태다. */
(function () {
  'use strict';
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SOUND_KEY = 'allin-dungeon-sound';
  const FAST_KEY = 'allin-dungeon-fast';
  const EASE = 'outExpo';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let fast = false;
  try { fast = localStorage.getItem(FAST_KEY) === 'on'; } catch (e) { /* 저장소가 막힌 브라우저: 기본값(보통) */ }

  let A = null;
  // anime 가 늦게 도착해도 그 뒤 연출부터는 켜지게 매번 확인한다
  function on() {
    if (!A && window.anime && window.anime.animate) {
      A = window.anime;
      A.engine.speed = fast ? 2 : 1;
    }
    return !!A && !reduce;
  }

  // 화면을 다시 그릴 때마다 회차가 바뀐다. 예약해 둔 연출은 자기 회차가 아니면 건너뛴다.
  // '연출 빠르게'면 예약 시간도 anime 엔진 속도와 같이 절반이 된다.
  let gen = 0;
  function later(ms, fn) {
    const mine = gen;
    const go = () => { if (mine === gen) fn(); };
    if (ms > 0) setTimeout(go, fast ? ms / 2 : ms);
    else go();
  }
  function toggleFast() {
    fast = !fast;
    if (A) A.engine.speed = fast ? 2 : 1;
    try { localStorage.setItem(FAST_KEY, fast ? 'on' : 'off'); } catch (e) { /* 이번 방문 동안만 유지 */ }
  }

  /* ───────── 효과음: 파일 없이 WebAudio 로 합성 ───────── */
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* 저장소가 막힌 브라우저: 기본값(켬) */ }

  // 브라우저는 사용자 동작 안에서 만든 오디오만 허락한다 — 첫 터치·키 입력 때 만든다
  function unlock() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { /* 다음 터치 때 다시 시도 */ });
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  const audio = () => (ctx && ctx.state === 'running' ? ctx : null);

  function tone(freq, dur, { type = 'sine', gain = 0.1, at = 0, to } = {}) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, { gain = 0.2, at = 0, freq = 2000 } = {}) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  const SOUNDS = {
    card: () => noise(0.07, { gain: 0.35, freq: 3200 }),
    chip: () => { tone(2100, 0.05, { type: 'triangle', gain: 0.09 }); tone(2900, 0.05, { type: 'triangle', gain: 0.06, at: 0.045 }); },
    check: () => { tone(170, 0.05, { type: 'square', gain: 0.05 }); tone(170, 0.05, { type: 'square', gain: 0.05, at: 0.09 }); },
    fold: () => noise(0.2, { gain: 0.16, freq: 900 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.08, at: i * 0.07 })),
    lose: () => tone(240, 0.45, { type: 'sawtooth', gain: 0.045, to: 90 }),
    hit: () => { noise(0.12, { gain: 0.3, freq: 400 }); tone(90, 0.22, { gain: 0.18, to: 48 }); },
    big: () => { noise(0.35, { gain: 0.14, freq: 700 }); tone(130, 0.5, { type: 'sawtooth', gain: 0.05, to: 260 }); },
    coin: () => { tone(1320, 0.08, { type: 'square', gain: 0.035 }); tone(1760, 0.16, { type: 'square', gain: 0.035, at: 0.07 }); },
    bust: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, { type: 'triangle', gain: 0.07, at: i * 0.13 })),
  };
  function sound(name) {
    if (muted || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* 효과음은 곁들이 — 오디오가 막힌 기기에서도 게임은 그대로 돈다 */ }
  }
  function toggleSound() {
    muted = !muted;
    try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch (e) { /* 이번 방문 동안만 유지 */ }
    if (!muted) sound('chip');
  }

  /* ───────── 움직임 도구 ───────── */
  // 들어오는 연출은 끝나면 인라인 스타일을 지워 CSS 상태(선택 카드 들림 등)로 돌아가게 한다
  const clean = (els) => () => els.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; });

  // 선언·K.O. 같은 큰 연출 요소. 다음 렌더(run)가 시작되면 남은 것을 모두 치운다.
  let settleNow = null;
  const live = new Set();
  const clearLive = () => { live.forEach((el) => el.remove()); live.clear(); };

  // body 에 잠깐 붙였다가 연출이 끝나면 떼는 요소
  function overlay(cls, html, style = {}) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    Object.assign(el.style, style);
    document.body.appendChild(el);
    return el;
  }

  function float(anchor, text, cls) {
    if (!on() || !anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    const el = overlay(`float ${cls}`, '', { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, opacity: '0' });
    el.textContent = text;
    A.animate(el, {
      y: [0, -52],
      scale: [0.5, 1.15, 1],
      opacity: [{ from: 0, to: 1, duration: 100 }, { to: 0, delay: 650, duration: 350 }],
      duration: 1100,
      ease: EASE,
      onComplete: () => el.remove(),
    });
  }

  function shake(el, power = 6) {
    if (!on() || !el || !el.isConnected) return;
    A.animate(el, { x: [0, -power, power, -power / 2, power / 2, 0], duration: 420, ease: 'inOutSine', onComplete: clean([el]) });
  }

  function burst(anchor, n = 20) {
    if (!on() || !anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    const colors = ['#d1ab5c', '#a3263a', '#2f5f8f', '#f4ecdc', '#15100f'];
    const parts = Array.from({ length: n }, () =>
      overlay('spark', '', { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, opacity: '0' }));
    parts.forEach((p, i) => p.style.setProperty('--c', colors[i % colors.length]));
    A.animate(parts, {
      x: () => A.utils.random(-150, 150),
      y: () => A.utils.random(-170, 70),
      rotate: () => A.utils.random(-400, 400),
      scale: [0.4, 1],
      opacity: [{ from: 0, to: 1, duration: 60 }, { to: 0, delay: 520, duration: 420 }],
      duration: 1050,
      ease: EASE,
      onComplete: () => parts.forEach((p) => p.remove()),
    });
  }

  function flash(cls) {
    if (!on()) return;
    const el = overlay(`flash ${cls}`, '', { opacity: '0.55' });
    A.animate(el, { opacity: [0.55, 0], duration: 650, ease: 'outQuad', onComplete: () => el.remove() });
  }

  // 족보 컷인: 화면 가운데에 큰 글씨가 찍혔다 사라진다
  function cutin(text, tone = '') {
    sound('big');
    if (!on()) return;
    const el = overlay(`cutin ${tone}`, `<b>${text}</b>`, { opacity: '0' });
    A.createTimeline({ onComplete: () => el.remove() })
      .add(el, { opacity: [0, 1], duration: 120, ease: 'linear' }, 0)
      .add(el.firstChild, { scale: [2.6, 1], rotate: [-10, -4], duration: 420, ease: EASE }, 0)
      .add(el, { opacity: 0, duration: 260, ease: 'inQuad' }, 820);
  }


  /* ───────── 판 선언 / K.O. / BUSTED: 큰 영어 글자가 한 글자씩 떨어지고 한국어 한 줄이 따라온다 ───────── */
  const DECL = {
    win: { word: 'WIN', sound: 'win' }, lose: { word: 'LOSE', sound: 'lose' }, split: { word: 'SPLIT', sound: 'card' },
    fold: { word: 'FOLD', sound: 'fold' }, theyfold: { word: 'THEY FOLD', sound: 'win' },
  };
  const DECL_MS = 1100;
  const END_MS = 1400;
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // 글자 요소를 만들어 붙이고 돌려준다. 동작 줄이기·anime 없음이면 정지한 채 보이고 같은 시간 뒤 사라진다(CSS 만).
  function stage(cls, word, sub, ms, hand = '') {
    // 단어마다 줄바꿈 단위로 묶고, 가장 긴 단어 글자 수(--n)로 글자 크기를 정해 360px 에 들어가게 한다
    const words = word.split(' ');
    const letters = words.map((w) => `<span class="wd">${[...w].map((ch) => `<i class="l">${esc(ch)}</i>`).join('')}</span>`).join('');
    const el = overlay(`decl ${cls}`, `<b class="dw" aria-hidden="true" style="--n:${Math.max(...words.map((w) => w.length))}">${letters}</b>${hand ? `<span class="dh">${esc(hand)}</span>` : ''}${sub ? `<span class="ds">${esc(sub)}</span>` : ''}`);
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', [word, hand, sub].filter(Boolean).join(' · '));
    live.add(el);
    later(ms, () => { el.remove(); live.delete(el); });
    return el;
  }

  // 모션: 글자가 위에서 떨어져 도장처럼 찍히고, 끝에서 결과 줄 쪽(아래)으로 줄어들며 사라진다
  function playDecl(el, ms) {
    if (!on()) return;
    const ls = $$('.l', el);
    el.style.opacity = '0';
    A.createTimeline({ onComplete: () => { el.remove(); live.delete(el); } })
      .add(el, { opacity: [0, 1], duration: 120, ease: 'linear' }, 0)
      .add(ls, { y: [-90, 0], scale: [2.2, 1], opacity: [0, 1], duration: 380, delay: A.stagger(45), ease: 'outBack(1.4)' }, 0)
      .add($$('.dh, .ds', el), { opacity: [0, 1], y: [10, 0], duration: 260, delay: A.stagger(80), ease: EASE }, 300)
      .add(el, { opacity: 0, y: 70, scale: 0.55, duration: 300, ease: 'inQuad' }, ms - 300);
  }

  // 판 하나가 끝났을 때의 선언. 끝나는 시각을 돌려준다.
  function declare(kind, sub, at, hand = '') {
    later(at, () => {
      const d = DECL[kind];
      sound(hand ? 'big' : d.sound);
      const el = stage(`h-${kind}`, d.word, sub, DECL_MS, hand);
      playDecl(el, DECL_MS);
      if (kind === 'win' || kind === 'theyfold') burst($('.dw', el), 18);
      if (kind === 'lose') shake($('main'), 9);
    });
    return at + DECL_MS;
  }

  // 매치가 끝났을 때(이김 K.O. / 보스 / 최종 보스, 또는 스택 0 BUSTED). 판 선언 뒤에 이어 붙는다.
  function ending(ev, at) {
    if (!ev.kill && !ev.bust) return at;
    const last = ev.node === 'boss';
    const word = ev.bust ? 'BUSTED' : last ? (ev.floor >= AD.FLOORS ? 'HOUSE CONQUERED' : `FLOOR ${ev.floor} CLEAR`) : 'K.O.';
    later(at, () => {
      sound(ev.bust ? 'bust' : 'big');
      const el = stage(ev.bust ? 'busted' : 'ko', word, '', END_MS);
      if (!on()) return;
      const ls = $$('.l', el);
      el.style.opacity = '0';
      A.createTimeline({ onComplete: () => { el.remove(); live.delete(el); } })
        .add(el, { opacity: [0, 1], duration: 160, ease: 'linear' }, 0)
        .add(ls, { y: [-140, 0], scale: [3, 1], rotate: () => A.utils.random(-12, 12), opacity: [0, 1], duration: 420, delay: A.stagger(40), ease: 'outBack(1.2)' }, 0)
        .add(el, { opacity: 0, duration: 260, ease: 'inQuad' }, END_MS - 260);
      if (ev.bust) {
        A.animate($$('.hand .card'), { x: () => A.utils.random(-130, 130), y: () => A.utils.random(-90, 110), rotate: () => A.utils.random(-70, 70), opacity: 0.2, duration: 700, ease: 'outCubic' });
      } else {
        later(180, () => burst($('.dw', el), 30));
      }
    });
    return at + END_MS;
  }

  // 결과가 다 보일 때까지 다음 버튼을 숨긴다(visibility 라 키보드로도 못 누른다).
  // 중간에 다시 그려지면 새 화면은 숨김 없이 그려지므로 버튼이 막힌 채 남지 않는다.
  function holdActions(until) {
    const el = $('.battle .actions');
    if (!on() || !el) return;
    el.classList.add('wait');
    later(until, () => {
      el.classList.remove('wait');
      A.animate(el, { y: [14, 0], opacity: [0, 1], duration: 420, ease: EASE, onComplete: clean([el]) });
    });
  }

  function appear(el, at) {
    if (!on() || !el) return;
    el.style.opacity = '0';
    later(at, () => A.animate(el, { y: [12, 0], opacity: [0, 1], duration: 480, ease: EASE, onComplete: clean([el]) }));
  }

  /* ───────── 막대: 같은 화면에서 다시 그리면 직전 값에서 이어서 움직인다 ───────── */
  const bars = new Map();
  function animateBars(delay) {
    $$('.bar[data-key]').forEach((bar) => {
      const fill = bar.firstElementChild;
      const now = +bar.dataset.v;
      const before = bars.get(bar.dataset.key);
      bars.set(bar.dataset.key, now);
      if (!on() || before === undefined || Math.abs(before - now) < 0.001) return;
      fill.style.transform = `scaleX(${before})`;
      A.animate(fill, { scaleX: [before, now], duration: 750, delay, ease: EASE });
    });
  }

  /* ───────── 카드가 깔리는 연출 ───────── */
  function flipIn(cards, at) {
    if (!on() || !cards.length) return at;
    cards.forEach((c) => { c.style.opacity = '0'; });
    later(at, () => {
      sound('card');
      A.animate(cards, { rotateY: [90, 0], opacity: [1, 1], duration: 380, delay: A.stagger(120), ease: EASE, onComplete: clean(cards) });
    });
    return at + 380 + 120 * (cards.length - 1);
  }

  function deal(skipEnemy) {
    const fresh = $$('.card.deal').filter((c) => !(skipEnemy && c.closest('.ehole')));
    if (!fresh.length) return;
    sound('card');
    if (!on()) return;
    const flips = fresh.filter((c) => c.closest('.ehole'));
    const drops = fresh.filter((c) => !c.closest('.ehole') && !c.closest('.offer'));
    if (drops.length) {
      A.animate(drops, {
        y: [-46, 0], rotate: [-12, 0], scale: [0.85, 1], opacity: [0, 1],
        duration: 560, delay: A.stagger(65), ease: EASE, onComplete: clean(drops),
      });
    }
    flipIn(flips, 0);
  }

  /* ───────── 화면이 바뀔 때 ───────── */
  function enter(screen) {
    const main = $('main');
    if (!main) return;
    if (screen === 'over' || screen === 'win') sound(screen === 'win' ? 'win' : 'bust');
    if (!on()) return;
    const parts = [...main.children].filter((el) => !el.classList.contains('drifts'));
    A.animate(parts, { y: [22, 0], opacity: [0, 1], duration: 640, delay: A.stagger(70), ease: EASE, onComplete: clean(parts) });
    const nodes = $$('.node, .charmcard', main);
    if (nodes.length) A.animate(nodes, { y: [18, 0], opacity: [0, 1], duration: 560, delay: A.stagger(80, { start: 180 }), ease: EASE, onComplete: clean(nodes) });
    const offers = $$('.offer .card', main);
    if (offers.length) A.animate(offers, { rotateY: [90, 0], opacity: [0, 1], duration: 520, delay: A.stagger(110, { start: 200 }), ease: EASE, onComplete: clean(offers) });
    $$('.count[data-n]', main).forEach((el) => {
      const box = { v: 0 };
      A.animate(box, { v: +el.dataset.n, duration: 900, delay: 250, ease: 'outQuart', onUpdate: () => { el.textContent = Math.round(box.v); } });
      later(300, () => sound('coin'));
    });
    if (screen === 'map') mapIntro(main);
    if (screen === 'win') [200, 650, 1100].forEach((ms) => later(ms, () => burst($('.logo'), 26)));
    if (screen === 'over') later(200, () => shake($('.logo'), 10));
  }

  // 지도: 길이 위 줄부터 차례로 그려지고(SVG 선 그리기), 칸이 줄마다 톡 튀어나온다
  function mapIntro(main) {
    const paths = $$('.maplines path', main);
    if (paths.length && A.svg && A.svg.createDrawable) {
      A.animate(A.svg.createDrawable(paths), {
        draw: ['0 0', '0 1'], duration: 650, ease: 'inOutQuad',
        delay: (el) => 120 + (+el.getAttribute('data-row') || 0) * 80,
        // createDrawable 이 남기는 pathLength 를 지워야 CSS 점선 간격이 원래 길이 단위로 돌아온다
        onComplete: () => paths.forEach((p) => { p.removeAttribute('pathLength'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }),
      });
    }
    const nodes = $$('.mnode', main);
    if (nodes.length) {
      A.animate(nodes, {
        // 끝 밝기는 CSS 값(지나간 칸은 흐리게)으로 — 연출이 끝날 때 번쩍이지 않게
        scale: [0.3, 1], opacity: { from: 0 }, duration: 420, ease: 'outBack(1.7)',
        delay: (el) => 80 + (+el.style.getPropertyValue('--row') || 0) * 80,
        onComplete: clean(nodes),
      });
    }
    const token = $('.token', main);
    if (token) A.animate(token, { y: [-30, 0], opacity: [0, 1], duration: 520, delay: 650, ease: 'outBounce', onComplete: clean([token]) });
  }

  /* ───────── 이벤트별 연출. 각 함수는 연출이 끝나는 시각(ms)을 돌려준다 ───────── */
  let barDelay = 0;
  const HANDLERS = {
    lock(ev, at) { sound('card'); return at; },
    check(ev, at) {
      sound('check');
      const pot = $('.potline');
      if (on() && pot) A.animate(pot, { scale: [1.15, 1], duration: 380, ease: EASE, onComplete: clean([pot]) });
      return at;
    },
    chip(ev, at, opt) {
      sound('chip');
      const pot = $('.potline b');
      if (!on() || !opt.from || !pot) return at;
      const to = pot.getBoundingClientRect();
      const fx = opt.from.left + opt.from.width / 2;
      const fy = opt.from.top + opt.from.height / 2;
      const chip = overlay(`flychip${ev.allin ? ' allin' : ''}`, '', { left: `${fx}px`, top: `${fy}px` });
      A.animate(chip, {
        x: [0, to.left + to.width / 2 - fx],
        y: [0, to.top + to.height / 2 - fy],
        rotate: [0, 540], scale: [1, 0.55],
        duration: 460, ease: 'inOutCubic',
        onComplete: () => {
          chip.remove();
          sound('chip');
          if (pot.isConnected) A.animate(pot, { scale: [1.5, 1], duration: 420, ease: EASE, onComplete: clean([pot]) });
        },
      });
      return at + 420;
    },
    // 상대 벳·레이즈: 상대 메달에서 팟으로 칩이 날아간다
    ebet(ev, at, opt) {
      const medal = $('.enemy .medal');
      return HANDLERS.chip(ev, at, { ...opt, from: medal ? medal.getBoundingClientRect() : null });
    },
    cutin(ev, at) { later(at, () => cutin(ev.text, 'gold')); return at + 760; },
    show(ev, at) {
      let t = flipIn($$('.ehole .card.deal'), at) + 80;
      const used = $$('.board .card.used, .hand .card.used, .ehole .card.used');
      later(t, () => {
        if (on() && used.length) A.animate(used, { scale: [1, 1.1, 1], duration: 480, delay: A.stagger(35), ease: 'inOutSine', onComplete: clean(used) });
      });
      const verdict = ev.winner > 0 ? `상대 −${ev.toEnemy}` : ev.winner < 0 ? `스택 −${ev.toPlayer}` : '';
      const sub = [`${ev.pdesc} vs ${ev.edesc}`, verdict].filter(Boolean).join(' · ');
      const hand = ev.winner > 0 && ev.cat >= 4 ? ev.name : '';
      t = declare(ev.winner > 0 ? 'win' : ev.winner < 0 ? 'lose' : 'split', sub, t + 150, hand);
      return finishHand(ev, t, ev);
    },
    efold(ev, at) {
      const t = flipIn($$('.ehole .card.deal'), at);
      const end = declare('theyfold', `상대가 폴드 · 상대 −${ev.d}`, t + 100);
      return finishHand(ev, end, { toEnemy: ev.d, kill: ev.kill });
    },
    pfold(ev, at) {
      const mine = $$('.hand .card.sel');
      if (on() && mine.length) A.animate(mine, { y: [0, 36], rotate: [0, 8], opacity: [1, 0.25], duration: 420, ease: 'inQuad' });
      const end = declare('fold', `폴드 · 스택 −${ev.d}`, at + 100);
      return finishHand(ev, end, { toPlayer: ev.d, bust: ev.bust });
    },
    coin(ev, at) { sound('coin'); return at; },
  };

  // 선언이 줄어드는 동안 결과 줄이 나타나고, 끝나면 데미지 → (K.O./BUSTED) → 버튼 순서
  function finishHand(ev, t, hit) {
    const result = $('.result');
    const finale = ev.kill || ev.bust;
    const hitAt = finale ? t - 300 : t; // K.O./BUSTED 는 선언이 흐려지는 동안 바로 이어진다
    let hitDone = false;
    const doHit = () => { if (!hitDone) { hitDone = true; hitOutcome(hit); } };
    appear(result, t - 250);
    later(hitAt, doHit);
    barDelay = hitAt;
    const done = (finale ? ending(ev, hitAt) + 100 : t + 450);
    holdActions(done);
    // 탭하면 남은 연출을 건너뛰고 결과 줄과 버튼을 바로 보인다
    settleNow = () => {
      if (result) result.style.opacity = '';
      doHit();
      const act = $('.battle .actions');
      if (act) act.classList.remove('wait');
    };
    return done;
  }

  function hitOutcome(ev) {
    if (ev.toEnemy) {
      sound('hit');
      float($('.enemy .hpline'), `−${ev.toEnemy}`, 'bad');
      shake($('.enemy .medal'), 7);
    }
    if (ev.toPlayer) {
      sound('hit');
      float($('.top .stack'), `−${ev.toPlayer}`, 'bad');
      shake($('main'), ev.toPlayer >= 15 ? 8 : 4); // #app 을 흔들면 그 안의 고정 위치 모달이 같이 튄다
      if (ev.toPlayer >= 15) flash('red');
    }
    if (ev.heal) float($('.top .stack'), `+${ev.heal}`, 'good');
    if (ev.enemyHeal) float($('.enemy .hpline'), `+${ev.enemyHeal}`, 'good');
    if (ev.kill) later(250, () => { burst($('.enemy .medal'), 24); sound('coin'); });
    if (ev.bust) later(250, () => flash('red'));
  }

  function run(events, opt) {
    gen++;
    settleNow = null;
    clearLive();
    barDelay = 0;
    if (opt.changed) bars.clear(); // 다른 화면·다른 상대의 막대 값에서 이어지지 않게
    const busy = events.some((e) => e.t === 'show' || e.t === 'efold');
    if (opt.changed) enter(opt.screen);
    deal(busy);
    let at = 0;
    events.forEach((ev) => { if (HANDLERS[ev.t]) at = HANDLERS[ev.t](ev, at, opt); });
    animateBars(barDelay);
  }

  // 선언·K.O. 가 떠 있는 동안 탭·키 입력은 연출 건너뛰기로만 쓰이고, 아래 버튼은 누르지 않는다
  let blockUntil = 0;
  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, (e) => {
    if (!live.size) return;
    swallow(e);
    blockUntil = Date.now() + 450;
    gen++; // 예약된 나머지 연출(K.O. 등)은 취소
    clearLive();
    const fn = settleNow;
    settleNow = null;
    if (fn) fn();
  }, true));
  ['pointerup', 'mouseup', 'click', 'keyup'].forEach((type) => document.addEventListener(type, (e) => {
    if (Date.now() < blockUntil) swallow(e);
  }, true));

  window.FX = {
    run,
    sound,
    toggleSound,
    toggleFast,
    get muted() { return muted; },
    get fast() { return fast; },
    get moving() { return on(); },
  };
})();
