// «Форма»: fatigue (7-day load against the 6-week load) in %, its zone, the last 6 weeks.
import type { Widget } from "./types";
import { Stat, Pill } from "../ui";
import { Spark } from "./Spark";
import { form } from "../store/derived";

function Form() {
  const F = form.value; if (!F?.now || !F.zone) return null;
  const past = F.days.filter(x => !x.plan).slice(-42);
  return <>
    <Stat size="m" value={`${Math.round(F.now.r)}`} unit="%" caption={<Pill tone={F.zone.lo >= 150 ? "acc" : "ink"}>{F.zone.name}</Pill>} />
    <Spark label="Форма за 6 тижнів" pts={past.map(x => ({ d: x.d, v: x.r }))} />
  </>;
}
export const formW: Widget = { id: "form", title: "Форма", span: 3, link: { label: "Графік", href: "#lab" }, C: Form };
