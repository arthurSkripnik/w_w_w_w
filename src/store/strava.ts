// Strava sync through the viewer's own Strava connector. Ported from v52 07-strava.js and 10a-load.js (archive).
// Plan days: the longest run of the day is the session (laps, best efforts, stream facts); other runs are extra volume.
// Archive: runs from the first COROS activity (18.12.2024) to the day before the plan, summary only.
import { signal } from "@preact/signals";
import { getMcp, STRAVA } from "../platform/claude";
import { database, plan, runs, journal, athlete, workouts } from "./data";
import { days, today } from "./derived";
import { zonesOn, type Docs } from "../domain/days";
import { buildReport, prepStream, factsOf, type Lap } from "../domain/report";
import { hrCeil } from "../domain/zones";
import { goals, thresholds } from "./data";
import { COLLECTIONS, type Run } from "../data/schema";
import { addDays } from "../domain/util";

export const ARCH_FROM = "2024-12-18";
export const STRAVA_ERR: Record<string, string> = {
  server_not_connected: "Strava не підключено. Додай конектор у claude.ai → Settings → Connectors",
  needs_reauth: "Перепідключи Strava у claude.ai → Settings → Connectors",
  approval_required: "Дозволь сторінці доступ до Strava, коли Claude запитає",
  blocked_by_policy: "Доступ до Strava заборонено налаштуваннями",
  rate_limited: "Strava просить зачекати. Спробуй через хвилину",
  server_unavailable: "Strava зараз не відповідає. Спробуй ще раз",
};
const FATAL = ["needs_reauth", "server_not_connected", "approval_required", "rate_limited", "blocked_by_policy"];

export type SyncState = { busy: boolean; text: string; ok?: boolean };
export const sync = signal<SyncState>({ busy: false, text: "" });
const say = (text: string, busy = true, ok?: boolean) => { sync.value = { busy, text, ok }; };

let mcp: any = null;
async function payload(tool: string, input: object) {
  mcp ||= await getMcp();
  if (!mcp) throw Object.assign(new Error("no mcp"), { code: "server_not_connected" });
  const r = await mcp.callTool(STRAVA, tool, input);
  return (r && r.payload) || {};
}
const isRun = (a: any) => /run/i.test(a.sport_type || "");
const parseCoros = (desc: string) => { const m = String(desc || "").match(/(\d+)\s*Training Load/i); return m ? +m[1] : undefined; };
const startHour = (iso: string) => { const hm = /T(\d\d):(\d\d)/.exec(iso || ""); return hm ? +hm[1] + +hm[2] / 60 : undefined; };
const wxFrom = (a: any) => { const w = a && a.weather; return w && typeof w.temperature === "number"
  ? { t: Math.round(w.temperature * 10) / 10, feels: w.feels_like ?? null, rh: w.humidity ?? null, wind: w.wind_speed ?? null, cond: w.condition || null } : null; };

async function listRuns(from: string, to: string) {
  const out: any[] = []; let after: string | null = null, guard = 0;
  do {
    const input: any = { range_start: from + "T00:00:00", range_end: to + "T23:59:59", first: 100, ordering: "StartDateLocalAsc" };
    if (after) input.after = after;
    const p = await payload("list_activities", input);
    (p.activities || []).filter(isRun).forEach((a: any) => out.push(a));
    after = p.has_next_page ? p.end_cursor : null;
  } while (after && ++guard < 20);
  return out;
}
const dayOf = (a: any) => String(a.start_local || "").slice(0, 10);

async function write(id: string, doc: unknown) {
  const r = COLLECTIONS.runs.safeParse(doc);
  if (!r.success) throw new Error(`runs/${id}: ${r.error.issues[0]?.message}`);
  // the store has a per-viewer call budget: back off and retry when it says so
  for (let i = 0; ; i++) {
    try { await database().doc(`runs/${id}`).set(JSON.parse(JSON.stringify(r.data))); return; }
    catch (e: any) { if (e?.code !== "resource_exhausted" || i >= 5) throw e; await new Promise(res => setTimeout(res, 2000 * 2 ** i)); }
  }
}

