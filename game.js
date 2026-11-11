/* 올인 던전 — 상태와 진행, 전투·상점 화면. 규칙은 logic.js(AD), 화면 조각·시트·지도·타이틀은 views.js(V),
   배경 그림은 scenes.js(SCENES), 연출은 fx.js(FX). */
(function () {
  'use strict';
  const VERSION = 3; // v3: 층 지도가 갈림길(map·path)로 바뀌어 v2 저장과 형식이 다르다
  const SAVE_KEY = 'allin-dungeon-v3';
  const PROFILE_KEY = 'allin-dungeon-profile';
  const START_STACK = 80;
  const MIN_DECK = 8;
  const CHANGES = 2;
  const STREETS = ['플롭', '턴', '리버'];
  const RESUMABLE = ['map', 'battle', 'reward', 'shop', 'rest', 'event'];
  const app = document.getElementById('app');
  const rnd = Math.random;

  let S = null; // 판 전체 상태 (JSON 으로 저장)
  // 저장하지 않는 화면 상태. fx = 이번 클릭에서 일어난 일(fx.js 가 연출), from = 누른 버튼 위치
  // mapSel = 지도에서 눌러 둔 칸(들어가기 전 확인용)
  let ui = { modal: null, swap: false, toast: '', fx: [], from: null, screen: null, mapSel: null };
  const { cardName, cardHTML, backHTML, slotHTML, btn, bar } = V;

  const has = (k) => S.charms.includes(k);
  const fx = (ev) => { ui.fx = [...ui.fx, ev]; };
  const newId = () => 'c' + S.nextId++;
  const toast = (msg) => { ui.toast = msg; };

  /* ───────── 기록·도감 (판을 넘어 남는 것) ───────── */
  const EMPTY_PROFILE = { runs: 0, wins: 0, bestFloor: 0, kills: 0, bestHand: -1, bestHit: 0, enemies: [], charms: [] };
  function loadProfile() {
    try { return { ...EMPTY_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') }; } catch (e) { return { ...EMPTY_PROFILE }; }
  }
  let P = loadProfile();
  function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(P)); } catch (e) { /* 저장이 막힌 브라우저: 이번 방문 동안만 */ }
  }
  const note = (patch) => { P = { ...P, ...patch }; };
  const remember = (key, id) => { if (!P[key].includes(id)) note({ [key]: [...P[key], id] }); };
  const swapCost = () => (has('bribe') ? 1 : 2);
  const isState = (s) => !!s && s.v === VERSION && Array.isArray(s.deck);

  /* ───────── 저장 ───────── */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장이 막힌 브라우저: 진행은 계속, 새로고침하면 처음부터 */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return isState(s) && RESUMABLE.includes(s.screen) ? s : null;
    } catch (e) { return null; }
  }

  /* ───────── 진행 ───────── */
  function newRun() {
    V.resetSeen(); // 카드 id 가 c0 부터 다시 쓰이므로 딜 연출 기록도 비운다
    S = {
      v: VERSION, screen: 'map', hp: START_STACK, maxHp: START_STACK, gold: 40, deck: [], charms: [],
      floor: 1, step: 0, node: null, map: AD.genFloorMap(rnd), path: [], removeCost: 50, nextId: 0,
      stats: { hands: 0, won: 0, best: -1, kills: 0 },
    };
    S.deck = AD.starterDeck(newId, rnd);
    note({ runs: P.runs + 1, bestFloor: Math.max(P.bestFloor, 1) });
  }

  const choices = () => AD.choicesAt(S.map, S.path, S.step);

  function advance() {
    if (S.node === 'boss') {
      if (S.floor === AD.FLOORS) { note({ wins: P.wins + 1 }); S.screen = 'win'; return; }
      S.floor++;
      S.step = 0;
      S.map = AD.genFloorMap(rnd);
      S.path = [];
      note({ bestFloor: Math.max(P.bestFloor, S.floor) });
    } else S.step++;
    S.node = null;
    ui.mapSel = null;
    S.screen = 'map';
  }

  function hurt(n) { S.hp = Math.max(0, S.hp - n); }
  function heal(n) { S.hp = Math.min(S.maxHp, S.hp + n); }
  function gainCharm(id) {
    S.charms = [...S.charms, id];
    remember('charms', id);
    if (id === 'pact') { S.maxHp -= 12; S.hp = Math.min(S.hp, S.maxHp); }
  }

  function enterNode(type) {
    S.node = type;
    if (type === 'fight' || type === 'elite' || type === 'boss') return startMatch(type);
    if (type === 'shop') return openShop();
    if (type === 'rest') { S.rest = { offers: AD.shuffle(AD.ENCHANT_IDS, rnd).slice(0, 2) }; S.screen = 'rest'; return; }
    S.event = { id: AD.pick(EVENTS, rnd).id, done: null };
    S.screen = 'event';
  }

  /* ───────── 매치 (헤즈업 한 판) ───────── */
  function startMatch(kind) {
    const e = AD.pickEnemy(S.floor, kind === 'fight' ? 'normal' : kind, rnd);
    S.battle = { enemy: { ...e, maxHp: e.hp }, draw: AD.shuffle(S.deck, rnd), discard: [], hand: [], handNo: 0, log: [] };
    remember('enemies', e.id);
    S.screen = 'battle';
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

  function log(msg) { S.battle.log = [msg, ...S.battle.log].slice(0, 6); }

  // 황금 강화는 내가 폴드하지 않은 판에서만 — 핸드만 정하고 폴드해서 상금을 모으는 길을 막는다
  function payGold(b) {
    const gold = 5 * b.hole.filter((c) => c.en === 'gold').length;
    if (gold) { S.gold += gold; log(`황금 강화 · 상금 +${gold}`); }
  }

  function startHand() {
    const b = S.battle;
    b.discard = [...b.discard, ...b.hand];
    b.hand = drawCards(b, has('sleeve') ? 6 : 5);
    b.handNo++;
    const table = AD.shuffle(AD.tableDeck(`${S.floor}${S.step}-${b.handNo}`), rnd);
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
    const out = AD.resolveShowdown({ pres, eres, hole: b.hole, pot: b.pot, charms: S.charms, enemy: b.enemy });
    payGold(b);
    b.shown = b.shown.map(() => true);
    b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp - out.toEnemy + out.enemyHeal);
    hurt(out.toPlayer);
    heal(out.heal);
    S.stats.best = Math.max(S.stats.best, pres.cat);
    if (out.winner > 0) S.stats.won++;
    note({ bestHand: Math.max(P.bestHand, pres.cat), bestHit: Math.max(P.bestHit, out.toEnemy) });
    const result = {
      type: 'show', ...out, pdesc: AD.describe(pres), edesc: AD.describe(eres),
      used: pres.cards.map((c) => c.id), eused: eres.cards.map((c) => c.id),
    };
    fx({
      t: 'show', winner: out.winner, toEnemy: out.toEnemy, toPlayer: out.toPlayer, heal: out.heal, enemyHeal: out.enemyHeal,
      cat: pres.cat, name: AD.isRoyal(pres) ? '로열 플러시' : AD.HANDS[pres.cat].name, kill: b.enemy.hp <= 0, bust: S.hp <= 0,
    });
    const verdict = out.winner > 0 ? `상대 스택 −${out.toEnemy}` : out.winner < 0 ? `스택 −${out.toPlayer}` : '스플릿';
    endHand(b, result, `쇼다운 ${result.pdesc} vs ${result.edesc} → ${verdict}`);
  }

  function winMatch() {
    const kind = S.node;
    const gold = { fight: 16, elite: 32, boss: 55 }[kind] + Math.floor(rnd() * 9) + (has('tooth') ? 15 : 0);
    S.gold += gold;
    if (has('bandage')) heal(6);
    if (kind === 'boss') heal(Math.round(S.maxHp * 0.4));
    S.stats.kills++;
    note({ kills: P.kills + 1 });
    const charms = AD.randomCharms(kind === 'boss' ? 3 : kind === 'elite' ? 2 : 0, S.charms, rnd);
    S.reward = { gold, cards: [0, 1, 2].map(() => AD.randomCard(S.floor, newId, rnd)), charms, cardDone: false, charmDone: !charms.length };
    S.battle = null;
    S.screen = 'reward';
  }

  /* ───────── 상점·이벤트 ───────── */
  function openShop() {
    S.shop = {
      cards: [0, 1, 2].map(() => {
        const card = AD.randomCard(S.floor, newId, rnd);
        return { card, price: card.en ? 55 : 30, sold: false };
      }),
      charms: AD.randomCharms(2, S.charms, rnd).map((id) => ({ id, price: 100 + Math.floor(rnd() * 4) * 10, sold: false })),
    };
    S.screen = 'shop';
  }

  const EVENTS = [
    {
      id: 'vending', title: '고장 난 자판기', text: '돈을 넣으면 가끔 유물이 굴러나온다는 소문이 있다.',
      opts: [{
        label: '상금 30 넣기', ok: () => S.gold >= 30, no: '상금이 모자랍니다',
        run: () => {
          S.gold -= 30;
          const [c] = AD.randomCharms(1, S.charms, rnd);
          if (!c) return '덜컹거리기만 하고 아무것도 나오지 않았다.';
          gainCharm(c);
          return `덜컹. ${AD.CHARMS[c].name}이(가) 나왔다.`;
        },
      }],
    },
    {
      id: 'ace', title: '바닥에 떨어진 에이스', text: '테이블 밑에 강화된 A 한 장이 떨어져 있다. 주우려면 깨진 유리 사이로 손을 넣어야 한다.',
      opts: [{
        label: '스택 8을 내고 줍기', ok: () => S.hp > 8, no: '스택이 모자랍니다',
        run: () => {
          hurt(8);
          const c = { id: newId(), r: 14, s: Math.floor(rnd() * 4), en: AD.pick(AD.ENCHANT_IDS, rnd) };
          S.deck = [...S.deck, c];
          return `${cardName(c)}을(를) 덱에 넣었다.`;
        },
      }],
    },
    {
      id: 'laundry', title: '카드 정리', text: '"필요 없는 카드 한 장, 무료로 빼 드립니다."',
      opts: [{
        label: '카드 1장 제거', ok: () => S.deck.length > MIN_DECK, no: `덱이 ${MIN_DECK}장 이하라 더 뺄 수 없습니다`,
        run: () => { ui.modal = { type: 'deck', purpose: 'remove', cost: 0, from: 'event' }; return null; },
      }],
    },
    {
      id: 'flip', title: '동전 던지기', text: '낯선 손님이 동전을 내민다. "앞면이면 상금 50, 뒷면이면 스택 8을 내놔."',
      opts: [{
        label: '던진다', ok: () => true,
        run: () => {
          if (rnd() < 0.5) { S.gold += 50; return '앞면. 상금 50을 받았다.'; }
          hurt(8);
          return '뒷면. 스택 8을 잃었다.';
        },
      }],
    },
    {
      id: 'retired', title: '은퇴한 딜러', text: '"카드 한 장 강화해 주지. 뭐가 될지는 나도 몰라."',
      opts: [{
        label: '카드 1장 강화', ok: () => S.deck.some((c) => !c.en), no: '강화 안 된 카드가 없습니다',
        run: () => { ui.modal = { type: 'deck', purpose: 'enchant', en: AD.pick(AD.ENCHANT_IDS, rnd), from: 'event' }; return null; },
      }],
    },
  ];
  const eventById = (id) => EVENTS.find((e) => e.id === id);

  /* ───────── 버튼 동작 ───────── */
  const ACT = {
    start() {
      if (!S && loadSave()) { ui.modal = { type: 'newrun' }; return; } // 진행 중인 도전을 덮어쓰기 전에 묻는다
      newRun();
    },
    startNew() { ui.modal = null; newRun(); },
    cont() { S = loadSave(); },
    mapSel(i) { ui.mapSel = +i; },
    go(i) {
      if (!choices().includes(+i)) return;
      S.path = [...S.path, +i];
      ui.mapSel = null;
      enterNode(S.map.rows[S.step][+i]);
    },
    wipeAsk() { ui.modal = { type: 'settings', confirm: true }; },
    wipe() {
      try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(PROFILE_KEY); } catch (e) { /* 저장이 막힌 브라우저: 지울 것도 없다 */ }
      P = { ...EMPTY_PROFILE };
      S = null;
      ui.modal = null;
      toast('저장 데이터를 지웠습니다');
    },
    sel(id) {
      const b = S.battle;
      if (b.phase !== 'pick') return;
      b.sel = b.sel.includes(id) ? b.sel.filter((x) => x !== id) : [...b.sel, id].slice(-2);
    },
    change() {
      const b = S.battle;
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
      const b = S.battle;
      if (b.sel.length !== 2) return toast('핸드는 2장입니다');
      b.hole = b.hand.filter((c) => b.sel.includes(c.id));
      S.stats.hands++;
      b.hole.filter((c) => c.en === 'eye').forEach(() => reveal(b));
      b.phase = 'bet';
      fx({ t: 'lock' });
    },
    check() { const b = S.battle; log(`${STREETS[b.street]} 체크`); fx({ t: 'check' }); nextStreet(b); },
    bet() { raise(S.battle, 1, false); },
    allin() { raise(S.battle, AD.ALLIN_ADD + (has('ring') ? 1 : 0), true); },
    fold() {
      const b = S.battle;
      const d = has('shoes') ? 0 : AD.foldDamage(b.pot);
      hurt(d);
      fx({ t: 'pfold', d, bust: S.hp <= 0 });
      endHand(b, { type: 'pfold', toPlayer: d }, `${STREETS[b.street]} 폴드 · 스택 −${d}`);
    },
    swapmode() {
      if (S.battle.changes < swapCost()) return toast(`보드 체인지는 체인지 ${swapCost()}이 필요합니다`);
      ui.swap = !ui.swap;
    },
    swap(i) {
      const b = S.battle;
      if (!ui.swap || b.phase !== 'bet' || b.changes < swapCost()) return;
      b.board = b.board.map((c, k) => (k === +i ? b.table[0] : c));
      b.table = b.table.slice(1);
      b.changes -= swapCost();
      ui.swap = false;
      readEnemy(b);
    },
    next() {
      if (S.hp <= 0) { S.screen = 'over'; return; }
      if (S.battle.enemy.hp <= 0) return winMatch();
      startHand();
    },
    takeCard(i) {
      const r = S.reward;
      if (r.cardDone) return;
      S.deck = [...S.deck, r.cards[+i]];
      S.reward = { ...r, cardDone: true, took: r.cards[+i].id };
      fx({ t: 'coin' });
    },
    takeCharm(id) {
      const r = S.reward;
      if (r.charmDone) return;
      gainCharm(id);
      S.reward = { ...r, charmDone: true, tookCharm: id };
      fx({ t: 'coin' });
    },
    leave() { advance(); },
    buyCard(i) {
      const item = S.shop.cards[+i];
      if (item.sold) return;
      if (S.gold < item.price) return toast('상금이 모자랍니다');
      S.gold -= item.price;
      fx({ t: 'coin' });
      S.deck = [...S.deck, item.card];
      S.shop = { ...S.shop, cards: S.shop.cards.map((x, k) => (k === +i ? { ...x, sold: true } : x)) };
    },
    buyCharm(i) {
      const item = S.shop.charms[+i];
      if (item.sold) return;
      if (S.gold < item.price) return toast('상금이 모자랍니다');
      S.gold -= item.price;
      fx({ t: 'coin' });
      gainCharm(item.id);
      S.shop = { ...S.shop, charms: S.shop.charms.map((x, k) => (k === +i ? { ...x, sold: true } : x)) };
    },
    removeOpen() {
      if (S.gold < S.removeCost) return toast('상금이 모자랍니다');
      if (S.deck.length <= MIN_DECK) return toast(`덱이 ${MIN_DECK}장 이하라 더 뺄 수 없습니다`);
      ui.modal = { type: 'deck', purpose: 'remove', cost: S.removeCost, from: 'shop' };
    },
    rest() { heal(Math.ceil(S.maxHp * 0.3)); advance(); },
    enchantOpen(en) {
      if (!S.deck.some((c) => !c.en)) return toast('강화 안 된 카드가 없습니다');
      ui.modal = { type: 'deck', purpose: 'enchant', en, from: 'rest' };
    },
    pickDeck(id) {
      const m = ui.modal;
      const card = S.deck.find((c) => c.id === id);
      if (!m || !card) return;
      ui.modal = null;
      if (m.purpose === 'remove') {
        S.deck = S.deck.filter((c) => c.id !== id);
        if (m.cost) { S.gold -= m.cost; S.removeCost += 25; }
        if (m.from === 'event') S.event = { ...S.event, done: `${cardName(card)}을(를) 덱에서 뺐다.` };
        else toast(`${cardName(card)} 제거`);
        return;
      }
      S.deck = S.deck.map((c) => (c.id === id ? { ...c, en: m.en } : c));
      const msg = `${cardName(card)}에 ${AD.ENCHANTS[m.en].name} 강화.`;
      if (m.from === 'event') S.event = { ...S.event, done: msg };
      else advance();
    },
    evt(i) {
      const opt = eventById(S.event.id).opts[+i];
      if (!opt.ok()) return toast(opt.no);
      const msg = opt.run();
      if (msg !== null) S.event = { ...S.event, done: msg };
    },
    modal(name) { ui.modal = { type: name }; },
    close() { ui.modal = null; },
    again() { S = null; },
    sound() { if (window.FX) FX.toggleSound(); },
    fast() { if (window.FX) FX.toggleFast(); },
    quitAsk() { ui.modal = { type: 'menu', confirm: true }; },
    quit() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 저장이 막힌 브라우저: 지울 저장도 없다 */ }
      S = null;
      ui.modal = null;
    },
  };

  app.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    ui.toast = '';
    ui.from = el.getBoundingClientRect();
    ACT[el.dataset.act](el.dataset.arg);
    if (S && S.hp <= 0 && S.screen !== 'battle') S.screen = 'over'; // 이벤트에서 스택을 다 잃은 경우
    if (S) save();
    saveProfile();
    render();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
  });

  /* ───────── 그리기 (카드·버튼·시트 조각은 views.js) ───────── */
  function topbar() {
    return `<header class="top">
      <div class="stat stack"><span class="lbl">스택</span><b class="num">${S.hp}<small>/${S.maxHp}</small></b>${bar(S.hp, S.maxHp, 'hp', 'me')}</div>
      <div class="stat gold"><span class="lbl">상금</span><b class="num">${S.gold}</b></div>
      <div class="stat"><span class="lbl">층</span><b class="num">${S.floor}<small>/${AD.FLOORS}</small></b></div>
      <div class="tools">${btn(`덱 ${S.deck.length}`, 'modal', 'deck', 'ghost sm')}${btn('메뉴', 'modal', 'menu', 'ghost sm')}</div>
      ${S.charms.length ? `<button class="charms" data-act="modal" data-arg="charms" aria-label="유물 ${S.charms.length}개: ${S.charms.map((id) => AD.CHARMS[id].name).join(', ')}">${S.charms.map((id) => `<span class="charm">${AD.CHARMS[id].name}</span>`).join('')}</button>` : ''}
    </header>`;
  }

  const vTitle = () => V.title(loadSave(), P);
  const vMap = () => V.map(S, choices(), ui.mapSel);

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
    const label = S.hp <= 0 ? '결과 보기' : b.enemy.hp <= 0 ? '보상 받기' : '다음 판';
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
    return AD.resolveShowdown({ pres, eres: { score: -1, cat: 0 }, hole, pot: b.pot, charms: S.charms, enemy: b.enemy }).toEnemy;
  }

  function vBattle() {
    const b = S.battle;
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

  // 덱빌딩 판단용: 아직 안 받은 카드는 넣으면 같은 숫자가 몇 장이 되는지, 받은 카드는 지금 몇 장인지
  function sameRank(c, taken) {
    const n = S.deck.filter((d) => d.r === c.r).length;
    return `<small class="same">${taken ? `덱에 ${AD.rankLabel(c.r)} ${n}장` : `넣으면 ${AD.rankLabel(c.r)} ${n + 1}장`}</small>`;
  }

  function charmCard(id, act, extra = '', disabled = false) {
    const c = AD.CHARMS[id];
    return `<button class="charmcard" data-act="${act}" data-arg="${id}"${disabled ? ' disabled' : ''}><b>${c.name}</b><span>${c.desc}</span>${extra}</button>`;
  }

  function vReward() {
    const r = S.reward;
    const cards = r.cards.map((c, i) => `<div class="offer${r.took === c.id ? ' taken' : ''}">
        ${cardHTML(c, r.cardDone ? {} : { act: 'takeCard', arg: i })}
        <small>${c.en ? AD.ENCHANTS[c.en].desc : '강화 없음'}</small>
        ${sameRank(c, r.took === c.id)}
      </div>`).join('');
    const charms = r.charms.length
      ? `<h3 class="sub">유물 1개</h3><div class="charmrow">${r.charms.map((id) => charmCard(id, 'takeCharm', r.tookCharm === id ? '<em>획득</em>' : '', r.charmDone)).join('')}</div>`
      : '';
    const done = r.cardDone && r.charmDone;
    return `<main class="screen reward">
      <p class="eyebrow">매치 승리</p>
      <h2 class="h">상금 +<span class="count num" data-n="${r.gold}">${r.gold}</span></h2>
      <h3 class="sub">덱에 넣을 카드 1장${r.cardDone ? ' · 선택함' : ''}</h3>
      <div class="offers">${cards}</div>
      ${charms}
      <div class="actions">${btn(done ? '계속' : '건너뛰고 계속', 'leave', undefined, done ? 'primary wide' : 'ghost wide')}</div>
    </main>`;
  }

  function vShop() {
    const sh = S.shop;
    const cards = sh.cards.map((x, i) => `<div class="offer${x.sold ? ' taken' : ''}">
        ${cardHTML(x.card, x.sold ? {} : { act: 'buyCard', arg: i })}
        <small>${x.card.en ? AD.ENCHANTS[x.card.en].desc : '강화 없음'}</small>
        ${sameRank(x.card, x.sold)}
        <b class="price num">${x.sold ? '구매함' : `${x.price}`}</b>
      </div>`).join('');
    const charms = sh.charms.map((x, i) => `<button class="charmcard" data-act="buyCharm" data-arg="${i}"${x.sold ? ' disabled' : ''}>
        <b>${AD.CHARMS[x.id].name}</b><span>${AD.CHARMS[x.id].desc}</span><em class="num">${x.sold ? '구매함' : `${x.price}`}</em></button>`).join('');
    return `<main class="screen shop">
      <p class="eyebrow">상점</p>
      <h2 class="h">카드와 유물</h2>
      <h3 class="sub">카드 · 누르면 구매</h3><div class="offers">${cards}</div>
      ${sh.charms.length ? `<h3 class="sub">유물</h3><div class="charmrow">${charms}</div>` : ''}
      <h3 class="sub">카드 제거</h3>
      <p class="note">덱이 얇을수록 좋은 카드가 자주 들어옵니다. 제거할 때마다 값이 25씩 오릅니다.</p>
      <div class="actions">${btn(`카드 제거 · ${S.removeCost}`, 'removeOpen', undefined, 'ghost')}${btn('나가기', 'leave', undefined, 'primary')}</div>
    </main>`;
  }

  function vRest() {
    const heal = Math.ceil(S.maxHp * 0.3);
    const offers = S.rest.offers.map((en) => `<button class="charmcard" data-act="enchantOpen" data-arg="${en}">
        <b><span class="seal seal-${en} inline">${AD.ENCHANTS[en].seal}</span>${AD.ENCHANTS[en].name} 강화</b><span>${AD.ENCHANTS[en].desc}</span></button>`).join('');
    return `<main class="screen rest">
      <p class="eyebrow">휴게실</p>
      <h2 class="h">하나만 고르세요.</h2>
      <div class="charmrow">
        <button class="charmcard" data-act="rest"><b>쉬기</b><span>스택 +${heal} (지금 ${S.hp}/${S.maxHp})</span></button>
        ${offers}
      </div>
      <p class="note">강화는 아직 강화되지 않은 카드에만 할 수 있습니다.</p>
    </main>`;
  }

  function vEvent() {
    const ev = eventById(S.event.id);
    const body = S.event.done
      ? `<p class="lead">${S.event.done}</p><div class="actions">${btn('계속', 'leave', undefined, 'primary wide')}</div>`
      : `<div class="actions">${ev.opts.map((o, i) => btn(o.label, 'evt', i, 'primary')).join('')}${btn('그냥 간다', 'leave', undefined, 'ghost')}</div>`;
    return `<main class="screen event">
      <p class="eyebrow">이벤트</p>
      <h2 class="h">${ev.title}</h2>
      <p class="lead">${ev.text}</p>
      ${body}
    </main>`;
  }

  function vEnd() {
    const won = S.screen === 'win';
    const st = S.stats;
    return `<main class="screen end">
      <p class="eyebrow">${won ? '하우스 정복' : '탈락'}</p>
      <h1 class="logo">${won ? '올인<br>성공' : '버스트'}</h1>
      <dl class="stats">
        <div><dt>도달</dt><dd>${S.floor}층</dd></div>
        <div><dt>이긴 매치</dt><dd class="num">${st.kills}</dd></div>
        <div><dt>쇼다운 승리 / 판</dt><dd class="num">${st.won}/${st.hands}</dd></div>
        <div><dt>최고 족보</dt><dd>${st.best >= 0 ? AD.HANDS[st.best].name : '없음'}</dd></div>
      </dl>
      <div class="actions">${btn('다시 도전', 'start', undefined, 'primary')}${btn('처음 화면', 'again', undefined, 'ghost')}</div>
    </main>`;
  }

  // 열린 시트를 고른다. 판 상태가 필요한 시트는 판이 없으면 그리지 않는다.
  function vModal() {
    const m = ui.modal;
    if (!m) return '';
    const sh = V.sheets;
    const run = {
      menu: () => sh.menu(m, S),
      charms: () => sh.charms(S),
      enemy: () => (S.battle ? sh.enemy(S) : ''),
      deck: () => sh.deck(m, S),
    };
    const any = {
      howto: () => sh.howto(),
      codex: () => sh.codex(P),
      records: () => sh.records(P),
      settings: () => sh.settings(m),
      newrun: () => { const saved = loadSave(); return saved ? sh.newRunConfirm(saved) : ''; },
    };
    const make = (S && run[m.type]) || any[m.type];
    const body = make ? make() : '';
    return body ? V.sheet(body) : '';
  }

  // 배경 그림: 화면 종류가 바뀔 때만 갈아 끼운다(같은 화면에서 다시 그려도 등불 연출이 끊기지 않게)
  const SCENE_OF = { title: 'title', over: 'title', win: 'title', battle: 'table', reward: 'table' };
  function setScene(screen) {
    const el = document.getElementById('scene');
    const kind = SCENE_OF[screen] || 'hall';
    if (!el || !window.SCENES || el.dataset.kind === kind) return;
    el.dataset.kind = kind;
    el.className = `scene scene-${kind}`;
    el.innerHTML = window.SCENES[kind];
  }

  // 다시 그려도 키보드 포커스가 제자리에 있게: 누른 버튼을 기억했다가 같은 버튼으로 돌려놓는다
  function focusKey() {
    const el = document.activeElement;
    if (!el || !app.contains(el) || !el.dataset.act) return null;
    const arg = el.dataset.arg !== undefined ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-act="${CSS.escape(el.dataset.act)}"]${arg}`;
  }

  function render() {
    const screen = S ? S.screen : 'title';
    const changed = screen !== ui.screen;
    if (changed) ui.modal = null; // 화면이 바뀌면 열려 있던 시트는 닫는다
    if (changed) setScene(screen);
    const keep = focusKey();
    const hadModal = !!app.querySelector('.modal');
    const view = !S ? vTitle() : { map: vMap, battle: vBattle, reward: vReward, shop: vShop, rest: vRest, event: vEvent, over: vEnd, win: vEnd }[S.screen]();
    const top = S && S.screen !== 'over' && S.screen !== 'win' ? topbar() : '';
    const sheet = vModal();
    // 시트가 열린 동안 뒤 화면은 inert — 마우스도 Tab 도 닿지 않는다
    app.innerHTML = `<div class="under"${sheet ? ' inert' : ''}>${top}${view}</div>${sheet}${ui.toast ? `<div class="toast" role="status">${ui.toast}</div>` : ''}`;
    const target = sheet && !hadModal ? app.querySelector('.sheet button') : keep && app.querySelector(keep);
    if (target) target.focus({ preventScroll: true });
    ui.screen = screen;
    try {
      if (window.FX) FX.run(ui.fx, { changed, screen, from: ui.from });
    } catch (e) {
      console.error('연출 실패 — 게임은 계속:', e); // 연출만 빠지고 상태·화면은 이미 그려졌다
    } finally {
      ui.fx = [];
      ui.from = null;
    }
  }

  // 아티팩트 뷰어가 새 버전을 받아도 판이 이어지게. 형식이 다른 옛 상태는 버린다.
  window.claude?.hot?.snapshot?.(() => ({ S }));
  const boot = (data) => { S = data && isState(data.S) ? data.S : null; render(); };
  if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
  else boot(window.claude?.hot?.data ?? {});
})();
