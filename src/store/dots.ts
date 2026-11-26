// The plan as dots and the weekly km as beads (ui/dots.tsx draws them): one builder for Головна and #kit.
import { computed } from "@preact/signals";
import type { DotItem, BeadCol } from "../ui";
import { days, dayByDate, today, zones } from "./derived";
import { runs } from "./data";
import { dayState } from "../domain/home";
import { dur } from "../domain/spec";
import { typeOf } from "../domain/types";
import { weekMin } from "../calendar/Week";
import { mondayOf, addDays } from "../domain/util";

const dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);

/** Every plan week as a row of seven dots: filled = done, outline = plan, × = missed, accent = threshold or race,
 *  size = planned minutes. */
export const planDots = computed(() => {
  const all = days.value, t = today.value, by = dayByDate.value;
  if (!all.length) return null;
  const maxMin = Math.max(...all.map(d => dur(d.type, Math.max(1, d.level)) ?? 0), 1);
  const mons = [...new Set(all.map(d => mondayOf(d.date)))].sort();
  const item = (iso: string): DotItem => {
    const d = by[iso], now = iso === t;
    if (!d) return { state: "rest", label: `${dm(iso)}: відпочинок`, today: now };
    const st = dayState(d), m = dur(d.type, Math.max(1, d.level)) ?? 0, hard = ["z3", "race"].includes(typeOf(d.type).cat);
    const name = d.workout?.name ?? typeOf(d.type).name;
    return { state: st === "done" ? "done" : st === "miss" ? "miss" : "plan", hard, v: m / maxMin, today: now,
      label: `${dm(iso)}: ${name}, ${st === "done" ? "виконано" : st === "miss" ? "пропущено" : `план ≈${m} хв`}` };
  };
  const rows = mons.map(m => Array.from({ length: 7 }, (_, i) => item(addDays(m, i))));
  const now = mons.indexOf(mondayOf(t));
  return { rows, mons, now };
});

/** km per plan week, `n` weeks ending with this one: done (Strava, up to today) against the plan (minutes at easy pace). */
export const weekBeads = (n: number) => computed<BeadCol[]>(() => {
  const all = days.value, t = today.value, R = Object.values(runs.value), Z = zones.value;
  const easy = Z ? (Z.z1.fast + Z.z1.slow) / 2 / 60 : null, mon = mondayOf(t);
  return Array.from({ length: n }, (_, i) => addDays(mon, (i - n + 1) * 7)).map(m => {
    const end = addDays(m, 6), w = all.filter(d => d.date >= m && d.date <= end);
    const done = R.filter(r => r.date >= m && r.date <= end && r.date <= t).reduce((a, r) => a + r.km, 0);
    return { label: dm(m), done, plan: easy && w.length ? weekMin(w) / easy : undefined, key: w.some(d => d.type === "race"), now: m === mon };
  });
});
