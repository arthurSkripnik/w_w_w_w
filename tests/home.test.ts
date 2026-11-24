import { describe, it, expect } from "vitest";
import { vdot, mmss, plural, sleepWeek, readiness, injuryNow, injuryStrip, forecast } from "../src/domain/home";

describe("Головна: розрахунки з v52", () => {
  it("VDOT за Деніелсом", () => {
    expect(vdot(2100).toFixed(1)).toBe("60.7");          // 35:00 на 10 км, як у v52 «Для цілі 60.7»
    expect(vdot(40 * 60).toFixed(1)).toBe("51.9");
  });
  it("прогноз 10 км = поріг × 0.97 × 10", () => {
    const th = { a: { date: "2026-10-19", paceSec: 220, source: "coros" as const } };
    expect(mmss(forecast(th, th.a)!.t10)).toBe("35:34");
  });
  it("форматування", () => {
    expect(mmss(3725)).toBe("1:02:05");
    expect([1, 2, 5, 11, 22].map(n => plural(n, "день", "дні", "днів"))).toEqual(["день", "дні", "днів", "днів", "дні"]);
  });
  it("сон і готовність", () => {
    const J = { "2026-11-24": { date: "2026-11-24", sleepH: 5.5 }, "2026-11-23": { date: "2026-11-23", sleepH: 7 } };
    expect(sleepWeek(J, "2026-11-24")).toEqual({ avg: 6.25, n: 2 });
    expect(readiness(J, "2026-11-24", 7, null, null).low).toBe(true);
    expect(readiness({}, "2026-11-24", 7, null, null).h).toBeNull();
  });
  it("травми: стан і смужка 30 днів", () => {
    const I = { x: { from: "2026-11-10", to: "2026-11-12", area: "литка", side: "П" as const, level: 2 as const, note: "" } };
    expect(injuryNow(I, "2026-11-24").text).toMatch(/^Без скарг 12 днів/);
    const s = injuryStrip(I, "2026-11-24");
    expect(s.days.filter(d => d.l === 2).length).toBe(3);
    expect(s.areas[0]).toMatchObject({ area: "Литка", days: 3, level: 2 });
  });
});

import { timeFor } from "../src/domain/home";
describe("Прогноз на дистанції", () => {
  it("час для VDOT повертає ту саму VDOT", () => {
    const v = vdot(2134);                                   // 35:34 на 10 км
    expect(Math.round(timeFor(v, 10000))).toBe(2134);
    expect(vdot(timeFor(v, 21097.5), 21097.5)).toBeCloseTo(v, 3);
    expect(timeFor(v, 5000)).toBeLessThan(2134 / 2);
  });
});
