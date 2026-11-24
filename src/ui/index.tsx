// Basic elements every screen is built from. Look and spacing live in styles/components.css.
import type { ComponentChildren, ButtonHTMLAttributes, InputHTMLAttributes } from "preact";
import { useId } from "preact/hooks";

/** 12-column grid (6 on phones). Children are Cards or Cells with a span. */
export function Grid({ children }: { children: ComponentChildren }) {
  return <div class="grid">{children}</div>;
}
type Span = 3 | 4 | 6 | 8 | 12;
/** A card: top rule, optional number and title, no background. */
export function Card({ id, n, title, span = 12, aside, children }: { id?: string; n?: string; title?: string; span?: Span; aside?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section id={id} class="card" data-span={span}>
      {(n || title || aside) && (
        <header class="card-head">
          {n && <span class="card-n num">{n}</span>}
          {title && <h2 class="card-title">{title}</h2>}
          {aside && <div class="card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A large number with its unit and a caption: the answer of a card. */
export function Stat({ value, unit, caption, acc, size = "l" }: { value: string; unit?: string; caption?: ComponentChildren; acc?: boolean; size?: "l" | "m" }) {
  return (
    <div class="stat" data-size={size}>
      <div class="stat-v num"><span class={acc ? "acc" : undefined}>{value}</span>{unit && <span class="stat-u">{unit}</span>}</div>
      {caption && <div class="stat-c">{caption}</div>}
    </div>
  );
}

/** A value in a pill: ink by default, accent for what matters, outline for secondary. */
export function Pill({ children, tone = "ink" }: { children: ComponentChildren; tone?: "ink" | "acc" | "line" | "err" }) {
  return <span class="pill num" data-tone={tone}>{children}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "link"; disabled?: boolean };
export function Button({ variant = "primary", children, ...rest }: BtnProps) {
  return <button type="button" class="btn" data-v={variant} {...rest}>{children}</button>;
}

/** Choose one option. One component for every switch of the app, in three looks:
 *  seg = 2–4 words (calendar view, chart metric), chips = a row of named groups with counts (kinds of runs),
 *  nums = a strip of numbers (levels 1–10); `mark` underlines options that matter (levels in the plan). */
export interface ChoiceOpt<T> { id: T; title: string; count?: number; mark?: boolean; hint?: string }
export function Choice<T extends string | number>({ label, options, value, onChange, look = "seg" }: { label: string; options: ChoiceOpt<T>[]; value: T; onChange: (v: T) => void; look?: "seg" | "chips" | "nums" }) {
  const name = useId();
  return (
    <div class="seg" data-look={look} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <label class="seg-o" key={String(o.id)} title={o.hint} data-mark={o.mark ? "" : undefined}>
          <input type="radio" name={name} value={String(o.id)} checked={o.id === value} onChange={() => onChange(o.id)} />
          <span>{o.title}{o.count != null && <span class="seg-c num">{o.count}</span>}</span>
        </label>
      ))}
    </div>
  );
}
/** The 2–4 word switch: Choice with the segmented look. */
export function Segmented<T extends string>(p: { label: string; options: { id: T; title: string }[]; value: T; onChange: (v: T) => void }) {
  return <Choice {...p} look="seg" />;
}

/** Name–value pairs, one component for every list of numbers: l = the big numbers of a day, m = a run's summary,
 *  s = the facts of a card, rows = name and formula left, value right (coefficients), text = a name above a sentence (rules). */
export interface KVItem { k: string; v: ComponentChildren; u?: string; sub?: ComponentChildren; txt?: boolean }
export function KV({ items, size = "m" }: { items: KVItem[]; size?: "l" | "m" | "s" | "rows" | "text" }) {
  return <dl class="kv" data-size={size}>{items.map(i => <div key={i.k}>
    <dt>{i.k}{size === "rows" && i.sub && <span class="label">{i.sub}</span>}</dt>
    <dd class={i.txt ? "txt" : "num"}><b>{i.v}</b>{i.u && <span class="kv-u"> {i.u}</span>}{size !== "rows" && i.sub && <span class="kv-sub">{i.sub}</span>}</dd>
  </div>)}</dl>;
}

/** A difference B − A: the signed text and a bar from the centre; better is accent, worse is grey, never red/green.
 *  better: −1 lower is better, 1 higher is better, 0 neutral; scale: the difference that fills half the bar. */
export function Delta({ d, text, better, scale }: { d: number | null; text: string; better: -1 | 0 | 1; scale: number }) {
  if (d === null) return <span class="delta mute">—</span>;
  const good = better !== 0 && d * better > 0, w = scale ? Math.min(50, (Math.abs(d) / scale) * 50) : 0;
  return <span class="delta"><span class={good ? "gd" : undefined}>{text}</span>
    <i class="delta-bar" aria-hidden="true">{better !== 0 && w >= 2 && <i class={good ? "up" : "dn"} style={`${d < 0 ? "right" : "left"}:50%;width:${w.toFixed(0)}%`} />}</i></span>;
}

/** A table: columns with an optional numeric flag (right-aligned, tabular). */
export interface Col<R> { key: string; title: string; num?: boolean; cell: (r: R) => ComponentChildren }
export function Table<R>({ cols, rows, caption, rowKey }: { cols: Col<R>[]; rows: R[]; caption?: string; rowKey: (r: R) => string }) {
  return (
    <div class="tbl-wrap">
      <table class="tbl">
        {caption && <caption class="label">{caption}</caption>}
        <thead><tr>{cols.map(c => <th key={c.key} class={c.num ? "n" : undefined} scope="col">{c.title}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={rowKey(r)}>{cols.map(c => <td key={c.key} class={c.num ? "n num" : undefined}>{c.cell(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A labelled input with an optional hint or error. */
export function Field({ label, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <div class="field">
      <label for={id} class="label">{label}</label>
      <input id={id} class="num" aria-invalid={error ? true : undefined} aria-describedby={hint || error ? id + "-h" : undefined} {...input} />
      {(hint || error) && <div id={id + "-h"} class={error ? "field-h err" : "field-h"}>{error ?? hint}</div>}
    </div>
  );
}

/** «Як це пораховано»: a closed block with the method behind a number. */
export function Details({ summary, children }: { summary: string; children: ComponentChildren }) {
  return <details class="how"><summary>{summary}</summary><div class="how-b">{children}</div></details>;
}

/** One line of state: a pill with the verdict, then the words. */
export function StatusLine({ tone = "ink", tag, children }: { tone?: "ink" | "acc" | "line" | "err"; tag?: string; children: ComponentChildren }) {
  return <p class="status" role="status">{tag && <Pill tone={tone}>{tag}</Pill>}<span>{children}</span></p>;
}
/** Nothing to show yet, and what will fill it. */
export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="empty">{children}</div>;
}
