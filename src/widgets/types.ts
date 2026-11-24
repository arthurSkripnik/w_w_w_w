// A Головна widget: one file in src/widgets/, listed in index.ts. The host (screens/Home.tsx) draws the card frame
// (number, title, link) and hides the widget when its component returns null.
import type { FunctionComponent } from "preact";
export interface Widget {
  id: string;
  title: string;
  span: 3 | 6 | 12;                          // columns of 12 (phones: 3 → half, 6 and 12 → full width)
  rows?: 2;                                  // a tall card: two rows of tiles beside it
  link?: { label: string; href: string };    // where "more" lives
  C: FunctionComponent;
}
