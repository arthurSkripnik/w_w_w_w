// Run Plan v2 data model. One schema per collection in the artifact's database.
// Rule: store facts and decisions; anything derived (pace zones, run analysis, form) is computed on read.
// Model agreed with Arthur 2026-11-24: https://claude.ai/artifact/29zpL4nqzukHra56R4C6k6
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const sec = z.number().nonnegative();

/** Pace zones, named by effort. Paces in min/km are derived from the current threshold. */
export const Zone = z.enum(["rec", "z1", "z2", "z3", "race", "tt"]);
export const ZONE_NAME: Record<z.infer<typeof Zone>, string> = {
  rec: "відновний", z1: "легкий", z2: "пороговий", z3: "швидкий", race: "цільовий", tt: "контрольний",
};

// ---- athlete/me ----------------------------------------------------------
export const Athlete = z.object({
  age: z.number().int().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  sleepNormH: z.number().optional(),
  vo2max: z.number().optional(),                       // COROS estimate
  hrZoneTops: z.array(z.number()).optional(),          // bpm, upper edge of Z1..Z4 (from Strava)
  refRace: z.object({ type: z.string(), sec }).optional(), // best effort used as a form reference
});

// ---- goals/<id> ----------------------------------------------------------
export const Goal = z.object({
  name: z.string(),
  date: isoDate,
  km: z.number().positive(),
  targetSec: sec,
  role: z.enum(["main", "intermediate"]),
});

// ---- thresholds/<date> ---------------------------------------------------
export const Threshold = z.object({
  date: isoDate,
  paceSec: sec,                                        // threshold pace, s/km
  hr: z.number().optional(),
  source: z.enum(["coros", "test", "manual"]),
});

// ---- workouts/<id> -------------------------------------------------------
const Step = z.object({ min: z.number().positive(), zone: Zone.nullable() });
export const Block = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("warmup"), min: z.number().positive() }),
  z.object({ kind: z.literal("cooldown"), min: z.number().positive() }),
  z.object({ kind: z.literal("steady"), min: z.number().positive(), zone: Zone, strides: z.boolean().optional() }),
  z.object({ kind: z.literal("progression"), min: z.number().positive(), zone: Zone }),
  z.object({
    kind: z.literal("repeat"),
    n: z.number().int().positive(),
    work: z.array(Step).min(1),                        // one step, or a fixed sequence (pyramid, mixed block)
    rest: z.array(z.number().nonnegative()),           // minutes easy between reps
    within: z.literal("steady").optional(),            // reps sit inside the preceding steady block
  }),
  z.object({ kind: z.literal("effort"), min: z.number().positive(), km: z.number().nullable(), zone: Zone }),
]);

const Exercise = z.object({
  name: z.string(),
  dose: z.string(),                                     // "4 × 5", "3 × 20 с"
  cue: z.string().optional(),
  weights: z.array(z.object({ from: isoDate, to: isoDate, w: z.string() })).optional(),
});

export const Workout = z.discriminatedUnion("sport", [
  z.object({
    sport: z.literal("run"),
    type: z.string(),                                   // base, long, fartlek, longint, ...
    name: z.string(),
    level: z.number(),
    zone: Zone.nullable(),                              // the session's main zone
    analysis: z.enum(["steady", "progression", "repeats", "blocks", "test"]),
    blocks: z.array(Block).min(1),
    note: z.string().optional(),
  }),
  z.object({
    sport: z.literal("strength"),
    name: z.string(),
    min: z.number().positive(),
    exercises: z.array(Exercise).min(1),
    rules: z.array(z.string()).optional(),
  }),
]);

// ---- plan/<date> ---------------------------------------------------------
export const PlanChange = z.object({
  kind: z.enum(["swap", "level", "start", "eased"]),
  from: z.string(),                                     // what it was (workout id or date)
  to: z.string(),
  note: z.string().optional(),
});
export const PlanDay = z.object({
  date: isoDate,
  workout: z.string(),                                  // workouts/<id>
  gym: z.string().optional(),                           // workouts/<id> of a strength session after the run
  phase: z.enum(["base", "peak", "taper"]),
  week: z.number().int().positive(),
  goal: z.string(),                                     // goals/<id> this day builds towards
  changes: z.array(PlanChange).default([]),
});

