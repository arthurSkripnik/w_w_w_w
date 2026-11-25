// The run journal: one set of questions for the form after a run, the day card and the coach chat (run-journal skill),
// so a manual entry and a chat entry land in the same fields of journal/<date> and injuries/<id>.
import type { Journal, Injury } from "../data/schema";
import { addDays } from "./util";

export const FEEL = ["легко", "нормально", "важко", "дуже важко"] as const;
export const LEGS = ["свіжі", "трохи важкі", "важкі", "важкі і болять"] as const;
export const PAIN = ["нема", "ледь відчув", "є, не міняв ходу", "є, змінив ходу"] as const;
export const FUEL = ["все ок", "мало їв", "шлунок турбував"] as const;
export const FIT = ["так", "легше", "важче", "змінив структуру"] as const;
export const SIDES: Injury["side"][] = ["Л", "П", "обидві"];
/** RPE suggested from «самопочуття», as the skill maps the letter codes. */
export const FEEL_RPE: Record<string, number> = { легко: 3, нормально: 5, важко: 7, "дуже важко": 9 };

export interface Answers {
  feel: string | null; legs: string | null; rpe: number | null; sleepH: number | null; fuel: string | null; fit: string | null;
  pain: string | null; area: string | null; side: Injury["side"] | null; note: string; pace?: string; hr?: number | null;
}
export const fromJournal = (J: Journal | null): Answers => {
  const p = J?.pains ? Object.entries(J.pains)[0] : null;
  return { feel: J?.feel ?? null, legs: J?.legs ?? null, rpe: typeof J?.rpe === "number" ? J.rpe : null, sleepH: J?.sleepH ?? null, fuel: J?.fuel ?? null,
    fit: J?.fit ?? null, pain: p ? p[1] : J ? "нема" : null, area: p ? p[0] : null, side: null, note: J?.note ?? "", pace: J?.manual?.pace, hr: J?.manual?.hr ?? null };
};
/** Level of the injury log from the pain answer: «ледь» 1, «є» 2, «змінив ходу» 3; none for «нема». */
export const painLevel = (p: string | null): 1 | 2 | 3 | null => (p === PAIN[1] ? 1 : p === PAIN[2] ? 2 : p === PAIN[3] ? 3 : null);

/** What the form writes into journal/<date>: only the answered fields, so a chat entry is merged, not erased. */
export function journalPatch(a: Answers): Partial<Journal> {
  const out: Partial<Journal> = {};
  if (a.feel) out.feel = a.feel; if (a.legs) out.legs = a.legs; if (a.rpe != null) out.rpe = a.rpe; if (a.sleepH != null) out.sleepH = a.sleepH;
  if (a.fuel) out.fuel = a.fuel; if (a.fit) out.fit = a.fit; if (a.note.trim()) out.note = a.note.trim();
  if (a.pain === PAIN[0]) out.pains = {};
  else if (a.pain && painLevel(a.pain) && a.area) out.pains = { [a.area]: a.pain };
  if (a.pace || a.hr) out.manual = { pace: a.pace || undefined, hr: a.hr ?? undefined };
  return out;
}
/** The injury entry for a pain: extends yesterday's entry of the same area and side, else a new one. */
export function injuryFor(a: Answers, date: string, all: Record<string, Injury>): { id: string; x: Injury } | null {
  const lv = painLevel(a.pain); if (!lv || !a.area || !a.side) return null;
  const prev = Object.entries(all).find(([, x]) => x.area === a.area && x.side === a.side && x.to >= addDays(date, -1) && x.from <= date);
  if (prev) return { id: prev[0], x: { ...prev[1], to: date > prev[1].to ? date : prev[1].to, level: Math.max(prev[1].level, lv) as 1 | 2 | 3, note: prev[1].note || a.note.trim() } };
  return { id: `${date}-${a.area}-${a.side}`.replace(/\s+/g, "_"), x: { from: date, to: date, area: a.area, side: a.side, level: lv, note: a.note.trim() || `Після пробіжки: ${a.pain}` } };
}
/** A day still waiting for its journal: a run, and none of the form's questions answered yet. */
export const needsJournal = (J: Journal | null) => !J || (J.rpe == null && !J.feel && !J.legs);
