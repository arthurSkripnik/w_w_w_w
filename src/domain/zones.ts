// Pace zones from the threshold pace (ratios from COROS, 19.10.2026: threshold 3:40). Ported from v52 01-plan.js.
import { K5_TO_10K } from "./spec";

export interface Band { fast: number; slow: number }
export interface Zones {
  rec: Band; z1: Band; z2: Band; z3: Band;
  race: number;            // goal pace, s/km
  thrPace: number; thrHR: number;
  hrTops: number[] | null; // upper edge of HR Z1..Z4
}
const RATIO: Record<"rec" | "z1" | "z2" | "z3", { fast: number; slow: number }> = {
  z1: { fast: 251 / 220, slow: 303 / 220 }, z2: { fast: 216 / 220, slow: 234 / 220 },
  z3: { fast: 199 / 220, slow: 215 / 220 }, rec: { fast: 305 / 220, slow: 330 / 220 },
};
// v52 kept zones as "m:ss" text, so every bound is rounded to a whole second
const r = Math.round;
export function zonesFrom(thrPace: number, thrHR: number, racePace: number, hrTops: number[] | null): Zones {
  const b = (k: keyof typeof RATIO) => ({ fast: r(thrPace * RATIO[k].fast), slow: r(thrPace * RATIO[k].slow) });
  return { rec: b("rec"), z1: b("z1"), z2: b("z2"), z3: b("z3"), race: r(racePace), thrPace, thrHR, hrTops };
}
export function zoneRange(key: string, Z: Zones): Band {
  if (key === "race") return { fast: Z.race, slow: Z.race };
  if (key === "tt") { const t = Math.round(Z.race / K5_TO_10K); return { fast: t, slow: t }; }
  return Z[key as "rec" | "z1" | "z2" | "z3"];
}
/** Easy-day HR ceiling: top of HR zone 2 if known, else 0.88 × threshold HR. */
export const hrCeil = (Z: Zones) => (Z.hrTops && Z.hrTops[1] ? Z.hrTops[1] : Math.round(0.88 * Z.thrHR));
export function hrTops(Z: Zones): number[] {
  if (Z.hrTops && Z.hrTops.length >= 4) return Z.hrTops.slice(0, 4);
  const t = Z.thrHR;
  return [Math.round(t * 0.82), Math.round(t * 0.9), Math.round(t * 0.99) - 1, Math.round(t * 1.08)];
}
