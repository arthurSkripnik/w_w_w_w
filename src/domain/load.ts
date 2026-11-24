// Training load and the COROS-style fatigue ratio, ported unchanged from v52 09-forecast.js and 10a-load.js.
// Fatigue = 7-day load / 6-week load (exponential averages of daily load), in %.
import { dur, LOAD_W } from "./spec";
import { addDays, mondayOf } from "./util";

export const BAN = { tau1: 42, tau2: 7 };
export const FATIGUE = [
  { lo: 150, name: "Надмірно", tip: "Навантаження за тиждень набагато вище за звичне. Наступні 2–3 дні легко або відпочинок, інакше ризик травми й перетренованості." },
  { lo: 100, name: "Оптимально", tip: "Продуктивне навантаження: тиждень трохи важчий за звичний, тому фітнес росте. Тримай план." },
  { lo: 80, name: "Підтримка", tip: "Тиждень приблизно як звичний: форма тримається, але майже не росте." },
  { lo: 50, name: "Відновлення", tip: "Тиждень легший за звичний: втома сходить, ти свіжий. Саме так має бути перед контрольною чи стартом." },
  { lo: 0, name: "Спадає", tip: "Навантаження надто мале проти звичного: фітнес поступово втрачається." },
];
export const fatigueZone = (r: number) => FATIGUE.find(z => r >= z.lo)!;

/** One plan day as the load model sees it. */
export interface LoadDay {
  d: string; t: string; l: number;        // planned type and level
  act: string;                            // what it actually was (journal) or t
  main: { t: number; coros: number | null } | null;   // the run reported on this day
  extras: { t: number; coros: number | null }[];
  none: boolean;                          // the sync found no run that day
}
/** A run on a date without a plan session. */
export interface OffPlan { d: string; t: number; coros: number | null }
/** A run before the plan, for the archive weeks. */
export interface ArchRun { d: string; km: number; t: number; coros: number | null }
export type Week = [string, number, number, number, number, number]; // monday, km, minutes, runs, Coros load, longest km

/** Coros "Training Load" vs minutes × weight on days with both: one factor turns Coros units into plan units. */
export function corosK(days: LoadDay[]) {
  let c = 0, m = 0, n = 0;
  days.forEach(e => { const st = e.main; if (st && st.coros! > 0 && st.t) { c += st.coros!; m += (st.t / 60) * (LOAD_W[e.act] || 1); n++; } });
  return c > 0 && m > 0 ? { k: c / m, n } : null;
}
export function dayLoads(days: LoadDay[], today: string, plan = false, offPlan: OffPlan[] = []) {
  const K = corosK(days), load: Record<string, number> = {};
  const one = (min: number, w: number, coros: number | null) => (K && coros! > 0 ? coros! / K.k : min * w);
  days.forEach(e => {
    const w = LOAD_W[e.act] || 1;
    let v: number;
    if (plan || e.d > today) v = (dur(e.t, e.l) || 0) * (LOAD_W[e.t] || 1);
    else if (e.main) v = one(e.main.t / 60, w, e.main.coros);
    else if (e.none) v = 0;
    else v = (dur(e.t, e.l) || 0) * (LOAD_W[e.t] || 1);
    load[e.d] = (load[e.d] || 0) + v;
  });
  if (!plan) days.forEach(e => { if (e.d > today) return; e.extras.forEach(x => { load[e.d] = (load[e.d] || 0) + one(x.t / 60, 1, x.coros); }); });
  // runs on days with no plan session: volume only, like extra runs
  if (!plan) offPlan.forEach(x => { if (x.d <= today && x.d >= days[0].d) load[x.d] = (load[x.d] || 0) + one(x.t / 60, 1, x.coros); });
  return load;
}
/** Weekly totals of the runs before the plan (Coros load estimated from minutes where missing). */
export function archiveWeeks(runs: ArchRun[]): Week[] {
  const withC = runs.filter(r => r.coros! > 0);
  const perMin = withC.length ? withC.reduce((a, r) => a + r.coros!, 0) / withC.reduce((a, r) => a + r.t / 60, 0) : 1.9;
  const W: Record<string, Week> = {};
  runs.forEach(r => { const w = (W[mondayOf(r.d)] ||= [mondayOf(r.d), 0, 0, 0, 0, 0]);
    w[1] += r.km; w[2] += r.t / 60; w[3]++; w[4] += r.coros! > 0 ? r.coros! : (r.t / 60) * perMin; w[5] = Math.max(w[5], r.km); });
  return Object.values(W).sort((a, b) => a[0].localeCompare(b[0]))
    .map(w => [w[0], +w[1].toFixed(1), Math.round(w[2]), w[3], Math.round(w[4]), +w[5].toFixed(1)] as Week);
}

export interface FormDay { d: string; L: number; ctl: number; atl: number; r: number; plan: boolean }
export interface FormSeries { days: FormDay[]; race: string; K: ReturnType<typeof corosK>; arch: boolean; now: FormDay | null; end: FormDay }

/** Daily load in Coros units from the first archived week (or the plan start) to race day. */
export function formSeries(days: LoadDay[], today: string, arch?: { from: string; weeks: Week[] }, offPlan: OffPlan[] = []): FormSeries | null {
  const race = days.find(e => e.t === "race"); if (!race || !days.length) return null;
  const K = corosK(days), k = K ? K.k : 1, plan = dayLoads(days, today, false, offPlan), L: Record<string, number> = {};
  const A = arch && arch.weeks.length ? arch : null;
  if (A) A.weeks.forEach(w => { for (let i = 0; i < 7; i++) { const d = addDays(w[0], i); if (d >= A.from && d < days[0].d) L[d] = w[4] / 7; } });
  Object.keys(plan).forEach(d => { L[d] = plan[d] * k; });
  const from = A ? A.from : days[0].d;
  const first = A ? A.weeks[0][4] / 7 : (days.slice(0, 12).reduce((a, e) => a + (dur(e.t, e.l) || 0) * (LOAD_W[e.t] || 1), 0) / 14) * k;
  let ctl = first, atl = first; const out: FormDay[] = [];
  for (let d = from; d <= race.d; d = addDays(d, 1)) {
    const l = L[d] || 0;
    ctl += (l - ctl) / BAN.tau1; atl += (l - atl) / BAN.tau2;
    out.push({ d, L: l, ctl, atl, r: ctl > 0 ? (atl / ctl) * 100 : 0, plan: d > today });
  }
  const end = { ...(out[out.length - 2] || out[0]), d: race.d, plan: true };
  return { days: out, race: race.d, K, arch: !!A, now: out.find(x => x.d === today) || null, end };
}
