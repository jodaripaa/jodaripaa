// Genera todas las piezas visuales del perfil, en versión oscura y clara.
//  - Plantillas: design/src/*.svg con marcadores {{TOKEN}} (fichas de proyecto).
//  - Piezas generadas aquí: banner, inventario (BOM), encabezados de hoja,
//    tablero "Now" y cajetín final.
// Datos: design/data/inventory.json, que produce scripts/inventory.mjs.
// Uso: node design/build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { banner } from "./banner.mjs";

const root = new URL("../", import.meta.url);
const inv = JSON.parse(readFileSync(new URL("design/data/inventory.json", root)));
const OUT = new URL("assets/", root);
mkdirSync(OUT, { recursive: true });

const THEMES = {
  dark: {
    BG: "#090B10", SURFACE: "#0D1119", PLATE: "#0F1522", PLATE2: "#0A0F18", GRID: "#121826", GRID2: "#1E2636",
    TEXT: "#E8EDF5", MUTED: "#6B7790", ACCENT: "#00D4FF", BLUE: "#526BFF", GLOWOP: ".16", SCANOP: ".07",
    BIN1: "#00D4FF", BIN1OP: ".30", BIN2: "#00D4FF", BIN2OP: ".66", BIN3: "#C9F6FF", BINW: "400", OLOP: ".55", GLOW1OP: ".16", GLOW2OP: ".07", COREFILL: "#0B2530", PULSE: "#FFFFFF",
  },
  light: {
    BG: "#F6F8FB", SURFACE: "#FFFFFF", PLATE: "#FFFFFF", PLATE2: "#E6ECF5", GRID: "#E9EDF4", GRID2: "#D3DAE6",
    TEXT: "#090B10", MUTED: "#66728A", ACCENT: "#0077B6", BLUE: "#3A50E0", GLOWOP: ".035", SCANOP: ".06",
    BIN1: "#0077B6", BIN1OP: ".48", BIN2: "#005F92", BIN2OP: ".9", BIN3: "#00324D", BINW: "700", OLOP: ".85", GLOW1OP: ".10", GLOW2OP: ".045", COREFILL: "#DDF3FB", PULSE: "#00A3E0",
  },
};

const DATA = {
  PROJECTS: inv.projects,
  TECHS: inv.technologies,
  LANGS: inv.languageCount,
  REV: inv.generated.slice(0, 7).replace("-", "."),
  UPDATED: inv.generated,
  SHEETS: "05",
};

const FONTS = ".sans{font-family:'Inter','Segoe UI Variable Display','Segoe UI',-apple-system,'Helvetica Neue',Arial,sans-serif}" +
  ".mono{font-family:'JetBrains Mono','Cascadia Code',ui-monospace,Consolas,Menlo,monospace}";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fill = (tpl, t) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in t ? t[k] : k in DATA ? DATA[k] : m));

function write(name, svg) {
  for (const [mode, t] of Object.entries(THEMES)) {
    const out = fill(svg, t);
    const left = out.match(/\{\{\w+\}\}/);
    if (left) throw new Error(`Marcador sin resolver ${left[0]} en ${name}`);
    writeFileSync(new URL(`${name}-${mode}.svg`, OUT), out);
  }
}

