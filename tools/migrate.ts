// One-off copy of the live plan (v52) into the v2 model. Read-only on every input.
// Usage: node tools/migrate.ts <v52 src/js dir> <plan-state.json> <coach dir> <out dir>
// Writes <out>/<collection>/<id>.json, one file per document, each checked against src/data/schema.ts.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { COLLECTIONS, type CollectionName } from "../src/data/schema.ts";

const [jsDir, statePath, coachDir, outDir] = process.argv.slice(2);
if (!outDir) { console.error("usage: node tools/migrate.ts <v52 js dir> <state.json> <coach dir> <out dir>"); process.exit(1); }
const read = (f: string) => readFileSync(f, "utf8");

// ---- pull the pieces of v52 we need out of its source, without running the page ----
function grab(src: string, start: string): string {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`not found: ${start}`);
  let j = src.indexOf("{", i), depth = 0;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) break;
  }
  let end = j + 1;
  while (src[end] === ";" || src[end] === ")" ) end++;
  return src.slice(i, end);
}
const planJs = read(join(jsDir, "01-plan.js"));
const gymJs = read(join(jsDir, "13-strength.js"));
const code = [
  read(join(jsDir, "00-data.js")).match(/const DATA = \[.*?\];/s)![0],
  grab(planJs, "const TYPE = {"),
  grab(planJs, "function spec("),
  grab(planJs, "function gen("),
  gymJs.match(/const GYM_FROM[^\n]*/)![0],
  grab(gymJs, "const GYM = {"),
  gymJs.match(/const GYM_HARD[^\n]*/)![0],
  gymJs.match(/const GYM_KEY[^\n]*/)![0],
  grab(gymJs, "function gymPlan("),
  read(join(jsDir, "13a-gymweights.js")).match(/const GYM_W = .*;/)![0],
  `const isoLocal = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");`,
  `const addDays = (iso, n) => { const d = new Date(iso+"T00:00:00"); d.setDate(d.getDate()+n); return isoLocal(d); };`,
  // gen() is only used for its fixed notes; paces in its text are not kept
  `const PROFILE = {z1:{fast:"",slow:""},z2:{fast:"",slow:""},z3:{fast:"",slow:""},rec:{fast:"",slow:""},thrHR:0,race:""};`,
  `globalThis.V52 = {DATA, TYPE, spec, gen, GYM, GYM_W, gymPlan};`,
].join("\n");
const ctx: any = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
const { DATA, TYPE, spec, gen, GYM, GYM_W, gymPlan } = ctx.V52;

const stateRaw = JSON.parse(read(statePath));
const state = stateRaw.data ?? stateRaw;
const toSec = (s: string) => { const [m, x] = s.split(":").map(Number); return m * 60 + x; };

const docs: Record<CollectionName, Record<string, unknown>> = {
  athlete: {}, goals: {}, thresholds: {}, workouts: {}, plan: {}, runs: {}, journal: {}, injuries: {}, layout: {},
};

// ---- athlete, goal, thresholds ----
const p = state.profile;
docs.athlete.me = {
  age: p.age, heightCm: p.height, weightKg: p.weight, sleepNormH: p.sleepNorm, vo2max: p.vo2max,
  hrZoneTops: p.hrZones, refRace: p.refRace ? { type: p.refRace.type, sec: p.refRace.t } : undefined,
};
const GOAL = "valencia-2027";
docs.goals[GOAL] = { name: "10K Valencia Ibercaja", date: "2027-01-10", km: 10, targetSec: toSec(p.race) * 10, role: "main" };
for (const t of state.thr) docs.thresholds[t.d] = { date: t.d, paceSec: toSec(t.pace), hr: p.thrHR, source: "coros" };

