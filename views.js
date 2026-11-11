/* 올인 던전 — 화면 조각(카드·버튼·막대)과 아래에서 올라오는 시트들. 상태는 갖지 않고 인자로 받는다.
   game.js 가 전역 V 로 쓴다. */
(function () {
  'use strict';
  const seen = new Set(); // 이미 그린 카드 id — 딜 애니메이션을 한 번만

  const cardName = (c) => `${AD.SUITS[c.s]}${AD.rankLabel(c.r)}${c.en ? ` (${AD.ENCHANTS[c.en].name})` : ''}`;

  // 카드 앞면: 왼쪽 위·오른쪽 아래 모서리 숫자, 가운데는 무늬(그림 카드는 큰 글자)
  function cardHTML(c, o = {}) {
    const fresh = !o.still && !seen.has(c.id);
    seen.add(c.id);
    const court = c.r >= 11;
    const cls = ['card', c.s === 1 || c.s === 2 ? 'red' : 'black', court && 'court', c.en && 'en', o.sel && 'sel', o.used && 'used', o.dim && 'dim', o.swap && 'swappable', fresh && 'deal']
      .filter(Boolean).join(' ');
    const rank = AD.rankLabel(c.r);
    const suit = AD.SUITS[c.s];
    const idx = (pos) => `<span class="idx ${pos}"><b>${rank}</b><i>${suit}</i></span>`;
    const en = c.en ? `<span class="seal seal-${c.en}">${AD.ENCHANTS[c.en].seal}</span>` : '';
    const inner = `${idx('tl')}<span class="pip">${court ? rank : suit}</span>${idx('br')}${en}`;
    const label = cardName(c);
    const style = o.style ? ` style="${o.style}"` : '';
    if (!o.act) return `<div class="${cls}"${style} role="img" aria-label="${label}">${inner}</div>`;
    return `<button class="${cls}"${style} data-act="${o.act}" data-arg="${o.arg ?? c.id}" aria-label="${label}" aria-pressed="${!!o.sel}">${inner}</button>`;
  }
  const backHTML = () => '<div class="card back" role="img" aria-label="엎어 둔 카드"></div>';
  const slotHTML = () => '<div class="card slot" aria-hidden="true"></div>';
  const btn = (label, act, arg, cls = '', disabled = false) =>
    `<button class="btn ${cls}" data-act="${act}"${arg !== undefined ? ` data-arg="${arg}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
  // 막대는 scaleX 로 그린다 — fx.js 가 직전 값에서 이어서 움직이게 data-key·data-v 를 남긴다
  function bar(v, max, cls, key) {
    const ratio = Math.max(0, Math.min(1, v / max)).toFixed(4);
    return `<span class="bar ${cls}" data-key="${key}" data-v="${ratio}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.max(0, v)}"><i style="transform:scaleX(${ratio})"></i></span>`;
  }
  const toggle = (label, isOn, act) =>
    `<button class="toggle" data-act="${act}" role="switch" aria-checked="${isOn}"><span>${label}</span><i aria-hidden="true"></i></button>`;
  const gloss = (rows) => `<dl class="gloss">${rows.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>`;
  const KIND = { normal: '일반', elite: '하이롤러', boss: '보스' };

  const GLOSSARY = [
    ['핸드', '손패에서 고른 내 카드 2장'],
    ['스택', '내 칩. 0이 되면 버스트(탈락)'],
    ['팟', '이번 판에 걸린 배수. 1에서 시작'],
    ['체크', '팟을 그대로 두고 다음 카드를 연다'],
    ['벳', '팟 +1. 상대는 콜하거나 폴드한다'],
    ['올인', `팟 +${AD.ALLIN_ADD}. 콜하면 남은 카드를 다 깔고 바로 쇼다운`],
    ['폴드', `이번 판을 포기한다. ${AD.ANTE} × 팟을 잃는다`],
    ['텔', '상대 표정. 상대마다 거짓말하는 정도가 다르다'],
    ['체인지', '판마다 2번. 손패 1장 교체에 1, 보드 1장 교체에 2'],
    ['상금', '매치에서 이기면 받는 돈. 상점에서 쓴다'],
    ['유물', '갖고 있는 동안 계속 효과가 있는 아이템'],
  ];
  const TIPS = [
    '텔이 "초조"면 상대 패가 약할 때가 많습니다. 벳으로 폴드를 받아 내세요.',
    '손패에서 보드와 같은 숫자를 고르면 원페어 이상이 쉽게 나옵니다.',
    '체인지는 판마다 다시 채워집니다. 아끼지 말고 쓰세요.',
    '덱이 얇을수록 좋은 카드가 자주 옵니다. 상점에서 낮은 카드를 빼세요.',
    '센 패일수록 턴·리버에서 벳을 더해 팟을 키우세요.',
    '하이롤러는 유물을 줍니다. 스택이 넉넉할 때 들어가세요.',
  ];

  /* ───────── 시트 ───────── */
  const enchantList = () =>
    `<ul class="enlist">${AD.ENCHANT_IDS.map((k) => `<li><span class="seal seal-${k} inline">${AD.ENCHANTS[k].seal}</span><b>${AD.ENCHANTS[k].name}</b> ${AD.ENCHANTS[k].desc}</li>`).join('')}</ul>`;

  function howto() {
    return `<h2 class="h">게임 방법</h2>
      <ol class="howto">
        <li><b>지도</b>에서 갈 칸을 고릅니다. 지하 3층 아래 하우스의 주인이 마지막 상대입니다.</li>
        <li><b>플롭이 깔리면</b> 손패 5장 중 핸드 2장을 고릅니다.</li>
        <li><b>플롭·턴·리버마다 베팅</b>합니다. 체크·벳·올인·폴드.</li>
        <li><b>쇼다운</b>에서 진 쪽이 족보 값 × 팟만큼 스택을 잃습니다. 상대가 폴드하면 상대가 ${AD.ANTE} × 팟을 잃습니다.</li>
        <li>이기면 <b>카드와 유물</b>로 덱을 키웁니다.</li>
      </ol>
      <h3 class="sub">요령</h3>
      <ul class="plist tips">${TIPS.map((t) => `<li><span>${t}</span></li>`).join('')}</ul>
      <h3 class="sub">족보 값</h3>
      <table class="ranks"><tbody>
      ${AD.HANDS.map((h) => `<tr><td>${h.name}</td><td class="num">${h.value}</td></tr>`).reverse().join('')}
      <tr><td>로열 플러시</td><td class="num">+${AD.ROYAL_BONUS}</td></tr></tbody></table>
      <p class="note">파이브카드는 이 게임에만 있는 족보입니다. 내 덱 카드가 보드 카드와 겹칠 수 있어서 나옵니다.</p>
      <h3 class="sub">용어</h3>
      ${gloss(GLOSSARY)}
      <h3 class="sub">카드 강화 · 핸드로 쓸 때만 효과</h3>
      ${enchantList()}`;
  }

  // 도감: 만난 상대와 얻은 유물만 보이고, 나머지는 ???
  function codex(P) {
    const met = new Set(P.enemies);
    const got = new Set(P.charms);
    const charmIds = Object.keys(AD.CHARMS);
    const enemies = AD.ENEMIES.map((e) => (met.has(e.id)
      ? `<li><span class="medal sm" aria-hidden="true">${e.glyph}</span><div><b>${e.name}</b><small>${e.floor}층 ${KIND[e.kind]}</small><span>${e.desc}</span></div></li>`
      : `<li class="unknown"><span class="medal sm" aria-hidden="true">?</span><div><b>???</b><small>${e.floor}층 ${KIND[e.kind]}</small><span>아직 만나지 못한 상대</span></div></li>`)).join('');
    const charms = charmIds.map((id) => (got.has(id)
      ? `<li><b>${AD.CHARMS[id].name}</b><span>${AD.CHARMS[id].desc}</span></li>`
      : '<li class="unknown"><b>???</b><span>아직 얻지 못한 유물</span></li>')).join('');
    return `<h2 class="h">도감</h2>
      <h3 class="sub">상대 · ${met.size}/${AD.ENEMIES.length}</h3><ul class="codex">${enemies}</ul>
      <h3 class="sub">유물 · ${got.size}/${charmIds.length}</h3><ul class="plist">${charms}</ul>
      <h3 class="sub">카드 강화 · ${AD.ENCHANT_IDS.length}종</h3>${enchantList()}`;
  }

  function records(P) {
    const rows = [
      ['도전', `${P.runs}번`],
      ['하우스 정복', `${P.wins}번`],
      ['가장 깊이', P.bestFloor ? `${P.bestFloor}층` : '없음'],
      ['이긴 매치', `${P.kills}번`],
      ['최고 족보', P.bestHand >= 0 ? AD.HANDS[P.bestHand].name : '없음'],
      ['한 판 최대 피해', P.bestHit ? `${P.bestHit}` : '없음'],
    ];
    return `<h2 class="h">기록</h2>
      <dl class="stats">${rows.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>
      <p class="note">기록과 도감은 이 브라우저에만 저장됩니다.</p>`;
  }

  function settings(m) {
    const fx = window.FX;
    const wipe = m.confirm
      ? `<p class="note warn" role="alert">진행 중인 도전과 도감·기록이 모두 지워집니다.</p>
         <div class="row">${btn('모두 지우기', 'wipe', undefined, 'danger')}${btn('취소', 'modal', 'settings', 'ghost')}</div>`
      : btn('저장 데이터 지우기', 'wipeAsk', undefined, 'ghost wide');
    return `<h2 class="h">설정</h2>
      <div class="toggles">${fx ? toggle('효과음', !fx.muted, 'sound') + toggle('연출 빠르게', fx.fast, 'fast') : ''}</div>
      ${wipe}`;
  }

  function newRunConfirm(saved) {
    return `<h2 class="h">새로 시작할까요?</h2>
      <p class="note warn" role="alert">진행 중인 도전(${saved.floor}층)이 사라집니다.</p>
      <div class="row">${btn('새로 시작', 'startNew', undefined, 'danger')}</div>`;
  }

  function menu(m, S) {
    const fx = window.FX;
    const log = S.battle && S.battle.log.length
      ? `<h3 class="sub">이번 매치 기록</h3><ol class="log">${S.battle.log.map((l) => `<li>${l}</li>`).join('')}</ol>` : '';
    const quit = m.confirm
      ? `<p class="note warn" role="alert">지금 포기하면 이번 도전의 진행이 사라집니다.</p>
         <div class="row">${btn('포기하고 처음으로', 'quit', undefined, 'danger')}${btn('계속하기', 'modal', 'menu', 'ghost')}</div>`
      : btn('처음 화면으로', 'quitAsk', undefined, 'ghost wide');
    return `<h2 class="h">메뉴</h2>
      <div class="toggles">${fx ? toggle('효과음', !fx.muted, 'sound') + toggle('연출 빠르게', fx.fast, 'fast') : ''}</div>
      ${btn('게임 방법', 'modal', 'howto', 'ghost wide')}
      ${log}
      ${quit}`;
  }

  function charms(S) {
    if (!S.charms.length) return '<h2 class="h">유물</h2><p class="note">아직 유물이 없습니다. 하이롤러·보스를 이기거나 상점에서 얻습니다.</p>';
    return `<h2 class="h">유물 · ${S.charms.length}개</h2>
      <ul class="plist">${S.charms.map((id) => `<li><b>${AD.CHARMS[id].name}</b><span>${AD.CHARMS[id].desc}</span></li>`).join('')}</ul>`;
  }

  // 상대 수치를 플레이어가 읽을 수 있는 말로
  function enemy(S) {
    const e = S.battle.enemy;
    const tell = e.poker ? '텔이 없다. 표정으로는 알 수 없다'
      : e.lie >= 0.5 ? '텔이 자주 거짓말한다' : e.lie >= 0.25 ? '텔이 가끔 거짓말한다' : '텔을 믿을 만하다';
    const fold = !e.tight ? '벳이 와도 폴드하지 않는다'
      : e.tight >= 1.2 ? '벳에 쉽게 폴드한다' : e.tight >= 0.8 ? '약한 패면 벳에 폴드한다' : '웬만해서는 폴드하지 않는다';
    const traits = [
      ['텔', tell],
      ['폴드', fold],
      e.mul !== 1 && [`족보 값 ×${e.mul}`, `이 상대가 이기면 내가 잃는 칩이 ${e.mul}배`],
      e.armor && [`방어 ${e.armor}`, `내가 이겨도 상대는 ${e.armor} 덜 잃는다`],
      e.heal && [`회복 ${e.heal}`, `이길 때마다 스택을 ${e.heal} 채운다`],
      e.rule && [AD.RULES[e.rule].name, AD.RULES[e.rule].desc],
      e.hole === 3 && ['카드 3장', '카드 3장을 받아 그중 좋은 쪽을 쓴다'],
    ].filter(Boolean);
    return `<div class="who-sheet"><span class="medal" aria-hidden="true">${e.glyph}</span><div><h2 class="h">${e.name}</h2><p class="note">${e.desc}</p></div></div>
      ${gloss(traits)}`;
  }

  // 강화·제거할 카드 고르기: 누르면 고르기만(다시 누르면 취소), 아래 확인 버튼에서 적용, 닫기로 그만두기
  function deck(m, S) {
    const picking = m.purpose;
    const list = S.deck.slice().sort((a, b) => b.r - a.r || a.s - b.s)
      .map((c) => (picking && !(picking === 'enchant' && c.en)
        ? cardHTML(c, { act: 'pickDeck', still: true, sel: m.pick === c.id })
        : cardHTML(c, { still: true, dim: picking === 'enchant' && !!c.en })))
      .join('');
    const chosen = m.pick && S.deck.find((c) => c.id === m.pick);
    const confirm = !picking ? ''
      : `<div class="confirm"><span>${chosen ? `고른 카드 <b>${cardName(chosen)}</b>` : '카드를 누르세요. 다시 누르면 취소됩니다.'}</span>
         ${btn(picking === 'remove' ? `제거하기${m.cost ? ` · ${m.cost}` : ''}` : `${AD.ENCHANTS[m.en].name} 강화하기`, 'deckConfirm', undefined, 'primary', !chosen)}</div>`;
    const head = picking === 'remove' ? `제거할 카드${m.cost ? ` · ${m.cost}` : ''}`
      : picking === 'enchant' ? `${AD.ENCHANTS[m.en].name} 강화할 카드` : `내 덱 · ${S.deck.length}장`;
    const suits = AD.SUITS.map((s, i) => `${s} ${S.deck.filter((c) => c.s === i).length}`).join(' · ');
    const high = S.deck.filter((c) => c.r >= 11).length;
    const enCount = S.deck.filter((c) => c.en).length;
    const pile = S.battle && !picking ? `<p class="note">이번 매치 · 뽑을 카드 ${S.battle.draw.length}장 · 버린 카드 ${S.battle.discard.length}장</p>` : '';
    return `<h2 class="h">${head}</h2>
      <p class="note">${suits} · J 이상 ${high}장 · 강화 ${enCount}장</p>${pile}
      <div class="cards deckgrid">${list}</div>${confirm}`;
  }

  /* ───────── 메인 화면 ───────── */
  // 타이틀 장식: 떠다니는 무늬와 스페이드 로열 플러시 부채
  const DRIFTS = Array.from({ length: 14 }, (_, i) =>
    `<span style="--x:${(i * 37) % 100}%;--d:${11 + ((i * 7) % 9)}s;--delay:-${(i * 13) % 17}s;--s:${18 + ((i * 11) % 28)}px">${AD.SUITS[i % 4]}</span>`).join('');
  const TITLE_FAN = [10, 11, 12, 13, 14].map((r, i) => ({ id: `title-${r}`, r, s: 0, en: null, rot: (i - 2) * 10 }));
  const MAIN_MENU = [['howto', '게임 방법', '법'], ['codex', '도감', '도'], ['records', '기록', '기'], ['settings', '설정', '설']];

  function title(saved, P) {
    return `<main class="screen title">
      <div class="drifts" aria-hidden="true">${DRIFTS}</div>
      <p class="eyebrow">헤즈업 홀덤 로그라이크</p>
      <h1 class="logo">올인<br>던전</h1>
      <div class="fan" aria-hidden="true">${TITLE_FAN.map((c) => cardHTML(c, { style: `--r:${c.rot}deg` })).join('')}</div>
      <nav class="mainmenu" aria-label="메인 메뉴">
        ${saved ? btn(`이어 하기<small>지하 ${saved.floor}층 · 스택 ${saved.hp}</small>`, 'cont', undefined, 'primary big') : ''}
        ${btn('새로 시작', 'start', undefined, saved ? 'ghost big' : 'primary big')}
        <div class="mm-grid">${MAIN_MENU.map(([k, label, g]) =>
          `<button class="mm" data-act="modal" data-arg="${k}"><span class="glyph" aria-hidden="true">${g}</span>${label}</button>`).join('')}</div>
      </nav>
      <p class="foot">${P.runs ? `도전 ${P.runs}번 · 정복 ${P.wins}번 · 가장 깊이 지하 ${P.bestFloor}층` : '진행과 기록은 이 브라우저에만 저장됩니다.'}</p>
    </main>`;
  }

  /* ───────── 층 지도 ───────── */
  // 아래(출발)에서 위(보스)로 올라간다. 좌표는 MAP_W × MAP_H 판 기준, 칸은 그 위에 % 로 올린다.
  const NODE_GLYPH = { fight: '판', elite: '강', shop: '상', rest: '휴', event: '?', boss: '보' };
  const MAP_W = 300;
  const MAP_H = 460;
  const mapPos = (r, i, n) => ({ x: 30 + ((i + 0.5) / n) * (MAP_W - 60), y: MAP_H - 46 - (r * (MAP_H - 92)) / AD.STEPS });
  const pct = (p) => `left:${((p.x / MAP_W) * 100).toFixed(2)}%;top:${((p.y / MAP_H) * 100).toFixed(2)}%`;

  // 길: 지나온 길(walked)·지금 갈 수 있는 길(next)·못 가게 된 길(gone)
  function mapLines(S, here) {
    const { rows, edges } = S.map;
    const pos = (r, i) => mapPos(r, i, rows[r].length);
    return edges.flatMap((e, r) => e.flatMap((targets, i) => targets.map((j) => {
      const a = pos(r, i);
      const b = pos(r + 1, j);
      const walked = S.path[r] === i && S.path[r + 1] === j;
      const next = r === S.step - 1 && here === i;
      const cls = walked ? 'walked' : next ? 'next' : r < S.step - 1 || (r === S.step - 1 && here !== i) ? 'gone' : '';
      // 아래 칸 도장 위쪽에서 출발해 위 칸 이름 아래에서 끝난다(선이 글자를 지나가지 않게)
      const y1 = a.y - 19;
      const y2 = b.y + 32;
      const my = (y1 + y2) / 2;
      return `<path class="${cls}" data-row="${r}" d="M${a.x} ${y1}C${a.x} ${my} ${b.x} ${my} ${b.x} ${y2}"/>`;
    }))).join('');
  }

  // open = 지금 고를 수 있는 칸 번호들, picked = 눌러 둔 칸(하나뿐이면 자동으로)
  function map(S, open, picked) {
    const { rows } = S.map;
    const sel = open.includes(picked) ? picked : open.length === 1 ? open[0] : null;
    const here = S.step > 0 ? S.path[S.step - 1] : null;
    const nodes = rows.flatMap((row, r) => row.map((t, i) => {
      const visited = S.path[r] === i;
      const canGo = r === S.step && open.includes(i);
      const cls = ['mnode', `node-${t}`, visited && 'visited', canGo && 'open', canGo && sel === i && 'picked',
        r < S.step && !visited && 'gone'].filter(Boolean).join(' ');
      const inner = `<span class="glyph">${NODE_GLYPH[t]}</span><span class="mlabel">${AD.NODES[t].name}</span>`;
      const style = `${pct(mapPos(r, i, row.length))};--row:${r}`;
      return canGo
        ? `<button class="${cls}" style="${style}" data-act="mapSel" data-arg="${i}" aria-pressed="${sel === i}" aria-label="${AD.NODES[t].name}: ${AD.NODES[t].desc}">${inner}</button>`
        : `<div class="${cls}" style="${style}" aria-hidden="true">${inner}</div>`;
    })).join('');
    const token = here !== null ? `<i class="token" style="${pct(mapPos(S.step - 1, here, rows[S.step - 1].length))}" aria-hidden="true"></i>` : '';
    const t = sel !== null ? rows[S.step][sel] : null;
    const info = t
      ? `<div class="mapinfo"><span class="glyph" aria-hidden="true">${NODE_GLYPH[t]}</span><div><b>${AD.NODES[t].name}</b><span>${AD.NODES[t].desc}</span></div></div>${btn('들어가기', 'go', sel, 'primary')}`
      : '<p class="hint">빛나는 칸을 눌러 다음 행선지를 고르세요.</p>';
    const left = AD.STEPS - S.step;
    return `<main class="screen map">
      <div class="maphead"><h2 class="h">지하 ${S.floor}층</h2><span class="lbl">${left ? `보스까지 ${left}칸` : '보스 테이블'}</span></div>
      <div class="mapboard">
        <span class="watermark" aria-hidden="true">B${S.floor}</span>
        <svg class="maplines" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-hidden="true">${mapLines(S, here)}</svg>
        ${nodes}${token}
      </div>
      <div class="actions">${info}</div>
    </main>`;
  }

  // 시트 틀: 제목에 id 를 붙여 대화상자 이름으로 쓴다
  const sheet = (body) =>
    `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet">${body.replace('<h2 class="h">', '<h2 class="h" id="sheet-title">')}<div class="row">${btn('닫기', 'close', undefined, 'ghost wide')}</div></div></div>`;

  window.V = {
    cardName, cardHTML, backHTML, slotHTML, btn, bar, toggle, KIND,
    resetSeen: () => seen.clear(),
    title, map, sheet,
    sheets: { howto, codex, records, settings, newRunConfirm, menu, charms, enemy, deck },
  };
})();
