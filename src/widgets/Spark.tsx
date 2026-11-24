import { Chart } from "../ui/Chart";
const D = (iso: string) => new Date(iso + "T00:00:00");
/** A number tile's sparkline: values over dates, `up` = higher is better (pace: pass up=false to put faster on top). */
export function Spark({ label, pts, up = true }: { label: string; pts: { d: string; v: number | null }[]; up?: boolean }) {
  const data = pts.filter(p => p.v != null).map(p => ({ x: D(p.d), y: p.v as number }));
  return data.length > 1 ? <Chart label={label} spec={{ kind: "spark", data, y: { reverse: !up } }} /> : null;
}
