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
let out = AD.resolveShowdown({ pres: flush, eres: pair, hole, mult: 2, charms: ['tattoo'], enemy });
assert.deepStrictEqual(out, { winner: 1, toEnemy: (12 + 4 + 10) * 2 - 2, toPlayer: 0, heal: 0, enemyHeal: 0 });
out = AD.resolveShowdown({ pres: pair, eres: flush, hole, mult: 3, charms: ['ironchip'], enemy });
assert.deepStrictEqual(out, { winner: -1, toEnemy: 0, toPlayer: Math.round(12 * 3 * 1.5) - 4 - 2, heal: 0, enemyHeal: 4 });
out = AD.resolveShowdown({ pres: pair, eres: pair, hole, mult: 3, charms: [], enemy });
assert.strictEqual(out.winner, 0, '무승부는 피해 없음');
out = AD.resolveShowdown({ pres: best('9s 8h 2d 3c 5s Kd Qh'), eres: best('9s 8h 2d 3c 4s Kd Jh'), hole: [], mult: 1, charms: [], enemy: { mul: 1, armor: 9 } });
assert.strictEqual(out.toEnemy, 1, '방어가 커도 이기면 최소 1');

// 절대 안 접는 상대, 체크(×1)에는 아무도 안 접는다
assert.strictEqual(AD.enemyFolds({ tight: 0 }, 0, 3), false);
assert.strictEqual(AD.enemyFolds({ tight: 1 }, 0, 1), false);
assert.strictEqual(AD.enemyFolds({ tight: 1 }, 0.1, 3, 1, () => 0.5), true);

// 지도: 첫 칸은 전투, 마지막은 보스, 선택지는 겹치지 않는다
assert.deepStrictEqual(AD.mapChoices(0), ['fight']);
assert.deepStrictEqual(AD.mapChoices(AD.STEPS), ['boss']);
for (let i = 0; i < 200; i++) {
  const ch = AD.mapChoices(1 + (i % 4));
  assert.strictEqual(new Set(ch).size, ch.length);
}
// 층마다 일반·엘리트·보스가 다 있다
for (let f = 1; f <= AD.FLOORS; f++) for (const k of ['normal', 'elite', 'boss']) assert(AD.pickEnemy(f, k).name, `${f}층 ${k}`);

console.log('logic 테스트 통과');

if (process.argv.includes('--sim')) sim();

// 단순한 플레이어(손기술·표정 무시, 센 패면 올인)로 상대별 받는 피해를 잰다
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
    const enemy = { hole: 2, armor: 0, heal: 0, ...e };
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
    const flop = table.slice(enemy.hole, enemy.hole + 3);
    const rest = table.slice(enemy.hole + 3, enemy.hole + 5);
    let hole = null, mine = null;
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
      const r = AD.best([hand[i], hand[j], ...flop]);
      if (!mine || r.score > mine.score) { mine = r; hole = [hand[i], hand[j]]; }
    }
    const mult = mine.cat >= 3 ? 3 : mine.cat === 2 || (mine.cat === 1 && mine.tb[0] >= 10) ? 2 : 1;
    hands++;
    const v = AD.strength(ehole, flop);
    if (mine.cat === 0 && AD.tellOf(enemy, v) === 2) { taken += AD.ANTE; continue; } // 표정 보고 접기
    if (AD.enemyFolds(enemy, v, mult)) { ehp -= AD.foldDamage(mult); continue; }
    const board = [...flop, ...rest];
    const out = AD.resolveShowdown({ pres: AD.best([...hole, ...board]), eres: AD.best([...ehole, ...board]), hole, mult, charms: [], enemy });
    ehp = Math.min(enemy.hp, ehp - out.toEnemy + out.enemyHeal);
    taken += out.toPlayer;
  }
  return { taken, hands };
}
