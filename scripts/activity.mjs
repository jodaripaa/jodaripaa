// Genera assets/activity-dark.svg y assets/activity-light.svg con el calendario
// de contribuciones de los últimos 12 meses, en la paleta Blueprint.
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

const themes = {
  dark:  { surface: "#0D1119", border: "#1E2636", text: "#E8EDF5", muted: "#6B7790", empty: "#141A26", scale: ["#0B3A4A", "#006C88", "#00A3C7", "#00D4FF"] },
  light: { surface: "#FFFFFF", border: "#D3DAE6", text: "#090B10", muted: "#66728A", empty: "#EEF1F6", scale: ["#BDE3F2", "#6CC3E6", "#1E95C8", "#0077B6"] },
};

const counts = cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b);
const q = (p) => counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 1;
const cuts = [q(0.25), q(0.5), q(0.75)];
const level = (c) => (c === 0 ? -1 : c <= cuts[0] ? 0 : c <= cuts[1] ? 1 : c <= cuts[2] ? 2 : 3);

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const W = 1280, gap = 4, x0 = 40, y0 = 110;
const cell = Math.floor((W - 2 * x0 + gap) / cal.weeks.length) - gap;
const H = y0 + 7 * (cell + gap) + 56;

function svg(t) {
  const out = [];
  let lastMonth = -1;
  cal.weeks.forEach((w, i) => {
    const x = x0 + i * (cell + gap);
    const first = w.contributionDays[0];
    const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth && i < cal.weeks.length - 2) {
      out.push(`<text class="m" x="${x}" y="${y0 - 14}">${MONTHS[m]}</text>`);
      lastMonth = m;
    }
    w.contributionDays.forEach((d) => {
      const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
      const l = level(d.contributionCount);
      out.push(`<rect x="${x}" y="${y0 + dow * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${l < 0 ? t.empty : t.scale[l]}"><title>${d.date}: ${d.contributionCount}</title></rect>`);
    });
  });
  const lx = W - 40 - 60 - 5 * 21;
  const legend = [t.empty, ...t.scale].map((c, i) => `<rect x="${lx + i * 21}" y="${H - 38}" width="17" height="17" rx="3" fill="${c}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cal.totalContributions} contributions in the last year">
<style>.mono{font-family:'JetBrains Mono','Cascadia Code',ui-monospace,Consolas,Menlo,monospace}.f{font-size:15px;letter-spacing:2px;fill:${t.muted}}.n{font-size:30px;font-weight:600;fill:${t.text};font-family:'Inter','Segoe UI',-apple-system,Arial,sans-serif}.m{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace;font-size:13px;letter-spacing:1.5px;fill:${t.muted}}</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${t.surface}" stroke="${t.border}" stroke-width="2"/>
<text class="mono f" x="40" y="48">FIG. 05 — ACTIVITY · LAST 12 MONTHS</text>
<text class="n" x="${W - 40}" y="52" text-anchor="end">${cal.totalContributions.toLocaleString("en-US")}<tspan class="mono f" dx="12">CONTRIBUTIONS</tspan></text>
${out.join("\n")}
<text class="mono f" x="40" y="${H - 24}">UPDATED ${new Date().toISOString().slice(0, 10)}</text>
<text class="m" x="${lx - 12}" y="${H - 25}" text-anchor="end">LESS</text>${legend}<text class="m" x="${W - 40}" y="${H - 25}" text-anchor="end">MORE</text>
</svg>`;
}

mkdirSync("assets", { recursive: true });
for (const [name, t] of Object.entries(themes)) writeFileSync(`assets/activity-${name}.svg`, svg(t));
console.log(`${user}: ${cal.totalContributions} contributions`);
