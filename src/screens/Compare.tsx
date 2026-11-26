// Порівняння: repeated runs of one kind. Pick a kind, then two runs (or one run against the 6-week mean of the kind):
// a verdict in words, the trend of the kind, a table of differences, both runs along the distance and rep by rep.
// #compare/<date> opens the kind of that day with the previous run of the same kind.
import { useEffect } from "preact/hooks";
import { Card, Empty, Grid, Segmented, Choice, Delta } from "../ui";
import { DayCell } from "../calendar/DayCell";
import { dayByDate, today } from "../store/derived";
import { Chart } from "../ui/Chart";
import { dbState } from "../store/data";
import { routeArg, go } from "../app/routes";
import { cmpGroups, cmpPair, cmpMode, cmpM, pickGroup, pickMode, toggleRun, openFor } from "../store/compare";
import { rows, val, fmtV, fmtDiff, delta, verdict, gapTxt, lvlTxt, steps, repsOf, trendVal, trendLabel, tempTxt, pairWhy, AVG_DAYS, type Side, type CmpRun, type Row } from "../domain/compare";
import { typeOf } from "../domain/types";
import { dm, DOW } from "../domain/home";
import { fmtPace, daysBetween } from "../domain/util";

const D = (iso: string) => new Date(iso + "T00:00:00");
const dow = (iso: string) => DOW[(D(iso).getDay() + 6) % 7];

function Dl({ a, b, r }: { a: number | null; b: number | null; r: Pick<Row, "better" | "scale" | "fmt"> }) {
  const x = delta(a, b, r);
  return <Delta d={x ? x.d : null} text={x ? fmtDiff(x.d, r.fmt) : ""} better={r.better} scale={r.scale} />;
}

function Picker() {
  const p = cmpPair.value!, G = cmpGroups.value, g = p.g, avg = cmpMode.value === "avg", by = dayByDate.value, t = today.value;
  const role = (r: CmpRun): "a" | "b" | "in" | "" => (r.d === p.B.d ? "b" : !avg && p.A?.d === r.d ? "a" : avg && p.A?.runs.includes(r) ? "in" : "");
  return <Card title="Що порівнюємо" span={4}>
    <Choice look="chips" label="Тип пробіжок" value={g.k} onChange={pickGroup} options={G.map(x => ({ id: x.k, title: x.name, count: x.runs.length }))} />
    <div class="cmp-mode"><Segmented label="З чим порівнювати" value={cmpMode.value} onChange={pickMode}
      options={[{ id: "run", title: "З пробіжкою" }, { id: "avg", title: "Із середнім за 6 тижнів" }]} /></div>
    <p class="status cmp-hint">{avg ? "Обери пробіжку: її порівняємо із середнім цього типу за 6 тижнів перед нею."
      : p.auto && p.A?.d && pairWhy(p.A.runs[0], p.B) ? `Підібрано попередню пробіжку: ${pairWhy(p.A.runs[0], p.B)}. Торкнись іншої, щоб змінити пару.`
      : "Обери дві пробіжки: новішу і ту, з якою її порівнюємо (сіра позначка)."}</p>
    <div class="cmp-rows" role="group" aria-label="Пробіжки цього типу">
      {[...g.runs].reverse().map(r => { const d = by[r.d], rl = role(r), lv = r.lvl !== null && g.k !== "easy" && g.k !== "long";
        return d && <DayCell key={r.d} size="M" day={d} iso={r.d} today={t} pick={rl || undefined} onPick={() => toggleRun(r.d)} head={`${dow(r.d)} ${dm(r.d)}`}
          facts={<>{r.km.toFixed(1)} км · {r.key.pace ? fmtPace(r.key.pace) : "—"} /км · {r.key.hr ? Math.round(r.key.hr) : "—"} уд{r.temp !== null && ` · ${tempTxt(r)}`}{lv && <span class="lvl"> · {lvlTxt(r)}</span>}{r.acc != null && <b class="acc-n"> {r.acc}%</b>}</>} />; })}
    </div>
  </Card>;
}

