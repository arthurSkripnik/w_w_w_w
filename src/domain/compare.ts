// Порівняння: repeated runs of one kind side by side. Ported from v52 12a-compare.js (Axis Compare rules:
// the newer run is ink, the one it is compared with is grey; better is accent, never red/green).
// New in v2: the compared side can be the mean of the kind over the 6 weeks before the newer run.
import type { Day } from "./days";
import type { EasyPt } from "./aerobic";
import { EASY_REF_HR } from "./aerobic";
import { heatPct, HOT_PCT, runTemp } from "./weather";
import { lapPace, type Lap, type Part } from "./report";
import { daysBetween, fmtPace } from "./util";
import { spec, FIXED_T } from "./spec";
import { typeOf } from "./types";
import { mmss, plural, dm } from "./home";

export interface Group { k: string; name: string; t: string[] }
export const GROUPS: Group[] = [
  { k: "easy", name: "Легкі", t: ["base", "recovery"] }, { k: "long", name: "Довгі", t: ["long"] },
  { k: "fastfinish", name: "Швидкий фініш", t: ["fastfinish"] }, { k: "fartlek", name: "Фартлек", t: ["fartlek", "pyramid"] },
  { k: "longfartlek", name: "Довгий з фартлеком", t: ["longfartlek"] }, { k: "hills", name: "Пагорби", t: ["hills"] },
  { k: "shortint", name: "VO2max", t: ["shortint"] }, { k: "longint", name: "Поріг", t: ["longint"] },
  { k: "mixedint", name: "Змішані", t: ["mixedint"] }, { k: "test", name: "Тести й старти", t: ["tt5k", "start", "race"] },
];
export const groupOf = (act: string) => GROUPS.find(g => g.t.includes(act)) ?? null;
const steadyG = (k: string) => k === "easy" || k === "long";

/** One run as the screen sees it; key = the part that defines the session (easy part, work, or the finish). */
export interface CmpRun {
  d: string; t: string; km: number;
  lvl: number | null;                 // plan level (null for sessions with one fixed structure)
  planN: number | null;               // planned reps at that level
  sec: number; temp: number | null; rh: number | null;
  tsrc: "strava" | "watch" | "norm" | null;   // where the temperature comes from (norm = Valencia mean for that date and hour)
  heat: number | null;                // % slower at the same effort from heat and humidity (weather.ts heatPct)
  key: { pace: number | null; hr: number | null };
  eff: number | null;                 // easy pace at HR 145 and 15° (aerobic base), easy and long only
  acc: number | null; drift: number | null;
  work: Part | null; warm: Part | null; reps: Part[] | null; spread: number | null; laps: Lap[];
}
export function cmpRun(x: Day, eff: Record<string, EasyPt>): CmpRun | null {
  const r = x.report; if (!r || !x.run || x.run.exclude) return null;
  const w = r.work, prog = r.tmpl === "progression", e = r.easy ?? r;
  const key = w ? { pace: (prog ? w.to : w.pace) ?? null, hr: (prog ? w.endHr || w.hr : w.hr) ?? null } : { pace: e.pace ?? null, hr: e.hr ?? null };
  const reps = r.reps?.length ? r.reps : null, rp = (reps ?? []).filter(p => p.pace).map(p => p.pace!);
  const wx = x.run.weather as { t?: number | null; rh?: number | null } | null | undefined, fromWx = typeof wx?.t === "number";
  const tc = runTemp(x.date, r.temp ?? null, fromWx ? wx?.rh ?? null : null, fromWx, x.run.startHour, x.run.name);
  const lvl = FIXED_T.includes(x.act) ? null : Math.max(1, x.level), planN = spec(x.act, Math.max(1, x.level))?.reps?.n ?? null;
  return { d: x.date, t: x.act, lvl, planN, km: r.km, sec: r.t, temp: tc.t, rh: tc.rh, tsrc: tc.src, heat: heatPct(tc.t, tc.rh), key, eff: eff[x.date]?.norm ?? null,
    acc: x.acc?.score ?? null, drift: r.drift?.pct ?? null, work: w && w.pace ? w : null, warm: r.warm ?? null,
    reps, spread: rp.length > 1 ? Math.max(...rp) - Math.min(...rp) : null, laps: r.laps };
}
export interface GroupRuns extends Group { runs: CmpRun[] }
/** The run to compare B with by default: the latest earlier run of the same session and level within 8 weeks,
 *  else the latest of the same session, else the latest of the kind. Among equals, the one with the closest heat wins a tie of a week. */
