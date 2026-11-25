import { describe, it, expect } from "vitest";
import { dayPhase, phaseTag } from "../src/domain/home";
import type { Day } from "../src/domain/days";

const day = (p: Partial<Day> & { date: string; type: string }) =>
  ({ run: null, journal: null, acc: null, report: null, extras: [], level: 1, act: p.type, ...p }) as unknown as Day;
const T = "2026-11-25";

describe("day window phase", () => {
  it("ahead, today and missed by date", () => {
    expect(dayPhase(day({ date: "2026-11-28", type: "base" }), T)).toBe("future");
    expect(dayPhase(day({ date: T, type: "base" }), T)).toBe("today");
    expect(dayPhase(day({ date: "2026-11-20", type: "base" }), T)).toBe("missed");
  });
  it("a run or an RPE makes it done, with accuracy in the tag", () => {
    const d = day({ date: "2026-11-20", type: "base", run: { km: 10 } as Day["run"], acc: { score: 92 } as Day["acc"] });
    expect(dayPhase(d, T)).toBe("done");
    expect(phaseTag(d, "done").tag).toBe("виконано 92%");
    expect(dayPhase(day({ date: "2026-11-20", type: "base", journal: { date: "2026-11-20", rpe: 5 } as Day["journal"] }), T)).toBe("done");
  });
  it("race and start lead with their plan until done", () => {
    expect(dayPhase(day({ date: "2027-01-10", type: "race" }), T)).toBe("race");
    expect(dayPhase(day({ date: T, type: "start" }), T)).toBe("race");
    expect(phaseTag(day({ date: "2027-01-10", type: "race" }), "race").tag).toBe("гонка");
  });
});
