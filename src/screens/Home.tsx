import { useEffect, useState } from "preact/hooks";
import { getDb, getMcp, inArtifact, STRAVA } from "../platform/claude";
import { DataCheck } from "./DataCheck";

type State = { s: "wait" | "ok" | "err"; text: string };
const WAIT: State = { s: "wait", text: "Перевіряю…" };

function Row({ label, st }: { label: string; st: State }) {
  const tag = st.s === "ok" ? "OK" : st.s === "err" ? "НІ" : "…";
  return (
    <div class="check-row">
      <span class="label">{label}</span>
      <span class="val">{st.text}</span>
      <span class="dot" data-s={st.s}>{tag}</span>
    </div>
  );
}

export function Home() {
  const [db, setDb] = useState<State>(WAIT);
  const [strava, setStrava] = useState<State>(WAIT);

  useEffect(() => {
    if (!inArtifact) {
      const off = { s: "err" as const, text: "Сторінка відкрита не як артефакт" };
      setDb(off); setStrava(off); return;
    }
    (async () => {
      const d = await getDb();
      if (!d) { setDb({ s: "err", text: "База недоступна" }); return; }
      try {
        const snap = await d.doc("meta/v2").get();
        setDb({ s: "ok", text: snap.exists ? "Підключена, службовий запис є" : "Підключена, поки порожня" });
      } catch (e: any) { setDb({ s: "err", text: `Помилка: ${e?.code ?? "невідома"}` }); }
    })();
    (async () => {
      const m = await getMcp();
      if (!m) { setStrava({ s: "err", text: "Конектор недоступний" }); return; }
      try {
        const r = await m.callTool(STRAVA, "list_activities", { first: 10 });
        const list: any[] = (r?.payload as any)?.activities ?? [];
        const run = list.find(a => /run/i.test(a.sport_type ?? ""));
        if (!run) { setStrava({ s: "ok", text: "Підключено, пробіжок серед останніх 10 немає" }); return; }
        const km = ((run.summary?.distance ?? 0) / 1000).toFixed(1);
        const day = String(run.start_local ?? "").slice(0, 10);
        setStrava({ s: "ok", text: `Остання пробіжка: ${run.name ?? "без назви"}, ${km} км${day ? `, ${day}` : ""}` });
      } catch (e: any) { setStrava({ s: "err", text: `Помилка: ${e?.code ?? "невідома"}` }); }
    })();
  }, []);

  return (
    <>
      <section class="screen-head">
        <span class="label">Крок 2 · модель даних</span>
        <h1>Головна</h1>
        <p>Тут буде сітка віджетів (крок 5). Поки що екран лише перевіряє, що нова версія бачить дані.</p>
      </section>
      <div class="check">
        <Row label="База артефакта" st={db} />
        <Row label="Strava" st={strava} />
      </div>
      <DataCheck />
    </>
  );
}
