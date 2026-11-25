// Календар: the plan by weeks (grid) or day by day (list); the day card opens under its week. #calendar/<date> opens a day.
import { useEffect, useState } from "preact/hooks";
import { Segmented, Empty } from "../ui";
import { DayCell } from "../calendar/DayCell";
import { WeekLine, weekMin } from "../calendar/Week";
import { DayCard } from "../calendar/DayCard";
import { days, dayByDate, today, zones } from "../store/derived";
import { dbState } from "../store/data";
import { routeArg } from "../app/routes";
import { PH_NAME } from "../domain/types";
import { fmtHM } from "../domain/text";
import { DOW, dm, plural } from "../domain/home";
import type { Day } from "../domain/days";

type Mode = "grid" | "list";
const KEY = "rp2-cal";
const load = (): Mode => { try { return localStorage.getItem(KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } };

export function Calendar() {
  const [mode, setMode] = useState<Mode>(load());
  const sel = routeArg.value, t = today.value, D = days.value, by = dayByDate.value, Z = zones.value;
  useEffect(() => { try { localStorage.setItem(KEY, mode); } catch {} }, [mode]);
  useEffect(() => {   // bring the open day (or today in the list) into view
    const el = document.querySelector(sel ? ".daycard" : mode === "list" ? ".cell[data-today]" : null as unknown as string);
    if (el) el.scrollIntoView({ block: sel ? "start" : "center", behavior: "smooth" });
  }, [sel, mode]);
  if (dbState.value === "loading") return <Empty>Читаю базу…</Empty>;
  if (!D.length) return <Empty>План порожній.</Empty>;

  const weeks: Record<number, Day[]> = {};
  D.forEach(d => (weeks[d.plan.week] ||= []).push(d));
  const nums = Object.keys(weeks).map(Number).sort((a, b) => a - b);
  const z1mid = Z ? (Z.z1.fast + Z.z1.slow) / 2 / 60 : null;
  const mins = weekMin;
  const maxMin = Math.max(...nums.map(n => mins(weeks[n])));
  const card = sel && by[sel] ? <DayCard key={sel} day={by[sel]} /> : null;
  let phase = "";

  return <>
    <section class="screen-head cal-head">
      <h1>Календар</h1>
      <Segmented label="Вигляд" value={mode} onChange={setMode} options={[{ id: "grid", title: "Сітка" }, { id: "list", title: "Список" }]} />
    </section>
    {mode === "grid" && <div class="cal-dow label" aria-hidden="true"><span />{DOW.map(d => <span key={d}>{d}</span>)}</div>}
    <div class={`cal cal-${mode}`}>
      {nums.map(n => {
        const w = weeks[n], m = mins(w), km = z1mid ? Math.round(m / z1mid) : null;
        const ph = w[0].plan.phase, bar = ph !== phase ? (phase = ph, <div class="cal-phase label" key={"p" + n}>{PH_NAME[ph] ?? ph}</div>) : null;
        const open = !!sel && w.some(d => d.date === sel);
        if (mode === "list") return [bar,
          <div class="cal-lh" key={"h" + n}><b class="num">Тиждень {String(n).padStart(2, "0")}</b><span class="label">{w.length} {plural(w.length, "тренування", "тренування", "тренувань")} · {fmtHM(m)}{km ? ` · ≈${km} км` : ""}</span></div>,
          ...w.map(d => <div class="cal-lrow" key={d.date}>
            <DayCell size="M" day={d} iso={d.date} today={t} open={d.date === sel} head={`${DOW[(new Date(d.date + "T00:00:00").getDay() + 6) % 7]} ${dm(d.date)}`} />
            {d.date === sel && card}
          </div>)];
        return [bar,
          <WeekLine key={"w" + n} n={n} w={w} by={by} today={t} sel={sel} maxMin={maxMin} easyMinPerKm={z1mid} />,
          open ? <div class="cal-card" key={"c" + n}>{card}</div> : null];
      })}
    </div>
  </>;
}
