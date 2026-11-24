// The Головна widgets in their default order. Adding a widget = a new file here + one line in this list.
import type { Widget } from "./types";
import { todayW } from "./today";
import { injuriesW } from "./injuries";
import { forecastW } from "./forecast";
import { formW } from "./form";
import { aerobicW } from "./aerobic";
import { weekkmW } from "./weekkm";
import { vo2maxW } from "./vo2max";
import { sleepW } from "./sleep";
import { weekW } from "./week";

export const WIDGETS: Widget[] = [todayW, forecastW, formW, aerobicW, weekkmW, injuriesW, vo2maxW, sleepW, weekW];
export type { Widget };
