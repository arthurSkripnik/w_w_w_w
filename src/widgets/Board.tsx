// A screen's widget grid. The layout doc (layout/home, layout/lab) lists the widgets in order with their size;
// without one the screen shows its default set. Each card has a menu to put the widget on the other screen or take it off this one.
import { Component, type ComponentChildren } from "preact";
import { computed } from "@preact/signals";
import { Empty } from "../ui";
import { layouts } from "../store/data";
import { setLayout } from "../store/actions";
import { WIDGETS, DEFAULTS, type BoardId } from "./index";
import type { Widget, Size } from "./types";

const NAME: Record<BoardId, [string, string]> = { home: ["Головна", "На Головну"], lab: ["Лабораторія", "У Лабораторію"] };
const byId = new Map(WIDGETS.map(w => [w.id, w]));
const can = (w: Widget, s: Size) => (s === "full" ? !!w.Full : !!w.C);
/** Size a widget takes on a screen: the screen's preferred size if the widget has it, else the other one. */
const sizeFor = (w: Widget, b: BoardId): Size => { const pref: Size = b === "lab" ? "full" : "compact"; return can(w, pref) ? pref : pref === "full" ? "compact" : "full"; };

/** The widgets a screen shows now, in order. */
export const boardOf = (b: BoardId) => computed(() => {
  const saved = layouts.value[b]?.widgets ?? DEFAULTS[b];
  return saved.filter(x => !x.hidden).map(x => ({ w: byId.get(x.id)!, size: x.size as Size })).filter(x => x.w && can(x.w, x.size));
});
const boards = { home: boardOf("home"), lab: boardOf("lab") };

async function save(b: BoardId, items: { id: string; size: Size }[]) { await setLayout(b, { widgets: items }); }
const current = (b: BoardId) => boards[b].value.map(x => ({ id: x.w.id, size: x.size }));

/** One widget that throws is hidden; the rest of the screen still renders. */
class Guard extends Component<{ id: string; children: ComponentChildren }, { err: boolean }> {
  state = { err: false };
  componentDidCatch(e: unknown) { console.error(`widget ${this.props.id}`, e); this.setState({ err: true }); }
  render() { return this.state.err ? <Empty>Віджет не вдалося показати</Empty> : this.props.children; }
}

function Menu({ w, b }: { w: Widget; b: BoardId }) {
  const other: BoardId = b === "home" ? "lab" : "home", there = boards[other].value.some(x => x.w.id === w.id);
  const close = (e: Event) => (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
  return <details class="wg-menu">
    <summary aria-label={`Дії з віджетом «${w.title}»`}>···</summary>
    <div class="wg-menu-b" role="menu">
      <button type="button" role="menuitem" disabled={there} onClick={e => { close(e); save(other, [...current(other), { id: w.id, size: sizeFor(w, other) }]); }}>
        {there ? `Уже: ${NAME[other][0]}` : NAME[other][1]}</button>
      <button type="button" role="menuitem" onClick={e => { close(e); save(b, current(b).filter(x => x.id !== w.id)); }}>Прибрати звідси</button>
    </div>
  </details>;
}

function Slot({ w, size, n, b }: { w: Widget; size: Size; n: number; b: BoardId }) {
  const W = size === "full" ? w.Full! : w.C!, span = size === "full" ? w.fullSpan ?? 12 : w.span;
  const link = size === "compact" && w.link && !(b === "lab" && w.link.href.startsWith("#lab")) ? w.link : null;
  return (
    <section id={`w-${w.id}`} class="card wg" data-size={size} data-span={span} data-rows={size === "compact" ? w.rows : undefined} aria-labelledby={`wt-${w.id}`}>
      <header class="card-head">
        <span class="card-n num">{String(n).padStart(2, "0")}</span>
        <h2 class="card-title" id={`wt-${w.id}`}>{w.title}</h2>
        {link && <a class="card-aside wg-link" href={link.href}>{link.label}</a>}
        <Menu w={w} b={b} />
      </header>
      <Guard id={w.id}><W /></Guard>
    </section>
  );
}

export function Board({ b }: { b: BoardId }) {
  const ws = boards[b].value;
  if (!ws.length) return <Empty>Тут немає віджетів. Додай їх з меню «···» на іншому екрані.</Empty>;
  return <div class={`grid hub board-${b}`}>{ws.map((x, i) => <Slot key={x.w.id} w={x.w} size={x.size} n={i + 1} b={b} />)}</div>;
}
