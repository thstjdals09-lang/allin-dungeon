/* 올인 던전 — 배경 그림(SVG). 화면 종류마다 하나: title(메인), hall(지도·상점·휴게실·이벤트), table(전투·보상).
   움직이는 곳은 등불 깜빡임·흔들림, 연기 흐름뿐이고 CSS 애니메이션으로 돈다(동작 줄이기면 멈춘다). */
(function () {
  'use strict';
  const svg = (body) => `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;

  // 매달린 등불: 줄·갓·불빛 원·바닥까지 떨어지는 빛 기둥
  const lamp = (x, len, id) => `
    <g class="lamp" style="transform-origin:${x}px 0">
      <line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#3b2a22" stroke-width="2"/>
      <polygon class="cone" points="${x - 12},${len + 16} ${x + 12},${len + 16} ${x + 120},800 ${x - 120},800" fill="url(#${id}-cone)"/>
      <path d="M${x - 22} ${len + 18}h44l-9-20h-26z" fill="#8c6f3d"/>
      <path d="M${x - 22} ${len + 18}h44" stroke="#d1ab5c" stroke-width="1.5"/>
      <circle class="glow" cx="${x}" cy="${len + 22}" r="70" fill="url(#${id}-glow)"/>
    </g>`;
  const glowDefs = (id, alpha) => `
    <radialGradient id="${id}-glow"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".95"/><stop offset=".25" stop-color="#f0b45a" stop-opacity="${alpha}"/><stop offset="1" stop-color="#f0b45a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd593" stop-opacity=".2"/><stop offset="1" stop-color="#ffd593" stop-opacity="0"/></linearGradient>`;

  // 벽돌: 줄마다 반 칸씩 엇갈린 이음매
  const bricks = (id, w, h, op) => `
    <pattern id="${id}" width="${w}" height="${h * 2}" patternUnits="userSpaceOnUse">
      <path d="M0 0H${w}M0 ${h}H${w}M0 0V${h}M${w / 2} ${h}V${h * 2}" stroke="#000" stroke-opacity="${op}" fill="none"/>
    </pattern>`;

  // 메인: 지하 카지노로 내려가는 아치 문, 양쪽에 매달린 등불
  const title = svg(`
    <defs>
      <linearGradient id="t-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140810"/><stop offset=".55" stop-color="#2c1521"/><stop offset="1" stop-color="#100609"/></linearGradient>
      <radialGradient id="t-door" cx=".5" cy="1" r=".95"><stop offset="0" stop-color="#e9b766" stop-opacity=".6"/><stop offset=".45" stop-color="#a24a2a" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      ${bricks('t-brick', 44, 22, 0.4)}
      ${glowDefs('t', 0.4)}
    </defs>
    <rect width="400" height="800" fill="url(#t-wall)"/>
    <rect width="400" height="800" fill="url(#t-brick)"/>
    <path d="M118 800V600a82 82 0 0 1 164 0V800Z" fill="#0b0407"/>
    <g fill="#24111a">${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${136 + k * 6}" y="${690 + k * 18}" width="${128 - k * 12}" height="8" opacity="${0.9 - k * 0.12}"/>`).join('')}</g>
    <path class="doorlight" d="M118 800V600a82 82 0 0 1 164 0V800Z" fill="url(#t-door)"/>
    <path d="M118 800V600a82 82 0 0 1 164 0V800" fill="none" stroke="#8c6f3d" stroke-width="4"/>
    <path d="M110 800V598a90 90 0 0 1 180 0V800" fill="none" stroke="#3b2a22" stroke-width="3"/>
    ${lamp(80, 110, 't')}${lamp(320, 150, 't')}
    <rect y="780" width="400" height="20" fill="#0a0406" opacity=".8"/>`);

  // 지도·상점·휴게실: 돌로 쌓은 지하 복도, 양쪽 벽 등불
  const sconce = (x, y) => `
    <g class="sconce">
      <path d="M${x - 6} ${y + 10}h12v26h-12z" fill="#3b2a22"/>
      <path d="M${x - 14} ${y + 8}h28l-4 6h-20z" fill="#8c6f3d"/>
      <ellipse class="flame" cx="${x}" cy="${y}" rx="5" ry="10" fill="#ffcf7a"/>
      <circle class="glow" cx="${x}" cy="${y}" r="90" fill="url(#h-glow)"/>
    </g>`;
  const hall = svg(`
    <defs>
      <linearGradient id="h-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f070b"/><stop offset=".5" stop-color="#22111a"/><stop offset="1" stop-color="#0d0609"/></linearGradient>
      <radialGradient id="h-vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
      ${bricks('h-stone', 64, 32, 0.5)}
      ${glowDefs('h', 0.35)}
    </defs>
    <rect width="400" height="800" fill="url(#h-wall)"/>
    <rect width="400" height="800" fill="url(#h-stone)"/>
    <path d="M0 0H400V70Q200 140 0 70Z" fill="#0a0406" opacity=".75"/>
    ${sconce(28, 250)}${sconce(372, 250)}${sconce(28, 560)}${sconce(372, 560)}
    <rect width="400" height="800" fill="url(#h-vig)"/>`);

  // 전투·보상: 테이블 위로 늘어진 조명 하나, 빛 아래로 피어오르는 담배 연기
  const table = svg(`
    <defs>
      <radialGradient id="b-pool" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#ffd08a" stop-opacity=".16"/><stop offset=".6" stop-color="#ffd08a" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      <radialGradient id="b-smoke"><stop offset="0" stop-color="#f4ecdc" stop-opacity=".07"/><stop offset="1" stop-color="#f4ecdc" stop-opacity="0"/></radialGradient>
      ${glowDefs('b', 0.3)}
    </defs>
    <rect width="400" height="800" fill="url(#b-pool)"/>
    <ellipse class="smoke s1" cx="120" cy="330" rx="150" ry="60" fill="url(#b-smoke)"/>
    <ellipse class="smoke s2" cx="300" cy="420" rx="170" ry="70" fill="url(#b-smoke)"/>
    <ellipse class="smoke s3" cx="200" cy="560" rx="190" ry="60" fill="url(#b-smoke)"/>
    ${lamp(200, 18, 'b')}`);

  window.SCENES = { title, hall, table };
})();
