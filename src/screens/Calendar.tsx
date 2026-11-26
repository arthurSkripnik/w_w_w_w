// Календар: the plan by weeks (grid) or day by day (list); a day opens in a window over the plan. #calendar/<date> opens a day.
import { useEffect, useState } from "preact/hooks";
import { Segmented, Empty, Modal, Table, DateTag, type Col } from "../ui";
import { TypeTag } from "../calendar/WorkoutCard";
import { WeekLine, weekMin } from "../calendar/Week";
import { DayCard } from "../calendar/DayCard";
import { days, dayByDate, today, zones } from "../store/derived";
import { dbState } from "../store/data";
import { routeArg, go } from "../app/routes";
import { PH_NAME } from "../domain/types";
import { fmtHM } from "../domain/text";
import { DOW, dm, plural, dayState } from "../domain/home";
import { dur } from "../domain/spec";
import { fmtPace } from "../domain/util";
import { typeOf } from "../domain/types";
import type { Day } from "../domain/days";

type Mode = "grid" | "list";
const KEY = "rp2-cal";
const load = (): Mode => { try { return localStorage.getItem(KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } };

export function Calendar() {
  const [mode, setMode] = useState<Mode>(load());
  const sel = routeArg.value, t = today.value, D = days.value, by = dayByDate.value, Z = zones.value;
  useEffect(() => { try { localStorage.setItem(KEY, mode); } catch {} }, [mode]);
  useEffect(() => {   // the list starts at today
    const el = mode === "list" && document.querySelector(".cal-list tr[data-hl]");
    if (el) el.scrollIntoView({ block: "center" });
  }, [mode]);
  if (dbState.value === "loading") return <Empty>Читаю базу…</Empty>;
  if (!D.length) return <Empty>План порожній.</Empty>;

  const weeks: Record<number, Day[]> = {};
  D.forEach(d => (weeks[d.plan.week] ||= []).push(d));
  const nums = Object.keys(weeks).map(Number).sort((a, b) => a - b);
  const z1mid = Z ? (Z.z1.fast + Z.z1.slow) / 2 / 60 : null;
  const mins = weekMin;
  const maxMin = Math.max(...nums.map(n => mins(weeks[n])));
  const open = sel ? by[sel] : undefined;
  let phase = "";
  const weekHead = (n: number) => { const w = weeks[n], m = mins(w), km = z1mid ? Math.round(m / z1mid) : null;
    return <><b>Тиждень {String(n).padStart(2, "0")}</b> <span class="label">· {w.length} {plural(w.length, "тренування", "тренування", "тренувань")} · {fmtHM(m)}{km ? ` · ≈${km} км` : ""}</span></>; };
  const phaseOf = (d: Day) => PH_NAME[d.plan.phase] ?? d.plan.phase;
  const cols: Col<Day>[] = [
    { key: "d", title: "Дата", cell: d => <DateTag iso={d.date} today={d.date === t} /> },
    { key: "w", title: "Тренування", cell: d => { const st = dayState(d), name = d.workout?.name ?? typeOf(d.type).name;
      return <button type="button" class="tbl-a" data-date={d.date} aria-haspopup="dialog" aria-label={`${d.date === t ? "Сьогодні, " : ""}${dm(d.date)}: ${name}${st === "done" ? ", виконано" : st === "miss" ? ", пропущено" : ""}`}
        onClick={() => go("calendar", d.date === sel ? null : d.date, true)}>{name}{d.gym && <span class="label"> +С</span>}{d.plan.changes.length > 0 && <span class="label cal-chg"> · змінено</span>}</button>; } },
    { key: "t", title: "Тип", wide: true, cell: d => <TypeTag type={d.type} level={d.level} /> },
    { key: "v", title: "Обсяг", num: true, cell: d => { const st = dayState(d);
      return st === "done" && d.run ? `${d.run.km.toFixed(1)} км` : st === "done" ? "✓" : st === "miss" ? <span class="mute">пропуск</span>
        : d.type === "race" ? "10 км" : <span class="mute">≈{dur(d.type, Math.max(1, d.level))} хв</span>; } },
    { key: "p", title: "Темп", num: true, wide: true, cell: d => d.report?.pace ? fmtPace(d.report.pace) : "" },
    { key: "a", title: "Точність", num: true, cell: d => d.acc ? `${d.acc.score}%` : "" },
  ];
  const group = (d: Day, prev: Day | null) => prev && prev.plan.week === d.plan.week ? null
    : <>{(!prev || phaseOf(prev) !== phaseOf(d)) && <span class="cal-phase-t label">{phaseOf(d)}</span>}{weekHead(d.plan.week)}</>;

  return <>
    <section class="screen-head cal-head">
      <h1>Календар</h1>
      <Segmented label="Вигляд" value={mode} onChange={setMode} options={[{ id: "grid", title: "Сітка" }, { id: "list", title: "Список" }]} />
    </section>
    {mode === "list" ? <div class="cal cal-list">
      <Table<Day> rowKey={d => d.date} rows={D} cols={cols} group={group} hl={d => d.date === t} onRow={d => go("calendar", d.date, true)} />
    </div> : <>
    <div class="cal-dow label" aria-hidden="true"><span />{DOW.map(d => <span key={d}>{d}</span>)}</div>
    <div class="cal cal-grid">
      {nums.map(n => {
        const w = weeks[n];
        const ph = w[0].plan.phase, bar = ph !== phase ? (phase = ph, <div class="cal-phase label" key={"p" + n}>{PH_NAME[ph] ?? ph}</div>) : null;
        return [bar,
          <WeekLine key={"w" + n} n={n} w={w} by={by} today={t} sel={sel} maxMin={maxMin} easyMinPerKm={z1mid} />];
      })}
    </div></>}
    {open && <Modal wide label={`${dm(open.date)}: ${open.workout?.name ?? "день плану"}`} onClose={() => go("calendar", null, true)}
      returnTo={() => document.querySelector<HTMLElement>(`#app .cal [data-date="${open.date}"]`)}><DayCard key={open.date} day={open} /></Modal>}
  </>;
}
