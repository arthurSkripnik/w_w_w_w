// The Strava report of a day, ported from v52 06-report.js: summary, accuracy by part, pace and heart rate by lap
// (bars as wide as the lap's time, work laps in the accent), time in zones, the laps table and the findings.
import type { Day } from "../domain/days";
import type { Report as Rep } from "../domain/report";
import { lapPace, type Lap, type Part } from "../domain/report";
import { ACC_NAME, isHot } from "../domain/accuracy";
import { zoneRange, hrCeil, hrTops, type Zones } from "../domain/zones";
import { findings, zoneMark, zoneGap, type Tag } from "../domain/text";
import { typeOf, ZONE_TXT } from "../domain/types";
import { fmtPace, pc } from "../domain/util";
import { mmss, plural } from "../domain/home";
import { Pill, Stat } from "../ui";

const T = ({ t }: { t: Tag | null }) => (t ? <Pill tone={t.tone}>{t.tag}</Pill> : null);

function Tile({ k, v, u }: { k: string; v: string | number | null | undefined; u?: string }) {
  if (v == null) return null;
  return <div class="rtile"><span class="num rtile-v">{v}{u && <small> {u}</small>}</span><span class="label">{k}</span></div>;
}

/** Laps as bars: width = lap time, height = value (larger = taller); work laps in the accent. */
function LapBars({ rep, val, lo, hi, band, avg, label, tip }: { rep: Rep; val: (l: Lap) => number; lo: number; hi: number; band?: [number, number]; avg?: number | null; label: string; tip: (l: Lap) => string }) {
  const all = rep.laps.map((l, i) => [l, i] as const).filter(([l]) => l[1] >= 100); if (all.length < 2) return null;
  const work = new Set(rep.wi || []), tot = all.reduce((a, [l]) => a + l[0], 0);
  const VW = 1000, VH = 132, top = 8, y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (VH - top);
  let x = 0;
  return <figure class="lapchart" role="img" aria-label={label}>
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" width="100%" height={VH}>
      {band && <rect x="0" y={y(band[1])} width={VW} height={Math.max(0, y(band[0]) - y(band[1]))} class="lz" />}
      {all.map(([l, i], k) => { const w = (l[0] / tot) * VW, yy = Math.min(VH - 2, y(val(l))), r = <rect key={k} x={x + 0.6} y={yy} width={Math.max(1, w - 1.2)} height={VH - yy} class={work.has(i) ? "lw" : "le"}><title>Коло {k + 1}: {tip(l)}</title></rect>; x += w; return r; })}
      {avg != null && <line x1="0" x2={VW} y1={y(avg)} y2={y(avg)} class="lavg" />}
    </svg>
    <figcaption class="lapax label"><span>0</span><span>{mmss(tot)}</span></figcaption>
  </figure>;
}

function ZoneBars({ rows }: { rows: { name: string; range: string; t: number; on?: boolean }[] }) {
  const tot = rows.reduce((a, r) => a + r.t, 0); if (!tot) return null;
  return <ul class="zbars">{rows.map(r => <li key={r.name} data-on={r.on ? "" : undefined}>
    <span class="zb-n">{r.name}</span><span class="zb-r label num">{r.range}</span>
    <span class="zb-t"><i style={{ width: `${((r.t / tot) * 100).toFixed(1)}%` }} /></span>
    <b class="num">{Math.round((r.t / tot) * 100)}%</b><span class="label num">{mmss(r.t)}</span></li>)}</ul>;
}
function paceRows(rep: Rep, Z: Zones, key: string) {
  const z3 = Z.z3, z2 = Z.z2, z1 = Z.z1, g = zoneGap(Z);
  const rows = [
    { name: "Швидкий", range: `≤${fmtPace(z3.slow)}`, test: (p: number) => p <= z3.slow + 0.5, on: key === "z3" },
    { name: "Пороговий", range: `${fmtPace(z2.fast)}–${fmtPace(z2.slow)}`, test: (p: number) => p <= z2.slow + 0.5, on: key === "z2" },
    ...(g ? [{ name: "Марафонський", range: `${fmtPace(g.fast)}–${fmtPace(g.slow)}`, test: (p: number) => p < g.slow + 0.5, on: false }] : []),
    { name: "Легкий", range: `${fmtPace(z1.fast)}–${fmtPace(z1.slow)}`, test: (p: number) => p <= z1.slow + 0.5, on: key === "z1" },
    { name: "Повільно", range: `>${fmtPace(z1.slow)}`, test: () => true, on: key === "rec" },
  ].map(r => ({ ...r, t: 0 }));
  rep.laps.forEach(l => { if (l[1]) rows.find(r => r.test(lapPace(l)))!.t += l[0]; });
  return rows;
}
function hrRows(rep: Rep, Z: Zones) {
  const tops = hrTops(Z);
  let secs = rep.hrz;
  if (!secs) { secs = [0, 0, 0, 0, 0]; rep.laps.forEach(l => { if (!l[2]) return; let z = tops.findIndex(t => l[2] <= t); if (z < 0) z = 4; secs![z] += l[0]; }); }
  const range = (i: number) => (i === 0 ? `≤${tops[0]}` : i === 4 ? `${tops[3] + 1}+` : `${tops[i - 1] + 1}–${tops[i]}`);
  return [0, 1, 2, 3, 4].map(i => ({ name: `Z${i + 1}`, t: secs![i] || 0, range: range(i) }));
}

