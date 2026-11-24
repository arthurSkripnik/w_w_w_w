// Головна: the headline sentence, the widget grid and the Strava sync. Each widget is a file in src/widgets/.
import { Component, type ComponentChildren } from "preact";
import { Empty, Button } from "../ui";
import { computed } from "@preact/signals";
import { dbState, layout } from "../store/data";
import { goal } from "../store/derived";
import { fc, toRace } from "../store/home";
import { sync, syncPlan } from "../store/strava";
import { mmss, plural, dm } from "../domain/home";
import { WIDGETS, type Widget } from "../widgets";

/** Widgets in the saved order (layout/home); ones not in it keep their default place after the saved ones. */
const homeWidgets = computed(() => {
  const saved = layout.value?.widgets ?? [], at = new Map(saved.map((w, i) => [w.id, { i, hidden: !!w.hidden }]));
  return WIDGETS.map((w, k) => ({ w, i: at.get(w.id)?.i ?? 100 + k, hidden: at.get(w.id)?.hidden ?? false })).sort((a, b) => a.i - b.i);
});

/** One widget that throws is hidden; the rest of the screen still renders. */
class Guard extends Component<{ id: string; children: ComponentChildren }, { err: boolean }> {
  state = { err: false };
  componentDidCatch(e: unknown) { console.error(`widget ${this.props.id}`, e); this.setState({ err: true }); }
  render() { return this.state.err ? <Empty>Віджет не вдалося показати</Empty> : this.props.children; }
}

function Slot({ w, n }: { w: Widget; n: number }) {
  return (
    <section class="card wg" data-span={w.span} data-rows={w.rows} aria-labelledby={`w-${w.id}`}>
      <header class="card-head">
        <span class="card-n num">{String(n).padStart(2, "0")}</span>
        <h2 class="card-title" id={`w-${w.id}`}>{w.title}</h2>
        {w.link && <a class="card-aside wg-link" href={w.link.href}>{w.link.label}</a>}
      </header>
      <Guard id={w.id}><w.C /></Guard>
    </section>
  );
}

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
  const ws = homeWidgets.value.filter(x => !x.hidden);
  return <>
    <Headline />
    <div class="grid hub">{ws.map((x, i) => <Slot key={x.w.id} w={x.w} n={i + 1} />)}</div>
    <Sync />
  </>;
}
