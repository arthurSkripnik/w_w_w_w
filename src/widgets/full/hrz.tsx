// «Час у пульсових зонах»: minutes per plan week in Z1–Z5 from each run's HR stream; the share of easy work.
import type { Widget } from "../types";
import { Stat } from "../../ui";
import { weekRows } from "../../store/lab";
import { zones } from "../../store/derived";
import { hrBounds } from "../../domain/lab";
import { fmtHM } from "../../domain/text";

const easyPct = (z: number[]) => { const t = z.reduce((a, b) => a + b, 0); return t ? Math.round(((z[0] + z[1]) / t) * 100) : null; };
function Hrz() {
  const w = [...weekRows.value].reverse().find(r => r.started && r.hrz); if (!w?.hrz) return null;
  return <Stat size="m" value={`${easyPct(w.hrz)}`} unit="%" caption={`Z1–Z2 за тиждень ${String(w.n).padStart(2, "0")}, ${fmtHM(w.hrz.reduce((a, b) => a + b, 0) / 60)} з пульсом`} />;
}
function HrzFull() {
  const Z = zones.value; if (!Z) return null;
  const b = hrBounds(Z), rows = weekRows.value.filter(r => r.started).reverse();
  return <>
    <div class="hz-leg">{b.map((x, i) => <span key={i}><i data-z={i + 1} />Z{i + 1} {x}</span>)}</div>
    <div class="tbl-wrap"><table class="tbl hz-t">
      <thead><tr><th scope="col">Тиждень</th><th scope="col">Розподіл</th><th class="n" scope="col">Хвилини</th><th class="n" scope="col">Z1–Z2</th></tr></thead>
      <tbody>{rows.map(r => { const t = r.hrz ? r.hrz.reduce((a, v) => a + v, 0) : 0;
        return <tr key={r.n}><td><b class="num">{String(r.n).padStart(2, "0")}</b>{r.now ? " зараз" : ""}</td>
          {t ? <><td><div class="hz-bar" role="img" aria-label={r.hrz!.map((v, i) => `Z${i + 1} ${Math.round(v / 60)} хв`).join(", ")}>
              {r.hrz!.map((v, i) => (v ? <i key={i} data-z={i + 1} style={{ width: `${((v / t) * 100).toFixed(1)}%` }} title={`Z${i + 1} ${b[i]}: ${Math.round(v / 60)} хв`} /> : null))}</div></td>
            <td class="n num">{Math.round(t / 60)}</td><td class="n num">{easyPct(r.hrz!)} %</td></>
            : <td colSpan={3} class="label">Немає даних пульсу: «Перерахувати звіти» в Профілі</td>}</tr>; })}</tbody>
    </table></div>
  </>;
}
export const HrzHow = () => <>{zones.value?.hrTops ? "Пульсові зони зі Strava." : "Зони від порогового пульсу."} Для плану 80/20 легка робота (Z1–Z2) зазвичай ≈75–80 % часу.</>;
export const hrzW: Widget = { id: "hrz", title: "Час у пульсових зонах", about: "Скільки часу в кожній пульсовій зоні", span: 3, link: { label: "Таблиця", href: "#lab/hrz" }, C: Hrz, Full: HrzFull, how: HrzHow };
