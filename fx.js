/* 올인 던전 — 연출(애니메이션·효과음). game.js 가 화면을 그린 뒤 FX.run(이벤트, 옵션)을 부른다.
   anime.js 를 못 불러왔거나 '동작 줄이기' 설정이면 움직임은 건너뛰고, 화면은 그린 그대로 완성된 상태다. */
(function () {
  'use strict';
  const A = window.anime;
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const moving = !!(A && A.animate) && !reduce;
  const SOUND_KEY = 'allin-dungeon-sound';
  const EASE = 'outExpo';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const later = (ms, fn) => (ms > 0 ? setTimeout(fn, ms) : fn());

  /* ───────── 효과음: 파일 없이 WebAudio 로 합성 ───────── */
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* 저장소가 막힌 브라우저: 기본값(켬) */ }

  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
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

  function float(anchor, text, cls) {
    if (!moving || !anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(el);
    A.animate(el, {
      y: [0, -52],
      scale: [0.5, 1.15, 1],
      opacity: [{ to: 1, duration: 100 }, { to: 0, delay: 650, duration: 350 }],
      duration: 1100,
      ease: EASE,
      onComplete: () => el.remove(),
    });
  }

  function shake(el, power = 6) {
    if (!moving || !el || !el.isConnected) return;
    A.animate(el, { x: [0, -power, power, -power / 2, power / 2, 0], duration: 420, ease: 'inOutSine', onComplete: clean([el]) });
  }

  function burst(anchor, n = 20) {
    if (!moving || !anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    const colors = ['#d1ab5c', '#a3263a', '#2f5f8f', '#f4ecdc', '#15100f'];
    const parts = Array.from({ length: n }, (_, i) => {
      const el = document.createElement('i');
      el.className = 'spark';
      el.style.left = `${r.left + r.width / 2}px`;
      el.style.top = `${r.top + r.height / 2}px`;
      el.style.setProperty('--c', colors[i % colors.length]);
      document.body.appendChild(el);
      return el;
    });
    A.animate(parts, {
      x: () => A.utils.random(-150, 150),
      y: () => A.utils.random(-170, 70),
      rotate: () => A.utils.random(-400, 400),
      scale: [0.4, 1],
      opacity: [{ to: 1, duration: 60 }, { to: 0, delay: 520, duration: 420 }],
      duration: 1050,
      ease: EASE,
      onComplete: () => parts.forEach((p) => p.remove()),
    });
  }

  function flash(cls) {
    if (!moving) return;
    const el = document.createElement('div');
    el.className = `flash ${cls}`;
    document.body.appendChild(el);
    A.animate(el, { opacity: [0.55, 0], duration: 650, ease: 'outQuad', onComplete: () => el.remove() });
  }

  // 족보 컷인: 화면 가운데에 큰 글씨가 찍혔다 사라진다
  function cutin(text, tone = '') {
    sound('big');
    if (!moving) return;
    const el = document.createElement('div');
    el.className = `cutin ${tone}`;
    el.innerHTML = `<b>${text}</b>`;
    document.body.appendChild(el);
    A.createTimeline({ onComplete: () => el.remove() })
      .add(el, { opacity: [0, 1], duration: 120, ease: 'linear' }, 0)
      .add(el.firstChild, { scale: [2.6, 1], rotate: [-10, -4], duration: 420, ease: EASE }, 0)
      .add(el, { opacity: 0, duration: 260, ease: 'inQuad' }, 820);
  }

  // 결과가 다 보일 때까지 다음 버튼을 숨겨 둔다 (연출을 건너뛰고 누르지 않게)
  function holdActions(until) {
    const el = $('.battle .actions');
    if (!moving || !el) return;
    el.classList.add('wait');
    later(until, () => {
      el.classList.remove('wait');
      A.animate(el, { y: [14, 0], opacity: [0, 1], duration: 420, ease: EASE, onComplete: clean([el]) });
    });
  }

  function appear(el, at) {
    if (!moving || !el) return;
    el.style.opacity = '0';
    later(at, () => A.animate(el, { y: [12, 0], opacity: [0, 1], duration: 480, ease: EASE, onComplete: clean([el]) }));
  }

  /* ───────── 막대: 다시 그려도 직전 값에서 이어서 줄어들거나 늘어난다 ───────── */
  const bars = new Map();
  function animateBars(delay) {
    $$('.bar[data-key]').forEach((bar) => {
      const fill = bar.firstElementChild;
      const now = +bar.dataset.v;
      const before = bars.get(bar.dataset.key);
      bars.set(bar.dataset.key, now);
      if (!moving || before === undefined || Math.abs(before - now) < 0.001) return;
      fill.style.transform = `scaleX(${before})`;
      A.animate(fill, { scaleX: [before, now], duration: 750, delay, ease: EASE });
    });
  }

  /* ───────── 카드가 깔리는 연출 ───────── */
  function flipIn(cards, at) {
    if (!moving || !cards.length) return at;
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
    if (!moving) return;
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
    if (!moving) return;
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
    if (screen === 'win') [200, 650, 1100].forEach((ms) => later(ms, () => burst($('.logo'), 26)));
    if (screen === 'over') later(200, () => shake($('.logo'), 10));
  }

  /* ───────── 이벤트별 연출. 각 함수는 연출이 끝나는 시각(ms)을 돌려준다 ───────── */
  let barDelay = 0;
  const HANDLERS = {
    lock(ev, at) { sound('card'); return at; },
    check(ev, at) {
      sound('check');
      const pot = $('.potline');
      if (moving && pot) A.animate(pot, { scale: [1.15, 1], duration: 380, ease: EASE, onComplete: clean([pot]) });
      return at;
    },
    chip(ev, at, opt) {
      sound('chip');
      const pot = $('.potline b');
      if (!moving || !opt.from || !pot) return at;
      const to = pot.getBoundingClientRect();
      const fx = opt.from.left + opt.from.width / 2;
      const fy = opt.from.top + opt.from.height / 2;
      const chip = document.createElement('i');
      chip.className = `flychip${ev.allin ? ' allin' : ''}`;
      chip.style.left = `${fx}px`;
      chip.style.top = `${fy}px`;
      document.body.appendChild(chip);
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
    cutin(ev, at) { later(at, () => cutin(ev.text, 'gold')); return at + 760; },
    show(ev, at) {
      let t = flipIn($$('.ehole .card.deal'), at) + 80;
      const used = $$('.board .card.used, .hand .card.used, .ehole .card.used');
      later(t, () => {
        sound(ev.winner > 0 ? 'win' : ev.winner < 0 ? 'lose' : 'card');
        if (moving && used.length) A.animate(used, { scale: [1, 1.1, 1], duration: 480, delay: A.stagger(35), ease: 'inOutSine', onComplete: clean(used) });
      });
      if (ev.winner > 0 && ev.cat >= 4) { later(t + 250, () => cutin(ev.name)); t += 900; }
      appear($('.result'), t);
      t += 200;
      later(t, () => hitOutcome(ev));
      barDelay = t;
      holdActions(t + 450);
      return t + 450;
    },
    efold(ev, at) {
      const t = flipIn($$('.ehole .card.deal'), at);
      later(at, () => {
        sound('fold');
        const panel = $('.enemy');
        if (!moving || !panel) return;
        const stamp = document.createElement('div');
        stamp.className = 'stamp';
        stamp.textContent = '폴드';
        panel.appendChild(stamp);
        A.animate(stamp, { scale: [2.4, 1], opacity: [0, 1], rotate: [-18, -8], duration: 420, ease: EASE });
      });
      appear($('.result'), t);
      later(t, () => hitOutcome({ toEnemy: ev.d, kill: ev.kill }));
      barDelay = t;
      holdActions(t + 400);
      return t + 400;
    },
    pfold(ev, at) {
      sound('fold');
      const mine = $$('.hand .card.sel');
      if (moving && mine.length) A.animate(mine, { y: [0, 36], rotate: [0, 8], opacity: [1, 0.25], duration: 420, ease: 'inQuad' });
      appear($('.result'), at + 250);
      later(at + 250, () => hitOutcome({ toPlayer: ev.d, bust: ev.bust }));
      barDelay = at + 250;
      holdActions(at + 600);
      return at + 600;
    },
    coin(ev, at) { sound('coin'); return at; },
  };

  function hitOutcome(ev) {
    if (ev.toEnemy) {
      sound('hit');
      float($('.enemy .hpline'), `−${ev.toEnemy}`, 'bad');
      shake($('.enemy .medal'), 7);
    }
    if (ev.toPlayer) {
      sound('hit');
      float($('.top .stack'), `−${ev.toPlayer}`, 'bad');
      shake($('#app'), ev.toPlayer >= 15 ? 8 : 4);
      if (ev.toPlayer >= 15) flash('red');
    }
    if (ev.heal) float($('.top .stack'), `+${ev.heal}`, 'good');
    if (ev.enemyHeal) float($('.enemy .hpline'), `+${ev.enemyHeal}`, 'good');
    if (ev.kill) later(250, () => { burst($('.enemy .medal'), 24); sound('coin'); });
    if (ev.bust) later(250, () => { sound('bust'); flash('red'); });
  }

  function run(events, opt) {
    barDelay = 0;
    const busy = events.some((e) => e.t === 'show' || e.t === 'efold');
    if (opt.changed) enter(opt.screen);
    deal(busy);
    let at = 0;
    events.forEach((ev) => { if (HANDLERS[ev.t]) at = HANDLERS[ev.t](ev, at, opt); });
    animateBars(barDelay);
  }

  window.FX = {
    run,
    sound,
    toggleSound,
    get muted() { return muted; },
  };
})();