/** Level next to a point: «Р4» for workouts with levels, the short name for a fixed session (piramid), none for easy and long. */
const lvlMark = (k: string, r: CmpRun) => (k === "easy" || k === "long" ? undefined : r.lvl !== null ? lvlTxt(r) : typeOf(r.t).abbr);
export function Trend({ height = 220 }: { height?: number }) {
  const p = cmpPair.value; if (!p) return null;
  const { g, A, B } = p, pts = g.runs.filter(r => trendVal(g.k, r));
  if (!pts.length) return <p class="status">У цього типу ще немає темпу для графіка.</p>;
  const tip = (r: CmpRun) => `${dm(r.d)} · ${typeOf(r.t).name}${lvlMark(g.k, r) ? " " + lvlMark(g.k, r) : ""}: ${fmtPace(trendVal(g.k, r)!)} /км${r.key.hr ? `, пульс ${Math.round(r.key.hr)}` : ""}, ${r.km.toFixed(1)} км`;
  const av = A && !A.d ? val(A, r => trendVal(g.k, r)) : null;
  const lv = g.k === "easy" || g.k === "long" ? [] : pts.filter(r => r.lvl !== null), x: [Date, Date] = [D(pts[0].d), D(pts[pts.length - 1].d)];
  return <>
  <Chart label={`${trendLabel(g.k)}: ${g.name.toLowerCase()} за датами`}
    legend={[{ k: "ink", text: trendLabel(g.k) }, { k: "acc", text: `Обрана ${dm(B.d)}` }, ...(A ? [{ k: "cmp" as const, text: A.d ? `Порівнюємо з ${dm(A.d)}` : `Середнє ${AVG_DAYS / 7} тижнів` }] : [])]}
    spec={{ kind: "line", height, end: false, data: pts.map(r => ({ x: D(r.d), y: trendVal(g.k, r)!, tip: tip(r) })), y: { fmt: fmtPace, reverse: true },
      dots: pts.map(r => ({ x: D(r.d), y: trendVal(g.k, r)!, key: r.d === B.d, soft: !!A?.d && r.d === A.d, tip: tip(r), label: lvlMark(g.k, r) })),
      lines: av !== null ? [{ data: [{ x: D(A!.runs[0].d), y: av, tip: `Середнє за ${A!.runs.length} пробіжки: ${fmtPace(av)} /км` }, { x: D(B.d), y: av, tip: `Середнє ${fmtPace(av)} /км` }], dash: true, tone: "mute" as const }] : undefined, x }} />
  {lv.length > 1 && new Set(lv.map(r => r.lvl)).size > 1 && <div class="cmp-lvl">
    <span class="label">Рівень за планом</span>
    <Chart label="Рівень тренування за планом" spec={{ kind: "line", height: 110, step: true, end: false, x,
      data: lv.map(r => ({ x: D(r.d), y: r.lvl!, tip: `${dm(r.d)} · рівень ${r.lvl}${r.planN ? `, ${r.planN} повторів` : ""}` })),
      dots: lv.map(r => ({ x: D(r.d), y: r.lvl!, key: r.d === B.d, soft: !!A?.d && r.d === A.d })),
      y: { fmt: v => (Number.isInteger(v) ? `Р${v}` : ""), ticks: 3, domain: [Math.min(...lv.map(r => r.lvl!)) - 0.5, Math.max(...lv.map(r => r.lvl!)) + 0.5] } }} />
  </div>}
  </>;
}

function Verdict({ A, B }: { A: Side | null; B: CmpRun }) {
  const p = cmpPair.value!, g = p.g;
  if (!A) return <div class="cmp-sum">
    <span class="label">{g.name} · {dm(B.d)}</span>
    <h2>{cmpMode.value === "avg" ? `За 6 тижнів перед ${dm(B.d)} менше двох пробіжок цього типу.` : g.runs.length > 1 ? "Обери ще одну пробіжку, щоб порівняти." : "Поки одна пробіжка цього типу."}</h2>
  </div>;
  const v = verdict(g.k, A, B);
  return <div class="cmp-sum">
    <span class="label num">{g.name} · {dm(B.d)} проти {A.d ? `${dm(A.d)} · ${gapTxt(A.d, B.d)}` : `середнього ${A.runs.length} пробіжок за 6 тижнів`}</span>
    <h2>{v.head}</h2>
    <p>{v.text}</p>
  </div>;
}

function Diff({ A, B }: { A: Side; B: CmpRun }) {
  const g = cmpPair.value!.g;
  const R = rows(g.k).map(r => ({ r, a: val(A, r.get), b: val({ label: "", d: B.d, runs: [B] }, r.get) })).filter(x => x.a !== null || x.b !== null);
  const show = (s: Side, v: number | null, r: Row) => (v === null ? "—" : r.fmt === "temp" && s.d ? tempTxt(s.runs[0]) : fmtV(v, r.fmt));
  const Bs: Side = { label: "", d: B.d, runs: [B] }, norm = [...A.runs, B].some(r => r.tsrc === "norm");
  return <><div class="tbl-wrap"><table class="tbl cmp-t">
    <thead><tr><th scope="col"><span class="vh">Показник</span></th><th scope="col" class="n"><i class="sw a" />{A.label}</th><th scope="col" class="n"><i class="sw b" />{dm(B.d)}</th><th scope="col" class="n">Різниця</th></tr></thead>
    <tbody>{R.map(({ r, a, b }) => <tr key={r.label}><td>{r.label}</td><td class="n num">{show(A, a, r)}</td><td class="n num"><b>{show(Bs, b, r)}</b></td><td class="n num"><Dl a={a} b={b} r={r} /></td></tr>)}</tbody>
  </table></div>
  <p class="pf-note">Поправка на погоду: спека й вологість сповільнюють той самий біг; темп з поправкою показує, яким він був би при 15° і сухому повітрі.{norm && " «≈»: погоди зі Strava немає, взято середню температуру Валенсії на цю дату й годину."}</p></>;
}

