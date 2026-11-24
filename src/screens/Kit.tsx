import { useMemo, useState } from "preact/hooks";
import { Grid, Card, Stat, Pill, Button, Segmented, Table, Field, Details, StatusLine, Empty } from "../ui";
import { Chart } from "../ui/Chart";
import { getTheme, setTheme, type Theme } from "../ui/theme";
import type { Pt } from "../ui/chart";
import { days, form, aerobic, zones, today } from "../store/derived";
import { runs, dbState } from "../store/data";
import { FATIGUE } from "../domain/load";
import { fmtPace, mondayOf, addDays } from "../domain/util";
import { ZONE_NAME } from "../data/schema";
import { StoreCheck } from "./StoreCheck";
import { DataCheck } from "./DataCheck";
import type { Day } from "../domain/days";

// Step 4 sample page: every basic element and chart on real data, for checking the look before screens are built.
const D = (iso: string) => new Date(iso + "T00:00:00");
const dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);
const pace = (v: number) => fmtPace(v);
const accTone = (s: number): "ink" | "line" | "err" => (s >= 90 ? "ink" : s >= 50 ? "line" : "err");


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
            { key: "p", title: "Темп", num: true, cell: d => (d.report?.pace ? pace(d.report.pace) : "—") },
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
      </Grid>
      <StoreCheck />
      <DataCheck />
    </>
  );
}