// ---- runs/<stravaId> -----------------------------------------------------
const Part = z.object({ t: z.number(), km: z.number(), pace: z.number().nullable(), hr: z.number().nullable() });
/** Facts measured from the second-by-second stream at import; the stream itself is not kept. */
const StreamFacts = z.object({
  hrz: z.array(z.number()).length(5).optional(),        // seconds in HR zones 1–5
  temp: z.number().optional(),                          // watch sensor, °C
  easy: Part.extend({ first40: z.literal(true).optional() }).optional(), // long run: its first 40 minutes
  drift: z.object({ pct: z.number(), a: z.object({ pace: z.number(), hr: z.number() }), b: z.object({ pace: z.number(), hr: z.number() }) }).nullable().optional(),
  spread: z.object({ fast: z.number(), in: z.number(), slow: z.number(), hrOver: z.number(), t: z.number(), key: z.string(), from: z.string().optional() }).optional(),
  reps: z.array(Part).optional(),                       // work reps found in the pace stream
  span: z.array(z.tuple([z.number(), z.number()])).optional(),
  t0: z.number().optional(),
  blocks: z.array(z.object({ z2: Part.nullable(), z3: Part.nullable() })).optional(),
});
export const Run = z.object({
  stravaId: z.string(),
  date: isoDate,
  startHour: z.number().optional(),
  name: z.string().optional(),
  km: z.number().nonnegative(),
  movingSec: sec,
  hr: z.number().optional(),
  corosLoad: z.number().optional(),
  laps: z.array(z.object({ sec, m: z.number(), hr: z.number().nullable(), w: z.number().nullable() })).optional(),
  weather: z.record(z.string(), z.unknown()).nullable().optional(),
  planDate: isoDate.optional(),                         // the plan day this run reports on
  extra: z.boolean().optional(),                        // a second, short run that day
  exclude: z.boolean().optional(),                      // leave out of analysis
  best: z.object({ k5: z.number().optional(), k10: z.number().optional(), k21: z.number().optional() }).optional(), // Strava best efforts, s
  stream: StreamFacts.optional(),
  source: z.enum(["plan", "archive"]).optional(),       // archive: before the plan, summary only
});

// ---- journal/<date> ------------------------------------------------------
export const Journal = z.object({
  date: isoDate,
  skipped: z.boolean().optional(),                      // planned run not done
  actualType: z.string().optional(),                    // ran something else than planned
  manual: z.object({ pace: z.string().optional(), hr: z.number().optional() }).optional(),
  rpe: z.number().optional(),
  sleepH: z.number().optional(),
  sleepText: z.string().optional(),
  feel: z.string().optional(),
  pains: z.record(z.string(), z.string()).optional(),   // body area → how it felt
  session: z.string().optional(),                       // what was done, as written
  numbers: z.string().optional(),                       // Strava numbers as written by the coach
  note: z.string().optional(),
});

// ---- injuries/<id> -------------------------------------------------------
export const Injury = z.object({
  from: isoDate,
  to: isoDate,
  area: z.string(),
  side: z.enum(["П", "Л", "обидві"]),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  note: z.string(),
});

// ---- layout/home ---------------------------------------------------------
export const Layout = z.object({
  widgets: z.array(z.object({ id: z.string(), size: z.enum(["compact", "full"]), hidden: z.boolean().optional() })),
});

export const COLLECTIONS = {
  athlete: Athlete, goals: Goal, thresholds: Threshold, workouts: Workout,
  plan: PlanDay, runs: Run, journal: Journal, injuries: Injury, layout: Layout,
} as const;
export type CollectionName = keyof typeof COLLECTIONS;

export type Athlete = z.infer<typeof Athlete>;
export type Goal = z.infer<typeof Goal>;
export type Threshold = z.infer<typeof Threshold>;
export type Workout = z.infer<typeof Workout>;
export type PlanDay = z.infer<typeof PlanDay>;
export type Run = z.infer<typeof Run>;
export type Journal = z.infer<typeof Journal>;
export type Injury = z.infer<typeof Injury>;
export type Layout = z.infer<typeof Layout>;
