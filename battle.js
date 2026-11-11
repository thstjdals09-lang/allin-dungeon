/* 올인 던전 — 전투: 매치·판 진행, 전투 버튼 동작, 전투 화면. game.js 가 공유 컨텍스트 C 를 넘겨 부른다.
   적의 베팅·보스 규칙은 여기에 더한다. */
window.BATTLE = function (C) {
  'use strict';
  const { ui, fx, has, hurt, heal, toast, newId, note, remember, swapCost, rnd, CHANGES, STREETS } = C;
  const { cardHTML, backHTML, slotHTML, btn, bar } = V;

  /* ───────── 매치 (헤즈업 한 판) ───────── */
  function startMatch(kind) {
    const e = AD.pickEnemy(C.S.floor, kind === 'fight' ? 'normal' : kind, rnd);
    C.S.battle = { enemy: { ...e, maxHp: e.hp }, draw: AD.shuffle(C.S.deck, rnd), discard: [], hand: [], handNo: 0, log: [] };
    remember('enemies', e.id);
    C.S.screen = 'battle';
    startHand();
  }

  // 뽑을 카드가 떨어지면 버린 카드를 섞어 다시 쓴다
  function drawCards(b, n) {
    let draw = b.draw, discard = b.discard;
    const got = [];
    for (let i = 0; i < n; i++) {
      if (!draw.length) { draw = AD.shuffle(discard, rnd); discard = []; }
      if (!draw.length) break;
      got.push(draw[0]);
      draw = draw.slice(1);
    }
    b.draw = draw;
    b.discard = discard;
    return got;
  }

  function reveal(b) {
    const hidden = b.shown.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!hidden.length) return;
    const k = AD.pick(hidden, rnd);
    b.shown = b.shown.map((v, i) => v || i === k);
  }

  // 보드가 바뀔 때마다 상대 패 세기와 텔을 새로 읽는다
  function readEnemy(b) {
    b.str = AD.strength(b.ehole, b.board);
    b.tell = AD.tellOf(b.enemy, b.str, rnd);
  }

  function log(msg) { C.S.battle.log = [msg, ...C.S.battle.log].slice(0, 6); }

  // 황금 강화는 내가 폴드하지 않은 판에서만 — 핸드만 정하고 폴드해서 상금을 모으는 길을 막는다
  function payGold(b) {
    const gold = 5 * b.hole.filter((c) => c.en === 'gold').length;
    if (gold) { C.S.gold += gold; log(`황금 강화 · 상금 +${gold}`); }
  }

  function startHand() {
    const b = C.S.battle;
    b.discard = [...b.discard, ...b.hand];
    b.hand = drawCards(b, has('sleeve') ? 6 : 5);
    b.handNo++;
    const table = AD.shuffle(AD.tableDeck(`${C.S.floor}${C.S.step}-${b.handNo}`), rnd);
    const n = b.enemy.hole;
    b.ehole = table.slice(0, n);
    b.board = table.slice(n, n + 3);
    b.table = table.slice(n + 3);
    b.shown = b.ehole.map(() => false);
    b.sel = [];
    b.hole = [];
    b.pot = 1;
    b.street = 0;
    b.changes = CHANGES + (has('coin') ? 1 : 0);
    b.result = null;
    b.phase = 'pick';
    ui.swap = false;
    readEnemy(b);
    if (has('mirror')) reveal(b);
  }

  function endHand(b, result, msg) {
    b.result = result;
    b.phase = 'end';
    ui.swap = false;
    log(msg);
  }

  function nextStreet(b) {
    if (b.street === 2) return showdown(b);
    b.street++;
    b.board = [...b.board, b.table[0]];
    b.table = b.table.slice(1);
    ui.swap = false;
    readEnemy(b);
  }

  function raise(b, add, allin) {
    b.pot += add;
    fx({ t: 'chip', allin });
    if (AD.enemyFolds(b.enemy, b.str, allin, has('face') ? 1.25 : 1, rnd)) {
      const d = AD.foldDamage(b.pot);
      payGold(b);
      b.enemy.hp -= d;
      b.shown = b.shown.map(() => true);
      fx({ t: 'efold', d, kill: b.enemy.hp <= 0 });
      endHand(b, { type: 'efold', toEnemy: d }, `${STREETS[b.street]} ${allin ? '올인' : '벳'} → 상대 폴드 · 상대 스택 −${d}`);
      return;
    }
    log(`${STREETS[b.street]} ${allin ? '올인' : '벳'} → 상대 콜 · 팟 ×${b.pot}`);
    if (!allin) return nextStreet(b);
    fx({ t: 'cutin', text: '올인 콜' });
    const need = 5 - b.board.length; // 올인이면 남은 카드를 다 깔고 바로 쇼다운
    b.board = [...b.board, ...b.table.slice(0, need)];
    b.table = b.table.slice(need);
    b.street = 2;
    showdown(b);
  }

  function showdown(b) {
    const pres = AD.best([...b.hole, ...b.board]);
    const eres = AD.best([...b.ehole, ...b.board]);
    const out = AD.resolveShowdown({ pres, eres, hole: b.hole, pot: b.pot, charms: C.S.charms, enemy: b.enemy });
    payGold(b);
    b.shown = b.shown.map(() => true);
    b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp - out.toEnemy + out.enemyHeal);
    hurt(out.toPlayer);
    heal(out.heal);
    C.S.stats.best = Math.max(C.S.stats.best, pres.cat);
    if (out.winner > 0) C.S.stats.won++;
    note({ bestHand: Math.max(C.P.bestHand, pres.cat), bestHit: Math.max(C.P.bestHit, out.toEnemy) });
    const result = {
      type: 'show', ...out, pdesc: AD.describe(pres), edesc: AD.describe(eres),
      used: pres.cards.map((c) => c.id), eused: eres.cards.map((c) => c.id),
    };
    fx({
      t: 'show', winner: out.winner, toEnemy: out.toEnemy, toPlayer: out.toPlayer, heal: out.heal, enemyHeal: out.enemyHeal,
      cat: pres.cat, name: AD.isRoyal(pres) ? '로열 플러시' : AD.HANDS[pres.cat].name, kill: b.enemy.hp <= 0, bust: C.S.hp <= 0,
    });
    const verdict = out.winner > 0 ? `상대 스택 −${out.toEnemy}` : out.winner < 0 ? `스택 −${out.toPlayer}` : '스플릿';
    endHand(b, result, `쇼다운 ${result.pdesc} vs ${result.edesc} → ${verdict}`);
  }

  function winMatch() {
    const kind = C.S.node;
    const gold = { fight: 16, elite: 32, boss: 55 }[kind] + Math.floor(rnd() * 9) + (has('tooth') ? 15 : 0);
    C.S.gold += gold;
    if (has('bandage')) heal(6);
    if (kind === 'boss') heal(Math.round(C.S.maxHp * 0.4));
    C.S.stats.kills++;
    note({ kills: C.P.kills + 1 });
    const charms = AD.randomCharms(kind === 'boss' ? 3 : kind === 'elite' ? 2 : 0, C.S.charms, rnd);
    C.S.reward = { gold, cards: [0, 1, 2].map(() => AD.randomCard(C.S.floor, newId, rnd)), charms, cardPick: null, charmPick: null };
    C.S.battle = null;
    C.S.screen = 'reward';
  }

  function enemyPanel(b) {
    const e = b.enemy;
    const tags = [
      e.hole === 3 && '카드 3장 받음',
      e.armor && `방어 ${e.armor}`,
      e.heal && `이기면 스택 +${e.heal}`,
      e.mul !== 1 && `족보 값 ×${e.mul}`,
      !e.tight && '폴드 안 함',
    ].filter(Boolean).map((t) => `<li>${t}</li>`).join('');
    const kind = { normal: '', elite: '<em class="kind">하이롤러</em>', boss: '<em class="kind boss">보스</em>' }[e.kind];
    let tell = '';
    if (b.phase === 'pick' || b.phase === 'bet') {
      tell = b.tell < 0
        ? '<p class="tell"><span class="lbl">텔</span><b>없음</b> 속을 알 수 없다</p>'
        : `<p class="tell t${b.tell}"><span class="lbl">텔</span><b>${AD.TELLS[b.tell].mood}</b> ${AD.TELLS[b.tell].text}</p>`;
    }
    const ecards = b.ehole.map((c, i) => (b.shown[i] ? cardHTML(c, { used: b.result && b.result.eused && b.result.eused.includes(c.id) }) : backHTML())).join('');
    return `<section class="enemy ${e.kind}">
      <button class="medal" data-act="modal" data-arg="enemy" aria-label="${e.name} 특성 보기">${e.glyph}</button>
      <div class="who">
        <h2>${e.name} ${kind}</h2>
        <div class="hpline">${bar(e.hp, e.maxHp, 'ehp', 'enemy')}<b class="num">${Math.max(0, e.hp)}<small>/${e.maxHp}</small></b></div>
        <ul class="tags">${tags}</ul>
        <p class="edesc">${e.desc}</p>
      </div>
      <div class="ehole" aria-label="상대 핸드">${ecards}</div>
      ${tell}
    </section>`;
  }

  function resultLine(b) {
    const r = b.result;
    if (r.type === 'pfold') return `<p class="result lose">폴드 · 스택 −${r.toPlayer}</p>`;
    if (r.type === 'efold') return `<p class="result win">상대 폴드 · 상대 스택 −${r.toEnemy}</p>`;
    const vs = `내 <b>${r.pdesc}</b> vs 상대 <b>${r.edesc}</b>`;
    if (r.winner > 0) return `<p class="result win">승리 · ${vs} · 상대 스택 −${r.toEnemy}${r.heal ? ` · 스택 +${r.heal}` : ''}</p>`;
    if (r.winner < 0) return `<p class="result lose">패배 · ${vs} · 스택 −${r.toPlayer}${r.enemyHeal ? ` · 상대 스택 +${r.enemyHeal}` : ''}</p>`;
    return `<p class="result">스플릿 · 둘 다 <b>${r.pdesc}</b></p>`;
  }

  function battleActions(b) {
    if (b.phase === 'pick') {
      return btn(`체인지 ${b.sel.length || ''}`.trim(), 'change', undefined, 'ghost', !b.sel.length || b.sel.length > b.changes)
        + btn('핸드 확정', 'lock', undefined, 'primary', b.sel.length !== 2);
    }
    if (b.phase === 'bet') {
      const foldCost = has('shoes') ? 0 : AD.foldDamage(b.pot);
      const allinAdd = AD.ALLIN_ADD + (has('ring') ? 1 : 0);
      // 칩 아래 숫자는 누른 뒤의 팟 — 무엇이 바뀌는지 미리 보이게
      return `<div class="chips">
        <button class="chip fold" data-act="fold" aria-label="폴드 스택 −${foldCost}"><b>폴드</b><span>스택 −${foldCost}</span></button>
        <button class="chip c1" data-act="check" aria-label="체크 팟 ×${b.pot}"><b>체크</b><span>팟 ×${b.pot}</span></button>
        <button class="chip c2" data-act="bet" aria-label="벳 팟 ×${b.pot + 1}"><b>벳</b><span>팟 ×${b.pot + 1}</span></button>
        <button class="chip c3" data-act="allin" aria-label="올인 팟 ×${b.pot + allinAdd}, 바로 쇼다운"><b>올인</b><span>팟 ×${b.pot + allinAdd}</span></button>
      </div>`;
    }
    const label = C.S.hp <= 0 ? '결과 보기' : b.enemy.hp <= 0 ? '보상 받기' : '다음 판';
    return btn(label, 'next', undefined, 'primary wide');
  }

  // 판 진행 단계: 핸드 → 플롭 → 턴 → 리버 → 쇼다운(폴드로 끝나면 폴드)
  function stepper(b) {
    const at = b.phase === 'pick' ? 0 : b.phase === 'bet' ? 1 + b.street : 4;
    const folded = b.result && b.result.type !== 'show';
    const steps = ['핸드', '플롭', '턴', '리버', folded ? '폴드' : '쇼다운'];
    return `<ol class="stepper" aria-label="진행 단계">${steps.map((s, i) =>
      `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"${i === at ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;
  }

  // 지금 패 그대로 이기면 상대가 잃을 칩 — 규칙 엔진의 계산을 그대로 쓴다
  function winIfNow(b, hole, pres) {
    return AD.resolveShowdown({ pres, eres: { score: -1, cat: 0 }, hole, pot: b.pot, charms: C.S.charms, enemy: b.enemy }).toEnemy;
  }

  function vBattle() {
    const b = C.S.battle;
    const used = b.result && b.result.used ? b.result.used : [];
    const board = [
      ...b.board.map((c, i) => cardHTML(c, ui.swap ? { act: 'swap', arg: i, swap: true } : { used: used.includes(c.id) })),
      ...Array(5 - b.board.length).fill(slotHTML()),
    ].join('');
    // 손패는 높은 숫자부터, 손에 쥔 것처럼 살짝 부채꼴로
    const inHole = (c) => b.hole.some((h) => h.id === c.id);
    const sorted = b.hand.slice().sort((x, y) => y.r - x.r || x.s - y.s);
    const mid = (sorted.length - 1) / 2;
    const fan = (i) => `--r:${((i - mid) * 3).toFixed(1)}deg;--y:${(Math.abs(i - mid) * 3).toFixed(1)}px`;
    const hand = sorted.map((c, i) => (b.phase === 'pick'
      ? cardHTML(c, { act: 'sel', sel: b.sel.includes(c.id), style: fan(i) })
      : cardHTML(c, { sel: inHole(c), dim: !inHole(c), used: used.includes(c.id), style: fan(i) }))).join('');

    const holeNow = b.phase === 'pick' ? b.hand.filter((c) => b.sel.includes(c.id)) : b.hole;
    const pres = holeNow.length === 2 && b.phase !== 'end' ? AD.best([...holeNow, ...b.board]) : null;
    const pips = Array.from({ length: CHANGES + (has('coin') ? 1 : 0) }, (_, i) => `<i class="${i < b.changes ? 'on' : ''}"></i>`).join('');
    const swapBtn = b.phase === 'bet'
      ? btn(ui.swap ? '취소' : `보드 체인지 · ${swapCost()}`, 'swapmode', undefined, 'ghost sm', !ui.swap && b.changes < swapCost())
      : '';
    const status = `<div class="status">
      ${pres ? `<p class="mine">지금 내 패 <b>${AD.describe(pres)}</b> · 이기면 상대 <b class="num">−${winIfNow(b, holeNow, pres)}</b></p>` : ''}
      <div class="row">
        <span class="pips" aria-label="체인지 ${b.changes}번 남음"><span class="lbl">체인지</span>${pips}</span>
        ${swapBtn}
      </div>
    </div>`;

    let hint = '';
    if (b.phase === 'pick') hint = '핸드 2장을 고르세요. 고른 카드는 체인지로 바꿀 수 있습니다.';
    else if (b.phase === 'bet') {
      hint = ui.swap ? '바꿀 보드 카드를 누르세요.'
        : b.street === 2 ? '리버 베팅. 끝나면 쇼다운입니다.' : `${STREETS[b.street]} 베팅. 체크하면 ${['턴이', '리버가'][b.street]} 열립니다.`;
    }

    return `<main class="screen battle">
      ${enemyPanel(b)}
      <section class="board${ui.swap ? ' swapping' : ''}" aria-label="보드">
        <div class="potline">${stepper(b)}<b class="num pot">팟 ×${b.pot}</b></div>
        <div class="cards">${board}</div>
      </section>
      <div class="bottom">
        ${b.phase === 'end' ? resultLine(b) : `<p class="hint">${hint}</p>`}
        ${status}
        <section class="hand" aria-label="내 손패"><div class="cards${sorted.length > 5 ? ' six' : ''}">${hand}</div></section>
      </div>
      <div class="actions">${battleActions(b)}</div>
    </main>`;
  }

  const ACT = {
    sel(id) {
      const b = C.S.battle;
      if (b.phase !== 'pick') return;
      b.sel = b.sel.includes(id) ? b.sel.filter((x) => x !== id) : [...b.sel, id].slice(-2);
    },
    change() {
      const b = C.S.battle;
      const n = b.sel.length;
      if (!n) return toast('바꿀 카드를 먼저 고르세요');
      if (n > b.changes) return toast(`체인지가 ${b.changes}번 남았습니다`);
      const fresh = drawCards(b, n); // 먼저 뽑고 버려야 방금 버린 카드가 바로 돌아오지 않는다
      if (!fresh.length) return toast('덱에 남은 카드가 없습니다');
      const out = b.sel.slice(0, fresh.length);
      b.discard = [...b.discard, ...b.hand.filter((c) => out.includes(c.id))];
      b.hand = b.hand.map((c) => (out.includes(c.id) ? fresh[out.indexOf(c.id)] : c));
      b.changes -= fresh.length;
      b.sel = [];
    },
    lock() {
      const b = C.S.battle;
      if (b.sel.length !== 2) return toast('핸드는 2장입니다');
      b.hole = b.hand.filter((c) => b.sel.includes(c.id));
      C.S.stats.hands++;
      b.hole.filter((c) => c.en === 'eye').forEach(() => reveal(b));
      b.phase = 'bet';
      fx({ t: 'lock' });
    },
    check() { const b = C.S.battle; log(`${STREETS[b.street]} 체크`); fx({ t: 'check' }); nextStreet(b); },
    bet() { raise(C.S.battle, 1, false); },
    allin() { raise(C.S.battle, AD.ALLIN_ADD + (has('ring') ? 1 : 0), true); },
    fold() {
      const b = C.S.battle;
      const d = has('shoes') ? 0 : AD.foldDamage(b.pot);
      hurt(d);
      fx({ t: 'pfold', d, bust: C.S.hp <= 0 });
      endHand(b, { type: 'pfold', toPlayer: d }, `${STREETS[b.street]} 폴드 · 스택 −${d}`);
    },
    swapmode() {
      if (C.S.battle.changes < swapCost()) return toast(`보드 체인지는 체인지 ${swapCost()}이 필요합니다`);
      ui.swap = !ui.swap;
    },
    swap(i) {
      const b = C.S.battle;
      if (!ui.swap || b.phase !== 'bet' || b.changes < swapCost()) return;
      b.board = b.board.map((c, k) => (k === +i ? b.table[0] : c));
      b.table = b.table.slice(1);
      b.changes -= swapCost();
      ui.swap = false;
      readEnemy(b);
    },
    next() {
      if (C.S.hp <= 0) { C.S.screen = 'over'; return; }
      if (C.S.battle.enemy.hp <= 0) return winMatch();
      startHand();
    },
  };

  return { startMatch, vBattle, ACT };
};
