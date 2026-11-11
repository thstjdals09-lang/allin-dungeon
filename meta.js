/* 올인 던전 — 시작 캐릭터·난이도·오늘의 도전 정의와 "새 도전" 시트. 규칙 값은 순수 함수라 test.js 도 쓴다. */
(function (root) {
  'use strict';
  const MAX_LEVEL = 5;
  // need = 하우스 정복 횟수(P.wins)
  const CHARACTERS = [
    { id: 'wanderer', name: '떠돌이', need: 0, stack: 80, desc: '스택 80 · 기본 덱' },
    { id: 'ace', name: '타짜', need: 1, stack: 70, desc: '스택 70 · 판마다 체인지 +1' },
    { id: 'reader', name: '관상가', need: 2, stack: 75, desc: '스택 75 · 상대 텔이 거짓말하지 않는다' },
    { id: 'whale', name: '큰손', need: 3, stack: 65, gold: 150, charm: 'ring', desc: '스택 65 · 시작 상금 150 · 큰손 반지' },
  ];
  const LEVELS = [
    '기본', '상대 스택 +10%', '상점 가격 +20%', '시작 스택 −10', '상대 족보 값 ×1.1', '보스 스택 +25%',
  ];
  const charOf = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  const unlocked = (c, P) => P.wins >= c.need;
  const startStack = (charId, level) => charOf(charId).stack - (level >= 3 ? 10 : 0);
  const price = (base, level) => (level >= 2 ? Math.round(base * 1.2) : base);
  const round2 = (x) => Math.round(x * 100) / 100;

  // 만든 상대에 난이도를 얹는다(레벨 효과는 누적)
  function scaleEnemy(e, level) {
    let hp = level >= 1 ? Math.round(e.hp * 1.1) : e.hp;
    if (level >= 5 && e.kind === 'boss') hp = Math.round(hp * 1.25);
    return { ...e, hp, mul: level >= 4 ? round2(e.mul * 1.1) : e.mul };
  }

  const todayKey = (d = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // 날짜별 최고 결과: 정복이 우선, 같으면 더 깊은 층
  const betterDaily = (a, b) => (!a ? b : b.won !== a.won ? (b.won ? b : a) : b.floor > a.floor ? b : a);
  const dailyText = (r, live) => (r ? `${r.floor}층 · ${r.won ? '정복' : live ? '진행 중' : '탈락'}` : '');
  const nextMaxLevel = (maxLevel, level) => Math.max(maxLevel, Math.min(MAX_LEVEL, level + 1));

  // "새 도전" 시트. m = {char, level, daily}, saved = 이어 할 저장(있으면 덮어쓰기 경고)
  function newRunSheet(m, P, saved) {
    const { btn } = root.V;
    const warn = saved ? `<p class="note warn" role="alert">진행 중인 도전(${saved.floor}층)이 사라집니다.</p>` : '';
    if (m.daily) {
      return `<h2 class="h">오늘의 도전</h2><p class="note">떠돌이 · 난이도 0 · 오늘 날짜로 지도와 카드가 정해집니다.</p>${warn}
        <div class="row">${btn('시작', 'startDaily', undefined, saved ? 'danger wide' : 'primary wide')}</div>`;
    }
    const chars = CHARACTERS.map((c) => {
      const open = unlocked(c, P);
      return `<button class="charmcard${m.char === c.id ? ' chosen' : ''}" data-act="pickChar" data-arg="${c.id}"${open ? '' : ' disabled'} aria-pressed="${m.char === c.id}">
        <b>${c.name}</b><span>${open ? c.desc : `정복 ${c.need}번이면 열림`}</span></button>`;
    }).join('');
    const lvls = LEVELS.map((t, k) =>
      btn(String(k), 'pickLevel', k, `sm${m.level === k ? ' primary' : ' ghost'}`, k > P.maxLevel)).join('');
    return `<h2 class="h">새 도전</h2>
      <h3 class="sub">캐릭터</h3><div class="charmrow">${chars}</div>
      <h3 class="sub">난이도 ${m.level}${m.level ? ` · ${LEVELS.slice(1, m.level + 1).join(', ')}` : ''}</h3>
      <div class="row">${lvls}</div>
      <p class="note">난이도는 앞 단계를 정복하면 열립니다. 효과는 쌓입니다.</p>${warn}
      <div class="row">${btn('시작', 'startNew', undefined, `${saved ? 'danger' : 'primary'} wide`, !m.char)}</div>`;
  }

  const api = {
    MAX_LEVEL, CHARACTERS, LEVELS, charOf, unlocked, startStack, price, scaleEnemy, todayKey, betterDaily, dailyText, nextMaxLevel, newRunSheet,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.META = api;
})(this);
