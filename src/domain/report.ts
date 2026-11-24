// Run analysis by session template, ported from v52 04-analysis.js (buildReport and its helpers).
// Facts that need the second-by-second stream are measured once at import (measureStream) and stored on the run,
// because the stream itself is not kept; on read the report is rebuilt from laps plus those stored facts.
import { spec, HM_KM, type Spec } from "./spec";
import { hrTops, type Zones } from "./zones";
import { median } from "./util";

/** A lap as v52 kept it: [moving s, metres, avg HR (0 = none), avg watts (0 = none)]. */
export type Lap = [number, number, number, number];
export interface Part { t: number; km: number; pace: number | null; hr: number | null }
export interface Drift { pct: number; a: { pace: number; hr: number }; b: { pace: number; hr: number } }
export interface Spread { fast: number; in: number; slow: number; hrOver: number; t: number; key: string; from?: string; n?: number; min?: number; max?: number }
export interface Pt { t: number; dt: number; v: number; hr: number; c: number | null }

/** What the stream told us at import. Every field is optional: old runs and runs without a stream have none. */
export interface StreamFacts {
  hrz?: number[];                  // seconds in HR zones 1–5
  temp?: number;                   // watch sensor, °C (Strava's weather wins when present)
  easy?: Part & { first40?: true }; // long run: its first 40 minutes
  drift?: Drift | null;
  spread?: Spread;
  reps?: Part[];                   // work reps found in the pace stream (laps did not match the plan)
  span?: [number, number][]; t0?: number;
  blocks?: { z2: Part | null; z3: Part | null }[];
}
export interface Best { k5?: number; k10?: number; k21?: number }
export interface RunSrc { id: string; name?: string; km: number; t: number; hr?: number | null; coros?: number | null; best?: Best; laps: Lap[]; temp?: number | null; h?: number }

export interface Report {
  id: string; name?: string; km: number; t: number; hr: number | null; coros: number | null; best: Best; laps: Lap[];
  pace: number | null; zones: Zones; as: string; tmpl: Spec["tmpl"]; work: any; wi: number[];
  temp?: number; hrz?: number[]; easy?: Part & { first40?: boolean }; drift?: Drift | null; spread?: Spread;
  warm?: Part | null; cool?: Part | null; reps?: Part[]; planN?: number; from?: "laps" | "stream";
  span?: [number, number][]; t0?: number; blocks?: { z2: Part | null; z3: Part | null }[]; splits?: number[];
}

export function partOf(laps: Lap[]): Part | null {
  if (!laps.length) return null;
  const t = laps.reduce((a, l) => a + l[0], 0), d = laps.reduce((a, l) => a + l[1], 0), h = laps.reduce((a, l) => a + (l[2] || 0) * l[0], 0);
  return { t, km: d / 1000, pace: d ? t / (d / 1000) : null, hr: h ? Math.round(h / t) : null };
}
export const lapPace = (l: Lap) => (l[1] ? l[0] / (l[1] / 1000) : Infinity);

