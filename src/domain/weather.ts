// Heat cost of a run, ported from v52 09a-weather.js.
const HEAT = { base: 15, k: 0.3 };
const TDP = [[100, 0], [110, 0.5], [120, 1], [130, 2], [140, 3], [150, 4.5], [160, 6], [170, 8], [180, 10]];
export const HOT_PCT = 2.5;
function dewPoint(t: number, rh: number) { const g = Math.log(rh / 100) + (17.62 * t) / (243.12 + t); return (243.12 * g) / (17.62 - g); }
/** % slower at the same HR from heat (and humidity when known). */
export function heatPct(t: number | null | undefined, rh?: number | null): number {
  if (typeof t !== "number") return 0;
  if (typeof rh !== "number") return Math.max(0, t - HEAT.base) * HEAT.k;
  const s = (t + Math.min(t, dewPoint(t, rh))) * 1.8 + 64;
  if (s <= TDP[0][0]) return 0;
  const i = TDP.findIndex(x => x[0] >= s); if (i < 0) return TDP[TDP.length - 1][1];
  const [a, pa] = TDP[i - 1], [b, pb] = TDP[i];
  return pa + ((pb - pa) * (s - a)) / (b - a);
}
// Valencia airport 1991–2020 monthly mean max / min, °C (AEMET)
const VLC_T = [[16.4, 7.1], [17.1, 7.7], [19.3, 9.6], [21, 11.6], [23.9, 14.9], [27.6, 18.8], [30.2, 21.8], [30.6, 22.3], [28.2, 19.4], [24.6, 15.5], [20, 10.9], [17.1, 8]];
function hourOf(h: number | undefined, name: string | undefined) {
  if (typeof h === "number") return h;
  const nm = String(name || "");
  return /morning/i.test(nm) ? 9 : /lunch/i.test(nm) ? 12.5 : /afternoon/i.test(nm) ? 15.5 : /night/i.test(nm) ? 22 : 19;
}
function diurnal(mn: number, mx: number, h: number) {
  const k = h >= 6 && h <= 15 ? 0.5 - 0.5 * Math.cos((Math.PI * (h - 6)) / 9) : 0.5 + 0.5 * Math.cos((Math.PI * ((h - 15 + 24) % 24)) / 15);
  return mn + (mx - mn) * k;
}
export interface RunTemp { t: number; rh: number | null; src: "strava" | "watch" | "norm" }
/** Temperature of a run: Strava's weather, else the watch sensor, else the Valencia normal for that date and hour. */
export function runTemp(date: string, temp: number | null, rh: number | null, fromWx: boolean, hour?: number, name?: string): RunTemp {
  if (typeof temp === "number") return { t: temp, rh: fromWx ? rh : null, src: fromWx ? "strava" : "watch" };
  const dt = new Date(date + "T00:00:00"), m = dt.getMonth(), f = (dt.getDate() - 15) / 30, m2 = (m + (f < 0 ? 11 : 1)) % 12, w = Math.abs(f);
  const mx = VLC_T[m][0] * (1 - w) + VLC_T[m2][0] * w, mn = VLC_T[m][1] * (1 - w) + VLC_T[m2][1] * w;
  return { t: Math.round(diurnal(mn, mx, hourOf(hour, name)) * 10) / 10, rh: null, src: "norm" };
}
