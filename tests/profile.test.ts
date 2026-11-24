import { describe, it, expect } from "vitest";
import { hrMaxEst, estimates, parseBody, parseThreshold, thrHistory, hrRows, areaOf, injSpan, injRows, injHeat, injDays } from "../src/domain/profile";
import { zonesFrom } from "../src/domain/zones";
import type { Injury, Run } from "../src/data/schema";

const run = (date: string, hr: number[]): Run => ({ stravaId: date, date, km: 10, movingSec: 2700, laps: hr.map(h => ({ sec: 300, m: 1000, hr: h, w: null })) });
const I: Injury[] = [
  { from: "2026-10-31", to: "2026-10-31", area: "стопа", side: "П", level: 3, note: "Біль. Далі" },
  { from: "2026-11-03", to: "2026-11-05", area: "стопа", side: "П", level: 1, note: "Краще" },
  { from: "2026-11-06", to: "2026-11-09", area: "задня", side: "Л", level: 1, note: "Біцепс стегна" },
  { from: "2026-08-16", to: "2026-08-17", area: "квадрицепс", side: "обидві", level: 1, note: "Крепатура" },
];

describe("Профіль: оцінки з v52", () => {
  it("макс. пульс: вік, поріг, найвище коло з нагрудним датчиком", () => {
    const R = { a: run("2024-06-01", [199]), b: run("2026-10-01", [170, 183]) };
    expect(hrMaxEst(R, 171, 34)).toEqual({ age: 184, thr: 190, top: { hr: 183, d: "2026-10-01" }, est: 187 });
    expect(hrMaxEst({}, 171).est).toBe(190);
  });
  it("таблиця оцінок: рядки лише для введених даних", () => {
    const Z = zonesFrom(220, 171, 210, [141, 154, 170, 185]);
    const th = { date: "2026-10-19", paceSec: 220, hr: 171, source: "coros" as const }, g = { name: "10K", date: "2027-01-10", km: 10, targetSec: 2100, role: "main" as const };
    const full = estimates({ age: 34, weightKg: 75, heightCm: 181, vo2max: 60 }, th, g, Z, {});
    expect(full.map(r => r.name)).toContain("Індекс маси тіла");
    expect(full.find(r => r.name === "VO2max за формою")!.value).toBe("59.6 мл/кг/хв");
    expect(full.find(r => r.name === "Анаеробний поріг")!.tag).toBe("збігається");
    expect(estimates(null, th, g, Z, {}).map(r => r.name)).not.toContain("Індекс маси тіла");
  });
  it("перевірка введення", () => {
    expect(parseBody({ age: "34", heightCm: "", weightKg: "75,5", sleepNormH: "7", vo2max: "" }).out).toEqual({ age: 34, heightCm: undefined, weightKg: 75.5, sleepNormH: 7, vo2max: undefined });
    expect(parseBody({ age: "9", heightCm: "", weightKg: "", sleepNormH: "", vo2max: "" }).err.age).toBe("Від 12 до 90");
    expect(parseThreshold("3:38", "172", "34:30", 10)).toMatchObject({ paceSec: 218, hr: 172, targetSec: 2070, ok: true });
    expect(parseThreshold("338", "x", "1:00", 10).err).toHaveProperty("pace");
  });
  it("історія порогу: найновіший зверху, зміна до попереднього", () => {
    const h = thrHistory({ a: { date: "2026-10-19", paceSec: 220, source: "coros" }, b: { date: "2026-11-24", paceSec: 216, source: "manual" } });
    expect(h.map(x => [x.date, x.delta])).toEqual([["2026-11-24", -4], ["2026-10-19", null]]);
  });
  it("пульсові зони зі Strava", () => {
    expect(hrRows(zonesFrom(220, 171, 210, [141, 154, 170, 185])).map(r => r.range)).toEqual(["≤141", "142–154", "155–170", "171–185", "186+"]);
  });
});

describe("Профіль: травми", () => {
  it("зони тіла з журналу тренера", () => {
    expect(areaOf("задня")?.name).toBe("Задня поверхня стегна");
    expect(areaOf("гомілковостоп")?.map).toBe("ankle");
  });
  it("період і рядки", () => {
    expect(injSpan(I, "2026-11-24", "30")).toEqual({ from: "2026-10-26", to: "2026-11-24", step: 1 });
    expect(injSpan(I, "2026-11-24", "all").from).toBe("2026-08-10");
    const foot = injRows(I, "2026-10-26", "2026-11-24", "foot", "П");
    expect(injDays(foot, "2026-10-26", "2026-11-24")).toBe(4);
    expect(injRows(I, "2026-08-01", "2026-11-24", "quad", "Л")).toHaveLength(1);   // «обидві» counts for each leg
    const H = injHeat(I, injSpan(I, "2026-11-24", "30"));
    expect(H.rows.map(r => r.name)).toEqual(["Задня поверхня стегна", "Стопа", "Квадрицепс"]);
    expect(H.rows[1].cells.find(c => c.d === "2026-10-31")!.l).toBe(3);
  });
});
