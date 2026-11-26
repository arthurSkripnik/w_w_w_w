// A screen's widget canvas: a 12-column grid of slots (phones: 6). The layout doc (layout/home, layout/lab, layout/profile)
// lists the widgets in order with their size; without one the screen shows its default set.
// «Редагувати» turns on the canvas mode: drag a widget by its handle (mouse, finger, or arrows on the handle), pin it
// in place, pick its size, add one from the «Додати віджет» list. The rules of moving live in ./layout.ts.
import { Component, type ComponentChildren } from "preact";
import { useState, useRef } from "preact/hooks";
import { computed } from "@preact/signals";
import { Empty, Button, Choice } from "../ui";
import { layouts } from "../store/data";
import { setLayout } from "../store/actions";
import { WIDGETS, DEFAULTS, BOARDS, type BoardId } from "./index";
import type { Widget, Size } from "./types";
import { moveTo, moveStep, addAt, togglePin, resize, hide, clean, type Item, type Span } from "./layout";

const NAME: Record<BoardId, [string, string]> = { home: ["Головна", "На Головну"], lab: ["Лабораторія", "У Лабораторію"], profile: ["Профіль", "У Профіль"] };
const byId = new Map(WIDGETS.map(w => [w.id, w]));
const can = (w: Widget, s: Size) => (s === "full" ? !!w.Full : !!w.C);
/** Size a widget takes on a screen: the screen's preferred size if the widget has it, else the other one. */
const sizeFor = (w: Widget, b: BoardId): Size => { const pref: Size = b === "home" ? "compact" : "full"; return can(w, pref) ? pref : pref === "full" ? "compact" : "full"; };

/** The whole list of a screen, hidden ones too: a removed widget stays as hidden, so a default does not come back. */
const current = (b: BoardId): Item[] => {
  const saved = layouts.value[b]?.widgets as Item[] | undefined; if (!saved) return DEFAULTS[b].map(clean);
  return [...saved, ...DEFAULTS[b].filter(x => !saved.some(y => y.id === x.id))].map(clean);   // a widget added in a later version shows up once
};
const shows = (x: Item) => { const w = byId.get(x.id); return !x.hidden && !!w && can(w, x.size); };
export const boardOf = (b: BoardId) => computed(() => current(b).filter(shows).map(x => ({ w: byId.get(x.id)!, size: x.size, it: x })));
export const boards = { home: boardOf("home"), lab: boardOf("lab"), profile: boardOf("profile") };

/** Save a new order of the shown widgets (the rest, hidden ones, keep their entries). Shown at once, then written. */
async function save(b: BoardId, shown: Item[]) {
  const rest = current(b).filter(x => !shows(x) && !shown.some(y => y.id === x.id));
  const widgets = [...shown, ...rest].map(clean);
  layouts.value = { ...layouts.value, [b]: { widgets } };
  await setLayout(b, { widgets });
}
const shownOf = (b: BoardId) => boards[b].value.map(x => x.it);
const addTo = (b: BoardId, w: Widget, to?: number) => {
  const V = shownOf(b); if (V.some(x => x.id === w.id)) return;
  save(b, addAt(V, { id: w.id, size: sizeFor(w, b) }, to ?? V.length));
};

/** One widget that throws is hidden; the rest of the screen still renders. */
class Guard extends Component<{ id: string; children: ComponentChildren }, { err: boolean }> {
  state = { err: false };
  componentDidCatch(e: unknown) { console.error(`widget ${this.props.id}`, e); this.setState({ err: true }); }
  render() { return this.state.err ? <Empty>Віджет не вдалося показати</Empty> : this.props.children; }
}

