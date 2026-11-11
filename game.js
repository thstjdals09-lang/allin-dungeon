/* 올인 던전 — 상태와 진행, 상점·보상·휴게실 화면. 전투는 battle.js, 이벤트는 events.js. 규칙은 logic.js(AD), 화면 조각·시트·지도·타이틀은 views.js(V),
   배경 그림은 scenes.js(SCENES), 연출은 fx.js(FX). */
(function () {
  'use strict';
  const VERSION = 4; // v4: 상대 벳·레이즈(battle.facing)가 생겨 v3 전투 저장과 다르다. v3: 층 지도가 갈림길(map·path)로 바뀌어 v2 저장과 형식이 다르다
  const SAVE_KEY = 'allin-dungeon-v4';
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
  let ui = { modal: null, swap: false, toast: '', fx: [], from: null, screen: null, mapSel: null, restPick: null };
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
      return isState(s) && RESUMABLE.includes(s.screen) ? AD.migrateSave(s) : null;
    } catch (e) { return null; }
  }

  /* ───────── 진행 ───────── */
  function newRun() {
    V.resetSeen(); // 카드 id 가 c0 부터 다시 쓰이므로 딜 연출 기록도 비운다
    ui.mapSel = null;
    ui.restPick = null;
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
    ui.restPick = null;
    S.screen = 'map';
  }

  function hurt(n) { S.hp = Math.max(0, S.hp - n); }
  function heal(n) { S.hp = Math.min(S.maxHp, S.hp + n); }
  function gainCharm(id) {
    S.charms = [...S.charms, id];
    remember('charms', id);
    if (id === 'pact') { S.maxHp -= 12; S.hp = Math.min(S.hp, S.maxHp); }
  }

  // 전투·이벤트 파일에 넘기는 공유 컨텍스트. S·P 는 다시 대입되므로 getter 로 건넨다.
  const C = {
    get S() { return S; }, get P() { return P; },
    ui, fx, has, hurt, heal, toast, newId, note, remember, swapCost, gainCharm, cardName,
    rnd, btn, MIN_DECK, CHANGES, STREETS,
  };
  const { startMatch, vBattle, ACT: battleAct } = window.BATTLE(C);
  const { EVENTS, vEvent, ACT: eventAct } = window.EVENTS_MOD(C);

  function enterNode(type) {
    S.node = type;
    if (type === 'fight' || type === 'elite' || type === 'boss') return startMatch(type);
    if (type === 'shop') return openShop();
    if (type === 'rest') { S.rest = { offers: AD.shuffle(AD.ENCHANT_IDS, rnd).slice(0, 2) }; S.screen = 'rest'; return; }
    S.event = { id: AD.pick(EVENTS, rnd).id, done: null };
    S.screen = 'event';
  }

  // 보상 화면에서 고른 카드·유물을 떠날 때 넣는다
  function takeReward() {
    const r = S.reward;
    const card = r.cardPick !== null && r.cardPick !== undefined ? r.cards[r.cardPick] : null;
    if (card) S.deck = [...S.deck, card];
    if (r.charmPick) gainCharm(r.charmPick);
    if (card || r.charmPick) fx({ t: 'coin' });
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


  /* ───────── 버튼 동작 ───────── */
  const ACT = {
    ...battleAct,
    ...eventAct,
    start() {
      if (!S && loadSave()) { ui.modal = { type: 'newrun' }; return; } // 진행 중인 도전을 덮어쓰기 전에 묻는다
      newRun();
    },
    startNew() { ui.modal = null; newRun(); },
    cont() { S = loadSave(); ui.mapSel = null; },
    mapSel(i) { ui.mapSel = +i; },
    go(i) {
      if (S.screen !== 'map' || !choices().includes(+i)) return;
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
    // 보상은 고르기만 하고 떠날 때 확정한다. 다시 누르면 취소, 다른 걸 누르면 바뀐다.
    takeCard(i) { const r = S.reward; S.reward = { ...r, cardPick: r.cardPick === +i ? null : +i }; },
    takeCharm(id) { const r = S.reward; S.reward = { ...r, charmPick: r.charmPick === id ? null : id }; },
    leave() {
      if (S.screen === 'reward') takeReward();
      advance();
    },
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
    // 휴게실: 고르기(바꿀 수 있음) → 결정. 강화는 결정한 뒤 카드를 고른다.
    restPick(k) { ui.restPick = ui.restPick === k ? null : k; },
    restGo() {
      const k = ui.restPick;
      if (!k) return toast('하나를 먼저 고르세요');
      if (k === 'rest') { heal(Math.ceil(S.maxHp * 0.3)); advance(); return; }
      if (!S.deck.some((c) => !c.en)) return toast('강화 안 된 카드가 없습니다');
      ui.modal = { type: 'deck', purpose: 'enchant', en: k, from: 'rest' };
    },
    // 덱 시트(강화·제거): 카드를 누르면 고르기만, 확인 버튼에서 적용
    pickDeck(id) { if (ui.modal) ui.modal = { ...ui.modal, pick: ui.modal.pick === id ? null : id }; },
    deckConfirm() {
      const m = ui.modal;
      const id = m && m.pick;
      const card = id && S.deck.find((c) => c.id === id);
      if (!card) return toast('카드를 먼저 고르세요');
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

  // 덱빌딩 판단용: 아직 안 받은 카드는 넣으면 같은 숫자가 몇 장이 되는지, 받은 카드는 지금 몇 장인지
  function sameRank(c, taken) {
    const n = S.deck.filter((d) => d.r === c.r).length;
    return `<small class="same">${taken ? `덱에 ${AD.rankLabel(c.r)} ${n}장` : `넣으면 ${AD.rankLabel(c.r)} ${n + 1}장`}</small>`;
  }

  function vReward() {
    const r = S.reward;
    const cards = r.cards.map((c, i) => `<div class="offer${r.cardPick === i ? ' picked' : ''}">
        ${cardHTML(c, { act: 'takeCard', arg: i, sel: r.cardPick === i })}
        <small>${c.en ? AD.ENCHANTS[c.en].desc : '강화 없음'}</small>
        ${sameRank(c, false)}
      </div>`).join('');
    const charms = r.charms.length
      ? `<h3 class="sub">유물 1개 · 고르지 않아도 됩니다</h3><div class="charmrow">${r.charms.map((id) =>
        `<button class="charmcard${r.charmPick === id ? ' chosen' : ''}" data-act="takeCharm" data-arg="${id}" aria-pressed="${r.charmPick === id}"><b>${AD.CHARMS[id].name}</b><span>${AD.CHARMS[id].desc}</span></button>`).join('')}</div>`
      : '';
    const picked = (r.cardPick !== null && r.cardPick !== undefined) || r.charmPick;
    return `<main class="screen reward">
      <p class="eyebrow">매치 승리</p>
      <h2 class="h">상금 +<span class="count num" data-n="${r.gold}">${r.gold}</span></h2>
      <h3 class="sub">덱에 넣을 카드 1장 · 다시 누르면 취소</h3>
      <div class="offers">${cards}</div>
      ${charms}
      <div class="actions">${picked ? btn('가져가고 계속', 'leave', undefined, 'primary wide') : btn('아무것도 안 받고 계속', 'leave', undefined, 'ghost wide')}</div>
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
    const pick = ui.restPick;
    const opt = (key, title, desc) =>
      `<button class="charmcard${pick === key ? ' chosen' : ''}" data-act="restPick" data-arg="${key}" aria-pressed="${pick === key}"><b>${title}</b><span>${desc}</span></button>`;
    const offers = S.rest.offers.map((en) =>
      opt(en, `<span class="seal seal-${en} inline">${AD.ENCHANTS[en].seal}</span>${AD.ENCHANTS[en].name} 강화`, AD.ENCHANTS[en].desc)).join('');
    const go = pick === 'rest' ? `쉬기 · 스택 +${heal}` : pick ? '강화할 카드 고르기' : '결정';
    return `<main class="screen rest">
      <p class="eyebrow">휴게실</p>
      <h2 class="h">하나만 고르세요.</h2>
      <div class="charmrow">
        ${opt('rest', '쉬기', `스택 +${heal} (지금 ${S.hp}/${S.maxHp})`)}
        ${offers}
      </div>
      <p class="note">고른 뒤에도 결정 전까지 바꿀 수 있습니다. 강화는 아직 강화되지 않은 카드에만 됩니다.</p>
      <div class="actions">${btn('그냥 지나가기', 'leave', undefined, 'ghost')}${btn(go, 'restGo', undefined, 'primary', !pick)}</div>
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
  const boot = (data) => { S = data && isState(data.S) ? AD.migrateSave(data.S) : null; render(); };
  if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
  else boot(window.claude?.hot?.data ?? {});
})();