/* ───────────── Encabezado de hoja ───────────── */
function sheet(n, title, meta) {
  let ticks = "";
  for (let x = 0; x <= 1280; x += 40) ticks += `M${x + 0.5} ${x % 200 === 0 ? 102 : 106}V110`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="120" viewBox="0 0 1280 120" role="img" aria-label="${esc(title)}">
<style>${FONTS}
.n{font-size:86px;font-weight:600;letter-spacing:-3px;fill:none;stroke:{{ACCENT}};stroke-width:1.3}
.s{font-size:13px;letter-spacing:2.4px;fill:{{MUTED}}}
.t{font-size:42px;font-weight:600;letter-spacing:-1.2px;fill:{{TEXT}}}
.m{font-size:13px;letter-spacing:2.2px;fill:{{MUTED}}}
.draw{transform-box:fill-box;transform-origin:0 50%;animation:draw 1.2s cubic-bezier(.6,0,.2,1) .2s both}
@keyframes draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.draw{animation:none}}
</style>
<text class="sans n" x="2" y="92">${n}</text>
<text class="mono s" x="136" y="40">SHEET ${n} / {{SHEETS}}</text>
<text class="sans t" x="134" y="88">${esc(title)}</text>
<text class="mono m" x="1278" y="88" text-anchor="end">${esc(meta)}</text>
<path d="${ticks}" stroke="{{GRID2}}"/>
<path d="M0 110.5H1280" stroke="{{GRID2}}"/>
<rect class="draw" x="0" y="109" width="420" height="3" fill="{{ACCENT}}"/>
</svg>`;
}

/* ───────────── Inventario (Bill of Materials) ───────────── */
function bom() {
  const GROUPS = [
    ["A", "LANGUAGES & RUNTIME", ["Language", "Runtime"]],
    ["B", "FRONTEND", ["Framework", "Library", "Styling", "UI", "State", "Animation", "Graphics", "Maps"]],
    ["C", "BACKEND & DATA", ["Backend", "Database", "Storage", "Validation", "Security", "Realtime", "Data", "Data viz"]],
    ["D", "MOBILE · DESKTOP · HARDWARE", ["Mobile", "Desktop", "Hardware"]],
    ["E", "AI", ["AI"]],
    ["F", "TESTING", ["Testing"]],
    ["G", "INFRA & TOOLING", ["Infra", "Tooling", "Other"]],
  ];
  const groups = GROUPS.map(([id, label, types]) => ({ id, label, items: inv.techs.filter((t) => types.includes(t.type)) }))
    .filter((g) => g.items.length);
  const weight = (g) => g.items.length + 1.5;
  const total = groups.reduce((a, g) => a + weight(g), 0);
  const cols = [[], [], []];
  let c = 0, acc = 0;
  for (const g of groups) {
    if (c < 2 && acc > 0 && acc + weight(g) / 2 > total / 3) { c++; acc = 0; }
    cols[c].push(g);
    acc += weight(g);
  }

  const maxQty = Math.max(...inv.techs.map((t) => t.qty));
  const ROW = 30, HEAD = 46, TOP = 300, COLW = 374;
  let idx = 0, maxY = TOP;
  const rows = [];
  cols.forEach((col, ci) => {
    const x = 40 + ci * 413;
    let y = TOP;
    for (const g of col) {
      rows.push(`<text class="mono gh" x="${x}" y="${y + 22}">${g.id} · ${esc(g.label)}</text><text class="mono qh" x="${x + COLW}" y="${y + 22}" text-anchor="end">QTY</text><path d="M${x} ${y + 33.5}H${x + COLW}" stroke="{{GRID2}}"/>`);
      y += HEAD;
      for (const t of g.items) {
        idx++;
        const w = Math.max(4, Math.round((t.qty / maxQty) * 96));
        const color = t.qty >= 10 ? "{{ACCENT}}" : t.qty >= 4 ? "{{BLUE}}" : "{{MUTED}}";
        rows.push(`<text class="mono pn" x="${x}" y="${y + 19}">P-${String(idx).padStart(2, "0")}</text><text class="sans nm" x="${x + 46}" y="${y + 20}">${esc(t.name)}</text><rect x="${x + 238}" y="${y + 11}" width="96" height="6" rx="3" fill="{{GRID}}"/><rect class="bar" style="animation-delay:${(0.3 + idx * 0.025).toFixed(3)}s" x="${x + 238}" y="${y + 11}" width="${w}" height="6" rx="3" fill="${color}"/><text class="mono qty" x="${x + COLW}" y="${y + 20}" text-anchor="end">${t.qty}</text><path d="M${x} ${y + 29.5}H${x + COLW}" stroke="{{GRID}}"/>`);
        y += ROW;
      }
      y += 12;
    }
    maxY = Math.max(maxY, y);
  });

  const tb = inv.totalBytes;
  const topLangs = inv.languages.slice(0, 5);
  const other = tb - topLangs.reduce((a, l) => a + l.bytes, 0);
  const segs = [...topLangs.map((l) => [l.name, l.bytes]), ["Other", other]].filter(([, b]) => b > 0);
  const SEG = [["{{ACCENT}}", 1], ["{{BLUE}}", 1], ["{{ACCENT}}", 0.5], ["{{BLUE}}", 0.5], ["{{MUTED}}", 0.8], ["{{GRID2}}", 1]];
  let sx = 40;
  const bar = segs.map(([, b], i) => {
    const w = Math.max(3, (1200 * b) / tb);
    const r = `<rect x="${sx.toFixed(1)}" y="210" width="${Math.max(2, w - 2).toFixed(1)}" height="14" rx="3" fill="${SEG[i][0]}" fill-opacity="${SEG[i][1]}"/>`;
    sx += w;
    return r;
  }).join("");
  const legend = segs.map(([n, b], i) => `<rect x="${40 + i * 200}" y="244" width="10" height="10" rx="2" fill="${SEG[i][0]}" fill-opacity="${SEG[i][1]}"/><text class="mono lg" x="${58 + i * 200}" y="253">${esc(n)} <tspan class="lgv">${((100 * b) / tb).toFixed(1)}%</tspan></text>`).join("");

  const stats = [[inv.projects, "PROJECTS"], [inv.technologies, "TECHNOLOGIES"], [inv.languageCount, "LANGUAGES"], [`${(tb / 1e6).toFixed(1)} MB`, "OF SOURCE CODE"]]
    .map(([v, k], i) => `<g class="in" style="animation-delay:${(0.1 + i * 0.12).toFixed(2)}s"><text class="sans big" x="${40 + i * 300}" y="134">${v}</text><text class="mono cap" x="${40 + i * 300}" y="160">${k}</text></g>`).join("");

  const H = maxY + 78;
  const tiers = [["{{ACCENT}}", "CORE · 10+ PROJECTS"], ["{{BLUE}}", "REGULAR · 4–9"], ["{{MUTED}}", "EXPLORED · 1–3"]]
    .map(([col, label], i) => `<rect x="${40 + i * 230}" y="${maxY + 12}" width="22" height="6" rx="3" fill="${col}"/><text class="mono cap" x="${70 + i * 230}" y="${maxY + 19}">${label}</text>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${H}" viewBox="0 0 1280 ${H}" role="img" aria-label="Bill of materials: ${inv.technologies} technologies across ${inv.projects} projects. ${esc(inv.techs.map((t) => `${t.name} ${t.qty}`).join(", "))}.">
