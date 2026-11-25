import { describe, it, expect } from "vitest";
import { journalPatch, injuryFor, fromJournal, needsJournal, type Answers } from "../src/domain/journal";

const A = (p: Partial<Answers>): Answers => ({ feel: null, legs: null, rpe: null, sleepH: null, fuel: null, fit: null, pain: null, area: null, side: null, note: "", ...p });
describe("Журнал після пробіжки", () => {
  it("writes only what was answered", () => {
    expect(journalPatch(A({ feel: "важко", rpe: 7 }))).toEqual({ feel: "важко", rpe: 7 });
    expect(journalPatch(A({ pain: "нема" }))).toEqual({ pains: {} });
    expect(journalPatch(A({ pain: "є, не міняв ходу", area: "стопа", side: "П" })).pains).toEqual({ стопа: "є, не міняв ходу" });
  });
  it("pain goes to the injury log, extending yesterday's entry", () => {
    const a = A({ pain: "є, змінив ходу", area: "стопа", side: "П", note: "" });
    expect(injuryFor(a, "2026-11-25", {})?.x).toMatchObject({ from: "2026-11-25", level: 3, area: "стопа" });
    const prev = { "2026-11-23-стопа-П": { from: "2026-11-23", to: "2026-11-24", area: "стопа", side: "П" as const, level: 1 as const, note: "x" } };
    expect(injuryFor(a, "2026-11-25", prev)).toMatchObject({ id: "2026-11-23-стопа-П", x: { to: "2026-11-25", level: 3 } });
    expect(injuryFor(A({ pain: "нема" }), "2026-11-25", {})).toBeNull();
  });
  it("a day waits for its journal until a question is answered", () => {
    expect(needsJournal(null)).toBe(true);
    expect(needsJournal({ date: "2026-11-25", sleepH: 7 })).toBe(true);
    expect(needsJournal({ date: "2026-11-25", rpe: 5 })).toBe(false);
    expect(fromJournal({ date: "2026-11-25", pains: { коліно: "ледь відчув" } })).toMatchObject({ pain: "ледь відчув", area: "коліно" });
  });
});
