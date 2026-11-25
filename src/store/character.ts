// The character from the store: every input is an existing number (forecast, form, aerobic base, runs, plan).
import { computed } from "@preact/signals";
import { runs, athlete } from "./data";
import { days, today, zones, form, aerobic, goal } from "./derived";
import { fc } from "./home";
import { proj } from "./lab";
import { character, boss, perks } from "../domain/character";
import { hrCeil } from "../domain/zones";

const goal10 = computed(() => { const g = goal.value; return g ? (g.targetSec / g.km) * 10 : null; });
export const char = computed(() => {
  const Z = zones.value, F = form.value; if (!Z || !days.value.length) return null;
  const loads: Record<string, number> = {}; F?.days.forEach(x => (loads[x.d] = x.L));
  return character({ today: today.value, days: days.value, runs: Object.values(runs.value), easy: aerobic.value.pts, ceil: hrCeil(Z),
    t10: fc.value?.t10 ?? null, goal10: goal10.value, formR: F?.now?.r ?? null, loads });
});
export const bossNow = computed(() => {
  const t = fc.value?.t10, g = goal10.value; if (!t || !g) return null;
  const p = proj.value, at = p && p.mid.length ? p.mid[p.mid.length - 1].s : null;
  return { ...boss(t, g, at), t10: t, goal10: g, race: goal.value!.date, name: goal.value!.name };
});
export const perkList = computed(() => {
  const Z = zones.value; if (!Z) return [];
  return perks({ today: today.value, days: days.value, runs: Object.values(runs.value), easy: aerobic.value.pts, ceil: hrCeil(Z), racePace: Z.race, refRace: athlete.value?.refRace ?? null });
});
