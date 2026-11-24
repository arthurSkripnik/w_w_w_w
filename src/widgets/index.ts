// All widgets, and the default set of each screen that has a board. Adding a widget = a new file + one line here.
import type { Widget, Size } from "./types";
import { todayW } from "./today";
import { injuriesW } from "./injuries";
import { forecastW } from "./forecast";
import { formW } from "./form";
import { aerobicW } from "./aerobic";
import { weekkmW } from "./weekkm";
import { vo2maxW } from "./vo2max";
import { sleepW } from "./sleep";
import { weekW } from "./week";
import { ForecastFull } from "./full/forecast";
import { FormFull } from "./full/form";
import { AerobicFull } from "./full/aerobic";
import { WeeksFull } from "./full/weeks";
import { vo2intW } from "./full/vo2int";
import { hrzW } from "./full/hrz";
import { historyW } from "./full/history";
import { distancesW } from "./full/distances";

export const WIDGETS: Widget[] = [
  todayW, { ...forecastW, Full: ForecastFull }, { ...formW, Full: FormFull }, { ...aerobicW, Full: AerobicFull },
  { ...weekkmW, Full: WeeksFull }, injuriesW, vo2maxW, sleepW, weekW, vo2intW, hrzW, historyW, distancesW,
];
export type BoardId = "home" | "lab";
const set = (ids: string[], size: Size) => ids.map(id => ({ id, size }));
export const DEFAULTS: Record<BoardId, { id: string; size: Size; hidden?: boolean }[]> = {
  home: set(["today", "forecast", "form", "aerobic", "weekkm", "injuries", "vo2max", "sleep", "week"], "compact"),
  lab: set(["forecast", "distances", "form", "vo2int", "aerobic", "hrz", "weekkm", "history"], "full"),
};
export type { Widget };
