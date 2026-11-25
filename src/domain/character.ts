// Персонаж: the runner as an RPG character, built only from numbers the app already has (the 10 km forecast,
// the form %, the aerobic base, the runs and the plan). Nothing here is stored; it never changes the plan.
// Stats are 1–99 over the last 28 days; formulas carried over from v52 (11-avatar.js) unchanged.
import type { Day } from "./days";
import type { Run } from "../data/schema";
import type { EasyPt } from "./aerobic";
import { dayState } from "./home";
import { addDays, mondayOf } from "./util";

export const WIN = 28;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type StatK = "spd" | "end" | "str" | "eco" | "dis";
/** Each stat names the widget it comes from, so the character never holds a number of its own. */
export const STATS: { k: StatK; code: string; name: string; tip: string; from: { label: string; href: string } }[] = [
  { k: "spd", code: "ШВД", name: "Швидкість", tip: "інтервали VO2max, порогові відрізки, швидкі фініші", from: { label: "Прогноз 10 км", href: "#lab" } },
  { k: "end", code: "ВИТ", name: "Витривалість", tip: "довгі пробіжки й тижневий обсяг", from: { label: "Об'єм тижня", href: "#lab" } },
  { k: "str", code: "СИЛ", name: "Сила", tip: "пагорби й відрізки в Z4–Z5", from: { label: "Час у зонах пульсу", href: "#lab" } },
  { k: "eco", code: "ЕКН", name: "Економність", tip: "легкі дні в легкому темпі з пульсом до стелі", from: { label: "Аеробна база", href: "#lab" } },
  { k: "dis", code: "ДСЦ", name: "Дисципліна", tip: "тренування за планом без пропусків, легкі дні справді легкі", from: { label: "Календар", href: "#calendar" } },
];
const BODY: StatK[] = ["spd", "end", "str", "eco"];
export const CLASSES: Record<string, { name: string; desc: string; beh: string }> = {
  "spd+end": { name: "Темповик", desc: "Тримає високий темп довго. Природжений бігун на 10 км.", beh: "На довгих сам розганяється, на відновлювальних нудьгує." },
  "spd+str": { name: "Мілер", desc: "Різкий і швидкий, живе інтервалами й фінішними ривками.", beh: "Рветься на відрізки, після 15 км починає шукати фініш." },
  "spd+eco": { name: "Стріла", desc: "Легкий хід і швидкість без зайвих витрат пульсу.", beh: "Біжить швидко й тихо, пульс росте повільніше, ніж темп." },
  "end+str": { name: "Трейлраннер", desc: "Міцний і витривалий, гірки його не лякають.", beh: "Довгий біг з підйомами для нього розвага, а не покарання." },
  "end+eco": { name: "Дизель", desc: "Аеробна машина: годинами на низькому пульсі.", beh: "Може бігти вічно, але на коротких відрізках розкочується повільно." },
  "str+eco": { name: "Кросовик", desc: "Сильні ноги й економний хід, тримає будь-яке покриття.", beh: "Не боїться рельєфу й вітру, темп тримає рівно." },
  all: { name: "Універсал", desc: "Усі характеристики близькі. Без явних слабких місць і без коронки.", beh: "Однаково впевнено бере і довгий біг, і інтервали." },
};
export const MOODS = [
  { min: 70, k: "fresh", name: "Свіжий", line: "Рветься в бій. Добрий день для якісного тренування." },
  { min: 45, k: "ok", name: "У тонусі", line: "Втома є, але робоча. Тренування за планом." },
  { min: 25, k: "tired", name: "Втомлений", line: "Тягне ноги після важких днів. Легкий біг піде на користь." },
  { min: 0, k: "over", name: "Перевантажений", line: "Перейшов на крок. Потрібен відпочинок або дуже легкий день." },
] as const;

