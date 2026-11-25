// База тренувань: reference tables built from the same code that runs the plan, so they follow every change.
// Ported from v52 12-library.js, 13-strength.js (renderGymLib) and 14-theory.js.
import type { Day } from "./days";
import type { Zones } from "./zones";
import { zoneRange, hrCeil } from "./zones";
import { dur, LOAD_W, FIXED_T, THR_TO_10K, K5_TO_10K, K5_TO_THR, RIEGEL, eq10, HM_KM } from "./spec";
import { gen, type Steps } from "./text";
import { typeOf, RPE_TARGET } from "./types";
import { EQ } from "./lab";
import { fmtPace, addDays, mondayOf, daysBetween } from "./util";
import { mmss, plural } from "./home";
import { ZONE_NAME } from "../data/schema";

export const LIB_ORDER = ["base", "recovery", "long", "longfartlek", "fastfinish", "fartlek", "pyramid", "hills", "shortint", "longint", "mixedint", "tt5k", "race", "start"];

/** Pace of the work part as text, or null for effort-based sessions (hills, start). */
export function planPace(t: string, Z: Zones): { zone: string; pace: string } | null {
  const w = typeOf(t).work; if (!w) return null;
  const r = zoneRange(w, Z), name = w === "tt" ? "еквівалент цілі" : ZONE_NAME[w as keyof typeof ZONE_NAME];
  const pace = w === "tt" ? `${fmtPace(r.fast)} /км (${mmss(r.fast * 5)} на 5 км)` : w === "race" ? `${fmtPace(r.fast)} /км` : `${fmtPace(r.fast)}–${fmtPace(r.slow)} /км`;
  return { zone: name[0].toUpperCase() + name.slice(1), pace };
}

export interface TypeRow {
  t: string; name: string; abbr: string; cat: string; fixed: boolean;
  lvl: number;                 // the level the text is shown at: the plan's median for that type
  steps: Steps; pace: { zone: string; pace: string } | null;
  load: number; rpe: [number, number]; eq: string | null;
  n: number; levels: number[]; mins: string; next: string | null; done: number;
}
export function typeRows(days: Day[], Z: Zones, today: string): TypeRow[] {
  return LIB_ORDER.map(t => {
    const T = typeOf(t), evs = days.filter(d => d.type === t), ls = [...new Set(evs.map(d => d.level))].sort((a, b) => a - b);
    const fixed = FIXED_T.includes(t), sorted = evs.map(d => d.level).sort((a, b) => a - b);
    const lvl = fixed ? 0 : sorted.length ? sorted[Math.floor(sorted.length / 2)] : 3;
    const m = (l: number) => dur(t, l) ?? 0;
    const mins = fixed ? `${m(0)} хв` : ls.length > 1 ? `${m(ls[0])}–${m(ls[ls.length - 1])} хв` : `${m(ls[0] ?? lvl)} хв`;
    return { t, name: T.name, abbr: T.abbr, cat: T.cat, fixed, lvl, steps: gen(t, Math.max(fixed ? 0 : 1, lvl), Z), pace: planPace(t, Z),
      load: LOAD_W[t] ?? 1, rpe: RPE_TARGET[T.cat], eq: EQ[t]?.lbl ?? null,
      n: evs.length, levels: ls, mins, next: evs.find(d => d.date >= today)?.date ?? null, done: evs.filter(d => d.run).length };
  });
}
export const inPlanTxt = (r: TypeRow) => !r.n ? (r.t === "start" ? "Ставиться з картки дня: «Позначити старт»" : "Немає в плані")
  : `${r.n} ${plural(r.n, "раз", "рази", "разів")}${r.fixed ? "" : ` · Р${r.levels[0]}${r.levels.length > 1 ? "–" + r.levels[r.levels.length - 1] : ""}`}`;

/** Middle of the easy pace, for rough km from minutes. */
export const easyMid = (Z: Zones) => (Z.z1.fast + Z.z1.slow) / 2;

