// chart(): every chart of the app in one house style on Observable Plot.
// Thin marks, hairline grid, few ticks, the latest value in a pill, accent end dot, zone bands, a "today" rule,
// and a crosshair tooltip. Colours come from the CSS tokens, so light and dark follow the theme.
import * as Plot from "@observablehq/plot";

const C = { ink: "var(--ink)", mute: "var(--mute)", hair: "var(--hair)", line: "var(--line)", acc: "var(--acc)", cmp: "var(--cmp)", bg: "var(--bg)", band: "var(--chip)" };

export interface Axis {
  fmt: (v: number) => string;   // tick and tooltip format
  reverse?: boolean;            // pace: faster (smaller) up
  domain?: [number, number];
  ticks?: number;
}
export interface Pt { x: Date; y: number; tip?: string }
export interface Band { lo: number; hi: number; label?: string; strong?: boolean }

export type ChartSpec =
  | { kind: "line"; data: Pt[]; plan?: Pt[]; dots?: (Pt & { key?: boolean; soft?: boolean; square?: boolean; label?: string })[]; y: Axis; bands?: Band[]; ref?: { y: number; label: string }; today?: Date; x?: [Date, Date]; height?: number; end?: boolean; compare?: Pt[];
      area?: { x: Date; lo: number; hi: number }[];                  // a scenario band (model)
      lines?: { data: Pt[]; dash?: boolean; tone?: "ink" | "mute" }[]; // more series: model middle, long runs
      segs?: { x1: Date; x2: Date; y: number; label: string; tip?: string }[];
      step?: boolean }                                              // a level that holds until the next point   // a value over a window (Strava forecast)
  | { kind: "bars"; data: (Pt & { plan?: boolean })[]; y: Axis; height?: number; today?: Date }
  | { kind: "spark"; data: Pt[]; y?: Partial<Axis>; height?: number }
  | { kind: "dist"; a: { a: number; b: number; v: number }[]; b: { a: number; b: number; v: number }[]; y: Axis; height?: number; tip: (km: number) => string }   // two runs lap by lap along the distance
  | { kind: "hbars"; data: { label: string; v: number; tip?: string }[]; fmt: (v: number) => string; acc?: number };

const dm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const monthTick = (d: Date) => MONTHS[d.getMonth()] + (d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : "");

const base = (width: number, height: number) => ({
  width, height, marginLeft: 44, marginRight: 16, marginTop: 24, marginBottom: 28,
  style: { background: "transparent", fontFamily: "var(--grot)", fontSize: "12px", color: "currentColor", overflow: "visible" },
});
const tipOpts = { fill: C.ink, stroke: "none", textPadding: 6, pointerSize: 0, fontSize: 12 } as const;

