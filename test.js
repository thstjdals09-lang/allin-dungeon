/* 규칙 엔진 점검. `node test.js` = 판정 테스트, `node test.js --sim` = 밸런스 시뮬레이션 */
const assert = require('assert');
const AD = require('./logic.js');

const SUIT = { s: 0, h: 1, d: 2, c: 3 };
const RANK = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
let uid = 0;
// 'Ah' 'Tc' '9s*'(* = 만능 각인)
const C = (txt) => txt.split(' ').map((t) => ({
  id: 'x' + uid++, r: RANK[t[0]] || +t[0], s: SUIT[t[1]], en: t[2] === '*' ? 'wild' : null,
}));
const best = (txt) => AD.best(C(txt));
const cat = (txt) => best(txt).cat;

// 족보 판정
assert.strictEqual(cat('Ah Kh Qh Jh Th 2c 3d'), 8);
assert.strictEqual(AD.describe(best('Ah Kh Qh Jh Th 2c 3d')), '로열 플러시');
assert.strictEqual(cat('9s 9h 9d 9c 2s 3d 4h'), 7);
assert.strictEqual(cat('9s 9h 9d 2c 2s 3d 4h'), 6);
assert.strictEqual(cat('2h 7h 9h Jh Kh 3c 4d'), 5);
assert.strictEqual(cat('5s 6h 7d 8c 9s Kd 2h'), 4);
assert.strictEqual(cat('As 2h 3d 4c 5s Kd Qh'), 4);
assert.strictEqual(best('As 2h 3d 4c 5s Kd Qh').tb[0], 5, '휠 스트레이트는 5 하이');
assert.strictEqual(cat('9s 9h 9d 2c 5s Kd Qh'), 3);
assert.strictEqual(cat('9s 9h 2d 2c 5s Kd Qh'), 2);
assert.strictEqual(cat('9s 9h 2d 3c 5s Kd Qh'), 1);
assert.strictEqual(cat('9s 8h 2d 3c 5s Kd Qh'), 0);
assert.strictEqual(cat('As Ah Ad Ac As 2d 3h'), 9, '내 덱 카드와 테이블이 겹치면 파이브카드');

// 같은 족보 안에서 높은 쪽이 이긴다
assert(best('As Ah Kd 7c 5s 3d 2h').score > best('As Ah Qd 7c 5s 3d 2h').score, '키커');
assert(best('6s 7h 8d 9c Ts 2d 2h').score > best('As 2h 3d 4c 5s Kd Qh').score, '6 하이 > 휠');
assert(best('As Ad Ah Kc Ks').score > best('2h 3h 4h 5h 7h').score, '풀하우스 > 플러시');

// 7장 중 가장 센 5장을 고른다 (스트레이트와 플러시가 같이 있으면 플러시)
assert.strictEqual(cat('5h 6h 7h 8c 9h Kh 2d'), 5);

// 만능 각인은 무늬를 맞춰 준다
assert.strictEqual(cat('2h 7h 9h Jh Ks* 3c 4d'), 5);
assert.strictEqual(cat('2h 7h 9h Jc Ks* 3c 4d'), 0);
assert.strictEqual(cat('9h Th Jh Qh Ks*'), 8);

// 5장 미만은 판정하지 않는다
assert.strictEqual(AD.best(C('Ah Kh Qh')), null);

// 쇼다운 피해 계산
const enemy = { mul: 1.5, armor: 2, heal: 4 };
const hole = [{ r: 14, s: 1, en: 'fire' }, { r: 13, s: 1, en: 'steel' }];
const flush = best('2h 7h 9h Jh Kh 3c 4d');
const pair = best('9s 9h 2d 3c 5s Kd Qh');
let out = AD.resolveShowdown({ pres: flush, eres: pair, hole, pot: 2, charms: ['tattoo'], enemy });
assert.deepStrictEqual(out, { winner: 1, toEnemy: (12 + 4 + 10) * 2 - 2, toPlayer: 0, heal: 0, enemyHeal: 0 });
out = AD.resolveShowdown({ pres: pair, eres: flush, hole, pot: 3, charms: ['ironchip'], enemy });
assert.deepStrictEqual(out, { winner: -1, toEnemy: 0, toPlayer: Math.round(12 * 3 * 1.5) - 4 - 2, heal: 0, enemyHeal: 4 });
out = AD.resolveShowdown({ pres: pair, eres: pair, hole, pot: 3, charms: [], enemy });
assert.strictEqual(out.winner, 0, '스플릿은 아무도 안 잃음');
out = AD.resolveShowdown({ pres: best('9s 8h 2d 3c 5s Kd Qh'), eres: best('9s 8h 2d 3c 4s Kd Jh'), hole: [], pot: 1, charms: [], enemy: { mul: 1, armor: 9 } });
assert.strictEqual(out.toEnemy, 1, '방어가 커도 이기면 최소 1');

