/* 올인 던전 규칙 엔진 — 화면(game.js)과 node 테스트(test.js)가 함께 쓴다. 상태를 바꾸지 않는 함수만 둔다. */
(function (root) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const FACE = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rankLabel = (r) => FACE[r] || String(r);

  // 족보 순서 = 배열 순서. dmg 는 이겼을 때 기본 피해(판돈 배수 전)
  const HANDS = [
    { name: '하이카드', dmg: 2 },
    { name: '원페어', dmg: 4 },
    { name: '투페어', dmg: 6 },
    { name: '트리플', dmg: 8 },
    { name: '스트레이트', dmg: 11 },
    { name: '플러시', dmg: 12 },
    { name: '풀하우스', dmg: 15 },
    { name: '포카드', dmg: 22 },
    { name: '스트레이트 플러시', dmg: 30 },
    { name: '파이브카드', dmg: 40 },
  ];
  const ROYAL_BONUS = 10;
  const ANTE = 2; // 폴드 피해 단위

  const ENCHANTS = {
    fire: { name: '불꽃', seal: '불', desc: '홀카드로 써서 이기면 피해 +4' },
    steel: { name: '강철', seal: '철', desc: '홀카드로 써서 지면 받는 피해 −4' },
    gold: { name: '황금', seal: '금', desc: '홀카드로 쓰고 접지 않으면 칩 +5' },
    wild: { name: '만능', seal: '만', desc: '어떤 무늬로도 친다' },
    eye: { name: '투시', seal: '눈', desc: '홀카드로 정하면 상대 카드 1장이 보인다' },
    blood: { name: '흡혈', seal: '피', desc: '홀카드로 써서 이기면 체력 3 회복' },
  };
  const ENCHANT_IDS = Object.keys(ENCHANTS);

  const CHARMS = {
    coin: { name: '행운의 동전', desc: '매 핸드 손기술 +1' },
    sleeve: { name: '넓은 소매', desc: '손패를 6장 받는다' },
    ironchip: { name: '무쇠 칩', desc: '받는 피해 −2' },
    face: { name: '포커페이스', desc: '레이즈하면 상대가 더 잘 접는다' },
    tooth: { name: '금니', desc: '전투에서 이기면 칩 +15' },
    pact: { name: '피의 계약', desc: '최대 체력 −12, 주는 피해 +30%' },
    ring: { name: '큰손 반지', desc: '올인 배수가 ×4가 된다' },
    fry: { name: '잔챙이 사냥', desc: '하이카드·원페어로 이기면 피해 +6' },
    tattoo: { name: '꽃무늬 문신', desc: '플러시로 이기면 피해 +10' },
    ruler: { name: '곧은 자', desc: '스트레이트로 이기면 피해 +10' },
    mirror: { name: '거울 조각', desc: '핸드마다 상대 카드 1장이 처음부터 보인다' },
    bandage: { name: '붕대', desc: '전투가 끝나면 체력 6 회복' },
    bribe: { name: '딜러 매수', desc: '바꿔치기 비용이 손기술 1이 된다' },
    shoes: { name: '도망자 신발', desc: '폴드해도 피해를 받지 않는다' },
  };

  // tight: 레이즈에 접는 정도(0이면 절대 안 접음) · lie: 표정이 거짓일 확률 · poker: 표정 없음
  const ENEMIES = [
    { id: 'drunk', floor: 1, kind: 'normal', name: '취한 단골', glyph: '醉', hp: 22, mul: 1, tight: 1, lie: 0.1, desc: '표정이 그대로 드러난다.' },
    { id: 'bluffer', floor: 1, kind: 'normal', name: '허세꾼', glyph: '虛', hp: 24, mul: 1, tight: 0.7, lie: 0.5, desc: '표정 절반이 연기다.' },
    { id: 'coward', floor: 1, kind: 'normal', name: '겁 많은 회사원', glyph: '怯', hp: 20, mul: 1, tight: 1.5, lie: 0, desc: '판돈이 오르면 쉽게 접는다.' },
    { id: 'local', floor: 1, kind: 'normal', name: '동네 타짜', glyph: '手', hp: 26, mul: 1.2, tight: 0.9, lie: 0.25, desc: '손이 맵다.' },
    { id: 'drifter', floor: 1, kind: 'elite', name: '떠돌이 딜러', glyph: '流', hp: 44, mul: 1.3, tight: 0.8, lie: 0.3, armor: 1, desc: '테이블을 옮겨 다니며 판을 쓸어 간다.' },
    { id: 'bear', floor: 1, kind: 'boss', name: '문지기 곰', glyph: '熊', hp: 70, mul: 1.3, tight: 0.6, lie: 0.2, armor: 2, desc: '1층 계단을 지키는 덩치.' },

    { id: 'loanshark', floor: 2, kind: 'normal', name: '사채업자', glyph: '債', hp: 34, mul: 1.2, tight: 0.9, lie: 0.2, heal: 4, desc: '이길 때마다 체력을 받아 간다.' },
    { id: 'twins', floor: 2, kind: 'normal', name: '쌍둥이 딜러', glyph: '雙', hp: 28, mul: 0.9, tight: 1, lie: 0.2, hole: 3, desc: '홀카드 3장 중에서 고른다.' },
    { id: 'iron', floor: 2, kind: 'normal', name: '무쇠손', glyph: '鐵', hp: 34, mul: 1.2, tight: 0.8, lie: 0.2, armor: 2, desc: '웬만한 피해는 튕겨 낸다.' },
    { id: 'magician', floor: 2, kind: 'elite', name: '카드 마술사', glyph: '幻', hp: 48, mul: 1, tight: 0.8, lie: 0.6, hole: 3, desc: '표정도 카드도 믿을 수 없다.' },
    { id: 'croupier', floor: 2, kind: 'boss', name: '수석 크루피어', glyph: '冠', hp: 80, mul: 1.1, tight: 0.5, lie: 0.3, hole: 3, armor: 1, desc: '2층의 모든 판을 돌리는 사람.' },

    { id: 'gambler', floor: 3, kind: 'normal', name: '빚더미 노름꾼', glyph: '賭', hp: 42, mul: 1.4, tight: 0.5, lie: 0.3, desc: '잃을 게 없어서 잘 안 접는다.' },
    { id: 'ghost', floor: 3, kind: 'normal', name: '유령 손님', glyph: '鬼', hp: 40, mul: 1.4, tight: 0.9, poker: true, desc: '얼굴이 없다.' },
    { id: 'banker', floor: 3, kind: 'normal', name: '금고지기', glyph: '金', hp: 44, mul: 1.3, tight: 0.9, lie: 0.2, armor: 3, desc: '두꺼운 금고 같은 사람.' },
    { id: 'shark', floor: 3, kind: 'elite', name: '큰손', glyph: '鯊', hp: 58, mul: 1.2, tight: 0.6, lie: 0.3, hole: 3, armor: 1, desc: '판돈을 먹고 자란다.' },
    { id: 'house', floor: 3, kind: 'boss', name: '하우스의 주인', glyph: '主', hp: 110, mul: 1.3, tight: 0, poker: true, hole: 3, armor: 2, desc: '절대 접지 않는다. 표정도 없다.' },
  ];

  const NODES = {
    fight: { name: '테이블', desc: '평범한 상대와 한 판' },
    elite: { name: '하이롤러 룸', desc: '센 상대. 이기면 부적' },
    shop: { name: '암시장', desc: '카드·부적을 사고 카드를 버린다' },
    rest: { name: '흡연실', desc: '쉬거나 카드에 각인' },
    event: { name: '뒷골목', desc: '무슨 일이 생길지 모른다' },
    boss: { name: '층 주인', desc: '이기면 아래층으로' },
  };
  const STEPS = 6; // 층마다 보스 전 칸 수
  const FLOORS = 3;

  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  // 시작 덱: 2~J 각 2장, 무늬는 판마다 다르게
  function starterDeck(newId, rng = Math.random) {
    const deck = [];
    for (let r = 2; r <= 11; r++) {
      const [s1, s2] = shuffle([0, 1, 2, 3], rng);
      deck.push({ id: newId(), r, s: s1, en: null }, { id: newId(), r, s: s2, en: null });
    }
    return deck;
  }

  // 상대 홀카드와 보드는 중립 52장에서. tag 는 핸드마다 id 를 새로 만들기 위함
  function tableDeck(tag) {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ id: `t${tag}-${s}-${r}`, r, s, en: null });
    return d;
  }

  // 5장 판정. 만능 각인은 무늬만 자유. 내 덱과 테이블은 별개라 같은 카드가 겹칠 수 있다(파이브카드).
  function eval5(c) {
    const ranks = c.map((x) => x.r).sort((a, b) => b - a);
    const cnt = new Map();
    ranks.forEach((r) => cnt.set(r, (cnt.get(r) || 0) + 1));
    const groups = [...cnt].map(([r, n]) => [n, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const flush = new Set(c.filter((x) => x.en !== 'wild').map((x) => x.s)).size <= 1;
    let hi = 0;
    if (groups.length === 5) {
      if (ranks[0] - ranks[4] === 4) hi = ranks[0];
      else if (ranks[0] === 14 && ranks[1] === 5) hi = 5;
    }
    const top = groups[0][0];
    const second = groups[1] ? groups[1][0] : 0;
    let cat;
    if (top === 5) cat = 9;
    else if (hi && flush) cat = 8;
    else if (top === 4) cat = 7;
    else if (top === 3 && second === 2) cat = 6;
    else if (flush) cat = 5;
    else if (hi) cat = 4;
    else if (top === 3) cat = 3;
    else if (top === 2 && second === 2) cat = 2;
    else cat = top === 2 ? 1 : 0;
    const tb = cat === 8 || cat === 4 ? [hi] : cat === 5 ? ranks : groups.map((g) => g[1]);
    const score = [cat, ...tb, 0, 0, 0, 0, 0].slice(0, 6).reduce((acc, v) => acc * 15 + v, 0);
    return { cat, tb, score };
  }

  // 5장 이상에서 가장 센 5장 (최대 8장 → 56조합)
  function best(cards) {
    if (cards.length < 5) return null;
    let top = null;
    const n = cards.length;
    const rec = (start, chosen) => {
      if (chosen.length === 5) {
        const r = eval5(chosen);
        if (!top || r.score > top.score) top = { ...r, cards: chosen };
        return;
      }
      for (let i = start; i <= n - (5 - chosen.length); i++) rec(i + 1, [...chosen, cards[i]]);
    };
    rec(0, []);
    return top;
  }

  const isRoyal = (res) => res.cat === 8 && res.tb[0] === 14;

  function describe(res) {
    if (!res) return '';
    if (isRoyal(res)) return '로열 플러시';
    const L = res.tb.map(rankLabel);
    const detail = [`${L[0]} 하이`, L[0], `${L[0]}·${L[1]}`, L[0], `${L[0]} 하이`, `${L[0]} 하이`, `${L[0]}/${L[1]}`, L[0], `${L[0]} 하이`, L[0]][res.cat];
    return `${HANDS[res.cat].name} (${detail})`;
  }

  // 상대가 플롭에서 느끼는 자기 패의 힘 0~1
  const STRENGTH = [0.12, 0.42, 0.68, 0.8, 0.88, 0.9, 0.95, 0.99, 1, 1];
  function strength(hole, flop) {
    const all = [...hole, ...flop];
    const b = best(all);
    let v = STRENGTH[b.cat];
    if (b.cat === 0) v += (Math.max(...hole.map((c) => c.r)) / 14) * 0.18;
    if (b.cat === 1) v += (b.tb[0] / 14) * 0.18;
    const perSuit = [0, 0, 0, 0];
    all.forEach((c) => perSuit[c.s]++);
    if (b.cat < 5 && Math.max(...perSuit) === 4) v += 0.15; // 플러시 드로우
    return Math.min(1, v);
  }

  const TELLS = [
    { mood: '초조', text: '칩을 자꾸 만지작거린다' },
    { mood: '덤덤', text: '별 반응 없이 카드를 본다' },
    { mood: '여유', text: '입꼬리가 살짝 올라간다' },
  ];
  // 표정 단계 0 약함 · 1 보통 · 2 강함, -1 읽을 수 없음
  function tellOf(enemy, v, rng = Math.random) {
    if (enemy.poker) return -1;
    const real = v >= 0.68 ? 2 : v >= 0.42 ? 1 : 0;
    if (rng() < (enemy.lie || 0)) return pick([0, 1, 2].filter((t) => t !== real), rng);
    return real;
  }

  function enemyFolds(enemy, v, mult, foldBoost = 1, rng = Math.random) {
    if (mult <= 1 || !enemy.tight) return false;
    const need = (mult >= 3 ? 0.56 : 0.4) * enemy.tight * foldBoost;
    return v + (rng() - 0.5) * 0.2 < need;
  }

  const foldDamage = (mult) => ANTE * mult;

  // 쇼다운 결과. 피해 = (족보 피해 + 보너스) × 판돈 배수, 방어는 마지막에 뺀다.
  function resolveShowdown({ pres, eres, hole, mult, charms, enemy }) {
    const has = (k) => charms.includes(k);
    const count = (en) => hole.filter((c) => c.en === en).length;
    const out = { winner: 0, toEnemy: 0, toPlayer: 0, heal: 0, enemyHeal: 0 };
    if (pres.score > eres.score) {
      let base = HANDS[pres.cat].dmg + (isRoyal(pres) ? ROYAL_BONUS : 0) + 4 * count('fire');
      if (has('fry') && pres.cat <= 1) base += 6;
      if (has('tattoo') && (pres.cat === 5 || pres.cat === 8)) base += 10;
      if (has('ruler') && (pres.cat === 4 || pres.cat === 8)) base += 10;
      const raw = Math.round(base * mult * (has('pact') ? 1.3 : 1));
      out.winner = 1;
      out.toEnemy = Math.max(1, raw - (enemy.armor || 0));
      out.heal = 3 * count('blood');
    } else if (pres.score < eres.score) {
      const raw = Math.round(HANDS[eres.cat].dmg * mult * enemy.mul);
      const block = 4 * count('steel') + (has('ironchip') ? 2 : 0);
      out.winner = -1;
      out.toPlayer = Math.max(0, raw - block);
      out.enemyHeal = enemy.heal || 0;
    }
    return out;
  }

  function pickEnemy(floor, kind, rng = Math.random) {
    const e = pick(ENEMIES.filter((x) => x.floor === floor && x.kind === kind), rng);
    return { hole: 2, armor: 0, heal: 0, lie: 0, ...e };
  }

  // 보상·상점 카드: 6~A, 층이 깊을수록 각인 확률이 오른다
  function randomCard(floor, newId, rng = Math.random) {
    const r = 6 + Math.floor(rng() * 9);
    const en = rng() < 0.3 + floor * 0.1 ? pick(ENCHANT_IDS, rng) : null;
    return { id: newId(), r, s: Math.floor(rng() * 4), en };
  }

  const randomCharms = (n, owned, rng = Math.random) =>
    shuffle(Object.keys(CHARMS).filter((k) => !owned.includes(k)), rng).slice(0, n);

  function mapChoices(step, rng = Math.random) {
    if (step >= STEPS) return ['boss'];
    if (step === 0) return ['fight'];
    if (step === STEPS - 1) return ['rest', 'shop'];
    const pool = step < 2
      ? ['fight', 'fight', 'fight', 'event', 'shop', 'rest']
      : ['fight', 'fight', 'elite', 'elite', 'event', 'shop', 'rest'];
    const out = new Set();
    while (out.size < 3) out.add(pick(pool, rng));
    return [...out];
  }

  const api = {
    SUITS, rankLabel, HANDS, ROYAL_BONUS, ANTE, ENCHANTS, ENCHANT_IDS, CHARMS, ENEMIES, NODES, STEPS, FLOORS, TELLS,
    shuffle, pick, starterDeck, tableDeck, eval5, best, isRoyal, describe, strength, tellOf, enemyFolds,
    foldDamage, resolveShowdown, pickEnemy, randomCard, randomCharms, mapChoices,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AD = api;
})(this);
