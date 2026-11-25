// «Форма», full size: fatigue now and its zone, the line from the archive (or plan start) to race day with the COROS zones.
import { Stat, Pill } from "../../ui";
import { Chart } from "../../ui/Chart";
import { form, today, days } from "../../store/derived";
import { FATIGUE, fatigueZone } from "../../domain/load";
import { dm } from "../../domain/home";
import { addDays } from "../../domain/util";

const D = (iso: string) => new Date(iso + "T00:00:00");
export function FormFull() {
  const S = form.value; if (!S?.now || !S.zone) return null;
  const z = S.zone, ze = S.endZone, unit = S.K ? "од. COROS" : "од. плану", start = days.value[0]?.date ?? S.days[0].d;
  const from = S.days[0].d > addDays(start, -56) ? S.days[0].d : addDays(start, -56);
  const pts = S.days.filter(x => x.d >= from && x.d < S.race), hi = Math.max(180, Math.ceil(Math.max(...pts.map(x => x.r), S.end.r) / 20) * 20);
  const tip = (x: { d: string; r: number; atl: number; ctl: number }, plan?: boolean) => `${dm(x.d)}${plan ? " · за планом" : ""} · ${Math.round(x.r)} % ${fatigueZone(x.r).name.toLowerCase()} · 7 днів ${Math.round(x.atl)}, 6 тижнів ${Math.round(x.ctl)}`;
  const past = pts.filter(x => !x.plan).map(x => ({ x: D(x.d), y: Math.min(x.r, hi), tip: tip(x) }));
  const futRaw = pts.filter(x => x.plan);
  const fut = futRaw.map((x, i, a) => { const w = a.slice(Math.max(0, i - 3), i + 4); return { x: D(x.d), y: Math.min(w.reduce((s, y) => s + y.r, 0) / w.length, hi), tip: tip(x, true) }; });
  fut.push({ x: D(S.race), y: Math.min(S.end.r, hi), tip: `${dm(S.race)} · ранок старту за планом: ${Math.round(S.end.r)} % ${ze.name.toLowerCase()}` });
  const bands = FATIGUE.map((f, i) => ({ lo: f.lo, hi: i ? FATIGUE[i - 1].lo : hi, label: f.name, strong: f.lo === 100 }));
  return <>
    <div class="lab-stats">
      <Stat value={`${Math.round(S.now.r)}`} unit="%" caption={<Pill tone={z.lo >= 150 ? "acc" : "ink"}>{z.name}</Pill>} />
      <div class="lab-tip"><p>{z.tip}</p>
        <p class="status">Навантаження 7 днів {Math.round(S.now.atl)}, звичне за 6 тижнів {Math.round(S.now.ctl)} {unit} на день. День старту за планом: {Math.round(S.end.r)} %, {ze.name.toLowerCase()}.</p></div>
    </div>
    <Chart label={`Втома у відсотках від звичного навантаження: зараз ${Math.round(S.now.r)} % (${z.name}), на день старту за планом ${Math.round(S.end.r)} %`}
      legend={[{ k: "ink", text: "Факт, пунктиром план до старту" }, { k: "band", text: "Оптимально 100–150 %" }]}
      spec={{ kind: "line", height: 260, data: past, plan: fut, y: { fmt: v => `${Math.round(v)} %`, domain: [0, hi] }, bands, today: D(today.value), x: [D(from), D(S.race)] }} />
    <p class="status">{S.arch ? `Звичне навантаження до плану пораховане з історії Strava, тому відсоток точний від першого дня плану.` : "Без історії звичне навантаження до плану взяте з перших двох тижнів плану. Завантаж історію в Профілі → Дані, щоб відсоток був точніший."}</p>
    <p class="pf-note">Навантаження дня = «Training Load» COROS з опису пробіжки, а якщо його немає, хвилини × вага інтенсивності. Втома = навантаження 7 днів у % від звичного за 6 тижнів, шкала COROS EvoLab.</p>
  </>;
}
