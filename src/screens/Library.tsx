// База тренувань: what every session is, the plan by weeks and levels, the coefficients, strength and theory.
// Everything is computed from the plan and today's zones, so it follows each change of threshold, level or day.
import { Card, Empty, Grid, Details, Choice, KV } from "../ui";
import { dbState, athlete } from "../store/data";
import { days, zones, today, goal, dayByDate } from "../store/derived";
import { WeekLine, weekMin } from "../calendar/Week";
import type { Day } from "../domain/days";
import { cmpGroups, pickGroup } from "../store/compare";
import { go } from "../app/routes";
import { typeRows, inPlanTxt, easyMid, coefs, gymRows, GYM_NOTES, RULES, THEORY, boldParts, dec, type TypeRow } from "../domain/library";
import { groupOf } from "../domain/compare";
import { dur } from "../domain/spec";
import { racePlan, fmtHM, gen } from "../domain/text";
import { useState } from "preact/hooks";
import { WorkoutCard } from "../calendar/WorkoutCard";
import { typeOf, PH_NAME, CAT, RPE_TARGET } from "../domain/types";
import { dm, DOW, mmss, plural } from "../domain/home";
import { fmtPace } from "../domain/util";

const Rich = ({ s }: { s: string }) => <>{boldParts(s).map((p, i) => (p.b ? <b key={i}>{p.x}</b> : p.x))}</>;

const GROUPS: { cat: string; name: string; sub: string }[] = [
  { cat: "z1", name: "Легкі", sub: "Основа обсягу: більшість хвилин тижня" },
  { cat: "z2", name: "Помірні", sub: "Поріг і зміна темпу на втомлених ногах" },
  { cat: "z3", name: "Важкі", sub: "Ключові дні: VO2max, поріг, контрольні" },
  { cat: "race", name: "Старти", sub: "Гонка і старти на результат" },
];
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
function TypeCard({ r, cmpK }: { r: TypeRow; cmpK: string | null }) {
  const [lv, setLv] = useState(r.lvl), Z = zones.value!, cur = r.fixed ? 0 : lv, s = r.fixed ? r.steps : gen(r.t, lv, Z), m = dur(r.t, cur);
  return <WorkoutCard size="L" type={r.t} level={cur} name={r.name} label={r.name} aside={r.next && <span class="label num wc-next">наступне {dm(r.next)}</span>}>
    {!r.fixed && <Choice look="nums" label="Рівень" value={lv} onChange={setLv}
      options={LEVELS.map(l => ({ id: l, title: String(l), mark: r.levels.includes(l), hint: r.levels.includes(l) ? `Р${l} є в плані` : `Р${l} немає в плані` }))} />}
    <KV size="s" items={[
      { k: "Темп", v: r.pace ? r.pace.zone : "За зусиллям", sub: r.pace?.pace },
      { k: `Тривалість${r.fixed ? "" : ` на Р${lv}`}`, v: `${m} хв`, sub: `у плані ${r.mins}` },
      { k: "У плані", v: inPlanTxt(r) },
      { k: "Навантаження", v: `×${dec(r.load)}`, sub: `RPE ${r.rpe[0]}–${r.rpe[1]}` },
    ]} />
    <Details summary={`Як бігти${r.fixed ? "" : ` · Р${lv}`}`}>
      {s.warmup && <p><span class="label">Розминка</span> {s.warmup}</p>}
      <p>{s.main}</p>
      {s.cooldown && <p><span class="label">Заминка</span> {s.cooldown}</p>}
      <p class="label">{s.note}{r.eq ? ` У прогноз: ${r.eq}.` : ""}</p>
    </Details>
    {cmpK && <button type="button" class="lib-cmp" onClick={() => { pickGroup(cmpK); go("compare"); }}>Порівняти: {r.done} {plural(r.done, "пробіжка", "пробіжки", "пробіжок")}</button>}
  </WorkoutCard>;
}
function Types() {
  const Z = zones.value!, rows = typeRows(days.value, Z, today.value), G = cmpGroups.value;
  const cmp = (r: TypeRow) => { const g = groupOf(r.t); return r.done && g && G.some(x => x.k === g.k) ? g.k : null; };
  return <>{GROUPS.map((g, gi) => { const rs = rows.filter(r => r.cat === g.cat); if (!rs.length) return null;
    const n = rs.reduce((a, r) => a + r.n, 0);
    return <Card key={g.cat} n={String(gi + 1).padStart(2, "0")} title={g.name} span={12} aside={<span class="label num">{rs.length} {plural(rs.length, "тип", "типи", "типів")} · {n} у плані · RPE {RPE_TARGET[g.cat as keyof typeof RPE_TARGET].join("–")}</span>}>
      <p class="lib-sub">{g.sub}</p>
      <div class="lib-cards">{rs.map(r => <TypeCard key={r.t} r={r} cmpK={cmp(r)} />)}</div>
    </Card>; })}</>;
}

