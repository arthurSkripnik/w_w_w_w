// The day card, ported from v52 03-daycard.js: what to run and how, «Легше / Довше», splits, strength, race plan,
// plan changes, what it actually was, the fact and the Strava report beside it.
import { useState } from "preact/hooks";
import type { Day } from "../domain/days";
import { Pill, Button, Segmented, StatusLine, Field, KV, Choice, Details } from "../ui";
import { options, warnings, REPLACE_CATS, type Cat } from "../domain/replace";
import { WorkoutCard } from "./WorkoutCard";
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
import { DOW, dm, mmss, plural, dayState } from "../domain/home";

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
    <Segmented label="Тривалість тренування" value={String(day.level)} onChange={v => !busy && run(() => setLevel(day.date, +v))}
      options={opts.map(o => ({ id: String(o.lv), title: `${o.name} · ${dur(day.type, o.lv)} хв` }))} />
    <p class="label">Мало сил чи часу? «Легше» дає менше хвилин і повторів, а темп той самий. Вибір зберігається в плані.</p>
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
    <h3 class="card-title">Спліти по км</h3>
    <div class="tbl-wrap"><table class="tbl splits"><thead><tr><th>Км</th><th class="n">Темп /км</th><th /><th class="n">Час</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.from} class={r.w ? "lwk" : undefined}><td class="num">{r.from === r.to ? r.from : `${r.from}–${r.to}`}</td><td class="n num"><b>{fmtPace(r.p)}</b></td><td class="sbar"><i style={{ width: `${bar(r.p)}%` }} /></td><td class="n num">{mmss(r.t)}</td></tr>)}</tbody></table></div>
    <p class="label">≈{sp.length} км за {mmss(t)}. {sp.some(x => x.w) ? "Прискорення рівне: кожен км трохи швидший за попередній, останній близько верху порогового темпу. " : ""}Перші км повільніші: тіло розігрівається.</p>
  </section>;
}

function Gym({ day }: { day: Day }) {
  const g = day.gym; if (!g || g.sport !== "strength") return null;
  const len = (r: { from: string; to: string }) => daysBetween(r.from, r.to);
  const wOf = (ws?: { from: string; to: string; w: string }[]) => { const rs = (ws ?? []).filter(r => day.date >= r.from && day.date <= r.to); return rs.length ? rs.reduce((a, r) => (len(r) < len(a) ? r : a)).w : null; };
  return <section class="dc-sec">
    <header class="card-head"><h3 class="card-title">Після бігу: {g.name}</h3><span class="card-aside label">≈{g.min} хв</span></header>
    <ol class="steps">{g.exercises.map((e, i) => { const w = wOf(e.weights); return <li key={i}><span class="label num">{e.dose}{w && <><br /><b>{w}</b></>}</span><span>{e.name}{e.cue && <span class="label"> {e.cue}</span>}</span></li>; })}
      {g.rules?.length ? <li class="hint"><span class="label">Вага</span><span>{g.rules.join(" ")}</span></li> : null}
      <li class="hint"><span class="label">Порада</span><span>Одразу після бігу або через кілька годин, 5 хв розминки перед першим підходом. Не до відмови.</span></li></ol>
  </section>;
}

function RacePlan() {
  const Z = zones.value!, p = Z.race, at = (km: number) => mmss(p * km);
  return <section class="dc-sec">
    <h3 class="card-title">План гонки</h3>
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
    <p class="label">Рівень підібрано так, щоб час дня лишився близько {dur(day.type, Math.max(1, day.level))} хв. Після заміни його можна змінити кнопками «Легше» і «Довше». «Повернути як було» скасує заміну.</p>
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
  return <section class="dc-sec">
    <h3 class="card-title">Змінити план</h3>
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
    </div>
    {!isStart && !eased && <Replace day={day} />}
    <p class="label">Перенесення міняє тренування місцями з обраним днем або ставить його на день відпочинку. Старт: день до і день після стають відновлювальними.</p>
    <Msg m={msg} />
  </section>;
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
    <h3 class="card-title">Фактично було</h3>
    <div class="dc-row">
      <label class="field"><span class="label">Тип</span>
        <select value={cur} disabled={busy || sync.value.busy} onChange={e => change((e.target as HTMLSelectElement).value)}>
          <option value="">За планом: {day.workout?.name ?? typeOf(day.type).name}</option>
          {Object.keys(TYPE).filter(t => t !== day.type).map(t => <option key={t} value={t}>{TYPE[t].name}</option>)}
        </select></label>
      {day.run && <label class="chk"><input type="checkbox" checked={!!day.run.exclude} disabled={busy} onChange={e => run(() => setExclude(day.run!.stravaId, (e.target as HTMLInputElement).checked))} /><span>Не враховувати в аналізі форми</span></label>}
    </div>
    <p class="label">«Не враховувати» для забігів не на результат, хвороби чи бігу з кимось: день зникає з графіків форми й аеробної бази.</p>
    <Msg m={msg} />
  </section>;
}

