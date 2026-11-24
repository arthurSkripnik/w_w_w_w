// База тренувань: what every session is, the plan by weeks and levels, the coefficients, strength and theory.
// Everything is computed from the plan and today's zones, so it follows each change of threshold, level or day.
import { Card, Empty, Grid, Details, Pill } from "../ui";
import { dbState, athlete } from "../store/data";
import { days, zones, today, goal } from "../store/derived";
import { cmpGroups, pickGroup } from "../store/compare";
import { go } from "../app/routes";
import { typeRows, inPlanTxt, weekRows, changed, coefs, gymRows, GYM_NOTES, RULES, THEORY, boldParts, dec, type TypeRow } from "../domain/library";
import { groupOf } from "../domain/compare";
import { dur } from "../domain/spec";
import { racePlan, fmtHM, shapeOf } from "../domain/text";
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
function TypeCard({ r, cmpK }: { r: TypeRow; cmpK: string | null }) {
  const s = r.steps, lv = r.fixed ? 0 : r.lvl, sh = shapeOf(r.t, lv);
  return <article class="lib-card" aria-label={r.name}>
    <header class="lib-card-h"><span class="label"><i class="mk" data-cat={r.cat} />{r.abbr}</span>{r.next && <span class="label num">наступне {dm(r.next)}</span>}</header>
    <h3 class="lib-card-n">{r.name}</h3>
    <span class="shape lib-shape" aria-hidden="true">{sh.map(([m, k], i) => <i key={i} data-k={k} style={{ flexGrow: m }} />)}</span>
    <dl class="lib-card-kv">
      <div><dt class="label">Темп</dt><dd>{r.pace ? <><b>{r.pace.zone}</b><span class="num">{r.pace.pace}</span></> : <b>За зусиллям</b>}</dd></div>
      <div><dt class="label">Тривалість</dt><dd class="num"><b>{r.mins}</b></dd></div>
      <div><dt class="label">У плані</dt><dd class="num"><b>{inPlanTxt(r)}</b></dd></div>
      <div><dt class="label">Навантаження</dt><dd class="num"><b>×{dec(r.load)}</b><span>RPE {r.rpe[0]}–{r.rpe[1]}</span></dd></div>
    </dl>
    <Details summary={`Як бігти${r.fixed ? "" : ` · Р${r.lvl}`}`}>
      {s.warmup && <p><span class="label">Розминка</span> {s.warmup}</p>}
      <p>{s.main}</p>
      {s.cooldown && <p><span class="label">Заминка</span> {s.cooldown}</p>}
      <p class="label">{s.note}{r.eq ? ` У прогноз: ${r.eq}.` : ""}</p>
    </Details>
    {cmpK && <button type="button" class="lib-cmp" onClick={() => { pickGroup(cmpK); go("compare"); }}>Порівняти: {r.done} {plural(r.done, "пробіжка", "пробіжки", "пробіжок")}</button>}
  </article>;
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
  const Z = zones.value!, W = weekRows(days.value, Z, today.value), t = today.value;
  const total = W.reduce((a, w) => a + w.min, 0);
  let ph = "", pi = 0;
  return <Card n="05" title="Рівні по тижнях" span={12} aside={<span class="label num">{W.length} тижнів · разом {fmtHM(total)} год</span>}>
    <div class="tbl-wrap"><table class="tbl lib-w">
      <thead><tr><th scope="col">Тиждень</th>{DOW.map(d => <th key={d} scope="col">{d}</th>)}<th scope="col" class="n">Разом</th></tr></thead>
      <tbody>{W.flatMap(w => {
        const head = w.phase !== ph ? (ph = w.phase, pi++, [<tr key={`p${w.week}`} class="lib-ph"><td colSpan={9}><span class="num">{String(pi).padStart(2, "0")}</span> {PH_NAME[w.phase] ?? w.phase}</td></tr>]) : [];
        return [...head, <tr key={w.week} data-now={w.now ? "" : undefined}>
          <td class="lib-wk"><b class="num">{String(w.week).padStart(2, "0")}</b>{w.now && <Pill tone="acc">зараз</Pill>}<span class="label num">{dm(w.mon)}–{dm(w.sun)}</span></td>
          {w.cells.map(c => { const d = c.day; if (!d) return <td key={c.date} class="lib-rest label">—</td>;
            const T = typeOf(d.type), fixed = d.type === "race" || d.type === "tt5k" || d.type === "start" || d.type === "pyramid", lv = Math.max(1, d.level);
            return <td key={c.date}><button type="button" class="lib-day" data-past={c.date < t ? "" : undefined} onClick={() => go("calendar", c.date)}
              aria-label={`${dm(c.date)}: ${d.workout?.name ?? T.name}, ${dur(d.type, fixed ? 0 : lv)} хв`}>
              <span><i class="mk" data-cat={T.cat} />{T.abbr}{changed(d) && <i class="lib-chg">*</i>}</span>
              <span class="label num">{fixed ? "" : `Р${lv} · `}{dur(d.type, fixed ? 0 : lv)}′</span></button></td>; })}
          <td class="n num"><b>{fmtHM(w.min)}</b><span class="label">≈{Math.round(w.km)} км</span></td>
        </tr>];
      })}</tbody>
    </table></div>
    <p class="pf-note">У клітинці: тип, рівень Р і хвилини. <b>*</b> день змінено (перенесено, «Легше» чи «Довше», старт). Разом: хвилини тижня і грубі кілометри (хвилини ÷ середина легкого темпу, {fmtPace((Z.z1.fast + Z.z1.slow) / 2)} /км). Натисни день, щоб відкрити його в Календарі.</p>
  </Card>;
}

function Coefs() {
  const Z = zones.value!, g = goal.value, a = athlete.value;
  if (!g) return null;
  const C = coefs(Z, g.targetSec / g.km, a?.refRace ?? null, !!a?.hrZoneTops?.length);
  return <Card n="06" title="Коефіцієнти" span={6} aside={<span class="label num">поріг {fmtPace(Z.thrPace)} · пульс {Z.thrHR}</span>}>
    <dl class="lib-kv">{C.map(c => <div key={c.k}><dt>{c.k}<span class="label">{c.f}</span></dt><dd class="num"><b>{c.v}</b>{c.sm && <span class="label">{c.sm}</span>}</dd></div>)}</dl>
  </Card>;
}

function Rules() {
  return <Card n="07" title="Правила плану" span={6}>
    <dl class="lib-rules">
      {RULES.map(([k, v]) => <div key={k}><dt class="label">{k}</dt><dd>{v}</dd></div>)}
      <div><dt class="label">Очікуване RPE</dt><dd class="lib-rpe">{(Object.keys(RPE_TARGET) as (keyof typeof RPE_TARGET)[]).map(k => <span key={k}><i class="mk" data-cat={k} />{({ z1: "Легко", z2: "Помірно", z3: "Важко", race: "Гонка, старт" })[k]}: {RPE_TARGET[k][0]}–{RPE_TARGET[k][1]}</span>)}</dd></div>
      <div><dt class="label">Зони</dt><dd>Зони темпу й пульсу з частками від порогу дивись у <a href="#profile/zones">Профілі</a>.</dd></div>
    </dl>
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