// ---- stream helpers (used at import) ----
export function prepStream(st: any): Pt[] | null {
  if (!st || !Array.isArray(st.time) || !Array.isArray(st.velocity_smooth)) return null;
  const T = st.time, V = st.velocity_smooth, H = st.heart_rate || [], M = st.moving || [], C = st.temp || [];
  const pts: Pt[] = [];
  for (let i = 1; i < T.length; i++) {
    const dt = Math.min(T[i] - T[i - 1], 15); if (dt <= 0) continue;
    if (M.length && M[i] === false) continue;
    pts.push({ t: T[i], dt, v: V[i] || 0, hr: H[i] || 0, c: typeof C[i] === "number" ? C[i] : null });
  }
  return pts.length > 20 ? pts : null;
}
function aggPts(p: Pt[]): Part {
  const t = p.reduce((a, x) => a + x.dt, 0), d = p.reduce((a, x) => a + x.v * x.dt, 0), hT = p.reduce((a, x) => a + (x.hr ? x.dt : 0), 0), h = p.reduce((a, x) => a + x.hr * x.dt, 0);
  return { t, km: d / 1000, pace: d ? t / (d / 1000) : null, hr: hT ? Math.round(h / hT) : null };
}
function streamSegs(pts: Pt[], thrPace: number, minSec: number) {
  const vThr = 1000 / thrPace, n = pts.length, sm: number[] = [];
  for (let i = 0; i < n; i++) { let a = 0, w = 0;
    for (let j = i; j >= 0 && pts[i].t - pts[j].t <= 10; j--) { a += pts[j].v * pts[j].dt; w += pts[j].dt; }
    for (let j = i + 1; j < n && pts[j].t - pts[i].t <= 10; j++) { a += pts[j].v * pts[j].dt; w += pts[j].dt; }
    sm.push(w ? a / w : 0); }
  const segs: [number, number][] = []; let s = -1, gap = 0;
  for (let i = 0; i < n; i++) {
    if (sm[i] >= vThr) { if (s < 0) s = i; gap = 0; }
    else if (s >= 0) { gap += pts[i].dt; if (gap > 12) { segs.push([s, i - 1]); s = -1; gap = 0; } }
  }
  if (s >= 0) segs.push([s, n - 1]);
  return segs.map(([a, b]) => { while (b > a && sm[b] < vThr) b--; return { a, b, ...aggPts(pts.slice(a, b + 1)) }; }).filter(x => x.t >= minSec);
}
function hrZoneSecs(pts: Pt[], tops: number[]) {
  const out = [0, 0, 0, 0, 0];
  pts.forEach(p => { if (!p.hr) return; let z = tops.findIndex(t => p.hr <= t); if (z < 0) z = 4; out[z] += p.dt; });
  return out.map(Math.round);
}
function driftOf(pts: Pt[] | null, laps: Lap[]): Drift | null {
  let A: Part | null, B: Part | null;
  if (pts) {
    const p = pts.slice(0, pts.length - Math.round(300 / (pts.reduce((a, x) => a + x.dt, 0) / pts.length)));
    const tot = p.reduce((a, x) => a + x.dt, 0); let acc = 0, k = 0;
    while (k < p.length && acc < tot / 2) { acc += p[k].dt; k++; }
    A = aggPts(p.slice(0, k)); B = aggPts(p.slice(k));
  } else {
    const L = laps.filter(l => l[1] >= 200); if (L.length < 6) return null;
    const h = Math.floor(L.length / 2); A = partOf(L.slice(0, h)); B = partOf(L.slice(h, L.length - 1));
  }
  if (!A || !B || !A.hr || !B.hr || !A.pace || !B.pace) return null;
  const e1 = 1000 / A.pace / A.hr, e2 = 1000 / B.pace / B.hr;
  return { pct: Math.round(((e1 - e2) / e1) * 1000) / 10, a: { pace: A.pace, hr: A.hr }, b: { pace: B.pace, hr: B.hr } };
}
export function spreadOf(samples: { t: number; pace: number | null; hr: number }[], key: "rec" | "z1", Z: Zones, ceil: number): Spread {
  const z = Z[key];
  const o: Spread = { fast: 0, in: 0, slow: 0, hrOver: 0, t: 0, key };
  samples.forEach(x => { if (!x.pace) return; o.t += x.t;
    if (x.pace < z.fast - 2) o.fast += x.t; else if (x.pace > z.slow + 2) o.slow += x.t; else o.in += x.t;
    if (x.hr > ceil) o.hrOver += x.t; });
  return o;
}

/**
 * The analysis of one run as one session type. `pts` is the prepared stream at import, null on read;
 * `facts` are the stream facts stored at import (used where v52 read the stream).
 */
