import { health, dbState } from "../store/data";
import { COLLECTIONS, type CollectionName } from "../data/schema";

// How many documents each collection holds, and which fail the schema. Reads the store, not the database.
const LABEL: Record<CollectionName, string> = {
  athlete: "Атлет", goals: "Цілі", thresholds: "Пороги", workouts: "Шаблони тренувань",
  plan: "Дні плану", runs: "Пробіжки", journal: "Щоденник", injuries: "Травми", layout: "Розкладка екранів",
};

export function DataCheck() {
  const h = health.value, st = dbState.value;
  return (
    <div class="check">
      <h2 class="label check-title">Дані в базі v2</h2>
      {st === "offline" && <div class="check-row"><span class="val">База недоступна</span></div>}
      {st !== "offline" && (Object.keys(COLLECTIONS) as CollectionName[]).map(col => {
        const r = h[col];
        return (
          <div class="check-row" key={col}>
            <span class="label">{LABEL[col]}</span>
            <span class="val">
              {!r ? "Читаю…" : r.err ? `Помилка: ${r.err}`
                : r.bad.length ? `${r.n} записів, з них не за схемою: ${r.bad.slice(0, 3).join(", ")}${r.bad.length > 3 ? "…" : ""}`
                : `${r.n} записів`}
            </span>
            <span class="dot num" data-s={!r ? "wait" : r.err || r.bad.length ? "err" : r.n ? "ok" : "wait"}>{!r ? "…" : r.err ? "!" : r.n}</span>
          </div>
        );
      })}
    </div>
  );
}