export interface CharIn {
  today: string; days: Day[]; runs: Run[]; easy: EasyPt[]; ceil: number;
  t10: number | null; goal10: number | null; formR: number | null; loads: Record<string, number>;
}
export interface Char {
  S: Record<StatK, number | null>; src: Record<StatK, string>; spdGoal: number | null;
  hp: number; formR: number; km: number; lvl: number; lvlFrom: number; lvlTo: number; xpPct: number;
  cls: { name: string; desc: string; beh: string; top: StatK[] }; mood: (typeof MOODS)[number]; weak: StatK | null;
  loads: number[]; longest: number; wkKm: number;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const pace = (s: number) => mmss(s);
/** 10 km time → speed 1–99: 60:00 is 1, 27:00 is 99. */
export const spdOf = (T: number) => clamp(Math.round(((3600 - T) / (3600 - 1620)) * 99), 1, 99);
/** XP is km since the plan began; level n needs 10·n·(n−1) km. */
export function levelOf(km: number) { let l = 1; while (10 * (l + 1) * l <= km) l++; return { lvl: l, from: 10 * l * (l - 1), to: 10 * (l + 1) * l }; }

export function classOf(S: Record<StatK, number | null>) {
  const body = BODY.map(k => ({ k, v: S[k] ?? 30 })).sort((a, b) => b.v - a.v);
  if (body[0].v - body[3].v < 8) return { ...CLASSES.all, top: [] as StatK[] };
  const top = [body[0].k, body[1].k], key = [...top].sort((a, b) => BODY.indexOf(a) - BODY.indexOf(b)).join("+");
  return { ...CLASSES[key], top };
}

export function character(I: CharIn): Char {
  const from = addDays(I.today, -WIN + 1), inWin = (d: string) => d >= from && d <= I.today;
  const runs = I.runs.filter(r => r.source !== "archive");
  const win = runs.filter(r => inWin(r.date));
  const S = {} as Record<StatK, number | null>, src = {} as Record<StatK, string>;

  S.spd = I.t10 ? spdOf(I.t10) : null;
  const spdGoal = I.goal10 ? spdOf(I.goal10) : null;
  src.spd = I.t10 ? `Прогноз 10 км ${mmss(I.t10)}${I.goal10 ? ` · ціль ${mmss(I.goal10)} = ${spdGoal}` : ""}` : "Немає порогу";

  const wkKm = win.reduce((a, r) => a + r.km, 0) / (WIN / 7), from42 = addDays(I.today, -41);
  const longest = Math.max(0, ...runs.filter(r => r.date >= from42 && r.date <= I.today).map(r => r.km));
  S.end = clamp(Math.round(0.6 * clamp(wkKm / 100, 0, 1) * 99 + 0.4 * clamp(longest / 30, 0, 1) * 99), 1, 99);
  src.end = `≈${wkKm.toFixed(0)} км на тиждень · найдовша ${longest.toFixed(1)} км за 6 тижнів`;

  const z45 = win.reduce((a, r) => a + (!r.exclude && r.stream?.hrz ? (r.stream.hrz[3] + r.stream.hrz[4]) / 60 : 0), 0);
  const hills = I.days.filter(d => inWin(d.date) && d.act === "hills" && d.run && !d.run.exclude).length;
  S.str = clamp(Math.round(99 * (1 - Math.exp(-(z45 + hills * 8) / 45))), 1, 99);
  src.str = `${Math.round(z45)} хв у Z4–Z5${hills ? ` · пагорбів ${hills}` : ""}`;

  const ee = I.easy.filter(x => inWin(x.d)), norm = ee.length ? ee.reduce((a, x) => a + x.norm, 0) / ee.length : null;
  S.eco = norm ? clamp(Math.round(((380 - norm) / 160) * 99), 1, 99) : null;
  src.eco = norm ? `Легкий темп на пульсі 145 і в прохолоду: ${pace(norm)} /км · ${ee.length} пробіжок` : "Немає легких пробіжок за 28 днів";

  const past = I.days.filter(d => inWin(d.date) && d.date < I.today), done = past.filter(d => dayState(d) === "done").length;
  const easyOk = ee.filter(x => x.hr <= I.ceil + 2).length;
  S.dis = past.length ? clamp(Math.round(99 * (0.7 * (done / past.length) + 0.3 * (ee.length ? easyOk / ee.length : 1))), 1, 99) : null;
  src.dis = `Зроблено ${done}/${past.length} за планом · легких на пульсі ≤${I.ceil}: ${easyOk}/${ee.length}`;

  const formR = I.formR ?? 100, hp = clamp(Math.round((100 - formR + 30) * 2), 3, 100);
  const start = I.days[0]?.date ?? I.today, km = runs.filter(r => r.date >= start && r.date <= I.today).reduce((a, r) => a + r.km, 0);
  const L = levelOf(km), known = STATS.filter(s => S[s.k] != null);
  const weak = known.length ? known.reduce((a, b) => (S[b.k]! < S[a.k]! ? b : a)).k : null;
  const loads = Array.from({ length: WIN }, (_, i) => I.loads[addDays(I.today, i - WIN + 1)] ?? 0);
  return { S, src, spdGoal, hp, formR, km, lvl: L.lvl, lvlFrom: L.from, lvlTo: L.to, xpPct: ((km - L.from) / (L.to - L.from)) * 100,
    cls: classOf(S), mood: MOODS.find(m => hp >= m.min)!, weak, loads, longest, wkKm };
}

/** The race as a boss: its strength is the goal, the hit is the forecast now; ready = how much of the gap is closed. */
export function boss(t10: number, goal10: number, atRace: number | null) {
  const gap = t10 - goal10;
  return { gap, ready: clamp(Math.round((1 - Math.max(0, gap) / (goal10 * 0.1)) * 100), 0, 100), atRace };
}

export interface Perk { ic: string; n: string; ok: boolean; s: string }
export function perks(I: { today: string; days: Day[]; runs: Run[]; easy: EasyPt[]; ceil: number; racePace: number; refRace: { type: string; sec: number } | null }): Perk[] {
  const runs = I.runs.filter(r => r.source !== "archive" && r.date <= I.today);
  const wk: Record<string, number> = {}; runs.forEach(r => { const m = mondayOf(r.date); wk[m] = (wk[m] ?? 0) + r.km; });
  const wkMax = Math.max(0, ...Object.values(wk)), longAll = Math.max(0, ...I.runs.map(r => r.km));
  const rp = I.racePace, fastRep = I.days.some(d => d.report && !d.run?.exclude && ((d.report.reps ?? []).some(r => r.pace && r.pace <= rp) || (d.report.work?.pace && d.report.work.pace <= rp)));
  const last14 = I.days.filter(d => d.date < I.today && d.date >= addDays(I.today, -14));
  const noMiss = last14.length >= 6 && last14.every(d => dayState(d) === "done");
  let streak = 0, best = 0; [...I.easy].sort((a, b) => a.d.localeCompare(b.d)).forEach(x => { streak = x.hr <= I.ceil ? streak + 1 : 0; best = Math.max(best, streak); });
  const tt = I.days.find(d => d.type === "tt5k"), race = I.days.find(d => d.type === "race"), dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);
  const ref = I.refRace;
  return [
    { ic: "/\\_/\\", n: "Півмарафонець", ok: ref?.type === "FastestHalfMarathon", s: ref?.type === "FastestHalfMarathon" ? `Найкращий півмарафон ${hms(ref.sec)}` : "Півмарафон у Strava" },
    { ic: "====>", n: "Довгий 20+", ok: longAll >= 20, s: longAll >= 20 ? `Найдовша ${longAll.toFixed(1)} км` : `Поки ${longAll.toFixed(1)} з 20 км` },
    { ic: "#####", n: "Тиждень 80+ км", ok: wkMax >= 80, s: `Найбільший тиждень ${wkMax.toFixed(0)} км` },
    { ic: ">>", n: "Темп цілі", ok: fastRep, s: `Відрізок швидше ${pace(rp)} /км` },
    { ic: "[OK]", n: "Без пропусків", ok: noMiss, s: "14 днів за планом" },
    { ic: "-_-_-", n: "Спокійне серце", ok: best >= 4, s: `${best} легких поспіль на пульсі ≤${I.ceil}, треба 4` },
    { ic: "5K", n: "Контрольні 5 км", ok: !!tt?.run, s: tt ? (tt.run ? "Пройдено" : `Відкриється ${dm(tt.date)}`) : "Немає в плані" },
    { ic: "10K!", n: "Переможець боса", ok: !!(race?.run && race.run.km >= 9.9), s: race ? `Старт ${dm(race.date)}` : "Немає старту" },
  ];
}
const hms = (s: number) => { const h = Math.floor(s / 3600); return h ? `${h}:${mmss(s % 3600).padStart(5, "0")}` : mmss(s); };
