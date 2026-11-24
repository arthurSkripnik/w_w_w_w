// Small shared helpers: dates as local YYYY-MM-DD strings, paces in seconds per km.
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const pc = (x: number) => Math.round(x * 100);

export function toSec(s: string | number | null | undefined): number | null {
  if (typeof s === "number") return s;
  const m = String(s ?? "").trim().replace(/\s*\/?\s*км$/i, "").match(/^(\d{1,2}):([0-5]\d)$/);
  return m ? +m[1] * 60 + +m[2] : null;
}
export function fmtPace(sec: number): string {
  sec = Math.round(sec);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
export const minTxt = (s: number) => `${Math.round(s / 60)} хв`;

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
export function mondayOf(iso: string): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return isoLocal(x);
}
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

export const median = (a: number[]): number | null => {
  const b = [...a].sort((x, y) => x - y), n = b.length;
  return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null;
};
