// The day card (in the calendar's window): three groups in one order, «Результат» → «План» → «Дії», shaped by the
// day's phase. Ahead: the plan open, changes folded. Done: the Strava report and the record first, the plan folded,
// two columns on a wide screen. Missed: «пропущено» and the record open. Race/start: the race plan first.
import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Day } from "../domain/days";
import { Pill, Button, Segmented, StatusLine, Field, KV, Choice, Details, Hint, DateTag } from "../ui";
import { options, warnings, REPLACE_CATS, type Cat } from "../domain/replace";
import { WorkoutCard } from "./WorkoutCard";
import { JournalForm } from "./JournalForm";
import { needsJournal } from "../domain/journal";
import { Report } from "./Report";
import { groupOf } from "../domain/compare";
import { days, dayByDate, today, zones, goal, threshold } from "../store/derived";
import { plan, journal, workouts } from "../store/data";
import { athlete } from "../store/data";
import { setLevel, plannedLevel, swapDays, moveToRest, markStart, revertDay, replaceDay, setActual, setExclude, logDay, addThreshold } from "../store/actions";
import { pullDay, sync } from "../store/strava";
import { go } from "../app/routes";
import { typeOf, CAT, TYPE, RPE_TARGET } from "../domain/types";
import { gen, kpis, splits, verdict, racePlan, type Tag } from "../domain/text";
import { dur, FIXED_T, K5_TO_10K, K5_TO_THR } from "../domain/spec";
import { fmtPace, toSec, addDays, daysBetween } from "../domain/util";
import { DOW, dm, mmss, plural, dayState, dayPhase, phaseTag, type Phase } from "../domain/home";

const dow = (iso: string) => DOW[(new Date(iso + "T00:00:00").getDay() + 6) % 7];
const ADJ = [{ d: -2, name: "Легше" }, { d: 0, name: "За планом" }, { d: 2, name: "Довше" }];
const T = ({ t }: { t: Tag | null }) => (t ? <Pill tone={t.tone}>{t.tag}</Pill> : null);

function useAct() {
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null), [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); if (ok) setMsg({ text: ok }); } catch (e) { setMsg({ text: (e as Error).message, err: true }); } finally { setBusy(false); }
  };
  return { msg, busy, run };
}
const Msg = ({ m }: { m: { text: string; err?: boolean } | null }) => (m ? <StatusLine tone={m.err ? "err" : "ink"} tag={m.err ? "помилка" : "готово"}>{m.text}</StatusLine> : null);

function Level({ day }: { day: Day }) {
  const l0 = plannedLevel(day.date) ?? day.level, { msg, busy, run } = useAct();
  const opts = ADJ.map(o => ({ ...o, lv: Math.max(1, l0 + o.d) })).filter(o => o.d === 0 || o.lv !== l0);
  return <div class="dc-level">
    <div class="dc-row dc-lv"><Segmented label="Тривалість тренування" value={String(day.level)} onChange={v => !busy && run(() => setLevel(day.date, +v))}
      options={opts.map(o => ({ id: String(o.lv), title: `${o.name} · ${dur(day.type, o.lv)} хв` }))} />
    <Hint>Мало сил чи часу? «Легше» дає менше хвилин і повторів, а темп той самий. Вибір зберігається в плані.</Hint></div>
    <Msg m={msg} />
  </div>;
}

function Splits({ day }: { day: Day }) {
  const Z = zones.value!, sp = splits(day.type, Math.max(1, day.level), Z); if (!sp) return null;
  const rows: { p: number; w: boolean; from: number; to: number; t: number }[] = []; let t = 0;
  sp.forEach((x, i) => { t += x.p; const last = rows[rows.length - 1];
    if (last && !x.w && !last.w && last.p === x.p) { last.to = i + 1; last.t = t; } else rows.push({ ...x, from: i + 1, to: i + 1, t }); });
  const fast = Math.min(...sp.map(x => x.p)), slow = Math.max(...sp.map(x => x.p)), bar = (p: number) => Math.round(40 + (60 * (slow - p)) / Math.max(1, slow - fast));
  return <section class="dc-sec">
    <header class="card-head"><h4 class="card-title">Спліти по км</h4><span class="card-aside label num">≈{sp.length} км за {mmss(t)}</span>
      <Hint>{sp.some(x => x.w) ? "Прискорення рівне: кожен км трохи швидший за попередній, останній близько верху порогового темпу. " : ""}Перші км повільніші: тіло розігрівається.</Hint></header>
    <div class="tbl-wrap"><table class="tbl splits"><thead><tr><th>Км</th><th class="n">Темп /км</th><th><span class="vh">Темп на смузі</span></th><th class="n">Час</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.from} class={r.w ? "lwk" : undefined}><td class="num">{r.from === r.to ? r.from : `${r.from}–${r.to}`}</td><td class="n num"><b>{fmtPace(r.p)}</b></td><td class="sbar"><i style={{ width: `${bar(r.p)}%` }} /></td><td class="n num">{mmss(r.t)}</td></tr>)}</tbody></table></div>
  </section>;
}

