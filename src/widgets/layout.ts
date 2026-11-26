// The canvas rules, without the screen: a board is an ordered list of slots on the 12-column grid.
// Moving or adding a widget reorders only the free ones; a pinned widget keeps its place (its index in the list),
// and the others flow around it. Hidden ones stay in the list so a default does not come back.
export type Size = "compact" | "full";
export type Span = 3 | 6 | 12;
export interface Item { id: string; size: Size; span?: Span; pinned?: boolean; hidden?: boolean }

/** Put the free items back around the pinned ones: pinned keep their index, the free fill the rest in order. */
function refill(n: number, pinned: Map<number, Item>, free: Item[]): Item[] {
  const out: Item[] = []; let k = 0;
  for (let p = 0; p < n; p++) out.push(pinned.get(p) ?? free[k++]);
  return out;
}
const split = (V: Item[]) => {
  const pinned = new Map<number, Item>(), free: Item[] = [];
  V.forEach((x, i) => (x.pinned ? pinned.set(i, x) : free.push(x)));
  return { pinned, free };
};
/** How many free items stand before visible index `to` (the moved one left out). */
const freeBefore = (V: Item[], to: number, skip?: string) => V.slice(0, to).filter(x => !x.pinned && x.id !== skip).length;

/** Move a free widget so it lands before visible index `to` (to = V.length: the end). A pinned one does not move. */
export function moveTo(V: Item[], id: string, to: number): Item[] {
  const it = V.find(x => x.id === id); if (!it || it.pinned) return V;
  const { pinned, free } = split(V), rest = free.filter(x => x.id !== id);
  rest.splice(Math.min(freeBefore(V, to, id), rest.length), 0, it);
  return refill(V.length, pinned, rest);
}
/** One step among the free widgets (keyboard: arrows on the handle). */
export function moveStep(V: Item[], id: string, dir: -1 | 1): Item[] {
  const { pinned, free } = split(V), i = free.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= free.length) return V;
  [free[i], free[j]] = [free[j], free[i]];
  return refill(V.length, pinned, free);
}
/** A new widget before visible index `to`; pinned ones keep their index. */
export function addAt(V: Item[], it: Item, to: number): Item[] {
  const { pinned, free } = split(V);
  free.splice(Math.min(freeBefore(V, to), free.length), 0, { ...it, pinned: undefined, hidden: undefined });
  return refill(V.length + 1, pinned, free);
}
export const togglePin = (V: Item[], id: string): Item[] => V.map(x => (x.id === id ? clean({ ...x, pinned: !x.pinned }) : x));
export const resize = (V: Item[], id: string, size: Size, span?: Span): Item[] => V.map(x => (x.id === id ? clean({ ...x, size, span }) : x));
/** Taken off the board: kept as hidden, unpinned. */
export const hide = (V: Item[], id: string): Item[] => V.map(x => (x.id === id ? clean({ ...x, hidden: true, pinned: undefined }) : x));
/** Only the fields that say something (the schema keeps undefined out of the db). */
export function clean(x: Item): Item {
  const o: Item = { id: x.id, size: x.size };
  if (x.span) o.span = x.span; if (x.pinned) o.pinned = true; if (x.hidden) o.hidden = true;
  return o;
}
