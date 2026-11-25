// Профіль: the runner's own numbers. Body and sleep, what follows from them, threshold and goal, pace and HR zones,
// threshold history, injuries, and the Strava data buttons. Ported from v52 #profView (15-profile.js, 15c-injuries.js).
import { Fragment } from "preact";
import { useState, useEffect } from "preact/hooks";
import { computed } from "@preact/signals";
import { Card, Grid, Button, Field, Table, Pill, StatusLine, Empty, Details, Segmented } from "../ui";
import { athlete, goals, thresholds, runs, injuries, dbState } from "../store/data";
import { today, threshold, goal, zones, archive } from "../store/derived";
import { sleepNorm, sleep7, injNow } from "../store/home";
import { updateAthlete, setThresholdGoal, addInjury } from "../store/actions";
import { sync, syncPlan, syncArchive, ARCH_FROM } from "../store/strava";
import { routeArg } from "../app/routes";
import { ZONE_NAME, type Injury } from "../data/schema";
import { mmss, plural, dm, INJ_LVL } from "../domain/home";
import { fmtPace } from "../domain/util";
import { THR_TO_10K } from "../domain/spec";
import { hrCeil } from "../domain/zones";
import { zoneGap } from "../domain/text";
import { Board, boards } from "../widgets/Board";
/** Card numbers follow the character widgets at the top of the Profile. */
const N = (x: number) => String(x + boards.profile.value.length).padStart(2, "0");
import {
  estimates, BODY, parseBody, parseThreshold, thrHistory, hrRows, AREAS, areaName, SIDE_NAME,
  injSpan, injRows, injMax, injDays, injSpanTxt, injHeat, type BodyKey, type InjPeriod, type MapPart, type Span,
} from "../domain/profile";

const goalId = computed(() => Object.entries(goals.value).find(([, g]) => g === goal.value)?.[0] ?? null);
const injList = computed(() => Object.values(injuries.value).sort((a, b) => a.from.localeCompare(b.from)));

// ---- 01 Тіло і сон ------------------------------------------------------------
function Body() {
  const a = athlete.value ?? {}, [edit, setEdit] = useState(false), [err, setErr] = useState<Partial<Record<BodyKey, string>>>({});
  const [v, setV] = useState<Record<BodyKey, string>>({} as Record<BodyKey, string>), wk = sleep7.value;
  const open = () => { setV(Object.fromEntries(BODY.map(f => [f.k, a[f.k] != null ? String(a[f.k]) : ""])) as Record<BodyKey, string>); setErr({}); setEdit(true); };
  const save = async () => {
    const r = parseBody(v); setErr(r.err); if (!r.ok) return;
    await updateAthlete(r.out); setEdit(false);
  };
  const vals: [string, number | undefined, string][] = [["Вік", a.age, "років"], ["Зріст", a.heightCm, "см"], ["Вага", a.weightKg, "кг"], ["Сон", sleepNorm.value, "год норма"]];
  return <Card id="p-body" n={N(1)} title="Тіло і сон" aside={<Button variant="link" aria-expanded={edit} onClick={() => (edit ? setEdit(false) : open())}>{edit ? "Скасувати" : "Змінити"}</Button>}>
    <div class="pf-vals">{vals.map(([n, x, u]) => <div key={n}><span class="label">{n}</span><b class="num">{x ?? "—"}</b><span class="label">{u}</span></div>)}</div>
    {edit && <form class="pf-form" onSubmit={e => { e.preventDefault(); save(); }}>
      <div class="pf-fields">{BODY.map(f => <Field key={f.k} label={f.label} inputMode={f.mode} value={v[f.k]} error={err[f.k]}
        onInput={e => setV({ ...v, [f.k]: (e.target as HTMLInputElement).value })} />)}</div>
      <div class="btn-row"><Button type="submit">Зберегти</Button></div>
    </form>}
    <p class="status pf-line">{wk ? `Сон за 7 днів: у середньому ${wk.avg.toFixed(1)} год (${wk.n} ${plural(wk.n, "ніч", "ночі", "ночей")} записано), норма ${sleepNorm.value}.` : "Сон ще не записано."}</p>
    <p class="pf-note">Сон записується щоранку на Головній, у картці «Сьогодні». Вік, зріст і вага змінюються рідко: з них рахуються оцінки в наступній картці.</p>
  </Card>;
}