function Gym({ day }: { day: Day }) {
  const g = day.gym; if (!g || g.sport !== "strength") return null;
  const len = (r: { from: string; to: string }) => daysBetween(r.from, r.to);
  const wOf = (ws?: { from: string; to: string; w: string }[]) => { const rs = (ws ?? []).filter(r => day.date >= r.from && day.date <= r.to); return rs.length ? rs.reduce((a, r) => (len(r) < len(a) ? r : a)).w : null; };
  return <section class="dc-sec">
    <header class="card-head"><h4 class="card-title">Після бігу: {g.name}</h4><span class="card-aside label">≈{g.min} хв</span></header>
    <ol class="steps">{g.exercises.map((e, i) => { const w = wOf(e.weights); return <li key={i}><span class="label num">{e.dose}{w && <><br /><b>{w}</b></>}</span><span>{e.name}{e.cue && <span class="label"> {e.cue}</span>}</span></li>; })}
      {g.rules?.length ? <li class="hint"><span class="label">Вага</span><span>{g.rules.join(" ")}</span></li> : null}
      <li class="hint"><span class="label">Порада</span><span>Одразу після бігу або через кілька годин, 5 хв розминки перед першим підходом. Не до відмови.</span></li></ol>
  </section>;
}

function RacePlan() {
  const Z = zones.value!, p = Z.race, at = (km: number) => mmss(p * km);
  return <section class="dc-sec">
    <h4 class="card-title">План гонки</h4>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Відрізок</th><th>Темп, /км</th><th>Що робити</th></tr></thead>
      <tbody>{racePlan(p).map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td class="num">{b}</td><td>{c}</td></tr>)}</tbody></table></div>
    <p class="label">Ціль {at(10)}: рівний темп {fmtPace(p)} /км. Відмітки: 1 км {at(1)}, 3 км {at(3)}, 5 км {at(5)}, 7 км {at(7)}, 10 км {at(10)}.</p>
  </section>;
}

/** Move to another day, mark a start, undo a change. Only for days still ahead, never the race. */
/** «Замінити з Бази»: the sessions of one effort group as cards, at the level closest to the planned minutes. */
function Replace({ day }: { day: Day }) {
  const info = typeOf(day.type), [cat, setCat] = useState<Cat>(info.cat === "z2" || info.cat === "z3" ? info.cat : "z1");
  const [pick, setPick] = useState<string | null>(null), { msg, busy, run } = useAct(), by = dayByDate.value, t = today.value;
  const O = options(day, cat), sel = O.find(o => o.type === pick) ?? null, W = sel ? warnings(day, sel.type, by, goal.value?.date ?? null) : [];
  return <Details summary="Замінити з Бази">
    <Hint>Рівень підібрано так, щоб час дня лишився близько {dur(day.type, Math.max(1, day.level))} хв. Після заміни його можна змінити кнопками «Легше» і «Довше». «Повернути як було» скасує заміну.</Hint>
    <Choice look="chips" label="Група зусилля" value={cat} onChange={c => { setCat(c); setPick(null); }} options={REPLACE_CATS} />
    <div class="dc-repl" role="group" aria-label="Тренування з Бази">
      {O.map(o => <WorkoutCard key={o.type} size="M" type={o.type} level={o.level} name={typeOf(o.type).name} past={day.date < t} pressed={o.type === pick}
        label={`${typeOf(o.type).name}, ${o.mins} хв${o.level ? `, рівень ${o.level}` : ""}`} onClick={() => setPick(o.type === pick ? null : o.type)}
        bottom={<>≈{o.mins} хв{o.level > 0 && <span class="lvl"> · Р{o.level}</span>}</>} />)}
    </div>
    {sel && <>
      {W.map(w => <StatusLine key={w} tone="acc" tag="увага">{w}</StatusLine>)}
      <div class="dc-row">
        <Button disabled={busy} onClick={() => run(async () => { await replaceDay(day.date, sel.type, sel.level); setPick(null); })}>Поставити «{typeOf(sel.type).name}» на {dm(day.date)}</Button>
        <a href="#library" class="btn" data-v="link">Що це за тренування</a>
      </div>
    </>}
    <Msg m={msg} />
  </Details>;
}

