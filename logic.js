/* 올인 던전 규칙 엔진 — 화면(game.js)과 node 테스트(test.js)가 함께 쓴다. 상태를 바꾸지 않는 함수만 둔다. */
(function (root) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const FACE = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rankLabel = (r) => FACE[r] || String(r);

  // 족보 순서 = 배열 순서. value 는 쇼다운에서 진 쪽이 잃는 칩(팟 배수 전)
  const HANDS = [
    { name: '하이카드', value: 2 },
    { name: '원페어', value: 4 },
    { name: '투페어', value: 6 },
    { name: '트리플', value: 8 },
    { name: '스트레이트', value: 11 },
    { name: '플러시', value: 12 },
    { name: '풀하우스', value: 15 },
    { name: '포카드', value: 22 },
    { name: '스트레이트 플러시', value: 30 },
    { name: '파이브카드', value: 40 },
  ];
  const ROYAL_BONUS = 10;
  const ANTE = 2; // 폴드하면 잃는 칩 = ANTE × 팟
  const ALLIN_ADD = 3; // 올인하면 팟 +3 (벳은 +1)

  const ENCHANTS = {
    fire: { name: '불꽃', seal: '불', desc: '핸드로 쓰고 이기면 족보 값 +4' },
    steel: { name: '강철', seal: '철', desc: '핸드로 쓰고 지면 잃는 칩 −4' },
    gold: { name: '황금', seal: '금', desc: '핸드로 쓰고 폴드하지 않으면 상금 +5' },
    wild: { name: '와일드', seal: '와', desc: '어떤 무늬로도 친다' },
    eye: { name: '투시', seal: '눈', desc: '핸드로 정하면 상대 핸드 1장이 보인다' },
    blood: { name: '흡혈', seal: '피', desc: '핸드로 쓰고 이기면 스택 +3' },
  };
  const ENCHANT_IDS = Object.keys(ENCHANTS);

  const CHARMS = {
    coin: { name: '행운의 동전', desc: '판마다 체인지 +1' },
    sleeve: { name: '넓은 소매', desc: '손패를 6장 받는다' },
    ironchip: { name: '무쇠 칩', desc: '질 때 잃는 칩 −2' },
    face: { name: '포커페이스', desc: '벳·올인에 상대가 더 자주 폴드한다' },
    tooth: { name: '금니', desc: '매치에서 이기면 상금 +15' },
    pact: { name: '피의 계약', desc: '최대 스택 −12, 상대가 잃는 칩 +30%' },
    ring: { name: '큰손 반지', desc: '올인하면 팟 +4 (보통 +3)' },
    fry: { name: '잔챙이 사냥', desc: '하이카드·원페어로 이기면 족보 값 +6' },
    tattoo: { name: '꽃무늬 문신', desc: '플러시로 이기면 족보 값 +10' },
    ruler: { name: '곧은 자', desc: '스트레이트로 이기면 족보 값 +10' },
    mirror: { name: '거울 조각', desc: '판마다 상대 핸드 1장이 처음부터 보인다' },
    bandage: { name: '붕대', desc: '매치가 끝나면 스택 +6' },
    bribe: { name: '딜러 매수', desc: '보드 체인지가 체인지 1로 된다 (보통 2)' },
    shoes: { name: '도망자 신발', desc: '폴드해도 칩을 잃지 않는다' },
  };

  // mul: 상대가 이길 때 족보 값 배수 · tight: 벳에 폴드하는 정도(0이면 폴드 안 함)
  // bluff: 약해도 벳하는 확률(기본 0.1)
  // lie: 텔이 거짓일 확률 · poker: 텔이 없음 · armor: 내가 이길 때 덜 잃는 칩
  const ENEMIES = [
    { id: 'drunk', floor: 1, kind: 'normal', name: '취한 단골', glyph: '취', hp: 22, mul: 1, tight: 1, lie: 0.1, desc: '텔이 그대로 드러난다.' },
    { id: 'bluffer', floor: 1, kind: 'normal', name: '허세꾼', glyph: '허', hp: 24, mul: 1, tight: 0.7, lie: 0.5, bluff: 0.35, desc: '텔 절반이 연기다.' },
    { id: 'coward', floor: 1, kind: 'normal', name: '겁 많은 회사원', glyph: '겁', hp: 20, mul: 1, tight: 1.5, lie: 0, desc: '벳이 들어오면 쉽게 폴드한다.' },
    { id: 'local', floor: 1, kind: 'normal', name: '동네 타짜', glyph: '타', hp: 26, mul: 1.2, tight: 0.9, lie: 0.25, desc: '이길 때 크게 가져간다.' },
    { id: 'drifter', floor: 1, kind: 'elite', name: '떠돌이 딜러', glyph: '떠', hp: 44, mul: 1.3, tight: 0.8, lie: 0.3, armor: 1, desc: '테이블을 옮겨 다니며 팟을 쓸어 간다.' },
    { id: 'bear', floor: 1, kind: 'boss', name: '문지기 곰', glyph: '곰', hp: 70, mul: 1.3, tight: 0.6, lie: 0.2, armor: 2, bluff: 0.15, desc: '1층 계단을 지키는 덩치.' },

    { id: 'loanshark', floor: 2, kind: 'normal', name: '사채업자', glyph: '채', hp: 34, mul: 1.2, tight: 0.9, lie: 0.2, heal: 4, desc: '이길 때마다 스택을 채운다.' },
    { id: 'twins', floor: 2, kind: 'normal', name: '쌍둥이 딜러', glyph: '쌍', hp: 28, mul: 0.9, tight: 1, lie: 0.2, hole: 3, desc: '카드 3장을 받아 그중에서 핸드를 고른다.' },
    { id: 'iron', floor: 2, kind: 'normal', name: '무쇠손', glyph: '쇠', hp: 34, mul: 1.2, tight: 0.8, lie: 0.2, armor: 2, desc: '져도 칩을 덜 잃는다.' },
    { id: 'magician', floor: 2, kind: 'elite', name: '카드 마술사', glyph: '마', hp: 48, mul: 1, tight: 0.8, lie: 0.6, hole: 3, bluff: 0.3, desc: '텔도 카드도 믿을 수 없다.' },
    { id: 'croupier', floor: 2, kind: 'boss', name: '수석 크루피어', glyph: '딜', hp: 80, mul: 1.1, tight: 0.5, lie: 0.3, hole: 3, armor: 1, bluff: 0.15, desc: '2층의 모든 테이블을 돌리는 사람.' },

    { id: 'gambler', floor: 3, kind: 'normal', name: '빚더미 노름꾼', glyph: '빚', hp: 42, mul: 1.4, tight: 0.5, lie: 0.3, bluff: 0.25, desc: '잃을 게 없어서 폴드를 잘 안 한다.' },
    { id: 'ghost', floor: 3, kind: 'normal', name: '유령 손님', glyph: '령', hp: 40, mul: 1.4, tight: 0.9, poker: true, desc: '얼굴이 없어 텔도 없다.' },
    { id: 'banker', floor: 3, kind: 'normal', name: '금고지기', glyph: '금', hp: 44, mul: 1.3, tight: 0.9, lie: 0.2, armor: 3, desc: '져도 칩을 많이 덜 잃는다.' },
    { id: 'shark', floor: 3, kind: 'elite', name: '큰손', glyph: '큰', hp: 58, mul: 1.2, tight: 0.6, lie: 0.3, hole: 3, armor: 1, desc: '큰 팟을 좋아한다.' },
    { id: 'house', floor: 3, kind: 'boss', name: '하우스의 주인', glyph: '주', hp: 110, mul: 1.3, tight: 0, poker: true, hole: 3, armor: 2, bluff: 0.15, desc: '폴드하지 않는다. 텔도 없다.' },
  ];

  const NODES = {
    fight: { name: '테이블', desc: '일반 상대와 헤즈업' },
    elite: { name: '하이롤러', desc: '센 상대. 이기면 유물' },
    shop: { name: '상점', desc: '카드·유물 구매, 카드 제거' },
    rest: { name: '휴게실', desc: '스택 회복 또는 카드 강화' },
    event: { name: '이벤트', desc: '무슨 일이 생길지 모른다' },
    boss: { name: '보스', desc: '이기면 다음 층으로' },
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

  // 상대 핸드와 보드는 중립 52장에서. tag 는 판마다 id 를 새로 만들기 위함
  function tableDeck(tag) {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ id: `t${tag}-${s}-${r}`, r, s, en: null });
    return d;
  }

  // 5장 판정. 와일드는 무늬만 자유. 내 덱과 보드는 별개라 같은 카드가 겹칠 수 있다(파이브카드).
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

  // 상대가 지금 보드에서 느끼는 자기 패의 힘 0~1
  const STRENGTH = [0.12, 0.42, 0.68, 0.8, 0.88, 0.9, 0.95, 0.99, 1, 1];
  function strength(hole, board) {
    const all = [...hole, ...board];
    const b = best(all);
    let v = STRENGTH[b.cat];
    if (b.cat === 0) v += (Math.max(...hole.map((c) => c.r)) / 14) * 0.18;
    if (b.cat === 1) v += (b.tb[0] / 14) * 0.18;
    const perSuit = [0, 0, 0, 0];
    all.forEach((c) => perSuit[c.s]++);
    if (board.length < 5 && b.cat < 5 && Math.max(...perSuit) === 4) v += 0.15; // 플러시 드로우는 리버 전까지만
    return Math.min(1, v);
  }

  const TELLS = [
    { mood: '초조', text: '칩을 자꾸 만지작거린다' },
    { mood: '덤덤', text: '별 반응 없이 보드를 본다' },
    { mood: '여유', text: '입꼬리가 살짝 올라간다' },
  ];
  // 텔 단계 0 약함 · 1 보통 · 2 강함, -1 텔 없음
  function tellOf(enemy, v, rng = Math.random) {
    if (enemy.poker) return -1;
    const real = v >= 0.68 ? 2 : v >= 0.42 ? 1 : 0;
    if (rng() < (enemy.lie || 0)) return pick([0, 1, 2].filter((t) => t !== real), rng);
    return real;
  }

  // 벳·올인을 받은 상대가 폴드하는지. 올인이 더 잘 폴드시킨다.
  function enemyFolds(enemy, v, allin, foldBoost = 1, rng = Math.random) {
    if (!enemy.tight) return false;
    const need = (allin ? 0.56 : 0.4) * enemy.tight * foldBoost;
    return v + (rng() - 0.5) * 0.2 < need;
  }

  // 상대의 행동. facing 'none'(내가 체크) → bet|check, 'bet' → fold|raise|call, 'allin' → fold|call (올인엔 레이즈 없음)
  function enemyAct(enemy, v, facing, rng = Math.random, foldBoost = 1) {
    const bluff = enemy.bluff === undefined ? 0.1 : enemy.bluff;
    if (facing === 'none') return v >= 0.62 || rng() < bluff ? 'bet' : 'check';
    if (enemyFolds(enemy, v, facing === 'allin', foldBoost, rng)) return 'fold';
    if (facing === 'bet' && ((v >= 0.85 && rng() < 0.5) || rng() < bluff * 0.3)) return 'raise';
    return 'call';
  }

  const foldDamage = (pot) => ANTE * pot;

  // 쇼다운: 진 쪽이 (족보 값 + 보너스) × 팟 만큼 칩을 잃는다. 방어는 마지막에 뺀다.
  function resolveShowdown({ pres, eres, hole, pot, charms, enemy }) {
    const has = (k) => charms.includes(k);
    const count = (en) => hole.filter((c) => c.en === en).length;
    const out = { winner: 0, toEnemy: 0, toPlayer: 0, heal: 0, enemyHeal: 0 };
    if (pres.score > eres.score) {
      let base = HANDS[pres.cat].value + (isRoyal(pres) ? ROYAL_BONUS : 0) + 4 * count('fire');
      if (has('fry') && pres.cat <= 1) base += 6;
      if (has('tattoo') && (pres.cat === 5 || pres.cat === 8)) base += 10;
      if (has('ruler') && (pres.cat === 4 || pres.cat === 8)) base += 10;
      const raw = Math.round(base * pot * (has('pact') ? 1.3 : 1));
      out.winner = 1;
      out.toEnemy = Math.max(1, raw - (enemy.armor || 0));
      out.heal = 3 * count('blood');
    } else if (pres.score < eres.score) {
      const raw = Math.round(HANDS[eres.cat].value * pot * enemy.mul);
      const block = 4 * count('steel') + (has('ironchip') ? 2 : 0);
      out.winner = -1;
      out.toPlayer = Math.max(0, raw - block);
      out.enemyHeal = enemy.heal || 0;
    }
    return out;
  }

  function pickEnemy(floor, kind, rng = Math.random) {
    const e = pick(ENEMIES.filter((x) => x.floor === floor && x.kind === kind), rng);
    return { hole: 2, armor: 0, heal: 0, lie: 0, bluff: 0.1, ...e };
  }

  // 보상·상점 카드: 6~A, 층이 깊을수록 강화 확률이 오른다
  function randomCard(floor, newId, rng = Math.random) {
    const r = 6 + Math.floor(rng() * 9);
    const en = rng() < 0.3 + floor * 0.1 ? pick(ENCHANT_IDS, rng) : null;
    return { id: newId(), r, s: Math.floor(rng() * 4), en };
  }

  const randomCharms = (n, owned, rng = Math.random) =>
    shuffle(Object.keys(CHARMS).filter((k) => !owned.includes(k)), rng).slice(0, n);

  // 층 지도: 위(입구)에서 아래(보스)로 내려가는 갈림길. 줄마다 칸 2~4개.
  function genFloorMap(rng = Math.random) {
    const rows = [];
    for (let r = 0; r <= STEPS; r++) {
      if (r === STEPS) rows.push(['boss']);
      else if (r === STEPS - 1) rows.push(['rest', 'shop']);
      else if (r === 0) rows.push(Array(2 + Math.floor(rng() * 2)).fill('fight'));
      else {
        const pool = r < 2
          ? ['fight', 'fight', 'fight', 'event', 'shop', 'rest']
          : ['fight', 'fight', 'fight', 'elite', 'elite', 'event', 'shop', 'rest'];
        rows.push(Array.from({ length: 2 + Math.floor(rng() * 3) }, () => pick(pool, rng)));
      }
    }
    return { rows, edges: rows.slice(0, -1).map((row, r) => linkRows(row.length, rows[r + 1].length, rng)) };
  }

  // 위 줄 a칸 → 아래 줄 b칸 길. 왼쪽 칸의 길이 오른쪽 칸의 길보다 오른쪽으로 가지 않게 해서 엇갈리지 않는다.
  // 아래 줄의 모든 칸에는 들어오는 길이 하나 이상 있다.
  function linkRows(a, b, rng) {
    const near = (i) => (a === 1 ? 0 : Math.round((i * (b - 1)) / (a - 1)));
    const out = [];
    for (let i = 0; i < a; i++) {
      const p = near(i);
      const nextNear = i + 1 < a ? near(i + 1) : b - 1;
      const targets = p + 1 < b && p + 1 <= nextNear && rng() < 0.45 ? [p, p + 1] : [p];
      if (i > 0) { // 앞 칸과 이 칸 사이에 빈 아래 칸이 있으면 앞 칸에 잇는다
        const prev = out[i - 1];
        out[i - 1] = [...prev, ...range(Math.max(...prev) + 1, p)];
      }
      out.push(targets);
    }
    out[a - 1] = [...out[a - 1], ...range(Math.max(...out[a - 1]) + 1, b)];
    return out;
  }
  const range = (from, to) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);

  // 지금 고를 수 있는 칸: 첫 줄은 전부, 그 뒤는 지나온 칸에서 이어진 칸
  const choicesAt = (map, path, step) => (step === 0 ? map.rows[0].map((_, i) => i) : map.edges[step - 1][path[step - 1]]);

  // 이전 빌드의 보상(받는 즉시 덱에 들어감)을 새 방식(떠날 때 확정)으로: 이미 받은 쪽은 비워 두 번 받지 않게
  function migrateSave(s) {
    const r = s.reward;
    if (!r || !('cardDone' in r)) return s;
    return { ...s, reward: { gold: r.gold, cards: r.cardDone ? [] : r.cards, charms: r.charmDone ? [] : r.charms, cardPick: null, charmPick: null } };
  }

  const api = {
    SUITS, rankLabel, HANDS, ROYAL_BONUS, ANTE, ALLIN_ADD, ENCHANTS, ENCHANT_IDS, CHARMS, ENEMIES, NODES, STEPS, FLOORS, TELLS,
    shuffle, pick, starterDeck, tableDeck, eval5, best, isRoyal, describe, strength, tellOf, enemyFolds, enemyAct,
    foldDamage, resolveShowdown, pickEnemy, randomCard, randomCharms, genFloorMap, choicesAt, migrateSave,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AD = api;
})(this);
