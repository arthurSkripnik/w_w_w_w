// Numbers behind the Головна widgets, ported from v52 (02-calendar formNow, 15-profile vdot/sleepWeek/readiness,
// 10-progress weekKm, 15c-injuries injNowHtml). Pure functions; the widgets read them through the store.
import type { Threshold, Journal, Injury, Run, Goal } from "../data/schema";
import type { Day } from "./days";
import type { Zones } from "./zones";
import { hrCeil } from "./zones";
import { THR_TO_10K, dur } from "./spec";
import { addDays, daysBetween, mondayOf } from "./util";
import { areaName } from "./areas";

export const mmss = (s: number) => {
  s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0");
};
export const plural = (n: number, a: string, b: string, c: string) => {
  const m = n % 10, h = n % 100;
  return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c;
};
export const dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);
export const DOW = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

/** 10 km forecast from the watch threshold (10 km pace ≈ threshold × 0.97), now and for every threshold entry. */
export function forecast(th: Record<string, Threshold>, now: Threshold | null) {
  const pts = Object.values(th).sort((a, b) => a.date.localeCompare(b.date)).map(t => ({ d: t.date, t10: t.paceSec * THR_TO_10K * 10 }));
  return now ? { t10: now.paceSec * THR_TO_10K * 10, pts } : null;
}

/** Daniels' VDOT from a 10 km time in seconds (or any distance in metres). */
export function vdot(t10: number, m = 10000) {
  const T = t10 / 60, v = m / T;
  return (-4.6 + 0.182258 * v + 0.000104 * v * v) / (0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T));
}

/** Sleep: hours per night from the journal. */
export const sleepOf = (J: Record<string, Journal>, iso: string) => {
  const h = J[iso]?.sleepH; return typeof h === "number" ? h : null;
};
export function sleepWeek(J: Record<string, Journal>, iso: string) {
  const v: number[] = [];
  for (let i = 0; i < 7; i++) { const h = sleepOf(J, addDays(iso, -i)); if (h != null) v.push(h); }
  return v.length ? { avg: v.reduce((a, x) => a + x, 0) / v.length, n: v.length } : null;
}

/** Readiness for today from last night's sleep: low when short in absolute terms, against the norm, or after a short week. */
export interface Ready { h: number | null; low: boolean; hard: boolean; head: string; tag?: string; text: string }
export function readiness(J: Record<string, Journal>, iso: string, norm: number, day: Day | null, Z: Zones | null): Ready {
  const h = sleepOf(J, iso), wk = sleepWeek(J, iso);
  const zone = day?.workout?.zone ?? null, hard = !!day && (day.act === "long" || (zone !== null && zone !== "z1" && zone !== "rec"));
  if (h == null) return { h: null, low: false, hard, head: "", text: "Запиши сон минулої ночі, і тут з'явиться порада на день." };
  const debt = !!wk && wk.n >= 3 && wk.avg < norm - 1;
  const low = h < 6 || h <= norm - 1.5 || (debt && h < norm);
  const head = `Сон ${h.toFixed(1)} год, норма ${norm}${debt ? `, за тиждень у середньому ${wk!.avg.toFixed(1)}` : ""}.`;
  if (!low) return { h, low, hard, head, tag: "готовий", text: hard ? "Важкий день можна робити як у плані." : "Можна тренуватися як у плані." };
  return { h, low, hard, head, tag: "мало сну",
    text: hard ? "Мало для важкого дня: зроби його легшим або перенеси на завтра."
      : `Легкий день: пульс нижче ${Z ? hrCeil(Z) : "стелі"}, можна коротше. Лягай раніше.` };
}

/** Day state as on the calendar: done (a run or RPE), missed (journal says skipped), else planned. */
export const dayState = (d: Day) => (d.run || typeof d.journal?.rpe === "number" ? "done" : d.journal?.skipped ? "miss" : "plan");

/** Where a day stands, for the day window: what goes first and what is folded. Race and start lead with their plan
 *  until done; a past day without a run or a record is missed; today keeps its plan first. */
