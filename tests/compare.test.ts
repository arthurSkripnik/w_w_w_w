import { describe, it, expect } from "vitest";
import { avgSide, val, delta, fmtDiff, verdict, one, repsOf, prevOf, adjPace, weatherNote, type CmpRun, type GroupRuns } from "../src/domain/compare";

const run = (d: string, pace: number, hr: number, eff: number | null = null, reps: { pace: number; hr: number }[] | null = null): CmpRun => ({
  d, t: "base", lvl: 2, planN: null, km: 8, sec: pace * 8, temp: 15, rh: null, tsrc: "strava", heat: 0, key: { pace, hr }, eff, acc: 90, drift: null, work: null, warm: null,
  reps: reps?.map(r => ({ t: 0, km: 1, ...r })) ?? null, spread: null, laps: [] });
const G = (runs: CmpRun[]): GroupRuns => ({ k: "easy", name: "Легкі", t: ["base", "recovery"], runs });

describe("Порівняння", () => {
  it("the 6-week mean takes only runs of the 42 days before B", () => {
    const g = G([run("2026-09-01", 300, 140), run("2026-10-20", 290, 140), run("2026-11-01", 280, 144), run("2026-11-20", 270, 140)]);
    const A = avgSide(g, g.runs[3])!;
    expect(A.runs.map(r => r.d)).toEqual(["2026-10-20", "2026-11-01"]);
    expect(val(A, r => r.key.pace)).toBe(285);
    expect(avgSide(g, g.runs[1])).toBeNull();
  });
  it("delta: lower pace is better, bar capped at half", () => {
    expect(delta(290, 270, { better: -1, scale: 15 })).toEqual({ d: -20, good: true, bad: false, w: 50 });
    expect(delta(null, 270, { better: -1, scale: 15 })).toBeNull();
    expect(fmtDiff(-20, "pace")).toBe("−20 с");
  });
  it("verdict on easy runs uses pace at HR 145", () => {
    const a = run("2026-11-01", 290, 146, 284), b = run("2026-11-20", 281, 138, 264);
    const v = verdict("easy", one(a), b);
    expect(v.head).toBe("При тому самому пульсі 145 легкий біг на 20 с/км швидше.");
    expect(v.text).toMatch(/аеробна база росте/);
  });
  it("names different levels", () => {
    const a = { ...run("2026-11-01", 210, 168), t: "fartlek", lvl: 2, planN: 5 }, b = { ...run("2026-11-20", 205, 168), t: "fartlek", lvl: 3, planN: 7 };
    expect(verdict("fartlek", one(a), b).text).toMatch(/Різні рівні: Р2 і Р3: 5 і 7 повторів\.$/);
    expect(verdict("fartlek", one({ ...a, lvl: 3 }), b).text).not.toMatch(/рівні/);
  });
  it("reps of a mean side: mean pace per rep number", () => {
    const A = { label: "", d: null, runs: [run("a", 0, 0, null, [{ pace: 200, hr: 170 }, { pace: 210, hr: 172 }]), run("b", 0, 0, null, [{ pace: 210, hr: 168 }])] };
    expect(repsOf(A)).toEqual([{ pace: 205, hr: 169 }, { pace: 210, hr: 172 }]);
  });
  it("weather: pace brought to 15°, named in the verdict when heat differs", () => {
    const a = { ...run("2026-11-01", 220, 170), t: "fartlek", temp: 15, heat: 0 }, b = { ...run("2026-11-20", 224, 170), t: "fartlek", temp: 25, heat: 3 };
    expect(adjPace(b)).toBeCloseTo(217.28);
    expect(weatherNote(one(a), b, false)).toBe(" З поправкою на погоду (15° і 25°) на 3 с/км швидше.");
    expect(weatherNote(one(a), { ...b, heat: 0.2 }, false)).toBe("");
    expect(weatherNote(one(a), { ...b, tsrc: "norm" }, true)).toMatch(/\(15° і ≈25°\), але цей темп уже приведено до 15°/);
  });
  it("default pair: same session and level first, else the latest", () => {
    const f = (d: string, lvl: number, t = "fartlek") => ({ ...run(d, 210, 168), t, lvl });
    const g = { ...G([f("2026-10-01", 3), f("2026-10-20", 3), f("2026-11-01", 4), f("2026-11-05", 2, "pyramid"), f("2026-11-20", 3)]), k: "fartlek" };
    expect(prevOf(g, g.runs[4])!.d).toBe("2026-10-20");
    expect(prevOf(g, { ...g.runs[4], lvl: 5 })!.d).toBe("2026-11-01");
    expect(prevOf(g, g.runs[0])).toBeNull();
  });
});
