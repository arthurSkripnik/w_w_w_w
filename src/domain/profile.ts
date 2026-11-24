// Профіль: estimates from body and threshold, threshold history, injuries by area and period.
// Ported from v52 15-profile.js (hrMaxEst, renderBody, renderProfile) and 15c-injuries.js. Pure functions.
import type { Athlete, Threshold, Injury, Run, Goal } from "../data/schema";
import type { Zones } from "./zones";
import { hrCeil, hrTops } from "./zones";
import { THR_TO_10K } from "./spec";
import { addDays, mondayOf } from "./util";
import { vdot, mmss, dm } from "./home";

/** Heart rate before 2025 came from the optical sensor: not used. */
export const CHEST_FROM = "2025-01-01";

/** Max HR: by age (Tanaka), by threshold HR (≈90 % of max), and the highest lap since the chest strap (the true max is higher). */
export function hrMaxEst(runs: Record<string, Run>, thrHR: number, age?: number) {
  let top: { hr: number; d: string } | null = null;
  for (const r of Object.values(runs)) {
    if (r.date < CHEST_FROM || r.exclude) continue;
    for (const l of r.laps ?? []) if (l.sec >= 60 && l.hr && (!top || l.hr > top.hr)) top = { hr: l.hr, d: r.date };
  }
  const byAge = age ? Math.round(208 - 0.7 * age) : null, byThr = Math.round(thrHR / 0.9);
  const mid = byAge ? Math.round((byAge + byThr) / 2) : byThr;
  return { age: byAge, thr: byThr, top, est: top ? Math.max(mid, top.hr + 2) : mid };
}

export interface Est { name: string; value: string; src: string; tag?: string }
const fit = (x: number, lo: number, hi: number) => (x >= lo && x <= hi ? "збігається" : x < lo ? "нижче очікуваного" : "вище очікуваного");

/** The «Що з цього виходить» table: one row per estimate, only those the entered numbers allow. */
export function estimates(a: Athlete | null, th: Threshold, g: Goal, Z: Zones, runs: Record<string, Run>): Est[] {
  const t10 = th.paceSec * THR_TO_10K * 10, goal10 = (g.targetSec / g.km) * 10, v = vdot(t10), thrHR = th.hr ?? Z.thrHR;
  const hm = hrMaxEst(runs, thrHR, a?.age), w = a?.weightKg, h = a?.heightCm ? a.heightCm / 100 : null, ceil = hrCeil(Z);
  const lt2 = [Math.round(hm.est * 0.88), Math.round(hm.est * 0.92)], lt1 = [Math.round(hm.est * 0.78), Math.round(hm.est * 0.82)];
  const rows: (Est | null)[] = [
    { name: "VO2max за формою", value: `${v.toFixed(1)} мл/кг/хв`, src: `Прогноз 10 км ${mmss(t10)} (поріг × 0,97), формула Деніелса` },
    { name: "Потрібно для цілі", value: `${vdot(goal10).toFixed(1)} мл/кг/хв`, src: `10 км за ${mmss(goal10)}` },
    a?.vo2max ? { name: "VO2max з годинника", value: `${a.vo2max} мл/кг/хв`, src: "COROS, вписано вручну" } : null,
    w ? { name: "VO2max у літрах", value: `${((v * w) / 1000).toFixed(2)} л/хв`, src: `VO2max × вага ${w} кг` } : null,
    hm.age ? { name: "Макс. пульс за віком", value: `${hm.age} уд/хв`, src: `208 − 0,7 × ${a!.age} (Танака), похибка ±10` } : null,
    thrHR ? { name: "Макс. пульс за порогом", value: `${hm.thr} уд/хв`, src: `Пульс порогу ${thrHR} ≈ 90 % від максимуму` } : null,
    hm.top ? { name: "Найвищий пульс кола", value: `${hm.top.hr} уд/хв`, src: `${dm(hm.top.d)}.${hm.top.d.slice(2, 4)}, нагрудний датчик; справжній максимум вищий` } : null,
    { name: "Макс. пульс, орієнтир", value: `${hm.est} уд/хв`, src: hm.age ? "Середнє двох оцінок, не нижче найвищого кола" : "Впиши вік, щоб уточнити" },
    { name: "Анаеробний поріг", value: `${lt2[0]}–${lt2[1]} уд/хв`, src: `88–92 % максимуму. Твій пульс порогу ${thrHR}`, tag: fit(thrHR, lt2[0], lt2[1]) },
    { name: "Аеробний поріг", value: `${lt1[0]}–${lt1[1]} уд/хв`, src: `78–82 % максимуму. Стеля легкого дня ${ceil}`, tag: fit(ceil, lt1[0], lt1[1] + 4) },
    w && h ? { name: "Індекс маси тіла", value: (w / h / h).toFixed(1), src: "Вага / зріст²" } : null,
    w ? { name: "Витрата на кілометр", value: `≈${Math.round(w)} ккал`, src: "≈1 ккал на кг ваги на км" } : null,
  ];
  return rows.filter((r): r is Est => !!r);
}

