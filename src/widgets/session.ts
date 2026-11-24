// Plain-text description of a planned session from its blocks, and its pace text. Shared by Сьогодні and Цей тиждень.
import type { Block } from "../data/schema";
import type { z } from "zod";
import type { Zones } from "../domain/zones";
import { ZONE_NAME } from "../data/schema";
import { fmtPace } from "../domain/util";
import { zoneRange } from "../domain/zones";

type B = z.infer<typeof Block>;
const m = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));
const zn = (k: string | null) => (k ? ZONE_NAME[k as keyof typeof ZONE_NAME] ?? k : "в гору");
export function blocksText(blocks: B[]): string {
  return blocks.map(b => {
    switch (b.kind) {
      case "warmup": return `розминка ${m(b.min)} хв`;
      case "cooldown": return `заминка ${m(b.min)} хв`;
      case "steady": return `${m(b.min)} хв ${zn(b.zone)}${b.strides ? " з прискореннями" : ""}`;
      case "progression": return `${m(b.min)} хв ${zn(b.zone)} наприкінці`;
      case "effort": return `${b.km ? `${b.km} км` : `${m(b.min)} хв`} ${zn(b.zone)}`;
      case "repeat": {
        const w = b.work.length === 1 ? `${m(b.work[0].min)} хв ${zn(b.work[0].zone)}` : b.work.map(s => `${m(s.min)}`).join("–") + ` хв ${zn(b.work[0].zone)}`;
        const r = b.rest.length ? ` через ${m(b.rest[0])} хв легко` : "";
        return `${b.n} × ${w}${r}`;
      }
    }
  }).join(" · ");
}
export function paceText(zone: string | null, Z: Zones | null): string | null {
  if (!zone || !Z) return null;
  const r = zoneRange(zone, Z);
  return zone === "race" || zone === "tt" ? `${fmtPace(r.fast)} /км` : `${fmtPace(r.fast)}–${fmtPace(r.slow)} /км`;
}
