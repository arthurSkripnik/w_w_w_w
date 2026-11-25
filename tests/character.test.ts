import { describe, it, expect } from "vitest";
import { spdOf, levelOf, classOf, boss } from "../src/domain/character";

describe("Персонаж", () => {
  it("speed from the 10 km forecast: 60:00 → 1, 27:00 → 99, goal 35:00 → 75", () => {
    expect(spdOf(3600)).toBe(1); expect(spdOf(1620)).toBe(99); expect(spdOf(2100)).toBe(75);
  });
  it("level n needs 10·n·(n−1) km", () => {
    expect(levelOf(0).lvl).toBe(1); expect(levelOf(19).lvl).toBe(1); expect(levelOf(20).lvl).toBe(2);
    expect(levelOf(571)).toEqual({ lvl: 8, from: 560, to: 720 });
  });
  it("class: the two strongest body stats; close stats → Універсал", () => {
    expect(classOf({ spd: 73, end: 56, str: 72, eco: 66, dis: 84 }).name).toBe("Мілер");
    expect(classOf({ spd: 60, end: 62, str: 58, eco: 61, dis: 90 }).name).toBe("Універсал");
  });
  it("boss: readiness closes as the forecast nears the goal", () => {
    expect(boss(2134, 2100, null).ready).toBe(84);
    expect(boss(2090, 2100, null).ready).toBe(100);
  });
});
