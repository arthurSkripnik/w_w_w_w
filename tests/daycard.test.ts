import { describe, it, expect } from "vitest";
import { zonesFrom } from "../src/domain/zones";
import { gen, kpis, splits, shapeOf, verdict, zoneMark } from "../src/domain/text";

const Z = zonesFrom(220, 171, 210, [141, 154, 170, 185]);   // threshold 3:40, goal 3:30, Strava HR zones

describe("Картка дня: тексти й числа з v52", () => {
  it("як бігти: базовий і довгий", () => {
    expect(gen("base", 6, Z).main).toBe("60 хв у легкому темпі (4:11–5:03/км). Темп розмовний.");
    expect(gen("long", 3, Z).warmup).toBe("10 хв легко.");
  });
  it("числа дня", () => {
    const k = kpis("base", 6, Z, true);
    expect(k.map(x => x.val)).toEqual(["60 хв", "4:11–5:03", "до 154"]);
    expect(k[0].sub).toBe("≈13 км");
  });
  it("спліти швидкого фінішу закінчуються біля верху порогового темпу", () => {
    const sp = splits("fastfinish", 5, Z)!;
    expect(sp.filter(x => x.w).at(-1)!.p).toBe(Z.z2.fast + 6);
    expect(sp[0].p).toBe(Z.z1.slow - 8);
  });
  it("смужка форми: хвилини по порядку дорівнюють тривалості", () => {
    expect(shapeOf("fartlek", 4).reduce((a, [m]) => a + m, 0)).toBe(15 + 10 + 6 * 2 + 5 * 2);
  });
  it("вердикти", () => {
    expect(verdict("base", 280, Z)?.tag).toBe("у зоні");
    expect(verdict("race", 212, Z)?.tag).toBe("+2 с/км до цілі");
    expect(zoneMark(240, "z1", Z)?.tag).toBe("між зонами");
  });
});
