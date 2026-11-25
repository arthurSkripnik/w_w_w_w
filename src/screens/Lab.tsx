// Лабораторія: the analysis as full-size widgets (the same widgets Головна shows as tiles). #lab/<widget> scrolls to one.
import { useEffect } from "preact/hooks";
import { Empty } from "../ui";
import { dbState } from "../store/data";
import { routeArg } from "../app/routes";
import { Board } from "../widgets/Board";

export function Lab() {
  const arg = routeArg.value, st = dbState.value;
  useEffect(() => { if (arg) document.getElementById(`w-${arg}`)?.scrollIntoView({ block: "start" }); }, [arg, st]);
  if (st === "loading") return <Empty>Читаю базу…</Empty>;
  if (st === "offline" || st === "error") return <Empty>База недоступна. Відкрий сторінку як артефакт у Claude.</Empty>;
  return <>
    <h1 class="hub-head">Лабораторія. <i>Прогноз, форма, база і тижні: звідки береться кожне число.</i></h1>
    <Board b="lab" />
  </>;
}
