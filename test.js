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

// 빌드 유물: 덱 조건과 배수 순서(배수 먼저, 그 뒤 고정 보너스)
{
  const mk = (list) => list.map(([r, s], i) => ({ id: `d${i}`, r, s, en: null }));
  const plain = { mul: 1, armor: 0 };
  const win = (cat, charms, deck, allin = false, pot = 1) =>
    AD.resolveShowdown({ pres: { score: 2, cat, tb: [9] }, eres: { score: 1, cat: 0, tb: [2] }, hole: [], pot, charms, enemy: plain, deck, allin }).toEnemy;
  const spades8 = mk(Array.from({ length: 8 }, (_, i) => [2 + i, 0]));
  const spades7 = mk(Array.from({ length: 7 }, (_, i) => [2 + i, 0]));
  assert.strictEqual(win(5, ['suits'], spades8), 24, '무늬 8장 → 플러시 ×2');
  assert.strictEqual(win(5, ['suits'], spades7), 12, '7장이면 그대로');
  assert.strictEqual(win(4, ['suits'], spades8), 11, '플러시가 아니면 그대로');
  assert.strictEqual(win(5, ['suits', 'tattoo'], spades8), 24 + 10, '배수 뒤에 고정 보너스');
  const trips = mk([[5, 0], [5, 1], [5, 2], [9, 0]]);
  assert.strictEqual(win(1, ['mirror2'], trips), 6, '원페어 4×1.5');
  assert.strictEqual(win(6, ['mirror2'], trips), 23, '풀하우스 15×1.5=22.5 → 반올림');
  assert.strictEqual(win(5, ['mirror2'], trips), 12, '플러시는 해당 없음');
  assert.strictEqual(win(1, ['mirror2'], mk([[5, 0], [5, 1], [9, 0]])), 4, '2장뿐이면 그대로');
  const run6 = mk([3, 4, 5, 6, 7, 8].map((r) => [r, 0]));
  const run5 = mk([3, 4, 5, 6, 7, 9].map((r) => [r, 0]));
  assert.strictEqual(win(4, ['ladder'], run6), 22, '연속 6 → 스트레이트 ×2');
  assert.strictEqual(win(8, ['ladder'], run6), 60);
  assert.strictEqual(win(4, ['ladder'], run5), 11, '연속 5까지면 그대로');
  assert.strictEqual(win(4, ['ladder', 'ruler'], run6), 22 + 10);
  assert.strictEqual(win(0, ['slim'], mk(Array.from({ length: 14 }, (_, i) => [2 + (i % 13), 0]))), 2 + 4, '덱 14장 → +4');
  assert.strictEqual(win(0, ['slim'], mk(Array.from({ length: 15 }, (_, i) => [2 + (i % 13), 0]))), 2, '15장이면 그대로');
  assert.strictEqual(win(1, ['junkie'], [], true), 4 + 12, '올인 승리 +12');
  assert.strictEqual(win(1, ['junkie'], [], false), 4, '올인 아니면 그대로');
  const lose = (charms, allin) => AD.resolveShowdown({ pres: { score: 1, cat: 0, tb: [2] }, eres: { score: 2, cat: 1, tb: [9] }, hole: [], pot: 2, charms, enemy: plain, deck: [], allin }).toPlayer;
  assert.strictEqual(lose(['junkie'], true), 8 + 4, '올인 패배 +4');
  assert.strictEqual(lose(['junkie'], false), 8);
  assert.strictEqual(lose(['junkie', 'ironchip'], true), 8 + 4 - 2);
  assert.strictEqual(AD.foldDamage(3, ['bluffbadge']), 6 + 2, '허풍선이 배지: 폴드 피해 +2');
  assert.strictEqual(AD.foldDamage(3), 6);
}

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

// 이벤트: 카드 합치기와 특정 보스 고르기
{
  const d = [{ id: 'a', r: 9, s: 0, en: null }, { id: 'b', r: 9, s: 2, en: 'x' }, { id: 'c', r: 5, s: 1, en: null }, { id: 'd', r: 13, s: 1, en: null }, { id: 'e', r: 13, s: 3, en: null }];
  assert.deepStrictEqual(AD.mergeableRanks(d).sort((x, y) => x - y), [9, 13]);
  assert.deepStrictEqual(AD.mergeableRanks([d[0], d[2]]), []);
  assert.deepStrictEqual(AD.mergeCards(d[0], d[1], 'n'), { id: 'n', r: 11, s: 0, en: 'x' }); // 강화는 없는 쪽 대신 있는 쪽
  assert.deepStrictEqual(AD.mergeCards(d[1], d[0], 'n'), { id: 'n', r: 11, s: 2, en: 'x' });
  assert.deepStrictEqual(AD.mergeCards(d[3], d[4], 'n'), { id: 'n', r: 14, s: 1, en: null }); // 13+2 는 A 에서 멈춤
  assert.strictEqual(AD.mergeCards({ r: 14, s: 0, en: null }, { r: 14, s: 1, en: null }, 'n').r, 14);
  assert.strictEqual(AD.pickEnemy(2, 'boss', Math.random, 'croupier').id, 'croupier');
}

// 보스·하이롤러 규칙
{
  const ruled = AD.ENEMIES.filter((e) => e.rule).map((e) => e.rule).sort();
  assert.deepStrictEqual(ruled, Object.keys(AD.RULES).sort(), '규칙 6개가 각각 한 상대에게');
  const bear = AD.ENEMIES.find((e) => e.rule === 'forceAllin');
  assert.ok([3, 6, 9].every((n) => AD.isForcedAllin(bear, n)) && ![1, 2, 4].some((n) => AD.isForcedAllin(bear, n)));
  assert.strictEqual(AD.ruleNotice(bear, 3), '이번 판 강제 올인');
  assert.strictEqual(AD.ruleNotice(bear, 1), '2판 뒤 강제 올인');
  assert.strictEqual(AD.ruleNotice(bear, 2), '1판 뒤 강제 올인');
  assert.strictEqual(AD.ruleNotice({}, 1), '');
  // 크루피어: 가장 쓸모없는 보드 카드를 후보 중 최고로 바꾼다
  const eh = C('Ah Ad');
  const bd = C('2c 7s 9d');
  const cands = C('Kc As 3h');
  const rig = AD.rigCard(eh, bd, cands);
  assert.strictEqual(rig.card.r, 14, '에이스로 트리플');
  assert.ok(AD.strength(eh, bd.map((c, k) => (k === rig.index ? rig.card : c))) > AD.strength(eh, bd));
  assert.strictEqual(AD.rigCard(C('Ah Ad'), C('As Ac 9d'), C('2c 3d 4h')), null, '나빠지기만 하면 안 바꾼다');
  // 하우스: 리버는 끝나기 전에만 숨김
  const full = C('2c 7s 9d Jh Qs');
  assert.strictEqual(AD.visibleBoard({ rule: 'hiddenCard' }, full, false).length, 4);
  assert.strictEqual(AD.visibleBoard({ rule: 'hiddenCard' }, full, true).length, 5);
  assert.strictEqual(AD.visibleBoard({}, full, false).length, 5);
}

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
