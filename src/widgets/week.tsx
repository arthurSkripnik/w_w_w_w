// «Цей тиждень»: Monday to Sunday as the calendar's own day cells; a cell opens that day in the calendar.
import type { Widget } from "./types";
import { today, dayByDate } from "../store/derived";
import { Week as Days } from "../calendar/Week";
import { mondayOf } from "../domain/util";

function Week() {
  const t = today.value, mon = mondayOf(t), D = dayByDate.value;
  return <div class="wk">
    <Days mon={mon} by={D} today={t} heads />
  </div>;
}
export const weekW: Widget = { id: "week", title: "Цей тиждень", span: 12, link: { label: "Календар", href: "#calendar" }, C: Week };