function PlanEdit({ day }: { day: Day }) {
  const t = today.value, race = goal.value?.date ?? "9999", by = dayByDate.value, { msg, busy, run } = useAct();
  if (day.date < t || day.type === "race") return null;
  const last = day.plan.changes[day.plan.changes.length - 1], isStart = day.type === "start", eased = last?.kind === "eased";
  const targets: { d: string; o: Day | null }[] = [];
  if (!isStart && !eased) for (let k = -7; k <= 7; k++) { if (!k) continue;
    const d = addDays(day.date, k); if (d < t || d >= race || d < days.value[0].date) continue;
    const o = by[d] ?? null; if (o && (o.type === "race" || o.type === "start" || o.plan.changes.at(-1)?.kind === "eased")) continue;
    targets.push({ d, o }); }
  const rest: string[] = []; for (let k = -7; k <= 7; k++) { const d = addDays(day.date, k); if (d >= t && d < race && !by[d]) rest.push(d); }
  const notes = day.plan.changes.map(c => c.kind === "level" ? `Обрано інший рівень: ${dur(day.type, day.level)} хв.`
    : c.kind === "swap" ? (c.from === "rest" ? `Перенесено з ${dm(c.note!.slice(-10))}.` : `Обмін з ${dm((c.note ?? "").slice(-10))}.`)
    : c.kind === "replace" ? `Замінено з Бази, було: ${(workouts.value[c.from]?.name ?? "інше тренування").toLowerCase()}.`
    : c.kind === "start" ? `Старт${c.from !== "rest" ? " замість тренування" : ""}.` : `Полегшено: ${c.note! > day.date ? "наступного дня" : "напередодні"} старт.`);
  return <Details summary={notes.length ? "Змінити план · вже змінено" : "Змінити план"} open={notes.length > 0}>
    {notes.length > 0 && <p class="label">{[...new Set(notes)].join(" ")}</p>}
    <div class="dc-row">
      {targets.length > 0 && <label class="field"><span class="label">Перенести на</span>
        <select disabled={busy} onChange={e => { const to = (e.target as HTMLSelectElement).value; if (to) run(async () => { await (by[to] ? swapDays(day.date, to) : moveToRest(day.date, to)); go("calendar", to, true); }); }}>
          <option value="">Інший день…</option>
          {targets.map(m => <option key={m.d} value={m.d}>{dow(m.d)}, {dm(m.d)} · {m.o ? `${(m.o.workout?.name ?? typeOf(m.o.type).name).toLowerCase()}, поміняються місцями` : "відпочинок"}</option>)}
        </select></label>}
      {!isStart && <label class="field"><span class="label">Старт</span>
        <select disabled={busy} onChange={e => { const d = (e.target as HTMLSelectElement).value; if (d) run(async () => { await markStart(d, t); go("calendar", d, true); }); }}>
          <option value="">Позначити старт…</option><option value={day.date}>У цей день, замість тренування</option>
          {rest.map(d => <option key={d} value={d}>{dow(d)}, {dm(d)} · день відпочинку</option>)}
        </select></label>}
      {last && <Button variant="ghost" disabled={busy} onClick={() => run(() => revertDay(day.date))}>{isStart ? "Прибрати старт" : "Повернути як було"}</Button>}
      <Hint>Перенесення міняє тренування місцями з обраним днем або ставить його на день відпочинку. Старт: день до і день після стають відновлювальними.</Hint>
    </div>
    {!isStart && !eased && <Replace day={day} />}
    <Msg m={msg} />
  </Details>;
}

/** «Фактично було»: another session type, or not counted in the form analysis. */
function Actual({ day }: { day: Day }) {
  const { msg, busy, run } = useAct(), cur = day.journal?.actualType ?? "";
  const change = (v: string) => run(async () => {
    await setActual(day.date, v || null);
    if (day.run) {   // a fresh analysis for the new type once the journal has it
      for (let i = 0; i < 30 && (journal.value[day.date]?.actualType ?? "") !== v; i++) await new Promise(r => setTimeout(r, 100));
      await pullDay(day.date);
    }
  });
  return <section class="dc-sec">
    <header class="card-head"><h4 class="card-title">Фактично було</h4>
      <Hint>«Не враховувати» для забігів не на результат, хвороби чи бігу з кимось: день зникає з графіків форми й аеробної бази.</Hint></header>
    <div class="dc-row">
      <label class="field"><span class="label">Тип</span>
        <select value={cur} disabled={busy || sync.value.busy} onChange={e => change((e.target as HTMLSelectElement).value)}>
          <option value="">За планом: {day.workout?.name ?? typeOf(day.type).name}</option>
          {Object.keys(TYPE).filter(t => t !== day.type).map(t => <option key={t} value={t}>{TYPE[t].name}</option>)}
        </select></label>
      {day.run && <label class="chk"><input type="checkbox" checked={!!day.run.exclude} disabled={busy} onChange={e => run(() => setExclude(day.run!.stravaId, (e.target as HTMLInputElement).checked))} /><span>Не враховувати в аналізі форми</span></label>}
    </div>
    <Msg m={msg} />
  </section>;
}

