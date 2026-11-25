// After a run: the session as a card with its Strava numbers, then the journal form. Opens by itself for the latest
// run without a record (last 3 days), or from «Записати відчуття». «Пізніше» puts it off for that day.
import { useEffect, useRef } from "preact/hooks";
import { popupDay, putOff, closeJournal, journalFor } from "../store/journal";
import { WorkoutCard } from "../calendar/WorkoutCard";
import { JournalForm } from "../calendar/JournalForm";
import { KV, Button } from "../ui";
import { typeOf } from "../domain/types";
import { dm, mmss } from "../domain/home";
import { fmtPace } from "../domain/util";

export function JournalPopup() {
  const d = popupDay.value, ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!d) return; const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") putOff(d.date); };
    addEventListener("keydown", esc); return () => { removeEventListener("keydown", esc); prev?.focus?.(); };
  }, [d?.date]);
  if (!d) return null;
  const r = d.report, name = d.workout?.name ?? typeOf(d.type).name, asked = !!journalFor.value;
  return <div class="jp-back" onClick={e => { if (e.target === e.currentTarget) putOff(d.date); }}>
    <div class="jp" role="dialog" aria-modal="true" aria-labelledby="jp-t" tabIndex={-1} ref={ref}>
      <header class="jp-h"><span class="label num" id="jp-t">{asked ? "Запис дня" : "Нова пробіжка"} · {dm(d.date)}</span>
        <Button variant="link" onClick={() => (asked ? closeJournal() : putOff(d.date))}>{asked ? "Закрити" : "Пізніше"}</Button></header>
      <WorkoutCard size="L" type={d.act} level={d.level} name={name} st="done" label={name}>
        {r && <KV size="m" items={[{ k: "Дистанція", v: r.km.toFixed(2), u: "км" }, { k: "Час", v: mmss(r.t) }, { k: "Темп", v: r.pace ? fmtPace(r.pace) : "—", u: "/км" }, { k: "Пульс", v: r.hr ? String(r.hr) : "—", u: r.hr ? "уд/хв" : undefined }]} />}
      </WorkoutCard>
      <h2 class="jp-q">Як пройшло?</h2>
      <JournalForm day={d} onDone={() => setTimeout(closeJournal, 900)} />
    </div>
  </div>;
}
