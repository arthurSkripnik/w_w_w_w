// Basic elements every screen is built from. Look and spacing live in styles/components.css.
import { Fragment, type ComponentChildren, type ButtonHTMLAttributes, type InputHTMLAttributes } from "preact";
import { useId, useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";

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
export function Choice<T extends string | number>({ label, options, value, onChange, look = "seg" }: { label: string; options: ChoiceOpt<T>[]; value: T; onChange: (v: T) => void; look?: "seg" | "chips" | "nums" | "scale" }) {
  const name = useId();
  return (
    <div class="seg" data-look={look} role="radiogroup" aria-label={label} style={look === "scale" ? { "--n": options.length } : undefined}>
      {options.map(o => (
        <label class="seg-o" key={String(o.id)} title={o.hint} data-mark={o.mark ? "" : undefined}>
          <input type="radio" name={name} value={String(o.id)} checked={o.id === value} onChange={() => onChange(o.id)} />
          <span>{o.title}{o.count != null && <span class="seg-c num">{o.count}</span>}</span>
        </label>
      ))}
    </div>
  );
}
/** look="scale" (step 18, after Holographik's self-evaluation): stops on a line, the chosen one a filled dot, words under
 *  the stops. For ordered answers (how it felt, legs, effort); same radios, same keyboard as every Choice. */
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

/** A labelled 0–100 bar: HP, XP, a stat, readiness. `mark` puts a tick (a goal) on the track, `weak` underlines the row. */
export function Meter({ label, value, text, mark, tone = "ink", weak, sub }: { label: ComponentChildren; value: number | null; text: string; mark?: number | null; tone?: "ink" | "acc"; weak?: boolean; sub?: ComponentChildren }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return <div class="meter" data-weak={weak ? "" : undefined}>
    <span class="meter-k">{label}</span>
    <span class="meter-t" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={text}>
      <i data-tone={tone} style={{ width: `${v}%` }} />{mark != null && <em style={{ left: `${mark}%` }} />}
    </span>
    <span class="meter-v num">{text}</span>
    {sub && <span class="meter-s">{sub}</span>}
  </div>;
}

/** A difference B − A: the signed text and a bar from the centre; better is accent, worse is grey, never red/green.
 *  better: −1 lower is better, 1 higher is better, 0 neutral; scale: the difference that fills half the bar. */
export function Delta({ d, text, better, scale }: { d: number | null; text: string; better: -1 | 0 | 1; scale: number }) {
  if (d === null) return <span class="delta mute">—</span>;
  const good = better !== 0 && d * better > 0, w = scale ? Math.min(50, (Math.abs(d) / scale) * 50) : 0;
  return <span class="delta"><span class={good ? "gd" : undefined}>{text}</span>
    <i class="delta-bar" aria-hidden="true">{better !== 0 && w >= 2 && <i class={good ? "up" : "dn"} style={`${d < 0 ? "right" : "left"}:50%;width:${w.toFixed(0)}%`} />}</i></span>;
}

/** A table: columns with an optional numeric flag (right-aligned, tabular). One look for every table (v2 step 16,
 *  after studiesincounting.com): small-caps head over an ink rule, serif rows on hairlines, the marked row inverted.
 *  `wide`: a secondary column, hidden on a phone so the table fits without scrolling.
 *  `group(r, prev)`: a heading row before r (a week, a phase), spanning every column; null for none.
 *  `hl(r)`: the one row to point at (today), drawn black. `onRow(r)`: the whole row opens r; give the row a button
 *  or link inside for the keyboard, the row only forwards clicks that miss it. */
export interface Col<R> { key: string; title: string; num?: boolean; wide?: boolean; cell: (r: R) => ComponentChildren }
export function Table<R>({ cols, rows, caption, rowKey, group, hl, onRow }: { cols: Col<R>[]; rows: R[]; caption?: string; rowKey: (r: R) => string;
  group?: (r: R, prev: R | null) => ComponentChildren | null; hl?: (r: R) => boolean; onRow?: (r: R) => void }) {
  const cls = (c: Col<R>, td?: boolean) => [c.num && "n", c.num && td && "num", c.wide && "wide"].filter(Boolean).join(" ") || undefined;
  const click = onRow && ((r: R) => (e: MouseEvent) => { if (!(e.target as Element).closest("a,button,input,select,label")) onRow(r); });
  return (
    <div class="tbl-wrap">
      <table class="tbl" data-click={onRow ? "" : undefined}>
        {caption && <caption class="label">{caption}</caption>}
        <thead><tr>{cols.map(c => <th key={c.key} class={cls(c)} scope="col">{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => { const g = group?.(r, i ? rows[i - 1] : null);
          return <Fragment key={rowKey(r)}>
            {g != null && g !== false && <tr class="tbl-g"><th colSpan={cols.length} scope="colgroup">{g}</th></tr>}
            <tr data-hl={hl?.(r) ? "" : undefined} onClick={click?.(r)}>{cols.map(c => <td key={c.key} class={cls(c, true)}>{c.cell(r)}</td>)}</tr>
          </Fragment>; })}</tbody>
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
export function Details({ summary, open, children }: { summary: ComponentChildren; open?: boolean; children: ComponentChildren }) {
  return <details class="how" open={open}><summary>{summary}</summary><div class="how-b">{children}</div></details>;
}
/** «?»: an explanation that stays hidden until asked for. Put it at the end of a header; the text opens under it. */
export function Hint({ label = "Пояснення", children }: { label?: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false), id = useId();
  return <span class="hint">
    <button type="button" class="hint-b" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={() => setOpen(!open)}>?</button>
    <span id={id} class="hint-t label" role="note" hidden={!open}>{children}</span>
  </span>;
}

/** One line of state: a pill with the verdict, then the words. */
export function StatusLine({ tone = "ink", tag, children }: { tone?: "ink" | "acc" | "line" | "err"; tag?: string; children: ComponentChildren }) {
  return <p class="status" role="status">{tag && <Pill tone={tone}>{tag}</Pill>}<span>{children}</span></p>;
}
/** Nothing to show yet, and what will fill it. */
export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="empty">{children}</div>;
}

/** A window over the page (day card, journal after a run). It sits outside the app and makes the page under it inert,
 *  so Tab and a screen reader stay inside; Esc and a backdrop click close it; focus moves in and comes back (to
 *  `returnTo()` when given, else to what had it); the page does not scroll. Full screen on a phone. `wide`: day card. */
export function Modal({ label, onClose, wide, returnTo, children }: { label: string; onClose: () => void; wide?: boolean; returnTo?: () => HTMLElement | null; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose), back = useRef(returnTo);
  close.current = onClose; back.current = returnTo;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null, ov = document.body.style.overflow, app = document.getElementById("app");
    ref.current?.focus(); document.body.style.overflow = "hidden"; app?.setAttribute("inert", "");
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close.current(); } };
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("keydown", esc); document.body.style.overflow = ov; app?.removeAttribute("inert");
      const to = back.current?.() ?? prev; to?.focus?.({ preventScroll: false });
    };
  }, []);
  return createPortal(<div class="modal-back" onClick={e => { if (e.target === e.currentTarget) close.current(); }}>
    <div class={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>{children}</div>
  </div>, document.body);
}

