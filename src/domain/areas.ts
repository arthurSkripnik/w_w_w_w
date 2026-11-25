// Body areas of the injury log: the stored key (as the coach writes it), the name, and the place on the body map.
import type { Injury } from "../data/schema";

/** Body areas: the stored key (as the coach's log writes it), the name, and where it sits on the map. */
export const AREAS = [
  { k: "стопа", name: "Стопа", map: "foot" }, { k: "гомілковостоп", name: "Гомілковостоп", map: "ankle" },
  { k: "гомілка", name: "Гомілка", map: "shin" }, { k: "литка", name: "Литка", map: "calf" },
  { k: "коліно", name: "Коліно", map: "knee" }, { k: "квадрицепс", name: "Квадрицепс", map: "quad" },
  { k: "задня", name: "Задня поверхня стегна", map: "ham" }, { k: "сідниця", name: "Сідниця", map: "glute" },
  { k: "кульшовий", name: "Кульшовий суглоб", map: "hip" }, { k: "поперек", name: "Поперек", map: "back" },
] as const;
export type MapPart = (typeof AREAS)[number]["map"];
export const areaOf = (s: string) => { const x = s.toLowerCase().trim(); return AREAS.find(a => a.k === x) ?? AREAS.find(a => x.startsWith(a.k)) ?? null; };
export const areaName = (s: string) => areaOf(s)?.name ?? s.charAt(0).toUpperCase() + s.slice(1);
export const SIDE_NAME: Record<Injury["side"], string> = { "П": "права", "Л": "ліва", "обидві": "обидві" };

