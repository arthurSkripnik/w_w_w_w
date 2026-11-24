// «Травми»: the state now, the last 30 days as one strip (worst level of the day), the areas that hurt.
import type { Widget } from "./types";
import { injNow, inj30 } from "../store/home";
import { INJ_LVL, dm, plural } from "../domain/home";

function Injuries() {
  const now = injNow.value, s = inj30.value;
  return <div class="inj-w">
    <p class="inj-now">{now.text}</p>
    <div class="inj-strip" role="img" aria-label={`Травми за 30 днів: ${s.days.filter(x => x.l).length} днів зі скаргами`}>
      {s.days.map(x => <i key={x.d} data-l={x.l} title={`${dm(x.d)}: ${INJ_LVL[x.l]}`} />)}
    </div>
    <div class="inj-x label"><span>{dm(s.from)}</span><span>сьогодні</span></div>
    {s.areas.length
      ? <ul class="inj-areas">{s.areas.map(a => <li key={a.area + a.side}><i data-l={a.level} />{a.area}, {a.side} · {a.days} {plural(a.days, "день", "дні", "днів")}</li>)}</ul>
      : <p class="label">За 30 днів без скарг</p>}
  </div>;
}
export const injuriesW: Widget = { id: "injuries", title: "Травми", span: 6, link: { label: "Детально", href: "#profile" }, C: Injuries };
