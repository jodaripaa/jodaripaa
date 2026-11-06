// Genera assets/activity-dark.svg y assets/activity-light.svg: el calendario de
// contribuciones de los últimos 12 meses en la paleta Blueprint, con métricas
// calculadas del mismo calendario.
// Uso: GITHUB_TOKEN=... node scripts/activity.mjs [usuario]
import { writeFileSync, mkdirSync } from "node:fs";

const user = process.argv[2] || process.env.GITHUB_REPOSITORY_OWNER || "jodaripaa";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("Falta GITHUB_TOKEN");

const query = `query($login:String!){ user(login:$login){ contributionsCollection {
  contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-activity" },
  body: JSON.stringify({ query, variables: { login: user } }),
});
const json = await res.json();
if (json.errors) throw new Error(JSON.stringify(json.errors));
const cal = json.data.user.contributionsCollection.contributionCalendar;

const THEMES = {
  dark: { surface: "#0D1119", border: "#1E2636", grid: "#121826", text: "#E8EDF5", muted: "#6B7790", accent: "#00D4FF", empty: "#141A26", scale: ["#0B3A4A", "#006C88", "#00A3C7", "#00D4FF"] },
  light: { surface: "#FFFFFF", border: "#D3DAE6", grid: "#E9EDF4", text: "#090B10", muted: "#66728A", accent: "#0077B6", empty: "#EEF1F6", scale: ["#BDE3F2", "#6CC3E6", "#1E95C8", "#0077B6"] },
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// ── métricas
const days = cal.weeks.flatMap((w) => w.contributionDays);
const active = days.filter((d) => d.contributionCount > 0).length;
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
const byDow = Array(7).fill(0);
const byMonth = new Map();
for (const d of days) {
  byDow[new Date(`${d.date}T00:00:00Z`).getUTCDay()] += d.contributionCount;
  const k = d.date.slice(0, 7);
  byMonth.set(k, (byMonth.get(k) || 0) + d.contributionCount);
}
const busiest = cal.totalContributions ? DOW[byDow.indexOf(Math.max(...byDow))].slice(0, 3) : "—";
const peakKey = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const peak = cal.totalContributions && peakKey ? `${MONTHS[+peakKey.slice(5, 7) - 1]} ${peakKey.slice(0, 4)}` : "—";

const counts = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
const q = (p) => (counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 1);
const cuts = [q(0.25), q(0.5), q(0.75)];
const level = (c) => (c === 0 ? -1 : c <= cuts[0] ? 0 : c <= cuts[1] ? 1 : c <= cuts[2] ? 2 : 3);

// ── geometría
const W = 1280, gap = 4, x0 = 40, y0 = 112;
const cell = Math.floor((W - 2 * x0 + gap) / cal.weeks.length) - gap;
const statsY = y0 + 7 * (cell + gap) + 30;
const H = statsY + 84;
const updated = new Date().toISOString().slice(0, 10);

function svg(t) {
  const cols = [];
  let lastMonth = -1;
  cal.weeks.forEach((w, i) => {
    const x = x0 + i * (cell + gap);
    const m = new Date(`${w.contributionDays[0].date}T00:00:00Z`).getUTCMonth();
    let label = "";
    if (m !== lastMonth && i < cal.weeks.length - 2) {
      label = `<text class="m" x="${x}" y="${y0 - 14}">${MONTHS[m]}</text>`;
      lastMonth = m;
    }
    const rects = w.contributionDays.map((d) => {
      const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      const l = level(d.contributionCount);
      return `<rect x="${x}" y="${y0 + dow * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${l < 0 ? t.empty : t.scale[l]}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
    }).join("");
    cols.push(`${label}<g class="wk" style="animation-delay:${i * 14}ms">${rects}</g>`);
  });

  const stats = [[active, "ACTIVE DAYS"], [`${longest}d`, "LONGEST STREAK"], [busiest, "BUSIEST WEEKDAY"], [peak, "PEAK MONTH"]]
    .map(([v, k], i) => `<text class="n" x="${40 + i * 240}" y="${statsY + 34}">${v}</text><text class="mono f" x="${40 + i * 240}" y="${statsY + 58}">${k}</text>`).join("");
  const lx = W - 40 - 44 - 5 * 21;
  const legend = [t.empty, ...t.scale].map((c, i) => `<rect x="${lx + i * 21}" y="${statsY + 20}" width="17" height="17" rx="3" fill="${c}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cal.totalContributions} contributions in the last 12 months. ${active} active days, longest streak ${longest} days.">
<style>.mono{font-family:'JetBrains Mono','Cascadia Code',ui-monospace,Consolas,Menlo,monospace}
.f{font-size:13px;letter-spacing:2px;fill:${t.muted}}
.fig{font-size:15px;letter-spacing:2px;fill:${t.muted}}
.n{font-family:'Inter','Segoe UI',-apple-system,Arial,sans-serif;font-size:30px;font-weight:600;letter-spacing:-.5px;fill:${t.text}}
.tot{font-family:'Inter','Segoe UI',-apple-system,Arial,sans-serif;font-size:34px;font-weight:600;fill:${t.text}}
.m{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace;font-size:13px;letter-spacing:1.5px;fill:${t.muted}}
.wk{animation:wk .5s ease-out both}
@keyframes wk{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.wk{animation:none}}</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${t.surface}" stroke="${t.border}" stroke-width="2"/>
<path d="M2 64H${W - 2}" stroke="${t.border}" stroke-width="1.5"/>
<text class="mono fig" x="40" y="40">FIG. 07 — ACTIVITY · LAST 12 MONTHS</text>
<text class="tot" x="${W - 40}" y="46" text-anchor="end">${cal.totalContributions.toLocaleString("en-US")}<tspan class="mono f" dx="12">CONTRIBUTIONS</tspan></text>
${cols.join("\n")}
<path d="M40 ${statsY - 6}H${W - 40}" stroke="${t.grid}" stroke-width="1.5"/>
${stats}
<text class="m" x="${lx - 12}" y="${statsY + 33}" text-anchor="end">LESS</text>${legend}<text class="m" x="${W - 40}" y="${statsY + 33}" text-anchor="end">MORE</text>
<text class="mono f" x="${W - 40}" y="${statsY + 58}" text-anchor="end">UPDATED ${updated}</text>
</svg>`;
}

mkdirSync("assets", { recursive: true });
for (const [name, t] of Object.entries(THEMES)) writeFileSync(`assets/activity-${name}.svg`, svg(t));
console.log(`${user}: ${cal.totalContributions} contributions · ${active} active days · streak ${longest}`);