export function buildReport(type: string, lvl: number, src: RunSrc, Z: Zones, pts: Pt[] | null, facts?: StreamFacts, hrCeilBpm?: number): Report | null {
  const sp = spec(type, lvl); if (!sp) return null;
  const laps = src.laps || [];
  const rep: Report = { id: src.id, name: src.name, km: src.km, t: src.t, hr: src.hr ?? null, coros: src.coros ?? null, best: src.best || {}, laps,
    pace: src.km ? src.t / src.km : null, zones: Z, as: type, tmpl: sp.tmpl, work: null, wi: [] };
  if (pts) { rep.hrz = hrZoneSecs(pts, hrTops(Z));
    const tc = pts.filter(p => p.c !== null); if (tc.length > pts.length / 2) rep.temp = Math.round(tc.reduce((a, p) => a + p.c! * p.dt, 0) / tc.reduce((a, p) => a + p.dt, 0)); }
  else if (facts) { if (facts.hrz) rep.hrz = facts.hrz; if (typeof facts.temp === "number") rep.temp = facts.temp; }
  if (typeof src.temp === "number") rep.temp = src.temp;   // Strava's weather beats the wrist sensor
  const z1f = Z.z1.fast;
  const lapIdx = (from: number, to: number) => { const o: number[] = []; for (let i = from; i <= to; i++) o.push(i); return o; };

  if (sp.tmpl === "test") {
    const bk = sp.km || (rep.best.k21 ? HM_KM : rep.best.k10 ? 10 : rep.best.k5 ? 5 : null);
    const v = bk === HM_KM ? rep.best.k21 : bk === 10 ? rep.best.k10 : bk === 5 ? rep.best.k5 : null;
    if (v && bk) rep.work = { t: v, km: bk, pace: v / bk, hr: null, best: true };
    const km = laps.map((l, i) => [l, i] as const).filter(([l]) => l[1] >= 950 && l[1] <= 1050 && rep.work && lapPace(l) <= rep.work.pace + 20);
    if (km.length >= 3) { rep.splits = km.map(([l]) => Math.round(lapPace(l))); rep.wi = km.map(([, i]) => i); }
    return rep;
  }
  if (sp.tmpl === "steady") {
    let L = laps.map((l, i) => [l, i] as const);
    while (L.length > 2 && L[L.length - 1][0][1] >= 200 && lapPace(L[L.length - 1][0]) < z1f - 10) L.pop();
    if (type === "long" && pts) { let acc = 0, k = 0; while (k < pts.length && acc < 2400) { acc += pts[k].dt; k++; } rep.easy = { ...aggPts(pts.slice(0, k)), first40: true }; }
    else if (type === "long" && facts?.easy) rep.easy = facts.easy;
    else if (type === "long") { let acc = 0, k = 0; while (k < L.length && acc < 2400) { acc += L[k][0][0]; k++; } rep.easy = { ...partOf(L.slice(0, k).map(x => x[0]))!, first40: true }; }
    else rep.easy = partOf(L.map(x => x[0]))!;
    if (type === "long") rep.drift = pts ? driftOf(pts, laps) : facts && "drift" in facts ? facts.drift : driftOf(null, laps);
    const keep = L.reduce((a, x) => a + x[0][0], 0);
    if (pts) { let acc = 0; const key = sp.zone === "rec" ? "rec" : "z1";
      rep.spread = spreadOf(pts.filter(p => (acc += p.dt) <= keep + 1).map(p => ({ t: p.dt, pace: p.v > 0.5 ? 1000 / p.v : null, hr: p.hr })), key, Z, hrCeilBpm ?? 0);
      rep.spread.from = "stream"; }
    else if (facts?.spread) rep.spread = facts.spread;
    return rep;
  }
  if (sp.tmpl === "progression") {
    const big = laps.filter(l => l[1] >= 200), med = median(big.slice(0, Math.ceil(big.length / 2)).map(lapPace));
    if (med) {
      let i = laps.length - 1;
      while (i >= 0 && (laps[i][1] < 200 || lapPace(laps[i]) > med - 15)) i--;
      const last = i;
      while (i >= 0 && (laps[i][1] < 200 || lapPace(laps[i]) <= med - 15)) i--;
      let first = i + 1; while (first <= last && laps[first][1] < 200) first++;
      if (last >= first) {
        rep.wi = lapIdx(first, last);
        rep.warm = partOf(laps.slice(0, first)); rep.work = partOf(laps.slice(first, last + 1)); rep.cool = partOf(laps.slice(last + 1));
        const F = laps.slice(first, last + 1).filter(l => l[1] >= 200);
        rep.work.from = lapPace(F[0]); rep.work.to = lapPace(F[F.length - 1]); rep.work.endHr = F[F.length - 1][2] || null;
      }
    }
    return rep;
  }
  // repeats and blocks
  const R = sp.reps!, zone = sp.zone, n = R.n;
  const thrP = zone ? (Z[zone as "z2" | "z3"].slow + z1f) / 2 : null;
  const W = median(laps.filter(l => l[3]).map(l => l[3]));
  const short = R.mins ? Math.min(...R.mins) : R.min, long = R.mins ? Math.max(...R.mins) : R.min;
  const lo = sp.tmpl === "blocks" ? 100 : Math.max(30, short * 60 * 0.5), hi = sp.tmpl === "blocks" ? 480 : Math.max(130, long * 60 * 1.7);
  const isRep = (l: Lap) => l[0] >= lo && l[0] <= hi && (thrP ? lapPace(l) <= thrP : W && l[3] ? l[3] >= W * 1.08 : false);
  const cand = laps.map((l, i) => [l, i] as const).filter(([l]) => isRep(l));
  let reps: (Part & { i?: number })[] | null = null;
  const lapsMatch = cand.length >= Math.max(1, Math.ceil(n * 0.6)) && cand.length <= n * (sp.tmpl === "blocks" ? 2 : 1) + 2;
  if (lapsMatch) { reps = cand.map(([l, i]) => ({ ...partOf([l])!, i })); rep.from = "laps"; }
  else if (pts && thrP) {
    let segs = streamSegs(pts, thrP, sp.tmpl === "blocks" ? R.z3! * 60 * 0.6 : short * 60 * 0.5);
    if (segs.length > n + 3) segs = [...segs].sort((a, b) => b.t - a.t).slice(0, n).sort((a, b) => a.a - b.a);
    if (sp.tmpl === "blocks") {
      rep.blocks = segs.map(sg => { const p = pts.slice(sg.a, sg.b + 1); let acc = 0, k = 0;
        while (k < p.length && acc < R.z2! * 60) { acc += p[k].dt; k++; }
        return { z2: aggPts(p.slice(0, k)), z3: k < p.length ? aggPts(p.slice(k)) : null }; });
    }
    reps = segs.map(sg => ({ t: sg.t, km: sg.km, pace: sg.pace, hr: sg.hr })); rep.from = "stream";
    rep.span = segs.map(sg => [pts[sg.a].t, pts[sg.b].t]); rep.t0 = pts[0].t;
  } else if (facts?.reps && thrP) {
    reps = facts.reps; rep.from = "stream";
    if (facts.blocks) rep.blocks = facts.blocks;
    if (facts.span) rep.span = facts.span;
    if (facts.t0 != null) rep.t0 = facts.t0;
  } else if (cand.length) { reps = cand.map(([l, i]) => ({ ...partOf([l])!, i })); rep.from = "laps"; }
  if (!reps || !reps.length) return rep;
  if (sp.tmpl === "blocks" && !rep.blocks) {
    rep.blocks = []; const L = reps;
    for (let k = 0; k < L.length; k++) {
      if (L[k].t >= 240 && L[k + 1] && L[k + 1].t < 240 && L[k + 1].i === L[k].i! + 1) { rep.blocks.push({ z2: L[k], z3: L[k + 1] }); k++; }
      else rep.blocks.push(L[k].t >= 240 ? { z2: L[k], z3: null } : { z2: null, z3: L[k] });
    }
  }
  rep.reps = reps.map(r => ({ t: r.t, km: r.km, pace: r.pace, hr: r.hr }));
  rep.planN = n;
  const tt = reps.reduce((a, r) => a + r.t, 0), dd = reps.reduce((a, r) => a + r.km, 0), hh = reps.reduce((a, r) => a + (r.hr || 0) * r.t, 0);
  rep.work = { t: tt, km: dd, pace: dd ? tt / dd : null, hr: hh ? Math.round(hh / tt) : null, n: reps.length };
  if (rep.from === "laps") {
    rep.wi = reps.map(r => r.i!);
    const a = reps[0].i!, b = reps[reps.length - 1].i!;
    rep.warm = partOf(laps.slice(0, a)); rep.cool = partOf(laps.slice(b + 1));
  }
  return rep;
}

/** The stream facts to store with a run, taken from a report built with the stream. */
export function factsOf(rep: Report): StreamFacts {
  const f: StreamFacts = {};
  if (rep.hrz) f.hrz = rep.hrz;
  if (typeof rep.temp === "number") f.temp = rep.temp;
  if (rep.easy?.first40) f.easy = rep.easy as StreamFacts["easy"];
  if (rep.as === "long") f.drift = rep.drift ?? null;
  if (rep.spread) f.spread = rep.spread;
  if (rep.from === "stream") { f.reps = rep.reps; f.span = rep.span; f.t0 = rep.t0; if (rep.blocks) f.blocks = rep.blocks; }
  return f;
}