// 폴드 안 하는 상대, 약한 패는 올인에 폴드, 센 패는 벳에 콜
assert.strictEqual(AD.enemyFolds({ tight: 0 }, 0, true), false);
assert.strictEqual(AD.enemyFolds({ tight: 1 }, 0.1, true, 1, () => 0.5), true);
assert.strictEqual(AD.enemyFolds({ tight: 1 }, 0.9, false, 1, () => 0.5), false);
// 플러시 드로우 가산은 리버 전까지만
const fd = C('2h 3h'), turnBoard = C('7h 9h Kc Qd'), riverBoard = C('7h 9h Kc Qd 4s');
assert(AD.strength(fd, turnBoard) > AD.strength(fd, riverBoard));

// 지도: 첫 줄은 전투, 마지막은 보스 하나. 모든 칸에 들어오는 길, 길은 엇갈리지 않는다
for (let k = 0; k < 500; k++) {
  const m = AD.genFloorMap();
  assert.strictEqual(m.rows.length, AD.STEPS + 1);
  assert(m.rows[0].every((t) => t === 'fight'));
  assert.deepStrictEqual(m.rows[AD.STEPS], ['boss']);
  m.edges.forEach((e, r) => {
    const b = m.rows[r + 1].length;
    assert.strictEqual(e.length, m.rows[r].length);
    for (let j = 0; j < b; j++) assert(e.some((t) => t.includes(j)), `${r}줄→${j}칸 들어오는 길`);
    e.forEach((t) => assert(t.length >= 1 && t.every((j) => j >= 0 && j < b)));
    for (let i = 0; i + 1 < e.length; i++) assert(Math.max(...e[i]) <= Math.min(...e[i + 1]), '길이 엇갈림');
  });
  // 어느 길로 가도 보스까지 닿는다
  let path = [];
  for (let step = 0; step <= AD.STEPS; step++) {
    const ch = AD.choicesAt(m, path, step);
    assert(ch.length >= 1);
    path = [...path, ch[Math.floor(Math.random() * ch.length)]];
  }
  assert.strictEqual(m.rows[AD.STEPS][path[AD.STEPS]], 'boss');
}
// 층마다 일반·엘리트·보스가 다 있다
for (let f = 1; f <= AD.FLOORS; f++) for (const k of ['normal', 'elite', 'boss']) assert(AD.pickEnemy(f, k).name, `${f}층 ${k}`);

// 옛 저장의 보상: 이미 받은 카드·유물은 비워 다시 받지 못하게, 새 형식은 그대로
const oldSave = { reward: { gold: 9, cards: [1, 2, 3], charms: ['coin'], cardDone: true, charmDone: false, took: 1 } };
assert.deepStrictEqual(AD.migrateSave(oldSave).reward, { gold: 9, cards: [], charms: ['coin'], cardPick: null, charmPick: null });
const newSave = { reward: { gold: 9, cards: [1], charms: [], cardPick: 0, charmPick: null } };
assert.strictEqual(AD.migrateSave(newSave), newSave);

// 상대의 행동: 고정 rng 로 bet/check/fold/raise/call 각각
const seq = (...xs) => () => xs.shift();
const foe = { tight: 1, bluff: 0.1 };
assert.strictEqual(AD.enemyAct(foe, 0.7, 'none', seq()), 'bet'); // 강하면 벳(rng 안 씀)
assert.strictEqual(AD.enemyAct(foe, 0.3, 'none', seq(0.05)), 'bet'); // 블러프 벳
assert.strictEqual(AD.enemyAct(foe, 0.3, 'none', seq(0.5)), 'check');
assert.strictEqual(AD.enemyAct(foe, 0.1, 'bet', seq(0.5)), 'fold');
assert.strictEqual(AD.enemyAct(foe, 0.9, 'bet', seq(0.5, 0.3)), 'raise'); // 아주 강하면 절반은 레이즈
assert.strictEqual(AD.enemyAct(foe, 0.9, 'bet', seq(0.5, 0.7)), 'call');
assert.strictEqual(AD.enemyAct(foe, 0.6, 'bet', seq(0.5, 0.01)), 'raise'); // 블러프 레이즈
assert.strictEqual(AD.enemyAct(foe, 0.6, 'bet', seq(0.5, 0.9)), 'call');
assert.strictEqual(AD.enemyAct(foe, 0.9, 'allin', seq(0.5, 0.01)), 'call'); // 올인·레이즈에는 레이즈 없음
assert.strictEqual(AD.enemyAct(foe, 0.9, 'raise', seq(0.5, 0.01)), 'call');
assert.strictEqual(AD.enemyAct(foe, 0.1, 'allin', seq(0.5)), 'fold');
assert.strictEqual(AD.pickEnemy(1, 'normal').bluff >= 0.1, true);

