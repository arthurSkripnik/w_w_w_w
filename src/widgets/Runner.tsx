// The character's figure: a side-view runner drawn from joints (carried over from v52 avSvg).
// Speed → stride and lean, strength → limb thickness, endurance → vest, economy → heart, discipline → watch,
// level ≥ 5 → accent shoes, HP → gait. Animates only while on screen and never under reduced motion.
import { useEffect, useRef, useState } from "preact/hooks";
import type { Char } from "../domain/character";

interface Look { amp: number; lean: number; w: number; period: number; vest: boolean; heart: number | null; watch: boolean; band: boolean; shoes: boolean; mood: string }
export function lookOf(c: Char): Look {
  const m = c.mood.k, gait = { fresh: 1, ok: 0.85, tired: 0.6, over: 0.32 }[m], spd = c.S.spd ?? 30, str = c.S.str ?? 30;
  return { mood: m, amp: (22 + spd * 0.26) * gait, lean: (3 + spd * 0.09) * (m === "over" ? 0.3 : 1), w: 3.6 + str * 0.055,
    period: (780 - spd * 2.6) / (m === "over" ? 0.6 : m === "tired" ? 0.8 : 1),
    vest: (c.S.end ?? 0) >= 55, heart: c.S.eco, watch: (c.S.dis ?? 0) >= 70, band: spd >= 70, shoes: c.lvl >= 5 };
}
type P = { x: number; y: number };
const f = (p: P) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
function pose(L: Look, ph: number) {
  const r = Math.PI / 180, H = { x: 112, y: 120 - 4 * Math.abs(Math.cos(ph)) * (L.amp / 40) };
  const lean = L.lean * r, Sh = { x: H.x + 44 * Math.sin(lean), y: H.y - 44 * Math.cos(lean) };
  const down = L.mood === "tired" || L.mood === "over" ? 5 : 0;
  const head = { x: Sh.x + 17 * Math.sin(lean) + down * 0.6, y: Sh.y - 17 * Math.cos(lean) + down * 0.4 };
  const leg = (i: number) => { const p = ph + i * Math.PI, th = L.amp * Math.sin(p) * r, flex = (8 + L.amp * 1.9 * Math.max(0, Math.cos(p))) * r;
    const K = { x: H.x + 38 * Math.sin(th), y: H.y + 38 * Math.cos(th) }, sa = th - flex;
    const F = { x: K.x + 38 * Math.sin(sa), y: K.y + 38 * Math.cos(sa) };
    return { K, F, T: { x: F.x + 10 * Math.cos(sa * 0.5), y: F.y - 10 * Math.sin(sa * 0.5) } }; };
  const arm = (i: number) => { const p = ph + i * Math.PI, a = -L.amp * 0.85 * Math.sin(p) * r + lean;
    const E = { x: Sh.x + 27 * Math.sin(a), y: Sh.y + 27 * Math.cos(a) }, fa = a + (80 + 15 * Math.sin(p)) * r;
    return { E, Hd: { x: E.x + 24 * Math.sin(fa), y: E.y + 24 * Math.cos(fa) } }; };
  return { H, Sh, head, legs: [leg(0), leg(1)], arms: [arm(0), arm(1)] };
}