export function Report({ day, rh }: { day: Day; rh: number | null }) {
  const rep = day.report!, A = day.acc, Z = rep.zones, type = rep.as || day.type, w = typeOf(type).work;
  const easyKey = w === "rec" ? "rec" : "z1", workKey = w && w !== "race" && w !== "tt" ? w : easyKey;
  const L = rep.laps.filter(l => l[1] >= 100), work = new Set(rep.wi || []);
  const kmLaps = rep.laps.filter(l => l[1] >= 950 && l[1] <= 1050), bestKm = kmLaps.length ? Math.min(...kmLaps.map(lapPace)) : null;
  const hrs = L.filter(l => l[2]).map(l => l[2]), maxHr = hrs.length ? Math.max(...hrs) : null;
  const wx = day.run?.weather as { rh?: number | null; wind?: number | null } | null | undefined;
  const P = L.map(lapPace), zb = zoneRange(workKey, Z), pFast = Math.min(...P, zb.fast) - 10, pSlow = Math.max(...P, zb.slow) + 15;
  const ceil = hrCeil(Z), hLo = Math.min(...hrs, ceil) - 15, hHi = Math.max(...hrs, Z.thrHR) + 5;
  const F = findings(rep, day.type, day.level, Z, { marked: !!(day.run?.exclude || day.journal?.actualType), rh });

  const row = (n: string, p: Part | null | undefined, key: string | null, wk?: boolean) => p ? <tr class={wk ? "lwk" : undefined} key={n}>
    <td>{n}</td><td class="n num">{p.km.toFixed(2)}</td><td class="n num">{mmss(p.t)}</td><td class="n num"><b>{p.pace ? fmtPace(p.pace) : "—"}</b></td><td class="n num">{p.hr || "—"}</td><td>{key && <T t={zoneMark(p.pace, key, Z)} />}</td></tr> : null;
  let parts: (preact.JSX.Element | null)[] = [];
  if (rep.tmpl === "steady" && rep.easy?.first40) parts = [row("Перші 40 хв", rep.easy, easyKey)];
  else if (rep.tmpl === "progression" && rep.work) parts = [row("Легка частина", rep.warm, easyKey), row("Прискорення", rep.work, "z2", true), row("Заминка", rep.cool, null)];
  else if (rep.tmpl === "blocks" && rep.blocks) parts = rep.blocks.flatMap((b, i) => [row(`Блок ${i + 1} · пороговий`, b.z2, "z2", true), row(`Блок ${i + 1} · швидкий`, b.z3, "z3", true)]);
  else if (rep.reps?.length) parts = [row("Розминка", rep.warm, easyKey), row(`Повтори × ${rep.reps.length}`, rep.work, workKey, true), row("Заминка", rep.cool, null)];
  let no = 0;

  return <div class="report">
    <section class="rcard">
      <header class="card-head"><h3 class="card-title">Звіт зі Strava</h3><span class="card-aside label">{rep.name}</span></header>
      <Stat value={rep.km.toFixed(2)} unit="км" caption="Дистанція" />
      <div class="rtiles">
        <Tile k="Час руху" v={mmss(rep.t)} />
        <Tile k="Середній темп" v={rep.pace ? fmtPace(rep.pace) : "—"} u="/км" />
        <Tile k="Найкращий км" v={bestKm ? fmtPace(bestKm) : null} u="/км" />
        <Tile k="Середній пульс" v={rep.hr || "—"} u="уд/хв" />
        <Tile k="Навантаження" v={rep.coros} u="Coros" />
        {typeof rep.temp === "number" && <Tile k={isHot(rep, rh) ? "Температура · спека" : "Температура"} v={rep.temp} u="°C" />}
        <Tile k="Вологість" v={wx?.rh ?? null} u="%" />
        <Tile k="Вітер" v={wx?.wind ?? null} u="м/с" />
      </div>
    </section>

    {A && <section class="rcard">
      <header class="card-head"><h3 class="card-title">Точність виконання</h3><span class="card-aside"><Pill tone={A.score >= 90 ? "ink" : A.score >= 50 ? "line" : "err"}>{A.label}</Pill></span></header>
      <Stat value={`${A.score}`} unit="%" acc />
      <div class="accstrip" role="img" aria-label={`Частини тренування за вагою: ${A.parts.map(p => `${p.name || ACC_NAME[p.key]} ${pc(p.s)}%`).join(", ")}`}>
        {A.parts.map((p, i) => <span key={i} style={{ flex: p.share.toFixed(3) }} title={`${p.name || ACC_NAME[p.key]}: ${pc(p.s)}%`}><i style={{ width: `${pc(p.s)}%` }} /></span>)}
      </div>
      <ul class="acct">{A.parts.map((p, i) => <li key={i} data-work={p.key === "work" ? "" : undefined}>
        <span>{p.name || ACC_NAME[p.key]}</span><span class="label num">вага {pc(p.share)}%</span>
        <span class="zb-t"><i style={{ width: `${pc(p.s)}%` }} /></span><b class="num">{pc(p.s)}</b><span class="acct-n label">{p.note}</span></li>)}</ul>
      <p class="label">Ширина сегмента = вага частини. Робота важить найбільше, розминка й заминка майже не впливають.{A.as !== day.type ? ` Оцінено як «${typeOf(A.as).name}».` : ""}</p>
    </section>}

    {L.length >= 2 && <section class="rcard">
      <header class="card-head"><h3 class="card-title">Темп</h3><span class="card-aside label num">{bestKm ? `найкращий км ${fmtPace(bestKm)} · ` : ""}середній {rep.pace ? fmtPace(rep.pace) : "—"}</span></header>
      <LapBars rep={rep} val={l => -lapPace(l)} lo={-pSlow} hi={-pFast} band={[-zb.slow, -zb.fast]} avg={rep.pace ? -rep.pace : null}
        label={`Темп по колах: ${P.map(fmtPace).join(", ")}`} tip={l => `${fmtPace(lapPace(l))} /км${l[2] ? `, пульс ${l[2]}` : ""}`} />
      <p class="label">Вище = швидше, помаранчеві = робота, ширина = час кола. Смуга: {ZONE_TXT[workKey]} {fmtPace(zb.fast)}–{fmtPace(zb.slow)}, лінія: середній.</p>
      <ZoneBars rows={paceRows(rep, Z, workKey)} />
    </section>}

    {hrs.length >= 2 && <section class="rcard">
      <header class="card-head"><h3 class="card-title">Пульс</h3><span class="card-aside label num">макс. коло {maxHr} · середній {rep.hr || "—"}</span></header>
      <LapBars rep={rep} val={l => l[2] || hLo} lo={hLo} hi={hHi} avg={rep.hr} label={`Пульс по колах: ${L.map(l => l[2] || "—").join(", ")}`} tip={l => `пульс ${l[2] || "—"}, ${fmtPace(lapPace(l))} /км`} />
      <p class="label">Стеля легкого дня {ceil} · поріг {Z.thrHR} · {rep.hrz ? "зони посекундно з потоку Strava" : "зони по колах"}</p>
      <ZoneBars rows={hrRows(rep, Z)} />
    </section>}

    <section class="rcard">
      <header class="card-head"><h3 class="card-title">Кола</h3><span class="card-aside label">{L.length} {plural(L.length, "коло", "кола", "кіл")}</span></header>
      <div class="tbl-wrap"><table class="tbl laps">
        <thead><tr><th>№</th><th class="n">Км</th><th class="n">Час</th><th class="n">Темп</th><th class="n">Пульс</th><th /></tr></thead>
        <tbody>{rep.laps.map((l, i) => { if (l[1] < 100) return null; no++; const p = lapPace(l), best = !!bestKm && Math.abs(p - bestKm) < 0.01 && l[1] >= 950;
          return <tr key={i} class={work.has(i) ? "lwk" : undefined}><td>{no}</td><td class="n num">{(l[1] / 1000).toFixed(2)}</td><td class="n num">{mmss(l[0])}</td><td class="n num"><b>{fmtPace(p)}</b></td><td class="n num">{l[2] || "—"}</td>
            <td>{work.has(i) ? <T t={zoneMark(p, workKey, Z)} /> : best ? <Pill tone="acc">найкращий км</Pill> : null}</td></tr>; })}</tbody>
        {parts.some(Boolean) && <tbody class="parts">{parts}</tbody>}
        <tfoot><tr><td>Разом</td><td class="n num">{rep.km.toFixed(2)}</td><td class="n num">{mmss(rep.t)}</td><td class="n num"><b>{rep.pace ? fmtPace(rep.pace) : "—"}</b></td><td class="n num">{rep.hr || "—"}</td><td /></tr></tfoot>
      </table></div>
    </section>

    <section class="rcard">
      <header class="card-head"><h3 class="card-title">Висновки</h3></header>
      <ul class="finds">{F.map((f, i) => <li key={i}>{f.tag && <T t={f.tag} />}<span>{f.text}</span></li>)}</ul>
    </section>
  </div>;
}
