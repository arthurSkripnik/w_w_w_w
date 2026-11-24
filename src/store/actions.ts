// The only way screens change data. Every write is checked against the schema first.
import { database, plan, workouts, journal, injuries, athlete, thresholds } from "./data";
import { COLLECTIONS, type CollectionName, type Journal, type Injury, type Layout, type Athlete, type Threshold, type PlanDay } from "../data/schema";
import { blocksOf, spec, workoutId, FIXED_T } from "../domain/spec";

export class ActionError extends Error { constructor(public code: string, msg: string) { super(msg); } }

async function put(col: CollectionName, id: string, data: unknown) {
  const db = database(); if (!db) throw new ActionError("offline", "База недоступна");
  const r = COLLECTIONS[col].safeParse(data);
  if (!r.success) throw new ActionError("invalid", `${col}/${id}: ${r.error.issues[0]?.message ?? "не за схемою"}`);
  await db.doc(`${col}/${id}`).set(r.data as Record<string, unknown>);
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

/** Change a day's level ("Легше / Довше"): the workout of the same type at another level, created when new. */
export async function setLevel(date: string, level: number, note?: string) {
  const day = plan.value[date], cur = day && workouts.value[day.workout];
  if (!day || !cur || cur.sport !== "run") throw new ActionError("missing", "Немає бігового тренування на цей день");
  if (FIXED_T.includes(cur.type)) throw new ActionError("fixed", "Це тренування має одну структуру");
  const id = workoutId(cur.type, level);
  if (!workouts.value[id]) {
    const s = spec(cur.type, level)!;
    await put("workouts", id, { ...cur, level, zone: s.zone, analysis: s.tmpl, blocks: blocksOf(cur.type, level) });
  }
  await put("plan", date, { ...day, workout: id, changes: [...day.changes, { kind: "level", from: day.workout, to: id, note }] });
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
