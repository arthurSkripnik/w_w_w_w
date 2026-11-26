// «Форма»: fatigue (7-day load against the 6-week load) in %, on a dial with the zone edges; the zone in the middle.
import type { Widget } from "./types";
import { Dial } from "../ui";
import { form } from "../store/derived";
import { FATIGUE } from "../domain/load";

function Form() {
  const F = form.value; if (!F?.now || !F.zone) return null;
  const r = Math.round(F.now.r);
  return <div class="wg-dial">
    <Dial value={r} min={0} max={200} bands={FATIGUE.map(z => z.lo).filter(x => x > 0)} text={`${r}%`} sub={F.zone.name} size={148}
      label={`Форма ${r}%: ${F.zone.name}. Втома за 7 днів до звичного навантаження за 6 тижнів`} />
  </div>;
}
export const formW: Widget = { id: "form", title: "Форма", about: "Співвідношення втоми і фітнесу у відсотках", span: 3, link: { label: "Графік", href: "#lab/form" }, C: Form };
