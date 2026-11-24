// «VO2max»: Daniels VDOT from the 10 km forecast, what the goal needs, the COROS value if entered.
import type { Widget } from "./types";
import { Stat } from "../ui";
import { Spark } from "./Spark";
import { vo2 } from "../store/home";

function Vo2() {
  const v = vo2.value; if (!v) return null;
  return <>
    <Stat size="m" value={v.v.toFixed(1)} unit="мл/кг/хв" caption={`Для цілі ${v.need.toFixed(1)}${v.coros ? ` · COROS ${v.coros}` : ""}`} />
    <Spark label="VO2max за записами порогу" pts={v.pts} />
  </>;
}
export const vo2maxW: Widget = { id: "vo2max", title: "VO2max", span: 3, link: { label: "Профіль", href: "#profile/est" }, C: Vo2 };
