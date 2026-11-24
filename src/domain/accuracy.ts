// Execution accuracy, 0–100 by parts of the session, ported unchanged from v52 05-accuracy.js.
import { clamp01, pc, fmtPace, minTxt } from "./util";
import { spec, dur, repMin, restMin, K5_TO_THR } from "./spec";
import { zoneRange, hrCeil, type Zones } from "./zones";
import { partOf, lapPace, type Lap, type Part, type Report } from "./report";
import { heatPct, HOT_PCT } from "./weather";
import { ZONE_NAME } from "../data/schema";

const ZONE_CODE: Record<string, string> = Object.fromEntries(Object.entries(ZONE_NAME).map(([k, v]) => [k, v.toUpperCase()]));

function paceFit(p: number | null | undefined, band: { fast: number; slow: number } | null, slowTol: number, fastTol: number) {
  if (!p || !band) return null;
  if (p > band.slow + 2) return clamp01(1 - (p - band.slow - 2) / slowTol);
  if (p < band.fast - 2) return clamp01(1 - (band.fast - 2 - p) / fastTol);
  return 1;
}
function durFit(fact: number | null | undefined, plan: number | null | undefined, lo = 0.85, hi = 1.25, zero = 0.4, floor = 0.6) {
  if (!plan || fact == null) return null; const r = fact / plan;
  if (r < lo) return clamp01((r - zero) / (lo - zero));
  if (r > hi) return Math.max(floor, 1 - ((r - hi) / (hi * 1.5)) * (1 - floor));
  return 1;
}
const hrFit = (hr: number | null | undefined, ceil: number, tol = 12) => (hr && ceil ? clamp01(1 - (hr - ceil) / tol) : null);
function lapsFit(laps: Lap[], fn: (l: Lap) => number | null) {
  const L = laps.filter(l => l[1] >= 200); if (L.length < 3) return null;
  let t = 0, s = 0, ok = 0, k = 0, n = 0;
  L.forEach(l => { const v = fn(l); if (v == null) return; n++; t += l[0]; s += v * l[0]; if (v >= 0.999) { ok += l[0]; k++; } });
  return t ? { s: s / t, ok: ok / t, in: k, n } : null;
}
const ACC_W: Record<string, Record<string, number>> = {
  repeats: { warm: 10, work: 65, rest: 10, cool: 5, total: 10 },
  blocks: { warm: 10, work: 65, rest: 10, cool: 5, total: 10 },
  longfartlek: { warm: 5, work: 50, rest: 10, cool: 5, total: 30 },
  progression: { warm: 25, work: 55, cool: 5, total: 15 },
  steady: { pace: 40, hr: 35, total: 25 },
  long: { pace: 35, hr: 25, total: 25, drift: 15 },
  test: { work: 80, total: 20 },
};
export const ACC_NAME: Record<string, string> = { warm: "Розминка", easy: "Легка частина", work: "Робота", rest: "Відновлення", cool: "Заминка", total: "Обсяг",
  pace: "Темп у зоні", hr: "Пульс до стелі", drift: "Дрейф пульсу" };
export const accLabel = (s: number) => (s >= 90 ? "Точно" : s >= 75 ? "Добре" : s >= 50 ? "Частково" : "Не те тренування");
export const isHot = (rep: Report, rh?: number | null) => typeof rep.temp === "number" && heatPct(rep.temp, rh) >= HOT_PCT;

function restGaps(rep: Report): { t: number; pace: number | null }[] {
  const wi = rep.wi || [], L = rep.laps || [], out: { t: number; pace: number | null }[] = [];
  if (rep.from === "laps") { for (let k = 0; k + 1 < wi.length; k++) { const g = L.slice(wi[k] + 1, wi[k + 1]); if (g.length) out.push(partOf(g)!); } }
  else if (rep.span) { for (let k = 0; k + 1 < rep.span.length; k++) out.push({ t: rep.span[k + 1][0] - rep.span[k][1], pace: null }); }
  return out;
}

export interface AccPart { key: string; w: number; s: number; note: string; share: number; name?: string; reps?: number[] }
export interface Accuracy { score: number; label: string; parts: AccPart[]; as: string }

/**
 * @param planned the plan's session type and level for the day; `rep.as` is what it was analysed as.
 * @param thrPaceNow current threshold pace (the 5 km test target is today's form).
 * @param rh humidity of the run, for the heat allowance.
 */
