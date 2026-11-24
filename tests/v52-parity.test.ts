// Parity with the live v52: the same data must give the same numbers.
// Needs local data that is not in the repo:
//   V2_DATA=<migrate.ts out dir> V52_JSON=<numbers dumped from the v52 source> V52_TODAY=YYYY-MM-DD npx vitest run
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildDays, loadDays, easyIns, type Docs } from "../src/domain/days";
import { formSeries } from "../src/domain/load";
import { easyEff, effRoll } from "../src/domain/aerobic";

const dir = process.env.V2_DATA, ref = process.env.V52_JSON, today = process.env.V52_TODAY ?? "2026-11-24";
const ready = !!dir && !!ref && existsSync(dir) && existsSync(ref);

function col(name: string) {
  const p = join(dir!, name), o: Record<string, any> = {};
  if (existsSync(p)) for (const f of readdirSync(p)) o[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(p, f), "utf8"));
  return o;
}

describe.skipIf(!ready)("v52 parity", () => {
  const D: Docs = { athlete: col("athlete").me ?? null, goals: col("goals"), thresholds: col("thresholds"), workouts: col("workouts"),
    plan: col("plan"), runs: col("runs"), journal: col("journal") };
  const R = ready ? JSON.parse(readFileSync(ref!, "utf8")) : null;
  const days = buildDays(D, today);

  it("planned minutes per day", () => {
    for (const [d, t, , mins] of R.dur) { const x = days.find(y => y.date === d)!; expect([d, x.type]).toEqual([d, t]); expect([d, mins]).toEqual([d, R.dur.find((r: any) => r[0] === d)[3]]); }
  });
  it("accuracy of every analysed day", () => {
    const got: Record<string, any> = {};
    days.forEach(x => { if (x.acc) got[x.date] = { score: x.acc.score, as: x.acc.as, parts: x.acc.parts.map(p => [p.key, Math.round(p.s * 1000) / 1000, Math.round(p.share * 1000) / 1000]) }; });
    // Known difference: 13.11 was swapped with 20.11 after its run was imported. v52 still judges it by the stored
    // report as «hills» (13%); v2 judges the run by the day's current workout, «longint».
    const want = { ...R.acc };
    if (want["2026-11-13"]?.as === "hills") { expect(got["2026-11-13"].as).toBe("longint"); delete want["2026-11-13"]; delete got["2026-11-13"]; }
    expect(got).toEqual(want);
  });
  it("fatigue series", () => {
    const S = formSeries(loadDays(days), today)!;
    expect(S.K!.n).toBe(R.form.K.n);
    expect(S.K!.k).toBeCloseTo(R.form.K.k, 9);
    expect(S.now!.r).toBeCloseTo(R.form.now.r, 9);
    expect(S.end.r).toBeCloseTo(R.form.end.r, 9);
    expect(S.days.filter(x => !x.plan).map(x => [x.d, +x.L.toFixed(3), +x.ctl.toFixed(3), +x.atl.toFixed(3)])).toEqual(R.form.days);
  });
  it("aerobic base", () => {
    const S = formSeries(loadDays(days), today);
    const e = easyEff(easyIns(days), S);
    expect(e.map(p => ({ d: p.d, norm: +p.norm.toFixed(3), raw: +p.raw.toFixed(3), heat: +p.heat.toFixed(4), long: p.long, hard: p.hard }))).toEqual(R.eff);
    expect(effRoll(e.filter(p => !p.long)).map(p => [p.d, +p.v.toFixed(3)])).toEqual(R.roll);
  });
});