export { Dot, DotRow, DotMatrix, Beads, Dial, Ramp, type DotItem, type DotState, type BeadCol } from "./dots";

/** A date as Nothing writes it: «чт (26) (лис) 07:30». The day sits in a pill, filled for today; the month in an outline. */
const MON = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const DOW_S = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
const MON_FULL = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
export function DateTag({ iso, time, today, size = "m" }: { iso: string; time?: string; today?: boolean; size?: "m" | "l" }) {
  const d = new Date(iso + "T00:00:00"), n = d.getDate(), m = d.getMonth();
  return <span class="dtag" data-size={size}>
    <span class="vh">{`${today ? "Сьогодні, " : ""}${n} ${MON_FULL[m]}${time ? `, ${time}` : ""}`}</span>
    <span aria-hidden="true">{DOW_S[d.getDay()]}</span><b aria-hidden="true" class="dtag-d" data-today={today ? "" : undefined}>{n}</b>
    <span aria-hidden="true" class="dtag-m">{MON[m]}</span>{time && <span aria-hidden="true" class="dtag-t">{time}</span>}
  </span>;
}

/** One big number across the width, in brackets (komma): «[ 45 днів ]» with two small notes between. For the
 *  count to the race on Головна; `unit` is the word after the number, `notes` sit small beside it. */
export function BigCount({ value, unit, notes = [], label }: { value: number | string; unit: string; notes?: ComponentChildren[]; label: string }) {
  return <div class="bigc" role="group" aria-label={label}>
    <span class="bigc-b" aria-hidden="true">[</span>
    <b class="bigc-n num">{value}</b>
    <span class="bigc-u">{unit}</span>
    {notes.length > 0 && <span class="bigc-notes label">{notes.map((n, i) => <span key={i}>[{n}]</span>)}</span>}
    <span class="bigc-b" aria-hidden="true">]</span>
  </div>;
}