<defs><pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="{{GRID}}" stroke-width=".5"/></pattern></defs>
<style>${FONTS}
.fig{font-size:15px;letter-spacing:2px;fill:{{MUTED}}}
.big{font-size:46px;font-weight:600;letter-spacing:-1.2px;fill:{{TEXT}}}
.cap{font-size:12px;letter-spacing:1.8px;fill:{{MUTED}}}
.lg{font-size:13px;letter-spacing:.6px;fill:{{TEXT}}}
.lgv{fill:{{MUTED}}}
.gh{font-size:13px;letter-spacing:2px;fill:{{ACCENT}}}
.qh{font-size:11px;letter-spacing:1.8px;fill:{{MUTED}}}
.pn{font-size:11px;letter-spacing:.8px;fill:{{MUTED}}}
.nm{font-size:18px;fill:{{TEXT}}}
.qty{font-size:15px;fill:{{TEXT}}}
.bar{transform-box:fill-box;transform-origin:0 50%;animation:grow .9s cubic-bezier(.3,0,.2,1) both}
.grow{transform-box:fill-box;transform-origin:0 50%;animation:grow 1.4s cubic-bezier(.6,0,.2,1) .2s both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.in{opacity:0;animation:in .6s ease-out forwards}
@keyframes in{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.bar,.grow{animation:none}.in{animation:none;opacity:1}}
</style>
<rect x="1" y="1" width="1278" height="${H - 2}" rx="14" fill="{{SURFACE}}" stroke="{{GRID2}}" stroke-width="2"/>
<rect x="2" y="2" width="1276" height="${H - 4}" rx="14" fill="url(#g)" opacity=".5"/>
<path d="M2 64H1278" stroke="{{GRID2}}" stroke-width="1.5"/>
<text class="mono fig" x="40" y="40">FIG. 05 — BILL OF MATERIALS</text>
<text class="mono fig" x="1240" y="40" text-anchor="end">UPDATED {{UPDATED}}</text>
${stats}
<text class="mono cap" x="40" y="198">CODE VOLUME BY LANGUAGE</text>
<g class="grow">${bar}</g>
${legend}
<path d="M40 282H1240" stroke="{{GRID2}}" stroke-width="1.5"/>
${rows.join("\n")}
${tiers}
<text class="mono cap" x="40" y="${maxY + 50}">QTY = PROJECTS THAT USE IT · SOURCE: PACKAGE MANIFESTS AND LANGUAGE STATS OF ${inv.projects} PROJECTS, PUBLIC AND PRIVATE</text>
</svg>`;
}

/* ───────────── Tablero "Now" ───────────── */
function now() {
  const cols = [
    ["BUILDING", "{{ACCENT}}", true, [["Syndes", "Getting it ready for its first businesses"], ["Anillo Lab", "From webcam gestures to the ring's hardware"]]],
    ["LEARNING", "{{BLUE}}", false, [["Software architecture", "Patterns, trade-offs and system design"], ["Embedded systems", "ESP32 · IMU · Bluetooth LE"]]],
    ["EXPLORING", "{{MUTED}}", false, [["AI inside products", "Gemini API in learning tools"], ["Gesture interfaces", "The hand as an input device"]]],
  ];
  const body = cols.map(([label, col, live, items], i) => {
    const x = 40 + i * 413;
    const led = live
      ? `<circle cx="${x + 6}" cy="112" r="6" fill="${col}"/><circle class="led" cx="${x + 6}" cy="112" r="6" fill="${col}"/>`
      : `<circle cx="${x + 6}" cy="112" r="5.5" fill="none" stroke="${col}" stroke-width="2"/>`;
    const list = items.map(([t, s], j) => `<text class="sans it" x="${x}" y="${172 + j * 82}">${esc(t)}</text><text class="sans st" x="${x}" y="${202 + j * 82}">${esc(s)}</text>`).join("");
    return `${i ? `<path d="M${x - 20} 96V300" stroke="{{GRID2}}"/>` : ""}${led}<text class="mono hd" x="${x + 22}" y="117" fill="${col}">${label}</text>${list}`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="330" viewBox="0 0 1280 330" role="img" aria-label="Now. Building: Syndes and Anillo Lab. Learning: software architecture and embedded systems. Exploring: AI inside products and gesture interfaces.">
<style>${FONTS}
.fig{font-size:15px;letter-spacing:2px;fill:{{MUTED}}}
.hd{font-size:15px;letter-spacing:2.4px}
.it{font-size:26px;font-weight:600;letter-spacing:-.4px;fill:{{TEXT}}}
.st{font-size:18px;fill:{{MUTED}}}
.led{opacity:0;animation:led 2s ease-out 8;transform-box:fill-box;transform-origin:center}
@keyframes led{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(2.8)}}
@media (prefers-reduced-motion:reduce){.led{display:none}}
</style>
<rect x="1" y="1" width="1278" height="328" rx="14" fill="{{SURFACE}}" stroke="{{GRID2}}" stroke-width="2"/>
<path d="M2 64H1278" stroke="{{GRID2}}" stroke-width="1.5"/>
<text class="mono fig" x="40" y="40">FIG. 06 — STATUS</text>
<text class="mono fig" x="1240" y="40" text-anchor="end">UPDATED {{UPDATED}}</text>
${body}
</svg>`;
}

