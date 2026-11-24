import type { Screen } from "../app/routes";

const NOTE: Record<string, string> = {
  calendar: "Тут буде календар і план. Переносимо на кроці 6.",
  library: "Тут буде база тренувань-шаблонів. Крок 8.",
  lab: "Тут будуть графіки й аналіз. Крок 7.",
  profile: "Тут буде картка користувача. Крок 6.",
};

export function Placeholder({ screen }: { screen: Screen }) {
  return (
    <section class="screen-head">
      <span class="label">Порожній екран</span>
      <h1>{screen.title}</h1>
      <p>{NOTE[screen.id]}{screen.desktopOnly ? " На телефоні цього пункту в нижній панелі немає." : ""}</p>
    </section>
  );
}
