// Banner: columna de identidad a la izquierda y, a la derecha, una armadura
// original hecha de dígitos binarios (design/figure/final) con un microchip
// como núcleo.
//
// Reglas de animación (para que GitHub, Safari y Firefox lo muestren bien):
//  - El estilo base de cada elemento es su estado FINAL. Las animaciones solo
//    ocultan cosas en sus fotogramas iniciales (fill-mode both/forwards), así
//    que un visor que no anime muestra el banner completo.
//  - Los bucles que mueven o escalan cosas tienen un número finito de
//    repeticiones; solo quedan infinitos los parpadeos baratos (steps/opacity).
//  - prefers-reduced-motion apaga todas las animaciones.
import { readFileSync, existsSync } from "node:fs";

const FONTS = ".sans{font-family:'Inter','Segoe UI Variable Display','Segoe UI',-apple-system,'Helvetica Neue',Arial,sans-serif}" +
  ".mono{font-family:'JetBrains Mono','Cascadia Code',ui-monospace,Consolas,Menlo,monospace}";

// hash determinista: mismo resultado en cada build
function hash(c, r, k = 0) {
  let h = Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663) ^ Math.imul(k + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// La figura viene de design/figure/final (o test, o FIGURE_DIR). anim.json marca
// zonas con animación propia: visor, columna y el frente de "compilación", por
// debajo del cual el cuerpo cae como flujos de datos.
function figureLayer(root) {
  const dir = process.env.FIGURE_DIR || (existsSync(new URL("design/figure/final/cells.json", root)) ? "final" : "test");
  const fig = JSON.parse(readFileSync(new URL(`design/figure/${dir}/cells.json`, root)));
  const animUrl = new URL(`design/figure/${dir}/anim.json`, root);
  const cfg = { front: 9999, visor: null, spine: null, ...(existsSync(animUrl) ? JSON.parse(readFileSync(animUrl)) : {}) };

  // Contornos: los sólidos se dibujan solos; los punteados conservan su patrón
  // y aparecen con los flujos.
  const outline = readFileSync(new URL(`design/figure/${dir}/outline.txt`, root), "utf8")
    .replace(/<(path|polyline|polygon|line|circle|ellipse|rect)\b([^>]*?)(\/?)>/g, (m, tag, attrs, slash) => {
      const clean = attrs.replace(/\s(class|pathLength|display)="[^"]*"/g, "");
      return /stroke-dasharray=/.test(clean)
        ? `<${tag}${clean} class="old in" style="animation-delay:1.5s"${slash}>`
        : `<${tag}${clean} pathLength="1" class="olp"${slash}>`;
    });

  const { cw, ch, cells } = fig;
  const coreRow = Math.floor(fig.core[1] / ch);
  const frontRow = Math.round(cfg.front / ch);
  const key = (c, r) => `${c},${r}`;
  const kind = new Map(); // celda -> "stream" | "visor" | "spine"
  for (const [c, r, lv] of cells) {
    if (r >= frontRow) kind.set(key(c, r), "stream");
    else if (cfg.visor && lv === 3 && r >= cfg.visor.rows[0] && r <= cfg.visor.rows[1] && c >= cfg.visor.cols[0] && c <= cfg.visor.cols[1]) kind.set(key(c, r), "visor");
    else if (cfg.spine && lv >= 2 && cfg.spine.cols.includes(c) && Math.abs(r - coreRow) > 2) kind.set(key(c, r), "spine");
  }
  const flick = new Map();
  for (const [c, r, lv] of cells) {
    const v = hash(c, r);
    if (lv >= 2 && v < 0.12 && !kind.has(key(c, r))) flick.set(key(c, r), Math.floor(v / 0.03));
  }
  const text = (cls, items, r, style = "") =>
    `<text class="${cls}"${style ? ` style="${style}"` : ""} x="${items.map(([c]) => +(c * cw + 0.5).toFixed(1)).join(" ")}" y="${r * ch + ch - 2}">${items.map(([, d]) => d).join("")}</text>`;

  const rows = new Map();
  for (const cell of cells) {
    if (kind.get(key(cell[0], cell[1])) === "stream") continue;
    if (!rows.has(cell[1])) rows.set(cell[1], []);
    rows.get(cell[1]).push(cell);
  }
  // el pulso de arranque sale del chip y recorre la columna hacia arriba y abajo
  const pulseAt = (r) => (1.6 + Math.abs(r - coreRow) * 0.05).toFixed(2);
  const out = [];
  const clip = [];
  for (const [r, list] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a[0] - b[0]);
    clip.push(`<rect x="${list[0][0] * cw - 4}" y="${r * ch - 2}" width="${(list[list.length - 1][0] - list[0][0] + 1) * cw + 8}" height="${ch + 4}"/>`);
    const parts = [];
    for (const lv of [1, 2, 3]) {
      const pick = (fn) => list.filter(([c, , l]) => l === lv && fn(key(c, r))).map(([c, , , d]) => [c, d]);
      const base = pick((k) => !flick.has(k) && !kind.has(k));
      if (base.length) parts.push(text(`b${lv}`, base, r));
      const visor = pick((k) => kind.get(k) === "visor");
      if (visor.length) parts.push(text(`b${lv} vz`, visor, r, `animation-delay:${pulseAt(r)}s`));
      const spine = pick((k) => kind.get(k) === "spine");
      if (spine.length) parts.push(text(`b${lv} sp`, spine, r, `animation-delay:${pulseAt(r)}s`));
      for (let k = 0; k < 4; k++) {
        const f = list.filter(([c, , l]) => l === lv && flick.get(key(c, r)) === k);
        if (!f.length) continue;
        parts.push(text(`b${lv} fa${k}`, f.map(([c, , , d]) => [c, d]), r));
        parts.push(text(`b${lv} fb${k}`, f.map(([c, , , d]) => [c, d === "1" ? "0" : "1"]), r));
      }
    }
    out.push(`<g class="as" style="animation-delay:${(0.25 + r * 0.028).toFixed(3)}s">${parts.join("")}</g>`);
  }

  // flujos: por debajo del frente, cada columna cae y se desvanece en bucle
  const streams = new Map();
  for (const [c, r, lv, d] of cells) {
    if (kind.get(key(c, r)) !== "stream") continue;
    const k = `${c}|${lv}`;
    if (!streams.has(k)) streams.set(k, []);
    streams.get(k).push([r, d]);
  }
  let minC = Infinity, maxC = -Infinity;
  const flows = [...streams.entries()].map(([k, list]) => {
    const [c, lv] = k.split("|").map(Number);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
    list.sort((a, b) => a[0] - b[0]);
    const x = +(c * cw + 0.5).toFixed(1);
    const dur = (1.8 + hash(c, 11) * 1.8).toFixed(2);
    return `<text class="b${lv} fl" style="animation-duration:${dur}s;animation-delay:${(hash(c, 13) * 2).toFixed(2)}s" x="${list.map(() => x).join(" ")}" y="${list.map(([r]) => r * ch + ch - 2).join(" ")}">${list.map(([, d]) => d).join("")}</text>`;
  }).join("\n");
  const front = Number.isFinite(minC) ? { y: frontRow * ch, x0: minC * cw - 14, x1: (maxC + 1) * cw + 14 } : null;
  return { digits: out.join("\n"), flows, front, clip: clip.join(""), outline, core: fig.core, w: fig.w, h: fig.h, count: cells.length, dir };
}

