// Лабораторія: the analysis behind the charts. Ported from v52 09-forecast.js (workoutEq, stravaForecast, thrHrPace,
// projectCurve), 10-progress.js (renderVo2, renderEff, renderWeeks, renderHrz) and 10a-load.js (isRaceRun, renderArchive).
// Pure functions of plan days and runs; nothing here changes the plan.
import type { Run, Threshold } from "../data/schema";
import type { Day } from "./days";
import type { Zones } from "./zones";
import { hrTops } from "./zones";
import { dur, spec, LOAD_W, THR_TO_10K, K5_TO_10K, eq10 } from "./spec";
import { BAN, corosK, dayLoads, type LoadDay, type Week } from "./load";
import type { EasyPt } from "./aerobic";
import { addDays, daysBetween, mondayOf } from "./util";
import { lapPace, partOf, type Lap } from "./report";

// ---- forecast -----------------------------------------------------------------
/** Fartlek-type sessions are run by feel: plotted, never averaged into a forecast. */
export const BY_FEEL = ["fartlek", "pyramid"];
export const KEY_T = ["tt5k", "race", "start"];
/** Workouts whose work pace says something about 10 km form, and the factor that turns it into 10 km pace. */
export const EQ: Record<string, { k: number; lbl: string }> = {
  longint: { k: 0.97, lbl: "порогові відрізки × 0,97" }, mixedint: { k: 0.97, lbl: "5-хв порогові відрізки × 0,97" },
  shortint: { k: 1.04, lbl: "відрізки VO2max × 1,04" }, fartlek: { k: 1.04, lbl: "фартлек × 1,04" }, pyramid: { k: 1.04, lbl: "фартлек-піраміда × 1,04" },
  tt5k: { k: K5_TO_10K, lbl: "контрольні 5 км × 1,037" }, race: { k: 1, lbl: "гонка" },
  start: { k: 1, lbl: "старт: 10 км, 5 км × 1,037 або півмарафон за Ріґелем" },
};
const manualPace = (d: Day) => { const m = d.journal?.manual?.pace?.match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
export interface EqPt { d: string; t: string; pace: number; eq: number; hr: number | null; km: number | null; src: "strava" | "вручну" }
/** Every key workout as a 10 km pace equivalent (s/km). */
export function workoutEq(days: Day[]): EqPt[] {
  return days.filter(d => EQ[d.act] && !d.run?.exclude && (d.report || d.journal?.manual)).map((d): EqPt | null => {
    const w = d.report?.work, pace = w?.pace ?? manualPace(d);
    if (!pace) return null;
    const eq = d.act === "start" && w?.km ? eq10(w.km, w.t) : pace * EQ[d.act].k;
    return { d: d.date, t: d.act, pace, eq, hr: w?.hr ?? d.journal?.manual?.hr ?? null, km: w?.km ?? null, src: d.report ? "strava" : "вручну" };
  }).filter((p): p is EqPt => !!p);
}
/** Pace at threshold HR: laps of the last 4 weeks run at threshold HR ±3, slower-than-easy laps left out. */
export function thrHrPace(days: Day[], Z: Zones, today: string) {
  const lo = Z.thrHR - 3, hi = Z.thrHR + 3, laps: { d: string; l: Lap }[] = [];
  days.filter(d => d.report && d.date <= today && daysBetween(d.date, today) <= 28)
    .forEach(d => d.report!.laps.forEach(l => { if (l[1] >= 600 && l[2] >= lo && l[2] <= hi && lapPace(l) < Z.z1.fast) laps.push({ d: d.date, l }); }));
  if (laps.length < 2) return { n: laps.length, lo, hi, pace: null as number | null };
  return { n: laps.length, lo, hi, pace: partOf(laps.map(x => x.l))!.pace };
}
export const SF_DAYS = 42, SF_MIN = 2, SF_THR_MIN = 4;
/** Second forecast «за фактом зі Strava»: key workouts of 6 weeks (no fartlek; 5 km and races count double) plus threshold-HR pace. */
export function stravaForecast(days: Day[], Z: Zones, today: string) {
  const key = workoutEq(days).filter(p => !BY_FEEL.includes(p.t) && p.d <= today && daysBetween(p.d, today) <= SF_DAYS);
  const next = days.find(d => EQ[d.type] && !BY_FEEL.includes(d.type) && d.date > today) ?? null;
  const th = thrHrPace(days, Z, today), thr = th.pace && th.n >= SF_THR_MIN ? { t: "thrhr", eq: th.pace * THR_TO_10K, n: th.n } : null;
  if (key.length < SF_MIN && !thr) return { n: key.length, next, thr: null, eq: null as number | null };
  const all: { t: string; eq: number }[] = [...key, ...(thr ? [thr] : [])], w = (p: { t: string }) => (KEY_T.includes(p.t) ? 2 : 1);
  const sw = all.reduce((a, p) => a + w(p), 0);
  return { n: key.length, next, thr, onlyThr: !key.length, eq: (all.reduce((a, p) => a + p.eq * w(p), 0) / sw) * 10,
    from: key.length ? key[0].d : addDays(today, -28), to: today };
}

/** Expected gain from today to race day, % per 10 weeks of the whole plan (slow / middle / fast scenario). */
export const GAIN = { lo: 1.5, mid: 2.5, hi: 4 };
export interface Proj { lo: { d: string; s: number }[]; mid: { d: string; s: number }[]; hi: { d: string; s: number }[]; weeks: number; race: string; scale: number; K: ReturnType<typeof corosK> }
/** Banister fitness − fatigue on the planned load, scaled by how much of the plan happened; anchored at T0 today. */
export function projectCurve(days: LoadDay[], today: string, T0: number, W: Record<string, number>, useCoros: boolean): Proj | null {
  const race = days.find(e => e.t === "race"); if (!race || today >= race.d) return null;
  const a1 = Math.exp(-1 / BAN.tau1), a2 = Math.exp(-1 / BAN.tau2), k1 = 1, k2 = 2;
  const avg0 = days.slice(0, 12).reduce((a, e) => a + (dur(e.t, e.l) || 0) * (W[e.t] || 1), 0) / 14;
  const run = (load: Record<string, number>) => {
    let fit = avg0 / (1 - a1), fat = avg0 / (1 - a2); const R: { d: string; r: number; fit: number }[] = [];
    for (let d = days[0].d; d <= race.d; d = addDays(d, 1)) { R.push({ d, r: k1 * fit - k2 * fat, fit }); fit = fit * a1 + (load[d] || 0); fat = fat * a2 + (load[d] || 0); }
    return R;
  };
  const R = run(dayLoads(days, today, false, [], W, useCoros)), P = run(dayLoads(days, today, true, [], W, false));
  const scale = Math.max(0.3, Math.min(1.3, R[R.length - 1].fit / P[P.length - 1].fit));
  const sm = R.map((x, i) => { const w = R.slice(Math.max(0, i - 3), i + 4); return { d: x.d, r: w.reduce((a, y) => a + y.r, 0) / w.length }; });
  sm[sm.length - 1] = R[R.length - 1];
  const i0 = sm.findIndex(x => x.d >= today), r0 = sm[i0].r, rEnd = sm[sm.length - 1].r - r0;
  if (!(rEnd > 0)) return null;
  const weeks = (sm.length - 1 - i0) / 7;
  const curve = (k: keyof typeof GAIN) => { const g = (((GAIN[k] * scale) / 100) * weeks) / 10; return sm.slice(i0).map(x => ({ d: x.d, s: T0 * (1 - (g * (x.r - r0)) / rEnd) })); };
  return { lo: curve("lo"), mid: curve("mid"), hi: curve("hi"), weeks, race: race.d, scale, K: useCoros ? corosK(days) : null };
}
/** Forecast points from the threshold history (10 km time, s). */
export const thrPts = (th: Record<string, Threshold>) =>
  Object.values(th).sort((a, b) => a.date.localeCompare(b.date)).map(t => ({ d: t.date, pace: t.paceSec, t10: t.paceSec * THR_TO_10K * 10 }));

// ---- VO2max intervals -------------------------------------------------------------
export function vo2Pts(days: Day[]) {
  return days.filter(d => ["shortint", ...BY_FEEL].includes(d.act) && !d.run?.exclude && (d.report || d.journal?.manual)).map(d => {
    const w = d.report?.work, pace = w?.pace ?? manualPace(d);
    return pace ? { d: d.date, t: d.act, pace, hr: Math.round(w?.hr ?? d.journal?.manual?.hr ?? 0) || null, km: (w?.km as number | undefined) ?? null } : null;
  }).filter((p): p is { d: string; t: string; pace: number; hr: number | null; km: number | null } => !!p);
}
export function vo2Note(pts: ReturnType<typeof vo2Pts>, next: string | null) {
  const si = pts.filter(p => p.t === "shortint");
  if (!pts.length) return `Ще немає відрізків зі Strava.${next ? ` Перші інтервали ${next}.` : ""}`;
  if (si.length >= 2) {
    const a = si[si.length - 2], b = si[si.length - 1], dp = a.pace - b.pace, dh = a.hr && b.hr ? b.hr - a.hr : null;
    return `Останні два інтервальні: темп ${dp >= 0 ? "швидше" : "повільніше"} на ${Math.abs(Math.round(dp))} с/км${dh !== null ? `, пульс ${dh > 0 ? "+" : ""}${dh}` : ""}.${dp >= 0 && (dh === null || dh <= 2) ? " Прогрес." : ""}`;
  }
  return `Фартлеків: ${pts.length - si.length}, інтервальних: ${si.length}.${next ? ` Наступні інтервали ${next}.` : ""}`;
}

// ---- aerobic base ----------------------------------------------------------------
/** Weighted linear trend of ordinary easy runs, s/km per day (a run after a hard day counts half). */
export function effTrend(pts: EasyPt[]) {
  const x = (p: EasyPt) => new Date(p.d + "T00:00:00").getTime() / 864e5, w = (p: EasyPt) => (p.hard ? 0.5 : 1);
  const sw = pts.reduce((a, p) => a + w(p), 0); if (!sw) return null;
  const mx = pts.reduce((a, p) => a + x(p) * w(p), 0) / sw, my = pts.reduce((a, p) => a + p.norm * w(p), 0) / sw;
  const sxx = pts.reduce((a, p) => a + w(p) * (x(p) - mx) ** 2, 0), slope = sxx ? pts.reduce((a, p) => a + w(p) * (x(p) - mx) * (p.norm - my), 0) / sxx : 0;
  return { slope, at: (iso: string) => my + slope * (new Date(iso + "T00:00:00").getTime() / 864e5 - mx) };
}

// ---- weeks -------------------------------------------------------------------------
const z1MidMin = (Z: Zones) => (Z.z1.fast + Z.z1.slow) / 2 / 60;
/** Every run of the plan week (Monday–Sunday): the plan's session, second runs and runs on rest days. */
export function weekRuns(runs: Record<string, Run>, mon: string) {
  const sun = addDays(mon, 6);
  return Object.values(runs).filter(r => { const d = r.planDate ?? r.date; return d >= mon && d <= sun && r.source !== "archive"; });
}
export interface WeekRow { n: number; mon: string; now: boolean; started: boolean; planMin: number; planKm: number; pastPlanKm: number; factMin: number; factKm: number; runs: number; extra: number; done: number; past: number; miss: number; coros: number; acc: number | null; hrz: number[] | null }
export function weeks(days: Day[], runs: Record<string, Run>, today: string, Z: Zones): WeekRow[] {
  const by = new Map<number, Day[]>(); days.forEach(d => { const a = by.get(d.plan.week) ?? []; a.push(d); by.set(d.plan.week, a); });
  const z1 = z1MidMin(Z);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([n, evs]) => {
    const mon = mondayOf(evs[0].date), past = evs.filter(d => d.date <= today), rs = weekRuns(runs, mon);
    const planMin = evs.reduce((a, d) => a + (dur(d.type, d.level) ?? 0), 0), pastMin = past.reduce((a, d) => a + (dur(d.type, d.level) ?? 0), 0);
    const acc = past.filter(d => d.acc).map(d => ({ s: d.acc!.score, w: spec(d.act, d.level)?.tmpl === "steady" ? 1 : 2 }));
    const aw = acc.reduce((a, x) => a + x.w, 0), z = [0, 0, 0, 0, 0]; let hz = false;
    rs.forEach(r => { const h = r.stream?.hrz; if (h) { hz = true; h.forEach((v, i) => (z[i] += v)); } });
    return { n, mon, started: evs[0].date <= today, now: evs[0].date <= today && evs[evs.length - 1].date >= today,
      planMin, planKm: planMin / z1, pastPlanKm: Math.round(pastMin / z1),
      factMin: rs.reduce((a, r) => a + r.movingSec, 0) / 60, factKm: rs.reduce((a, r) => a + r.km, 0), runs: rs.length, extra: rs.filter(r => r.extra || !days.some(d => d.date === (r.planDate ?? r.date))).length,
      done: past.filter(d => d.run).length, past: past.length, miss: past.filter(d => d.journal?.skipped).length,
      coros: rs.reduce((a, r) => a + (r.corosLoad ?? 0), 0), acc: aw ? Math.round(acc.reduce((a, x) => a + x.s * x.w, 0) / aw) : null,
      hrz: hz ? z : null };
  });
}
/** HR zone bounds as text, Z1–Z5. */
export function hrBounds(Z: Zones) {
  const t = hrTops(Z);
  return [`≤${t[0]}`, `${t[0] + 1}–${t[1]}`, `${t[1] + 1}–${t[2]}`, `${t[2] + 1}–${t[3]}`, `${t[3] + 1}+`];
}

