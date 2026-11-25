import { describe, it, expect } from "vitest";
import { coefs, weightOn, planPace, boldParts, dec } from "../src/domain/library";
import { zonesFrom } from "../src/domain/zones";

const Z = zonesFrom(220, 171, 210, [141, 154, 170, 185]);
describe("База тренувань", () => {
  it("coefficients from threshold 3:40 and goal 35:00", () => {
    const C = Object.fromEntries(coefs(Z, 210, { type: "FastestHalfMarathon", sec: 4680 }, true).map(c => [c.k, c]));
    expect(C["Прогноз на 10 км"].v).toBe("35:34");
    expect(C["Розрив до цілі"].v).toBe("0:34");
    expect(C["Інша дистанція → 10 км"].v).toBe("35:21");
    expect(C["Стеля легкого дня"].v).toBe("154");
    expect(C["5 км → 10 км"].v).toBe("×1,037");
  });
  it("weight: the shortest span holding the date wins", () => {
    const ws = [{ from: "2026-11-01", to: "2026-11-30", w: "70 кг" }, { from: "2026-11-16", to: "2026-11-22", w: "60 кг" }];
    expect(weightOn(ws, "2026-11-18")).toBe("60 кг");
    expect(weightOn(ws, "2026-11-25")).toBe("70 кг");
    expect(weightOn(ws, "2026-12-05")).toBeNull();
  });
  it("pace text by zone", () => {
    expect(planPace("longint", Z)).toEqual({ zone: "Пороговий", pace: "3:36–3:54 /км" });
    expect(planPace("hills", Z)).toBeNull();
  });
  it("bold markup and decimal comma", () => {
    expect(boldParts("a **b** c")).toEqual([{ x: "a ", b: false }, { x: "b", b: true }, { x: " c", b: false }]);
    expect(dec(0.97)).toBe("0,97");
  });
});
