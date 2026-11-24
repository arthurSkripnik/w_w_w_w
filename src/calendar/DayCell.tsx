// One calendar day: the session (type, shape, plan or fact) or a rest day. Used by the calendar and the Головна week.
import type { Day } from "../domain/days";
import { typeOf } from "../domain/types";
import { shapeOf } from "../domain/text";
import { dur } from "../domain/spec";
import { dayState, dm } from "../domain/home";
import { fmtPace } from "../domain/util";
import { go, route } from "../app/routes";

export function DayCell({ day, iso, today, open, head }: { day: Day | null; iso: string; today: string; open?: boolean; head?: string }) {
  const isToday = iso === today, past = iso < today;
  if (!day) return (
    <div class="cell" data-st="rest" data-past={past ? "" : undefined} data-today={isToday ? "" : undefined} aria-label={`${dm(iso)}: відпочинок`}>
      {head && <span class="cell-h label">{head}</span>}
      <span class="cell-n mute">{isToday ? "Відпочинок" : ""}</span>
    </div>);
  const t = typeOf(day.type), st = dayState(day), lvl = Math.max(1, day.level), mins = dur(day.type, lvl), changed = day.plan.changes.length > 0;
  const r = day.report, name = day.workout?.name ?? t.name;
  const bottom = st === "done" && day.run ? `${day.run.km.toFixed(1)} км` : st === "done" ? (day.journal?.manual?.pace ? `${day.journal.manual.pace} /км` : `RPE ${day.journal?.rpe}`)
    : st === "miss" ? "пропуск" : day.type === "race" ? "10 км" : `≈${mins} хв`;
  const label = `${dm(iso)}: ${name}${day.type === "race" ? "" : `, близько ${mins} хв`}` + (st === "done" ? ", виконано" + (r?.pace ? `, ${r.km.toFixed(1)} км, темп ${fmtPace(r.pace)}` : "") : st === "miss" ? ", пропущено" : "")
    + (day.acc ? `, точність ${day.acc.score}%` : "") + (changed ? ", змінено" : "") + (day.gym ? ", після бігу силове" : "");
  return (
    <button type="button" class="cell" data-cat={t.cat} data-st={st} data-past={past ? "" : undefined} data-today={isToday ? "" : undefined} aria-current={isToday ? "date" : undefined}
      aria-pressed={open} aria-label={(isToday ? "Сьогодні, " : "") + label} onClick={() => go("calendar", open ? null : iso, route.value === "calendar")}>
      {head && <span class="cell-h label">{head}</span>}
      <span class="cell-top"><i class="mk" data-cat={t.cat} /><span class="cell-n">{name}{changed && <sup class="chg">*</sup>}</span><span class="cell-a">{t.abbr}{changed && "*"}</span>{st === "done" && <b class="ok" aria-hidden="true">✓</b>}</span>
      <span class="shape" aria-hidden="true">{shapeOf(day.type, lvl).map(([m, k], i) => <i key={i} data-k={k} style={{ flexGrow: m }} />)}</span>
      <span class="cell-b num">{bottom}{day.acc && <b class="acc-n"> {day.acc.score}%</b>}{day.gym && <b class="gym"> +С</b>}</span>
    </button>);
}
