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

const read = (): ScreenId => {
  const h = location.hash.replace("#", "") as ScreenId;
  return SCREENS.some(s => s.id === h) ? h : "home";
};

export const route = signal<ScreenId>(read());
window.addEventListener("hashchange", () => { route.value = read(); });
