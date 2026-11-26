import { useMemo, useState } from "preact/hooks";
import { Grid, Card, Stat, Pill, Button, Segmented, Table, Field, Details, StatusLine, Empty, Choice, KV, Delta, Meter, Modal, Hint, DateTag, DotMatrix, Beads, Dial, Ramp, type DotItem, type BeadCol } from "../ui";
import { WorkoutCard, TypeTag } from "../calendar/WorkoutCard";
import { DayCell } from "../calendar/DayCell";
import { JournalForm } from "../calendar/JournalForm";
import { Week, WeekLine, weekMin } from "../calendar/Week";
import { dayState, DOW } from "../domain/home";
import { FIXED_T } from "../domain/spec";
import { Chart } from "../ui/Chart";
import { getTheme, setTheme, type Theme } from "../ui/theme";
import type { Pt } from "../ui/chart";
import { days, form, aerobic, zones, today, dayByDate } from "../store/derived";
import { runs, dbState } from "../store/data";
import { FATIGUE } from "../domain/load";
import { fmtPace, mondayOf, addDays } from "../domain/util";
import { ZONE_NAME } from "../data/schema";
import { StoreCheck } from "./StoreCheck";
import { DataCheck } from "./DataCheck";
import type { Day } from "../domain/days";
import { typeOf } from "../domain/types";
import { FEEL, LEGS } from "../domain/journal";
import { dur } from "../domain/spec";

// Step 4 sample page: every basic element and chart on real data, for checking the look before screens are built.
const D = (iso: string) => new Date(iso + "T00:00:00");
const dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);
const pace = (v: number) => fmtPace(v);
const accTone = (s: number): "ink" | "line" | "err" => (s >= 90 ? "ink" : s >= 50 ? "line" : "err");


// Step 17: the plan as dots (a row per week), weekly km as beads, form as a dial.
function DotsDemo() {
  const all = days.value, t = today.value, by = dayByDate.value, Z = zones.value, F = form.value, R = runs.value;
  if (!all.length) return null;
  const maxMin = Math.max(...all.map(d => dur(d.type, Math.max(1, d.level)) ?? 0), 1);
  const mons = [...new Set(all.map(d => mondayOf(d.date)))].sort();
  const item = (iso: string): DotItem => { const d = by[iso], today_ = iso === t;
    if (!d) return { state: "rest", label: `${dm(iso)}: відпочинок`, today: today_ };
    const st = dayState(d), m = dur(d.type, Math.max(1, d.level)) ?? 0, hard = ["z3", "race"].includes(typeOf(d.type).cat);
    const name = d.workout?.name ?? typeOf(d.type).name;
    return { state: st === "done" ? "done" : st === "miss" ? "miss" : "plan", hard, v: m / maxMin, today: today_,
      label: `${dm(iso)}: ${name}, ${st === "done" ? "виконано" : st === "miss" ? "пропущено" : `план ≈${m} хв`}` }; };
  const rows = mons.map(m => Array.from({ length: 7 }, (_, i) => item(addDays(m, i))));
  const easy = Z ? (Z.z1.fast + Z.z1.slow) / 2 / 60 : null;
  const i0 = Math.max(0, mons.findIndex(m => m === mondayOf(t)) - 5), sel = mons.slice(i0, i0 + 8);
  const cols: BeadCol[] = sel.map(m => { const w = all.filter(d => d.date >= m && d.date <= addDays(m, 6));
    const done = Object.values(R).filter(r => r.date >= m && r.date <= addDays(m, 6) && r.date <= t).reduce((a, r) => a + r.km, 0);
    return { label: dm(m).slice(0, 5), done, plan: easy ? weekMin(w) / easy : undefined, key: w.some(d => d.type === "race"), now: m === mondayOf(t) }; });
  const r = F?.now ? Math.round(F.now.r) : null;
  return <>
    <section><h3 class="label">Сірі тони 01–05 (токени --g1…--g5; line, hair, chip, mute вказують на них)</h3><Ramp /></section>
    <section><h3 class="label">Точки: план до старту (рядок = тиждень; залита = виконано, контур = план, помаранчева = поріг або старт, × = пропуск, розмір = хвилини)</h3>
      <div class="kit-dots"><DotMatrix rows={rows} heads={DOW} rowLabels={mons.map((_, i) => String(i + 1).padStart(2, "0"))} label={`План по тижнях: ${rows.length} тижнів, точка на день`} /></div></section>
    <section><h3 class="label">Кульки: км по тижнях (кулька = 5 км; суцільна нитка = факт, пунктир = план)</h3>
      <div class="kit-dots"><Beads cols={cols} per={5} unit="км" label="Км по тижнях" /></div></section>
    <section><h3 class="label">Прилад: форма (поділки = 0–200%, довгі = межі зон)</h3>
      <div class="kit-dots"><Dial value={r} min={0} max={200} bands={FATIGUE.map(z => z.lo).filter(x => x > 0)} text={r != null ? `${r}%` : "—"} sub={F?.zone?.name} label="Форма: втома 7 днів до звичного за 6 тижнів" />
        <Dial value={84} text="84%" sub="Готовність" mark={90} label="Готовність, приклад" size={120} /></div></section>
  </>;
}

