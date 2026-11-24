// Joins the collections into plan days: the workout, the run that reports on the day, its analysis and accuracy.
// Pure functions of the stored documents; the store wraps them in computed signals.
import type { Athlete, Goal, Threshold, Workout, PlanDay, Run, Journal } from "../data/schema";
import { zonesFrom, hrCeil, type Zones } from "./zones";
import { buildReport, type Lap, type Report, type StreamFacts } from "./report";
import { accuracy, type Accuracy } from "./accuracy";
import type { LoadDay } from "./load";
import type { EasyIn } from "./aerobic";

export interface Docs {
  athlete: Athlete | null;
  goals: Record<string, Goal>; thresholds: Record<string, Threshold>; workouts: Record<string, Workout>;
  plan: Record<string, PlanDay>; runs: Record<string, Run>; journal: Record<string, Journal>;
}
export type RunWorkout = Extract<Workout, { sport: "run" }>;

export interface Day {
  date: string; plan: PlanDay; workout: RunWorkout | null; gym: Workout | null;
  type: string; level: number;        // planned
  act: string;                        // what it was: the journal's "ran something else", else the plan
  run: Run | null; extras: Run[]; journal: Journal | null;
  report: Report | null; acc: Accuracy | null;
}

/** Threshold in force on a date: the latest entry on or before it, else the first one. */
export function thresholdOn(th: Record<string, Threshold>, date: string): Threshold | null {
  const all = Object.values(th).sort((a, b) => a.date.localeCompare(b.date));
  return all.filter(t => t.date <= date).pop() ?? all[0] ?? null;
}
export function mainGoal(goals: Record<string, Goal>): Goal | null {
  const g = Object.values(goals);
  return g.find(x => x.role === "main") ?? g[0] ?? null;
}
export function zonesOn(D: Docs, date: string): Zones | null {
  const t = thresholdOn(D.thresholds, date), g = mainGoal(D.goals);
  if (!t || !g) return null;
  return zonesFrom(t.paceSec, t.hr ?? 0, g.targetSec / g.km, D.athlete?.hrZoneTops ?? null);
}
const lapsOf = (r: Run): Lap[] => (r.laps ?? []).map(l => [l.sec, l.m, l.hr ?? 0, l.w ?? 0]);
const temp = (r: Run) => (r.weather && typeof r.weather.t === "number" ? (r.weather.t as number) : null);
const rh = (r: Run) => (r.weather && typeof r.weather.rh === "number" ? (r.weather.rh as number) : null);

export function buildDays(D: Docs, today: string): Day[] {
  const byDate: Record<string, Run[]> = {};
  Object.values(D.runs).forEach(r => { const d = r.planDate ?? r.date; (byDate[d] ||= []).push(r); });
  const thrNow = thresholdOn(D.thresholds, today)?.paceSec ?? 0;
  return Object.values(D.plan).sort((a, b) => a.date.localeCompare(b.date)).map(p => {
    const w = D.workouts[p.workout], workout = w && w.sport === "run" ? w : null;
    const type = workout?.type ?? "base", level = workout?.level ?? 1;
    const journal = D.journal[p.date] ?? null, act = journal?.actualType ?? type;
    const runs = byDate[p.date] ?? [], run = runs.find(r => !r.extra) ?? null, extras = runs.filter(r => r.extra);
    let report: Report | null = null, acc: Accuracy | null = null;
    const Z = zonesOn(D, run?.date ?? p.date);
    if (run && Z && !run.exclude) {
      const facts = run.stream as StreamFacts | undefined;
      report = buildReport(act, level, { id: run.stravaId, name: run.name, km: run.km, t: run.movingSec, hr: run.hr, coros: run.corosLoad ?? null,
        best: run.best, laps: lapsOf(run), temp: temp(run), h: run.startHour }, Z, null, facts, hrCeil(Z));
      acc = report ? accuracy(report, level, thrNow, rh(run)) : null;
    }
    return { date: p.date, plan: p, workout, gym: p.gym ? D.workouts[p.gym] ?? null : null, type, level, act, run, extras, journal, report, acc };
  });
}
export const loadDays = (days: Day[]): LoadDay[] => days.map(x => ({
  d: x.date, t: x.type, l: x.level, act: x.act,
  main: x.run ? { t: x.run.movingSec, coros: x.run.corosLoad ?? null } : null,
  extras: x.extras.map(r => ({ t: r.movingSec, coros: r.corosLoad ?? null })),
  none: !!x.journal?.skipped,
}));
export const easyIns = (days: Day[]): EasyIn[] => days.filter(x => x.report && x.run).map(x => {
  const r = x.report!, e = r.easy ?? { pace: r.pace, hr: r.hr, km: r.km };
  return { d: x.date, act: x.act, easy: { pace: e.pace, hr: e.hr, km: e.km, first40: (e as { first40?: boolean }).first40 }, t: r.t,
    temp: r.temp ?? null, rh: rh(x.run!), fromWx: temp(x.run!) != null, hour: x.run!.startHour, name: x.run!.name };
});
