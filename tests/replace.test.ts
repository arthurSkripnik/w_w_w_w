import { describe, it, expect } from "vitest";
import { levelFor, options, warnings } from "../src/domain/replace";
import { dur } from "../src/domain/spec";
import type { Day } from "../src/domain/days";

const day = (date: string, type: string, level = 3) => ({ date, type, level, plan: { changes: [] } }) as unknown as Day;
describe("Замінити з Бази", () => {
  it("level keeps the day's minutes close", () => {
    const m = dur("base", 6)!, l = levelFor("long", m);
    const gaps = Array.from({ length: 10 }, (_, i) => Math.abs((dur("long", i + 1) ?? 0) - m));
    expect(Math.abs(dur("long", l)! - m)).toBe(Math.min(...gaps));
    expect(levelFor("pyramid", 60)).toBe(0);
  });
  it("options: one effort group, without the planned type, races and starts", () => {
    const O = options(day("2026-11-26", "fartlek"), "z2").map(o => o.type);
    expect(O).not.toContain("fartlek");
    expect(O).toContain("fastfinish");
    expect(options(day("2026-11-26", "base"), "z3").map(o => o.type)).not.toContain("race");
  });
  it("warns on hard days in a row, a third hard day and a hard day before the race", () => {
    const by: Record<string, Day> = { "2026-11-24": day("2026-11-24", "shortint"), "2026-11-27": day("2026-11-27", "hills"), "2026-11-26": day("2026-11-26", "base") };
    const W = warnings(by["2026-11-26"], "longint", by, "2026-11-29");
    expect(W.length).toBe(3);
    expect(warnings(by["2026-11-26"], "long", by, "2026-11-29")).toEqual([]);
  });
});
