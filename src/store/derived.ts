// Everything computed from the stored documents. Nothing here is written back.
import { signal, computed } from "@preact/signals";
import { athlete, goals, thresholds, workouts, plan, runs, journal } from "./data";
import { buildDays, loadDays, easyIns, thresholdOn, mainGoal, zonesOn, type Docs } from "../domain/days";
import { formSeries, fatigueZone, archiveWeeks, type ArchRun, type OffPlan } from "../domain/load";
import { easyEff, effRoll } from "../domain/aerobic";
import { isoLocal } from "../domain/util";

/** Today as YYYY-MM-DD in local time; refreshed when the page comes back into view. */
export const today = signal(isoLocal(new Date()));
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { today.value = isoLocal(new Date()); });

const docs = computed<Docs>(() => ({ athlete: athlete.value, goals: goals.value, thresholds: thresholds.value, workouts: workouts.value,
  plan: plan.value, runs: runs.value, journal: journal.value }));

export const goal = computed(() => mainGoal(goals.value));
export const threshold = computed(() => thresholdOn(thresholds.value, today.value));
export const zones = computed(() => zonesOn(docs.value, today.value));

/** Plan days with workout, run, journal, analysis and accuracy. */
export const days = computed(() => buildDays(docs.value, today.value));
export const dayByDate = computed(() => Object.fromEntries(days.value.map(d => [d.date, d])));
export const nextDay = computed(() => days.value.find(d => d.date >= today.value && !d.run) ?? null);

const planStart = computed(() => days.value[0]?.date ?? null);
/** Runs before the plan (the archive) and runs on days with no plan session. */
const otherRuns = computed(() => {
  const start = planStart.value, planned = new Set(Object.keys(plan.value)), arch: ArchRun[] = [], off: OffPlan[] = [];
  for (const r of Object.values(runs.value)) {
    const d = r.planDate ?? r.date;
    if (start && d < start) arch.push({ d: r.date, km: r.km, t: r.movingSec, coros: r.corosLoad ?? null });
    else if (!planned.has(d)) off.push({ d, t: r.movingSec, coros: r.corosLoad ?? null });
  }
  return { arch, off };
});
export const archive = computed(() => {
  const a = otherRuns.value.arch;
  if (!a.length) return null;
  const from = a.reduce((m, r) => (r.d < m ? r.d : m), a[0].d);
  return { from, weeks: archiveWeeks(a), n: a.length };
});

/** Fatigue: 7-day load against the 6-week load, in %, from the archive (when loaded) to race day. */
export const form = computed(() => {
  const S = formSeries(loadDays(days.value), today.value, archive.value ?? undefined, otherRuns.value.off);
  return S ? { ...S, zone: S.now ? fatigueZone(S.now.r) : null, endZone: fatigueZone(S.end.r) } : null;
});
/** Aerobic base: easy runs normalised to HR 145 and cool weather; the trend is the 14-day weighted mean. */
export const aerobic = computed(() => {
  const pts = easyEff(easyIns(days.value), form.value);
  return { pts, roll: effRoll(pts.filter(p => !p.long)) };
});
