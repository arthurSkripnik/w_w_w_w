import { useEffect, useRef } from "preact/hooks";
import { chart, type ChartSpec } from "./chart";

/** A chart that fits its container width and redraws on resize. `label` describes it for screen readers. */
export function Chart({ spec, label, legend }: { spec: ChartSpec; label: string; legend?: { k: "ink" | "acc" | "cmp" | "band"; text: string }[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!; let w = 0;
    const draw = () => {
      const nw = Math.floor(el.clientWidth); if (!nw || nw === w) return; w = nw;
      const svg = chart(spec, w); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label);
      el.replaceChildren(svg);
    };
    draw();
    const ro = new ResizeObserver(() => draw()); ro.observe(el);
    return () => ro.disconnect();
  }, [spec, label]);
  return (
    <figure class="chart-fig" style="margin:0">
      {legend && <div class="chart-legend">{legend.map(l => <span key={l.text}><i data-k={l.k} />{l.text}</span>)}</div>}
      <div class="chart" ref={box} />
    </figure>
  );
}
