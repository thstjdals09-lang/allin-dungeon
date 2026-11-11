/* 올인 던전 — 이벤트(EVENTS)와 이벤트 화면. game.js 가 공유 컨텍스트 C 를 넘겨 부른다. */
window.EVENTS_MOD = function (C) {
  'use strict';
  const { ui, hurt, gainCharm, newId, MIN_DECK, rnd, btn, cardName } = C;

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
      }],
    },
  ];
  const eventById = (id) => EVENTS.find((e) => e.id === id);

  function vEvent() {
    const ev = eventById(C.S.event.id);
    const body = C.S.event.done
      ? `<p class="lead">${C.S.event.done}</p><div class="actions">${btn('계속', 'leave', undefined, 'primary wide')}</div>`
      : `<div class="actions">${ev.opts.map((o, i) => btn(o.label, 'evt', i, 'primary')).join('')}${btn('그냥 간다', 'leave', undefined, 'ghost')}</div>`;
    return `<main class="screen event">
      <p class="eyebrow">이벤트</p>
      <h2 class="h">${ev.title}</h2>
      <p class="lead">${ev.text}</p>
      ${body}
    </main>`;
  }

  const ACT = {
    evt(i) {
      const opt = eventById(C.S.event.id).opts[+i];
      if (!opt.ok()) return toast(opt.no);
      const msg = opt.run();
      if (msg !== null) C.S.event = { ...C.S.event, done: msg };
    },
  };

  return { EVENTS, vEvent, ACT };
};
