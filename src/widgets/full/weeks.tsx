// «Тижні: план і факт», full size of «Об'єм тижня»: planned km (outline) against every run of the week, and the table.
import { Chart } from "../../ui/Chart";
import { Table } from "../../ui";
import { weekRows } from "../../store/lab";
import { dm } from "../../domain/home";
import { fmtHM } from "../../domain/text";

const D = (iso: string) => new Date(iso + "T00:00:00");
export function WeeksFull() {
  const rows = weekRows.value; if (!rows.length) return null;
  const started = rows.filter(r => r.started), fact = started.reduce((a, r) => a + r.factKm, 0), plan = started.reduce((a, r) => a + r.pastPlanKm, 0);
  const data = [
    ...rows.map(r => ({ x: D(r.mon), y: r.planKm, plan: true, tip: `Тиждень ${String(r.n).padStart(2, "0")} з ${dm(r.mon)} · план ≈${Math.round(r.planKm)} км${r.started ? `, факт ${r.factKm.toFixed(1)} км` : ""}` })),
    ...started.map(r => ({ x: D(r.mon), y: r.factKm, tip: `Тиждень ${String(r.n).padStart(2, "0")} з ${dm(r.mon)} · факт ${r.factKm.toFixed(1)} км, ${fmtHM(r.factMin)}, ${r.runs} пробіжок · план ≈${Math.round(r.planKm)} км` })),
  ];
  return <>
    <p class="status">Факт ≈{Math.round(fact)} км з ≈{plan} км плану на сьогодні.</p>
    <Chart label="Тижневий обсяг: план і факт у кілометрах" legend={[{ k: "ink", text: "Факт зі Strava, км" }, { k: "band", text: "План, км (рамкою)" }]}
      spec={{ kind: "bars", height: 230, data, y: { fmt: v => `${Math.round(v)}` } }} />
    <Table rowKey={r => String(r.n)} rows={[...started].reverse()} cols={[
      { key: "w", title: "Тиждень", cell: r => <><b class="num">{String(r.n).padStart(2, "0")}</b>{r.now ? " зараз" : ""}</> },
      { key: "pk", title: "План, км", num: true, cell: r => `≈${r.pastPlanKm}` },
      { key: "fm", title: "Факт, год", num: true, cell: r => (r.runs ? fmtHM(r.factMin) : "—") },
      { key: "fk", title: "Факт, км", num: true, cell: r => (r.runs ? <b>{r.factKm.toFixed(1)}</b> : "—") },
      { key: "d", title: "Тренувань", num: true, cell: r => `${r.done}/${r.past}${r.miss ? ` −${r.miss}` : ""}${r.extra ? ` +${r.extra}` : ""}` },
      { key: "c", title: "COROS", num: true, wide: true, cell: r => (r.coros ? Math.round(r.coros) : "—") },
      { key: "a", title: "Точність", num: true, cell: r => (r.acc !== null ? `${r.acc} %` : "—") },
    ]} />
    <p class="pf-note">Факт: усі пробіжки тижня, зокрема другі за день і в дні відпочинку. «−N» пропущені дні плану, «+N» позапланові пробіжки. План у км: хвилини за середнім легким темпом. Точність: середня за тиждень, ключові тренування вдвічі.</p>
  </>;
}