export const PAIR_DAYS = 56;
export function prevOf(g: GroupRuns, B: CmpRun): CmpRun | null {
  const before = g.runs.filter(r => r.d < B.d); if (!before.length) return null;
  const near = before.filter(r => daysBetween(r.d, B.d) <= PAIR_DAYS);
  const same = near.filter(r => r.t === B.t && r.lvl === B.lvl), sameT = near.filter(r => r.t === B.t);
  const pool = same.length ? same : sameT.length ? sameT : before;
  const last = pool[pool.length - 1], close = pool.filter(r => daysBetween(r.d, last.d) <= 7 && r.heat !== null && B.heat !== null);
  return close.length > 1 ? close.reduce((a, r) => (Math.abs(r.heat! - B.heat!) < Math.abs(a.heat! - B.heat!) ? r : a)) : last;
}
/** Why the default pair is that pair, in a few words for the list hint. */
export function pairWhy(A: CmpRun, B: CmpRun): string {
  if (A.t !== B.t) return "";
  return A.lvl !== null && A.lvl === B.lvl ? `той самий рівень ${lvlTxt(B)}` : A.lvl === null ? "та сама сесія" : "";
}
/** Kinds that have at least one analysed run, runs oldest first. */
export function groups(days: Day[], easy: EasyPt[]): GroupRuns[] {
  const eff: Record<string, EasyPt> = {}; easy.forEach(p => (eff[p.d] = p));
  const runs = days.map(x => cmpRun(x, eff)).filter((r): r is CmpRun => !!r);
  return GROUPS.map(g => ({ ...g, runs: runs.filter(r => g.t.includes(r.t)) })).filter(g => g.runs.length);
}
/** The kind shown first: the one with the latest run among kinds that have two runs to compare. */
export function defaultGroup(G: GroupRuns[]): GroupRuns | null {
  if (!G.length) return null;
  const last = (g: GroupRuns) => g.runs[g.runs.length - 1].d, pool = G.filter(g => g.runs.length > 1);
  return (pool.length ? pool : G).reduce((a, b) => (last(b) > last(a) ? b : a));
}

/** A side of the comparison: one run, or the mean of several (the 6-week mean of the kind). */
export interface Side { label: string; d: string | null; runs: CmpRun[] }
export const one = (r: CmpRun): Side => ({ label: dm(r.d), d: r.d, runs: [r] });
export const AVG_DAYS = 42, AVG_MIN = 2;
/** Runs of the kind in the 6 weeks before B (B left out); null when fewer than two. */
export function avgSide(g: GroupRuns, b: CmpRun): Side | null {
  const rs = g.runs.filter(r => r.d < b.d && daysBetween(r.d, b.d) <= AVG_DAYS);
  return rs.length >= AVG_MIN ? { label: `Середнє 6 тиж.`, d: null, runs: rs } : null;
}
/** A metric of a side: the run's value, or the mean of the runs that have it. */
export function val(s: Side, get: (r: CmpRun) => number | null | undefined): number | null {
  const v = s.runs.map(get).filter((x): x is number => typeof x === "number" && isFinite(x));
  return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
}

