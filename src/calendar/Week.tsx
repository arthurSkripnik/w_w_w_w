// A week of the plan: Monday to Sunday as day cards (S). One component for the calendar grid, the Головна week
// and the levels of База тренувань; `plan` shows every day as planned (type, minutes, level) even when it is done.
import type { Day } from "../domain/days";
import { DayCell } from "./DayCell";
import { dur } from "../domain/spec";
import { fmtHM } from "../domain/text";
import { DOW, dm } from "../domain/home";
import { addDays, mondayOf } from "../domain/util";

export const weekMin = (w: Day[]) => w.reduce((a, d) => a + (dur(d.type, Math.max(1, d.level)) ?? 0), 0);

export function Week({ mon, by, today, sel, heads, plan }: { mon: string; by: Record<string, Day>; today: string; sel?: string | null; heads?: boolean; plan?: boolean }) {
  return <>{Array.from({ length: 7 }, (_, i) => { const iso = addDays(mon, i);
    return <DayCell key={iso} day={by[iso] ?? null} iso={iso} today={today} open={iso === sel} plan={plan} head={heads ? `${DOW[i]} ${dm(iso)}` : undefined} />; })}</>;
}

/** A calendar row: the week's number, planned hours and rough km with a bar, then its seven days. */
export function WeekLine({ n, w, by, today, sel, maxMin, easyMinPerKm, plan }: { n: number; w: Day[]; by: Record<string, Day>; today: string; sel?: string | null; maxMin: number; easyMinPerKm: number | null; plan?: boolean }) {
  const m = weekMin(w), km = easyMinPerKm ? Math.round(m / easyMinPerKm) : null, mon = mondayOf(w[0].date), now = today >= mon && today <= addDays(mon, 6);
  return <div class="cal-wk" data-now={now ? "" : undefined}>
    <div class="cal-wl" aria-label={`Тиждень ${n}: заплановано ${fmtHM(m)} год${km ? `, близько ${km} км` : ""}`}>
      <b class="num">{String(n).padStart(2, "0")}</b><span class="num">{fmtHM(m)}</span>{km && <span class="num label">≈{km} км</span>}
      <i class="cal-bar" style={{ width: `${Math.round((m / maxMin) * 100)}%` }} />
    </div>
    <Week mon={mon} by={by} today={today} sel={sel} plan={plan} />
  </div>;
}
