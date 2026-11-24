// Aerobic base: easy-run pace scaled to HR 145 and to cool weather, smoothed over 14 days. Ported from v52 09-forecast.js / 10-progress.js.
import { addDays, daysBetween } from "./util";
import { heatPct, runTemp } from "./weather";
import type { FormSeries } from "./load";

export const EASY_REF_HR = 145, LONG_MIN = 75, HARD_DAY = 1.3;

export interface EasyIn {
  d: string; act: string;
  easy: { pace: number | null; hr: number | null; km: number; first40?: boolean };
  t: number;                               // moving seconds of the whole run
  temp: number | null; rh: number | null; fromWx: boolean; hour?: number; name?: string;
}
export interface EasyPt { d: string; t: string; pace: number; hr: number; km: number; first40: boolean; raw: number; heat: number; temp: number; rh: number | null; tsrc: string; norm: number; long: boolean; hard: boolean; prevL: number | null }

export function easyEff(runs: EasyIn[], S: FormSeries | null): EasyPt[] {
  const at: Record<string, FormSeries["days"][number]> = {}; if (S) S.days.forEach(x => (at[x.d] = x));
  return runs.filter(e => ["base", "long", "recovery"].includes(e.act)).map((e): EasyPt | null => {
    const x = e.easy; if (!x.pace || !x.hr) return null;
    const tc = runTemp(e.d, e.temp, e.rh, e.fromWx, e.hour, e.name), raw = (x.pace * x.hr) / EASY_REF_HR, heat = heatPct(tc.t, tc.rh) / 100;
    const prev = at[addDays(e.d, -1)], hard = !!(prev && prev.ctl > 0 && prev.L >= HARD_DAY * prev.ctl);
    return { d: e.d, t: e.act, pace: x.pace, hr: x.hr, km: x.km, first40: !!x.first40, raw, heat, temp: tc.t, rh: tc.rh, tsrc: tc.src,
      norm: raw * (1 - heat), long: e.act === "long" || e.t >= LONG_MIN * 60, hard, prevL: prev ? prev.L : null };
  }).filter((p): p is EasyPt => p !== null);
}
/** At each easy run: the weighted mean of the easy runs of the last 14 days (a run the day after a hard day counts half). */
export function effRoll(pts: EasyPt[]) {
  const wt = (p: EasyPt) => (p.hard ? 0.5 : 1);
  return pts.map(p => { const w = pts.filter(q => { const g = daysBetween(q.d, p.d); return g >= 0 && g < 14; }), s2 = w.reduce((a, q) => a + wt(q), 0);
    return { d: p.d, v: w.reduce((a, q) => a + q.norm * wt(q), 0) / s2 }; });
}
