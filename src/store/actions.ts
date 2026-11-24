// The only way screens change data. Every write is checked against the schema first.
import { database, plan, workouts, journal, injuries, athlete, thresholds, runs, goals } from "./data";
import { COLLECTIONS, type CollectionName, type Journal, type Injury, type Layout, type Athlete, type Threshold, type PlanDay, type Goal } from "../data/schema";
import { blocksOf, spec, workoutId, FIXED_T } from "../domain/spec";
import { addDays, mondayOf } from "../domain/util";
import { TYPE } from "../domain/types";

export class ActionError extends Error { constructor(public code: string, msg: string) { super(msg); } }

async function put(col: CollectionName, id: string, data: unknown) {
  const db = database(); if (!db) throw new ActionError("offline", "База недоступна");
  const r = COLLECTIONS[col].safeParse(data);
  if (!r.success) throw new ActionError("invalid", `${col}/${id}: ${r.error.issues[0]?.message ?? "не за схемою"}`);
  await db.doc(`${col}/${id}`).set(JSON.parse(JSON.stringify(r.data)));
}
async function remove(col: CollectionName, id: string) {
  const db = database(); if (!db) throw new ActionError("offline", "База недоступна");
  await db.doc(`${col}/${id}`).delete();
}
const drop = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T;   // undefined fields out

/** Write what happened on a day: RPE, sleep, feel, pains, notes, "ran something else", skipped. */
export async function logDay(date: string, patch: Partial<Omit<Journal, "date">>) {
  await put("journal", date, drop({ ...(journal.value[date] ?? {}), ...patch, date }));
}

/** Swap the sessions of two plan days (both keep their week and phase). */
export async function swapDays(a: string, b: string, note?: string) {
  const A = plan.value[a], B = plan.value[b];
  if (!A || !B) throw new ActionError("missing", "Немає такого дня в плані");
  const ch = (x: PlanDay, y: PlanDay) => [...x.changes, { kind: "swap" as const, from: x.workout, to: y.workout, note: note ?? `обмін з ${y.date}` }];
  await put("plan", a, { ...A, workout: B.workout, gym: B.gym, changes: ch(A, B) });
  await put("plan", b, { ...B, workout: A.workout, gym: A.gym, changes: ch(B, A) });
}

/** The run workout of a type and level, created from the session spec when it is not stored yet. */
async function ensureWorkout(type: string, level: number) {
  const id = workoutId(type, level);
  if (!workouts.value[id]) {
    const s = spec(type, level); if (!s) throw new ActionError("missing", `Немає опису тренування ${type}`);
    await put("workouts", id, { sport: "run", type, name: TYPE[type]?.name ?? type, level, zone: s.zone, analysis: s.tmpl, blocks: blocksOf(type, level) });
  }
  return id;
}
const runOf = (id: string) => { const w = workouts.value[id]; return w && w.sport === "run" ? w : null; };

/** Change a day's level ("Легше / Довше"): the workout of the same type at another level, created when new. */
export async function setLevel(date: string, level: number, note?: string) {
  const day = plan.value[date], cur = day && runOf(day.workout);
  if (!day || !cur) throw new ActionError("missing", "Немає бігового тренування на цей день");
  if (FIXED_T.includes(cur.type)) throw new ActionError("fixed", "Це тренування має одну структуру");
  const id = await ensureWorkout(cur.type, level);
  // back to the planned level: drop the level changes instead of adding one more
  const first = day.changes.find(c => c.kind === "level");
  if (first && first.from === id) { await put("plan", date, { ...day, workout: id, changes: day.changes.filter(c => c.kind !== "level") }); return; }
  await put("plan", date, { ...day, workout: id, changes: [...day.changes, { kind: "level", from: day.workout, to: id, note }] });
}
/** The level the plan gave a day before any «Легше / Довше». */
export function plannedLevel(date: string) {
  const day = plan.value[date]; if (!day) return null;
  const first = day.changes.find(c => c.kind === "level"), w = runOf(first ? first.from : day.workout);
  return w ? w.level : null;
}

/** Plan week and phase of a date that has no session: taken from a plan day of the same Monday–Sunday week. */
function weekOf(date: string) {
  const mon = mondayOf(date), all = Object.values(plan.value).sort((a, b) => a.date.localeCompare(b.date));
  const same = all.find(p => mondayOf(p.date) === mon);
  if (same) return { week: same.week, phase: same.phase, goal: same.goal };
  const first = all[0]; if (!first) throw new ActionError("missing", "План порожній");
  const n = Math.round((new Date(mon).getTime() - new Date(mondayOf(first.date)).getTime()) / (7 * 864e5));
  return { week: first.week + n, phase: first.phase, goal: first.goal };
}

