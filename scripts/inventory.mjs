// Inventario de tecnologías: en cuántos proyectos aparece cada una y cuánto
// código hay por lenguaje. Lee los repos del usuario (también los privados,
// por eso necesita un token con alcance "repo") y los proyectos manuales de
// design/inventory.config.json. Solo guarda totales: ningún nombre de repo
// privado sale en el resultado.
//
// Uso: GITHUB_TOKEN=$(gh auth token) node scripts/inventory.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const cfg = JSON.parse(readFileSync(new URL("design/inventory.config.json", root)));
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("Falta GITHUB_TOKEN");

async function gh(path, raw = false) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "User-Agent": "profile-inventory",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return raw ? res.text() : res.json();
}

// dependencia de package.json -> [nombre, tipo]
const DEPS = {
  astro: ["Astro", "Framework"],
  react: ["React", "Library"],
  next: ["Next.js", "Framework"],
  expo: ["Expo", "Mobile"],
  "react-native": ["React Native", "Mobile"],
  electron: ["Electron", "Desktop"],
  "@capacitor/core": ["Capacitor", "Mobile"],
  tailwindcss: ["Tailwind CSS", "Styling"],
  "@tailwindcss/vite": ["Tailwind CSS", "Styling"],
  "@tailwindcss/postcss": ["Tailwind CSS", "Styling"],
  bootstrap: ["Bootstrap", "Styling"],
  express: ["Express", "Backend"],
  fastify: ["Fastify", "Backend"],
  mongoose: ["MongoDB", "Database"],
  mongodb: ["MongoDB", "Database"],
  pg: ["PostgreSQL", "Database"],
  postgres: ["PostgreSQL", "Database"],
  "@supabase/supabase-js": ["Supabase", "Database"],
  "@supabase/ssr": ["Supabase", "Database"],
  prisma: ["Prisma", "Database"],
  "@prisma/client": ["Prisma", "Database"],
  "drizzle-orm": ["Drizzle", "Database"],
  firebase: ["Firebase", "Database"],
  dexie: ["IndexedDB", "Database"],
  idb: ["IndexedDB", "Database"],
  minio: ["MinIO", "Storage"],
  zod: ["Zod", "Validation"],
  nanostores: ["Nanostores", "State"],
  zustand: ["Zustand", "State"],
  "@reduxjs/toolkit": ["Redux", "State"],
  "react-router-dom": ["React Router", "Library"],
  "react-router": ["React Router", "Library"],
  "@tanstack/react-query": ["TanStack Query", "Library"],
  vite: ["Vite", "Tooling"],
  esbuild: ["esbuild", "Tooling"],
  eslint: ["ESLint", "Tooling"],
  prettier: ["Prettier", "Tooling"],
  vitest: ["Vitest", "Testing"],
  "@playwright/test": ["Playwright", "Testing"],
  playwright: ["Playwright", "Testing"],
  cypress: ["Cypress", "Testing"],
  jest: ["Jest", "Testing"],
  "@google/genai": ["Gemini API", "AI"],
  "@google/generative-ai": ["Gemini API", "AI"],
  openai: ["OpenAI API", "AI"],
  three: ["Three.js", "Graphics"],
  "framer-motion": ["Motion", "Animation"],
  motion: ["Motion", "Animation"],
  animejs: ["Anime.js", "Animation"],
  gsap: ["GSAP", "Animation"],
  "socket.io": ["Socket.IO", "Realtime"],
  "socket.io-client": ["Socket.IO", "Realtime"],
  jose: ["JWT", "Security"],
  jsonwebtoken: ["JWT", "Security"],
  recharts: ["Recharts", "Data viz"],
  "chart.js": ["Chart.js", "Data viz"],
  leaflet: ["Leaflet", "Maps"],
  "@capacitor-community/bluetooth-le": ["Bluetooth LE", "Hardware"],
};
const PREFIXES = [
  ["@mediapipe/", ["MediaPipe", "AI"]],
  ["@radix-ui/", ["shadcn/ui", "UI"]],
];
const NODE_SIGNALS = ["express", "fastify", "@astrojs/node", "next", "electron", "mongoose", "mongodb", "pg", "socket.io", "minio", "nodemailer"];

// requirements.txt -> [nombre, tipo]
const PY = {
  flask: ["Flask", "Backend"],
  fastapi: ["FastAPI", "Backend"],
  django: ["Django", "Backend"],
  numpy: ["NumPy", "Data"],
  pandas: ["pandas", "Data"],
  sympy: ["SymPy", "Data"],
  matplotlib: ["Matplotlib", "Data viz"],
  behave: ["Behave (BDD)", "Testing"],
  pytest: ["pytest", "Testing"],
};

// lenguaje de GitHub -> nombre en el inventario (null = solo cuenta en el volumen)
const LANGS = {
  TypeScript: "TypeScript", JavaScript: "JavaScript", Python: "Python",
  HTML: "HTML", CSS: "CSS", PLpgSQL: "SQL", Shell: "Shell",
  "C++": "C++", Astro: null, Dockerfile: null, Batchfile: null, Makefile: null,
};

