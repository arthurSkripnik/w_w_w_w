import { Button } from "../ui";
import { days, form, aerobic, zones, threshold, goal, today, nextDay, archive } from "../store/derived";
import { dbState } from "../store/data";
import { sync, syncPlan, syncArchive, ARCH_FROM } from "../store/strava";
import { fmtPace } from "../domain/util";
import { ZONE_NAME } from "../data/schema";

// Step 3 check: what the store computes from the data, next to the same numbers in v52.
const dm = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);

function Row({ label, val, s = "ok", tag }: { label: string; val: string; s?: "ok" | "err" | "wait"; tag?: string }) {
  return (
    <div class="check-row">
      <span class="label">{label}</span>
      <span class="val">{val}</span>
      <span class="dot num" data-s={s}>{tag ?? (s === "ok" ? "OK" : s === "err" ? "НІ" : "…")}</span>
    </div>
  );
}

export function StoreCheck() {
  if (dbState.value === "loading") return <div class="check"><h2 class="label check-title">Що рахує store</h2><Row label="Стан" val="Читаю базу…" s="wait" /></div>;
  const Z = zones.value, T = threshold.value, G = goal.value, F = form.value, A = aerobic.value, D = days.value;
  const done = D.filter(d => d.acc), last = done[done.length - 1], next = nextDay.value;
  const avg = done.length ? Math.round(done.reduce((a, d) => a + d.acc!.score, 0) / done.length) : null;
  const roll = A.roll[A.roll.length - 1], first = A.roll[0];
  const s = sync.value, arch = archive.value;
  return (
    <>
      <div class="check">
        <h2 class="label check-title">Що рахує store</h2>
        <Row label="Сьогодні" val={today.value} />
        <Row label="Ціль" val={G ? `${G.name}, ${dm(G.date)}, ${fmtPace(G.targetSec / G.km)} /км` : "немає"} s={G ? "ok" : "err"} />
        <Row label="Поріг" val={T ? `${fmtPace(T.paceSec)} /км, пульс ${T.hr ?? "—"}, з ${dm(T.date)}` : "немає"} s={T ? "ok" : "err"} />
        <Row label="Зони темпу" s={Z ? "ok" : "err"} val={Z ? (["rec", "z1", "z2", "z3"] as const).map(k => `${ZONE_NAME[k]} ${fmtPace(Z[k].fast)}–${fmtPace(Z[k].slow)}`).join(" · ") : "немає"} />
        <Row label="План" val={`${D.length} днів, ${D.filter(d => d.run).length} з пробіжкою, ${D.filter(d => d.journal?.skipped).length} без пробіжки`} />
        <Row label="Наступне" val={next ? `${dm(next.date)} · ${next.workout?.name ?? next.type}` : "план завершено"} s={next ? "ok" : "wait"} />
        <Row label="Точність" val={last ? `остання ${dm(last.date)} · ${last.workout?.name ?? last.act}: ${last.acc!.score}% (${last.acc!.label}); середня ${avg}% за ${done.length} днів` : "ще немає"} s={last ? "ok" : "wait"} />
        <Row label="Форма" val={F && F.now ? `${Math.round(F.now.r)}% · ${F.zone!.name}; 7 днів ${Math.round(F.now.atl)}, 6 тижнів ${Math.round(F.now.ctl)}; на старт ${Math.round(F.end.r)}% · ${F.endZone.name}` : "ще немає"} s={F?.now ? "ok" : "wait"} />
        <Row label="Аеробна база" val={roll ? `${fmtPace(roll.v)} /км на пульсі 145 (${dm(roll.d)}), було ${fmtPace(first.v)} (${dm(first.d)}); ${A.pts.length} легких пробіжок` : "потрібно 2 легкі пробіжки"} s={roll ? "ok" : "wait"} />
        <Row label="Архів" val={arch ? `${arch.n} пробіжок з ${dm(arch.from)}.${arch.from.slice(2, 4)}, ${arch.weeks.length} тижнів` : `не завантажено (з ${dm(ARCH_FROM)}.${ARCH_FROM.slice(2, 4)} до початку плану)`} s={arch ? "ok" : "wait"} tag={arch ? "OK" : "—"} />
      </div>
      <div class="check">
        <h2 class="label check-title">Strava</h2>
        <div class="actions">
          <Button disabled={s.busy} onClick={() => syncPlan(false)}>Синхронізувати план</Button>
          <Button variant="ghost" disabled={s.busy} onClick={() => syncArchive()}>{arch ? "Оновити архів" : "Завантажити архів"}</Button>
        </div>
        {s.text && <p class={`sync-msg${s.ok === false ? " err" : ""}`} role="status">{s.text}</p>}
      </div>
    </>
  );
}
