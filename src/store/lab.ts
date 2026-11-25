// Store values behind the Лабораторія widgets (domain/lab.ts does the arithmetic).
import { computed } from "@preact/signals";
import { runs, thresholds } from "./data";
import { today, zones, days, aerobic, archive, threshold } from "./derived";
import { fc } from "./home";
import { loadDays } from "../domain/days";
import { workoutEq, stravaForecast, thrHrPace, projectCurve, vo2Pts, effTrend, weeks, history, thrPts, LOAD_W } from "../domain/lab";

export const eqPts = computed(() => workoutEq(days.value));
export const sForecast = computed(() => (zones.value ? stravaForecast(days.value, zones.value, today.value) : null));
export const thrHr = computed(() => (zones.value ? thrHrPace(days.value, zones.value, today.value) : null));
export const thrLine = computed(() => thrPts(thresholds.value));
/** Model of the 10 km time on race day from the watch forecast now. */
export const proj = computed(() => (fc.value ? projectCurve(loadDays(days.value), today.value, fc.value.t10, LOAD_W, true) : null));
export const vo2 = computed(() => vo2Pts(days.value));
export const effT = computed(() => effTrend(aerobic.value.pts.filter(p => !p.long)));
/** Model of the easy pace at HR 145: every minute counts the same, minutes only. */
export const aerProj = computed(() => (effT.value ? projectCurve(loadDays(days.value), today.value, effT.value.at(today.value), {}, false) : null));
export const weekRows = computed(() => (zones.value ? weeks(days.value, runs.value, today.value, zones.value) : []));
export const hist = computed(() => history(runs.value, archive.value, days.value[0]?.date ?? today.value, today.value, threshold.value?.paceSec ?? 220));