/** Body and sleep inputs: allowed ranges; empty means «not entered». */
export const BODY = [
  { k: "age", label: "Вік, років", lo: 12, hi: 90, mode: "numeric" },
  { k: "heightCm", label: "Зріст, см", lo: 120, hi: 230, mode: "numeric" },
  { k: "weightKg", label: "Вага, кг", lo: 35, hi: 150, mode: "decimal" },
  { k: "sleepNormH", label: "Норма сну, год", lo: 5, hi: 11, mode: "decimal" },
  { k: "vo2max", label: "VO2max з годинника", lo: 30, hi: 90, mode: "numeric" },
] as const;
export type BodyKey = (typeof BODY)[number]["k"];
export function parseBody(v: Record<BodyKey, string>) {
  const out: Partial<Record<BodyKey, number | undefined>> = {}, err: Partial<Record<BodyKey, string>> = {};
  for (const f of BODY) {
    const s = (v[f.k] ?? "").trim().replace(",", "."), n = Number(s);
    if (!s) { out[f.k] = undefined; continue; }
    if (!(n >= f.lo && n <= f.hi)) err[f.k] = `Від ${f.lo} до ${f.hi}`;
    else out[f.k] = f.k === "age" ? Math.round(n) : n;
  }
  return { out, err, ok: !Object.keys(err).length };
}

/** «Поріг і ціль»: threshold pace m:ss, threshold HR, the goal's time m:ss. */
export function parseThreshold(pace: string, hr: string, goal: string, km: number) {
  const sec = (s: string) => { const m = s.trim().match(/^(\d{1,2})[:.](\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
  const p = sec(pace), g = sec(goal), h = Number(hr.trim()), err: Record<string, string> = {};
  if (!p || p < 150 || p > 420) err.pace = "Хв:сек на км, наприклад 3:40";
  if (!/^\d{2,3}$/.test(hr.trim()) || h < 120 || h > 210) err.hr = "Числом, наприклад 171";
  if (!g || g < 150 * km || g > 420 * km) err.goal = `Хв:сек на ${km} км, наприклад 35:00`;
  return { paceSec: p ?? 0, hr: h, targetSec: g ?? 0, err, ok: !Object.keys(err).length };
}

/** Threshold history, newest first: change against the entry before, and the 10 km forecast it gives. */
export function thrHistory(th: Record<string, Threshold>) {
  const all = Object.values(th).sort((a, b) => a.date.localeCompare(b.date));
  return all.map((t, i) => ({ ...t, delta: i ? t.paceSec - all[i - 1].paceSec : null, t10: t.paceSec * THR_TO_10K * 10 })).reverse();
}

/** Heart-rate zones Z1–Z5 with what each is for. */
export function hrRows(Z: Zones) {
  const t = hrTops(Z), ceil = hrCeil(Z);
  const use = ["Відновлення, розминка", `Легкі дні: стеля ${ceil}`, "Темпові частини, швидкий фініш", "Поріг і вище", "VO2max, фініш гонки"];
  return use.map((u, i) => ({ z: `Z${i + 1}`, range: i === 0 ? `≤${t[0]}` : i === 4 ? `${t[3] + 1}+` : `${t[i - 1] + 1}–${t[i]}`, use: u }));
}

// ---- injuries ---------------------------------------------------------------
export { AREAS, areaOf, areaName, SIDE_NAME, type MapPart } from "./areas";
import { AREAS, areaOf, type MapPart } from "./areas";

export type InjPeriod = "30" | "all";
export interface Span { from: string; to: string; step: 1 | 7 }
/** Last 30 days by day, or the whole log by week from the Monday of the first record. */
export function injSpan(I: Injury[], today: string, p: InjPeriod): Span {
  if (p === "30") return { from: addDays(today, -29), to: today, step: 1 };
  const first = I.reduce((m, r) => (r.from < m ? r.from : m), today);
  return { from: mondayOf(first), to: today, step: 7 };
}
/** Records touching [a, b] for one area and side; «обидві» counts for each leg unless exact. */
export function injRows(I: Injury[], a: string, b: string, map?: MapPart, side?: Injury["side"], exact = false) {
  return I.filter(r => r.to >= a && r.from <= b && (!map || areaOf(r.area)?.map === map)
    && (!side || r.side === side || (!exact && r.side === "обидві")));
}
export const injMax = (rows: Injury[]) => rows.reduce((m, r) => Math.max(m, r.level), 0);
export function injDays(rows: Injury[], a: string, b: string) {
  const s = new Set<string>();
  for (const r of rows) for (let d = r.from > a ? r.from : a; d <= r.to && d <= b; d = addDays(d, 1)) s.add(d);
  return s.size;
}
export const injSpanTxt = (r: Injury) => (r.from === r.to ? dm(r.from) : `${dm(r.from)}–${dm(r.to)}`);

/** Heatmap: one row per area and side in the log (most recent first), one column per day or week. */
export function injHeat(I: Injury[], span: Span) {
  const cols: string[] = [];
  for (let d = span.from; d <= span.to; d = addDays(d, span.step)) cols.push(d);
  const keys = [...new Set([...I].sort((x, y) => y.to.localeCompare(x.to)).map(r => (areaOf(r.area)?.map ?? r.area) + "|" + r.side))];
  const rows = keys.map(k => {
    const [map, side] = k.split("|") as [MapPart, Injury["side"]];
    const area = AREAS.find(a => a.map === map);
    return { key: k, name: area?.name ?? map, side, cells: cols.map(d => {
      const end = addDays(d, span.step - 1), rs = injRows(I, d, end, map, side, true);
      return { d, end, l: injMax(rs), rows: rs };
    }) };
  });
  return { cols, rows };
}
