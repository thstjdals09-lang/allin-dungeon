/* 올인 던전 — 진행과 화면. 규칙은 logic.js 의 전역 AD. */
(function () {
  'use strict';
  const SAVE_KEY = 'allin-dungeon-v1';
  const START_HP = 70;
  const MIN_DECK = 8;
  const app = document.getElementById('app');
  const rnd = Math.random;

  let S = null; // 판 전체 상태 (JSON 으로 저장)
  let ui = { modal: null, swap: false, toast: '' }; // 저장하지 않는 화면 상태
  const seen = new Set(); // 이미 그린 카드 id — 딜 애니메이션을 한 번만

  const has = (k) => S.charms.includes(k);
  const newId = () => 'c' + S.nextId++;
  const cardName = (c) => `${AD.SUITS[c.s]}${AD.rankLabel(c.r)}${c.en ? ` (${AD.ENCHANTS[c.en].name})` : ''}`;
  const toast = (msg) => { ui.toast = msg; };

  /* ───────── 저장 ───────── */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장이 막힌 브라우저: 진행은 계속, 새로고침하면 처음부터 */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return s && s.screen !== 'over' && s.screen !== 'win' ? s : null;
    } catch (e) { return null; }
  }

  /* ───────── 진행 ───────── */
  function newRun() {
    S = {
      screen: 'map', hp: START_HP, maxHp: START_HP, gold: 40, deck: [], charms: [],
      floor: 1, step: 0, node: null, choices: AD.mapChoices(0, rnd), removeCost: 50, nextId: 0,
      stats: { hands: 0, won: 0, best: -1, kills: 0 },
    };
    S.deck = AD.starterDeck(newId, rnd);
  }

  function advance() {
    if (S.node === 'boss') {
      if (S.floor === AD.FLOORS) { S.screen = 'win'; return; }
      S.floor++;
      S.step = 0;
    } else S.step++;
    S.node = null;
    S.choices = AD.mapChoices(S.step, rnd);
    S.screen = 'map';
  }

  function hurt(n) { S.hp = Math.max(0, S.hp - n); }
  function heal(n) { S.hp = Math.min(S.maxHp, S.hp + n); }
  function gainCharm(id) {
    S.charms = [...S.charms, id];
    if (id === 'pact') { S.maxHp -= 12; S.hp = Math.min(S.hp, S.maxHp); }
  }

  function enterNode(type) {
    S.node = type;
    if (type === 'fight' || type === 'elite' || type === 'boss') return startBattle(type);
    if (type === 'shop') return openShop();
    if (type === 'rest') { S.rest = { offers: AD.shuffle(AD.ENCHANT_IDS, rnd).slice(0, 2) }; S.screen = 'rest'; return; }
    S.event = { id: AD.pick(EVENTS, rnd).id, done: null };
    S.screen = 'event';
  }

  /* ───────── 전투 ───────── */
  function startBattle(kind) {
    const e = AD.pickEnemy(S.floor, kind === 'fight' ? 'normal' : kind, rnd);
    S.battle = { enemy: { ...e, maxHp: e.hp }, draw: AD.shuffle(S.deck, rnd), discard: [], hand: [], handNo: 0, log: [] };
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

  function log(msg) { S.battle.log = [msg, ...S.battle.log].slice(0, 6); }

  function startHand() {
    const b = S.battle;
    b.discard = [...b.discard, ...b.hand];
    b.hand = [];
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
    b.mult = 1;
    b.sleight = 2 + (has('coin') ? 1 : 0);
    b.str = AD.strength(b.ehole, b.board);
    b.tell = AD.tellOf(b.enemy, b.str, rnd);
    b.result = null;
    b.phase = 'pick';
    ui.swap = false;
    if (has('mirror')) reveal(b);
  }

  function winBattle() {
    const kind = S.node;
    const gold = { fight: 16, elite: 32, boss: 55 }[kind] + Math.floor(rnd() * 9) + (has('tooth') ? 15 : 0);
    S.gold += gold;
    if (has('bandage')) heal(6);
    if (kind === 'boss') heal(Math.round(S.maxHp * 0.4));
    S.stats.kills++;
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
      id: 'vending', title: '칩 먹는 자판기', text: '동전 대신 칩을 먹는 낡은 자판기다. 가끔 부적이 굴러나온다는 소문이 있다.',
      opts: [{
        label: '칩 30을 넣는다', ok: () => S.gold >= 30, no: '칩이 모자랍니다',
        run: () => {
          S.gold -= 30;
          const [c] = AD.randomCharms(1, S.charms, rnd);
          if (!c) return '덜컹거리기만 하고 아무것도 나오지 않았다.';
          gainCharm(c);
          return `덜컹. ${AD.CHARMS[c].name}이(가) 굴러나왔다.`;
        },
      }],
    },
    {
      id: 'ace', title: '피 묻은 에이스', text: '테이블 밑, 깨진 유리 사이에 A 한 장이 끼어 있다. 각인이 희미하게 빛난다.',
      opts: [{
        label: '체력 8을 내고 줍는다', ok: () => S.hp > 8, no: '체력이 모자랍니다',
        run: () => {
          hurt(8);
          const c = { id: newId(), r: 14, s: Math.floor(rnd() * 4), en: AD.pick(AD.ENCHANT_IDS, rnd) };
          S.deck = [...S.deck, c];
          return `${cardName(c)}을(를) 덱에 넣었다.`;
        },
      }],
    },
    {
      id: 'laundry', title: '카드 세탁소', text: '"필요 없는 카드 한 장, 공짜로 지워 드립니다."',
      opts: [{
        label: '카드 1장 없애기', ok: () => S.deck.length > MIN_DECK, no: `덱이 ${MIN_DECK}장 이하라 더 버릴 수 없습니다`,
        run: () => { ui.modal = { type: 'deck', purpose: 'remove', cost: 0, from: 'event' }; return null; },
      }],
    },
    {
      id: 'flip', title: '동전 던지기', text: '낯선 손님이 동전을 내민다. "앞면이면 칩 50, 뒷면이면 피 좀 보자고."',
      opts: [{
        label: '던진다', ok: () => true,
        run: () => {
          if (rnd() < 0.5) { S.gold += 50; return '앞면. 칩 50을 받았다.'; }
          hurt(8);
          return '뒷면. 체력 8을 잃었다.';
        },
      }],
    },
    {
      id: 'retired', title: '은퇴한 딜러', text: '"손 좀 보여 줘. 카드 한 장 다듬어 주지." 무슨 각인일지는 그 사람 마음이다.',
      opts: [{
        label: '카드 1장에 각인 받기', ok: () => S.deck.some((c) => !c.en), no: '각인 없는 카드가 없습니다',
        run: () => { ui.modal = { type: 'deck', purpose: 'enchant', en: AD.pick(AD.ENCHANT_IDS, rnd), from: 'event' }; return null; },
      }],
    },
  ];
  const eventById = (id) => EVENTS.find((e) => e.id === id);

  /* ───────── 버튼 동작 ───────── */
  const ACT = {
    start() { newRun(); },
    cont() { S = loadSave(); },
    node(t) { enterNode(t); },
    sel(id) {
      const b = S.battle;
      if (b.phase !== 'pick') return;
      b.sel = b.sel.includes(id) ? b.sel.filter((x) => x !== id) : [...b.sel, id].slice(-2);
    },
    redraw() {
      const b = S.battle;
      const n = b.sel.length;
      if (!n) return toast('다시 뽑을 카드를 먼저 고르세요');
      if (n > b.sleight) return toast(`손기술이 ${b.sleight} 남았습니다`);
      const fresh = drawCards(b, n); // 먼저 뽑고 버려야 방금 버린 카드가 바로 돌아오지 않는다
      if (!fresh.length) return toast('더 뽑을 카드가 없습니다');
      const out = b.sel.slice(0, fresh.length);
      b.discard = [...b.discard, ...b.hand.filter((c) => out.includes(c.id))];
      b.hand = b.hand.map((c) => (out.includes(c.id) ? fresh[out.indexOf(c.id)] : c));
      b.sleight -= fresh.length;
      b.sel = [];
    },
    lock() {
      const b = S.battle;
      if (b.sel.length !== 2) return toast('홀카드는 정확히 2장입니다');
      b.hole = b.hand.filter((c) => b.sel.includes(c.id));
      S.stats.hands++;
      const gold = 5 * b.hole.filter((c) => c.en === 'gold').length;
      if (gold) { S.gold += gold; log(`황금 각인으로 칩 +${gold}`); }
      b.hole.filter((c) => c.en === 'eye').forEach(() => reveal(b));
      b.phase = 'bet';
    },
    fold() {
      const b = S.battle;
      const d = has('shoes') ? 0 : AD.ANTE;
      hurt(d);
      b.result = { type: 'pfold', toPlayer: d };
      log(`접었다. 체력 −${d}`);
      b.phase = 'end';
    },
    bet(m) {
      const b = S.battle;
      b.mult = +m === 3 && has('ring') ? 4 : +m;
      if (AD.enemyFolds(b.enemy, b.str, b.mult, has('face') ? 1.25 : 1, rnd)) {
        const d = AD.foldDamage(b.mult);
        b.enemy.hp -= d;
        b.shown = b.shown.map(() => true);
        b.result = { type: 'efold', toEnemy: d };
        log(`${b.enemy.name}이(가) 접었다. 상대 −${d}`);
        b.phase = 'end';
        return;
      }
      b.board = [...b.board, ...b.table.slice(0, 2)];
      b.table = b.table.slice(2);
      b.phase = 'river';
    },
    swapmode() {
      const cost = has('bribe') ? 1 : 2;
      if (S.battle.sleight < cost) return toast(`바꿔치기는 손기술 ${cost}이 필요합니다`);
      ui.swap = !ui.swap;
    },
    swap(i) {
      const b = S.battle;
      const cost = has('bribe') ? 1 : 2;
      if (!ui.swap || b.phase !== 'river' || b.sleight < cost) return;
      b.board = b.board.map((c, k) => (k === +i ? b.table[0] : c));
      b.table = b.table.slice(1);
      b.sleight -= cost;
      ui.swap = false;
    },
    show() {
      const b = S.battle;
      const pres = AD.best([...b.hole, ...b.board]);
      const eres = AD.best([...b.ehole, ...b.board]);
      const out = AD.resolveShowdown({ pres, eres, hole: b.hole, mult: b.mult, charms: S.charms, enemy: b.enemy });
      b.shown = b.shown.map(() => true);
      b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp - out.toEnemy + out.enemyHeal);
      hurt(out.toPlayer);
      heal(out.heal);
      S.stats.best = Math.max(S.stats.best, pres.cat);
      if (out.winner > 0) S.stats.won++;
      b.result = {
        type: 'show', ...out, pdesc: AD.describe(pres), edesc: AD.describe(eres),
        used: pres.cards.map((c) => c.id), eused: eres.cards.map((c) => c.id),
      };
      const verdict = out.winner > 0 ? `상대 −${out.toEnemy}` : out.winner < 0 ? `체력 −${out.toPlayer}` : '비김';
      log(`${b.result.pdesc} vs ${b.result.edesc} → ${verdict}`);
      ui.swap = false;
      b.phase = 'end';
    },
    next() {
      if (S.hp <= 0) { S.screen = 'over'; return; }
      if (S.battle.enemy.hp <= 0) return winBattle();
      startHand();
    },
    takeCard(i) {
      const r = S.reward;
      if (r.cardDone) return;
      S.deck = [...S.deck, r.cards[+i]];
      S.reward = { ...r, cardDone: true, took: r.cards[+i].id };
    },
    takeCharm(id) {
      const r = S.reward;
      if (r.charmDone) return;
      gainCharm(id);
      S.reward = { ...r, charmDone: true, tookCharm: id };
    },
    leave() { advance(); },
    buyCard(i) {
      const item = S.shop.cards[+i];
      if (item.sold) return;
      if (S.gold < item.price) return toast('칩이 모자랍니다');
      S.gold -= item.price;
      S.deck = [...S.deck, item.card];
      S.shop = { ...S.shop, cards: S.shop.cards.map((x, k) => (k === +i ? { ...x, sold: true } : x)) };
    },
    buyCharm(i) {
      const item = S.shop.charms[+i];
      if (item.sold) return;
      if (S.gold < item.price) return toast('칩이 모자랍니다');
      S.gold -= item.price;
      gainCharm(item.id);
      S.shop = { ...S.shop, charms: S.shop.charms.map((x, k) => (k === +i ? { ...x, sold: true } : x)) };
    },
    removeOpen() {
      if (S.gold < S.removeCost) return toast('칩이 모자랍니다');
      if (S.deck.length <= MIN_DECK) return toast(`덱이 ${MIN_DECK}장 이하라 더 버릴 수 없습니다`);
      ui.modal = { type: 'deck', purpose: 'remove', cost: S.removeCost, from: 'shop' };
    },
    rest() { heal(Math.ceil(S.maxHp * 0.3)); advance(); },
    enchantOpen(en) {
      if (!S.deck.some((c) => !c.en)) return toast('각인 없는 카드가 없습니다');
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
        if (m.from === 'event') S.event = { ...S.event, done: `${cardName(card)}을(를) 덱에서 지웠다.` };
        else toast(`${cardName(card)}을(를) 버렸습니다`);
        return;
      }
      S.deck = S.deck.map((c) => (c.id === id ? { ...c, en: m.en } : c));
      const msg = `${cardName(card)}에 ${AD.ENCHANTS[m.en].name} 각인을 새겼다.`;
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
    charm(id) { toast(`${AD.CHARMS[id].name} — ${AD.CHARMS[id].desc}`); },
    again() { S = null; },
  };

  app.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    ui.toast = '';
    ACT[el.dataset.act](el.dataset.arg);
    if (S && S.hp <= 0 && S.screen !== 'battle') S.screen = 'over'; // 이벤트에서 쓰러진 경우
    if (S) save();
    render();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
  });

  /* ───────── 그리기 ───────── */
  function cardHTML(c, o = {}) {
    const fresh = !o.still && !seen.has(c.id);
    seen.add(c.id);
    const cls = ['card', c.s === 1 || c.s === 2 ? 'red' : 'black', o.sel && 'sel', o.used && 'used', o.dim && 'dim', o.swap && 'swappable', fresh && 'deal']
      .filter(Boolean).join(' ');
    const en = c.en ? `<span class="seal seal-${c.en}">${AD.ENCHANTS[c.en].seal}</span>` : '';
    const inner = `<span class="rk">${AD.rankLabel(c.r)}</span><span class="st">${AD.SUITS[c.s]}</span>${en}`;
    const label = cardName(c);
    if (!o.act) return `<div class="${cls}" role="img" aria-label="${label}">${inner}</div>`;
    return `<button class="${cls}" data-act="${o.act}" data-arg="${o.arg ?? c.id}" aria-label="${label}" aria-pressed="${!!o.sel}">${inner}</button>`;
  }
  const backHTML = () => '<div class="card back" role="img" aria-label="엎어 둔 카드"></div>';
  const slotHTML = () => '<div class="card slot" aria-hidden="true"></div>';
  const btn = (label, act, arg, cls = '', disabled = false) =>
    `<button class="btn ${cls}" data-act="${act}"${arg !== undefined ? ` data-arg="${arg}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
  const bar = (v, max, cls) => `<span class="bar ${cls}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.max(0, v)}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></span>`;

  function topbar() {
    return `<header class="top">
      <div class="stat"><span class="lbl">체력</span><b class="num">${S.hp}<small>/${S.maxHp}</small></b>${bar(S.hp, S.maxHp, 'hp')}</div>
      <div class="stat"><span class="lbl">칩</span><b class="num">${S.gold}</b></div>
      <div class="stat"><span class="lbl">지하</span><b class="num">${S.floor}<small>층</small></b></div>
      <div class="tools">${btn(`덱 ${S.deck.length}`, 'modal', 'deck', 'ghost sm')}${btn('족보', 'modal', 'rules', 'ghost sm')}</div>
      ${S.charms.length ? `<div class="charms" aria-label="부적">${S.charms.map((id) => `<button class="charm" data-act="charm" data-arg="${id}" title="${AD.CHARMS[id].name} — ${AD.CHARMS[id].desc}">${AD.CHARMS[id].name}</button>`).join('')}</div>` : ''}
    </header>`;
  }

  function vTitle() {
    const saved = loadSave();
    return `<main class="screen title">
      <p class="eyebrow">지하 카지노 · 3개 층</p>
      <h1 class="logo">올인<br>던전</h1>
      <p class="lead">내 덱에서 홀카드 두 장, 테이블에 다섯 장. 이긴 족보만큼 상대 체력이 깎인다. 카드를 모으고, 버리고, 각인을 새겨 세 층 아래 하우스의 주인까지 내려가라.</p>
      <div class="row">${btn('새로 시작', 'start', undefined, 'primary')}${saved ? btn(`이어 하기 · 지하 ${saved.floor}층`, 'cont') : ''}</div>
      <ol class="howto">
        <li><b>플롭이 깔린다.</b> 손패 5장 중 홀카드 2장을 고른다. 손기술로 다시 뽑을 수 있다.</li>
        <li><b>판돈을 건다.</b> 상대 표정을 보고 체크 ×1, 레이즈 ×2, 올인 ×3. 판돈이 크면 상대가 접기도 한다.</li>
        <li><b>턴·리버가 깔린다.</b> 손기술 2로 테이블 카드 한 장을 바꿔칠 수 있다.</li>
        <li><b>쇼다운.</b> 진 쪽이 족보 피해 × 판돈만큼 체력을 잃는다.</li>
      </ol>
    </main>`;
  }

  function vMap() {
    const dots = Array.from({ length: AD.STEPS + 1 }, (_, i) => {
      const cls = [i < S.step && 'done', i === S.step && 'now', i === AD.STEPS && 'boss'].filter(Boolean).join(' ');
      return `<li class="${cls}"><span>${i === AD.STEPS ? '주인' : i + 1}</span></li>`;
    }).join('');
    const nodes = S.choices.map((t) => `<button class="node node-${t}" data-act="node" data-arg="${t}"><b>${AD.NODES[t].name}</b><span>${AD.NODES[t].desc}</span></button>`).join('');
    return `<main class="screen map">
      <h2 class="h">지하 ${S.floor}층</h2>
      <ol class="track" aria-label="층 진행">${dots}</ol>
      <p class="lead">${S.step === AD.STEPS ? '층 주인이 기다린다.' : '어느 문으로 들어갈까?'}</p>
      <div class="nodes">${nodes}</div>
    </main>`;
  }

  function enemyPanel(b) {
    const e = b.enemy;
    const tags = [
      e.hole === 3 && '홀카드 3장',
      e.armor && `방어 ${e.armor}`,
      e.heal && `이기면 회복 ${e.heal}`,
      e.mul !== 1 && `피해 ×${e.mul}`,
      !e.tight && '절대 안 접음',
    ].filter(Boolean).map((t) => `<li>${t}</li>`).join('');
    const kind = { normal: '', elite: '<em class="kind">하이롤러</em>', boss: '<em class="kind boss">층 주인</em>' }[e.kind];
    let tell = '';
    if (b.phase === 'pick' || b.phase === 'bet') {
      tell = b.tell < 0
        ? '<p class="tell"><b>무표정</b> 속을 알 수 없다</p>'
        : `<p class="tell t${b.tell}"><b>${AD.TELLS[b.tell].mood}</b> ${AD.TELLS[b.tell].text}</p>`;
    }
    const hit = b.result && b.result.toEnemy ? ' hit' : '';
    return `<section class="enemy${hit}">
      <div class="medal" aria-hidden="true">${e.glyph}</div>
      <div class="who">
        <h2>${e.name} ${kind}</h2>
        <div class="hpline">${bar(e.hp, e.maxHp, 'ehp')}<b class="num">${Math.max(0, e.hp)}<small>/${e.maxHp}</small></b></div>
        <ul class="tags">${tags}</ul>
      </div>
      <div class="ehole">${b.ehole.map((c, i) => (b.shown[i] ? cardHTML(c, { used: b.result && b.result.eused && b.result.eused.includes(c.id) }) : backHTML())).join('')}</div>
      ${tell}
    </section>`;
  }

  function resultLine(b) {
    const r = b.result;
    if (r.type === 'pfold') return `<p class="result lose">접었습니다 · 체력 −${r.toPlayer}</p>`;
    if (r.type === 'efold') return `<p class="result win">상대가 판돈을 못 받고 접었습니다 · 상대 −${r.toEnemy}</p>`;
    const vs = `내 <b>${r.pdesc}</b> 대 상대 <b>${r.edesc}</b>`;
    if (r.winner > 0) return `<p class="result win">승리 · ${vs} · 상대 −${r.toEnemy}${r.heal ? ` · 체력 +${r.heal}` : ''}</p>`;
    if (r.winner < 0) return `<p class="result lose">패배 · ${vs} · 체력 −${r.toPlayer}${r.enemyHeal ? ` · 상대 회복 ${r.enemyHeal}` : ''}</p>`;
    return `<p class="result">둘 다 <b>${r.pdesc}</b> · 비겼습니다</p>`;
  }

  function vBattle() {
    const b = S.battle;
    const used = b.result && b.result.used ? b.result.used : [];
    const swapCost = has('bribe') ? 1 : 2;
    const board = [
      ...b.board.map((c, i) => cardHTML(c, ui.swap ? { act: 'swap', arg: i, swap: true } : { used: used.includes(c.id) })),
      ...Array(5 - b.board.length).fill(slotHTML()),
    ].join('');
    const inHole = (c) => b.hole.some((h) => h.id === c.id);
    const hand = b.hand.map((c) => (b.phase === 'pick'
      ? cardHTML(c, { act: 'sel', sel: b.sel.includes(c.id) })
      : cardHTML(c, { sel: inHole(c), dim: !inHole(c), used: used.includes(c.id) }))).join('');

    const holeNow = b.phase === 'pick' ? b.hand.filter((c) => b.sel.includes(c.id)) : b.hole;
    const now = holeNow.length === 2 && b.phase !== 'end' ? AD.describe(AD.best([...holeNow, ...b.board])) : '';
    const pips = Array.from({ length: 2 + (has('coin') ? 1 : 0) }, (_, i) => `<i class="${i < b.sleight ? 'on' : ''}"></i>`).join('');
    const status = `<div class="status">
      <span class="pips" aria-label="손기술 ${b.sleight} 남음"><span class="lbl">손기술</span>${pips}</span>
      ${b.phase !== 'pick' ? `<span class="lbl">판돈 <b class="num">×${b.mult}</b></span>` : ''}
      ${now ? `<span class="now">지금 내 패 <b>${now}</b></span>` : ''}
    </div>`;

    const allin = has('ring') ? 4 : 3;
    let hint = '', actions = '';
    if (b.phase === 'pick') {
      hint = '손패에서 홀카드 2장을 고르세요. 고른 카드를 손기술 1씩 내고 다시 뽑을 수도 있습니다.';
      actions = btn(`다시 뽑기 · 손기술 ${b.sel.length || 0}`, 'redraw', undefined, 'ghost', !b.sel.length || b.sel.length > b.sleight)
        + btn('이 두 장으로', 'lock', undefined, 'primary', b.sel.length !== 2);
    } else if (b.phase === 'bet') {
      hint = '판돈을 정하세요. 레이즈·올인을 걸면 패가 약한 상대는 접기도 합니다.';
      actions = `<div class="chips">
        <button class="chip c1" data-act="bet" data-arg="1"><b>×1</b><span>체크</span></button>
        <button class="chip c2" data-act="bet" data-arg="2"><b>×2</b><span>레이즈</span></button>
        <button class="chip c3" data-act="bet" data-arg="3"><b>×${allin}</b><span>올인</span></button>
      </div>${btn(`접기 · 체력 −${has('shoes') ? 0 : AD.ANTE}`, 'fold', undefined, 'ghost')}`;
    } else if (b.phase === 'river') {
      hint = ui.swap ? '바꿀 테이블 카드를 누르세요.' : '턴과 리버가 깔렸습니다. 마음에 안 드는 테이블 카드는 바꿔칠 수 있습니다.';
      actions = btn(ui.swap ? '바꿔치기 취소' : `바꿔치기 · 손기술 ${swapCost}`, 'swapmode', undefined, 'ghost', !ui.swap && b.sleight < swapCost)
        + btn('쇼다운', 'show', undefined, 'primary');
    } else {
      const label = S.hp <= 0 ? '결과 보기' : b.enemy.hp <= 0 ? '보상 받기' : '다음 핸드';
      actions = btn(label, 'next', undefined, 'primary');
    }

    return `<main class="screen battle">
      ${enemyPanel(b)}
      <section class="board${ui.swap ? ' swapping' : ''}" aria-label="테이블"><div class="cards">${board}</div></section>
      ${b.phase === 'end' ? resultLine(b) : `<p class="hint">${hint}</p>`}
      ${status}
      <section class="hand" aria-label="내 손패"><div class="cards">${hand}</div></section>
      <div class="actions">${actions}</div>
      ${b.log.length ? `<ol class="log" aria-label="기록">${b.log.map((l) => `<li>${l}</li>`).join('')}</ol>` : ''}
    </main>`;
  }

  function charmCard(id, act, extra = '', disabled = false) {
    const c = AD.CHARMS[id];
    return `<button class="charmcard" data-act="${act}" data-arg="${id}"${disabled ? ' disabled' : ''}><b>${c.name}</b><span>${c.desc}</span>${extra}</button>`;
  }

  function vReward() {
    const r = S.reward;
    const cards = r.cards.map((c, i) => `<div class="offer${r.took === c.id ? ' taken' : ''}">
        ${cardHTML(c, r.cardDone ? {} : { act: 'takeCard', arg: i })}
        ${c.en ? `<small>${AD.ENCHANTS[c.en].desc}</small>` : '<small>각인 없음</small>'}
      </div>`).join('');
    const charms = r.charms.length
      ? `<h3 class="sub">부적 하나</h3><div class="charmrow">${r.charms.map((id) => charmCard(id, 'takeCharm', r.tookCharm === id ? '<em>가져감</em>' : '', r.charmDone)).join('')}</div>`
      : '';
    return `<main class="screen reward">
      <p class="eyebrow">승리</p>
      <h2 class="h">칩 +${r.gold}</h2>
      <h3 class="sub">덱에 넣을 카드 한 장 ${r.cardDone ? '· 골랐음' : ''}</h3>
      <div class="offers">${cards}</div>
      ${charms}
      <div class="row">${btn(r.cardDone && r.charmDone ? '계속' : '남은 보상 두고 계속', 'leave', undefined, r.cardDone && r.charmDone ? 'primary' : 'ghost')}</div>
    </main>`;
  }

  function vShop() {
    const sh = S.shop;
    const cards = sh.cards.map((x, i) => `<div class="offer${x.sold ? ' taken' : ''}">
        ${cardHTML(x.card, x.sold ? {} : { act: 'buyCard', arg: i })}
        <small>${x.card.en ? AD.ENCHANTS[x.card.en].desc : '각인 없음'}</small>
        <b class="price num">${x.sold ? '팔림' : `칩 ${x.price}`}</b>
      </div>`).join('');
    const charms = sh.charms.map((x, i) => `<button class="charmcard" data-act="buyCharm" data-arg="${i}"${x.sold ? ' disabled' : ''}>
        <b>${AD.CHARMS[x.id].name}</b><span>${AD.CHARMS[x.id].desc}</span><em class="num">${x.sold ? '팔림' : `칩 ${x.price}`}</em></button>`).join('');
    return `<main class="screen shop">
      <p class="eyebrow">암시장</p>
      <h2 class="h">"현금만 받아."</h2>
      <h3 class="sub">카드</h3><div class="offers">${cards}</div>
      ${sh.charms.length ? `<h3 class="sub">부적</h3><div class="charmrow">${charms}</div>` : ''}
      <h3 class="sub">카드 버리기</h3>
      <p class="note">덱이 얇을수록 좋은 카드가 자주 손에 들어온다. 버릴 때마다 값이 25씩 오른다.</p>
      <div class="row">${btn(`카드 1장 버리기 · 칩 ${S.removeCost}`, 'removeOpen', undefined, 'ghost')}${btn('나가기', 'leave', undefined, 'primary')}</div>
    </main>`;
  }

  function vRest() {
    const heal = Math.ceil(S.maxHp * 0.3);
    const offers = S.rest.offers.map((en) => `<button class="charmcard" data-act="enchantOpen" data-arg="${en}">
        <b><span class="seal seal-${en} inline">${AD.ENCHANTS[en].seal}</span> ${AD.ENCHANTS[en].name} 각인</b><span>${AD.ENCHANTS[en].desc}</span></button>`).join('');
    return `<main class="screen rest">
      <p class="eyebrow">흡연실</p>
      <h2 class="h">연기 속에서 한숨 돌린다.</h2>
      <div class="charmrow">
        <button class="charmcard" data-act="rest"><b>쉰다</b><span>체력 ${heal} 회복 (지금 ${S.hp}/${S.maxHp})</span></button>
        ${offers}
      </div>
      <p class="note">각인은 하나만 고를 수 있고, 각인 없는 카드에만 새길 수 있다.</p>
    </main>`;
  }

  function vEvent() {
    const ev = eventById(S.event.id);
    const body = S.event.done
      ? `<p class="lead">${S.event.done}</p><div class="row">${btn('계속', 'leave', undefined, 'primary')}</div>`
      : `<div class="row">${ev.opts.map((o, i) => btn(o.label, 'evt', i, 'primary')).join('')}${btn('지나간다', 'leave', undefined, 'ghost')}</div>`;
    return `<main class="screen event">
      <p class="eyebrow">뒷골목</p>
      <h2 class="h">${ev.title}</h2>
      <p class="lead">${ev.text}</p>
      ${body}
    </main>`;
  }

  function vEnd() {
    const won = S.screen === 'win';
    const st = S.stats;
    return `<main class="screen end">
      <p class="eyebrow">${won ? '하우스 정복' : '파산'}</p>
      <h1 class="logo">${won ? '올인<br>성공' : '체력이<br>바닥났다'}</h1>
      <dl class="stats">
        <div><dt>도달</dt><dd>지하 ${S.floor}층</dd></div>
        <div><dt>쓰러뜨린 상대</dt><dd class="num">${st.kills}</dd></div>
        <div><dt>이긴 쇼다운</dt><dd class="num">${st.won}/${st.hands}</dd></div>
        <div><dt>최고 족보</dt><dd>${st.best >= 0 ? AD.HANDS[st.best].name : '없음'}</dd></div>
      </dl>
      <div class="row">${btn('다시 도전', 'start', undefined, 'primary')}${btn('처음 화면', 'again', undefined, 'ghost')}</div>
    </main>`;
  }

  function vModal() {
    const m = ui.modal;
    if (!m) return '';
    let body = '';
    if (m.type === 'rules') {
      body = `<h2 class="h">족보와 피해</h2>
        <table class="ranks"><thead><tr><th>족보</th><th>기본 피해</th></tr></thead><tbody>
        ${AD.HANDS.map((h) => `<tr><td>${h.name}</td><td class="num">${h.dmg}</td></tr>`).slice().reverse().join('')}
        <tr><td>로열 플러시</td><td class="num">+${AD.ROYAL_BONUS}</td></tr></tbody></table>
        <p class="note">피해 = 족보 피해 × 판돈(체크 ×1 · 레이즈 ×2 · 올인 ×3). 상대가 이기면 상대 피해 배수가 붙는다. 내 덱 카드는 테이블 카드와 겹칠 수 있어서 파이브카드도 나온다.</p>
        <h3 class="sub">각인</h3>
        <ul class="enlist">${AD.ENCHANT_IDS.map((k) => `<li><span class="seal seal-${k} inline">${AD.ENCHANTS[k].seal}</span><b>${AD.ENCHANTS[k].name}</b> ${AD.ENCHANTS[k].desc}</li>`).join('')}</ul>
        <p class="note">각인 효과는 홀카드로 고른 카드에만 붙는다.</p>`;
    } else {
      const picking = m.purpose;
      const list = S.deck.slice().sort((a, b) => b.r - a.r || a.s - b.s)
        .map((c) => (picking && !(picking === 'enchant' && c.en) ? cardHTML(c, { act: 'pickDeck', still: true }) : cardHTML(c, { still: true, dim: picking === 'enchant' && !!c.en })))
        .join('');
      const head = picking === 'remove' ? `버릴 카드를 고르세요${m.cost ? ` · 칩 ${m.cost}` : ''}`
        : picking === 'enchant' ? `${AD.ENCHANTS[m.en].name} 각인을 새길 카드를 고르세요` : `내 덱 · ${S.deck.length}장`;
      body = `<h2 class="h">${head}</h2><div class="cards deckgrid">${list}</div>`;
    }
    return `<div class="modal" role="dialog" aria-modal="true"><div class="sheet">${body}<div class="row">${btn('닫기', 'close', undefined, 'ghost')}</div></div></div>`;
  }

  function render() {
    const view = !S ? vTitle() : { map: vMap, battle: vBattle, reward: vReward, shop: vShop, rest: vRest, event: vEvent, over: vEnd, win: vEnd }[S.screen]();
    const top = S && S.screen !== 'over' && S.screen !== 'win' ? topbar() : '';
    app.innerHTML = top + view + vModal() + (ui.toast ? `<div class="toast" role="status">${ui.toast}</div>` : '');
  }

  // 아티팩트 뷰어가 새 버전을 받아도 판이 이어지게
  window.claude?.hot?.snapshot?.(() => ({ S }));
  const boot = (data) => { S = (data && data.S) || null; render(); };
  if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
  else boot(window.claude?.hot?.data ?? {});
})();