/* ───────────── Cajetín final ───────────── */
function footer() {
  const cells = [["PROJECT", "DEVELOPER IDENTITY", 340], ["DRAWN BY", "JOSUÉ RINCÓN", 280], ["REV", "{{REV}}", 160], ["SHEETS", "{{SHEETS}}", 160], ["STATUS", "ALWAYS IN PROGRESS", 340]];
  let x = 0;
  const body = cells.map(([k, v, w], i) => {
    const cx = x + 28;
    const live = k === "STATUS";
    const s = `${i ? `<path d="M${x + 0.5} 20V130" stroke="{{GRID2}}"/>` : ""}<text class="mono k" x="${cx}" y="58">${k}</text>${live ? `<circle cx="${cx + 5}" cy="90" r="5" fill="{{ACCENT}}"/><circle class="led" cx="${cx + 5}" cy="90" r="5" fill="{{ACCENT}}"/>` : ""}<text class="mono v" x="${live ? cx + 20 : cx}" y="96">${v}</text>`;
    x += w;
    return s;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="150" viewBox="0 0 1280 150" role="img" aria-label="Title block. Developer identity, drawn by Josué Rincón, revision {{REV}}. Status: always in progress.">
<style>${FONTS}
.k{font-size:12px;letter-spacing:2px;fill:{{MUTED}}}
.v{font-size:19px;letter-spacing:1.4px;fill:{{TEXT}}}
.led{opacity:0;animation:led 2s ease-out 8;transform-box:fill-box;transform-origin:center}
@keyframes led{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(2.8)}}
@media (prefers-reduced-motion:reduce){.led{display:none}}
</style>
<rect x="1" y="20" width="1278" height="110" rx="10" fill="{{SURFACE}}" stroke="{{GRID2}}" stroke-width="2"/>
${body}
<path d="M1 20h22M1 20v22M1279 130h-22M1279 130v-22" stroke="{{ACCENT}}" stroke-width="2" fill="none"/>
</svg>`;
}

/* ───────────── Salida ───────────── */
write("banner", banner(root, inv));
write("sheet-02", sheet("02", "Selected work", "4 PROJECTS · 1 FEATURED"));
write("sheet-03", sheet("03", "Tech inventory", `${inv.projects} PROJECTS · ${inv.technologies} TECHNOLOGIES`));
write("sheet-04", sheet("04", "Now", "BUILDING · LEARNING · EXPLORING"));
write("sheet-05", sheet("05", "Activity", "LAST 12 MONTHS"));
write("bom", bom());
write("now", now());
write("footer", footer());
for (const f of readdirSync(new URL("design/src/", root)).filter((f) => f.endsWith(".svg"))) {
  write(f.replace(/\.svg$/, ""), readFileSync(new URL(`design/src/${f}`, root), "utf8"));
}
console.log("ok");