/** HR zones and the reference race from Strava's athlete settings. */
async function pullZones() {
  try {
    const z = await payload("get_athlete_zones", {});
    const tops = (z.heart_rate_zones || []).map((x: any) => x.max).filter((x: any) => typeof x === "number");
    const cur = athlete.value ?? {};
    if (tops.length >= 4 && JSON.stringify(tops) !== JSON.stringify(cur.hrZoneTops))
      await database().doc("athlete/me").set(JSON.parse(JSON.stringify({ ...cur, hrZoneTops: tops })));
  } catch (e: any) { if (FATAL.includes(e?.code)) throw e; }
}

/** Import one plan day. Returns true when a run was found. */
async function importDay(date: string, acts: any[]): Promise<boolean> {
  const day = days.value.find(d => d.date === date); if (!day) return false;
  if (!acts.length) {
    // today is not over: no run yet is not a missed day
    if (date !== today.value && !journal.value[date]?.skipped)
      await database().doc(`journal/${date}`).set({ ...(journal.value[date] ?? {}), date, skipped: true });
    return false;
  }
  const sorted = [...acts].sort((a, b) => (b.summary?.distance || 0) - (a.summary?.distance || 0)), a = sorted[0];
  const id = String(a.id);
  const perf = await payload("get_activity_performance", { activity_id: id });
  let stream: any = null;
  try { stream = await payload("get_activity_streams", { activity_id: id, streams: ["time", "velocity_smooth", "heart_rate", "moving", "temp"], resolution: 1000 }); }
  catch (e: any) { if (FATAL.includes(e?.code)) throw e; }
  const laps: Lap[] = (perf.laps || []).map((l: any) => [l.moving_time || l.elapsed_time || 0, l.distance || 0, l.avg_hr ? Math.round(l.avg_hr) : 0, l.avg_watts ? Math.round(l.avg_watts) : 0] as Lap).filter((l: Lap) => l[0] > 0);
  const best: Record<string, number> = {};
  (perf.best_efforts || []).forEach((b: any) => { if (b.type_value === "Fastest5k") best.k5 = b.value; if (b.type_value === "Fastest10k") best.k10 = b.value; if (b.type_value === "FastestHalfMarathon") best.k21 = b.value; });
  const s = a.summary || {}, wx = wxFrom(a);
  const run: Run = {
    stravaId: id, date: dayOf(a), startHour: startHour(a.start_local), name: a.name || "Пробіжка", km: (s.distance || 0) / 1000, movingSec: s.moving_time || 0,
    hr: perf.average_heartrate ? Math.round(perf.average_heartrate) : undefined, corosLoad: parseCoros(a.description),
    laps: laps.map(([sec, m, hr, w]) => ({ sec, m, hr: hr || null, w: w || null })), weather: wx, planDate: date, source: "plan",
    best: Object.keys(best).length ? best : undefined,
  };
  const D: Docs = { athlete: athlete.value, goals: goals.value, thresholds: thresholds.value, workouts: workouts.value, plan: plan.value, runs: runs.value, journal: journal.value };
  const Z = zonesOn(D, run.date), pts = prepStream(stream);
  if (Z && pts) {
    const rep = buildReport(day.act, day.level, { id, name: run.name, km: run.km, t: run.movingSec, hr: run.hr, coros: run.corosLoad, best, laps, temp: wx?.t ?? null, h: run.startHour }, Z, pts, undefined, hrCeil(Z));
    if (rep) run.stream = factsOf(rep) as Run["stream"];
  }
  // a run replaces whatever was reported on that day before
  for (const old of Object.values(runs.value)) if ((old.planDate ?? old.date) === date && old.stravaId !== id && !sorted.some(x => String(x.id) === old.stravaId))
    await database().doc(`runs/${old.stravaId}`).delete();
  await write(id, run);
  for (const x of sorted.slice(1)) await write(String(x.id), { stravaId: String(x.id), date: dayOf(x), km: (x.summary?.distance || 0) / 1000, movingSec: x.summary?.moving_time || 0,
    corosLoad: parseCoros(x.description), planDate: date, extra: true, source: "plan", name: x.name || undefined, startHour: startHour(x.start_local), weather: wxFrom(x) });
  if (journal.value[date]?.skipped) { const { skipped: _s, ...rest } = journal.value[date]; await database().doc(`journal/${date}`).set(rest); }
  return true;
}