/** Record the fact: from Strava, or pace, HR and RPE by hand. */
function Fact({ day, open }: { day: Day; open?: boolean }) {
  const J = day.journal, s = sync.value, saved = !!(day.run || (J && !needsJournal(J)));
  const t = typeOf(day.act), Z = zones.value!, p = toSec(J?.manual?.pace), v = !day.run && p ? verdict(day.act, p, Z) : null;
  return <details class="dc-sec dc-fact" open={open ?? (!saved || needsJournal(J))}>
    <summary class="card-title">{J && !needsJournal(J) ? `${[J.feel, typeof J.rpe === "number" ? `RPE ${J.rpe}` : null, J.legs ? `ноги ${J.legs}` : null].filter(Boolean).join(" · ")} · змінити` : "Записати, як пройшло"}</summary>
    <div class="dc-row">{!day.run && <Button variant="ghost" disabled={s.busy} onClick={() => pullDay(day.date)}>Підтягнути зі Strava</Button>}{s.text && <span class="status" role="status">{s.text}</span>}
      <Hint>Ті самі питання, що в чаті з тренером: запис з чату і ручний лягають в одні поля. Запис лише порівнюється з планом і план не змінює.</Hint></div>
    {v && <p class="status">{t.workLbl ?? "Темп"}: <T t={v} /></p>}
    <JournalForm key={day.date} day={day} />
  </details>;
}

/** The 5 km test: its result gives a threshold. */
function TestResult({ day }: { day: Day }) {
  const { msg, busy, run } = useAct(), w = day.report?.work as { pace?: number } | null | undefined;
  const p = w?.pace ?? toSec(day.journal?.manual?.pace); if (!p) return null;
  const thr = Math.round(p * K5_TO_THR);
  return <div class="dc-sec">
    <p class="status num">Результат: <b>{mmss(p * 5)}</b> · 10 км ≈ <b>{mmss(p * K5_TO_10K * 10)}</b> · поріг ≈ <b>{fmtPace(thr)} /км</b></p>
    <Button disabled={busy} onClick={() => run(() => addThreshold({ date: today.value, paceSec: thr, hr: threshold.value?.hr, source: "test" }), `Поріг ${fmtPace(thr)} записано, зони перераховано`)}>Взяти поріг {fmtPace(thr)} і перерахувати план</Button>
    <Msg m={msg} />
  </div>;
}

/** A group of the day window: «Результат», «План», «Дії». */
function G({ id, title, children }: { id: string; title: string; children: ComponentChildren }) {
  return <section class="dc-group" aria-labelledby={`dc-${id}`}><h3 class="dc-gh label" id={`dc-${id}`}>{title}</h3>{children}</section>;
}

