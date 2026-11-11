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
    fire: { name: '불꽃', icon: 'flame', desc: '핸드로 쓰고 이기면 족보 값 +4' },
    steel: { name: '강철', icon: 'shield', desc: '핸드로 쓰고 지면 잃는 칩 −4' },
    gold: { name: '황금', icon: 'coins', desc: '핸드로 쓰고 폴드하지 않으면 상금 +5' },
    wild: { name: '와일드', icon: 'sparkles', desc: '어떤 무늬로도 친다' },
    eye: { name: '투시', icon: 'eye', desc: '핸드로 정하면 상대 핸드 1장이 보인다' },
    blood: { name: '흡혈', icon: 'droplet', desc: '핸드로 쓰고 이기면 스택 +3' },
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
    suits: { name: '무늬 수집가', desc: '덱에서 가장 많은 무늬가 8장 이상이면 플러시 족보 값 ×2' },
    mirror2: { name: '쌍둥이 거울', desc: '덱에 같은 숫자가 3장 이상인 숫자가 있으면 페어·트리플·풀하우스·포카드 족보 값 ×1.5' },
    ladder: { name: '사다리', desc: '덱에 연속된 숫자가 6개 이상이면 스트레이트 족보 값 ×2' },
    bluffbadge: { name: '허풍선이 배지', desc: '상대가 폴드할 때마다 상금 +4, 상대가 잃는 칩 +2' },
    junkie: { name: '올인 중독', desc: '올인으로 간 판을 이기면 족보 값 +12, 지면 잃는 칩 +4' },
    slim: { name: '얇은 지갑', desc: '덱이 14장 이하면 모든 족보 값 +4' },
  };

  // 트릭: 쓰면 사라지는 소모품(최대 MAX_TRICKS 칸). 전투 베팅 중에만 쓴다.
  const TRICKS = {
    peek: { name: '엿보기', icon: 'scan-eye', desc: '다음에 깔릴 보드 카드를 미리 본다 (리버 전)' },
    mark: { name: '표시된 카드', icon: 'badge-check', desc: '엎어 둔 상대 핸드 1장을 공개한다' },
    stare: { name: '노려보기', icon: 'scan-face', desc: '이번 거리, 상대가 벳·올인에 폴드할 확률이 크게 오른다' },
    double: { name: '더블 다운', icon: 'chevrons-up', desc: '팟 +2. 상대 응답 없음, 상대가 벳한 뒤에는 못 쓴다' },
  };
  const TRICK_IDS = Object.keys(TRICKS);
  const MAX_TRICKS = 3;
  const STARE_BOOST = 1.6;
  const TRICK_REWARD_CHANCE = 0.4;
  const trickRoom = (owned) => (owned >= MAX_TRICKS ? `트릭 칸이 가득 찼습니다 (${MAX_TRICKS}/${MAX_TRICKS})` : null);
  // 매치 보상: 40% 로 트릭 1개 후보, 아니면 null
  const rewardTrick = (rng = Math.random) => (rng() < TRICK_REWARD_CHANCE ? pick(TRICK_IDS, rng) : null);
  // 상점: 서로 다른 트릭 2개, 기본 가격 30~40 (난이도 가격은 호출 쪽에서)
  const shopTricks = (rng = Math.random) => shuffle(TRICK_IDS, rng).slice(0, 2).map((id) => ({ id, price: 30 + Math.floor(rng() * 3) * 5 }));
  // 지금 쓸 수 없으면 이유(한국어), 쓸 수 있으면 null. st = { phase, street, facing, hiddenCard, peeked, hiddenEnemyCards, stared }
  function canUseTrick(id, st) {
    if (!TRICKS[id]) return '알 수 없는 트릭입니다';
    if (st.phase !== 'bet') return '핸드를 확정한 뒤 베팅 중에만 쓸 수 있습니다';
    if (id === 'peek') {
      if (st.street >= 2) return '리버에는 다음 카드가 없습니다';
      if (st.hiddenCard && st.street === 1) return '숨겨진 리버는 엿볼 수 없습니다';
      if (st.peeked) return '이미 다음 카드를 엿봤습니다';
    }
    if (id === 'mark' && !st.hiddenEnemyCards) return '공개할 상대 카드가 없습니다';
    if (id === 'stare' && st.stared) return '이번 거리에 이미 노려봤습니다';
    if (id === 'double' && st.facing) return '상대가 벳한 뒤에는 쓸 수 없습니다';
    return null;
  }

  // mul: 상대가 이길 때 족보 값 배수 · tight: 벳에 폴드하는 정도(0이면 폴드 안 함)
  // bluff: 약해도 벳하는 확률(기본 0.1)
  // lie: 텔이 거짓일 확률 · poker: 텔이 없음 · armor: 내가 이길 때 덜 잃는 칩
  const ENEMIES = [
    { id: 'drunk', floor: 1, kind: 'normal', name: '취한 단골', icon: 'wine', hp: 22, mul: 1, tight: 1, lie: 0.1, desc: '텔이 그대로 드러난다.' },
    { id: 'bluffer', floor: 1, kind: 'normal', name: '허세꾼', icon: 'venetian-mask', hp: 24, mul: 1, tight: 0.7, lie: 0.5, bluff: 0.35, desc: '텔 절반이 연기다.' },
    { id: 'coward', floor: 1, kind: 'normal', name: '겁 많은 회사원', icon: 'frown', hp: 20, mul: 1, tight: 1.5, lie: 0, desc: '벳이 들어오면 쉽게 폴드한다.' },
    { id: 'local', floor: 1, kind: 'normal', name: '동네 타짜', icon: 'hand', hp: 26, mul: 1.2, tight: 0.9, lie: 0.25, desc: '이길 때 크게 가져간다.' },
    { id: 'drifter', floor: 1, kind: 'elite', name: '떠돌이 딜러', icon: 'compass', hp: 44, mul: 1.3, tight: 0.8, lie: 0.3, armor: 1, rule: 'stealChange', desc: '테이블을 옮겨 다니며 팟을 쓸어 간다.' },
    { id: 'bear', floor: 1, kind: 'boss', name: '문지기 곰', icon: 'paw-print', hp: 70, mul: 1.3, tight: 0.6, lie: 0.2, armor: 2, bluff: 0.15, rule: 'forceAllin', desc: '1층 계단을 지키는 덩치.' },

    { id: 'loanshark', floor: 2, kind: 'normal', name: '사채업자', icon: 'hand-coins', hp: 34, mul: 1.2, tight: 0.9, lie: 0.2, heal: 4, desc: '이길 때마다 스택을 채운다.' },
    { id: 'twins', floor: 2, kind: 'normal', name: '쌍둥이 딜러', icon: 'users', hp: 28, mul: 0.9, tight: 1, lie: 0.2, hole: 3, desc: '카드 3장을 받아 그중에서 핸드를 고른다.' },
    { id: 'iron', floor: 2, kind: 'normal', name: '무쇠손', icon: 'hammer', hp: 34, mul: 1.2, tight: 0.8, lie: 0.2, armor: 2, desc: '져도 칩을 덜 잃는다.' },
    { id: 'magician', floor: 2, kind: 'elite', name: '카드 마술사', icon: 'wand-sparkles', hp: 40, mul: 0.9, tight: 0.8, lie: 0.6, hole: 3, bluff: 0.3, rule: 'swapRandom', desc: '텔도 카드도 믿을 수 없다.' },
    { id: 'croupier', floor: 2, kind: 'boss', name: '수석 크루피어', icon: 'crown', hp: 48, mul: 0.85, tight: 0.5, lie: 0.3, hole: 3, armor: 1, bluff: 0.15, rule: 'rigBoard', desc: '2층의 모든 테이블을 돌리는 사람.' },

    { id: 'gambler', floor: 3, kind: 'normal', name: '빚더미 노름꾼', icon: 'dices', hp: 42, mul: 1.4, tight: 0.5, lie: 0.3, bluff: 0.25, desc: '잃을 게 없어서 폴드를 잘 안 한다.' },
    { id: 'ghost', floor: 3, kind: 'normal', name: '유령 손님', icon: 'ghost', hp: 40, mul: 1.4, tight: 0.9, poker: true, desc: '얼굴이 없어 텔도 없다.' },
    { id: 'banker', floor: 3, kind: 'normal', name: '금고지기', icon: 'vault', hp: 44, mul: 1.3, tight: 0.9, lie: 0.2, armor: 3, desc: '져도 칩을 많이 덜 잃는다.' },
    { id: 'shark', floor: 3, kind: 'elite', name: '큰손', icon: 'fish', hp: 44, mul: 1.1, tight: 0.6, lie: 0.3, hole: 3, armor: 1, rule: 'bigPot', desc: '큰 팟을 좋아한다.' },
    { id: 'house', floor: 3, kind: 'boss', name: '하우스의 주인', icon: 'castle', hp: 85, mul: 1.3, tight: 0, poker: true, hole: 3, armor: 2, bluff: 0.15, rule: 'hiddenCard', desc: '폴드하지 않는다. 텔도 없다.' },
  ];

  // 보스·하이롤러 고유 규칙. notice 는 판이 시작될 때 상대 패널에 뜨는 예고
  const RULES = {
    forceAllin: { name: '강제 올인', desc: '3판마다 플롭에서 올인한다. 폴드 아니면 콜뿐', notice: '' },
    rigBoard: { name: '보드 바꿔치기', desc: '내가 핸드를 정하면 보드 1장을 제 패에 유리하게 바꾼다', notice: '핸드를 정하면 보드 1장을 바꿔친다' },
    hiddenCard: { name: '엎어 둔 리버', desc: '리버 카드가 쇼다운까지 엎어져 있다', notice: '리버는 쇼다운까지 엎어져 있다' },
    stealChange: { name: '체인지 강탈', desc: '판마다 내 체인지가 1개 줄어든다', notice: '체인지 1개를 빼앗는다' },
    swapRandom: { name: '보드 변조', desc: '내가 핸드를 정하면 보드 1장이 무작위로 바뀐다', notice: '핸드를 정하면 보드 1장이 바뀐다' },
    bigPot: { name: '큰 팟', desc: '팟이 ×2 에서 시작한다', notice: '팟 ×2 로 시작' },
  };
  const FORCE_EVERY = 3;
  const isForcedAllin = (enemy, handNo) => enemy.rule === 'forceAllin' && handNo % FORCE_EVERY === 0;
  function ruleNotice(enemy, handNo) {
    if (!enemy.rule) return '';
    if (enemy.rule !== 'forceAllin') return RULES[enemy.rule].notice;
    return isForcedAllin(enemy, handNo) ? '이번 판 강제 올인' : `${FORCE_EVERY - (handNo % FORCE_EVERY)}판 뒤 강제 올인`;
  }

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

  // 오늘의 도전용 시드 난수(mulberry32). 상태를 바꾸지 않고 {state, value} 를 돌려준다 — 상태 정수는 저장에 넣는다.
  function seedNext(state) {
    const s = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { state: s, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
  }
  const seedFromDate = (yyyymmdd) => (Number(yyyymmdd) ^ 0x9e3779b9) | 0;

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

  // 크루피어: 보드 한 자리를 후보 카드로 바꿔 상대 패 세기를 가장 높이는 {index, card}. 어떻게 해도 나빠지기만 하면 null
  function rigCard(ehole, board, candidates) {
    let top = null;
    let topV = strength(ehole, board);
    board.forEach((_, i) => candidates.forEach((card) => {
      const v = strength(ehole, board.map((c, k) => (k === i ? card : c)));
      if (v > topV) { topV = v; top = { index: i, card }; }
    }));
    return top;
  }

  // 복기: 플롭 때 내 승률. 남은 52장 덱(상대 핸드·플롭·이미 나간 카드 deadIds 제외)에서 턴·리버 2장을 전부 세어 {win, tie, lose}.
  // deadIds 는 테이블 카드의 id(…-무늬-숫자). 내 핸드는 내 덱에서 온 별개의 카드라 테이블 덱에서 빼지 않는다.
  function equityAtFlop(hole, ehole, flop, deadIds = []) {
    const key = (c) => `${c.s}-${c.r}`;
    const out = new Set([...ehole, ...flop].map(key));
    deadIds.forEach((id) => { const m = /-(\d)-(\d+)$/.exec(id); if (m) out.add(`${m[1]}-${m[2]}`); });
    const rest = tableDeck('eq').filter((c) => !out.has(key(c)));
    let win = 0, tie = 0, lose = 0;
    for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) {
      const board = [...flop, rest[i], rest[j]];
      const d = best([...hole, ...board]).score - best([...ehole, ...board]).score;
      if (d > 0) win++; else if (d < 0) lose++; else tie++;
    }
    const n = win + tie + lose;
    return { win: win / n, tie: tie / n, lose: lose / n };
  }

  // 한 줄 평: 폴드했는데 승률 ≥ 50% → regret, 끝까지 베팅·콜로 쇼다운에 가서 승률 < 25% → reckless
  function reviewVerdict(type, pct, committed) {
    if (type === 'pfold' && pct >= 50) return 'regret';
    if (type === 'show' && committed && pct < 25) return 'reckless';
    return null;
  }

  // 하우스: 리버(다섯 번째 보드 카드)는 쇼다운 전까지 내게 안 보인다
  const visibleBoard = (enemy, board, ended) => (enemy.rule === 'hiddenCard' && !ended ? board.slice(0, 4) : board);

  // 연승 1당 내가 주는 피해 +15%, 최대 +60%
  const STREAK_STEP = 0.15;
  const STREAK_MAX = 4;
  const streakMult = (streak = 0) => Math.round((1 + STREAK_STEP * Math.min(Math.max(streak, 0), STREAK_MAX)) * 100) / 100;

  const foldDamage = (pot, charms = [], streak = 0) => Math.round((ANTE * pot + (charms.includes('bluffbadge') ? 2 : 0)) * streakMult(streak));

  // 덱 구성에 따른 족보 값 배수(내 덱 전체 기준). 해당 족보가 아니거나 조건이 안 되면 1
  function deckMult(cat, deck, has) {
    if (has('suits') && (cat === 5 || cat === 8)) {
      const n = [0, 1, 2, 3].map((s) => deck.filter((c) => c.s === s).length);
      if (Math.max(...n) >= 8) return 2;
    }
    if (has('mirror2') && [1, 2, 3, 6, 7, 9].includes(cat)) {
      const n = {};
      deck.forEach((c) => { n[c.r] = (n[c.r] || 0) + 1; });
      if (Object.values(n).some((k) => k >= 3)) return 1.5;
    }
    if (has('ladder') && (cat === 4 || cat === 8)) {
      const ranks = new Set(deck.map((c) => c.r));
      let run = 0;
      for (let r = 2; r <= 14; r++) { run = ranks.has(r) ? run + 1 : 0; if (run >= 6) return 2; }
    }
    return 1;
  }

  // 쇼다운: 진 쪽이 (족보 값 + 보너스) × 팟 만큼 칩을 잃는다. 방어는 마지막에 뺀다.
  function resolveShowdown({ pres, eres, hole, pot, charms, enemy, deck = [], allin = false, streak = 0 }) {
    const has = (k) => charms.includes(k);
    const count = (en) => hole.filter((c) => c.en === en).length;
    const out = { winner: 0, toEnemy: 0, toPlayer: 0, heal: 0, enemyHeal: 0 };
    if (pres.score > eres.score) {
      let base = HANDS[pres.cat].value * deckMult(pres.cat, deck, has) + (isRoyal(pres) ? ROYAL_BONUS : 0) + 4 * count('fire');
      if (has('slim') && deck.length <= 14) base += 4;
      if (has('junkie') && allin) base += 12;
      if (has('fry') && pres.cat <= 1) base += 6;
      if (has('tattoo') && (pres.cat === 5 || pres.cat === 8)) base += 10;
      if (has('ruler') && (pres.cat === 4 || pres.cat === 8)) base += 10;
      const raw = Math.round(base * pot * (has('pact') ? 1.3 : 1));
      out.winner = 1;
      out.toEnemy = Math.max(1, Math.round(Math.max(1, raw - (enemy.armor || 0)) * streakMult(streak)));
      out.heal = 3 * count('blood');
    } else if (pres.score < eres.score) {
      const raw = Math.round((HANDS[eres.cat].value + (enemy.valueBonus || 0)) * pot * enemy.mul);
      const block = 4 * count('steel') + (has('ironchip') ? 2 : 0);
      out.winner = -1;
      out.toPlayer = Math.max(0, raw + (has('junkie') && allin ? 4 : 0) - block);
      out.enemyHeal = enemy.heal || 0;
    }
    return out;
  }

  // 상대 수식어: 상대를 만들 때 굴려 붙인다. hp 는 난이도를 얹은 뒤의 값에 곱한다.
  const AFFIXES = {
    sharp: { name: '날카로운', icon: 'swords', desc: '이기면 족보 값 +2' },
    sturdy: { name: '단단한', icon: 'shield-plus', desc: '방어 +2' },
    grit: { name: '투지', icon: 'heart-pulse', desc: '스택 +25%' },
    bluster: { name: '허세', icon: 'drama', desc: '약해도 벳·레이즈를 더 자주 한다' },
    cool: { name: '냉정', icon: 'glasses', desc: '텔이 없다' },
    rich: { name: '부자', icon: 'gem', desc: '이기면 상금 +50%' },
  };
  const AFFIX_IDS = Object.keys(AFFIXES);

  // 붙는 수: 일반 1층 40%로 1개 · 2층 1개 · 3층 1~2개, 하이롤러 1~2개, 보스 0개. 난이도 2 이상이면 일반·하이롤러 +1(최대 2)
  function affixCount(floor, kind, level, rng = Math.random) {
    if (kind === 'boss') return 0;
    const n = kind === 'elite' || floor >= 3 ? 1 + (rng() < 0.5 ? 1 : 0) : floor === 2 ? 1 : (rng() < 0.4 ? 1 : 0);
    return level >= 2 ? Math.min(2, n + 1) : n;
  }

  // 같은 수식어는 한 번만, 이미 텔이 없는 상대에겐 냉정을 안 붙인다
  function rollAffixes(enemy, level, rng = Math.random) {
    const pool = AFFIX_IDS.filter((id) => !(id === 'cool' && enemy.poker));
    return shuffle(pool, rng).slice(0, affixCount(enemy.floor, enemy.kind, level, rng));
  }

  function applyAffixes(enemy, ids) {
    const has = (id) => ids.includes(id);
    const hp = has('grit') ? Math.round(enemy.hp * 1.25) : enemy.hp;
    return {
      ...enemy,
      affixes: [...ids],
      hp,
      armor: (enemy.armor || 0) + (has('sturdy') ? 2 : 0),
      bluff: Math.round(((enemy.bluff === undefined ? 0.1 : enemy.bluff) + (has('bluster') ? 0.2 : 0)) * 100) / 100,
      poker: !!enemy.poker || has('cool'),
      valueBonus: (enemy.valueBonus || 0) + (has('sharp') ? 2 : 0),
      goldMul: has('rich') ? 1.5 : enemy.goldMul || 1,
    };
  }

  function pickEnemy(floor, kind, rng = Math.random, id = null) {
    const e = pick(ENEMIES.filter((x) => x.floor === floor && x.kind === kind && (!id || x.id === id)), rng);
    return { hole: 2, armor: 0, heal: 0, lie: 0, bluff: 0.1, ...e };
  }

  // 카드 합치기: 같은 숫자 두 장 → 숫자 +2(최대 A). 무늬는 먼저 고른 카드, 강화는 먼저 고른 카드 것(없으면 다른 쪽)
  const mergeableRanks = (deck) => [...new Set(deck.filter((c) => deck.filter((d) => d.r === c.r).length >= 2).map((c) => c.r))];
  const mergeCards = (a, b, id) => ({ id, r: Math.min(a.r + 2, 14), s: a.s, en: a.en || b.en || null });

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
    SUITS, rankLabel, HANDS, ROYAL_BONUS, ANTE, ALLIN_ADD, ENCHANTS, ENCHANT_IDS, CHARMS, TRICKS, TRICK_IDS, MAX_TRICKS, STARE_BOOST, trickRoom, rewardTrick, shopTricks, canUseTrick, ENEMIES, NODES, STEPS, FLOORS, TELLS, RULES,
    seedNext, seedFromDate, shuffle, pick, starterDeck, tableDeck, eval5, best, isRoyal, describe, strength, tellOf, enemyFolds, enemyAct,
    isForcedAllin, ruleNotice, rigCard, equityAtFlop, reviewVerdict, visibleBoard, foldDamage, streakMult, STREAK_STEP, STREAK_MAX, AFFIXES, AFFIX_IDS, affixCount, rollAffixes, applyAffixes, resolveShowdown, pickEnemy, mergeableRanks, mergeCards, randomCard, randomCharms, genFloorMap, choicesAt, migrateSave,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AD = api;
})(this);
