import { useEffect, useState } from "preact/hooks";
import { getDb } from "../platform/claude";
import { COLLECTIONS, type CollectionName } from "../data/schema";

// Step 2 check: how many documents each collection holds, and how many fail the schema.
type Row = { col: CollectionName; n: number; bad: string[] } | { col: CollectionName; err: string };
const LABEL: Record<CollectionName, string> = {
  athlete: "Атлет", goals: "Цілі", thresholds: "Пороги", workouts: "Шаблони тренувань",
  plan: "Дні плану", runs: "Пробіжки", journal: "Щоденник", injuries: "Травми", layout: "Розкладка Головної",
};

export function DataCheck() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      if (!db) { setRows([]); return; }
      const out: Row[] = [];
      for (const col of Object.keys(COLLECTIONS) as CollectionName[]) {
        try {
          const snap = await db.collection(col).get();
          const bad = snap.docs.filter((d: any) => !COLLECTIONS[col].safeParse(d.data()).success).map((d: any) => d.id);
          out.push({ col, n: snap.size, bad });
        } catch (e: any) { out.push({ col, err: e?.code ?? "помилка" }); }
      }
      setRows(out);
    })();
  }, []);

  return (
    <div class="check">
      <h2 class="label check-title">Дані в базі v2</h2>
      {rows === null && <div class="check-row"><span class="val">Читаю…</span></div>}
      {rows?.length === 0 && <div class="check-row"><span class="val">База недоступна</span></div>}
      {rows?.map(r => (
        <div class="check-row" key={r.col}>
          <span class="label">{LABEL[r.col]}</span>
          <span class="val">
            {"err" in r ? `Помилка: ${r.err}`
              : r.bad.length ? `${r.n} записів, з них не за схемою: ${r.bad.slice(0, 3).join(", ")}${r.bad.length > 3 ? "…" : ""}`
              : `${r.n} записів`}
          </span>
          <span class="dot num" data-s={"err" in r || r.bad.length ? "err" : r.n ? "ok" : "wait"}>{"err" in r ? "!" : r.n}</span>
        </div>
      ))}
    </div>
  );
}
