// «Цей тиждень»: Monday to Sunday, one simple cell a day (the calendar's own cells come in step 6).
import type { Widget } from "./types";
import { today, dayByDate } from "../store/derived";
import { runs } from "../store/data";
import { dur } from "../domain/spec";
import { mondayOf, addDays } from "../domain/util";
import { DOW, dm, dayState } from "../domain/home";

function Week() {
  const t = today.value, mon = mondayOf(t), D = dayByDate.value;
  const off = (iso: string) => Object.values(runs.value).filter(r => (r.planDate ?? r.date) === iso);
  return <ol class="wk">
    {Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(mon, i), d = D[iso], st = d ? dayState(d) : null, extra = d ? [] : off(iso);
      const km = d?.run ? d.run.km : extra.reduce((a, r) => a + r.km, 0);
      return <li key={iso} class="wk-d" data-today={iso === t ? "" : undefined} data-st={st ?? "rest"}>
        <span class="wk-h label">{DOW[i]} {dm(iso)}</span>
        <span class="wk-n">{d ? d.workout?.name ?? d.type : extra.length ? "Пробіжка поза планом" : "Відпочинок"}</span>
        <span class="wk-v num">
          {st === "done" ? (km ? `${km.toFixed(1)} км` : "виконано") : st === "miss" ? "пропуск" : d ? (d.type === "race" ? "10 км" : `≈${dur(d.type, d.level)} хв`) : km ? `${km.toFixed(1)} км` : ""}
          {d?.acc && <b class="wk-acc"> {d.acc.score}%</b>}
          {d?.gym && <b class="wk-gym"> +С</b>}
        </span>
      </li>;
    })}
  </ol>;
}
export const weekW: Widget = { id: "week", title: "Цей тиждень", span: 12, link: { label: "Календар", href: "#calendar" }, C: Week };
