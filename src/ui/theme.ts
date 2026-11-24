// The page's own light/dark switch. It lives on <html data-ui>, not data-theme: the claude.ai viewer owns
// data-theme and resets it to its own theme. The choice is remembered in this browser only.
export type Theme = "auto" | "light" | "dark";
const KEY = "rp2-theme";
export function getTheme(): Theme {
  try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "auto"; } catch { return "auto"; }
}
export function setTheme(t: Theme) {
  if (t === "auto") delete document.documentElement.dataset.ui; else document.documentElement.dataset.ui = t;
  try { if (t === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* private mode */ }
}