function Figure({ L, c, ph, beat, callouts }: { L: Look; c: Char; ph: number; beat: number; callouts: boolean }) {
  const p = pose(L, ph), w = L.w, tv = (t: number) => ({ x: p.H.x + (p.Sh.x - p.H.x) * t, y: p.H.y + (p.Sh.y - p.H.y) * t });
  const limb = (a: P, b: P, cc: P, back?: boolean) => <path class={back ? "rn-l rn-back" : "rn-l"} stroke-width={w} d={`M${f(a)} L${f(b)} L${f(cc)}`} />;
  const shoe = (i: number) => <path class={L.shoes ? "rn-a" : "rn-l"} stroke-width={w + 1.5} stroke-linecap="round" opacity={i ? 0.35 : 1} d={`M${f(p.legs[i].F)} L${f(p.legs[i].T)}`} />;
  const hc = tv(0.72), hs = ((0.45 + (L.heart ?? 0) / 200) * (1 + 0.18 * beat)).toFixed(2), knee = { x: (p.H.x + p.legs[0].K.x) / 2, y: (p.H.y + p.legs[0].K.y) / 2 };
  const co = (pt: P, y: number, txt: string) => <g class="rn-co"><circle cx={pt.x} cy={pt.y} r="2" /><path d={`M${f(pt)} L210 ${y} L222 ${y}`} /><text x="226" y={y + 4}>{txt}</text></g>;
  const wm = { x: p.arms[0].E.x + (p.arms[0].Hd.x - p.arms[0].E.x) * 0.72, y: p.arms[0].E.y + (p.arms[0].Hd.y - p.arms[0].E.y) * 0.72 };
  return <>
    <line x1="8" x2="312" y1="200" y2="200" class="rn-g" />
    {limb(p.Sh, p.arms[1].E, p.arms[1].Hd, true)}{limb(p.H, p.legs[1].K, p.legs[1].F, true)}{shoe(1)}
    <line class="rn-l" stroke-width={w + 2.5} x1={p.H.x} y1={p.H.y} x2={p.Sh.x} y2={p.Sh.y} />
    {L.vest && <line class="rn-a" stroke-width={w + 9} stroke-linecap="butt" x1={tv(0.38).x} y1={tv(0.38).y} x2={tv(0.92).x} y2={tv(0.92).y} />}
    {L.heart != null && <path class={L.vest ? "rn-hf rn-ink" : "rn-hf"} transform={`translate(${(hc.x + 3).toFixed(1)} ${hc.y.toFixed(1)}) scale(${hs})`} d="M0 6 C-9 0 -7 -8 0 -4 C7 -8 9 0 0 6Z" />}
    <circle class="rn-h" stroke-width={Math.max(2, w * 0.6)} cx={p.head.x} cy={p.head.y} r="12" />
    {L.band && <path class="rn-a" stroke-width="3.5" d={`M${(p.head.x - 11.5).toFixed(1)} ${(p.head.y - 3).toFixed(1)} L${(p.head.x + 11.5).toFixed(1)} ${(p.head.y - 5).toFixed(1)} M${(p.head.x - 11).toFixed(1)} ${(p.head.y - 3.5).toFixed(1)} l-9 4`} />}
    {limb(p.H, p.legs[0].K, p.legs[0].F)}{shoe(0)}{limb(p.Sh, p.arms[0].E, p.arms[0].Hd)}
    {L.watch && <circle class="rn-hf" cx={wm.x} cy={wm.y} r={w * 0.75 + 1} />}
    {callouts && <>{co(tv(0.72), 64, `ЕКН ${c.S.eco ?? "—"}`)}{co(tv(0.3), 104, `ВИТ ${c.S.end ?? "—"}`)}{co(knee, 144, `СИЛ ${c.S.str ?? "—"}`)}<text class="rn-co" x="226" y="186">ШВД {c.S.spd ?? "—"}</text></>}
  </>;
}

export function Runner({ c, callouts = true }: { c: Char; callouts?: boolean }) {
  const L = lookOf(c), ref = useRef<SVGSVGElement>(null), [t, setT] = useState<{ ph: number; beat: number }>({ ph: 0.9, beat: 0 });
  useEffect(() => {
    const el = ref.current; if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    let raf = 0, t0 = 0;
    const tick = (now: number) => { t0 ||= now; setT({ ph: 0.9 + ((now - t0) / L.period) * 2 * Math.PI, beat: Math.max(0, Math.sin(now / ((1000 - (L.heart ?? 40) * 5) / Math.PI))) }); raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); raf = 0; if (e.isIntersecting) raf = requestAnimationFrame(tick); });
    io.observe(el); return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [L.period, L.heart]);
  return <svg ref={ref} class="runner" viewBox={callouts ? "0 36 320 174" : "40 36 180 174"} role="img"
    aria-label={`Бігун: ${c.cls.name}, рівень ${c.lvl}, стан ${c.mood.name.toLowerCase()}`}>
    <Figure L={L} c={c} ph={t.ph} beat={t.beat} callouts={callouts} />
  </svg>;
}
