// One card for a session everywhere it appears: S = calendar grid cell and the Головна week, M = calendar list row,
// L = the template card of База тренувань. Same anatomy in every size: effort mark and short name (with the level),
// the name, the shape strip of the session at its level, then the numbers; L adds its own body below.
import type { ComponentChildren } from "preact";
import { typeOf } from "../domain/types";
import { shapeOf } from "../domain/text";
import { FIXED_T } from "../domain/spec";

export type WcSize = "S" | "M" | "L";
export const lvlOf = (type: string, level: number) => (FIXED_T.includes(type) ? null : Math.max(1, level));

export function Shape({ type, level }: { type: string; level: number }) {
  return <span class="shape" aria-hidden="true">{shapeOf(type, lvlOf(type, level) ?? 0).map(([m, k], i) => <i key={i} data-k={k} style={{ flexGrow: m }} />)}</span>;
}

interface Props {
  size: WcSize; type: string; level: number; name: string;
  st?: "plan" | "done" | "miss"; changed?: boolean; past?: boolean; today?: boolean; pressed?: boolean;
  head?: string;                       // a date line above (calendar list, Головна week)
  aside?: ComponentChildren;           // top right: ✓, the next date
  bottom?: ComponentChildren;          // the numbers line
  label?: string; onClick?: () => void;
  children?: ComponentChildren;        // L: the body
}
export function WorkoutCard({ size, type, level, name, st = "plan", changed, past, today, pressed, head, aside, bottom, label, onClick, children }: Props) {
  const t = typeOf(type), lv = lvlOf(type, level);
  const inner = <>
    {head && <span class="cell-h label">{head}</span>}
    <span class="cell-top">
      <i class="mk" data-cat={t.cat} />
      {size === "L" ? <span class="wc-tag label">{t.abbr}{lv && ` · Р${lv}`}</span> : <><span class="cell-n">{name}{changed && <sup class="chg">*</sup>}</span><span class="cell-a">{t.abbr}{changed && "*"}</span></>}
      {aside}
    </span>
    {size === "L" && <h3 class="wc-name">{name}</h3>}
    <Shape type={type} level={level} />
    {bottom && <span class="cell-b num">{bottom}</span>}
    {children}
  </>;
  const attrs = { class: "cell", "data-size": size, "data-cat": t.cat, "data-st": st, "data-past": past ? "" : undefined, "data-today": today ? "" : undefined, "aria-label": label };
  return onClick
    ? <button type="button" {...attrs} aria-current={today ? "date" : undefined} aria-pressed={pressed} onClick={onClick}>{inner}</button>
    : <article {...attrs}>{inner}</article>;
}