// ---- 02 Що з цього виходить ----------------------------------------------------
function Estimates() {
  const th = threshold.value, g = goal.value, Z = zones.value, a = athlete.value;
  if (!th || !g || !Z) return <Card id="p-est" n={N(2)} title="Що з цього виходить"><Empty>Потрібні поріг і ціль.</Empty></Card>;
  const rows = estimates(a, th, g, Z, runs.value);
  return <Card id="p-est" n={N(2)} title="Що з цього виходить" aside={<span class="label">Оцінки, не лабораторія</span>}>
    <Table rowKey={r => r.name} rows={rows} cols={[
      { key: "n", title: "Показник", cell: r => r.name },
      { key: "v", title: "Значення і звідки", cell: r => <div class="pf-est"><b class="num">{r.value}</b>{r.tag && <Pill tone={r.tag === "збігається" ? "ink" : "line"}>{r.tag}</Pill>}<div class="label">{r.src}</div></div> },
    ]} />
    <p class="pf-note">Пульс до 2025 року (оптичний датчик) не враховано. Якщо твій пороговий пульс нижче очікуваного, можливо, годинник його занижує: найточніше покажуть контрольні 5 км (середній пульс останніх 3 км ≈ поріг).
      {a?.weightKg ? "" : " Впиши вагу, щоб побачити VO2max у літрах і витрату енергії."}{a?.age ? "" : " Впиши вік для оцінки максимального пульсу."}</p>
  </Card>;
}