function Weeks() {
  const Z = zones.value!, D = days.value, by = dayByDate.value, t = today.value;
  const weeks: Record<number, Day[]> = {}; D.forEach(d => (weeks[d.plan.week] ||= []).push(d));
  const nums = Object.keys(weeks).map(Number).sort((a, b) => a - b), total = nums.reduce((a, n) => a + weekMin(weeks[n]), 0);
  const maxMin = Math.max(...nums.map(n => weekMin(weeks[n]))), mid = easyMid(Z) / 60;
  let ph = "";
  return <Card n="05" title="Рівні по тижнях" span={12} aside={<span class="label num">{nums.length} тижнів · разом {fmtHM(total)} год</span>}>
    <div class="cal-dow label" aria-hidden="true"><span />{DOW.map(d => <span key={d}>{d}</span>)}</div>
    {nums.flatMap(n => { const w = weeks[n], p = w[0].plan.phase;
      const bar = p !== ph ? (ph = p, [<div class="cal-phase label" key={"p" + n}>{PH_NAME[p] ?? p}</div>]) : [];
      return [...bar, <WeekLine key={n} n={n} w={w} by={by} today={t} maxMin={maxMin} easyMinPerKm={mid} plan />]; })}
    <p class="pf-note">Той самий тиждень, що в Календарі, але кожен день показано за планом: тип, хвилини і рівень Р. <b>*</b> день змінено (перенесено, «Легше» чи «Довше», старт). Кілометри грубі: хвилини ÷ середина легкого темпу, {fmtPace(easyMid(Z))} /км. Натисни день, щоб відкрити його в Календарі.</p>
  </Card>;
}

function Coefs() {
  const Z = zones.value!, g = goal.value, a = athlete.value;
  if (!g) return null;
  const C = coefs(Z, g.targetSec / g.km, a?.refRace ?? null, !!a?.hrZoneTops?.length);
  return <Card n="06" title="Коефіцієнти" span={6} aside={<span class="label num">поріг {fmtPace(Z.thrPace)} · пульс {Z.thrHR}</span>}>
    <KV size="rows" items={C.map(c => ({ k: c.k, sub: c.f, v: c.v, u: c.sm || undefined }))} />
  </Card>;
}

function Rules() {
  return <Card n="07" title="Правила плану" span={6}>
    <KV size="text" items={[
      ...RULES.map(([k, v]) => ({ k, v, txt: true })),
      { k: "Очікуване RPE", txt: true, v: <span class="lib-rpe">{(Object.keys(RPE_TARGET) as (keyof typeof RPE_TARGET)[]).map(k => <span key={k}><i class="mk" data-cat={k} />{({ z1: "Легко", z2: "Помірно", z3: "Важко", race: "Гонка, старт" })[k]}: {RPE_TARGET[k][0]}–{RPE_TARGET[k][1]}</span>)}</span> },
      { k: "Зони", txt: true, v: <>Зони темпу й пульсу з частками від порогу дивись у <a href="#profile/zones">Профілі</a>.</> },
    ]} />
  </Card>;
}

function Gym() {
  const G = gymRows(days.value, today.value);
  if (!G.length) return null;
  const n = G.reduce((a, g) => a + g.dates.length, 0);
  return <Card n="08" title="Сила" span={12} aside={<span class="label num">{n} {plural(n, "сесія", "сесії", "сесій")} у плані</span>}>
    <div class="lib-gym">
      {G.map(g => <section key={g.id}>
        <h3 class="card-title">{g.name}</h3>
        <p class="label num">≈{g.min} хв · {g.dates.length} у плані{g.next ? ` · наступне ${dm(g.next)}` : ""}</p>
        <ol class="steps">{g.ex.map((e, i) => <li key={i}><span class="label num">{e.dose}{e.w && <><br /><b>{e.w}</b></>}</span><span>{e.name}</span></li>)}</ol>
      </section>)}
    </div>
    <ul class="lib-notes">{[...(G[0].rules ?? []), ...GYM_NOTES].map(t => <li key={t}>{t}</li>)}</ul>
    <p class="pf-note">Вага показана на наступну сесію цього виду (або на останню, коли всі позаду). Сила стоїть у день важкого бігу і ніколи напередодні ключового тренування.</p>
  </Card>;
}

function Theory() {
  const Z = zones.value!, p = Z.race, at = (km: number) => mmss(p * km);
  return <Card n="09" title="Теорія" span={12}>
    {THEORY.map(([t, h], i) => <Details key={t} summary={`${String(i + 1).padStart(2, "0")} ${t}`}>
      {h ? <p><Rich s={h} /></p> : <>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Відрізок</th><th>Темп, /км</th><th>Що робити</th></tr></thead>
          <tbody>{racePlan(p).map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td class="num">{b}</td><td>{c}</td></tr>)}</tbody></table></div>
        <p>Ціль {at(10)}: рівний темп {fmtPace(p)} /км. Відмітки: 1 км {at(1)}, 3 км {at(3)}, <b>5 км {at(5)}</b>, 7 км {at(7)}, 10 км {at(10)}.</p>
      </>}
    </Details>)}
  </Card>;
}

export function Library() {
  const st = dbState.value;
  if (st === "loading") return <Empty>Читаю базу…</Empty>;
  if (st === "offline" || st === "error") return <Empty>База недоступна. Відкрий сторінку як артефакт у Claude.</Empty>;
  if (!zones.value || !days.value.length) return <Empty>Немає плану або порогу. Синхронізуй план на Головній.</Empty>;
  return <>
    <h1 class="hub-head">База тренувань. <i>Що означає кожне тренування, як план росте по тижнях і на яких числах тримається.</i></h1>
    <Grid><Types /><Weeks /><Coefs /><Rules /><Gym /><Theory /></Grid>
  </>;
}