export function DayCard({ day }: { day: Day }) {
  const Z = zones.value, t = today.value, all = days.value, i = all.findIndex(d => d.date === day.date), prev = all[i - 1], next = all[i + 1];
  if (!Z) return null;
  const info = typeOf(day.type), lvl = day.type === "race" ? 0 : Math.max(1, day.level), g = gen(day.type, lvl, Z);
  const steps = [g.warmup && ["Розминка", g.warmup], [g.warmup || g.cooldown ? "Основна частина" : "Тренування", g.main], g.cooldown && ["Заминка", g.cooldown]].filter(Boolean) as [string, string][];
  const total = Math.max(...all.map(d => d.plan.week)), name = day.workout?.name ?? info.name;
  const rh = (day.run?.weather as { rh?: number | null } | null | undefined)?.rh ?? null;
  useEffect(() => {   // ← → step through the plan days, unless a field or a choice has the keys
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.closest("input, select, textarea, [contenteditable], .seg") )) return;
      const to = e.key === "ArrowLeft" ? prev : next; if (!to) return;
      e.preventDefault(); go("calendar", to.date, true);
    };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [prev?.date, next?.date]);
  const nav = (d: Day | undefined, w: string) => (d ? `${w}: ${dm(d.date)}, ${d.workout?.name ?? typeOf(d.type).name}` : `${w} тренування немає`);
  const ph = dayPhase(day, t), tag = phaseTag(day, ph), ahead = ph === "future" || ph === "today" || ph === "race";

  // three groups in one order: what happened, the plan, what can be done with the day
  const planBody = <>
    <section class="dc-sec">
      <KV size="l" items={kpis(day.type, lvl, Z, !!athlete.value?.hrZoneTops?.length).map(k => ({ k: k.lbl, v: k.val, sub: k.sub, txt: k.txt }))} />
      {!FIXED_T.includes(day.type) && day.date >= t && <Level day={day} />}
    </section>
    <section class="dc-sec">
      <h4 class="card-title">Як бігти</h4>
      <ol class="steps">
        {steps.map(([l, x], n) => <li key={l} data-main={l.startsWith("Основна") || l === "Тренування" ? "" : undefined}><span class="label">{steps.length > 1 ? `${String(n + 1).padStart(2, "0")} ` : ""}{l}</span><span>{x}</span></li>)}
        <li class="hint"><span class="label">Порада</span><span>{g.note}</span></li>
      </ol>
    </section>
    <Splits day={day} />
    <Gym day={day} />
  </>;
  const result = ph === "done" ? <>
    {day.report && (day.run?.exclude ? <p class="status">День не враховується в аналізі форми. Його хвилини й навантаження лишаються в тижневому обсязі.</p> : <Report day={day} rh={rh} />)}
    {day.type === "tt5k" && <TestResult day={day} />}
    {day.extras.length > 0 && <p class="label">Ще {day.extras.length} {plural(day.extras.length, "пробіжка", "пробіжки", "пробіжок")} цього дня: {day.extras.map(r => `${r.km.toFixed(1)} км`).join(", ")}. Вони йдуть у тижневий обсяг і навантаження.</p>}
  </> : ph === "missed" ? <>
    <StatusLine tone="err">{day.journal?.skipped ? "Strava: пробіжки за цей день немає. У моделі навантаження день рахується як відпочинок." : "Пробіжки немає ні в Strava, ні в записі. Якщо бігав, підтягни її або запиши вручну."}</StatusLine>
    <Fact key={day.date} day={day} open />
  </> : ph === "today" ? <Fact key={day.date} day={day} open={false} /> : null;
  const actions = <>
    {(ph === "done" || ph === "missed") && <Actual day={day} />}
    {ph === "done" && !day.run?.exclude && groupOf(day.act) && <p><a class="btn" data-v="ghost" href={`#compare/${day.date}`}>Порівняти з такими ж пробіжками</a></p>}
    {ahead && <PlanEdit day={day} />}
  </>;

  const resultG = result && <G id="res" title={ph === "today" ? "Сьогодні" : "Результат"}>{result}</G>;
  const planG = <G id="plan" title={ahead ? "План" : "Що було в плані"}>
    {ph === "race" && day.type === "race" && <RacePlan />}
    {ahead ? planBody : <Details summary={`${name} · ${dur(day.type, lvl)} хв`}>{planBody}</Details>}
  </G>;
  const actG = (ph === "done" || ph === "missed" || day.type !== "race") && <G id="act" title="Дії">{actions}</G>;
  const recG = <G id="rec" title="Запис дня"><Fact key={day.date} day={day} /></G>;

  return <article class="daycard" data-phase={ph} aria-label={`${dm(day.date)}: ${name}, ${tag.tag}`}>
    <header class="dc-head">
      <span class="dc-when"><DateTag size="l" iso={day.date} today={day.date === t} /><span class="label num">Тиждень {String(day.plan.week).padStart(2, "0")}/{total}</span><Pill tone={tag.tone}>{tag.tag}</Pill></span>
      <span class="dc-nav">
        <Button variant="ghost" aria-label={nav(prev, "Попереднє")} disabled={!prev} title="Попередній день (←)" onClick={() => prev && go("calendar", prev.date, true)}>←</Button>
        <Button variant="ghost" aria-label={nav(next, "Наступне")} disabled={!next} title="Наступний день (→)" onClick={() => next && go("calendar", next.date, true)}>→</Button>
        <Button variant="link" onClick={() => go("calendar", null, true)}>Закрити</Button>
      </span>
    </header>
    <WorkoutCard size="L" hLevel={2} type={day.type} level={day.level} name={name} st={dayState(day)} label={name}
      aside={<span class="dc-cat label">{CAT[info.cat]}</span>} />
    {ph === "done"
      ? <div class="dc-grid two"><div class="dc-col">{resultG}</div><div class="dc-col">{recG}{planG}{actG}</div></div>
      : <div class="dc-grid"><div class="dc-col">{resultG}{planG}{actG}</div></div>}
  </article>;
}
