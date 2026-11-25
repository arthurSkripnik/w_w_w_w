// «Бос і перки»: the race as a boss (goal, forecast now, forecast on race day, readiness) and the achievements.
import type { Widget } from "../types";
import { Meter, KV } from "../../ui";
import { bossNow, perkList } from "../../store/character";
import { daysBetween } from "../../domain/util";
import { today } from "../../store/derived";
import { mmss, plural } from "../../domain/home";

function Boss() {
  const b = bossNow.value, P = perkList.value; if (!b && !P.length) return null;
  const left = b ? daysBetween(today.value, b.race) : null, open = P.filter(p => p.ok).length;
  return <div class="ch-boss">
    {b && <section>
      <p class="label">{b.name} · {left != null && left >= 0 ? `${left} ${plural(left, "день", "дні", "днів")} до бою` : "бій відбувся"}</p>
      <KV size="m" items={[{ k: "Сила боса", v: mmss(b.goal10) }, { k: "Твій удар зараз", v: mmss(b.t10) }, { k: "На старті, прогноз", v: b.atRace ? "≈" + mmss(b.atRace) : "—" }]} />
      <Meter label="Готовність" value={b.ready} tone="acc" text={`${b.ready}%`}
        sub={b.gap > 0 ? `Босу лишається ${Math.round(b.gap)} с: на стільки прогноз на 10 км повільніший за ціль.` : `Прогноз уже швидший за ціль на ${Math.round(-b.gap)} с.`} />
    </section>}
    <section>
      <p class="label">Перки · відкрито {open}/{P.length}</p>
      <ul class="ch-perks">{P.map(p => <li key={p.n} data-ok={p.ok ? "" : undefined}><span class="ch-pi num" aria-hidden="true">{p.ic}</span><b>{p.n}</b><span class="label">{p.ok ? "" : "Закрито · "}{p.s}</span></li>)}</ul>
    </section>
  </div>;
}
export const bossW: Widget = { id: "boss", title: "Бос і перки", span: 6, Full: Boss, fullSpan: 6 };
