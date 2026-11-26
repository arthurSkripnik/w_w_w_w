// Store values and view state behind Порівняння (domain/compare.ts does the arithmetic).
import { signal, computed } from "@preact/signals";
import { days, aerobic } from "./derived";
import { groups, defaultGroup, groupOf, one, avgSide, prevOf, type GroupRuns, type Side, type CmpRun } from "../domain/compare";

export const cmpGroups = computed(() => groups(days.value, aerobic.value.pts));

const KEY = "rp2-cmp";
const load = (): { g?: string; mode?: "run" | "avg" } => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const saved = load();
/** Chosen kind (null = the default one), chosen dates (1–2, oldest first), what B is compared with, chart metric. */
export const cmpG = signal<string | null>(saved.g ?? null);
export const cmpSel = signal<string[]>([]);
export const cmpMode = signal<"run" | "avg">(saved.mode ?? "run");
export const cmpM = signal<"pace" | "hr">("pace");
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify({ g: cmpG.value, mode: cmpMode.value })); } catch { /* private mode */ } };

export const cmpGroup = computed<GroupRuns | null>(() => cmpGroups.value.find(g => g.k === cmpG.value) ?? defaultGroup(cmpGroups.value));
/** The pair on screen: B is the newer chosen run; A is the older chosen run, or the 6-week mean before B. */
/** auto: the pair was picked by prevOf (same session and level), not tapped. */
export const cmpPair = computed<{ g: GroupRuns; A: Side | null; B: CmpRun; avgOk: boolean; auto: boolean } | null>(() => {
  const g = cmpGroup.value; if (!g) return null;
  const ds = g.runs.map(r => r.d), ok = cmpSel.value.filter(d => ds.includes(d)).sort(), last = g.runs[g.runs.length - 1];
  const auto = !ok.length, pa = auto ? prevOf(g, last) : null;
  const sel = ok.length ? ok : pa ? [pa.d, last.d] : [last.d];
  const B = g.runs.find(r => r.d === sel[sel.length - 1])!, av = avgSide(g, B);
  if (cmpMode.value === "avg") return { g, A: av, B, avgOk: !!av, auto };
  const a = sel.length === 2 ? g.runs.find(r => r.d === sel[0])! : null;
  return { g, A: a ? one(a) : null, B, avgOk: !!av, auto };
});
export function pickGroup(k: string) { cmpG.value = k; cmpSel.value = []; keep(); }
export function pickMode(m: "run" | "avg") { cmpMode.value = m; keep(); }
/** Tap a run: in pair mode it joins the pair (the oldest of three drops out); in mean mode it becomes B. */
export function toggleRun(d: string) {
  const p = cmpPair.value; if (!p) return;
  if (cmpMode.value === "avg") { cmpSel.value = [d]; return; }
  const cur = [p.A?.d, p.B.d].filter((x): x is string => !!x);
  let s = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
  if (s.length > 2) s = s.slice(1);
  s.sort();
  cmpSel.value = s.length ? s : [d];
}
/** From a day card: that day against the previous run of the same kind. */
export function openFor(date: string) {
  const d = days.value.find(x => x.date === date), g = d && groupOf(d.act), G = g && cmpGroups.value.find(x => x.k === g.k);
  if (!G) return false;
  const B = G.runs.find(r => r.d === date), prev = B ? prevOf(G, B) : null;
  cmpG.value = G.k; cmpMode.value = "run"; cmpSel.value = prev ? [prev.d, date] : [date]; keep();
  return true;
}