export function accuracy(rep: Report, lvl: number, thrPaceNow: number, rh?: number | null): Accuracy | null {
  const type = rep.as, sp = spec(type, lvl), Z: Zones = rep.zones; if (!sp) return null;
  const hot = isHot(rep, rh) ? 6 : 0, ceil = hrCeil(Z) + hot, z1 = zoneRange("z1", Z);
  const W = ACC_W[type === "long" ? "long" : type === "longfartlek" ? "longfartlek" : sp.tmpl];
  const parts: AccPart[] = [];
  const add = (key: string, s: number | null | undefined, note: string, extra: object = {}) => {
    if (s != null && W[key]) parts.push({ key, w: W[key], s: clamp01(s), note, share: 0, ...extra }); };
  const planMin = dur(type, lvl)!, factMin = rep.t / 60;
  add("total", durFit(factMin, planMin, 0.85, 1.25, 0.4, 0.6), `${Math.round(factMin)} хв з ${planMin} за планом`);
  const warmPart = (p: { t: number; pace?: number | null } | null | undefined, planM: number | undefined, name?: string, laps?: Lap[] | null) => { if (!p || !planM) return;
    const qf = (x: number) => paceFit(x, { fast: z1.fast, slow: 9999 }, 1, 25), ql = laps ? lapsFit(laps, l => qf(lapPace(l))) : null;
    const d = durFit(p.t / 60, planM, 0.75, 3, 0, 0.8)!, q = ql ? ql.s : p.pace ? qf(p.pace) : null;
    add("warm", q == null ? d : 0.7 * d + 0.3 * q, `${minTxt(p.t)} з ${planM}${p.pace ? `, ${fmtPace(p.pace)} /км` : ""}${q != null && q < 1 ? " (зашвидко)" : ""}`, name ? { name } : {}); };
  const coolPart = (p: Part | null | undefined, planM: number | undefined) => { if (!p || !planM) return; add("cool", durFit(p.t / 60, planM, 0.5, 4, 0, 0.8), `${minTxt(p.t)} з ${planM}`); };

  if (sp.tmpl === "steady") {
    const e = rep.easy || (rep as unknown as Part), key = sp.zone!, band = zoneRange(key, Z);
    const pf = (p: number) => paceFit(p, band, key === "rec" ? 999 : 45, 20);
    const L = [...(rep.laps || [])]; while (L.length > 2 && L[L.length - 1][1] >= 200 && lapPace(L[L.length - 1]) < z1.fast - 10) L.pop();
    const lp = lapsFit(L, l => pf(lapPace(l))), lh = lapsFit(L, l => (l[2] ? hrFit(l[2], ceil) : null));
    const zt = `${ZONE_CODE[key]} ${fmtPace(band.fast)}–${fmtPace(band.slow)}`;
    if (lp) add("pace", lp.s, `у зоні ${pc(lp.ok)}% часу (${lp.in} з ${lp.n} кіл), середній ${fmtPace(e.pace!)} /км, ${zt}`);
    else add("pace", e.pace ? pf(e.pace) : null, e.pace ? `${fmtPace(e.pace)} /км, ${zt} (кіл замало, оцінено за середнім)` : "");
    const h = rep.hr || e.hr;
    if (lh) add("hr", lh.s, `${pc(lh.ok)}% часу до стелі ${ceil} (${lh.in} з ${lh.n} кіл), середній ${h}${hot ? ", з поправкою на спеку" : ""}`);
    else add("hr", hrFit(h, ceil), h ? `${h} при стелі ${ceil}${hot ? " (з поправкою на спеку)" : ""}` : "");
    if (rep.drift) add("drift", clamp01(1 - (rep.drift.pct - 5) / 7), `${rep.drift.pct.toFixed(1)}% між половинами`);
  } else if (sp.tmpl === "test") {
    if (rep.work) {
      const tgt = type === "race" ? Z.race : type === "tt5k" ? thrPaceNow / K5_TO_THR : null;
      const ps = tgt ? paceFit(rep.work.pace, { fast: 0, slow: tgt }, 30, 1) : null;
      const sp2 = rep.splits && rep.splits.length >= 3 ? Math.max(...rep.splits) - Math.min(...rep.splits) : null;
      const ev2 = sp2 == null ? null : clamp01(1 - (sp2 - 8) / 25);
      const s = ps == null ? (ev2 ?? 1) : ev2 == null ? ps : 0.75 * ps + 0.25 * ev2;
      add("work", s, `${fmtPace(rep.work.pace)} /км${tgt ? `, ціль ${fmtPace(tgt)}` : ""}${sp2 != null ? `, розкид ${sp2} с/км` : ""}`);
    } else add("work", 0, "результату на дистанцію не знайдено");
  } else if (sp.tmpl === "progression") {
    warmPart(rep.warm, sp.easy, ACC_NAME.easy, rep.wi && rep.wi.length ? rep.laps.slice(0, rep.wi[0]) : null);
    if (rep.work) {
      const z2 = zoneRange("z2", Z), d = durFit(rep.work.t / 60, sp.fast, 0.7, 1.6, 0.2, 0.7)!;
      const fin = paceFit(rep.work.to, z2, 20, 25)!, grow = rep.work.from > rep.work.to + 5 ? 1 : 0.6;
      add("work", 0.45 * d + 0.4 * fin + 0.15 * grow, `${minTxt(rep.work.t)} з ${sp.fast}, ${fmtPace(rep.work.from)} → ${fmtPace(rep.work.to)} /км`);
    } else add("work", 0, "прискорення не знайдено");
    coolPart(rep.cool, sp.cool);
  } else {
    const R = sp.reps!, n = R.n, thr = Z.thrHR + hot, wz = sp.zone;
    const tol = ["fartlek", "pyramid"].includes(type) ? [30, 40] : [20, 25];
    const repFit = (r: Part | null | undefined, zone: string | null, planSec: number) => { if (!r) return 0;
      const p = zone ? paceFit(r.pace, zoneRange(zone, Z), tol[0], tol[1]) : null;
      const d = durFit(r.t, planSec, 0.8, 1.4, 0.3, 0.7);
      const h = zone === "z2" && r.hr ? hrFit(r.hr, thr + 4, 12) : null;
      const xs = ([[p, 0.6], [d, 0.25], [h, 0.15]] as [number | null, number][]).filter(x => x[0] != null), w = xs.reduce((a, x) => a + x[1], 0);
      return w ? xs.reduce((a, x) => a + x[0]! * x[1], 0) / w : 0; };
    const slots: number[] = []; let note = "";
    if (sp.tmpl === "blocks" && rep.blocks) {
      for (let k = 0; k < n; k++) { const b = rep.blocks[k]; slots.push(b ? (repFit(b.z2, "z2", R.z2! * 60) + repFit(b.z3, "z3", R.z3! * 60)) / 2 : 0); }
      note = `${Math.min(rep.blocks.length, n)} з ${n} блоків`;
    } else if (rep.reps && rep.reps.length) {
      for (let k = 0; k < n; k++) slots.push(repFit(rep.reps[k], wz, repMin(R, k) * 60));
      note = `${rep.reps.length} з ${n} повторів${rep.work && rep.work.pace && wz ? `, ${fmtPace(rep.work.pace)} /км, зона ${ZONE_CODE[wz]} ${fmtPace(zoneRange(wz, Z).fast)}–${fmtPace(zoneRange(wz, Z).slow)}` : ""}`;
    }
    const rp = (rep.reps || []).filter(r => r.pace).map(r => r.pace!), spread = rp.length >= 3 && wz ? Math.max(...rp) - Math.min(...rp) : null;
    const even = spread == null ? 1 : clamp01(1 - (spread - 6) / 20);
    if (spread != null) note += `, розкид ${Math.round(spread)} с/км`;
    if (slots.length) add("work", (0.9 * slots.reduce((a, x) => a + x, 0)) / n + 0.1 * even, note, { reps: slots.map(pc) });
    else add("work", 0, "робочих відрізків не знайдено");
    if (type !== "longfartlek") warmPart(rep.warm || (rep.span && rep.span.length ? { t: rep.span[0][0] - (rep.t0 || 0) } : null), sp.warm);
    coolPart(rep.cool, sp.cool);
    const gaps = restGaps(rep);
    if (gaps.length && R.rest) {
      const gs = gaps.map((g, k) => { const d = durFit(g.t, (restMin(R, k) ?? R.rest) * 60, 0.7, 1.6, 0.2, 0.5)!; const e = g.pace ? clamp01((g.pace - (z1.fast - 15)) / 30) : null; return e == null ? d : 0.7 * d + 0.3 * e; });
      const avg = gaps.reduce((a, g) => a + g.t, 0) / gaps.length;
      add("rest", gs.reduce((a, x) => a + x, 0) / gs.length, `${gaps.length} × ≈${fmtPace(avg)} хв, за планом ${R.rests ? R.rests.join(" / ") + " хв" : fmtPace(R.rest * 60)}`);
    }
  }
  if (!parts.length) return null;
  const sw = parts.reduce((a, p) => a + p.w, 0);
  parts.forEach(p => (p.share = p.w / sw));
  const score = pc(parts.reduce((a, p) => a + p.s * p.share, 0));
  const order = ["warm", "work", "pace", "hr", "drift", "rest", "cool", "total"];
  parts.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return { score, label: accLabel(score), parts, as: type };
}
