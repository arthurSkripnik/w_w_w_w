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
import { ForecastFull, ForecastHow } from "./full/forecast";
import { FormFull, FormHow } from "./full/form";
import { AerobicFull, AerobicHow } from "./full/aerobic";
import { WeeksFull, WeeksHow } from "./full/weeks";
import { vo2intW } from "./full/vo2int";
import { hrzW } from "./full/hrz";
import { historyW } from "./full/history";
import { distancesW } from "./full/distances";
import { cmptrendW } from "./full/cmptrend";
import { characterW } from "./character";
import { statsW } from "./full/stats";
import { bossW } from "./full/boss";

export const WIDGETS: Widget[] = [
  todayW, { ...forecastW, Full: ForecastFull, how: ForecastHow }, { ...formW, Full: FormFull, how: FormHow },
  { ...aerobicW, Full: AerobicFull, how: AerobicHow }, { ...weekkmW, Full: WeeksFull, how: WeeksHow }, injuriesW, vo2maxW, sleepW, weekW, vo2intW, hrzW, historyW, distancesW, cmptrendW, characterW, statsW, bossW,
];
export type BoardId = "home" | "lab" | "profile";
export const BOARDS: BoardId[] = ["home", "lab", "profile"];
const set = (ids: string[], size: Size) => ids.map(id => ({ id, size }));
export const DEFAULTS: Record<BoardId, { id: string; size: Size; hidden?: boolean }[]> = {
  home: set(["today", "forecast", "form", "aerobic", "weekkm", "injuries", "vo2max", "sleep", "week"], "compact"),
  lab: set(["forecast", "distances", "form", "vo2int", "aerobic", "hrz", "weekkm", "history", "cmptrend"], "full"),
  profile: set(["character", "stats", "boss"], "full"),
};
export type { Widget };
