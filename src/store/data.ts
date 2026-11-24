// The data layer: one live subscription per collection, documents checked against the schema, kept in signals.
// Screens read these signals (or the derived ones in derived.ts) and never touch the database themselves.
import { signal } from "@preact/signals";
import { getDb } from "../platform/claude";
import { COLLECTIONS, type CollectionName, type Athlete, type Goal, type Threshold, type Workout, type PlanDay, type Run, type Journal, type Injury, type Layout } from "../data/schema";

export const athlete = signal<Athlete | null>(null);
export const goals = signal<Record<string, Goal>>({});
export const thresholds = signal<Record<string, Threshold>>({});
export const workouts = signal<Record<string, Workout>>({});
export const plan = signal<Record<string, PlanDay>>({});
export const runs = signal<Record<string, Run>>({});
export const journal = signal<Record<string, Journal>>({});
export const injuries = signal<Record<string, Injury>>({});
export const layout = signal<Layout | null>(null);

const SIG = { goals, thresholds, workouts, plan, runs, journal, injuries } as const;

/** loading → ready; stale when the store has not answered in 10 s; offline when the page has no database. */
export type DbState = "loading" | "ready" | "stale" | "offline" | "error";
export const dbState = signal<DbState>("loading");
/** Per collection: document count and ids that fail the schema (shown on the check screen). */
export const health = signal<Partial<Record<CollectionName, { n: number; bad: string[]; err?: string }>>>({});

let db: any = null, started = false;
export const database = () => db;

export async function startData(): Promise<void> {
  if (started) return; started = true;
  db = await getDb();
  if (!db) { dbState.value = "offline"; return; }
  const names = Object.keys(COLLECTIONS) as CollectionName[];
  const fresh = new Set<CollectionName>();
  const timer = setTimeout(() => { if (fresh.size < names.length) dbState.value = "stale"; }, 10_000);
  for (const col of names) {
    const q = db.collection(col).limit(1000);
    q.onSnapshot((snap: any) => {
      const ok: Record<string, any> = {}, bad: string[] = [];
      for (const d of snap.docs) {
        const r = COLLECTIONS[col].safeParse(d.data());
        if (r.success) ok[d.id] = r.data; else bad.push(d.id);
      }
      health.value = { ...health.value, [col]: { n: snap.size, bad } };
      if (col === "athlete") athlete.value = (ok.me as Athlete) ?? null;
      else if (col === "layout") layout.value = (ok.home as Layout) ?? null;
      else SIG[col].value = ok as never;
      if (!snap.metadata?.fromCache) fresh.add(col);
      if (fresh.size === names.length) { clearTimeout(timer); dbState.value = "ready"; }
      else if (dbState.value === "loading" && Object.keys(health.value).length === names.length) dbState.value = "ready";
    }, (e: any) => {
      health.value = { ...health.value, [col]: { n: 0, bad: [], err: e?.code ?? "error" } };
      dbState.value = "error";
    });
  }
}
