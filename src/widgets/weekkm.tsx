// «Об'єм тижня»: km run this plan week against the plan, sessions done; the last 6 weeks as beads (10 km each).
import type { Widget } from "./types";
import { Stat, Beads } from "../ui";
import { week } from "../store/home";
import { weekBeads } from "../store/dots";
import { plural } from "../domain/home";

const cols6 = weekBeads(6);
function WeekKm() {
  const w = week.value; if (!w) return null;
  return <>
    <Stat size="m" value={w.km.toFixed(0)} unit={`/ ${w.planKm} км`} caption={`Тиждень ${String(w.week).padStart(2, "0")} · ${w.done} з ${w.n} ${plural(w.n, "тренування", "тренувань", "тренувань")}`} />
    <div class="wg-beads"><Beads cols={cols6.value.map(c => ({ ...c, label: c.label.slice(0, 2) }))} per={10} unit="км" label="Кілометри за 6 тижнів, кулька = 10 км" /></div>
  </>;
}
export const weekkmW: Widget = { id: "weekkm", title: "Об'єм тижня", about: "Кілометри цього тижня проти плану", span: 3, link: { label: "Графік", href: "#lab/weekkm" }, C: WeekKm };
