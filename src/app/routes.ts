import { signal } from "@preact/signals";

export type ScreenId = "home" | "calendar" | "library" | "lab" | "profile";

export interface Screen {
  id: ScreenId;
  title: string;
  /** Hidden from the phone's bottom bar (view on desktop). */
  desktopOnly?: boolean;
}

export const SCREENS: Screen[] = [
  { id: "home", title: "Головна" },
  { id: "calendar", title: "Календар" },
  { id: "library", title: "База тренувань", desktopOnly: true },
  { id: "lab", title: "Лабораторія", desktopOnly: true },
  { id: "profile", title: "Профіль" },
];

const read = (): ScreenId => {
  const h = location.hash.replace("#", "") as ScreenId;
  return SCREENS.some(s => s.id === h) ? h : "home";
};

export const route = signal<ScreenId>(read());
window.addEventListener("hashchange", () => { route.value = read(); });
