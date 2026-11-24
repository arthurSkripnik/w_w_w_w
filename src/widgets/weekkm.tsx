// «Тиждень NN»: km run this plan week against the plan, sessions done, the last 8 weeks.
import type { Widget } from "./types";
import { Stat } from "../ui";
import { Chart } from "../ui/Chart";
import { week } from "../store/home";
import { plural } from "../domain/home";

function WeekKm() {
  const w = week.value; if (!w) return null;
  const data = w.hist.map((v, i) => ({ x: new Date(2000, 0, 1 + i * 7), y: v }));
  return <>
    <Stat size="m" value={w.km.toFixed(0)} unit={`/ ${w.planKm} км`} caption={`Тиждень ${String(w.week).padStart(2, "0")} · ${w.done} з ${w.n} ${plural(w.n, "тренування", "тренувань", "тренувань")}`} />
    {data.length > 1 && <Chart label="Кілометри за останні 8 тижнів" spec={{ kind: "spark", data }} />}
  </>;
}
export const weekkmW: Widget = { id: "weekkm", title: "Об'єм тижня", span: 3, link: { label: "Графік", href: "#lab" }, C: WeekKm };