console.log('logic 테스트 통과');

if (process.argv.includes('--sim')) sim();

// 단순한 플레이어(체인지·유물 안 씀, 거리마다 패 세기로 벳)로 상대별 잃는 스택을 잰다
function sim() {
  const N = 3000;
  let n = 0;
  const newId = () => 'd' + n++;
  const deckFor = (floor) => {
    const deck = AD.starterDeck(newId);
    for (let i = 0; i < (floor - 1) * 5; i++) deck.push(AD.randomCard(floor, newId));
    return deck;
  };
  const rows = [];
  for (const e of AD.ENEMIES) {
    const enemy = { hole: 2, armor: 0, heal: 0, bluff: 0.1, ...e };
    let taken = [], hands = 0;
    for (let k = 0; k < N; k++) {
      const res = fight(enemy, deckFor(e.floor));
      taken.push(res.taken); hands += res.hands;
    }
    taken.sort((a, b) => a - b);
    const mean = taken.reduce((a, b) => a + b, 0) / N;
    rows.push(`${e.floor}층 ${e.kind.padEnd(6)} ${e.name.padEnd(8)} 평균 피해 ${mean.toFixed(1).padStart(5)}  상위10% ${String(taken[Math.floor(N * 0.9)]).padStart(3)}  핸드 ${(hands / N).toFixed(1)}`);
  }
  console.log(rows.join('\n'));
}

function fight(enemy, deck) {
  let ehp = enemy.hp, taken = 0, hands = 0, draw = AD.shuffle(deck), discard = [];
  while (ehp > 0 && hands < 80) {
    if (draw.length < 5) { draw = AD.shuffle([...draw, ...discard]); discard = []; }
    const hand = draw.slice(0, 5); draw = draw.slice(5); discard.push(...hand);
    const table = AD.shuffle(AD.tableDeck(hands));
    const ehole = table.slice(0, enemy.hole);
    const full = table.slice(enemy.hole, enemy.hole + 5);
    const flop = full.slice(0, 3);
    let hole = null, mine = null;
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
      const r = AD.best([hand[i], hand[j], ...flop]);
      if (!mine || r.score > mine.score) { mine = r; hole = [hand[i], hand[j]]; }
    }
    hands++;
    let pot = 1, folded = 0;
    // 내 패가 원페어 이상이면 콜, 아니면 텔이 '여유'면 폴드, 그 밖엔 콜. 폴드하면 상대가 올리기 전 팟만큼 잃는다
    const respond = (me, v, before) => {
      if (me.cat === 0 && AD.tellOf(enemy, v) === 2) { folded = -1; pot = before; }
    };
    for (let street = 3; street <= 5 && !folded; street++) {
      const board = full.slice(0, street);
      const me = AD.best([...hole, ...board]);
      const v = AD.strength(ehole, board);
      const allin = me.cat >= 3;
      const bet = allin || me.cat === 2 || (me.cat === 1 && me.tb[0] >= 10);
      if (!bet) {
        if (AD.enemyAct(enemy, v, 'none') === 'bet') { pot++; respond(me, v, pot - 1); }
        continue;
      }
      pot += allin ? AD.ALLIN_ADD : 1;
      const act = AD.enemyAct(enemy, v, allin ? 'allin' : 'bet');
      if (act === 'fold') folded = 1;
      else if (allin) break;
      else if (act === 'raise') { pot++; respond(me, v, pot - 1); }
    }
    if (folded < 0) { taken += AD.foldDamage(pot); continue; }
    if (folded > 0) { ehp -= AD.foldDamage(pot); continue; }
    const out = AD.resolveShowdown({ pres: AD.best([...hole, ...full]), eres: AD.best([...ehole, ...full]), hole, pot, charms: [], enemy });
    ehp = Math.min(enemy.hp, ehp - out.toEnemy + out.enemyHeal);
    taken += out.toPlayer;
  }
  return { taken, hands };
}
