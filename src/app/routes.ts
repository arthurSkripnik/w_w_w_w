import { signal } from "@preact/signals";

export type ScreenId = "home" | "calendar" | "library" | "lab" | "profile" | "kit";

export interface Screen {
  id: ScreenId;
  title: string;
  /** Hidden from the phone's bottom bar (view on desktop). */
  desktopOnly?: boolean;
  /** Not in the navigation: opened by its link only. */
  hidden?: boolean;
}

export const SCREENS: Screen[] = [
  { id: "home", title: "Головна" },
  { id: "calendar", title: "Календар" },
  { id: "library", title: "База тренувань", desktopOnly: true },
  { id: "lab", title: "Лабораторія", desktopOnly: true },
  { id: "profile", title: "Профіль" },
  { id: "kit", title: "Зразки", hidden: true },
];

// #screen or #screen/arg (the calendar's open day: #calendar/2026-11-24)
const parse = () => { const [h, arg] = location.hash.replace("#", "").split("/") as [ScreenId, string | undefined];
  return SCREENS.some(s => s.id === h) ? { id: h, arg: arg || null } : { id: "home" as ScreenId, arg: null }; };

export const route = signal<ScreenId>(parse().id);
export const routeArg = signal<string | null>(parse().arg);
window.addEventListener("hashchange", () => { const r = parse(); route.value = r.id; routeArg.value = r.arg; });
/** Go to a screen (and argument) without adding history for every step through the days. */
export function go(id: ScreenId, arg?: string | null, replace = false) {
  const h = `#${id}${arg ? "/" + arg : ""}`;
  if (replace) { history.replaceState(null, "", h); route.value = id; routeArg.value = arg ?? null; } else location.hash = h;
}
