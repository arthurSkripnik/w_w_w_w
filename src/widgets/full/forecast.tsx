// «Прогноз 10 км», full size: watch forecast, goal and gap; the chart of threshold entries, workout equivalents,
// the Strava forecast and the model to race day; how it is counted.
import { Stat, Pill, Details, StatusLine } from "../../ui";
import { Chart } from "../../ui/Chart";
import { fc } from "../../store/home";
import { goal, today, threshold, zones } from "../../store/derived";
import { athlete } from "../../store/data";
import { eqPts, sForecast, thrHr, thrLine, proj } from "../../store/lab";
import { mmss, plural, dm } from "../../domain/home";
import { fmtPace } from "../../domain/util";
import { THR_TO_10K, HM_KM, eq10 } from "../../domain/spec";
import { EQ, BY_FEEL, KEY_T, GAIN, SF_MIN, SF_THR_MIN } from "../../domain/lab";
import { typeOf } from "../../domain/types";

const D = (iso: string) => new Date(iso + "T00:00:00");
const REF: Record<string, [number, string]> = { Fastest5k: [5, "5 км"], Fastest10k: [10, "10 км"], FastestHalfMarathon: [HM_KM, "півмарафону"], FastestMarathon: [42.195, "марафону"] };

export function ForecastFull() {
  const f = fc.value, g = goal.value, th = threshold.value, Z = zones.value; if (!f || !g || !th || !Z) return null;
  const goal10 = (g.targetSec / g.km) * 10, gap = Math.round(f.t10 - goal10), sf = sForecast.value, tp = thrHr.value, pj = proj.value, wo = eqPts.value;
  const end = (a: { s: number }[]) => a[a.length - 1].s;
  const ref = athlete.value?.refRace && REF[athlete.value.refRace.type] ? athlete.value.refRace : null;
  const dots = [
    ...thrLine.value.map(p => ({ x: D(p.d), y: p.t10, square: true, tip: `${dm(p.d)} · годинник: поріг ${fmtPace(p.pace)} → 10 км ${mmss(p.t10)}` })),
    ...wo.map(p => ({ x: D(p.d), y: p.eq * 10, key: KEY_T.includes(p.t), soft: BY_FEEL.includes(p.t),
      tip: `${dm(p.d)} · ${typeOf(p.t).name}: темп ${fmtPace(p.pace)}${p.hr ? `, пульс ${p.hr}` : ""} · ${EQ[p.t].lbl} → ${mmss(p.eq * 10)}` })),
  ];
  const recent = wo.filter(p => !BY_FEEL.includes(p.t) && p.d <= today.value && (D(today.value).getTime() - D(p.d).getTime()) / 864e5 <= 28);
  const avg = recent.length ? (recent.reduce((a, p) => a + p.eq, 0) / recent.length) * 10 : null;
  return <>
    <div class="lab-stats">
      <Stat value={mmss(f.t10)} caption={`Прогноз за порогом, ${fmtPace(f.t10 / 10)} /км`} />
      <Stat value={mmss(goal10)} caption={`Ціль, ${fmtPace(goal10 / 10)} /км`} />
      <Stat value={gap > 0 ? mmss(gap) : "0:00"} caption={gap > 0 ? `До цілі, ${(gap / 10).toFixed(1)} с/км` : <Pill tone="acc">ціль у формі</Pill>} acc={gap <= 0} />
    </div>
    <div class="lab-lines">
      <p class="status">Для {mmss(goal10)} потрібен поріг <b>{fmtPace(goal10 / 10 / THR_TO_10K)} /км</b>. Зараз {fmtPace(th.paceSec)}, записано {dm(th.date)}.</p>
      {tp && <p class="status">{tp.pace
        ? <>На пороговому пульсі {tp.lo}–{tp.hi}: <b>{fmtPace(tp.pace)} /км</b> ({tp.n} {plural(tp.n, "коло", "кола", "кіл")} за 4 тижні). {tp.pace - th.paceSec >= 6 ? "Повільніше за годинник: перевір на контрольних 5 км." : "Збігається з годинником."}</>
        : <>На пороговому пульсі {tp.lo}–{tp.hi}: ще мало кіл ({tp.n}). З'явиться після швидких фінішів і порогових.</>}</p>}
      {sf && <p class="status">{sf.eq
        ? <>За фактом зі Strava: <b>{mmss(sf.eq)}</b> ({sf.onlyThr ? `поки лише з порогового пульсу, ${sf.thr!.n} ${plural(sf.thr!.n, "коло", "кола", "кіл")}` : `${sf.n} ${plural(sf.n, "показове", "показові", "показових")} за 6 тижнів${sf.thr ? " і пороговий пульс" : ""}`}). {Math.abs(sf.eq - f.t10) >= 20 ? `Різниця з годинником ${Math.round(Math.abs(sf.eq - f.t10))} с: перевір поріг.` : "Збігається з годинником."}</>
        : <>За фактом зі Strava: з'явиться після {SF_MIN} показових тренувань ({sf.n}/{SF_MIN}){sf.next ? `, наступне ${dm(sf.next.date)}` : ""}.</>}</p>}
      {ref && <p class="status">Strava рахує зони від {REF[ref.type][1]} {mmss(ref.sec)}, це ≈{mmss(eq10(REF[ref.type][0], ref.sec) * 10)} на 10 км за Ріґелем. Давній результат, у прогноз не йде.</p>}
    </div>
    <Chart label="Прогноз 10 км: поріг з годинника, еквіваленти з тренувань, прогноз за фактом і модель до старту"
      legend={[{ k: "ink", text: "Поріг з годинника → прогноз" }, { k: "acc", text: "Контрольні 5 км, гонка; ціль пунктиром" }, ...(pj ? [{ k: "band" as const, text: "Модель до старту" }] : [])]}
      spec={{ kind: "line", height: 280, data: thrLine.value.map(p => ({ x: D(p.d), y: p.t10 })), end: false, dots,
        y: { fmt: mmss, reverse: true }, ref: { y: goal10, label: `ціль ${mmss(goal10)}` }, today: D(today.value),
        x: [D(thrLine.value[0]?.d ?? today.value) < D(wo[0]?.d ?? today.value) ? D(thrLine.value[0]?.d ?? today.value) : D(wo[0]?.d ?? today.value), D(pj?.race ?? g.date)],
        area: pj ? pj.mid.map((p, i) => ({ x: D(p.d), lo: pj.hi[i].s, hi: pj.lo[i].s })) : undefined,
        lines: pj ? [{ data: pj.mid.map(p => ({ x: D(p.d), y: p.s, tip: `${dm(p.d)} · модель ${mmss(p.s)}` })), dash: true }] : undefined,
        segs: sf?.eq && sf.from ? [{ x1: D(sf.from), x2: D(sf.to!), y: sf.eq, label: `Strava ${mmss(sf.eq)}`, tip: `За фактом зі Strava: ${mmss(sf.eq)}` }] : undefined }} />
    <StatusLine tone="line" tag={recent.length ? `${recent.length} за 4 тижні` : "немає"}>{recent.length && avg
      ? `Середній еквівалент показових тренувань ${mmss(avg)}, годинник ${mmss(f.t10)}.${Math.abs(avg - f.t10) >= 20 ? ` Різниця ${Math.round(Math.abs(avg - f.t10))} с: перевір поріг на годиннику.` : ""}`
      : "Ще немає показових тренувань (поріг, VO2max, 5 км) зі Strava."}</StatusLine>
    {pj && <p class="status">Модель на старт: <b>{mmss(end(pj.mid))}</b>, діапазон {mmss(end(pj.hi))}–{mmss(end(pj.lo))}, виконано {Math.round(pj.scale * 100)} % плану.</p>}
    <Details summary="Як це пораховано">
      <p><b>Поріг з годинника</b> × 0,97 = темп 10 км. Лише він змінює зони і план. Еквіваленти з тренувань: темп робочих відрізків × коефіцієнт (поріг 0,97, відрізки VO2max 1,04, 5 км 1,037). Фартлек біжиться за відчуттям: на графіку порожнім кружком, у середнє не йде.</p>
      <p><b>За фактом зі Strava:</b> середнє показових тренувань за 6 тижнів (5 км, гонка і старти вдвічі) плюс темп на пороговому пульсі × 0,97, коли за 4 тижні є {SF_THR_MIN}+ таких кіл.</p>
      <p><b>Модель «форма мінус втома»</b> (Banister): кожне тренування дає форму, що згасає за ≈6 тижнів, і втому, що минає за ≈тиждень. Навантаження дня: хвилини плану × вага інтенсивності, у минулому навантаження COROS. Розмір приросту взято з досліджень: {GAIN.lo} / {GAIN.mid} / {GAIN.hi} % за 10 тижнів повного плану, масштабовано на виконану частку.</p>
      <p class="label">Banister et al. 1975; Busso et al. 1991, 2003; Bosquet et al. 2007; Muñoz, Seiler et al. 2014.</p>
    </Details>
  </>;
}