/** Record the fact: from Strava, or pace, HR and RPE by hand. */
function Fact({ day }: { day: Day }) {
  const t = typeOf(day.act), J = day.journal, Z = zones.value!, rpe0 = RPE_TARGET[t.cat];
  const [pace, setPace] = useState(J?.manual?.pace ?? ""), [hr, setHr] = useState(J?.manual?.hr ? String(J.manual.hr) : "");
  const [rpe, setRpe] = useState<number>(typeof J?.rpe === "number" ? J.rpe : Math.round((rpe0[0] + rpe0[1]) / 2));
  const [err, setErr] = useState<string>(), { msg, busy, run } = useAct(), s = sync.value;
  const saved = !!(day.run || typeof J?.rpe === "number");
  const p = toSec(pace), v = p ? verdict(day.act, p, Z) : null;
  const save = () => {
    if (pace && !p) { setErr("Темп у форматі хв:с, наприклад 3:38"); return; }
    if (hr && !/^\d{2,3}$/.test(hr)) { setErr("Пульс числом, наприклад 172"); return; }
    setErr(undefined);
    run(() => logDay(day.date, { rpe, manual: pace || hr ? { pace: pace || undefined, hr: hr ? +hr : undefined } : undefined }), "Записано");
  };
  return <details class="dc-sec dc-fact" open={!saved}>
    <summary class="card-title">{saved ? "Факт записано · змінити" : "Записати факт"}</summary>
    <div class="dc-row"><Button variant="ghost" disabled={s.busy} onClick={() => pullDay(day.date)}>Підтягнути зі Strava</Button>{s.text && <span class="status" role="status">{s.text}</span>}</div>
    <div class="dc-row">
      {t.work && <Field label={`${t.workLbl ?? "Темп"}, хв:с /км`} inputMode="numeric" value={pace} onInput={e => setPace((e.target as HTMLInputElement).value)} />}
      <Field label="Середній пульс, уд/хв" inputMode="numeric" value={hr} onInput={e => setHr((e.target as HTMLInputElement).value)} />
    </div>
    {v && <p class="status"><T t={v} /></p>}
    <div class="dc-row dc-rpe">
      <label class="label" for={`rpe-${day.date}`}>RPE 1–10</label>
      <input type="range" id={`rpe-${day.date}`} min={1} max={10} step={1} value={rpe} onInput={e => setRpe(+(e.target as HTMLInputElement).value)} />
      <b class="num">{rpe}</b>
      <Button disabled={busy} onClick={save}>{saved ? "Оновити" : "Зберегти"}</Button>
    </div>
    {err && <StatusLine tone="err" tag="помилка">{err}</StatusLine>}
    <Msg m={msg} />
    <p class="label">RPE — твоє відчуття зусилля: 1 зовсім легко, 10 межа. Для цього тренування очікувано {rpe0[0]}–{rpe0[1]}. Запис лише порівнюється з планом і план не змінює.</p>
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

export function DayCard({ day }: { day: Day }) {
  const Z = zones.value, t = today.value, all = days.value, i = all.findIndex(d => d.date === day.date), prev = all[i - 1], next = all[i + 1];
  if (!Z) return null;
  const info = typeOf(day.type), lvl = day.type === "race" ? 0 : Math.max(1, day.level), g = gen(day.type, lvl, Z);
  const past = day.date <= t, steps = [g.warmup && ["Розминка", g.warmup], [g.warmup || g.cooldown ? "Основна частина" : "Тренування", g.main], g.cooldown && ["Заминка", g.cooldown]].filter(Boolean) as [string, string][];
  const total = Math.max(...all.map(d => d.plan.week)), name = day.workout?.name ?? info.name;
  const rh = (day.run?.weather as { rh?: number | null } | null | undefined)?.rh ?? null;
  const nav = (d: Day | undefined, w: string) => (d ? `${w}: ${dm(d.date)}, ${d.workout?.name ?? typeOf(d.type).name}` : `${w} тренування немає`);
  return <article class="daycard" aria-label={`${dm(day.date)}: ${name}`}>
    <header class="dc-head">
      <span class="label num">Тиждень {String(day.plan.week).padStart(2, "0")}/{total} · {dow(day.date)}, {dm(day.date)}</span>
      <span class="dc-nav">
        <Button variant="ghost" aria-label={nav(prev, "Попереднє")} disabled={!prev} onClick={() => prev && go("calendar", prev.date, true)}>←</Button>
        <Button variant="ghost" aria-label={nav(next, "Наступне")} disabled={!next} onClick={() => next && go("calendar", next.date, true)}>→</Button>
        <Button variant="link" onClick={() => go("calendar", null, true)}>Закрити</Button>
      </span>
    </header>
    <WorkoutCard size="L" type={day.type} level={day.level} name={name} st={dayState(day)} label={name}
      aside={<span class="dc-cat label">{CAT[info.cat]}{(day.run || typeof day.journal?.rpe === "number") && <Pill tone="line">записано</Pill>}</span>} />

    <div class={`dc-grid${day.report ? " two" : ""}`}>
      <div class="dc-col">
        <section class="dc-sec">
          <KV size="l" items={kpis(day.type, lvl, Z, !!athlete.value?.hrZoneTops?.length).map(k => ({ k: k.lbl, v: k.val, sub: k.sub, txt: k.txt }))} />
          {!FIXED_T.includes(day.type) && day.date >= t && <Level day={day} />}
        </section>
        {day.type === "tt5k" && <TestResult day={day} />}
        <section class="dc-sec">
          <h3 class="card-title">Як бігти</h3>
          <ol class="steps">
            {steps.map(([l, x], n) => <li key={l} data-main={l.startsWith("Основна") || l === "Тренування" ? "" : undefined}><span class="label">{steps.length > 1 ? `${String(n + 1).padStart(2, "0")} ` : ""}{l}</span><span>{x}</span></li>)}
            <li class="hint"><span class="label">Порада</span><span>{g.note}</span></li>
          </ol>
        </section>
        <Splits day={day} />
        <Gym day={day} />
        {day.type === "race" && <RacePlan />}
        <PlanEdit day={day} />
        {past && (day.run || day.journal) && <Actual day={day} />}
        {day.journal?.skipped && <p class="dc-sec status">Strava: пробіжки за цей день немає. У моделі навантаження день рахується як відпочинок.</p>}
        {day.extras.length > 0 && <p class="dc-sec label">Ще {day.extras.length} {plural(day.extras.length, "пробіжка", "пробіжки", "пробіжок")} цього дня: {day.extras.map(r => `${r.km.toFixed(1)} км`).join(", ")}. Вони йдуть у тижневий обсяг і навантаження.</p>}
        {past ? <Fact key={day.date} day={day} /> : <p class="dc-sec label">Записати факт можна з {dm(day.date)}.</p>}
      </div>
      {day.report && <div class="dc-col dc-rep" aria-label="Звіт зі Strava">
        {day.run?.exclude ? <p class="status">День не враховується в аналізі форми. Його хвилини й навантаження лишаються в тижневому обсязі.</p> : <Report day={day} rh={rh} />}
        {!day.run?.exclude && groupOf(day.act) && <p class="dc-sec"><a class="btn" data-v="ghost" href={`#compare/${day.date}`}>Порівняти з такими ж пробіжками</a></p>}
      </div>}
    </div>
  </article>;
}