function Parts() {
  const all = days.value, t = today.value, by = dayByDate.value;
  const [feel, setFeel] = useState<string>("нормально"), [legs, setLegs] = useState<string>("трохи важкі");
  const [lv, setLv] = useState(4), [chip, setChip] = useState("fartlek"), [seg, setSeg] = useState<"run" | "avg">("run"), [win, setWin] = useState(false);
  if (!all.length) return null;
  const done = [...all].reverse().find(d => d.date < t && dayState(d) === "done"), miss = [...all].reverse().find(d => dayState(d) === "miss"), plan = all.find(d => d.date > t && !FIXED_T.includes(d.type));
  const sample = [done, miss, plan].filter(Boolean) as Day[];
  const mon = mondayOf(t), wk = all.filter(d => d.date >= mon && d.date <= addDays(mon, 6));
  return <Card n="12" title="Компоненти" span={12} aside={<span class="label">один компонент на сутність, усі розміри й стани</span>}>
    <div class="kit-parts">
      <DotsDemo />
      <section><h3 class="label">Картка тренування · S (календар, тиждень на Головній)</h3>
        <div class="kit-row">{sample.map(d => <div key={d.date} class="kit-s"><DayCell day={d} iso={d.date} today={t} /></div>)}</div></section>
      <section><h3 class="label">Картка тренування · M (список календаря, Порівняння)</h3>
        <div class="kit-col">{sample.map((d, i) => <DayCell key={d.date} size="M" day={d} iso={d.date} today={t} head={dm(d.date)} pick={i === 0 ? "b" : i === 1 ? "a" : undefined} onPick={() => {}} />)}</div></section>
      <section><h3 class="label">Картка тренування · L (База тренувань, картка дня, «Сьогодні»)</h3>
        <div class="kit-row">{plan && <WorkoutCard size="L" type={plan.type} level={plan.level} name={plan.workout?.name ?? plan.type} aside={<Pill tone="line">план</Pill>}>
          <KV size="s" items={[{ k: "Тривалість", v: "45 хв", sub: "у плані 40–55" }, { k: "Навантаження", v: "×1,4", sub: "RPE 7–8" }]} /></WorkoutCard>}</div></section>
      <section><h3 class="label">Тиждень (Календар, Головна, База)</h3>
        <div class="cal-dow label" aria-hidden="true"><span />{DOW.map(d => <span key={d}>{d}</span>)}</div>
        {wk.length > 0 && <WeekLine n={wk[0].plan.week} w={wk} by={by} today={t} maxMin={weekMin(wk)} easyMinPerKm={null} />}</section>
      <section><h3 class="label">Тиждень з датами (віджет «Цей тиждень» на Головній)</h3>
        <div class="wk"><Week mon={mon} by={by} today={t} heads /></div></section>
      <section><h3 class="label">Позначка типу</h3>
        <div class="btn-row">{["base", "long", "fartlek", "fastfinish", "shortint", "longint", "race"].map(x => <TypeTag key={x} type={x} level={x === "race" ? null : 3} />)}</div></section>
      <section><h3 class="label">Вибір · seg, chips, nums</h3>
        <div class="kit-col">
          <Choice label="Режим" value={seg} onChange={setSeg} options={[{ id: "run", title: "З пробіжкою" }, { id: "avg", title: "Із середнім" }]} />
          <Choice look="chips" label="Тип" value={chip} onChange={setChip} options={[{ id: "easy", title: "Легкі", count: 24 }, { id: "fartlek", title: "Фартлек", count: 6 }, { id: "long", title: "Довгі", count: 8 }]} />
          <Choice look="nums" label="Рівень" value={lv} onChange={setLv} options={Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: String(i + 1), mark: i >= 2 && i <= 5 }))} />
        </div></section>
      <section><h3 class="label">Шкала · Choice look="scale" (журнал: самопочуття, ноги)</h3>
        <div class="kit-col">
          <Choice look="scale" label="Самопочуття під час бігу" value={feel} onChange={setFeel} options={FEEL.map(f => ({ id: f, title: f }))} />
          <Choice look="scale" label="Ноги" value={legs} onChange={setLegs} options={LEGS.map(f => ({ id: f, title: f }))} />
        </div></section>
      <section><h3 class="label">Дата · DateTag (шапка вікна дня, Головна; сьогодні залите)</h3>
        <div class="kit-col"><div class="btn-row"><DateTag iso={t} today time="07:30" /><DateTag iso={addDays(t, 1)} /><DateTag iso="2027-01-10" time="09:00" /></div>
          <DateTag iso={t} today size="l" /></div></section>
      <section><h3 class="label">Назва і значення · l, m, s, rows, text</h3>
        <div class="kit-col">
          <KV size="l" items={[{ k: "Тривалість", v: "52 хв", sub: "З розминкою і заминкою" }, { k: "Темп", v: "4:05–4:15", sub: "пороговий" }]} />
          <KV size="m" items={[{ k: "Дистанція", v: "10.20", u: "км" }, { k: "Час", v: "46:10" }, { k: "Темп", v: "4:31", u: "/км" }, { k: "Пульс", v: "148", u: "уд/хв" }]} />
          <KV size="s" items={[{ k: "Темп", v: "Легкий", sub: "5:05–5:35" }, { k: "У плані", v: "12 разів" }]} />
          <KV size="rows" items={[{ k: "Поріг", sub: "з годинника", v: "3:40", u: "/км" }, { k: "10 км", sub: "поріг × 1,03", v: "37:50" }]} />
          <KV size="text" items={[{ k: "Правило", v: "Не більше двох важких днів на тиждень.", txt: true }]} />
        </div></section>
      {done && <section><h3 class="label">Форма журналу (попап після пробіжки, картка дня, «Сьогодні»)</h3>
        <div class="kit-col"><JournalForm day={done} compact /></div></section>}
      <section><h3 class="label">Пояснення «?» (картка дня: рівень, спліти, заміна, перенесення)</h3>
        <div class="kit-col">
          <div class="kit-hint"><span class="label">Спліти по км</span><Hint>Перші км повільніші: тіло розігрівається.</Hint></div>
          <div class="kit-hint"><Choice label="Тривалість" value={seg} onChange={setSeg} options={[{ id: "run", title: "Легше · 40 хв" }, { id: "avg", title: "Як у плані · 52 хв" }]} />
            <Hint>Мало сил чи часу? «Легше» дає менше хвилин і повторів, а темп той самий.</Hint></div>
        </div></section>
      <section><h3 class="label">Вікно (картка дня в Календарі, журнал після пробіжки)</h3>
        <div class="kit-col"><Button variant="ghost" onClick={() => setWin(true)}>Відкрити вікно</Button>
          {win && <Modal label="Зразок вікна" onClose={() => setWin(false)}><p>Esc, клік по тлу або кнопка закривають вікно.</p><Button onClick={() => setWin(false)}>Закрити</Button></Modal>}</div></section>
      <section><h3 class="label">Шкала (Персонаж, Бос, Характеристики)</h3>
        <div class="kit-col"><Meter label="HP" value={81} text="81/100" sub="Форма 90%: свіжий" /><Meter label="ШВД" value={73} mark={75} text="73" sub="Прогноз 10 км 35:34" />
          <Meter label="ВИТ" value={56} text="56" weak sub="Слабке місце" /><Meter label="Готовність" value={84} tone="acc" text="84%" /></div></section>
      <section><h3 class="label">Різниця</h3>
        <div class="btn-row"><Delta d={-6} text="−0:06" better={-1} scale={10} /><Delta d={4} text="+4" better={-1} scale={10} /><Delta d={0.3} text="+0.3" better={0} scale={1} /><Delta d={null} text="" better={1} scale={1} /></div></section>
    </div>
  </Card>;
}

