// «Відрізки VO2max»: pace and HR of the work reps of interval sessions (and fartlek, run by feel) on the «швидкий» band.
import type { Widget } from "../types";
import { Stat } from "../../ui";
import { Chart } from "../../ui/Chart";
import { Spark } from "../Spark";
import { vo2 } from "../../store/lab";
import { zones, today, days } from "../../store/derived";
import { vo2Note, BY_FEEL } from "../../domain/lab";
import { typeOf } from "../../domain/types";
import { dm } from "../../domain/home";
import { fmtPace } from "../../domain/util";

const D = (iso: string) => new Date(iso + "T00:00:00");
const nextInt = () => { const n = days.value.find(d => d.type === "shortint" && d.date > today.value); return n ? dm(n.date) : null; };

function Vo2Int() {
  const pts = vo2.value, last = [...pts].reverse().find(p => p.t === "shortint") ?? pts[pts.length - 1];
  if (!last) return null;
  return <>
    <Stat size="m" value={fmtPace(last.pace)} unit="/км" caption={`${dm(last.d)}, ${typeOf(last.t).name.toLowerCase()}${last.hr ? `, пульс ${last.hr}` : ""}`} />
    <Spark label="Темп відрізків VO2max" pts={pts.map(p => ({ d: p.d, v: p.pace }))} up={false} />
  </>;
}
function Vo2IntFull() {
  const Z = zones.value, pts = vo2.value; if (!Z) return null;
  const note = vo2Note(pts, nextInt());
  if (!pts.length) return <p class="status">{note}</p>;
  return <>
    <Chart label="Темп робочих відрізків VO2max і зона «швидкий»" legend={[{ k: "acc", text: "Інтервали" }, { k: "ink", text: "Фартлек, порожнім: за відчуттям" }, { k: "band", text: `Швидкий ${fmtPace(Z.z3.fast)}–${fmtPace(Z.z3.slow)}` }]}
      spec={{ kind: "line", height: 220, data: [], end: false, y: { fmt: fmtPace, reverse: true }, today: D(today.value),
        bands: [{ lo: Z.z3.fast, hi: Z.z3.slow, strong: true }],
        dots: pts.map(p => ({ x: D(p.d), y: p.pace, key: !BY_FEEL.includes(p.t), soft: BY_FEEL.includes(p.t), label: p.hr ? String(p.hr) : undefined,
          tip: `${dm(p.d)} · ${typeOf(p.t).name}: ${fmtPace(p.pace)} /км${p.hr ? `, пульс ${p.hr}` : ""}${p.km ? `, ${p.km.toFixed(1)} км` : ""} · ${p.pace < Z.z3.fast ? "швидше за зону" : p.pace > Z.z3.slow ? "повільніше за зону" : "у зоні"}` })) }} />
    <p class="status">{note}</p>
    <p class="pf-note">Середній темп і пульс робочих відрізків зі Strava, число над точкою: пульс. Смуга: твоя зона «швидкий».</p>
  </>;
}
export const vo2intW: Widget = { id: "vo2int", title: "Відрізки VO2max", span: 3, link: { label: "Графік", href: "#lab/vo2int" }, C: Vo2Int, Full: Vo2IntFull };
