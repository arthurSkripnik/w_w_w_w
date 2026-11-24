// «Цей тиждень»: Monday to Sunday as the calendar's own day cells; a cell opens that day in the calendar.
import type { Widget } from "./types";
import { today, dayByDate } from "../store/derived";
import { DayCell } from "../calendar/DayCell";
import { mondayOf, addDays } from "../domain/util";
import { DOW, dm } from "../domain/home";

function Week() {
  const t = today.value, mon = mondayOf(t), D = dayByDate.value;
  return <div class="wk">
    {Array.from({ length: 7 }, (_, i) => { const iso = addDays(mon, i); return <DayCell key={iso} day={D[iso] ?? null} iso={iso} today={t} head={`${DOW[i]} ${dm(iso)}`} />; })}
  </div>;
}
export const weekW: Widget = { id: "week", title: "Цей тиждень", span: 12, link: { label: "Календар", href: "#calendar" }, C: Week };