/** Strava best-effort types usable as a reference race. */
export const REF: Record<string, [number, string]> = { Fastest5k: [5, "5 км"], Fastest10k: [10, "10 км"], FastestHalfMarathon: [HM_KM, "півмарафону"], FastestMarathon: [42.195, "марафону"] };
/** A decimal with a comma, as Ukrainian writes it. */
export const dec = (n: number | string) => String(n).replace(".", ",");
/** Coefficients the plan computes with, filled with today's numbers. */
export interface Coef { k: string; f: string; v: string; sm?: string }
export function coefs(Z: Zones, goalPace: number, ref: { type: string; sec: number } | null, hrFromStrava: boolean): Coef[] {
  const thr = Z.thrPace, hr = Z.thrHR, fc = thr * THR_TO_10K, gap = Math.round(fc * 10 - goalPace * 10), goal5 = goalPace / K5_TO_10K, now5 = thr / K5_TO_THR;
  const R = ref ? REF[ref.type] : undefined, rk = R?.[0];
  return [
    { k: "Прогноз на 10 км", f: `темп = поріг × ${dec(THR_TO_10K)}`, v: mmss(fc * 10), sm: `${fmtPace(fc)} /км` },
    { k: "Розрив до цілі", f: "прогноз − ціль", v: gap <= 0 ? "0:00" : mmss(gap), sm: gap <= 0 ? "ціль у прогнозі" : `${dec((gap / 10).toFixed(1))} с/км` },
    { k: "5 км → 10 км", f: `темп 10 км = темп 5 км × ${dec(K5_TO_10K)}`, v: `×${dec(K5_TO_10K)}` },
    { k: "5 км → поріг", f: `поріг = темп 5 км × ${dec(K5_TO_THR)}`, v: `×${dec(K5_TO_THR)}` },
    { k: "5 км у темпі цілі", f: `ціль ÷ 10 ÷ ${dec(K5_TO_10K)}`, v: mmss(goal5 * 5), sm: `${fmtPace(goal5)} /км` },
    { k: "5 км з поточним порогом", f: `поріг ÷ ${dec(K5_TO_THR)}`, v: mmss(now5 * 5), sm: `${fmtPace(now5)} /км` },
    { k: "Інша дистанція → 10 км", f: `формула Рігеля: T₂ = T₁ × (D₂/D₁)^${dec(RIEGEL)}`, v: ref && rk ? mmss(eq10(rk, ref.sec) * 10) : "—", sm: ref && rk ? `з ${R![1]} ${mmss(ref.sec)}` : "немає еталонного старту" },
    { k: "Пульс на порогових відрізках", f: "≈ пульс порогу", v: `≈${hr}`, sm: "уд/хв" },
    { k: "Пульс на VO2max-відрізках", f: "пульс порогу + 8 … + 14", v: `${hr + 8}–${hr + 14}`, sm: "уд/хв" },
    { k: "Стеля легкого дня", f: hrFromStrava ? "верх пульсової Z2 у Strava" : "0,88 × пульс порогу", v: String(hrCeil(Z)), sm: "уд/хв" },
    { k: "Кілометри тижня", f: "хвилини ÷ середина легкого темпу", v: fmtPace(easyMid(Z)), sm: "/км, середина легкого" },
  ];
}

// ---- strength ----
export const GYM_NOTES = ["Стрибки (pogo, багатоскоки, тумба) без ваги весь час: якість і короткий контакт, не кількість.",
  "Стартові ваги для Б орієнтовні: перше заняття Б покаже реальні, тоді поправимо таблицю."];
