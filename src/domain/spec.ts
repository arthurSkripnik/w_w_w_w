// Session structure by type and level, ported unchanged from v52 (01-plan.js spec/dur).
// The workouts collection stores the same structure as blocks for display; the analysis reads this form.
export type Tmpl = "steady" | "progression" | "repeats" | "blocks" | "test";
export interface Reps { n: number; min: number; rest: number; mins?: number[]; rests?: number[]; z2?: number; z3?: number }
export interface Spec {
  tmpl: Tmpl; zone: string | null;
  warm?: number; easy?: number; fast?: number; main?: number; cool?: number;
  km?: number | null; strides?: boolean; reps?: Reps;
}

export function spec(type: string, lvl: number): Spec | null {
  const L = Math.max(0.5, lvl), r = Math.round;
  switch (type) {
    case "base": return { tmpl: "steady", zone: "z1", easy: r(30 + L * 5) };
    case "recovery": return { tmpl: "steady", zone: "rec", easy: r(20 + L * 3) };
    case "long": return { tmpl: "steady", zone: "z1", warm: 10, easy: r(60 + L * 12), cool: 7, strides: L >= 3 };
    case "longfartlek": return { tmpl: "repeats", zone: "z2", warm: 10, easy: r(70 + L * 10), cool: 7, reps: { n: r(3 + L), min: 2, rest: 3 } };
    case "fastfinish": { const total = r(40 + L * 3.5), fast = r(6 + L * 2);
      return { tmpl: "progression", zone: "z2", easy: total - fast, fast, cool: 4 }; }
    case "fartlek": return { tmpl: "repeats", zone: "z3", warm: 15, cool: 10, reps: { n: r(3 + L * 0.8), min: 2, rest: 2 } };
    case "pyramid": return { tmpl: "repeats", zone: "z3", warm: 15, cool: 10, reps: { n: 5, min: 2.8, rest: 1.5, mins: [2, 3, 4, 3, 2], rests: [1, 1.5, 2, 1.5] } };
    case "hills": return { tmpl: "repeats", zone: null, warm: 20, cool: 10, reps: { n: r(3 + L * 0.9), min: 1.25, rest: 1.75 } };
    case "shortint": return { tmpl: "repeats", zone: "z3", warm: 20, cool: 12, reps: { n: r(4 + L * 1.1), min: 2.5, rest: 2.5 } };
    case "longint": return { tmpl: "repeats", zone: "z2", warm: 20, cool: 10, reps: { n: r(2 + L * 0.8), min: 7, rest: 2.5 } };
    case "mixedint": return { tmpl: "blocks", zone: "z2", warm: 20, cool: 10, reps: { n: r(1 + L), min: 8, z2: 5, z3: 3, rest: 3 } };
    case "tt5k": return { tmpl: "test", zone: "tt", warm: 20, main: 17, cool: 13, km: 5 };
    case "race": return { tmpl: "test", zone: "race", warm: 20, main: 36, cool: 12, km: 10 };
    case "start": return { tmpl: "test", zone: "race", warm: 15, main: 30, cool: 15, km: null };
  }
  return null;
}

/** Planned minutes of the whole session. */
export function dur(type: string, lvl: number): number | null {
  const s = spec(type, lvl); if (!s) return null;
  const R = s.reps, r = Math.round;
  switch (type) {
    case "longint": return s.warm! + r(R!.n * (R!.min + R!.rest)) + s.cool!;
    case "mixedint": return s.warm! + R!.n * R!.min + (R!.n - 1) * R!.rest + s.cool!;
    case "longfartlek": return s.warm! + s.easy! + s.cool!;
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return (s.warm || 0) + (s.easy || 0) + (s.fast || 0) + (s.main || 0)
    + (R ? (R.mins ? sum(R.mins) + sum(R.rests!) : R.n * (R.min + R.rest)) : 0) + (s.cool || 0);
}
export const repMin = (R: Reps, k: number) => (R.mins ? R.mins[k] : R.min);
export const restMin = (R: Reps, k: number) => (R.rests ? R.rests[k] : R.rest);

/** Load per minute by session type (zonal TRIMP style), from v52 09-forecast.js. */
export const LOAD_W: Record<string, number> = {
  recovery: 0.8, base: 1, long: 1.1, fastfinish: 1.4, fartlek: 1.6, pyramid: 1.6, longfartlek: 1.5, hills: 2,
  longint: 2.2, mixedint: 2.2, shortint: 2.4, tt5k: 2.6, race: 2.6, start: 2.6,
};

// race-pace conversions (v52 01-plan.js)
export const THR_TO_10K = 0.97, K5_TO_10K = 1.037, K5_TO_THR = 1.065, HM_KM = 21.0975, RIEGEL = 1.06;
export const eq10 = (km: number, t: number) =>
  km === 10 ? t / 10 : km === 5 ? (t / 5) * K5_TO_10K : (t * Math.pow(10 / km, RIEGEL)) / 10;

/** Blocks of a run session for the workouts collection (zones only, no absolute paces). Same as tools/migrate.ts. */
export function blocksOf(t: string, l: number): any[] {
  const s = spec(t, l); if (!s) return [];
  const R = s.reps, out: any[] = [];
  if (s.warm) out.push({ kind: "warmup", min: s.warm });
  if (s.easy) out.push(t === "fastfinish" ? { kind: "steady", min: s.easy, zone: "z1" }
    : { kind: "steady", min: s.easy, zone: t === "longfartlek" ? "z1" : s.zone, ...(s.strides ? { strides: true } : {}) });
  if (s.fast) out.push({ kind: "progression", min: s.fast, zone: s.zone });
  if (R) {
    if (R.mins) out.push({ kind: "repeat", n: 1, work: R.mins.map(m => ({ min: m, zone: s.zone })), rest: R.rests });
    else if (t === "mixedint") out.push({ kind: "repeat", n: R.n, work: [{ min: R.z2, zone: "z2" }, { min: R.z3, zone: "z3" }], rest: [R.rest] });
    else out.push({ kind: "repeat", n: R.n, work: [{ min: R.min, zone: s.zone }], rest: [R.rest], ...(t === "longfartlek" ? { within: "steady" } : {}) });
  }
  if (s.main) out.push({ kind: "effort", min: s.main, km: s.km ?? null, zone: s.zone });
  if (s.cool) out.push({ kind: "cooldown", min: s.cool });
  return out;
}
/** Sessions with one fixed structure: no level. */
export const FIXED_T = ["tt5k", "race", "start", "pyramid"];
export const workoutId = (t: string, l: number) => (FIXED_T.includes(t) ? t : `${t}-L${l}`);