// ---- 03 Поріг і ціль ------------------------------------------------------------
function ThresholdGoal() {
  const th = threshold.value, g = goal.value, Z = zones.value, [edit, setEdit] = useState(false), [ok, setOk] = useState("");
  const [v, setV] = useState({ pace: "", hr: "", goal: "" }), [err, setErr] = useState<Record<string, string>>({});
  if (!th || !g) return <Card id="p-thr" n={N(3)} title="Поріг і ціль"><Empty>У базі немає порогу або цілі.</Empty></Card>;
  const goal10 = (g.targetSec / g.km) * 10, need = g.targetSec / g.km / THR_TO_10K;
  const open = () => { setV({ pace: fmtPace(th.paceSec), hr: String(th.hr ?? Z?.thrHR ?? ""), goal: mmss(g.targetSec) }); setErr({}); setOk(""); setEdit(true); };
  const apply = async () => {
    const r = parseThreshold(v.pace, v.hr, v.goal, g.km); setErr(r.err); if (!r.ok) return;
    await setThresholdGoal(today.value, r.paceSec, r.hr, goalId.value, r.targetSec);
    setEdit(false); setOk(`Зони й тренування з ${dm(today.value)} рахуються від порогу ${fmtPace(r.paceSec)}. Минулі дні лишаються з попереднім.`);
  };
  return <Card id="p-thr" n={N(3)} title="Поріг і ціль" aside={<Button variant="link" aria-expanded={edit} onClick={() => (edit ? setEdit(false) : open())}>{edit ? "Скасувати" : "Змінити"}</Button>}>
    <div class="pf-vals">
      <div><span class="label">Поріг</span><b class="num">{fmtPace(th.paceSec)}</b><span class="label">/км</span></div>
      <div><span class="label">Пульс порогу</span><b class="num">{th.hr ?? Z?.thrHR ?? "—"}</b><span class="label">уд/хв</span></div>
      <div><span class="label">Ціль</span><b class="num">{mmss(g.targetSec)}</b><span class="label">{g.km} км</span></div>
    </div>
    {edit && <form class="pf-form" onSubmit={e => { e.preventDefault(); apply(); }}>
      <div class="pf-fields">
        <Field label="Поріг, хв:сек /км" inputMode="numeric" value={v.pace} error={err.pace} onInput={e => setV({ ...v, pace: (e.target as HTMLInputElement).value })} />
        <Field label="Пульс порогу, уд/хв" inputMode="numeric" value={v.hr} error={err.hr} onInput={e => setV({ ...v, hr: (e.target as HTMLInputElement).value })} />
        <Field label={`Ціль на ${g.km} км, хв:сек`} inputMode="numeric" value={v.goal} error={err.goal} onInput={e => setV({ ...v, goal: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="btn-row"><Button type="submit">Перерахувати план</Button></div>
    </form>}
    {ok && <StatusLine tag="ok">{ok}</StatusLine>}
    <p class="status pf-line">Для {mmss(goal10)} на 10 км потрібен поріг {fmtPace(need)} /км. Зараз {fmtPace(th.paceSec)}, записано {dm(th.date)}.</p>
    <p class="pf-note">Поріг з годинника рухає весь план: з нього будуються зони, темпи тренувань і прогноз (10 км ≈ поріг × 0,97). Новий поріг додається в історію і діє з дня запису.</p>
  </Card>;
}

// ---- 04 Зони темпу, 05 Пульсові зони ----------------------------------------------
const ZONE_USE: [("rec" | "z1" | "z2" | "z3"), string][] = [
  ["rec", "Після важкого дня, повільніше за легкий"], ["z1", "Розмовний темп, основа плану"],
  ["z2", "Довгі відрізки й швидкий фініш, ≈ годину на межі"], ["z3", "Короткі інтервали, темп 10 км і швидше"],
];
function PaceZones() {
  const Z = zones.value; if (!Z) return <Card id="p-zones" n={N(4)} title="Зони темпу" span={6}><Empty>Немає порогу.</Empty></Card>;
  const gap = zoneGap(Z);
  const rows = [
    ...ZONE_USE.map(([k, use]) => ({ k, name: ZONE_NAME[k], use, v: `${fmtPace(Z[k].fast)}–${fmtPace(Z[k].slow)}` })),
    ...(gap ? [{ k: "gap", name: "марафонський", use: "Між легким і пороговим (Aerobic Power у COROS)", v: `${fmtPace(gap.fast)}–${fmtPace(gap.slow)}` }] : []),
    { k: "race", name: ZONE_NAME.race, use: "Темп цілі", v: fmtPace(Z.race) },
  ];
  return <Card id="p-zones" n={N(4)} title="Зони темпу" span={6} aside={<span class="label">Від порогу {fmtPace(Z.thrPace)}</span>}>
    <Table rowKey={r => r.k} rows={rows} cols={[
      { key: "n", title: "Зона", cell: r => <b>{r.name}</b> },
      { key: "u", title: "Для чого", cell: r => r.use },
      { key: "v", title: "/км", num: true, cell: r => r.v },
    ]} />
    <p class="pf-note">Межі рахуються від порогу (співвідношення COROS). Ручні зони з першої версії не перенесено.</p>
  </Card>;
}
function HrZones() {
  const Z = zones.value; if (!Z) return <Card id="p-hr" n={N(5)} title="Пульсові зони" span={6}><Empty>Немає порогу.</Empty></Card>;
  const src = Z.hrTops && Z.hrTops.length >= 4 ? "Зі Strava" : `Від пульсу порогу ${Z.thrHR}`;
  return <Card id="p-hr" n={N(5)} title="Пульсові зони" span={6} aside={<span class="label">{src}</span>}>
    <Table rowKey={r => r.z} rows={hrRows(Z)} cols={[
      { key: "z", title: "Зона", cell: r => <b>{r.z}</b> },
      { key: "u", title: "Для чого", cell: r => r.use },
      { key: "r", title: "уд/хв", num: true, cell: r => r.range },
    ]} />
    <p class="pf-note">Стеля легкого дня {hrCeil(Z)} уд/хв: верх Z2.</p>
  </Card>;
}

// ---- 06 Історія порогу -------------------------------------------------------------
function ThrHistory() {
  const rows = thrHistory(thresholds.value), SRC = { coros: "COROS", test: "тест", manual: "вручну" } as const;
  return <Card id="p-hist" n={N(6)} title="Історія порогу" aside={<span class="label">{rows.length} {plural(rows.length, "запис", "записи", "записів")}</span>}>
    <Table rowKey={r => r.date} rows={rows} cols={[
      { key: "d", title: "Дата", cell: r => `${dm(r.date)}.${r.date.slice(0, 4)}` },
      { key: "p", title: "Поріг, /км", num: true, cell: r => <b>{fmtPace(r.paceSec)}</b> },
      { key: "c", title: "Зміна", num: true, cell: r => (r.delta === null ? "—" : r.delta === 0 ? "0 с" : `${r.delta < 0 ? "−" : "+"}${Math.abs(r.delta)} с`) },
      { key: "h", title: "Пульс", num: true, cell: r => r.hr ?? "—" },
      { key: "t", title: "Прогноз 10 км", num: true, cell: r => mmss(r.t10) },
      { key: "s", title: "Звідки", cell: r => SRC[r.source] },
    ]} />
  </Card>;
}

// ---- 07 Травми --------------------------------------------------------------------
interface Tip { title: string; sub: string; rows: Injury[] }
const PERIOD_KEY = "rp2-inj";
const readP = (): InjPeriod => { try { return localStorage.getItem(PERIOD_KEY) === "30" ? "30" : "all"; } catch { return "all"; } };

// [map part or null (outline only), view, y, height, kind]: front shows the person's right on the viewer's left
const PARTS: [MapPart | null, "F" | "B", number, number, "mid" | "leg" | "foot" | "heel"][] = [
  [null, "F", 42, 82, "mid"], ["hip", "F", 124, 24, "leg"], ["quad", "F", 150, 70, "leg"], ["knee", "F", 222, 18, "leg"], ["shin", "F", 242, 50, "leg"], ["ankle", "F", 294, 12, "leg"], ["foot", "F", 308, 14, "foot"],
  [null, "B", 42, 48, "mid"], ["back", "B", 92, 30, "mid"], ["glute", "B", 124, 24, "leg"], ["ham", "B", 150, 70, "leg"], [null, "B", 222, 18, "leg"], ["calf", "B", 242, 50, "leg"], ["ankle", "B", 294, 12, "leg"], ["foot", "B", 308, 14, "heel"],
];
function BodyMap({ I, span, onTip }: { I: Injury[]; span: Span; onTip: (t: Tip | null) => void }) {
  const W = 300, H = 362, g: preact.JSX.Element[] = [];
  ([["F", 75, "спереду"], ["B", 225, "ззаду"]] as const).forEach(([view, cx, cap]) => {
    g.push(<circle key={view + "h"} cx={cx} cy={22} r={15} class="bm-n" />);
    [-1, 1].forEach(k => g.push(<rect key={view + "a" + k} x={cx + k * 36 - 6} y={46} width={12} height={80} rx={6} class="bm-n" />));
    g.push(<text key={view + "c"} x={cx} y={H - 2} text-anchor="middle" class="bm-ax">{cap}</text>);
    PARTS.filter(p => p[1] === view).forEach(([part, , y, h, kind], pi) => {
      const sides: (Injury["side"] | null)[] = kind === "mid" ? [null] : ["П", "Л"];
      sides.forEach(s => {
        const lx = s ? cx + (s === "П" ? -1 : 1) * (view === "F" ? 14 : -14) : cx;
        const shape = (cls: string, l?: number) => {
          const [x, w, rx] = kind === "mid" ? [cx - 28, 56, 10] : kind === "foot" ? [lx - 14, 28, 7] : kind === "heel" ? [lx - 12, 24, 7] : [lx - 12, 24, h > 40 ? 10 : 6];
          return <rect x={x} y={y} width={w} height={h} rx={rx} class={cls} data-l={l} />;
        };
        const key = `${view}${pi}${s ?? ""}`;
        if (!part) { g.push(<g key={key}>{shape("bm-n")}</g>); return; }
        const rows = injRows(I, span.from, span.to, part, s ?? undefined), l = injMax(rows), n = injDays(rows, span.from, span.to);
        const name = AREAS.find(a => a.map === part)!.name + (s ? ", " + SIDE_NAME[s] : "");
        const tip = { title: name, sub: rows.length ? `${n} ${plural(n, "день", "дні", "днів")}, найсильніше: ${INJ_LVL[l]}` : "За період", rows };
        g.push(<g key={key} class="bm-hit" tabIndex={0} role="img" aria-label={`${name}: ${INJ_LVL[l]}`}
          onPointerEnter={() => onTip(tip)} onFocus={() => onTip(tip)} onClick={() => onTip(tip)}>{shape("bm-z", l)}</g>);
      });
    });
  });
  [[61, "П"], [89, "Л"], [211, "Л"], [239, "П"]].forEach(([x, t]) => g.push(<text key={"s" + x} x={x} y={340} text-anchor="middle" class="bm-ax">{t}</text>));
  return <svg viewBox={`0 0 ${W} ${H}`} class="bm" role="group" aria-label="Карта тіла">{g}</svg>;
}
const MON = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
function Heat({ I, span, onTip }: { I: Injury[]; span: Span; onTip: (t: Tip | null) => void }) {
  const { cols, rows } = injHeat(I, span);
  if (!rows.length) return <Empty>Записів немає.</Empty>;
  let last = "";
  const head = cols.map((d, j) => {
    const end = d.slice(5, 7) === last ? "" : d;
    if (span.step === 1) return j % 7 === 0 ? dm(d) : "";
    const m = d.slice(5, 7); last = m; return end ? MON[+m - 1] : "";
  });
  return <div class="hm" style={{ gridTemplateColumns: `minmax(110px, auto) repeat(${cols.length}, minmax(5px, 1fr))` }}>
    <span />{head.map((h, j) => <span key={j} class="hm-x">{h}</span>)}
    {rows.map(r => <Fragment key={r.key}>
      <span class="hm-y">{r.name} <i>{r.side === "обидві" ? "обидві" : r.side}</i></span>
      {r.cells.map(c => {
        const tip = { title: `${r.name}, ${SIDE_NAME[r.side]}`, sub: span.step === 1 ? dm(c.d) : `Тиждень ${dm(c.d)}–${dm(c.end)}`, rows: c.rows };
        return <span key={r.key + c.d} class="hm-c" data-l={c.l} tabIndex={0} aria-label={`${r.name} ${dm(c.d)}: ${INJ_LVL[c.l]}`}
          onPointerEnter={() => onTip(tip)} onFocus={() => onTip(tip)} onClick={() => onTip(tip)} />;
      })}
    </Fragment>)}
  </div>;
}
function AddInjury({ onDone }: { onDone: () => void }) {
  const t = today.value, [v, setV] = useState({ from: t, to: t, area: AREAS[0].k as string, side: "П" as Injury["side"], level: "1", note: "" }), [err, setErr] = useState("");
  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.from) || !/^\d{4}-\d{2}-\d{2}$/.test(v.to) || v.to < v.from) { setErr("Дати: з … по …, кінець не раніше початку"); return; }
    if (!v.note.trim()) { setErr("Опиши коротко, що було"); return; }
    await addInjury({ from: v.from, to: v.to, area: v.area, side: v.side, level: +v.level as 1 | 2 | 3, note: v.note.trim() });
    onDone();
  };
  const set = (k: string) => (e: Event) => setV({ ...v, [k]: (e.target as HTMLInputElement).value });
  return <form class="pf-form" onSubmit={e => { e.preventDefault(); save(); }}>
    <div class="pf-fields">
      <Field label="З" type="date" value={v.from} onInput={set("from")} />
      <Field label="По" type="date" value={v.to} onInput={set("to")} />
      <label class="field"><span class="label">Зона</span><select value={v.area} onChange={set("area")}>{AREAS.map(a => <option key={a.k} value={a.k}>{a.name}</option>)}</select></label>
      <label class="field"><span class="label">Сторона</span><select value={v.side} onChange={set("side")}><option value="П">права</option><option value="Л">ліва</option><option value="обидві">обидві</option></select></label>
      <label class="field"><span class="label">Сила</span><select value={v.level} onChange={set("level")}>{[1, 2, 3].map(l => <option key={l} value={l}>{l} {INJ_LVL[l]}</option>)}</select></label>
    </div>
    <label class="field"><span class="label">Що було</span><textarea rows={2} value={v.note} onInput={set("note")} /></label>
    {err && <p class="field-h err">{err}</p>}
    <div class="btn-row"><Button type="submit">Додати запис</Button></div>
  </form>;
}
function Injuries() {
  const I = injList.value, [p, setP] = useState<InjPeriod>(readP), [tip, setTip] = useState<Tip | null>(null), [add, setAdd] = useState(false);
  const span = injSpan(I, today.value, p), now = injNow.value;
  const choose = (x: InjPeriod) => { setP(x); setTip(null); try { localStorage.setItem(PERIOD_KEY, x); } catch { /* private mode */ } };
  return <Card id="p-inj" n={N(7)} title="Травми" aside={<Segmented label="Період" value={p} onChange={choose} options={[{ id: "30", title: "30 днів" }, { id: "all", title: "Усе" }]} />}>
    <StatusLine tone={now.now ? "acc" : "line"} tag={now.now ? INJ_LVL[now.level] : "зараз без скарг"}>{now.text}</StatusLine>
    <div class="inj-cols">
      <BodyMap I={I} span={span} onTip={setTip} />
      <div class="inj-right">
        <Heat I={I} span={span} onTip={setTip} />
        <div class="inj-leg">{[1, 2, 3].map(l => <span key={l}><i data-l={l} />{l} {INJ_LVL[l]}</span>)}</div>
        <div class="inj-tip" aria-live="polite">
          {tip ? <>
            <b>{tip.title}</b> <span class="label">{tip.sub}</span>
            {tip.rows.length ? tip.rows.map((r, i) => <p key={i}>{injSpanTxt(r)}, {INJ_LVL[r.level]}: {r.note.split(/\.\s/)[0]}</p>) : <p class="label">Без записів</p>}
          </> : <p class="label">Наведи або натисни на зону чи клітинку, щоб побачити записи.</p>}
        </div>
      </div>
    </div>
    <Details summary={`Усі записи (${I.length})`}>
      <Table rowKey={r => r.from + r.area + r.side} rows={[...I].reverse()} cols={[
        { key: "d", title: "Дати", cell: r => `${injSpanTxt(r)}.${r.to.slice(0, 4)}` },
        { key: "a", title: "Зона", cell: r => `${areaName(r.area)}, ${SIDE_NAME[r.side]}` },
        { key: "l", title: "Сила", cell: r => <><b>{r.level}</b> {INJ_LVL[r.level]}</> },
        { key: "n", title: "Що було", cell: r => r.note },
      ]} />
    </Details>
    <div class="btn-row pf-add">
      <Button variant="ghost" aria-expanded={add} onClick={() => setAdd(!add)}>{add ? "Скасувати" : "Додати запис"}</Button>
    </div>
    {add && <AddInjury onDone={() => setAdd(false)} />}
    <p class="pf-note">Колір: найсильніший біль за період у цій зоні. Записи веде тренер у журналі травм, коли ти пишеш про біль; тут можна додати запис і самому.</p>
  </Card>;
}

