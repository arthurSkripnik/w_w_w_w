import { SCREENS, route } from "./routes";
import { Home } from "../screens/Home";
import { Placeholder } from "../screens/Placeholder";

export function Shell() {
  const current = SCREENS.find(s => s.id === route.value)!;
  return (
    <div class="shell">
      <header class="top">
        <div class="brand">Run Plan <em>v2</em></div>
        <nav class="nav" aria-label="Розділи">
          {SCREENS.map(s => (
            <a href={`#${s.id}`} aria-current={s.id === current.id ? "page" : undefined}
               data-desktop={s.desktopOnly ? "" : undefined}>{s.title}</a>
          ))}
        </nav>
      </header>
      <main class="main">
        {current.id === "home" ? <Home /> : <Placeholder screen={current} />}
      </main>
    </div>
  );
}
