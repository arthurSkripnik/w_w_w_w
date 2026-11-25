// «Замінити з Бази»: which sessions can stand on a plan day instead of the planned one, at what level, and what to watch.
import type { Day } from "./days";
import { typeOf } from "./types";
import { dur, FIXED_T } from "./spec";
import { LIB_ORDER } from "./library";
import { addDays, mondayOf } from "./util";

export type Cat = "z1" | "z2" | "z3";
export const REPLACE_CATS: { id: Cat; title: string }[] = [{ id: "z1", title: "Легкі" }, { id: "z2", title: "Помірні" }, { id: "z3", title: "Важкі" }];
const NOT = ["race", "start"];

/** The level of `type` closest in minutes to the planned session, so the day's time stays about the same. */
export function levelFor(type: string, mins: number) {
  if (FIXED_T.includes(type)) return 0;
  let best = 1, gap = Infinity;
  for (let l = 1; l <= 10; l++) { const m = dur(type, l); if (m != null && Math.abs(m - mins) < gap) { gap = Math.abs(m - mins); best = l; } }
  return best;
}

export interface Option { type: string; level: number; mins: number }
/** Sessions of one effort group for a day: every type of the Base except the planned one, races and starts. */
export function options(day: Day, cat: Cat): Option[] {
  const mins = dur(day.type, Math.max(1, day.level)) ?? 60;
  return LIB_ORDER.filter(t => !NOT.includes(t) && t !== day.type && typeOf(t).cat === cat)
    .map(t => { const level = levelFor(t, mins); return { type: t, level, mins: dur(t, level) ?? 0 }; });
}

/** Plan rules a replacement would break: two hard days in a row, more than two hard days a week, a hard day before the race. */
export function warnings(day: Day, type: string, by: Record<string, Day>, race: string | null): string[] {
  if (typeOf(type).cat !== "z3") return [];
  const hard = (d: Day | undefined) => !!d && d.date !== day.date && typeOf(d.type).cat === "z3";
  const out: string[] = [];
  const nb = [addDays(day.date, -1), addDays(day.date, 1)].filter(d => hard(by[d]));
  if (nb.length) out.push("Поруч ще один важкий день: між важкими має бути легкий.");
  const mon = mondayOf(day.date), n = Array.from({ length: 7 }, (_, i) => by[addDays(mon, i)]).filter(hard).length + 1;
  if (n > 2) out.push(`Це буде ${n}-й важкий день тижня, а правило плану: не більше двох.`);
  if (race && race > day.date && race <= addDays(day.date, 3)) out.push("До старту менше 4 днів: важке тренування не встигне відновитися.");
  return out;
}