function Laps({ A, B }: { A: CmpRun; B: CmpRun }) {
  const m = cmpM.value, SA = steps(A, m), SB = steps(B, m);
  if (!SA.length && !SB.length) return <Empty>Немає кіл зі Strava</Empty>;
  const f = (v: number) => (m === "pace" ? fmtPace(v) + " /км" : Math.round(v) + " уд/хв");
  const at = (S: typeof SA, km: number) => S.find(s => s.a <= km && s.b >= km);
  return <>
    <Segmented label="Що на графіку" value={m} onChange={v => (cmpM.value = v)} options={[{ id: "pace", title: "Темп" }, { id: "hr", title: "Пульс" }]} />
    <Chart label="Обидві пробіжки за дистанцією, коло за колом" legend={[{ k: "ink", text: dm(B.d) }, { k: "cmp", text: dm(A.d) }]}
      spec={{ kind: "dist", a: SA, b: SB, y: { fmt: m === "pace" ? fmtPace : v => String(Math.round(v)), reverse: m === "pace" }, height: 220,
        tip: km => { const b = at(SB, km), a = at(SA, km); return [`${km.toFixed(1)} км`, b ? `${dm(B.d)}: ${f(b.v)}` : "", a ? `${dm(A.d)}: ${f(a.v)}` : ""].filter(Boolean).join("\n"); } }} />
    <p class="pf-note">Кола коротші за 200 м не показані. Вісь X: кілометри від старту.</p>
  </>;
}

function Reps({ A, B }: { A: Side; B: CmpRun }) {
  const ra = repsOf(A), rb = repsOf({ label: "", d: B.d, runs: [B] });
  if (!ra || !rb) return null;
  const n = Math.max(ra.length, rb.length), cell = (x?: { pace: number | null; hr: number | null }) => (x?.pace ? <>{fmtPace(x.pace)}<small>{x.hr ? Math.round(x.hr) : ""}</small></> : "—");
  return <Card title="Повтор за повтором" span={12}>
    <div class="tbl-wrap"><table class="tbl cmp-t">
      <thead><tr><th scope="col">№</th><th scope="col" class="n"><i class="sw a" />{A.label}</th><th scope="col" class="n"><i class="sw b" />{dm(B.d)}</th><th scope="col" class="n">Темп</th></tr></thead>
      <tbody>{Array.from({ length: n }, (_, i) => <tr key={i}><td class="num">{i + 1}</td><td class="n num">{cell(ra[i])}</td><td class="n num"><b>{cell(rb[i])}</b></td>
        <td class="n num"><Dl a={ra[i]?.pace ?? null} b={rb[i]?.pace ?? null} r={{ better: -1, scale: 10, fmt: "pace" }} /></td></tr>)}</tbody>
    </table></div>
    <p class="pf-note">Під темпом пульс. {A.d ? "" : "Для середнього: середній темп кожного повтору за номером."}</p>
  </Card>;
}

export function Compare() {
  const arg = routeArg.value, st = dbState.value;
  useEffect(() => { if (arg && (st === "ready" || st === "stale") && openFor(arg)) go("compare", null, true); }, [arg, st, cmpGroups.value.length]);
  if (st === "loading") return <Empty>Читаю базу…</Empty>;
  if (st === "offline" || st === "error") return <Empty>База недоступна. Відкрий сторінку як артефакт у Claude.</Empty>;
  const p = cmpPair.value;
  if (!p) return <Empty>Ще немає пробіжок зі Strava. Синхронізуй план на Головній.</Empty>;
  const { A, B } = p, pair = A?.d ? p.g.runs.find(r => r.d === A.d)! : null;
  return <>
    <h1 class="hub-head">Порівняння. <i>Однотипні пробіжки поруч: чи стало легше на тому самому темпі.</i></h1>
    <Grid>
      <Picker />
      <Card span={8} title={trendLabel(p.g.k)}>
        <Verdict A={A} B={B} />
        <Trend />
        {A && <Diff A={A} B={B} />}
        {A && !A.d && <p class="pf-note">Середнє: {A.runs.map(r => dm(r.d)).join(", ")} ({daysBetween(A.runs[0].d, B.d)} днів до {dm(B.d)}).</p>}
      </Card>
      {pair && <Card title="За дистанцією" span={12}><Laps A={pair} B={B} /></Card>}
      {A && <Reps A={A} B={B} />}
    </Grid>
  </>;
}
