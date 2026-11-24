// Store values behind the Головна widgets (domain/home.ts does the arithmetic).
import { computed } from "@preact/signals";
import { athlete, thresholds, journal, injuries, runs } from "./data";
import { today, threshold, goal, zones, days, dayByDate } from "./derived";
import { forecast, vdot, sleepWeek, readiness, weekStat, injuryNow, injuryStrip, daysTo } from "../domain/home";

export const sleepNorm = computed(() => athlete.value?.sleepNormH ?? 8);
export const fc = computed(() => forecast(thresholds.value, threshold.value));
export const vo2 = computed(() => {
  const f = fc.value, g = goal.value;
  return f && g ? { v: vdot(f.t10), need: vdot((g.targetSec / g.km) * 10), coros: athlete.value?.vo2max ?? null, pts: f.pts.map(p => ({ d: p.d, v: vdot(p.t10) })) } : null;
});
export const todayDay = computed(() => dayByDate.value[today.value] ?? null);
export const ready = computed(() => readiness(journal.value, today.value, sleepNorm.value, todayDay.value, zones.value));
export const sleep7 = computed(() => sleepWeek(journal.value, today.value));
export const week = computed(() => weekStat(days.value, runs.value, today.value, zones.value));
export const injNow = computed(() => injuryNow(injuries.value, today.value));
export const inj30 = computed(() => injuryStrip(injuries.value, today.value));
export const toRace = computed(() => daysTo(goal.value, today.value));

