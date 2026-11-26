// «Прогноз 10 км»: the 10 km time from the threshold against the goal, and its trend over threshold entries.
import type { Widget } from "./types";
import { Stat, Pill } from "../ui";
import { Spark } from "./Spark";
import { fc } from "../store/home";
import { goal } from "../store/derived";
import { mmss } from "../domain/home";

function Forecast() {
  const f = fc.value, g = goal.value; if (!f || !g) return null;
  const gap = Math.round(f.t10 - g.targetSec);
  return <>
    <Stat size="m" value={mmss(f.t10)} caption={<>Ціль {mmss(g.targetSec)} {gap > 0 ? <span>· ще {gap} с</span> : <Pill tone="acc">у формі</Pill>}</>} />
    <Spark label="Прогноз 10 км за записами порогу" pts={f.pts.map(p => ({ d: p.d, v: p.t10 }))} up={false} />
  </>;
}
export const forecastW: Widget = { id: "forecast", title: "Прогноз 10 км", about: "Час на 10 км за порогом проти цілі", span: 3, link: { label: "Графік", href: "#lab/forecast" }, C: Forecast };