export function chart(spec: ChartSpec, width: number): SVGSVGElement | HTMLElement {
  if (spec.kind === "spark") {
    const h = spec.height ?? 36, last = spec.data[spec.data.length - 1];
    return Plot.plot({
      ...base(width, h), marginLeft: 0, marginRight: 6, marginTop: 6, marginBottom: 6, axis: null,
      y: { reverse: spec.y?.reverse, domain: spec.y?.domain, nice: false },
      marks: [
        Plot.lineY(spec.data, { x: "x", y: "y", stroke: C.ink, strokeWidth: 1.5, curve: "monotone-x" }),
        last ? Plot.dot([last], { x: "x", y: "y", r: 3.5, fill: C.acc, stroke: C.bg, strokeWidth: 2 }) : null,
      ],
    });
  }
  if (spec.kind === "dist") {
    const path = (S: { a: number; b: number; v: number }[]) => S.flatMap(x => [{ x: x.a, y: x.v }, { x: x.b, y: x.v }]);
    const B = path(spec.b), A = path(spec.a), mids = spec.b.map(x => ({ x: (x.a + x.b) / 2, y: x.v }));
    return Plot.plot({
      ...base(width, spec.height ?? 220),
      x: { label: null, tickSize: 0, tickFormat: (v: number) => `${v}`, ticks: Math.min(10, Math.ceil(Math.max(...[...A, ...B].map(p => p.x)))) },
      y: { grid: true, ticks: spec.y.ticks ?? 4, tickFormat: spec.y.fmt, reverse: spec.y.reverse, domain: spec.y.domain, label: null, tickSize: 0, nice: true },
      marks: [
        Plot.line(A, { x: "x", y: "y", stroke: C.cmp, strokeWidth: 3 }),
        Plot.line(B, { x: "x", y: "y", stroke: C.ink, strokeWidth: 2 }),
        Plot.ruleX(mids, Plot.pointerX({ x: "x", stroke: C.line })),
        Plot.tip(mids, Plot.pointerX({ x: "x", y: "y", title: (d: { x: number }) => spec.tip(d.x), ...tipOpts })),
      ],
    });
  }
  if (spec.kind === "hbars") {
    const h = spec.data.length * 28 + 8, max = Math.max(...spec.data.map(d => d.v), 1);
    return Plot.plot({
      ...base(width, h), marginLeft: 44, marginBottom: 4, marginTop: 4, marginRight: 56,
      x: { axis: null, domain: [0, max] }, y: { domain: spec.data.map(d => d.label), tickSize: 0, label: null },
      marks: [
        Plot.barX(spec.data, { y: "label", x: "v", fill: (_d: unknown, i: number) => (i === spec.acc ? C.acc : C.ink), insetTop: 6, insetBottom: 6, rx: 0 }),
        Plot.text(spec.data, { y: "label", x: "v", text: (d: { v: number }) => spec.fmt(d.v), dx: 6, textAnchor: "start", fill: C.ink }),
        Plot.tip(spec.data, Plot.pointerY({ y: "label", x: "v", title: (d: { label: string; v: number; tip?: string }) => d.tip ?? `${d.label}: ${spec.fmt(d.v)}`, ...tipOpts })),
      ],
    });
  }
  if (spec.kind === "bars") {
    const h = spec.height ?? 200, last = [...spec.data].reverse().find(d => !d.plan);
    const band = ((width - 60) / Math.max(1, spec.data.length)) * 0.75, inset = Math.max(0, (band - 24) / 2);
    return Plot.plot({
      ...base(width, h),
      x: { type: "band", tickFormat: (d: Date) => (d.getDate() <= 7 ? monthTick(d) : ""), tickSize: 0, padding: 0.25, label: null },
      y: { grid: true, ticks: spec.y.ticks ?? 4, tickFormat: spec.y.fmt, domain: spec.y.domain, label: null, tickSize: 0 },
      marks: [
        Plot.ruleY([0], { stroke: C.line }),
        Plot.barY(spec.data.filter(d => !d.plan), { x: "x", y: "y", fill: C.ink, insetLeft: inset, insetRight: inset }),
        Plot.barY(spec.data.filter(d => d.plan), { x: "x", y: "y", fill: "none", stroke: C.line, insetLeft: inset, insetRight: inset }),
        last ? Plot.barY([last], { x: "x", y: "y", fill: C.acc, insetLeft: inset, insetRight: inset }) : null,
        Plot.tip(spec.data, Plot.pointerX({ x: "x", y: "y", title: (d: Pt & { plan?: boolean }) => d.tip ?? `${dm(d.x)} · ${spec.y.fmt(d.y)}${d.plan ? " · за планом" : ""}`, ...tipOpts })),
      ],
    });
  }
  // line over time
  const h = spec.height ?? 220;
  const segPts = (spec.segs ?? []).map(g => ({ x: g.x2, y: g.y, tip: g.tip }));
  const all = [...spec.data, ...(spec.plan ?? []), ...(spec.dots ?? []), ...(spec.compare ?? []), ...(spec.lines ?? []).flatMap(l => l.data), ...segPts];
  const last = spec.data[spec.data.length - 1];
  const fmt = spec.y.fmt;
  const marks: Plot.Markish[] = [];
  const side = width >= 560 && (spec.bands ?? []).some(b => b.label);   // band names in a right margin
  (spec.bands ?? []).forEach(b => {
    marks.push(Plot.rectY([b], { x1: () => spec.x?.[0] ?? all[0]?.x, x2: () => spec.x?.[1] ?? all[all.length - 1]?.x, y1: "lo", y2: "hi", fill: b.strong ? C.band : "none" }));
    if (!b.strong) marks.push(Plot.ruleY([b.lo], { stroke: C.hair }));
    if (b.label && side) marks.push(Plot.text([b], { frameAnchor: "right", y: (d: Band) => (d.lo + d.hi) / 2, text: "label", fill: C.mute, textAnchor: "start", dx: 8 }));   // narrow: the legend names them
  });
  if (spec.ref) marks.push(Plot.ruleY([spec.ref.y], { stroke: C.acc, strokeDasharray: "4 3" }), Plot.text([spec.ref], { frameAnchor: "left", y: "y", text: "label", fill: C.mute, dy: -8, dx: 4, textAnchor: "start" }));
  if (spec.today) marks.push(Plot.ruleX([spec.today], { stroke: C.line }), Plot.text([spec.today], { x: (d: Date) => d, frameAnchor: "top", text: () => "сьогодні", fill: C.mute, dx: -4, dy: -14, textAnchor: "end" }));
  if (spec.area?.length) marks.push(Plot.areaY(spec.area, { x: "x", y1: "lo", y2: "hi", fill: C.band, curve: "monotone-x" }));
  (spec.lines ?? []).forEach(l => marks.push(Plot.lineY(l.data, { x: "x", y: "y", stroke: l.tone === "mute" ? C.mute : C.ink, strokeWidth: 1.5, strokeDasharray: l.dash ? "3 3" : undefined, curve: "monotone-x" })));
  (spec.segs ?? []).forEach(g => marks.push(
    Plot.ruleY([g], { x1: "x1", x2: "x2", y: "y", stroke: C.acc, strokeWidth: 3 }),
    Plot.text([g], { x: "x1", y: "y", text: "label", fill: C.mute, dy: 12, textAnchor: "start" })));
  if (spec.compare?.length) marks.push(Plot.lineY(spec.compare, { x: "x", y: "y", stroke: C.cmp, strokeWidth: 2, curve: "monotone-x" }));
  marks.push(Plot.lineY(spec.data, { x: "x", y: "y", stroke: C.ink, strokeWidth: 2, curve: spec.step ? "step-after" : "monotone-x" }));
  if (spec.plan?.length) marks.push(Plot.lineY(last ? [last, ...spec.plan] : spec.plan, { x: "x", y: "y", stroke: C.ink, strokeWidth: 1.5, strokeDasharray: "3 3", curve: "monotone-x" }));
  if (spec.dots?.some(d => d.square)) marks.push(Plot.dot(spec.dots.filter(d => d.square), { x: "x", y: "y", r: 4.5, symbol: "square", fill: C.ink, stroke: C.bg, strokeWidth: 1.5 }));
  if (spec.dots?.some(d => d.label)) marks.push(Plot.text(spec.dots.filter(d => d.label), { x: "x", y: "y", text: "label", fill: C.mute, dy: -10 }));
  if (spec.dots?.some(d => !d.square)) marks.push(Plot.dot(spec.dots.filter(d => !d.square), { x: "x", y: "y", r: 4, fill: (d: { key?: boolean; soft?: boolean }) => (d.soft ? C.bg : d.key ? C.acc : C.ink), stroke: (d: { soft?: boolean }) => (d.soft ? C.ink : C.bg), strokeWidth: 1.5 }));
  if (last && spec.end !== false) marks.push(
    Plot.dot([last], { x: "x", y: "y", r: 4.5, fill: C.acc, stroke: C.bg, strokeWidth: 2 }),
    Plot.tip([last], { x: "x", y: "y", title: (d: Pt) => fmt(d.y), anchor: "bottom", dy: -8, ...tipOpts }),
  );
  marks.push(
    Plot.ruleX(all, Plot.pointerX({ x: "x", stroke: C.line })),
    Plot.tip(all, Plot.pointerX({ x: "x", y: "y", title: (d: Pt) => d.tip ?? `${dm(d.x)} · ${fmt(d.y)}`, ...tipOpts })),
  );
  return Plot.plot({
    ...base(width, h), ...(side ? { marginRight: 96 } : {}),
    x: { type: "time", domain: spec.x, tickFormat: monthTick, ticks: "month", tickSize: 0, label: null },
    y: { grid: true, ticks: spec.y.ticks ?? 4, tickFormat: fmt, reverse: spec.y.reverse, domain: spec.y.domain, label: null, tickSize: 0, nice: true },
    marks,
  });
}
