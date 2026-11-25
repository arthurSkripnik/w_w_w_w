// After a run: the session as a card with its Strava numbers, then the journal form. Opens by itself for the latest
// run without a record (last 3 days), or from «Записати відчуття». «Пізніше» puts it off for that day.
import { popupDay, putOff, closeJournal, journalFor } from "../store/journal";
import { WorkoutCard } from "../calendar/WorkoutCard";
import { JournalForm } from "../calendar/JournalForm";
import { KV, Button, Modal } from "../ui";
import { typeOf } from "../domain/types";
import { dm, mmss } from "../domain/home";
import { fmtPace } from "../domain/util";

export function JournalPopup() {
  const d = popupDay.value;
  if (!d) return null;
  const r = d.report, name = d.workout?.name ?? typeOf(d.type).name, asked = !!journalFor.value;
  return <Modal key={d.date} label={`${asked ? "Запис дня" : "Нова пробіжка"} ${dm(d.date)}`} onClose={() => (asked ? closeJournal() : putOff(d.date))}>
      <header class="jp-h"><span class="label num">{asked ? "Запис дня" : "Нова пробіжка"} · {dm(d.date)}</span>
        <Button variant="link" onClick={() => (asked ? closeJournal() : putOff(d.date))}>{asked ? "Закрити" : "Пізніше"}</Button></header>
      <WorkoutCard size="L" hLevel={2} type={d.act} level={d.level} name={name} st="done" label={name}>
        {r && <KV size="m" items={[{ k: "Дистанція", v: r.km.toFixed(2), u: "км" }, { k: "Час", v: mmss(r.t) }, { k: "Темп", v: r.pace ? fmtPace(r.pace) : "—", u: "/км" }, { k: "Пульс", v: r.hr ? String(r.hr) : "—", u: r.hr ? "уд/хв" : undefined }]} />}
      </WorkoutCard>
      <h2 class="jp-q">Як пройшло?</h2>
      <JournalForm day={d} onDone={() => setTimeout(closeJournal, 900)} />
  </Modal>;
}