function Menu({ w, b }: { w: Widget; b: BoardId }) {
  const close = (e: Event) => (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
  return <details class="wg-menu">
    <summary aria-label={`Дії з віджетом «${w.title}»`}>···</summary>
    <div class="wg-menu-b" role="menu">
      {BOARDS.filter(o => o !== b).map(o => { const there = boards[o].value.some(x => x.w.id === w.id);
        return <button key={o} type="button" role="menuitem" disabled={there} onClick={e => { close(e); addTo(o, w); }}>{there ? `Уже: ${NAME[o][0]}` : NAME[o][1]}</button>; })}
      <button type="button" role="menuitem" onClick={e => { close(e); save(b, hide(shownOf(b), w.id)); }}>Прибрати звідси</button>
    </div>
  </details>;
}

// sizes a widget can take: its own compact width or wider, and the big chart if it has one
const SPAN_T: Record<Span, string> = { 3: "¼", 6: "½", 12: "Ціла" };
const sizeOpts = (w: Widget) => [
  ...(w.C ? ([3, 6, 12] as Span[]).filter(s => s >= w.span).map(s => ({ id: `c${s}`, title: SPAN_T[s] })) : []),
  ...(w.Full ? [{ id: "full", title: "Графік" }] : []),
];
const spanOf = (w: Widget, it: Item) => (it.size === "full" ? w.fullSpan ?? 12 : it.span ?? w.span);

type Drag = { id: string; add: boolean; title: string; x: number; y: number };
type Ed = { b: BoardId; drop: number | null; dragging: string | null; start: (e: PointerEvent, id: string, add: boolean) => void; say: (t: string) => void };

function Slot({ w, it, n, i, b, ed }: { w: Widget; it: Item; n: number; i: number; b: BoardId; ed: Ed | null }) {
  const size = it.size, W = size === "full" ? w.Full! : w.C!, span = spanOf(w, it);
  const link = !ed && size === "compact" && w.link ? w.link : null;
  const opts = ed ? sizeOpts(w) : [];
  const key = (e: KeyboardEvent) => {
    const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
    if (!d || !ed) return; e.preventDefault();
    const V = shownOf(ed.b), next = moveStep(V, w.id, d as -1 | 1);
    if (next !== V) { save(ed.b, next); ed.say(`«${w.title}»: місце ${next.findIndex(x => x.id === w.id) + 1} з ${next.length}`); }
  };
  return (
    <section id={`w-${w.id}`} class="card wg" data-size={size} data-span={span} data-i={i} data-w={w.id}
      data-rows={size === "compact" && w.rows && span >= 6 ? w.rows : undefined}
      data-pinned={ed && it.pinned ? "" : undefined} data-dragging={ed?.dragging === w.id ? "" : undefined}
      data-drop={ed?.drop === i ? "before" : undefined} aria-labelledby={`wt-${w.id}`}>
      <header class="card-head">
        {ed && <button type="button" class="wg-handle" disabled={it.pinned} aria-label={`Перемістити «${w.title}». Стрілки міняють місце`}
          title={it.pinned ? "Прикріплено: спершу відкріпи" : "Тягни, щоб перемістити"}
          onPointerDown={e => !it.pinned && ed.start(e as PointerEvent, w.id, false)} onKeyDown={key}>⠿</button>}
        <span class="card-n num">{String(n).padStart(2, "0")}</span>
        <h2 class="card-title" id={`wt-${w.id}`}>{w.title}</h2>
        {link && <a class="card-aside wg-link" href={link.href}>{link.label}</a>}
        {ed && <button type="button" class="wg-pin card-aside" aria-pressed={!!it.pinned} title={it.pinned ? "Відкріпити" : "Прикріпити на цьому місці"}
          aria-label={`${it.pinned ? "Відкріпити" : "Прикріпити"} «${w.title}»`} onClick={() => save(b, togglePin(shownOf(b), w.id))}>📌</button>}
        {!it.pinned && <Menu w={w} b={b} />}
      </header>
      {ed && opts.length > 1 && <div class="wg-edit">
        <Choice label={`Розмір «${w.title}»`} options={opts} value={size === "full" ? "full" : `c${it.span ?? w.span}`}
          onChange={v => { const s = v === "full" ? undefined : (+v.slice(1) as Span);
            save(b, resize(shownOf(b), w.id, v === "full" ? "full" : "compact", s && s !== w.span ? s : undefined)); }} />
      </div>}
      <Guard id={w.id}><W /></Guard>
    </section>
  );
}

/** The list of widgets that are not on this screen yet: drag one onto the grid or press «+». */
function Panel({ b, ed, onClose }: { b: BoardId; ed: Ed; onClose: () => void }) {
  const on = new Set(boards[b].value.map(x => x.w.id));
  const list = WIDGETS.filter(w => !on.has(w.id) && (w.C || w.Full));
  return <aside class="wg-panel" aria-label="Додати віджет">
    <header class="wg-panel-h"><h2 class="card-title">Додати віджет</h2><Button variant="link" onClick={onClose}>Закрити</Button></header>
    {!list.length ? <p class="status">Усі віджети вже тут.</p> :
      <ul class="wg-list">{list.map(w => { const s = sizeFor(w, b), span = s === "full" ? w.fullSpan ?? 12 : w.span;
        return <li key={w.id} class="wg-li">
          <button type="button" class="wg-handle" aria-hidden="true" tabIndex={-1} onPointerDown={e => ed.start(e as PointerEvent, w.id, true)}>⠿</button>
          <div class="wg-li-t"><b>{w.title}</b><span class="status">{w.about} · {span === 12 ? "ціла ширина" : span === 6 ? "½" : "¼"}</span></div>
          <button type="button" class="wg-add" aria-label={`Додати «${w.title}» в кінець`} onClick={() => { addTo(b, w); ed.say(`«${w.title}» додано`); }}>+</button>
        </li>; })}</ul>}
  </aside>;
}

export function Board({ b }: { b: BoardId }) {
  const ws = boards[b].value;
  const [edit, setEdit] = useState(false), [panel, setPanel] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null), [drop, setDrop] = useState<number | null>(null), [msg, setMsg] = useState("");
  const grid = useRef<HTMLDivElement>(null);

  // where a drop at (x, y) lands: before the card under the pointer (or after it, right half), the end of the grid, or nowhere
  const target = (x: number, y: number, id: string): number | null => {
    const g = grid.current; if (!g) return null;
    const hit = document.elementsFromPoint(x, y).find(n => n instanceof HTMLElement && n.matches(".wg[data-i]") && g.contains(n)) as HTMLElement | undefined;
    if (hit) { if (hit.dataset.w === id) return null; const r = hit.getBoundingClientRect(), i = +hit.dataset.i!; return x < r.left + r.width / 2 ? i : i + 1; }
    const r = g.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom + 80 ? ws.length : null;
  };
  const ed: Ed = {
    b, drop, dragging: drag && !drag.add ? drag.id : null, say: setMsg,
    start(e, id, add) {
      if (e.button !== 0) return; e.preventDefault();
      const el = e.currentTarget as HTMLElement, w = byId.get(id)!; el.setPointerCapture(e.pointerId);
      setDrag({ id, add, title: w.title, x: e.clientX, y: e.clientY });
      const mv = (ev: PointerEvent) => { setDrag(d => d && { ...d, x: ev.clientX, y: ev.clientY }); setDrop(target(ev.clientX, ev.clientY, id)); };
      const end = (ev: PointerEvent, ok: boolean) => {
        el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", cancel);
        const t = ok ? target(ev.clientX, ev.clientY, id) : null; setDrag(null); setDrop(null);
        if (t == null) return;
        const V = shownOf(b);
        if (add) { addTo(b, w, t); setMsg(`«${w.title}» додано на місце ${Math.min(t, V.length) + 1}`); }
        else { const next = moveTo(V, id, t); if (next.some((x, k) => x !== V[k])) { save(b, next); setMsg(`«${w.title}»: місце ${next.findIndex(x => x.id === id) + 1} з ${next.length}`); } }
      };
      const up = (ev: PointerEvent) => end(ev, true), cancel = (ev: PointerEvent) => end(ev, false);
      el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", cancel);
    },
  };
  const E = edit ? ed : null;
  const bar = <div class="board-bar">
    {edit && <Button variant="ghost" aria-expanded={panel} onClick={() => setPanel(!panel)}>{panel ? "Сховати список" : "Додати віджет"}</Button>}
    <Button variant={edit ? "primary" : "ghost"} aria-pressed={edit} onClick={() => { setEdit(!edit); setPanel(false); }}>{edit ? "Готово" : "Редагувати"}</Button>
  </div>;

  return <div class="board" data-edit={edit ? "" : undefined}>
    {bar}
    {!ws.length && !edit ? (b === "profile" ? null : <Empty>Тут немає віджетів. Натисни «Редагувати» → «Додати віджет».</Empty>) :
      <div ref={grid} class={`grid hub board-${b}`} data-drop-end={edit && drop === ws.length ? "" : undefined}>
        {ws.map((x, i) => <Slot key={x.w.id} w={x.w} it={x.it} n={i + 1} i={i} b={b} ed={E} />)}
      </div>}
    {edit && panel && <Panel b={b} ed={ed} onClose={() => setPanel(false)} />}
    {drag && <div class="wg-ghost" style={{ left: `${drag.x + 14}px`, top: `${drag.y + 14}px` }} aria-hidden="true">{drag.title}</div>}
    <p class="sr-only" role="status" aria-live="polite">{msg}</p>
  </div>;
}
