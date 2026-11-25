// «Характеристики»: five stats 1–99 over 28 days, each with the number it is made of and a link to that widget.
import type { Widget } from "../types";
import { Meter } from "../../ui";
import { char } from "../../store/character";
import { STATS } from "../../domain/character";

function Stats() {
  const c = char.value; if (!c) return null;
  return <div class="ch-stats">
    {STATS.map(s => <Meter key={s.k} label={<abbr title={s.name}>{s.code}</abbr>} value={c.S[s.k]} text={c.S[s.k] == null ? "—" : String(c.S[s.k])} weak={s.k === c.weak}
      mark={s.k === "spd" ? c.spdGoal : null} sub={<>{s.name}: {c.src[s.k]} · <a href={s.from.href}>{s.from.label}</a></>} />)}
    <p class="pf-note">За останні 28 днів, від 1 до 99. Помаранчева риска на швидкості: рівень цілі. Клас визначають дві найсильніші з перших чотирьох; дисципліна це риса, а не тіло.</p>
  </div>;
}
export const statsW: Widget = { id: "stats", title: "Характеристики", span: 6, Full: Stats, fullSpan: 6 };