// ---- plan days: v52's base plan with its overrides applied, every change kept on the day ----
type Ev = { d: string; t: string; l: number; ph: string; cw: number };
const base: Ev[] = DATA;
const byDate = new Map(base.map(e => [e.d, e]));
const day: Record<string, { t: string; l: number; changes: any[] }> = {};
for (const e of base) day[e.d] = { t: e.t, l: e.l, changes: [] };
const wid = (t: string, l: number) => (["race", "tt5k", "pyramid", "start"].includes(t) ? t : `${t}-L${l}`);
for (const [a, b] of state.ovr.swaps as [string, string][]) {
  const x = day[a], y = day[b];
  day[a] = { ...y, changes: [...(x?.changes ?? []), { kind: "swap", from: wid(x.t, x.l), to: wid(y.t, y.l), note: `обмін з ${b}` }] };
  day[b] = { ...x, changes: [...(y?.changes ?? []), { kind: "swap", from: wid(y.t, y.l), to: wid(x.t, x.l), note: `обмін з ${a}` }] };
}
for (const [d, l] of Object.entries(state.ovr.lvl as Record<string, number>)) {
  const x = day[d]; if (!x || ["race", "tt5k", "pyramid", "start"].includes(x.t)) continue;
  x.changes.push({ kind: "level", from: wid(x.t, x.l), to: wid(x.t, l) }); x.l = l;
}
if ((state.ovr.starts ?? []).length) throw new Error("ovr.starts is not empty: add start handling before migrating");

// strength sessions on v52's plan (computed there from the plan after overrides)
ctx.V52.DATA.splice(0, ctx.V52.DATA.length, ...Object.keys(day).sort().map(d => ({ ...byDate.get(d)!, t: day[d].t, l: day[d].l })));
const gym: Record<string, string> = gymPlan();

const usedWorkouts = new Set<string>();
for (const d of Object.keys(day).sort()) {
  const e = byDate.get(d)!, x = day[d], id = wid(x.t, x.l);
  usedWorkouts.add(`${x.t}|${x.l}`);
  docs.plan[d] = {
    date: d, workout: id, gym: gym[d] ? `gym-${gym[d]}` : undefined,
    phase: e.ph, week: e.cw, goal: GOAL, changes: x.changes,
  };
}

// ---- run workout templates, from v52's spec(): blocks with zones, no absolute paces ----
function blocks(t: string, l: number) {
  const s = spec(t, l), R = s.reps, out: any[] = [];
  if (s.warm) out.push({ kind: "warmup", min: s.warm });
  if (s.easy) out.push(t === "fastfinish" ? { kind: "steady", min: s.easy, zone: "z1" }
                                          : { kind: "steady", min: s.easy, zone: t === "longfartlek" ? "z1" : s.zone, strides: s.strides || undefined });
  if (s.fast) out.push({ kind: "progression", min: s.fast, zone: s.zone });
  if (R) {
    if (R.mins) out.push({ kind: "repeat", n: 1, work: R.mins.map((m: number) => ({ min: m, zone: s.zone })), rest: R.rests });
    else if (t === "mixedint") out.push({ kind: "repeat", n: R.n, work: [{ min: R.z2, zone: "z2" }, { min: R.z3, zone: "z3" }], rest: [R.rest] });
    else out.push({ kind: "repeat", n: R.n, work: [{ min: R.min, zone: s.zone }], rest: [R.rest], within: t === "longfartlek" ? "steady" : undefined });
  }
  if (s.main) out.push({ kind: "effort", min: s.main, km: s.km ?? null, zone: s.zone });
  if (s.cool) out.push({ kind: "cooldown", min: s.cool });
  return out;
}
for (const k of usedWorkouts) {
  const [t, ls] = k.split("|"), l = Number(ls), s = spec(t, l);
  docs.workouts[wid(t, l)] = {
    sport: "run", type: t, name: TYPE[t].name, level: l, zone: s.zone, analysis: s.tmpl,
    blocks: blocks(t, l), note: t === "tt5k" ? undefined : gen(t, l)?.note,
  };
}

// ---- strength templates, with the coach's weights per period ----
for (const [k, g] of Object.entries(GYM as Record<string, any>)) {
  const rows = GYM_W.rows.filter((r: any) => r.s === k);
  docs.workouts[`gym-${k}`] = {
    sport: "strength", name: g.name, min: g.min, rules: GYM_W.rules,
    exercises: g.ex.map(([name, dose, cue]: string[], i: number) => {
      const w = rows.filter((r: any) => r.w[i]).map((r: any) => ({ from: r.from, to: r.to, w: r.w[i] }));
      return { name, dose, cue: cue || undefined, weights: w.length ? w : undefined };
    }),
  };
}