export type Phase = "future" | "today" | "done" | "missed" | "race";
export function dayPhase(d: Day, today: string): Phase {
  if (dayState(d) === "done") return "done";
  if (d.date >= today && (d.type === "race" || d.type === "start")) return "race";
  return d.date === today ? "today" : d.date > today ? "future" : "missed";
}
/** The short status beside the date in the day window. */
export function phaseTag(d: Day, ph: Phase): { tag: string; tone: "ink" | "acc" | "line" | "err" } {
  if (ph === "done") return { tag: d.acc && !d.run?.exclude ? `виконано ${d.acc.score}%` : "виконано", tone: "ink" };
  if (ph === "missed") return { tag: "пропущено", tone: "err" };
  if (ph === "today") return { tag: "сьогодні", tone: "acc" };
  if (ph === "race") return { tag: d.type === "race" ? "гонка" : "старт", tone: "acc" };
  return { tag: "план", tone: "line" };
}

/** The plan week containing today (or the next one): km run against planned km (minutes at the middle of the easy zone). */
export function weekStat(days: Day[], runs: Record<string, Run>, today: string, Z: Zones | null) {
  const cur = days.find(d => d.date >= today) ?? days[days.length - 1];
  if (!cur || !Z) return null;
  const wk = days.filter(d => d.plan.week === cur.plan.week), z1mid = (Z.z1.fast + Z.z1.slow) / 2 / 60;
  const kmOf = (w: Day[]) => {
    const mon = mondayOf(w[0].date), sun = addDays(mon, 6);
    return Object.values(runs).reduce((a, r) => { const d = r.planDate ?? r.date; return d >= mon && d <= sun ? a + r.km : a; }, 0);
  };
  const planKm = Math.round(wk.reduce((a, d) => a + (dur(d.type, d.level) ?? 0), 0) / z1mid);
  const weeks = [...new Set(days.filter(d => d.date <= today).map(d => d.plan.week))].slice(-8);
  const hist = weeks.map(n => kmOf(days.filter(d => d.plan.week === n)));
  return { week: cur.plan.week, km: kmOf(wk), planKm, done: wk.filter(d => dayState(d) === "done").length, n: wk.length, hist };
}

/** Injuries: the state now, and the worst level of each of the last 30 days. */
const SIDE: Record<Injury["side"], string> = { "П": "права", "Л": "ліва", "обидві": "обидві" };
export const INJ_LVL = ["немає", "дискомфорт", "біль", "сильний біль"];
export function injuryNow(I: Record<string, Injury>, today: string) {
  const all = Object.values(I);
  if (!all.length) return { text: "Записів немає", now: false, level: 0 };
  const last = all.reduce((m, r) => (r.to > m.to ? r : m));
  if (last.to >= today) return { now: true, level: last.level, text: `Зараз: ${areaName(last.area).toLowerCase()}, ${SIDE[last.side]}, ${INJ_LVL[last.level]}` };
  const ago = daysBetween(last.to, today);
  return { now: false, level: 0, text: `Без скарг ${ago} ${plural(ago, "день", "дні", "днів")}. Останнє: ${areaName(last.area).toLowerCase()}, ${SIDE[last.side]} (${dm(last.to)})` };
}
export function injuryStrip(I: Record<string, Injury>, today: string, n = 30) {
  const from = addDays(today, -(n - 1)), rows = Object.values(I).filter(r => r.to >= from && r.from <= today);
  const days = Array.from({ length: n }, (_, i) => {
    const d = addDays(from, i), l = rows.filter(r => r.from <= d && r.to >= d).reduce((m, r) => Math.max(m, r.level), 0);
    return { d, l };
  });
  const areas = [...new Set(rows.map(r => r.area + "|" + r.side))].map(k => {
    const [a, s] = k.split("|"), rs = rows.filter(r => r.area === a && r.side === s);
    const n2 = new Set(days.filter(x => rs.some(r => r.from <= x.d && r.to >= x.d)).map(x => x.d)).size;
    return { area: areaName(a), side: s === "обидві" ? "обидві" : s, level: rs.reduce((m, r) => Math.max(m, r.level), 0), days: n2 };
  });
  return { from, days, areas };
}

/** Days to the goal race. */
export const daysTo = (g: Goal | null, today: string) => (g ? daysBetween(today, g.date) : null);

/** The time (s) that gives this VDOT over a distance: Daniels' formula solved by bisection. */
export function timeFor(v: number, m: number) {
  let lo = m / 500, hi = m / 50;                          // 500 m/min … 50 m/min, in minutes
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vdot(mid * 60, m) > v) lo = mid; else hi = mid; }
  return ((lo + hi) / 2) * 60;
}
