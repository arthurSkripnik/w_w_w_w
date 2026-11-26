// One journal form for the whole app (ordered answers on a scale, the rest as chips): after a run (popup), in the day card and from «Сьогодні». The questions are
// the coach chat's (run-journal skill), so a chat entry and a manual one fill the same fields. Pain goes to the injury log.
import { useState } from "preact/hooks";
import type { Day } from "../domain/days";
import { Choice, Button, Field, StatusLine } from "../ui";
import { FEEL, LEGS, PAIN, FUEL, FIT, SIDES, FEEL_RPE, fromJournal, painLevel, type Answers } from "../domain/journal";
import { AREAS, SIDE_NAME } from "../domain/areas";
import { RPE_TARGET, typeOf } from "../domain/types";
import { saveJournal } from "../store/actions";
import { toSec } from "../domain/util";

const opts = (xs: readonly string[]) => xs.map(x => ({ id: x, title: x.charAt(0).toUpperCase() + x.slice(1) }));
export function JournalForm({ day, onDone, compact }: { day: Day; onDone?: () => void; compact?: boolean }) {
  const [a, setA] = useState<Answers>(() => fromJournal(day.journal)), set = (p: Partial<Answers>) => setA(x => ({ ...x, ...p }));
  const [sleep, setSleep] = useState(a.sleepH != null ? String(a.sleepH) : ""), [hr, setHr] = useState(a.hr ? String(a.hr) : "");
  const [err, setErr] = useState<string>(), [busy, setBusy] = useState(false), [ok, setOk] = useState(false);
  const t = typeOf(day.act), r0 = RPE_TARGET[t.cat], hurt = painLevel(a.pain) != null;
  const save = async () => {
    const h = sleep.trim() ? +sleep.trim().replace(",", ".") : null;
    if (h != null && !(h >= 2 && h <= 14)) return setErr("Сон у годинах, наприклад 7.5");
    if (a.pace && !toSec(a.pace)) return setErr("Темп у форматі хв:с, наприклад 4:35");
    if (hr && !/^\d{2,3}$/.test(hr)) return setErr("Пульс числом, наприклад 148");
    if (hurt && (!a.area || !a.side)) return setErr("Обери, де болить і з якого боку");
    setErr(undefined); setBusy(true);
    try { await saveJournal(day.date, { ...a, sleepH: h != null ? Math.round(h * 4) / 4 : null, hr: hr ? +hr : null }); setOk(true); onDone?.(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <div class="jf" data-compact={compact ? "" : undefined}>
    <div class="jf-q"><span class="label">Самопочуття під час бігу</span><Choice look="scale" label="Самопочуття під час бігу" value={a.feel ?? ""} onChange={v => set({ feel: v, rpe: a.rpe ?? FEEL_RPE[v] })} options={opts(FEEL)} /></div>
    <div class="jf-q"><span class="label">Ноги</span><Choice look="scale" label="Ноги" value={a.legs ?? ""} onChange={v => set({ legs: v })} options={opts(LEGS)} /></div>
    <div class="jf-q"><span class="label">RPE: зусилля від 1 до 10 · для цього тренування очікувано {r0[0]}–{r0[1]}</span>
      <Choice look="nums" label="RPE" value={a.rpe ?? 0} onChange={v => set({ rpe: v })}
        options={Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: String(i + 1), mark: i + 1 >= r0[0] && i + 1 <= r0[1] }))} /></div>
    <div class="jf-q"><span class="label">Біль або дискомфорт</span><Choice look="scale" label="Біль або дискомфорт" value={a.pain ?? ""} onChange={v => set({ pain: v })} options={opts(PAIN)} /></div>
    {hurt && <div class="jf-pain">
      <div class="jf-q"><span class="label">Де</span><Choice look="chips" label="Де" value={a.area ?? ""} onChange={v => set({ area: v })} options={AREAS.map(x => ({ id: x.k, title: x.name }))} /></div>
      <Choice label="Бік" value={a.side ?? ("" as never)} onChange={v => set({ side: v })} options={SIDES.map(s => ({ id: s, title: SIDE_NAME[s] }))} />
      <p class="label">Запишеться в журнал травм. Якщо біль змінює ходу або росте, зупинись і покажись фізіотерапевту.</p>
    </div>}
    {!compact && <div class="jf-q"><span class="label">Їжа і вода перед бігом</span><Choice look="chips" label="Їжа і вода перед бігом" value={a.fuel ?? ""} onChange={v => set({ fuel: v })} options={opts(FUEL)} /></div>}
    <div class="jf-q"><span class="label">Чи вклався в план</span><Choice look="chips" label="Чи вклався в план" value={a.fit ?? ""} onChange={v => set({ fit: v })} options={opts(FIT)} /></div>
    <div class="dc-row">
      <Field label="Сон минулої ночі, год" inputMode="decimal" placeholder="7.5" value={sleep} onInput={e => setSleep((e.target as HTMLInputElement).value)} />
      {!day.run && t.work && <Field label={`${t.workLbl ?? "Темп"}, хв:с /км`} inputMode="numeric" value={a.pace ?? ""} onInput={e => set({ pace: (e.target as HTMLInputElement).value })} />}
      {!day.run && <Field label="Середній пульс, уд/хв" inputMode="numeric" value={hr} onInput={e => setHr((e.target as HTMLInputElement).value)} />}
    </div>
    <label class="field jf-note"><span class="label">Нотатка</span>
      <textarea rows={2} value={a.note} onInput={e => set({ note: (e.target as HTMLTextAreaElement).value })} placeholder="Що варто пам'ятати про цю пробіжку" /></label>
    <div class="dc-row"><Button disabled={busy} onClick={save}>{day.journal ? "Оновити запис" : "Записати"}</Button>
      {ok && <StatusLine tag="готово">Записано{hurt ? ", біль додано в журнал травм" : ""}</StatusLine>}</div>
    {err && <StatusLine tone="err" tag="помилка">{err}</StatusLine>}
  </div>;
}
