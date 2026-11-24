// «Сон, 7 днів»: the average of the last 7 nights against the norm, the last 14 nights.
import type { Widget } from "./types";
import { Stat, Empty } from "../ui";
import { Spark } from "./Spark";
import { sleep7, sleepNorm } from "../store/home";
import { today } from "../store/derived";
import { journal } from "../store/data";
import { plural, sleepOf } from "../domain/home";
import { addDays } from "../domain/util";

function Sleep() {
  const wk = sleep7.value, norm = sleepNorm.value, t = today.value;
  if (!wk) return <Empty>Сон ще не записано. Запиши його в картці «Сьогодні».</Empty>;
  const last = Array.from({ length: 14 }, (_, i) => { const d = addDays(t, i - 13); return { d, v: sleepOf(journal.value, d) }; });
  return <>
    <Stat size="m" value={wk.avg.toFixed(1)} unit="год" caption={`Норма ${norm} · ${wk.n} ${plural(wk.n, "ніч", "ночі", "ночей")}`} />
    <Spark label="Сон за 14 ночей" pts={last} />
  </>;
}
export const sleepW: Widget = { id: "sleep", title: "Сон, 7 днів", span: 3, link: { label: "Профіль", href: "#profile" }, C: Sleep };