// ---- metrics per kind ----
export type Fmt = "pace" | "hr" | "km" | "time" | "pct" | "acc" | "temp" | "n" | "sec";
export interface Row { label: string; get: (r: CmpRun) => number | null | undefined; fmt: Fmt; better: -1 | 0 | 1; scale: number }
const row = (label: string, get: Row["get"], fmt: Fmt, better: Row["better"], scale: number): Row => ({ label, get, fmt, better, scale });
export function rows(k: string): Row[] {
  const R: Row[] = [];
  if (steadyG(k)) {
    R.push(row("Легкий темп", r => r.key.pace, "pace", -1, 15), row("Пульс", r => r.key.hr, "hr", -1, 10),
      row(`Темп при пульсі ${EASY_REF_HR}`, r => r.eff, "pace", -1, 15));
    if (k === "long") R.push(row("Дрейф темп/пульс", r => r.drift, "pct", -1, 5));
  } else if (k === "fastfinish") {
    R.push(row("Темп у кінці", r => r.key.pace, "pace", -1, 15), row("Пульс у кінці", r => r.key.hr, "hr", -1, 10),
      row("Темп у кінці з поправкою на погоду", adjPace, "pace", -1, 15),
      row("Швидка частина", r => r.work?.pace, "pace", -1, 15), row("Пульс швидкої частини", r => r.work?.hr, "hr", -1, 10),
      row("Легка частина", r => r.warm?.pace, "pace", -1, 15));
  } else {
    const test = k === "test";
    R.push(row(test ? "Темп" : "Темп роботи", r => r.key.pace, "pace", -1, 10), row("З поправкою на погоду", adjPace, "pace", -1, 10),
      row(test ? "Пульс" : "Пульс роботи", r => r.key.hr, "hr", -1, 10));
    if (!test) R.push(row("Відрізків", r => r.reps?.length, "n", 0, 0), row("Розкид відрізків", r => r.spread, "sec", -1, 10));
  }
  R.push(row("Дистанція", r => r.km, "km", 0, 0), row("Час руху", r => r.sec, "time", 0, 0), row("Точність", r => r.acc, "acc", 1, 20),
    row("Температура", r => r.temp, "temp", 0, 0), row("Спека сповільнює на", r => r.heat, "pct", 0, 0));
  return R;
}
export function fmtV(v: number, f: Fmt): string {
  switch (f) {
    case "pace": return fmtPace(v);
    case "km": return v.toFixed(1) + " км";
    case "time": return mmss(v);
    case "pct": return v.toFixed(1) + " %";
    case "acc": return Math.round(v) + " %";
    case "temp": return Math.round(v) + "°";
    case "sec": return Math.round(v) + " с";
    default: return String(Math.round(v));
  }
}
/** Signed difference B − A in the metric's own unit. */
export function fmtDiff(d: number, f: Fmt): string {
  const a = Math.abs(d), s = d < 0 ? "−" : "+";
  if (f === "pace" || f === "sec") return a < 1 ? "±0 с" : s + Math.round(a) + " с";
  if (f === "time") return a < 30 ? "±0" : s + mmss(a);
  if (f === "km") return a < 0.05 ? "±0" : s + a.toFixed(1) + " км";
  if (f === "pct") return a < 0.1 ? "±0" : s + a.toFixed(1);
  return Math.round(a) < 1 ? "±0" : s + Math.round(a);
}
/** Delta of a row: value, whether it is better, and the bar width in % of the half (0–50). */
export function delta(a: number | null, b: number | null, r: Pick<Row, "better" | "scale">) {
  if (a === null || b === null) return null;
  const d = b - a;
  return { d, good: r.better !== 0 && d * r.better > 0, bad: r.better !== 0 && d * r.better < 0, w: r.scale ? Math.min(50, (Math.abs(d) / r.scale) * 50) : 0 };
}

// ---- weather ----
/** The key pace as if run at 15° and dry air: heat makes the same effort slower by heat %, so take that share off. */
export const adjPace = (r: CmpRun) => (r.key.pace && r.heat !== null ? r.key.pace * (1 - r.heat / 100) : null);
/** Temperature with its source: «≈» when Strava and the watch had none and the Valencia normal stands in. */
export const tempTxt = (r: CmpRun) => (r.temp === null ? "" : `${r.tsrc === "norm" ? "≈" : ""}${Math.round(r.temp)}°`);
/** Heat differs enough between the sides to move the pace by a second or more per km. */
export const HEAT_GAP = 0.5;