// ---- archive -----------------------------------------------------------------------
const RACE_NAME = /race|carrera|cursa|marat|half|media|mitja|10\s?k|5\s?k|15\s?k|parkrun|volta|lauf|забіг|старт/i;
/** A whole run at race pace: faster than threshold × a margin that grows with distance, or named like a race. */
export function isRaceRun(km: number, t: number, name: string | undefined, thr: number) {
  const p = t / km, m = km < 8 ? 1.03 : km < 12 ? 1.06 : km < 25 ? 1.1 : 1.16;
  return km >= 4.5 && (p <= thr * m || (RACE_NAME.test(name || "") && p <= thr * (m + 0.08)));
}
/** Weekly km from the first archived week to now (archive weeks + every run of the plan's weeks), and the races in the archive. */
export function history(runs: Record<string, Run>, arch: { from: string; weeks: Week[] } | null, planStart: string, today: string, thr: number) {
  if (!arch) return null;
  const W: Record<string, { km: number; min: number; n: number; long: number }> = {};
  arch.weeks.forEach(w => { W[w[0]] = { km: w[1], min: w[2], n: w[3], long: w[5] }; });
  Object.values(runs).forEach(r => { const d = r.planDate ?? r.date; if (r.source === "archive" || d < planStart || d > today) return;
    const w = (W[mondayOf(d)] ||= { km: 0, min: 0, n: 0, long: 0 }); w.km += r.km; w.min += r.movingSec / 60; w.n++; w.long = Math.max(w.long, r.km); });
  const rows = Object.keys(W).sort().map(m => ({ m, ...W[m], plan: m >= mondayOf(planStart) }));
  const keys = Object.values(runs).filter(r => r.source === "archive" && r.km > 0 && isRaceRun(r.km, r.movingSec, r.name, thr))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-20).map(r => ({ d: r.date, name: r.name ?? "", km: r.km, t: r.movingSec, hr: r.hr ?? null, t10: eq10(r.km, r.movingSec) * 10 }));
  return { rows, keys, km: arch.weeks.reduce((a, w) => a + w[1], 0) };
}
export { LOAD_W };
