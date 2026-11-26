// «До старту»: the whole plan as dots, a row per week (filled = done, outline = plan, × = missed, orange = threshold
// or race, size = minutes). The current week is marked by today's ring.
import type { Widget } from "./types";
import { DotMatrix } from "../ui";
import { planDots } from "../store/dots";
import { DOW } from "../domain/home";

function Plan() {
  const P = planDots.value; if (!P) return null;
  const done = P.rows.flat().filter(d => d.state === "done").length, all = P.rows.flat().filter(d => d.state !== "rest").length;
  return <>
    <p class="status">Тиждень {P.now + 1} з {P.rows.length} · виконано {done} з {all} тренувань у плані</p>
    <div class="wg-dots"><DotMatrix rows={P.rows} heads={DOW} rowLabels={P.mons.map((_, i) => String(i + 1).padStart(2, "0"))}
      label={`План: ${P.rows.length} тижнів, точка на день; виконано ${done} з ${all}`} /></div>
  </>;
}
export const planW: Widget = { id: "plan", title: "План до старту", about: "Увесь план точками: рядок = тиждень", span: 6, link: { label: "Календар", href: "#calendar" }, C: Plan };
