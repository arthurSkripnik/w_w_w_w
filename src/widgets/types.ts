// A widget: one file in src/widgets/, listed in index.ts. Any widget can stand on any screen that has a board
// (Головна, Лабораторія); the screen's layout (layout/<screen>) says which, in what order and at which size.
// The board draws the card frame (number, title, link, menu) and hides a widget whose component returns null or throws.
import type { FunctionComponent } from "preact";
import type { Size } from "./layout";
export type { Size };
export interface Widget {
  id: string;
  title: string;
  about: string;                             // one line for the «Додати віджет» list
  span: 3 | 6 | 12;                          // compact: columns of 12 (phones: 3 → half, 6 and 12 → full width)
  rows?: 2;                                  // compact: a tall card, two rows of tiles beside it
  link?: { label: string; href: string };    // compact: where "more" lives
  C?: FunctionComponent;                     // compact: a number tile
  Full?: FunctionComponent;                  // full: the big chart, table and "how it is counted"
  fullSpan?: 6 | 12;
}