/** Move a session to a rest day (the plan document moves with its history). */
export async function moveToRest(from: string, to: string) {
  const A = plan.value[from]; if (!A) throw new ActionError("missing", "Немає такого дня в плані");
  if (plan.value[to]) return swapDays(from, to);
  await put("plan", to, { ...A, ...weekOf(to), date: to, changes: [...A.changes, { kind: "swap", from: "rest", to: A.workout, note: `перенесено з ${from}` }] });
  await remove("plan", from);
}

/** A start (parkrun, a race) on a date: the day before and after become recovery runs. */
export async function markStart(date: string, today: string) {
  const start = await ensureWorkout("start", 0), cur = plan.value[date];
  await put("plan", date, { ...(cur ?? { date, ...weekOf(date) }), workout: start, gym: undefined,
    changes: [...(cur?.changes ?? []), { kind: "start", from: cur?.workout ?? "rest", to: start, note: cur?.gym ? `сила ${cur.gym}` : undefined }] });
  for (const k of [-1, 1]) {
    const d = addDays(date, k), p = plan.value[d], w = p && runOf(p.workout);
    if (!p || !w || d < today || ["base", "recovery", "start", "race"].includes(w.type)) continue;
    const rec = await ensureWorkout("recovery", Math.min(3, w.level));
    await put("plan", d, { ...p, workout: rec, changes: [...p.changes, { kind: "eased", from: p.workout, to: rec, note: date }] });
  }
}

/** Undo the last change of a day (and of the day it was swapped with, or the days a start eased). */
export async function revertDay(date: string) {
  const day = plan.value[date], last = day?.changes[day.changes.length - 1];
  if (!day || !last) return;
  const pop = (p: PlanDay) => p.changes.slice(0, -1);
  if (last.kind === "level" || last.kind === "eased") { await put("plan", date, { ...day, workout: last.from, changes: pop(day) }); return; }
  if (last.kind === "start") {
    for (const k of [-1, 1]) { const d = addDays(date, k), p = plan.value[d], l = p?.changes[p.changes.length - 1];
      if (p && l && l.kind === "eased" && l.note === date) await put("plan", d, { ...p, workout: l.from, changes: pop(p) }); }
    if (last.from === "rest") await remove("plan", date);
    else await put("plan", date, { ...day, workout: last.from, gym: last.note?.startsWith("сила ") ? last.note.slice(5) : day.gym, changes: pop(day) });
    return;
  }
  // swap: moved from a rest day, or exchanged with another plan day
  const m = /(?:перенесено з|обмін з) (\d{4}-\d{2}-\d{2})/.exec(last.note ?? "");
  if (!m) return;
  const other = m[1];
  if (last.from === "rest") {
    await put("plan", other, { ...day, ...weekOf(other), date: other, changes: pop(day) });
    await remove("plan", date); return;
  }
  const B = plan.value[other]; if (!B) return;
  await put("plan", date, { ...day, workout: B.workout, gym: B.gym, changes: pop(day) });
  await put("plan", other, { ...B, workout: day.workout, gym: day.gym, changes: pop(B) });
}

/** «Фактично було»: another session type, and whether the run counts in the form analysis. */
export async function setActual(date: string, actualType: string | null) {
  const { actualType: _a, ...rest } = journal.value[date] ?? { date };
  await put("journal", date, drop(actualType ? { ...rest, date, actualType } : { ...rest, date }));
}
export async function setExclude(stravaId: string, exclude: boolean) {
  const r = runs.value[stravaId]; if (!r) throw new ActionError("missing", "Немає такої пробіжки");
  const { exclude: _e, ...rest } = r;
  await put("runs", stravaId, exclude ? { ...rest, exclude: true } : rest);
}

export async function addInjury(x: Injury) {
  const id = `${x.from}-${x.area}-${x.side}`.replace(/\s+/g, "_");
  await put("injuries", id, x);
  return id;
}
export async function updateInjury(id: string, patch: Partial<Injury>) {
  const cur = injuries.value[id]; if (!cur) throw new ActionError("missing", "Немає такого запису");
  await put("injuries", id, { ...cur, ...patch });
}
export async function setLayout(l: Layout) { await put("layout", "home", l); }
export async function updateAthlete(patch: Partial<Athlete>) { await put("athlete", "me", drop({ ...(athlete.value ?? {}), ...patch })); }
/** A new threshold from the watch or a test: every zone and pace follows it from that date. */
export async function addThreshold(t: Threshold) { await put("thresholds", t.date, t); return thresholds.value; }

/** «Поріг і ціль»: a new threshold from this date (earlier days keep the old zones), and the goal time if it changed. */
export async function setThresholdGoal(date: string, paceSec: number, hr: number, goalId: string | null, targetSec: number) {
  await addThreshold({ date, paceSec, hr, source: "manual" });
  const g = goalId ? goals.value[goalId] : null;
  if (g && g.targetSec !== targetSec) await put("goals", goalId!, { ...g, targetSec } satisfies Goal);
}
