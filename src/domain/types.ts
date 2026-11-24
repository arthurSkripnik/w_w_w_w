// Session types as v52 described them (01-plan.js TYPE): name, effort category, short name and the zone of the work.
export interface TypeInfo { name: string; cat: "z1" | "z2" | "z3" | "race"; abbr: string; work: "z1" | "rec" | "z2" | "z3" | "tt" | "race" | null; workLbl?: string }
export const TYPE: Record<string, TypeInfo> = {
  base: { name: "Базовий біг", cat: "z1", abbr: "БАЗ", work: "z1", workLbl: "Середній темп" },
  recovery: { name: "Відновлювальний біг", cat: "z1", abbr: "ВІДН", work: "rec", workLbl: "Середній темп" },
  long: { name: "Довгий біг", cat: "z1", abbr: "ДОВГ", work: "z1", workLbl: "Середній темп" },
  longfartlek: { name: "Довгий біг з фартлеком", cat: "z2", abbr: "ДФАР", work: "z2", workLbl: "Темп прискорень (2 хв)" },
  fastfinish: { name: "Біг зі швидким фінішем", cat: "z2", abbr: "ШФ", work: "z2", workLbl: "Темп швидкого фінішу" },
  fartlek: { name: "Фартлек", cat: "z2", abbr: "ФАРТ", work: "z3", workLbl: "Темп швидких відрізків (2 хв)" },
  pyramid: { name: "Фартлек-піраміда", cat: "z2", abbr: "ПІР", work: "z3", workLbl: "Темп швидких відрізків (2–4 хв)" },
  hills: { name: "Повтори на пагорбах", cat: "z3", abbr: "ПАГ", work: null },
  shortint: { name: "Короткі інтервали (VO2max)", cat: "z3", abbr: "VO2", work: "z3", workLbl: "Темп робочих відрізків (2–3 хв)" },
  longint: { name: "Довгі інтервали (поріг)", cat: "z3", abbr: "ПОР", work: "z2", workLbl: "Темп робочих відрізків (6–8 хв)" },
  mixedint: { name: "Змішані інтервали", cat: "z3", abbr: "МІКС", work: "z2", workLbl: "Темп 5-хв відрізків у пороговій зоні" },
  tt5k: { name: "Контрольні 5 км", cat: "z3", abbr: "5К", work: "tt", workLbl: "Середній темп 5 км" },
  race: { name: "Гонка", cat: "race", abbr: "10K", work: "race", workLbl: "Середній темп гонки" },
  start: { name: "Старт", cat: "race", abbr: "СТАРТ", work: null },
};
export const typeOf = (t: string): TypeInfo => TYPE[t] ?? { name: t, cat: "z1", abbr: t.slice(0, 4).toUpperCase(), work: null };
export const CAT: Record<TypeInfo["cat"], string> = { z1: "Легке тренування", z2: "Помірне тренування", z3: "Важке тренування", race: "Старт" };
export const PH_NAME: Record<string, string> = { base: "Базовий період", peak: "Піковий період", taper: "Підводка" };
export const RPE_TARGET: Record<TypeInfo["cat"], [number, number]> = { z1: [2, 4], z2: [5, 7], z3: [8, 10], race: [8, 10] };
/** Zone names as they read inside a sentence. */
export const ZONE_TXT: Record<string, string> = { rec: "відновний", z1: "легкий", z2: "пороговий", z3: "швидкий", race: "цільовий", tt: "еквівалент цілі на 10 км" };