/** A day is settled once it has a run, or was found empty (the last 3 days are always checked again). */
const settled = (date: string) => days.value.find(d => d.date === date)?.run != null
  || (!!journal.value[date]?.skipped && date < addDays(today.value, -3));

/** Pull every past plan day that is not settled yet (all of them with redo), plus runs on days with no session. */
export async function syncPlan(redo = false) {
  if (sync.value.busy) return;
  if (!database()) { say("Синхронізація працює лише на сторінці в claude.ai", false, false); return; }
  const t = today.value, all = days.value.filter(d => d.date <= t), todo = all.filter(d => redo || !settled(d.date));
  if (!todo.length) { say("Усі пройдені дні вже перевірено", false, true); return; }
  let added = 0, empty = 0, failed = 0, extra = 0;
  try {
    say("Читаю пробіжки зі Strava…");
    await pullZones();
    const byDay: Record<string, any[]> = {};
    (await listRuns(todo[0].date, t)).forEach(a => (byDay[dayOf(a)] ||= []).push(a));
    const planned = new Set(days.value.map(d => d.date));
    for (const [d, acts] of Object.entries(byDay)) {
      if (planned.has(d)) continue;
      for (const x of acts) { if (runs.value[String(x.id)]) continue;
        await write(String(x.id), { stravaId: String(x.id), date: d, km: (x.summary?.distance || 0) / 1000, movingSec: x.summary?.moving_time || 0,
          corosLoad: parseCoros(x.description), planDate: d, extra: true, source: "plan", name: x.name || undefined, startHour: startHour(x.start_local), weather: wxFrom(x) }); extra++; }
    }
    for (let i = 0; i < todo.length; i++) {
      say(`${redo ? "Перераховую" : "День"} ${i + 1}/${todo.length} · ${todo[i].date}…`);
      try { if (await importDay(todo[i].date, byDay[todo[i].date] || [])) added++; else empty++; }
      catch (e: any) { if (FATAL.includes(e?.code)) throw e; failed++; }
    }
    say(`${redo ? "Перераховано" : "Додано"}: ${added} · без пробіжки: ${empty}${extra ? ` · поза планом: ${extra}` : ""}${failed ? ` · помилок: ${failed}` : ""}`, false, !failed);
  } catch (e: any) {
    say(`${STRAVA_ERR[e?.code] ?? "Не вдалося отримати дані зі Strava"}${added ? ` · встиг додати ${added}` : ""}`, false, false);
  }
}

/** One day, from its card: «Підтягнути зі Strava» (also after «Фактично було» changes the type, for a fresh analysis). */
export async function pullDay(date: string) {
  if (sync.value.busy) return;
  if (!database()) { say("Strava працює лише на сторінці в claude.ai", false, false); return; }
  try {
    say("Шукаю пробіжку в Strava…");
    const found = await importDay(date, await listRuns(date, date));
    say(found ? "Пробіжку підтягнуто" : "Пробіжки за цей день у Strava немає", false, found);
  } catch (e: any) { say(STRAVA_ERR[e?.code] ?? "Не вдалося отримати дані зі Strava", false, false); }
}

/** Runs from 18.12.2024 to the day before the plan, as summary documents (no laps, no stream). */
export async function syncArchive() {
  if (sync.value.busy) return;
  const start = days.value[0]?.date;
  if (!database() || !start) { say("Архів завантажується лише на сторінці в claude.ai", false, false); return; }
  try {
    say("Читаю архів Strava…");
    const acts = (await listRuns(ARCH_FROM, addDays(start, -1))).filter(a => (a.summary?.distance || 0) > 0);
    let n = 0;
    for (const a of acts) {
      const id = String(a.id); n++;
      if (n % 20 === 0) say(`Записую архів ${n}/${acts.length}…`);
      if (runs.value[id]) continue;
      await write(id, { stravaId: id, date: dayOf(a), name: a.name || undefined, startHour: startHour(a.start_local), km: (a.summary.distance || 0) / 1000,
        movingSec: a.summary.moving_time || 0, corosLoad: parseCoros(a.description), weather: wxFrom(a), source: "archive" });
    }
    say(`Архів: ${acts.length} пробіжок з ${ARCH_FROM}`, false, true);
  } catch (e: any) { say(STRAVA_ERR[e?.code] ?? "Не вдалося отримати архів зі Strava", false, false); }
}
