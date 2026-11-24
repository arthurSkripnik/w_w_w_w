// «Аеробна база»: easy pace normalised to HR 145 (14-day trend) and its change over 4 weeks.
import type { Widget } from "./types";
import { Stat } from "../ui";
import { Spark } from "./Spark";
import { aerobic } from "../store/derived";
import { EASY_REF_HR } from "../domain/aerobic";
import { fmtPace, addDays } from "../domain/util";

function Aerobic() {
  const roll = aerobic.value.roll; if (roll.length < 2) return null;
  const now = roll[roll.length - 1], ago = addDays(now.d, -28), then = [...roll].reverse().find(r => r.d <= ago);
  const ch = then ? Math.round(then.v - now.v) : null;
  const cap = ch === null ? `/км при пульсі ${EASY_REF_HR}` : ch === 0 ? "За 4 тижні без змін" : `За 4 тижні ${ch > 0 ? "швидше" : "повільніше"} на ${Math.abs(ch)} с/км`;
  return <>
    <Stat size="m" value={fmtPace(now.v)} unit="/км" caption={cap} />
    <Spark label="Аеробна база, тренд" pts={roll.slice(-20).map(r => ({ d: r.d, v: r.v }))} up={false} />
  </>;
}
export const aerobicW: Widget = { id: "aerobic", title: "Аеробна база", span: 3, link: { label: "Графік", href: "#lab" }, C: Aerobic };
