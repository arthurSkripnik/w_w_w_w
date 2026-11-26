// «Історія з COROS»: weekly km from the first COROS run (archive) through the plan, and the races found in the archive.
import type { Widget } from "../types";
import { Stat, Table, Empty } from "../../ui";
import { Chart } from "../../ui/Chart";
import { hist } from "../../store/lab";
import { archive } from "../../store/derived";
import { plural, dm, mmss } from "../../domain/home";
import { fmtPace } from "../../domain/util";
import { fmtHM } from "../../domain/text";

const D = (iso: string) => new Date(iso + "T00:00:00");
function History() {
  const h = hist.value, a = archive.value; if (!h || !a) return null;
  return <Stat size="m" value={`${Math.round(h.km)}`} unit="км" caption={`${a.n} ${plural(a.n, "пробіжка", "пробіжки", "пробіжок")} до плану, з ${dm(a.from)}.${a.from.slice(2, 4)}`} />;
}
function HistoryFull() {
  const h = hist.value, a = archive.value;
  if (!h || !a) return <Empty>Історію ще не завантажено. Профіль → Дані → «Завантажити історію».</Empty>;
  return <>
    <p class="status">{a.n} {plural(a.n, "пробіжка", "пробіжки", "пробіжок")}, {Math.round(h.km)} км до плану.</p>
    <Chart label={`Тижневий кілометраж з ${dm(a.from)}`} legend={[{ k: "ink", text: "Км за тиждень, до плану і в плані" }]}
      spec={{ kind: "bars", height: 220, y: { fmt: v => `${Math.round(v)}` },
        data: h.rows.map(r => ({ x: D(r.m), y: r.km, tip: `Тиждень з ${dm(r.m)}.${r.m.slice(2, 4)}${r.plan ? " · план" : ""} · ${r.km.toFixed(1)} км, ${fmtHM(r.min)}, ${r.n} ${plural(r.n, "пробіжка", "пробіжки", "пробіжок")}, найдовша ${r.long.toFixed(1)} км` })) }} />
    {h.keys.length ? <Table caption="Старти в історії" rowKey={k => k.d + k.name} rows={[...h.keys].reverse()} cols={[
      { key: "d", title: "Дата", cell: k => `${dm(k.d)}.${k.d.slice(2, 4)}` },
      { key: "n", title: "Старт", cell: k => k.name },
      { key: "km", title: "Км", num: true, cell: k => k.km.toFixed(1) },
      { key: "t", title: "Час", num: true, cell: k => mmss(k.t) },
      { key: "p", title: "Темп", num: true, cell: k => fmtPace(k.t / k.km) },
      { key: "h", title: "Пульс", num: true, cell: k => k.hr ?? "—" },
      { key: "e", title: "10 км ≈", num: true, cell: k => <b>{mmss(k.t10)}</b> },
    ]} /> : <p class="status">Стартів (ціла пробіжка швидше за поріг із запасом на дистанцію) в історії не знайдено.</p>}
  </>;
}
/** «?» in the card head: where the numbers come from. */
export const HistoryHow = () => <>Зберігаються лише підсумки пробіжок від першої з COROS. Оновити історію: Профіль → Дані.</>;
export const historyW: Widget = { id: "history", title: "Історія з COROS", about: "Пороги й прогнози з годинника COROS", span: 3, link: { label: "Графік", href: "#lab/history" }, C: History, Full: HistoryFull, how: HistoryHow };