// ---- runs and journal from the day reports ----
for (const [d, f] of Object.entries(state.fb as Record<string, any>)) {
  const j: any = { date: d };
  if (f.none) j.skipped = true;
  if (f.actual) j.actualType = f.actual;
  if (f.rpe != null) j.rpe = f.rpe;
  if (!f.strava && (f.pace || f.hr)) j.manual = { pace: f.pace, hr: f.hr };
  if (Object.keys(j).length > 1) docs.journal[d] = j;
  const s = f.strava;
  if (s) docs.runs[s.id] = {
    stravaId: String(s.id), date: d, startHour: s.h, name: s.name, km: s.km, movingSec: s.t, hr: s.hr,
    corosLoad: s.coros ?? undefined,
    laps: s.laps?.map(([t, m, hr, w]: number[]) => ({ sec: t, m, hr: hr ?? null, w: w ?? null })),
    weather: s.wx ?? null, planDate: d, exclude: f.exclude || undefined,
  };
  for (const x of f.extra ?? []) docs.runs[x.id] = {
    stravaId: String(x.id), date: d, km: x.km, movingSec: x.t, corosLoad: x.coros, planDate: d, extra: true, exclude: f.exclude || undefined,
  };
}
for (const [d, h] of Object.entries(p.sleep ?? {})) docs.journal[d] = { ...(docs.journal[d] as object ?? { date: d }), sleepH: h };

// ---- coach files: markdown tables ----
function table(md: string): string[][] {
  return md.split("\n").filter(r => r.startsWith("|") && !/^\|\s*-/.test(r))
    .slice(1).map(r => r.slice(1, -1).split("|").map(c => c.trim()));
}
const dmy = (s: string, year?: string) => { const [d, m, y] = s.split("."); return `${y ?? year}-${m}-${d.padStart(2, "0")}`; };
const injRows = table(read(join(coachDir, "injuries.md")).split("## Записи")[1]);
injRows.forEach(([dates, area, side, lvl, note], i) => {
  let from: string, to: string;
  const r = dates.match(/^(\d{2}\.\d{2})(?:\.\d{4})?–(\d{2}\.\d{2}\.(\d{4}))$/);
  if (r) { to = dmy(r[2]); from = dmy(r[1], r[3]); } else { from = to = dmy(dates); }
  docs.injuries[`${from}-${i + 1}`] = { from, to, area, side, level: Number(lvl), note };
});
const PAIN_COLS = [4, 5];
const jmd = read(join(coachDir, "journal.md"));
const jHead = jmd.split("\n").find(r => r.startsWith("| Дата"))!.slice(1, -1).split("|").map(c => c.trim());
for (const row of table(jmd)) {
  const [date, session, numbers, feel, , , sleep, note] = row;
  const d = /\d{4}$/.test(date) ? dmy(date) : dmy(date, "2026");
  const pains: Record<string, string> = {};
  for (const c of PAIN_COLS) if (row[c] && row[c] !== "?" && row[c] !== "—") pains[jHead[c]] = row[c];
  const prev = (docs.journal[d] ?? { date: d }) as any;
  docs.journal[d] = {
    ...prev, session, numbers: numbers !== "?" ? numbers : undefined, feel: feel !== "?" ? feel : undefined,
    sleepText: sleep !== "?" ? sleep : undefined, pains: Object.keys(pains).length ? pains : undefined, note,
  };
}

// ---- validate and write ----
rmSync(outDir, { recursive: true, force: true });
let bad = 0;
const counts: Record<string, number> = {};
for (const [col, items] of Object.entries(docs) as [CollectionName, Record<string, unknown>][]) {
  counts[col] = Object.keys(items).length;
  if (!counts[col]) continue;
  mkdirSync(join(outDir, col), { recursive: true });
  for (const [id, raw] of Object.entries(items)) {
    const clean = JSON.parse(JSON.stringify(raw));          // drops undefined
    const r = COLLECTIONS[col].safeParse(clean);
    if (!r.success) { bad++; console.error(`${col}/${id}:`, r.error.issues.map(i => `${i.path.join(".")} ${i.message}`).join("; ")); continue; }
    writeFileSync(join(outDir, col, `${id}.json`), JSON.stringify(clean, null, 1));
  }
}
console.log(JSON.stringify(counts));
if (bad) { console.error(`${bad} documents failed the schema`); process.exit(1); }
