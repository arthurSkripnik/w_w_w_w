import { describe, it, expect } from "vitest";
import { moveTo, moveStep, addAt, togglePin, resize, hide, clean, type Item } from "../src/widgets/layout";

const L = (s: string): Item[] => s.split(" ").map(t => (t.endsWith("*") ? { id: t.slice(0, -1), size: "compact", pinned: true } : { id: t, size: "compact" }));
const ids = (V: Item[]) => V.map(x => x.id + (x.pinned ? "*" : "")).join(" ");

describe("widget canvas rules", () => {
  it("moves a free widget before an index, and to the end", () => {
    expect(ids(moveTo(L("a b c d"), "d", 0))).toBe("d a b c");
    expect(ids(moveTo(L("a b c d"), "a", 2))).toBe("b a c d");
    expect(ids(moveTo(L("a b c d"), "a", 4))).toBe("b c d a");
  });
  it("keeps a pinned widget on its index while others flow around it", () => {
    expect(ids(moveTo(L("a b* c d"), "d", 0))).toBe("d b* a c");
    expect(ids(moveTo(L("a b* c d"), "a", 4))).toBe("c b* d a");
    expect(ids(moveTo(L("a b* c"), "b", 0))).toBe("a b* c");   // pinned does not move
  });
  it("steps over pinned widgets with the keyboard", () => {
    expect(ids(moveStep(L("a b* c"), "a", 1))).toBe("c b* a");
    expect(moveStep(L("a b c"), "a", -1)).toEqual(L("a b c"));   // at the start: no change
  });
  it("adds a new widget without shifting pinned ones", () => {
    expect(ids(addAt(L("a b* c"), { id: "n", size: "full" }, 0))).toBe("n b* a c");
    expect(ids(addAt(L("a b* c"), { id: "n", size: "full", pinned: true }, 3))).toBe("a b* c n");
  });
  it("pins, resizes and hides, keeping only meaningful fields", () => {
    expect(togglePin(L("a b"), "a")[0]).toEqual({ id: "a", size: "compact", pinned: true });
    expect(togglePin(L("a* b"), "a")[0]).toEqual({ id: "a", size: "compact" });
    expect(resize(L("a"), "a", "compact", 12)[0]).toEqual({ id: "a", size: "compact", span: 12 });
    expect(hide(L("a*"), "a")[0]).toEqual({ id: "a", size: "compact", hidden: true });
    expect(clean({ id: "a", size: "full", span: undefined, pinned: false })).toEqual({ id: "a", size: "full" });
  });
});