function hud(x, y, w, title, lines) {
  const h = 30 + lines.length * 18;
  return `<g class="hud in" style="animation-delay:1.9s">
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="{{BG}}" fill-opacity=".78" stroke="{{GRID2}}"/>
<path d="M${x} ${y + 10}V${y}h10M${x + w - 10} ${y}h10v10M${x} ${y + h - 10}v10h10M${x + w - 10} ${y + h}h10v-10" fill="none" stroke="{{ACCENT}}" stroke-width="1.5"/>
<text class="mono hh" x="${x + 12}" y="${y + 19}">${title}</text>
${lines.map(([k, v], i) => `<text class="mono hk" x="${x + 12}" y="${y + 40 + i * 18}">${k}</text><text class="mono hv" x="${x + w - 12}" y="${y + 40 + i * 18}" text-anchor="end">${v}</text>`).join("")}
</g>`;
}

// Microchip: cuerpo, 5 pines por lado y un prompt con cursor que parpadea.
function chip() {
  const pins = [];
  for (const o of [-12, -6, 0, 6, 12]) {
    pins.push(`<rect x="${o - 1.5}" y="-27" width="3" height="7"/><rect x="${o - 1.5}" y="20" width="3" height="7"/>`);
    pins.push(`<rect x="-27" y="${o - 1.5}" width="7" height="3"/><rect x="20" y="${o - 1.5}" width="7" height="3"/>`);
  }
  return `<g class="in" style="animation-delay:.1s">
<rect class="glow" x="-44" y="-44" width="88" height="88" rx="16" fill="{{ACCENT}}" fill-opacity="{{GLOW2OP}}"/>
<rect class="glow" x="-32" y="-32" width="64" height="64" rx="10" fill="{{ACCENT}}" fill-opacity="{{GLOW1OP}}"/>
<g fill="{{ACCENT}}">${pins.join("")}</g>
<rect x="-20" y="-20" width="40" height="40" rx="4" fill="{{COREFILL}}" stroke="{{ACCENT}}" stroke-width="2"/>
<rect x="-12" y="-12" width="24" height="24" rx="2" fill="none" stroke="{{ACCENT}}" stroke-opacity=".55"/>
<path d="M-7 -4l4 4-4 4" fill="none" stroke="{{ACCENT}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<rect class="cur" x="1" y="3" width="7" height="2.5" fill="{{ACCENT}}"/>
</g>
<rect class="burst" x="-26" y="-26" width="52" height="52" rx="6" fill="none" stroke="{{ACCENT}}" stroke-width="2"/>`;
}