export function Kit() {
  const [theme, setT] = useState<Theme>(getTheme());
  const [range, setRange] = useState<"plan" | "all">("plan");
  const [thr, setThr] = useState("3:40");
  const F = form.value, A = aerobic.value, Z = zones.value, t = today.value, all = days.value;
  const start = all[0]?.date ?? t;

  const formSpec = useMemo(() => {
    if (!F) return null;
    const from = range === "plan" ? addDays(start, -28) : F.days[0].d;
    const past = F.days.filter(x => !x.plan && x.d >= from), fut = F.days.filter(x => x.plan);
    const wk = fut.map((x, i, a) => { const w = a.slice(Math.max(0, i - 3), i + 4); return { x: D(x.d), y: w.reduce((s, y) => s + y.r, 0) / w.length }; });
    if (wk.length) wk[wk.length - 1] = { x: D(F.end.d), y: F.end.r };
    const hi = Math.max(180, Math.ceil(Math.max(...F.days.map(x => x.r)) / 20) * 20);
    return { kind: "line" as const, y: { fmt: (v: number) => `${Math.round(v)}%`, domain: [0, hi] as [number, number] }, today: D(t),
      data: past.map(x => ({ x: D(x.d), y: x.r, tip: `${dm(x.d)} · ${Math.round(x.r)}% · 7 днів ${Math.round(x.atl)}, 6 тижнів ${Math.round(x.ctl)}` })),
      plan: wk, bands: FATIGUE.map((f, i) => ({ lo: f.lo, hi: i ? FATIGUE[i - 1].lo : hi, label: f.name, strong: f.lo === 100 })) };
  }, [F, range, start, t]);

  const aerSpec = useMemo(() => A.roll.length < 2 ? null : ({
    kind: "line" as const, y: { fmt: pace, reverse: true }, today: D(t),
    data: A.roll.map(p => ({ x: D(p.d), y: p.v, tip: `${dm(p.d)} · тренд ${pace(p.v)} /км` })),
    dots: A.pts.map(p => ({ x: D(p.d), y: p.norm, soft: p.long || p.hard, tip: `${dm(p.d)} · ${pace(p.pace)} при ${p.hr} → ${pace(p.norm)} /км${p.long ? " · довга" : p.hard ? " · після важкого дня" : ""}` })),
  }), [A, t]);

  const weekSpec = useMemo(() => {
    const W: Record<string, number> = {};
    Object.values(runs.value).forEach(r => { if (range === "plan" && r.date < start) return; const m = mondayOf(r.date); W[m] = (W[m] ?? 0) + r.km; });
    const data: Pt[] = Object.keys(W).sort().filter(m => m <= t).map(m => ({ x: D(m), y: W[m], tip: `тиждень з ${dm(m)} · ${W[m].toFixed(1)} км` }));
    return data.length ? { kind: "bars" as const, data, y: { fmt: (v: number) => `${Math.round(v)}` } } : null;
  }, [runs.value, range, start, t]);

  const vo2Spec = useMemo(() => {
    if (!Z) return null;
    const pts = all.filter(d => ["shortint", "fartlek", "pyramid"].includes(d.act) && d.report?.work?.pace).map(d => ({
      x: D(d.date), y: d.report!.work.pace as number, key: d.act === "shortint", soft: d.act !== "shortint",
      tip: `${dm(d.date)} · ${d.workout?.name ?? d.act} · ${pace(d.report!.work.pace)} /км${d.report!.work.hr ? ` · пульс ${d.report!.work.hr}` : ""}` }));
    return pts.length ? { kind: "line" as const, data: [], end: false, dots: pts, y: { fmt: pace, reverse: true, domain: [Math.min(Z.z3.fast, ...pts.map(p => p.y)) - 8, Math.max(Z.z3.slow, ...pts.map(p => p.y)) + 8] as [number, number] }, today: D(t),
      x: [D(start), D(all[all.length - 1].date)] as [Date, Date], bands: [{ lo: Z.z3.fast, hi: Z.z3.slow, label: ZONE_NAME.z3, strong: true }], height: 180 } : null;
  }, [all, Z, t, start]);

  if (dbState.value === "loading") return <Empty>Читаю базу…</Empty>;
  const withHrz = [...all].reverse().find(d => d.run?.stream?.hrz);
  const hrz = withHrz?.run?.stream?.hrz;
  const hrSpec = hrz ? { kind: "hbars" as const, data: hrz.map((s, i) => ({ label: `Z${i + 1}`, v: s / 60 })), fmt: (v: number) => `${Math.round(v)} хв`, acc: hrz.indexOf(Math.max(...hrz)) } : null;

  const done = all.filter(d => d.acc);
  const avg = done.length ? Math.round(done.reduce((a, d) => a + d.acc!.score, 0) / done.length) : null;
  const spark = A.roll.slice(-10).map(p => ({ x: D(p.d), y: p.v }));
  const wkKm = Object.values(runs.value).filter(r => r.date >= mondayOf(t) && r.date <= t).reduce((a, r) => a + r.km, 0);

  return (
    <>
      <section class="screen-head">
        <span class="label">Крок 4 · елементи й графіки</span>
        <h1>Зразки</h1>
        <p>Усі базові елементи й графіки на твоїх даних. Екрани кроків 5–8 збиратимуться лише з них.</p>
      </section>
      <div class="kit-bar">
        <Segmented label="Тема" value={theme} onChange={v => { setT(v); setTheme(v); }} options={[{ id: "auto", title: "Як у Claude" }, { id: "light", title: "Світла" }, { id: "dark", title: "Темна" }]} />
        <Segmented label="Період" value={range} onChange={setRange} options={[{ id: "plan", title: "План" }, { id: "all", title: "Уся історія" }]} />
      </div>
      <Grid>
        <Card n="01" title="Форма" span={3}>
          {F?.now ? <Stat value={`${Math.round(F.now.r)}`} unit="%" caption={<><Pill>{F.zone!.name}</Pill> втома 7 днів до звичного за 6 тижнів</>} /> : <Empty>Ще немає</Empty>}
        </Card>
        <Card n="02" title="Аеробна база" span={3}>
          {spark.length > 1 ? <>
            <Stat value={pace(spark[spark.length - 1].y)} unit="/км" caption="на пульсі 145, тренд 14 днів" />
            <Chart label="Аеробна база за останні легкі пробіжки" spec={{ kind: "spark", data: spark, y: { reverse: true } }} />
          </> : <Empty>Потрібно 2 легкі пробіжки</Empty>}
        </Card>
        <Card n="03" title="Цей тиждень" span={3}>
          <Stat value={wkKm.toFixed(1)} unit="км" caption={`з понеділка ${dm(mondayOf(t))}`} />
        </Card>
        <Card n="04" title="Точність" span={3}>
          {avg != null ? <Stat value={`${avg}`} unit="%" acc caption={`середня за ${done.length} днів`} /> : <Empty>Ще немає</Empty>}
        </Card>

        <Card n="05" title="Втома і форма" span={12} aside={<Pill tone="line">{F ? `на старт ${Math.round(F.end.r)}% · ${F.endZone.name}` : "—"}</Pill>}>
          {formSpec ? <Chart label="Втома у відсотках від звичного навантаження" spec={formSpec}
            legend={[{ k: "ink", text: "факт" }, { k: "band", text: "оптимально 100–150%" }]} /> : <Empty>Форма з'явиться з першими пробіжками плану</Empty>}
          <Details summary="Як це пораховано">
            <p>Навантаження дня: Coros Training Load з опису пробіжки, а без нього хвилини × вага інтенсивності. Втома = середнє за 7 днів до середнього за 6 тижнів (експоненційні), у відсотках. Пунктир: план, згладжений по тижню.</p>
          </Details>
        </Card>

        <Card n="06" title="Аеробна база" span={6}>
          {aerSpec ? <Chart label="Темп легких пробіжок, приведений до пульсу 145 і прохолоди" spec={aerSpec}
            legend={[{ k: "ink", text: "тренд 14 днів" }, { k: "ink", text: "пробіжки" }, { k: "cmp", text: "порожні: довгі й після важкого дня" }]} /> : <Empty>Потрібно 2 легкі пробіжки</Empty>}
        </Card>
        <Card n="07" title="Відрізки VO2max" span={6}>
          {vo2Spec ? <Chart label="Темп відрізків інтервальних тренувань і фартлеків" spec={vo2Spec}
            legend={[{ k: "acc", text: "інтервали" }, { k: "ink", text: "фартлек, за відчуттям" }, { k: "band", text: "швидка зона" }]} /> : <Empty>Ще немає відрізків</Empty>}
        </Card>

        <Card n="08" title="Об'єм по тижнях" span={8}>
          {weekSpec ? <Chart label="Кілометри по тижнях" spec={weekSpec} /> : <Empty>Ще немає пробіжок</Empty>}
        </Card>
        <Card n="09" title="Час у зонах пульсу" span={4} aside={withHrz && <span class="label">{dm(withHrz.date)}</span>}>
          {hrSpec ? <Chart label="Хвилини в кожній зоні пульсу за останню пробіжку з потоком" spec={hrSpec} /> : <Empty>Немає пробіжки з посекундним пульсом</Empty>}
        </Card>

        <Card n="10" title="Останні тренування" span={12}>
          <Table<Day> rowKey={d => d.date} rows={done.slice(-8).reverse()} cols={[
            { key: "d", title: "Дата", cell: d => dm(d.date) },
            { key: "w", title: "Тренування", cell: d => d.workout?.name ?? d.act },
            { key: "km", title: "Км", num: true, cell: d => d.run!.km.toFixed(1) },
            { key: "p", title: "Темп", num: true, wide: true, cell: d => (d.report?.pace ? pace(d.report.pace) : "—") },
            { key: "a", title: "Точність", num: true, cell: d => <Pill tone={accTone(d.acc!.score)}>{`${d.acc!.score}% · ${d.acc!.label}`}</Pill> },
          ]} />
        </Card>

        <Card n="11" title="Елементи" span={12}>
          <div class="kit-els">
            <div class="btn-row">
              <Button>Синхронізувати</Button><Button variant="ghost">Скасувати</Button><Button variant="link">Як це пораховано</Button><Button disabled>Недоступно</Button>
            </div>
            <div class="btn-row"><Pill>86%</Pill><Pill tone="acc">поріг 3:40</Pill><Pill tone="line">за планом</Pill><Pill tone="err">помилка</Pill></div>
            <Field label="Поріг з годинника, хв:с /км" inputMode="numeric" value={thr} onInput={e => setThr((e.target as HTMLInputElement).value)}
              error={/^\d{1,2}:[0-5]\d$/.test(thr) ? undefined : "Формат хв:с, наприклад 3:40"} hint="Зони перерахуються від цього значення" />
            <StatusLine tag="готово">Додано 3 пробіжки, без пробіжки 1 день</StatusLine>
            <StatusLine tone="acc" tag="увага">Пульс вище стелі 154 на легкому дні</StatusLine>
            <StatusLine tone="err" tag="помилка">Strava просить зачекати, спробуй через хвилину</StatusLine>
            <Empty>Порожній стан: що з'явиться тут і коли</Empty>
          </div>
        </Card>
        <Parts />
      </Grid>
      <StoreCheck />
      <DataCheck />
    </>
  );
}
