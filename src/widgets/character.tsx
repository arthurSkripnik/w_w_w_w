// «Персонаж»: the runner as an RPG character. Compact: figure, class, level, HP (from the form %) and XP (km since
// the plan began). Full: the same with callouts, mood, character and what to train. Read-only, never changes the plan.
import type { Widget } from "./types";
import { Meter, KV } from "../ui";
import { Runner } from "./Runner";
import { char } from "../store/character";
import { STATS } from "../domain/character";
import { nextDay, today } from "../store/derived";
import { typeOf } from "../domain/types";
import { dm } from "../domain/home";

const weakOf = (c: NonNullable<typeof char.value>) => STATS.find(s => s.k === c.weak) ?? null;
function Bars({ c }: { c: NonNullable<typeof char.value> }) {
  return <>
    <Meter label="HP" value={c.hp} tone={c.hp < 25 ? "acc" : "ink"} text={`${c.hp}/100`} sub={`Форма ${Math.round(c.formR)}%: ${c.mood.name.toLowerCase()}`} />
    <Meter label="XP" value={c.xpPct} text={`${Math.round(c.lvlTo - c.km)} км до ${c.lvl + 1}`} sub={`${Math.round(c.km)} км з початку плану`} />
  </>;
}
function Head({ c }: { c: NonNullable<typeof char.value> }) {
  return <div class="ch-head"><h3 class="ch-cls">{c.cls.name}</h3><span class="label num">Рівень {c.lvl} · {c.mood.name}</span></div>;
}
function Compact() {
  const c = char.value; if (!c) return null; const w = weakOf(c);
  return <div class="ch">
    <Runner c={c} callouts={false} />
    <div class="ch-side"><Head c={c} /><Bars c={c} />{w && <p class="label">Слабке місце: {w.name.toLowerCase()} {c.S[w.k]}</p>}</div>
  </div>;
}
function Full() {
  const c = char.value; if (!c) return null; const w = weakOf(c), n = nextDay.value;
  return <div class="ch ch-full">
    <Runner c={c} />
    <div class="ch-side">
      <Head c={c} /><p class="ch-desc">{c.cls.desc}</p><Bars c={c} />
      <KV size="text" items={[
        { k: "Стан", v: c.mood.line, txt: true },
        { k: "Характер", v: c.cls.beh, txt: true },
        ...(n ? [{ k: "Чекає на", v: `${(n.workout?.name ?? typeOf(n.type).name)}, ${n.date === today.value ? "сьогодні" : dm(n.date)}.`, txt: true }] : []),
        ...(w ? [{ k: "Слабке місце", v: `${w.name} (${c.S[w.k]}). Прокачується: ${w.tip}.`, txt: true }] : []),
      ]} />
    </div>
  </div>;
}
export const characterW: Widget = { id: "character", title: "Персонаж", span: 6, rows: 2, link: { label: "Профіль", href: "#profile" }, C: Compact, Full, fullSpan: 12 };
