// Головна: the headline sentence, the widget grid and the Strava sync. Each widget is a file in src/widgets/.
import { Empty, Button } from "../ui";
import { dbState } from "../store/data";
import { goal } from "../store/derived";
import { fc, toRace } from "../store/home";
import { sync, syncPlan } from "../store/strava";
import { mmss, plural, dm } from "../domain/home";
import { Board } from "../widgets/Board";

function Headline() {
  const n = toRace.value, g = goal.value, f = fc.value;
  if (n == null || !g) return <h1 class="hub-head">План без цілі.</h1>;
  return <h1 class="hub-head">
    {n >= 0 ? `${n} ${plural(n, "день", "дні", "днів")} до старту.` : "Старт позаду."}{" "}
    <i>{g.name}, {dm(g.date)}.{f ? ` Прогноз ${mmss(f.t10)}, ціль ${mmss(g.targetSec)}.` : ""}</i>
  </h1>;
}

function Sync() {
  const s = sync.value;
  return <section class="hub-sync">
    <div class="btn-row">
      <Button disabled={s.busy} onClick={() => syncPlan(false)}>Синхронізувати план</Button>
      <a class="btn" data-v="link" href="#profile/data">Перерахунок і історія в Профілі</a>
    </div>
    {s.text && <p class={`status${s.ok === false ? " err" : ""}`} role="status">{s.text}</p>}
  </section>;
}

export function Home() {
  if (dbState.value === "loading") return <Empty>Читаю базу…</Empty>;
  if (dbState.value === "offline" || dbState.value === "error") return <Empty>База недоступна. Відкрий сторінку як артефакт у Claude.</Empty>;
  return <>
    <Headline />
    <Board b="home" />
    <Sync />
  </>;
}
