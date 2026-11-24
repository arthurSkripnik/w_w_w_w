// «Тренд однотипних»: the key metric of the kind chosen in Порівняння over its runs. Compact: the last run against
// the one before it; full: the trend chart with the pair or the 6-week mean marked.
import type { Widget } from "../types";
import { Stat } from "../../ui";
import { Spark } from "../Spark";
import { Trend } from "../../screens/Compare";
import { cmpPair } from "../../store/compare";
import { trendVal, trendLabel } from "../../domain/compare";
import { fmtPace } from "../../domain/util";
import { dm } from "../../domain/home";

function Compact() {
  const p = cmpPair.value; if (!p) return null;
  const { g } = p, pts = g.runs.filter(r => trendVal(g.k, r)), last = pts[pts.length - 1], prev = pts[pts.length - 2];
  if (!last) return null;
  const v = trendVal(g.k, last)!, d = prev ? Math.round(v - trendVal(g.k, prev)!) : null;
  const cap = d === null ? `${g.name}: ${trendLabel(g.k).toLowerCase()}` : d === 0 ? `${g.name}: як ${dm(prev!.d)}` : `${g.name}: на ${Math.abs(d)} с/км ${d < 0 ? "швидше" : "повільніше"}, ніж ${dm(prev!.d)}`;
  return <>
    <Stat size="m" value={fmtPace(v)} unit="/км" caption={cap} />
    <Spark label={`${g.name}, тренд`} pts={pts.slice(-12).map(r => ({ d: r.d, v: trendVal(g.k, r) }))} up={false} />
  </>;
}
function Full() {
  const p = cmpPair.value; if (!p) return <p class="status">Ще немає пробіжок зі Strava.</p>;
  return <>
    <p class="status">{p.g.name}: {trendLabel(p.g.k).toLowerCase()} за кожною пробіжкою. Тип і пару обираєш у <a href="#compare">Порівнянні</a>.</p>
    <Trend height={200} />
  </>;
}
export const cmptrendW: Widget = { id: "cmptrend", title: "Тренд однотипних", span: 3, link: { label: "Порівняти", href: "#compare" }, C: Compact, Full };