const TYPES = {};
for (const [, [n, t]] of [...Object.entries(DEPS), ...PREFIXES, ...Object.entries(PY)]) TYPES[n] = t;
Object.assign(TYPES, {
  TypeScript: "Language", JavaScript: "Language", Python: "Language", HTML: "Language", CSS: "Language",
  SQL: "Language", Shell: "Language", "C++": "Language", "Node.js": "Runtime", Docker: "Infra",
  Caddy: "Infra", Nginx: "Infra", "GitHub Actions": "Infra", pnpm: "Tooling", npm: "Tooling",
  "Gherkin (BDD)": "Testing",
});

const usage = new Map(); // tecnología -> nº de proyectos
const langBytes = new Map();
let projects = 0;

function count(set) {
  for (const t of set) usage.set(t, (usage.get(t) || 0) + 1);
}

async function scanRepo(repo) {
  const full = repo.full_name;
  const techs = new Set();

  const langs = (await gh(`repos/${full}/languages`)) || {};
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  for (const [lang, bytes] of Object.entries(langs)) {
    langBytes.set(lang, (langBytes.get(lang) || 0) + bytes);
    const name = lang in LANGS ? LANGS[lang] : undefined;
    if (name && (bytes / total > 0.02 || bytes > 4000)) techs.add(name);
    if (lang === "Gherkin") techs.add("Gherkin (BDD)");
  }

  const tree = await gh(`repos/${full}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
  const paths = (tree?.tree || []).map((e) => e.path).filter((p) => !/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(p));
  const has = (re) => paths.some((p) => re.test(p));

  if (has(/(^|\/)(Dockerfile[^/]*|(docker-)?compose[^/]*\.ya?ml)$/i)) techs.add("Docker");
  if (has(/(^|\/)Caddyfile[^/]*$/)) techs.add("Caddy");
  if (has(/(^|\/)nginx(\/|[^/]*\.conf$)/i)) techs.add("Nginx");
  if (has(/^\.github\/workflows\//)) techs.add("GitHub Actions");
  if (has(/(^|\/)pnpm-lock\.yaml$/)) techs.add("pnpm");
  else if (has(/(^|\/)package-lock\.json$/)) techs.add("npm");
  if (has(/(^|\/)components\.json$/)) techs.add("shadcn/ui");
  if (has(/(^|\/)capacitor\.config\.(json|ts)$/)) techs.add("Capacitor");

  const read = (p) => gh(`repos/${full}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`, true);

  for (const p of paths.filter((p) => /(^|\/)package\.json$/.test(p)).slice(0, 12)) {
    let pkg;
    try { pkg = JSON.parse(await read(p)); } catch { continue; }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const d of Object.keys(deps)) {
      if (DEPS[d]) techs.add(DEPS[d][0]);
      for (const [pre, [n]] of PREFIXES) if (d.startsWith(pre)) techs.add(n);
    }
    const scripts = Object.values(pkg.scripts || {}).join(" ");
    if (NODE_SIGNALS.some((s) => s in deps) || /\bnode\s/.test(scripts) || pkg.engines?.node) techs.add("Node.js");
  }

  for (const p of paths.filter((p) => /(^|\/)requirements[^/]*\.txt$/.test(p)).slice(0, 4)) {
    const txt = (await read(p)) || "";
    for (const line of txt.split(/\r?\n/)) {
      const name = line.trim().toLowerCase().split(/[<>=~\[; ]/)[0];
      if (PY[name]) techs.add(PY[name][0]);
    }
  }

  if (techs.size === 0) return false;
  count(techs);
  return true;
}

const own = [];
for (let page = 1; ; page++) {
  const batch = await gh(`user/repos?affiliation=owner&per_page=100&page=${page}`);
  own.push(...batch);
  if (batch.length < 100) break;
}
const repos = own.filter((r) => r.owner.login === cfg.owner && !r.fork && r.size > 0 && !cfg.exclude.includes(r.name));
for (const full of cfg.include) {
  const r = await gh(`repos/${full}`);
  if (r) repos.push(r);
}

for (const repo of repos) {
  if (await scanRepo(repo)) projects++;
}
for (const m of cfg.manual) {
  count(new Set(m.techs));
  projects++;
}

const techs = [...usage.entries()]
  .filter(([name]) => !(name in (cfg.ignore || {})))
  .map(([name, qty]) => ({ name, type: TYPES[name] || "Other", qty }))
  .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0);
const languages = [...langBytes.entries()]
  .map(([name, bytes]) => ({ name, bytes }))
  .sort((a, b) => b.bytes - a.bytes);

const out = {
  generated: new Date().toISOString().slice(0, 10),
  projects,
  technologies: techs.length,
  languageCount: languages.filter((l) => l.bytes / totalBytes >= 0.001).length,
  totalBytes,
  languages,
  techs,
};
mkdirSync(new URL("design/data/", root), { recursive: true });
writeFileSync(new URL("design/data/inventory.json", root), JSON.stringify(out, null, 2) + "\n");
console.log(`${projects} projects · ${techs.length} technologies · ${(totalBytes / 1e6).toFixed(1)} MB`);
console.log(techs.map((t) => `${t.qty}x ${t.name} (${t.type})`).join("\n"));
