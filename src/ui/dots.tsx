// Dots, beads and dials (step 17, after Holographik, T—BI, Hojlund, OpenAI, Nothing): the dot is the unit of data.
// One rule everywhere: fact is a filled dot or a solid line, plan is an outline or a dashed line, the accent marks
// the hard days (threshold, race). Sizes come from the data, colours only from tokens.
import type { ComponentChildren } from "preact";

/** done = filled, plan = outline, miss = a cross, rest = a speck; `hard` paints it in the accent (threshold, race). */
export type DotState = "done" | "plan" | "miss" | "rest";
export interface DotItem { state: DotState; v?: number; label: string; today?: boolean; hard?: boolean }

const R_MIN = 2.5, R_MAX = 9;
const rOf = (v = 0.5) => R_MIN + (R_MAX - R_MIN) * Math.max(0, Math.min(1, v));

function DotShape({ state, v, cx, cy, today, hard }: DotItem & { cx: number; cy: number }) {
  const r = state === "rest" ? 1.5 : rOf(v);
  return <g>
    {today && <circle class="dt-today" cx={cx} cy={cy} r={R_MAX + 3} />}
    {state === "miss" ? <path class="dt-miss" d={`M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx + 4} ${cy - 4}L${cx - 4} ${cy + 4}`} />
      : <circle class="dt" data-st={state} data-hard={hard ? "" : undefined} cx={cx} cy={cy} r={state === "plan" ? r - 0.5 : r} />}
  </g>;
}

/** One dot, sized 0–1 by `v`. */
export function Dot(p: DotItem) {
  const s = 2 * (R_MAX + 4);
  return <svg class="dots" width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label={p.label}><title>{p.label}</title><DotShape {...p} cx={s / 2} cy={s / 2} /></svg>;
}

/** A row of dots: a week as seven days, the size is the planned time. `rows` stacks several rows (a whole plan). */
export function DotRow({ items, label, heads }: { items: DotItem[]; label: string; heads?: string[] }) {
  return <DotMatrix rows={[items]} label={label} heads={heads} />;
}
export function DotMatrix({ rows, label, heads, rowLabels }: { rows: DotItem[][]; label: string; heads?: string[]; rowLabels?: string[] }) {
  const c = 2 * (R_MAX + 4), lw = rowLabels ? 28 : 0, hh = heads ? 16 : 0;
  const n = Math.max(...rows.map(r => r.length), 1), w = lw + n * c, h = hh + rows.length * c;
  return <svg class="dots" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
    <title>{label}</title>
    {heads?.map((t, i) => <text key={t + i} class="dt-h" x={lw + i * c + c / 2} y={11} text-anchor="middle">{t}</text>)}
    {rows.map((row, j) => <g key={j}>
      {rowLabels && <text class="dt-h" x={0} y={hh + j * c + c / 2 + 4}>{rowLabels[j]}</text>}
      {row.map((d, i) => <g key={i}><title>{d.label}</title><DotShape {...d} cx={lw + i * c + c / 2} cy={hh + j * c + c / 2} /></g>)}
    </g>)}
  </svg>;
}

/** Columns of beads (T—BI): one bead = `per` units. Done beads are filled, the planned rest is outlined and joined
 *  by a dashed thread; `key` puts the column in the accent. A bar chart you can count. */
export interface BeadCol { label: string; done: number; plan?: number; key?: boolean; now?: boolean }
export function Beads({ cols, per, unit, label }: { cols: BeadCol[]; per: number; unit: string; label: string }) {
  const r = 5, step = 2 * r + 3, cw = 40;
  const n = (x: number) => Math.round(x / per);
  const max = Math.max(1, ...cols.map(c => Math.max(n(c.done), n(c.plan ?? 0))));
  const h = max * step + 22, w = cols.length * cw;
  return <svg class="beads" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
    aria-label={`${label}: ${cols.map(c => `${c.label} ${Math.round(c.done)}${c.plan ? ` з ${Math.round(c.plan)}` : ""} ${unit}`).join(", ")}`}>
    {cols.map((c, i) => { const x = i * cw + cw / 2, d = n(c.done), p = Math.max(d, n(c.plan ?? 0)), y0 = max * step - r;
      return <g key={c.label + i} data-key={c.key ? "" : undefined}>
        <title>{`${c.label}: ${c.done.toFixed(0)}${c.plan ? ` з ${c.plan.toFixed(0)}` : ""} ${unit}`}</title>
        {p > 1 && <line class="bd-thread" data-plan={p > d ? "" : undefined} x1={x} x2={x} y1={y0} y2={y0 - (p - 1) * step} />}
        {Array.from({ length: p }, (_, k) => <circle key={k} class="bd" data-st={k < d ? "done" : "plan"} cx={x} cy={y0 - k * step} r={k < d ? r : r - 0.5} />)}
        <text class="dt-h" data-now={c.now ? "" : undefined} x={x} y={h - 4} text-anchor="middle">{c.label}</text>
      </g>; })}
  </svg>;
}

/** A dial (Hojlund): a ring of ticks from min to max, filled up to the value; `bands` mark zone edges with a long
 *  tick, `mark` is the target in the accent. The value and its word sit in the middle. */
export function Dial({ value, min = 0, max = 100, bands = [], mark, text, sub, label, size = 168 }: {
  value: number | null; min?: number; max?: number; bands?: number[]; mark?: number | null; text: string; sub?: ComponentChildren; label: string; size?: number }) {
  const N = 60, c = size / 2, R = c - 8, a0 = -225, span = 270;
  const ang = (v: number) => ((a0 + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * span) * Math.PI) / 180;
  const on = value == null ? -1 : Math.round(((Math.max(min, Math.min(max, value)) - min) / (max - min)) * N);
  const tick = (a: number, l: number, cls: string, k: string) => <line key={k} class={cls} x1={c + Math.cos(a) * R} y1={c + Math.sin(a) * R} x2={c + Math.cos(a) * (R - l)} y2={c + Math.sin(a) * (R - l)} />;
  return <div class="dial" style={{ width: `${size}px` }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value ?? undefined} aria-valuetext={text}>
      {Array.from({ length: N + 1 }, (_, i) => tick(((a0 + (i / N) * span) * Math.PI) / 180, 7, i <= on ? "dl-t on" : "dl-t", "t" + i))}
      {bands.map(b => <line key={"b" + b} class="dl-b" x1={c + Math.cos(ang(b)) * (R + 5)} y1={c + Math.sin(ang(b)) * (R + 5)} x2={c + Math.cos(ang(b)) * (R - 12)} y2={c + Math.sin(ang(b)) * (R - 12)} />)}
      {mark != null && tick(ang(mark), 16, "dl-m", "m")}
    </svg>
    <div class="dial-c"><b class="num">{text}</b>{sub && <span class="label">{sub}</span>}</div>
  </div>;
}

/** The grey ramp as numbered stripes (Holographik): for #kit. */
export function Ramp() {
  const G = [["01", "--g1"], ["02", "--g2"], ["03", "--g3"], ["04", "--g4"], ["05", "--g5"], ["", "--ink"], ["", "--acc"]];
  return <div class="ramp">{G.map(([n, v]) => <div key={v} class="ramp-i">
    <i class="ramp-s" style={{ background: `var(${v})` }} /><span class="num">{n ? `Сірий ${n}` : v === "--ink" ? "Чорнило" : "Акцент"}</span><span class="label">{v}</span></div>)}</div>;
}