// ---- verdict ----
const hot = (r: CmpRun) => typeof r.temp === "number" && heatPct(r.temp, r.rh) >= HOT_PCT;
export function verdict(k: string, A: Side, B: CmpRun): { head: string; dp: number; dh: number | null; text: string; what: string } {
  const useEff = steadyG(k) && val(A, r => r.eff) !== null && B.eff !== null;
  const dp = useEff ? B.eff! - val(A, r => r.eff)! : (B.key.pace ?? 0) - (val(A, r => r.key.pace) ?? B.key.pace ?? 0);
  const ah = val(A, r => r.key.hr), dh = ah !== null && B.key.hr ? B.key.hr - ah : null;
  const what = useEff ? `При тому самому пульсі ${EASY_REF_HR} легкий біг` : k === "fastfinish" ? "Фініш" : steadyG(k) ? "Легкий темп" : k === "test" ? "Темп" : "Робочі відрізки";
  const pt = Math.abs(dp) < 2 ? "той самий темп" : `на ${Math.round(Math.abs(dp))} с/км ${dp < 0 ? "швидше" : "повільніше"}`;
  const ht = useEff || dh === null ? "" : Math.abs(dh) < 1 ? ", пульс той самий" : `, пульс на ${Math.round(Math.abs(dh))} уд/хв ${dh < 0 ? "нижчий" : "вищий"}`;
  const fast = dp <= -2, slow = dp >= 2, hrUp = dh !== null && dh >= 2, hrDn = dh !== null && dh <= -2;
  let t = useEff ? (fast ? "На тому самому пульсі ти біжиш швидше: аеробна база росте." : slow ? "На тому самому пульсі повільніше: втома, спека або коротший сон." : "Аеробна база тримається на одному рівні.")
    : fast && !hrUp ? "Швидше без зайвого пульсу: це прогрес." : fast ? "Швидше, але дорожчою ціною: пульс вищий."
    : slow && hrDn ? "Повільніше, але легше: схоже на спокійніший день." : slow ? "І темп, і пульс гірші: подивись на втому тижня й погоду."
    : hrDn ? "Той самий темп при нижчому пульсі: це прогрес." : hrUp ? "Той самий темп коштував вищого пульсу." : "Майже однакові пробіжки.";
  const lv = steadyG(k) ? null : levelNote(A, B); if (lv) t += ` ${lv}`;
  t += weatherNote(A, B, useEff);
  const H = [...(A.d ? A.runs : []), B].filter(hot);
  if (H.length && !useEff) t += ` Спека (${H.map(r => `${dm(r.d)} ${tempTxt(r)}`).join(", ")}) підвищує пульс на 5–10 уд/хв.`;
  return { head: `${what} ${pt}${ht}.`, dp, dh, text: t, what };
}
/** What the weather changes: the pace difference once both sides are brought to 15° (easy runs: already in the number). */
export function weatherNote(A: Side, B: CmpRun, effUsed: boolean): string {
  const ha = val(A, r => r.heat), hb = B.heat; if (ha === null || hb === null || Math.abs(hb - ha) < HEAT_GAP) return "";
  const ta = val(A, r => r.temp), wx = `${A.d ? tempTxt(A.runs[0]) : ta !== null ? `≈${Math.round(ta)}°` : ""} і ${tempTxt(B)}`;
  if (effUsed) return ` Погода різна (${wx}), але цей темп уже приведено до 15°.`;
  const pa = val(A, adjPace), pb = adjPace(B); if (pa === null || pb === null) return "";
  const d = pb - pa, pt = Math.abs(d) < 2 ? "темп той самий" : `на ${Math.round(Math.abs(d))} с/км ${d < 0 ? "швидше" : "повільніше"}`;
  return ` З поправкою на погоду (${wx}) ${pt}.`;
}
/** When the sides were planned at different levels: which, and the planned reps if those differ too. */
export function levelNote(A: Side, B: CmpRun): string | null {
  if (A.d && A.runs[0].t !== B.t) return `Різні сесії: ${typeOf(A.runs[0].t).name.toLowerCase()} і ${typeOf(B.t).name.toLowerCase()}.`;
  if (B.lvl === null) return null;
  const other = A.runs.filter(r => r.lvl !== null && r.lvl !== B.lvl); if (!other.length) return null;
  if (!A.d) return `У середньому є інші рівні (${[...new Set(other.map(r => "Р" + r.lvl))].join(", ")}), обрана: Р${B.lvl}.`;
  const a = A.runs[0], reps = a.planN && B.planN && a.planN !== B.planN ? `: ${a.planN} і ${B.planN} повторів` : "";
  return `Різні рівні: Р${a.lvl} і Р${B.lvl}${reps}.`;
}
export const lvlTxt = (r: CmpRun) => (r.lvl === null ? "" : `Р${r.lvl}`);
export const gapTxt = (a: string, b: string) => { const n = daysBetween(a, b); return `${n} ${plural(n, "день", "дні", "днів")} між ними`; };

/** Trend value of a run: easy pace at HR 145 for easy and long, else the key pace. */
export const trendVal = (k: string, r: CmpRun) => (steadyG(k) && r.eff ? r.eff : r.key.pace);
export const trendLabel = (k: string) => (steadyG(k) ? `Темп при пульсі ${EASY_REF_HR}` : k === "fastfinish" ? "Темп у кінці" : "Темп роботи");

// ---- along the distance ----
export interface Step { a: number; b: number; v: number }
/** Laps as steps along the distance in km (laps under 200 m left out); pace or HR. */
export function steps(r: CmpRun, m: "pace" | "hr"): Step[] {
  let x = 0;
  return r.laps.map(l => { const a = x; x += l[1] / 1000; return { a, b: x, v: m === "pace" ? lapPace(l) : l[2] }; })
    .filter(s => s.b - s.a >= 0.2 && s.v && isFinite(s.v));
}
/** Reps side by side: the run's reps, or for a mean side the mean pace and HR of each rep number. */
export function repsOf(s: Side): { pace: number | null; hr: number | null }[] | null {
  const R = s.runs.map(r => r.reps).filter((x): x is Part[] => !!x); if (!R.length) return null;
  const n = Math.max(...R.map(x => x.length));
  return Array.from({ length: n }, (_, i) => {
    const at = R.map(x => x[i]).filter(Boolean);
    const m = (f: (p: Part) => number | null) => { const v = at.map(f).filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null; };
    return { pace: m(p => p.pace), hr: m(p => p.hr) };
  });
}
