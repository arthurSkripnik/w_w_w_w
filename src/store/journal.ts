// When to ask for the journal: the latest run of the last 3 days with nothing written yet, unless put off with «Пізніше».
import { signal, computed } from "@preact/signals";
import { days, today } from "./derived";
import { dbState } from "./data";
import { needsJournal } from "../domain/journal";
import { addDays } from "../domain/util";

const KEY = "rp2-jlater";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const later = signal<string[]>(read());
/** The day the form is open for, from a button («Записати відчуття»); null = closed unless a run is waiting. */
export const journalFor = signal<string | null>(null);
export const pendingRun = computed(() => {
  if (dbState.value !== "ready") return null;
  const t = today.value, from = addDays(t, -2);
  return [...days.value].reverse().find(d => d.date <= t && d.date >= from && d.run && needsJournal(d.journal) && !later.value.includes(d.date)) ?? null;
});
export const popupDay = computed(() => (journalFor.value ? days.value.find(d => d.date === journalFor.value) ?? null : pendingRun.value));
export function putOff(date: string) {
  journalFor.value = null;
  if (later.value.includes(date)) return;
  later.value = [...later.value, date].slice(-20);
  try { localStorage.setItem(KEY, JSON.stringify(later.value)); } catch { /* private window: the popup comes back next time */ }
}
export const closeJournal = () => { journalFor.value = null; };
