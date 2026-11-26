// «Аеробна база», full size: easy pace at HR 145 and 15°, the 14-day line, long runs apart, the model to race day, drift.
import { Chart } from "../../ui/Chart";
import { aerobic, today, days } from "../../store/derived";
import { effT, aerProj } from "../../store/lab";
import { EASY_REF_HR } from "../../domain/aerobic";
import { typeOf } from "../../domain/types";
import { dm } from "../../domain/home";
import { fmtPace } from "../../domain/util";

const D = (iso: string) => new Date(iso + "T00:00:00");
export function AerobicFull() {
  const { pts: all, roll } = aerobic.value, pts = all.filter(p => !p.long), lng = all.filter(p => p.long), T = effT.value, aj = aerProj.value;
  if (pts.length < 2 || !T) return <p class="status">Потрібно щонайменше 2 легкі пробіжки зі Strava.</p>;
  const perWeek = -T.slope * 7, lt = lng.length > 1 ? lng[lng.length - 1].norm - lng[0].norm : null;
  const end = (a: { s: number }[]) => a[a.length - 1].s;
  const tip = (p: typeof all[number]) => `${dm(p.d)} · ${typeOf(p.t).name}${p.first40 ? ", перші 40 хв" : ""}: ${p.km.toFixed(1)} км, ${fmtPace(p.pace)} /км, пульс ${p.hr}, ${Math.round(p.temp)}° → ${fmtPace(p.norm)}${p.hard ? " · після важкого дня" : ""}`;
  const drift = days.value.filter(d => d.report?.drift).map(d => `${dm(d.date)} ${d.report!.drift!.pct.toFixed(1)} %`);
  return <>
    <Chart label={`Легкий темп, приведений до пульсу ${EASY_REF_HR} і 15 градусів`}
      legend={[{ k: "ink", text: "Лінія: середнє за 14 днів" }, { k: "cmp", text: "Довгі (квадрати)" }, ...(aj ? [{ k: "band" as const, text: "Модель до старту" }] : [])]}
      spec={{ kind: "line", height: 240, data: roll.map(r => ({ x: D(r.d), y: r.v, tip: `${dm(r.d)} · середнє за 14 днів ${fmtPace(r.v)}` })), y: { fmt: fmtPace, reverse: true }, today: D(today.value),
        dots: [...pts.map(p => ({ x: D(p.d), y: p.norm, soft: p.hard, tip: tip(p) })), ...lng.map(p => ({ x: D(p.d), y: p.norm, square: true, tip: tip(p) }))],
        lines: [...(lng.length > 1 ? [{ data: lng.map(p => ({ x: D(p.d), y: p.norm })), tone: "mute" as const }] : []),
          ...(aj ? [{ data: aj.mid.map(p => ({ x: D(p.d), y: p.s, tip: `${dm(p.d)} · модель ${fmtPace(p.s)}` })), dash: true }] : [])],
        area: aj ? aj.mid.map((p, i) => ({ x: D(p.d), lo: aj.hi[i].s, hi: aj.lo[i].s })) : undefined }} />
    <p class="status">{aj ? <>Модель на старт: <b>{fmtPace(end(aj.mid))}</b> при пульсі {EASY_REF_HR}, діапазон {fmtPace(end(aj.hi))}–{fmtPace(end(aj.lo))}. </> : null}
      Тренд легких: {Math.abs(perWeek) < 0.5 ? "без змін" : perWeek > 0 ? `швидше на ${perWeek.toFixed(1)} с/км за тиждень` : `повільніше на ${(-perWeek).toFixed(1)} с/км за тиждень`}.
      {lt !== null ? ` Довгі (${lng.length}): ${Math.abs(lt) < 1 ? "без змін" : lt < 0 ? `швидше на ${Math.round(-lt)} с/км` : `повільніше на ${Math.round(lt)} с/км`}.` : ""}</p>
    <p class="status">{drift.length ? `Дрейф темп/пульс на довгих: ${drift.join(", ")}. Менше 5 % = база тримає тривалість.` : "Дрейф на довгих з'явиться після «Перерахувати звіти» або наступного довгого."}</p>
  </>;
}

/** «?» in the card head: where the numbers come from. */
export const AerobicHow = () => <>Темп легких пробіжок до 75 хв, перерахований на однаковий пульс {EASY_REF_HR} (темп × пульс / {EASY_REF_HR}) і на 15°: у спеку на тому самому пульсі біжиш повільніше. Порожній кружок: наступного дня після важкого, у середньому важить половину.</>;
