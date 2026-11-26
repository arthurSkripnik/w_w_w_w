// «Прогноз на дистанції»: today's form (VDOT from the 10 km forecast) as times for 400 m … marathon,
// with the pace curve over distance and the best efforts from Strava since the chest strap.
import type { Widget } from "../types";
import { Table } from "../../ui";
import { computed } from "@preact/signals";
import * as Plot from "@observablehq/plot";
import { useEffect, useRef } from "preact/hooks";
import { fc } from "../../store/home";
import { runs } from "../../store/data";
import { vdot, timeFor, mmss, dm } from "../../domain/home";
import { fmtPace } from "../../domain/util";
import { HM_KM } from "../../domain/spec";
import { CHEST_FROM } from "../../domain/profile";

const DIST = [{ m: 400, n: "400 м" }, { m: 1000, n: "1 км" }, { m: 5000, n: "5 км" }, { m: 10000, n: "10 км" }, { m: HM_KM * 1000, n: "21,1 км" }, { m: 42195, n: "42,2 км" }];
const BEST: Record<string, number> = { k5: 5000, k10: 10000, k21: HM_KM * 1000 };

const pred = computed(() => {
  const f = fc.value; if (!f) return null;
  const v = vdot(f.t10), rows = DIST.map(d => ({ ...d, t: timeFor(v, d.m) }));
  const best: { m: number; t: number; d: string }[] = [];
  Object.values(runs.value).forEach(r => { if (r.date < CHEST_FROM || !r.best) return;
    (Object.keys(BEST) as (keyof typeof BEST)[]).forEach(k => { const t = (r.best as Record<string, number | undefined>)[k], m = BEST[k];
      if (t) { const b = best.find(x => x.m === m); if (!b || t < b.t) { if (b) Object.assign(b, { t, d: r.date }); else best.push({ m, t, d: r.date }); } } }); });
  return { v, rows, best };
});
const fmtT = (s: number) => (s < 600 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : mmss(s));

function Distances() {
  const p = pred.value; if (!p) return null;
  return <ul class="dist-list">{p.rows.filter(r => r.m !== 400).map(r => <li key={r.m}><span class="label">{r.n}</span><b class="num">{fmtT(r.t)}</b></li>)}</ul>;
}

function Curve({ rows, best }: { rows: { m: number; n: string; t: number }[]; best: { m: number; t: number; d: string }[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!; let w = 0;
    const curve = Array.from({ length: 60 }, (_, i) => { const m = 400 * Math.pow(42195 / 400, i / 59); return { m, p: timeFor(pred.value!.v, m) / (m / 1000) }; });
    const draw = () => { const nw = Math.floor(el.clientWidth); if (!nw || nw === w) return; w = nw;
      const svg = Plot.plot({ width: w, height: 240, marginLeft: 44, marginRight: 16, marginTop: 24, marginBottom: 28,
        style: { background: "transparent", fontFamily: "var(--grot)", fontSize: "12px", overflow: "visible" },
        x: { type: "log", ticks: [], label: null }, y: { reverse: true, grid: true, ticks: 4, tickFormat: fmtPace, label: null, tickSize: 0 },
        marks: [
          Plot.lineY(curve, { x: "m", y: "p", stroke: "var(--ink)", strokeWidth: 2, curve: "monotone-x" }),
          Plot.dot(rows, { x: "m", y: (r: { m: number; t: number }) => r.t / (r.m / 1000), r: 4, fill: "var(--ink)", stroke: "var(--bg)", strokeWidth: 1.5 }),
          Plot.text(rows, { x: "m", y: (r: { m: number; t: number }) => r.t / (r.m / 1000), text: "n", dy: 14, fill: "var(--mute)" }),
          Plot.dot(best, { x: "m", y: (b: { m: number; t: number }) => b.t / (b.m / 1000), r: 4.5, fill: "var(--acc)", stroke: "var(--bg)", strokeWidth: 1.5 }),
          Plot.tip([...rows.map(r => ({ m: r.m, p: r.t / (r.m / 1000), s: `${r.n}: прогноз ${fmtT(r.t)}, ${fmtPace(r.t / (r.m / 1000))} /км` })),
            ...best.map(b => ({ m: b.m, p: b.t / (b.m / 1000), s: `Найкраще в Strava ${dm(b.d)}.${b.d.slice(2, 4)}: ${fmtT(b.t)}` }))],
            Plot.pointer({ x: "m", y: "p", title: "s", fill: "var(--ink)", stroke: "none", textPadding: 6, pointerSize: 0 } as never)),
        ] });
      svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Крива темпу: прогноз на дистанції від 400 м до марафону"); el.replaceChildren(svg); };
    draw(); const ro = new ResizeObserver(draw); ro.observe(el); return () => ro.disconnect();
  }, [rows, best]);
  return <figure class="chart-fig" style="margin:0">
    <div class="chart-legend"><span><i data-k="ink" />Прогноз від сьогоднішньої форми</span><span><i data-k="acc" />Найкраще в Strava з 2025</span></div>
    <div class="chart" ref={box} />
  </figure>;
}

function DistancesFull() {
  const p = pred.value; if (!p) return null;
  return <>
    <Curve rows={p.rows} best={p.best} />
    <Table rowKey={r => String(r.m)} rows={p.rows} cols={[
      { key: "n", title: "Дистанція", cell: r => r.n },
      { key: "t", title: "Прогноз", num: true, cell: r => <b>{fmtT(r.t)}</b> },
      { key: "p", title: "Темп, /км", num: true, cell: r => fmtPace(r.t / (r.m / 1000)) },
      { key: "b", title: "Найкраще в Strava", num: true, cell: r => { const b = p.best.find(x => Math.abs(x.m - r.m) < 1); return b ? `${fmtT(b.t)} (${dm(b.d)}.${b.d.slice(2, 4)})` : "—"; } },
    ]} />
  </>;
}
export const DistancesHow = () => { const p = pred.value; return <>Рахується з прогнозу 10 км (поріг × 0,97): {p ? `VDOT ${p.v.toFixed(1)}` : "VDOT"} за формулою Деніелса, з нього час на кожну дистанцію. 400 м і 1 км залежать від швидкості, а не лише від аеробної форми, тому це орієнтир. Півмарафон і марафон розраховані на те, що до них є відповідна підготовка обсягом.</>; };
export const distancesW: Widget = { id: "distances", title: "Прогноз на дистанції", about: "Прогноз на 5 км, 10 км, півмарафон і марафон", span: 3, link: { label: "Графік", href: "#lab/distances" }, C: Distances, Full: DistancesFull, how: DistancesHow };