// ---- 08 Дані --------------------------------------------------------------------
function Data() {
  const s = sync.value, arch = archive.value;
  return <Card id="p-data" n={N(8)} title="Дані">
    {s.text && <StatusLine tone={s.ok === false ? "err" : "line"} tag={s.busy ? "працює" : s.ok === false ? "помилка" : "ok"}>{s.text}</StatusLine>}
    <div class="pf-data">
      <div>
        <Button variant="ghost" disabled={s.busy} onClick={() => syncPlan(true)}>Перерахувати звіти</Button>
        <p class="pf-note">Заново завантажує зі Strava всі пройдені дні й розбирає їх поточним алгоритмом. Тип дня, «не враховувати» і ручні правки зберігаються.</p>
      </div>
      <div>
        <Button variant="ghost" disabled={s.busy} onClick={() => syncArchive()}>{arch ? "Оновити історію" : "Завантажити історію"}</Button>
        <p class="pf-note">Пробіжки зі Strava від першої з COROS ({dm(ARCH_FROM)}.{ARCH_FROM.slice(0, 4)}) до початку плану, лише підсумки. Вони дають «Формі» звичне навантаження.
          {arch ? ` Зараз у базі ${arch.n} ${plural(arch.n, "пробіжка", "пробіжки", "пробіжок")} з ${dm(arch.from)}.${arch.from.slice(0, 4)}.` : " Ще не завантажено."}</p>
      </div>
    </div>
  </Card>;
}

const SECTIONS: Record<string, string> = { body: "p-body", est: "p-est", threshold: "p-thr", zones: "p-zones", hr: "p-hr", history: "p-hist", injuries: "p-inj", data: "p-data" };

export function Profile() {
  const arg = routeArg.value;
  useEffect(() => { const id = arg && SECTIONS[arg]; if (id) document.getElementById(id)?.scrollIntoView({ block: "start" }); }, [arg, dbState.value]);
  if (dbState.value === "loading") return <Empty>Читаю базу…</Empty>;
  if (dbState.value === "offline" || dbState.value === "error") return <Empty>База недоступна. Відкрий сторінку як артефакт у Claude.</Empty>;
  return <>
    <h1 class="pf-head">Профіль</h1>
    <Board b="profile" />
    <Grid>
      <Body /><Estimates /><ThresholdGoal /><PaceZones /><HrZones /><ThrHistory /><Injuries /><Data />
    </Grid>
  </>;
}