export function banner(root, inv) {
  const F = figureLayer(root);
  const OX = 636, OY = 30;
  const cx = OX + F.core[0], cy = OY + F.core[1];
  const frontY = F.front ? F.front.y : F.h;
  // % de los 7 s del ciclo en que la banda llega al frente, al mismo ritmo que se ensamblan las filas
  const scanEnd = ((((frontY + 40) / 10) * 0.028) / 7 * 100).toFixed(1);

  // reglas del plano: marcas cada 16 px, mayores cada 80 con etiqueta (sin pisar paneles)
  let ticks = "", marks = "";
  for (let x = 32; x <= 1248; x += 16) {
    const major = x % 80 === 0;
    ticks += `M${x} 25V${major ? 33 : 29}`;
    if (major && !(x >= 640 && x <= 860) && x < 1070) marks += `<text class="mono rl" x="${x}" y="45" text-anchor="middle">${String(x / 80).padStart(2, "0")}</text>`;
  }
  for (let y = 32; y <= 468; y += 16) {
    const major = y % 80 === 0;
    ticks += `M25 ${y}H${major ? 33 : 29}`;
    if (major) marks += `<text class="mono rl" x="40" y="${y + 3}">${"ABCDE"[y / 80 - 1]}</text>`;
  }

  const roles = ["SOFTWARE ENGINEERING STUDENT", "PRODUCT BUILDER", "FULL-STACK DEVELOPER", "AI &amp; HCI EXPLORER"]
    .map((r, i) => `<text class="mono role rw${i ? "" : " r0"}" style="animation-delay:${i * 3}s" x="168" y="290">${r}</text>`).join("");
  const stats = [["{{PROJECTS}}", "PROJECTS"], ["{{TECHS}}", "TECHNOLOGIES"], ["{{LANGS}}", "LANGUAGES"], ["2023", "BUILDING SINCE"]]
    .map(([v, k], i) => {
      const x = 72 + i * 160;
      return `<g class="in" style="animation-delay:${(1.5 + i * 0.15).toFixed(2)}s">${i ? `<path d="M${x - 22} 398V448" stroke="{{GRID2}}"/>` : ""}<text class="sans num" x="${x}" y="426">${v}</text><text class="mono cap" x="${x}" y="450">${k}</text></g>`;
    }).join("");

  const top = inv.languages[0];
  const topLang = top ? `${top.name === "TypeScript" ? "TS" : top.name.toUpperCase()} ${((100 * top.bytes) / inv.totalBytes).toFixed(0)}%` : "—";
  const panelL = hud(648, 46, 196, "BUILD · STATS", [["TOP LANG", topLang], ["CODE", `${(inv.totalBytes / 1e6).toFixed(1)} MB`]]);
  const panelR = hud(1060, 350, 180, "STATUS", [["SYSTEM", "ONLINE"], ["MODE", "BUILDING"], ["REV", "{{REV}}"]]);

  // marco HUD cuadrado alrededor del chip: esquinas y un borde punteado que avanza
  const b = 50, l = 14;
  const brackets = `M${-b} ${-b + l}V${-b}H${-b + l}M${b - l} ${-b}H${b}V${-b + l}M${b} ${b - l}V${b}H${b - l}M${-b + l} ${b}H${-b}V${b - l}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="500" viewBox="0 0 1280 500" role="img" aria-label="Josué Rincón. Software engineering student, product builder, full-stack developer, AI and HCI explorer. Building ideas into technology. An original armored figure made of binary digits, powered by a microchip, assembles on the right. {{PROJECTS}} projects, {{TECHS}} technologies.">
<defs>
<pattern id="mi" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="{{GRID}}" stroke-width=".5"/></pattern>
<pattern id="ma" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="url(#mi)"/><path d="M80 0H0V80" fill="none" stroke="{{GRID2}}"/></pattern>
<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="{{BG}}" stop-opacity=".97"/><stop offset=".7" stop-color="{{BG}}" stop-opacity=".75"/><stop offset="1" stop-color="{{BG}}" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx="${cx}" cy="${cy}" r="360" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{{ACCENT}}" stop-opacity="{{GLOWOP}}"/><stop offset="1" stop-color="{{ACCENT}}" stop-opacity="0"/></radialGradient>
<linearGradient id="scanv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{ACCENT}}" stop-opacity="0"/><stop offset=".85" stop-color="{{ACCENT}}" stop-opacity="{{SCANOP}}"/><stop offset="1" stop-color="{{ACCENT}}" stop-opacity=".9"/></linearGradient>
<clipPath id="frame"><rect x="25" y="25" width="1230" height="450"/></clipPath>
<clipPath id="sil">${F.clip}</clipPath>
</defs>
<style>${FONTS}
.lbl{font-size:12px;letter-spacing:1.8px;fill:{{MUTED}}}
.rl{font-size:10px;letter-spacing:1px;fill:{{MUTED}};opacity:.8}
.chip{font-size:12px;letter-spacing:1.8px;fill:{{ACCENT}}}
.name{font-size:84px;font-weight:650;letter-spacing:-2.8px;fill:{{TEXT}}}
.rp{font-size:16px;letter-spacing:3.4px;fill:{{MUTED}}}
.role{font-size:16px;letter-spacing:3.4px;fill:{{ACCENT}}}
.tag{font-size:30px;fill:{{TEXT}};opacity:.82}
.num{font-size:36px;font-weight:600;letter-spacing:-.5px;fill:{{TEXT}}}
.cap{font-size:12px;letter-spacing:1.8px;fill:{{MUTED}}}
.tb{font-size:11px;letter-spacing:1.6px;fill:{{MUTED}}}
.tv{font-size:14px;letter-spacing:1px;fill:{{TEXT}}}
.hh{font-size:12px;letter-spacing:2px;fill:{{ACCENT}}}
.hk{font-size:12px;letter-spacing:1.4px;fill:{{MUTED}}}
.hv{font-size:12px;letter-spacing:1.2px;fill:{{TEXT}}}
.bin text{font-family:'JetBrains Mono','Cascadia Code',ui-monospace,Consolas,Menlo,monospace;font-size:10px;font-weight:{{BINW}}}
.b1{fill:{{BIN1}};fill-opacity:{{BIN1OP}}}.b2{fill:{{BIN2}};fill-opacity:{{BIN2OP}}}.b3{fill:{{BIN3}}}
.olp{fill:none;stroke:{{ACCENT}};stroke-opacity:{{OLOP}};stroke-width:1;stroke-dasharray:1;animation:ol 2.2s cubic-bezier(.6,0,.2,1) .5s both}
@keyframes ol{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.old{fill:none;stroke:{{ACCENT}};stroke-opacity:{{OLOP}};stroke-width:1}
.as{animation:as .45s ease-out both}
@keyframes as{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
.in{animation:in .7s ease-out both}
@keyframes in{from{opacity:0}to{opacity:1}}
.fb0,.fb1,.fb2,.fb3{opacity:0}
.fa0,.fa1,.fa2,.fa3{animation:fa 2.2s steps(1) infinite both}.fb0,.fb1,.fb2,.fb3{animation:fb 2.2s steps(1) infinite both}
.fa1,.fb1{animation-duration:3.1s;animation-delay:.5s}.fa2,.fb2{animation-duration:1.7s;animation-delay:.9s}.fa3,.fb3{animation-duration:2.6s;animation-delay:1.3s}
@keyframes fa{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes fb{0%,49%{opacity:0}50%,100%{opacity:1}}
.vz{animation:vz 4s ease-out 5 forwards}
@keyframes vz{0%,14%,100%{opacity:1}3%,9%{opacity:.15}6%{opacity:1}}
.sp{animation:sp3 4s ease-out 5 forwards}.b2.sp{animation-name:sp2}
@keyframes sp3{0%{fill:{{PULSE}}}12%,100%{fill:{{BIN3}}}}
@keyframes sp2{0%{fill:{{PULSE}}}12%,100%{fill:{{BIN2}}}}
.fl{animation:fl 2.4s linear infinite both}
@keyframes fl{0%{transform:translateY(-12px);opacity:0}25%{opacity:1}100%{transform:translateY(16px);opacity:0}}
.cl{animation:cl 1.6s steps(2) infinite}
@keyframes cl{0%{opacity:1}50%{opacity:.55}}
.scan{opacity:0;animation:scan 7s linear .25s 2 both}
@keyframes scan{0%{transform:translateY(-40px);opacity:1}${scanEnd}%{transform:translateY(${frontY}px);opacity:1}${(+scanEnd + 4).toFixed(1)}%,100%{transform:translateY(${frontY}px);opacity:0}}
.glow{animation:glow 2.4s ease-in-out 1.6s 4 both}
@keyframes glow{0%,100%{opacity:1}50%{opacity:.55}}
.burst{opacity:0;transform-box:fill-box;transform-origin:center;animation:burst 4s ease-out 1.6s 3}
@keyframes burst{0%{transform:scale(1);opacity:.8}70%,100%{transform:scale(2.4);opacity:0}}
.cur{animation:cur 1.1s steps(1) infinite}
@keyframes cur{50%{opacity:0}}
.ants{animation:ants 1.2s linear 8}
@keyframes ants{to{stroke-dashoffset:-20}}
.draw{stroke-dasharray:520;animation:draw 1.6s cubic-bezier(.6,0,.2,1) .4s both}
@keyframes draw{from{stroke-dashoffset:520}to{stroke-dashoffset:0}}
.wipe{animation:wipe 1.4s cubic-bezier(.6,0,.2,1) 1s both}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.rw{opacity:0;animation:role 12s infinite both}.r0{opacity:1}
@keyframes role{0%{opacity:0;transform:translateY(10px)}3%,22%{opacity:1;transform:translateY(0)}25%,100%{opacity:0;transform:translateY(-10px)}}
.led{opacity:0;transform-box:fill-box;transform-origin:center;animation:led 2s ease-out 8}
@keyframes led{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(2.8)}}
@media (max-width:600px){.hud,.tblk,.rl{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<rect width="1280" height="500" fill="{{BG}}"/>
<rect width="1280" height="500" fill="url(#ma)"/>
<rect width="1280" height="500" fill="url(#glow)"/>
<rect width="640" height="500" fill="url(#fade)"/>
<g clip-path="url(#frame)">
<g transform="translate(${cx} ${cy})"><g class="in" style="animation-delay:.3s">
<path d="${brackets}" fill="none" stroke="{{ACCENT}}" stroke-opacity=".8" stroke-width="1.5"/>
<rect class="ants" x="-62" y="-62" width="124" height="124" fill="none" stroke="{{BLUE}}" stroke-opacity=".55" stroke-dasharray="6 4"/>
</g></g>
<g class="bin" transform="translate(${OX} ${OY})">
${F.digits}
<g class="in" style="animation-delay:1.25s">${F.flows}</g>
<g>${F.outline}</g>
${F.front ? `<g class="in" style="animation-delay:1.2s"><g class="cl"><rect x="${F.front.x0}" y="${F.front.y - 9}" width="${F.front.x1 - F.front.x0}" height="9" fill="url(#scanv)" opacity=".7"/><rect x="${F.front.x0}" y="${F.front.y - 1}" width="${F.front.x1 - F.front.x0}" height="2" fill="{{ACCENT}}"/></g></g>` : ""}
<g clip-path="url(#sil)"><g class="scan"><rect x="0" y="-40" width="${F.w}" height="40" fill="url(#scanv)"/></g></g>
</g>
<g transform="translate(${cx} ${cy})">${chip()}</g>
${panelL}
${panelR}
</g>
<rect x="24.5" y="24.5" width="1231" height="451" fill="none" stroke="{{GRID2}}"/>
<path d="${ticks}" stroke="{{GRID2}}"/>
${marks}
<path d="M25 47V25h22M1233 25h22v22M25 453v22h22M1233 475h22v-22" fill="none" stroke="{{ACCENT}}" stroke-width="1.5"/>
<text class="mono lbl" x="72" y="88">FIG. 00 — DEVELOPER IDENTITY</text>
<g class="in" style="animation-delay:.1s">
<rect x="72.5" y="110.5" width="330" height="28" rx="14" fill="none" stroke="{{ACCENT}}" stroke-opacity=".45"/>
<circle cx="90" cy="124.5" r="4" fill="{{ACCENT}}"/><circle class="led" cx="90" cy="124.5" r="4" fill="{{ACCENT}}"/>
<text class="mono chip" x="104" y="129">BUILDING · SYNDES + ANILLO LAB</text>
</g>
<text class="sans name in" style="animation-delay:.2s" x="72" y="222" textLength="520" lengthAdjust="spacing">Josué Rincón</text>
<path d="M72 244V256M592 244V256" stroke="{{MUTED}}"/>
<path class="draw" d="M72 250H592" stroke="{{ACCENT}}" stroke-width="1.5"/>
<path class="in" style="animation-delay:1.7s" d="M72 250l8-3.5v7zM592 250l-8-3.5v7z" fill="{{ACCENT}}"/>
<text class="mono rp" x="72" y="290">ROLE /</text>
${roles}
<text class="sans tag wipe" x="72" y="346">Building ideas into technology.</text>
<path d="M72 380.5H690M72 380V374M232 380V374M392 380V374M552 380V374" stroke="{{GRID2}}"/>
${stats}
<g class="mono tblk">
<rect x="1085.5" y="25.5" width="170" height="48" fill="{{BG}}" fill-opacity=".85"/>
<path d="M1085.5 25V74M1085 73.5H1255M1170.5 25V74" stroke="{{GRID2}}"/>
<text class="tb" x="1097" y="43">DWG</text><text class="tv" x="1097" y="63">JR-001</text>
<text class="tb" x="1182" y="43">SHEET</text><text class="tv" x="1182" y="63">01/{{SHEETS}}</text>
</g>
</svg>`;
}
