// «Сьогодні»: today's session or its Strava summary with accuracy, last night's sleep and the readiness advice.
import { useState } from "preact/hooks";
import type { Widget } from "./types";
import { Pill, Button, Field, StatusLine, KV } from "../ui";
import { WorkoutCard } from "../calendar/WorkoutCard";
import { today, days, zones } from "../store/derived";
import { journal } from "../store/data";
import { todayDay, ready } from "../store/home";
import { logDay } from "../store/actions";
import { dur } from "../domain/spec";
import { fmtPace } from "../domain/util";
import { mmss, dm, sleepOf } from "../domain/home";
import { blocksText, paceText } from "./session";

const accTone = (s: number) => (s >= 90 ? "ink" : s >= 50 ? "line" : "err") as "ink" | "line" | "err";

function SleepInput() {
  const t = today.value, saved = sleepOf(journal.value, t);
  const [v, setV] = useState<string | null>(null), [err, setErr] = useState<string>(), [busy, setBusy] = useState(false);
  const save = async () => {
    const h = +(v ?? "").trim().replace(",", ".");
    if (!(h >= 2 && h <= 14)) { setErr("Сон у годинах, наприклад 7.5"); return; }
    setErr(undefined); setBusy(true);
    try { await logDay(t, { sleepH: Math.round(h * 4) / 4 }); setV(null); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div class="today-sleep">
    <Field label="Сон минулої ночі, год" inputMode="decimal" placeholder="7.5" error={err}
      value={v ?? (saved != null ? String(saved) : "")} onInput={e => setV((e.target as HTMLInputElement).value)}
      onKeyDown={e => { if (e.key === "Enter") save(); }} />
    <Button variant="ghost" disabled={busy} onClick={save}>Записати</Button>
  </div>;
}

function Session() {
  const d = todayDay.value, Z = zones.value, t = today.value;
  if (!d) {
    const next = days.value.find(x => x.date > t);
    return <div class="today-s">
      <h3 class="today-name">Відпочинок</h3>
      {next && <p>Далі: {(next.workout?.name ?? next.type).toLowerCase()}, {dm(next.date)}, ≈{dur(next.type, next.level)} хв.</p>}
    </div>;
  }
  const name = d.workout?.name ?? d.type, r = d.report;
  if (d.run && r) {
    const kv: [string, string, string][] = [["Дистанція", r.km.toFixed(2), "км"], ["Час", mmss(r.t), ""], ["Темп", r.pace ? fmtPace(r.pace) : "—", "/км"], ["Пульс", r.hr ? String(r.hr) : "—", r.hr ? "уд/хв" : ""]];
    return <WorkoutCard size="L" type={d.type} level={d.level} name={name} st="done" today label={name} aside={<Pill tone="line">виконано</Pill>}>
      <KV size="m" items={kv.map(([k, v, u]) => ({ k, v, u: u || undefined }))} />
      {d.acc && <StatusLine tone={accTone(d.acc.score)} tag={`${d.acc.score}%`}>Точність: {d.acc.label.toLowerCase()}</StatusLine>}
    </WorkoutCard>;
  }
  const pace = paceText(d.workout?.zone ?? null, Z), mins = d.type === "race" ? null : dur(d.type, d.level);
  return <WorkoutCard size="L" type={d.type} level={d.level} name={name} st={d.journal?.skipped ? "miss" : "plan"} today label={name} aside={d.gym && <Pill tone="acc">+ сила</Pill>}
    bottom={<>{mins ? `≈${mins} хв` : d.type === "race" ? "10 км" : ""}{pace ? ` · ${pace}` : ""}{d.journal?.skipped ? " · пропущено" : ""}</>}>
    {d.workout && <p class="today-main">{blocksText(d.workout.blocks)}</p>}
  </WorkoutCard>;
}

function Today() {
  const r = ready.value;
  return <div class="today">
    <Session />
    <SleepInput />
    {r.h == null ? <p class="status">{r.text}</p>
      : <StatusLine tone={r.low ? "err" : "ink"} tag={r.tag}>{r.head} {r.text}</StatusLine>}
    <a class="btn" data-v="link" href={`#calendar/${todayDay.value?.date ?? days.value.find(x => x.date > today.value)?.date ?? ""}`}>{todayDay.value?.run ? "Відкрити звіт" : "Відкрити день"}</a>
  </div>;
}
export const todayW: Widget = { id: "today", title: "Сьогодні", span: 6, rows: 2, C: Today };
