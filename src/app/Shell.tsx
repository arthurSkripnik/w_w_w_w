import { SCREENS, route } from "./routes";
import { Home } from "../screens/Home";
import { Placeholder } from "../screens/Placeholder";
import { Kit } from "../screens/Kit";
import { Calendar } from "../screens/Calendar";

export function Shell() {
  const current = SCREENS.find(s => s.id === route.value)!;
  return (
    <div class="shell">
      <header class="top">
        <div class="brand">Run Plan <em>v2</em></div>
        <nav class="nav" aria-label="Розділи">
          {SCREENS.filter(s => !s.hidden).map(s => (
            <a href={`#${s.id}`} aria-current={s.id === current.id ? "page" : undefined}
               data-desktop={s.desktopOnly ? "" : undefined}>{s.title}</a>
          ))}
        </nav>
      </header>
      <main class="main">
        {current.id === "home" ? <Home /> : current.id === "kit" ? <Kit /> : current.id === "calendar" ? <Calendar /> : <Placeholder screen={current} />}
      </main>
    </div>
  );
}