/** Weight of an exercise on a date: the shortest span that holds it (the 5 km test week sits inside a longer one). */
export function weightOn(ws: { from: string; to: string; w: string }[] | undefined, d: string): string | null {
  const rs = (ws ?? []).filter(r => d >= r.from && d <= r.to);
  return rs.length ? rs.reduce((a, r) => (daysBetween(r.from, r.to) < daysBetween(a.from, a.to) ? r : a)).w : null;
}
export interface GymRow { id: string; name: string; min: number; dates: string[]; next: string | null; at: string; ex: { name: string; dose: string; w: string | null }[]; rules: string[] }
export function gymRows(days: Day[], today: string): GymRow[] {
  const by = new Map<string, Day[]>();
  days.forEach(d => { if (d.gym && d.gym.sport === "strength") by.set(d.plan.gym!, [...(by.get(d.plan.gym!) ?? []), d]); });
  return [...by.entries()].map(([id, ds]) => {
    const g = ds[0].gym as Extract<NonNullable<Day["gym"]>, { sport: "strength" }>, dates = ds.map(d => d.date).sort();
    const next = dates.find(d => d >= today) ?? null, at = next ?? dates[dates.length - 1];
    return { id, name: g.name, min: g.min, dates, next, at, ex: g.exercises.map(e => ({ name: e.name, dose: e.dose, w: weightOn(e.weights, at) })), rules: g.rules ?? [] };
  }).sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

// ---- rules and theory (text as v52 wrote it; **x** is bold) ----
export const RULES: [string, string][] = [
  ["Джерело форми", "Поріг з годинника. Його вводиш у Профілі («Поріг і ціль» → «Записати») і план перераховується."],
  ["Що змінює поріг", "Усі зони, темпи в описах тренувань, прогноз на 10 км і кілометри тижня. Хвилини й повтори від порогу не залежать."],
  ["Що змінює рівень", "Кількість повторів і хвилин. «Легше / За планом / Довше» у картці дня це рівень −2 / 0 / +2 (не нижче 1). Вибір запам’ятовується і рахується в обсязі."],
  ["Факт і Strava", "Темп, пульс, RPE і звіти зі Strava лише порівнюються з планом і йдуть у прогрес. План сам себе не коригує: зміни робиш ти (поріг, рівень, перенесення, старт)."],
];
export const THEORY: [string, string | null][] = [
  ["Як ти стаєш швидшим", "Результат на 10 км тримається на трьох речах. **VO2max**: скільки кисню організм може використати, це стеля (короткі інтервали у швидкому темпі). **Поріг**: яку частку цієї стелі ти тримаєш довго без накопичення втоми (довгі інтервали й швидкий фініш у пороговому темпі). **Економічність**: скільки енергії йде на кілометр (об’єм, прискорення, сила). Легкий біг будує основу для всіх трьох: більше капілярів і мітохондрій у м’язах. Тому більшість хвилин легкі, а важкі дні мають сенс, лише коли ти до них свіжий."],
  ["Навіщо сила", "Важкі вправи на мало повторів і стрибки роблять м’язи й сухожилля «жорсткішими»: нога краще віддає енергію при поштовху, і той самий темп коштує менше. Огляди досліджень показують покращення економічності бігу на кілька відсотків без втрати витривалості. Друга користь: менше травм при великому об’ємі. При двох коротких сесіях на тиждень і такому бігу масу ти не набереш. Сила йде в день важкого бігу, щоб легкі дні лишались легкими, і ніколи напередодні ключового тренування. Перші 2 тижні бери легшу вагу: м’язи болітимуть з незвички."],
  ["Тейпер", "За 2 тижні до старту об’єм падає на 40–60%, а інтенсивність лишається: короткі швидкі відрізки тримають «гостроту». Так знімається накопичена втома, а форма за 2 тижні не втрачається. Дослідження показують приріст результату зазвичай на 2–3%. У перші дні тейпера ноги часто здаються важкими, а самопочуття дивним. Це нормально, не додавай тренувань «для впевненості»."],
  ["План гонки", null],
  ["Психологічна підготовка", "Втома на 6–8 км очікувана, це не сигнал зупинитись. Три інструменти, які варто тренувати заздалегідь. **Фрази**: 2–3 короткі й позитивні («рівно», «легкі плечі», «я тут для цього»), повторюй на порогових відрізках. У дослідженні мотиваційні фрази подовжили час до виснаження приблизно на 18%. **Візуалізація**: 2–3 хв перед ключовими тренуваннями уявляй старт, важкий момент на 7 км і фініш, з деталями: звук, дихання, темп на годиннику. **Сегментація**: не думай про 10 км, думай про наступний кілометр. Контрольні 5 км проведи як репетицію: та сама розминка, їжа, взуття і фрази."],
  ["День старту", "Звичний сніданок за 3 год до старту, нічого нового: ні їжі, ні взуття, ні гелів. Кава або кофеїн (3 мг на кг ваги) за 45–60 хв помітно допомагає, але спершу перевір на тренуванні. Розминка 15 хв легко, 3–4 прискорення по 20 с і 1–2 хв у темпі цілі, закінчи за 10 хв до старту. Стань у стартовий коридор за своїм часом, щоб не обганяти людей на першому км."],
  ["Відновлення", "Форма росте не на тренуванні, а після нього. Найбільший вплив має сон: 7–9 год, особливо в тижні з важкими днями. Легкий день справді легкий, нижче стелі пульсу: якщо його пробігти швидше, наступне ключове тренування вийде гіршим. Після важкої сесії їж вуглеводи й білок протягом години."],
];
/** Split «**bold**» text into plain and bold parts. */
export const boldParts = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((x, i) => ({ x, b: i % 2 === 1 }));
