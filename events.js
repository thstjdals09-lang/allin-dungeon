/* 올인 던전 — 이벤트(EVENTS)와 이벤트 화면. game.js 가 공유 컨텍스트 C 를 넘겨 부른다. */
window.EVENTS_MOD = function (C) {
  'use strict';
  const { ui, hurt, heal, gainCharm, gainTrick, newId, MIN_DECK, rnd, btn, cardName, toast } = C;

  // 트릭 이벤트 공통: 무작위 트릭 1개를 얻는다
  const learnTrick = (lead) => {
    const id = AD.pick(AD.TRICK_IDS, rnd);
    gainTrick(id);
    return `${lead}${AD.TRICKS[id].name}을(를) 얻었다.`;
  };
  const noRoom = (fallback) => AD.trickRoom(C.S.tricks.length) || fallback;

  const EVENTS = [
    {
      id: 'vending', title: '고장 난 자판기', text: '돈을 넣으면 가끔 유물이 굴러나온다는 소문이 있다.',
      opts: [{
        label: '상금 30 넣기', ok: () => C.S.gold >= 30, no: '상금이 모자랍니다',
        run: () => {
          C.S.gold -= 30;
          const [c] = AD.randomCharms(1, C.S.charms, rnd);
          if (!c) return '덜컹거리기만 하고 아무것도 나오지 않았다.';
          gainCharm(c);
          return `덜컹. ${AD.CHARMS[c].name}이(가) 나왔다.`;
        },
      }],
    },
    {
      id: 'ace', title: '바닥에 떨어진 에이스', text: '테이블 밑에 강화된 A 한 장이 떨어져 있다. 주우려면 깨진 유리 사이로 손을 넣어야 한다.',
      opts: [{
        label: '스택 8을 내고 줍기', ok: () => C.S.hp > 8, no: '스택이 모자랍니다',
        run: () => {
          hurt(8);
          const c = { id: newId(), r: 14, s: Math.floor(rnd() * 4), en: AD.pick(AD.ENCHANT_IDS, rnd) };
          C.S.deck = [...C.S.deck, c];
          return `${cardName(c)}을(를) 덱에 넣었다.`;
        },
      }],
    },
    {
      id: 'laundry', title: '카드 정리', text: '"필요 없는 카드 한 장, 무료로 빼 드립니다."',
      opts: [{
        label: '카드 1장 제거', ok: () => C.S.deck.length > MIN_DECK, no: `덱이 ${MIN_DECK}장 이하라 더 뺄 수 없습니다`,
        run: () => { ui.modal = { type: 'deck', purpose: 'remove', cost: 0, from: 'event' }; return null; },
      }],
    },
    {
      id: 'flip', title: '동전 던지기', text: '낯선 손님이 동전을 내민다. "앞면이면 상금 50, 뒷면이면 스택 8을 내놔."',
      opts: [{
        label: '던진다', ok: () => true,
        run: () => {
          if (rnd() < 0.5) { C.S.gold += 50; return '앞면. 상금 50을 받았다.'; }
          hurt(8);
          return '뒷면. 스택 8을 잃었다.';
        },
      }],
    },
    {
      id: 'retired', title: '은퇴한 딜러', text: '"카드 한 장 강화해 주지. 뭐가 될지는 나도 몰라."',
      opts: [{
        label: '카드 1장 강화', ok: () => C.S.deck.some((c) => !c.en), no: '강화 안 된 카드가 없습니다',
        run: () => { ui.modal = { type: 'deck', purpose: 'enchant', en: AD.pick(AD.ENCHANT_IDS, rnd), from: 'event' }; return null; },
      }, {
        label: '스택 6을 내고 트릭 배우기', ok: () => C.S.hp > 6 && !AD.trickRoom(C.S.tricks.length), get no() { return noRoom('스택이 모자랍니다'); },
        run: () => { hurt(6); return learnTrick('"눈치로 배우는 거야." '); },
      }],
    },
    {
      id: 'loan', title: '사채 창구', text: '"지금 당장 현금이 필요하시죠? 대신 몸이 좀 가벼워질 겁니다."',
      opts: [{
        label: '상금 +80 · 최대 스택 −8', ok: () => C.S.maxHp > 20, no: '최대 스택이 너무 적습니다',
        run: () => { C.S.gold += 80; C.S.maxHp -= 8; C.S.hp = Math.min(C.S.hp, C.S.maxHp); return '상금 80을 받았다. 최대 스택이 8 줄었다.'; },
      }],
    },
    {
      id: 'blood', title: '피의 계약서', text: '붉은 잉크로 쓴 계약서다. 서명하면 유물 하나를 준다고 한다. 잉크는 내 피다.',
      opts: [{
        label: '스택 15를 내고 서명', ok: () => C.S.hp > 15 && Object.keys(AD.CHARMS).some((k) => !C.S.charms.includes(k)), no: '스택이 모자라거나 받을 유물이 없습니다',
        run: () => {
          hurt(15);
          const [c] = AD.randomCharms(1, C.S.charms, rnd);
          gainCharm(c);
          return `서명했다. ${AD.CHARMS[c].name}을(를) 얻었다.`;
        },
      }],
    },
    {
      id: 'thief', title: '카드 도둑', text: '손이 빠른 남자가 덱을 가리킨다. "한 장만 가져갈게. 대신 챙겨 주지."',
      opts: [{
        label: '무작위 카드 1장을 주고 상금 +40', ok: () => C.S.deck.length > MIN_DECK, no: `덱이 ${MIN_DECK}장 이하입니다`,
        run: () => {
          const c = AD.pick(C.S.deck, rnd);
          C.S.deck = C.S.deck.filter((d) => d.id !== c.id);
          C.S.gold += 40;
          return `${cardName(c)}을(를) 뺏겼다. 상금 40을 받았다.`;
        },
      }, {
        label: '상금 35 · 트릭 1개 사기', ok: () => C.S.gold >= 35 && !AD.trickRoom(C.S.tricks.length), get no() { return noRoom('상금이 모자랍니다'); },
        run: () => { C.S.gold -= 35; return learnTrick('소매에서 무언가를 꺼내 건넸다. '); },
      }],
    },
    {
      id: 'mirror', title: '거울 방', text: '거울 속 카드가 손짓한다. 하나를 꺼내 오면 거울이 스택을 가져간다.',
      opts: [{
        label: '카드 1장 복제 · 스택 −6', ok: () => C.S.hp > 6, no: '스택이 모자랍니다',
        run: () => { ui.modal = { type: 'deck', purpose: 'dup', cost: 0, hp: 6, from: 'event' }; return null; },
      }],
    },
    {
      id: 'slots', title: '낡은 슬롯머신', text: '먼지 낀 슬롯머신. 3분의 1은 터진다는데, 확인한 사람은 없다.',
      opts: [{
        label: '상금 20 넣기', ok: () => C.S.gold >= 20, no: '상금이 모자랍니다',
        run: () => {
          C.S.gold -= 20;
          if (rnd() < 1 / 3) { C.S.gold += 70; return '잭팟. 상금 70이 쏟아졌다.'; }
          return '요란한 소리만 나고 아무것도 나오지 않았다.';
        },
      }],
    },
    {
      id: 'practice', title: '연습 테이블', text: '빈 테이블에서 한 노인이 손짓한다. "이 층에서는 내가 봐 줄게. 수업료만 내."',
      opts: [{
        label: '상금 30 · 이번 층 판마다 체인지 +1', ok: () => C.S.gold >= 30 && !(C.S.floorBuff && C.S.floorBuff.changes), no: '상금이 모자라거나 이미 받았습니다',
        run: () => { C.S.gold -= 30; C.S.floorBuff = { changes: 1 }; return '이번 층에서 판마다 체인지가 1번 늘어난다.'; },
      }],
    },
    {
      id: 'clinic', title: '응급실', text: '뒷골목의 간판 없는 병원. "현금이면 바로 봐 드립니다."',
      opts: [{
        label: '상금 40 · 스택 +25', ok: () => C.S.gold >= 40 && C.S.hp < C.S.maxHp, no: '상금이 모자라거나 스택이 가득 찼습니다',
        run: () => { C.S.gold -= 40; heal(25); return '치료를 받았다. 스택이 회복됐다.'; },
      }],
    },
    {
      id: 'tattoo', title: '문신 가게', text: '"카드 한 장에 새겨 드리죠. 오늘 도안은 두 가지."',
      init: () => ({ offers: AD.shuffle(AD.ENCHANT_IDS, rnd).slice(0, 2) }),
      opts: (e) => (e.offers || []).map((en) => ({
        label: `${AD.ENCHANTS[en].name} 강화 · 상금 35`, ok: () => C.S.gold >= 35 && C.S.deck.some((c) => !c.en), no: '상금이 모자라거나 강화 안 된 카드가 없습니다',
        run: () => { ui.modal = { type: 'deck', purpose: 'enchant', en, cost: 35, from: 'event' }; return null; },
      })),
    },
    {
      id: 'informant', title: '정보원', text: '모자를 눌러쓴 남자가 속삭인다. "이 층 주인에 대해 알려 줄까?"',
      opts: [{
        label: '상금 25 · 이번 층 보스 알아내기', ok: () => C.S.gold >= 25 && !C.S.bossId, no: '상금이 모자라거나 이미 알고 있습니다',
        run: () => {
          const b = AD.pickEnemy(C.S.floor, 'boss', rnd); // 층마다 보스는 한 명이라 지금 정해도 같다
          C.S.gold -= 25;
          C.S.bossId = b.id;
          return `${b.name}. ${AD.RULES[b.rule].name} : ${AD.RULES[b.rule].desc}. 지도에 적어 두었다.`;
        },
      }],
    },
    {
      id: 'bet', title: '뒷골목 내기', text: '"한 대 맞고 버티면 60 준다." 구경꾼들이 판돈을 모으고 있다.',
      opts: [{
        label: '스택 10을 내고 버티기 · 상금 +60', ok: () => C.S.hp > 10, no: '스택이 모자랍니다',
        run: () => { hurt(10); C.S.gold += 60; return '버텼다. 상금 60을 받았다.'; },
      }],
    },
    {
      id: 'merge', title: '카드 합치기', text: '"같은 숫자 두 장을 맡기면 한 장으로 합쳐 주지. 숫자는 2 올라간다."',
      opts: [{
        label: '같은 숫자 2장 합치기 (숫자 +2)', ok: () => C.S.deck.length > MIN_DECK && AD.mergeableRanks(C.S.deck).length > 0,
        no: `덱이 ${MIN_DECK}장 이하이거나 같은 숫자 카드가 없습니다`,
        run: () => { ui.modal = { type: 'deck', purpose: 'merge', picks: [], from: 'event' }; return null; },
      }],
    },
  ];
  const eventById = (id) => EVENTS.find((e) => e.id === id);
  const optsOf = (ev) => (typeof ev.opts === 'function' ? ev.opts(C.S.event) : ev.opts);

  // 같은 판에서 본 이벤트는 피한다(전부 봤으면 처음부터)
  function pickEvent() {
    const seen = C.S.seenEvents || [];
    const fresh = EVENTS.filter((e) => !seen.includes(e.id));
    const ev = AD.pick(fresh.length ? fresh : EVENTS, rnd);
    C.S.seenEvents = fresh.length ? [...seen, ev.id] : [ev.id];
    return { id: ev.id, done: null, ...(ev.init ? ev.init() : {}) };
  }

  function vEvent() {
    const ev = eventById(C.S.event.id);
    const body = C.S.event.done
      ? `<p class="lead">${C.S.event.done}</p><div class="actions">${btn('계속', 'leave', undefined, 'primary wide')}</div>`
      : `<div class="actions">${optsOf(ev).map((o, i) => btn(o.label, 'evt', i, 'primary')).join('')}${btn('그냥 간다', 'leave', undefined, 'ghost')}</div>`;
    return `<main class="screen event">
      <p class="eyebrow">이벤트</p>
      <h2 class="h">${ev.title}</h2>
      <p class="lead">${ev.text}</p>
      ${body}
    </main>`;
  }

  const ACT = {
    evt(i) {
      const opt = optsOf(eventById(C.S.event.id))[+i];
      if (!opt.ok()) return toast(opt.no);
      const msg = opt.run();
      if (msg !== null) C.S.event = { ...C.S.event, done: msg };
    },
  };

  return { EVENTS, pickEvent, vEvent, ACT };
};
