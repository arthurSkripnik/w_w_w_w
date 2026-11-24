// Words and numbers of the day card, ported from v52: gen/genAll (01-plan), kpis/splits (03-daycard),
// verdict/zoneMark/findings (04-analysis), racePlan (14-theory). Verdicts that v52 wrote as [TAGS] come back as
// {text, tag} so the screen can put the tag in a pill.
import type { Zones } from "./zones";
import { zoneRange, hrCeil } from "./zones";
import { spec, dur, K5_TO_10K, K5_TO_THR, THR_TO_10K, eq10 } from "./spec";
import { partOf, type Report, type Part } from "./report";
import { isHot } from "./accuracy";
import { fmtPace } from "./util";
import { typeOf, ZONE_TXT } from "./types";
import { mmss, plural } from "./home";

export interface Steps { warmup: string | null; main: string; cooldown: string | null; note: string }

export function gen(type: string, lvl: number, Z: Zones): Steps {
  const s = spec(type, lvl)!, R = s.reps!, zr = (k: string) => { const r = zoneRange(k, Z); return `(${fmtPace(r.fast)}–${fmtPace(r.slow)}/км)`; };
  const hr = Z.thrHR, race = fmtPace(Z.race);
  switch (type) {
    case "base": return { warmup: null, cooldown: null, main: `${s.easy} хв у легкому темпі ${zr("z1")}. Темп розмовний.`, note: "Можна замінити велосипедом або плаванням на той самий час." };
    case "recovery": return { warmup: null, cooldown: null, main: `${s.easy} хв дуже легко, ${fmtPace(Z.rec.fast)}–${fmtPace(Z.rec.slow)}/км. Повільніше за звичайний легкий біг.`, note: "Мета — відновитися. Якщо почуваєшся втомленим, краще відпочинь." };
    case "long": return { warmup: "10 хв легко.", cooldown: "5–10 хв легко або пішки.", main: `${s.easy} хв рівно в легкому темпі ${zr("z1")}.${s.strides ? " У кінці 4–6 прискорень по 20 с з повним відпочинком." : ""}`, note: "Будує витривалість. Не женися за темпом." };
    case "longfartlek": return { warmup: "10 хв легко.", cooldown: "5–10 хв легко.", main: `${s.easy} хв у легкому темпі. У другій половині ${R.n} × ${R.min} хв у пороговому темпі ${zr("z2")}, між ними ${R.rest} хв легко.`, note: "Вчить міняти темп на втомлених ногах." };
    case "fastfinish": return { warmup: null, cooldown: "3–5 хв пішки.", main: `${s.easy} хв у легкому темпі ${zr("z1")}. Потім ${s.fast} хв з поступовим прискоренням до порогового ${zr("z2")}.`, note: "Вчить бігти швидко на втомлених ногах, як в останній третині 10 км." };
    case "fartlek": return { warmup: "15 хв легко.", cooldown: "10 хв легко.", main: `${R.n} × ${R.min} хв у швидкому темпі ${zr("z3")}, між ними ${R.rest} хв легко.`, note: "Біжи за відчуттям, темп орієнтовний." };
    case "pyramid": return { warmup: "15 хв легко.", cooldown: "10 хв легко.", main: `Безперервно: ${R.mins!.join("–")} хв швидко ${zr("z3")}, у найдовшому 4-хвилинному ближче до повільного краю. Між ними ${R.rests!.join(" / ")} хв легко, ≈4:30–4:50/км.`, note: "За відчуттям, без зупинок. Вчить міняти темп: розганятися, тримати і відновлюватись на бігу." };
    case "hills": return { warmup: "15 хв легко і 3–4 прискорення.", cooldown: "10 хв легко по рівному.", main: `${R.n} × 60–90 с угору із зусиллям як у швидкому темпі. Униз повільно, до повного відновлення.`, note: "На підйомі дивись на зусилля, а не на темп. Розвиває силу й економність бігу." };
    case "shortint": return { warmup: "15–20 хв легко і 3–4 прискорення.", cooldown: "10–15 хв легко.", main: `${R.n} × 2–3 хв у швидкому темпі ${zr("z3")}, пульс ≈${hr + 8}–${hr + 14}. Між ними 2–3 хв легко.`, note: "Найважче тренування тижня. Якщо важко, скороти кількість повторів, а не темп." };
    case "longint": return { warmup: "15–20 хв легко.", cooldown: "10 хв легко.", main: `${R.n} × 6–8 хв у пороговому темпі ${zr("z2")}, пульс ≈${hr}. Між ними 2–3 хв легко.`, note: "Темп, який ти втримав би приблизно 20 хв. Головне тренування для порогу." };
    case "mixedint": return { warmup: "15–20 хв легко.", cooldown: "10 хв легко.", main: `${R.n} ${plural(R.n, "блок", "блоки", "блоків")}: ${R.z2} хв у пороговому темпі ${zr("z2")}, потім ${R.z3} хв у швидкому ${zr("z3")}. Між блоками ${R.rest} хв легко.`, note: "Поєднує поріг і швидкість в одному тренуванні." };
    case "start": return { warmup: "15–20 хв легко і 3–4 прискорення.", cooldown: "10–15 хв легко.", main: "Старт на результат: паркран, забіг чи контрольна. Після нього Strava підтягне найкращі 5 км, 10 км або півмарафон, і результат піде в прогноз «за фактом».", note: "День до і день після старту стають відновлювальними." };
    case "race": return { warmup: "15–20 хв легко і кілька прискорень за 30–40 хв до старту.", cooldown: "10–15 хв легко або пішки.", main: `10 км. Перші 2 км ≈${race}/км, стримано. Далі рівно ${race}/км, останні 2 км на що вистачить.`, note: "Тиждень перед стартом лише легкі й короткі тренування, нічого нового." };
    case "tt5k": {
      const now5 = Z.thrPace / K5_TO_THR, goal5 = Z.race / K5_TO_10K;
      return { warmup: "15–20 хв легко + 4 прискорення по 20 с.", cooldown: "10–15 хв легко.",
        main: `5 км на максимум, рівномірно. Перший кілометр ≈${fmtPace(now5)}/км (твоя поточна форма, ≈${fmtPace(now5 * 5)}), далі як вийде. Для ${mmss(Z.race * 10)} на 10 км потрібно ≈${fmtPace(goal5 * 5)} на 5 км.`,
        note: "Найкраще на паркрані або стадіоні, на рівній трасі. Результат покаже реальну форму замість оцінки, і з нього можна взяти поріг." };
    }
  }
  return { warmup: null, cooldown: null, main: "", note: "" };
}

export interface Kpi { lbl: string; val: string; sub?: string; txt?: boolean }
const KPI_PACE_LBL: Record<string, string> = { fastfinish: "Темп фінішу", longfartlek: "Темп прискорень", mixedint: "Темп 5-хв відрізків" };
/** The 2–3 numbers that matter for the session. */
export function kpis(type: string, lvl: number, Z: Zones, hrFromStrava: boolean): Kpi[] {
  const w = typeOf(type).work, g = gen(type, lvl, Z), out: Kpi[] = [];
  const wu = !!(g.warmup || g.cooldown);
  if (type === "race") out.push({ lbl: "Дистанція", val: "10 км", sub: `≈${dur("race", 0)} хв з розминкою` });
  else if (type === "start") out.push({ lbl: "Тривалість", val: `≈${dur("start", 0)} хв`, sub: "З розминкою і заминкою" });
  else {
    const mins = dur(type, lvl)!; let sub = wu ? "З розминкою і заминкою" : "";
    if (w === "z1" || w === "rec") { const r = zoneRange(w, Z), km = Math.round((mins * 60) / ((r.fast + r.slow) / 2)); sub = (sub ? sub + " · " : "") + `≈${km} км`; }
    out.push({ lbl: "Тривалість", val: `${mins} хв`, sub });
  }
  if (!w) out.push(type === "start" ? { lbl: "Темп", val: "На результат", sub: "Найкращі 5 км, 10 км чи півмарафон підуть у прогноз", txt: true }
    : { lbl: "Темп", val: "За зусиллям", sub: "На підйомі темп не показовий", txt: true });
  else {
    const r = zoneRange(w, Z);
    if (w === "race") out.push({ lbl: "Темп гонки", val: fmtPace(r.fast), sub: `/км · ціль ${mmss(r.fast * 10)}` });
    else if (w === "tt") out.push({ lbl: "Темп для цілі", val: fmtPace(r.fast), sub: `/км · ${mmss(r.fast * 5)} на 5 км` });
    else {
      let sub = `/км · ${ZONE_TXT[w]}`;
      if (type === "mixedint") sub += `, потім 3 хв швидкий ${fmtPace(Z.z3.fast)}–${fmtPace(Z.z3.slow)}`;
      out.push({ lbl: KPI_PACE_LBL[type] || (w === "z1" || w === "rec" ? "Темп" : "Темп відрізків"), val: `${fmtPace(r.fast)}–${fmtPace(r.slow)}`, sub });
    }
  }
  const hr = Z.thrHR;
  if (w === "z1" || w === "rec") out.push({ lbl: "Пульс", val: `до ${hrCeil(Z)}`, sub: hrFromStrava ? "уд/хв, верх пульсової Z2 у Strava" : "уд/хв, 0.88 × поріг" });
  if (hr && type === "longint") out.push({ lbl: "Пульс на відрізках", val: `≈${hr}`, sub: "уд/хв, як на порозі" });
  if (hr && type === "shortint") out.push({ lbl: "Пульс на відрізках", val: `${hr + 8}–${hr + 14}`, sub: "уд/хв, вище порогу" });
  return out;
}

/** Km splits for runs whose pace plan fits a km table (easy, long, fast finish). */
export interface Split { p: number; w: boolean }
export function splits(type: string, lvl: number, Z: Zones): Split[] | null {
  const s = spec(type, lvl); if (!s) return null;
  const prog = s.tmpl === "progression";
  if (!prog && !(s.tmpl === "steady" && s.zone === "z1")) return null;
  const z1 = Z.z1, cruise = Math.round((z1.fast + z1.slow) / 2) + 2, open = z1.slow - 8;
  const out: Split[] = [], easy = ((s.warm || 0) + s.easy!) * 60;
  for (let t = 0, k = 0; ; k++) {
    const p = k === 0 ? open : k === 1 ? Math.round((open + cruise) / 2) : cruise;
    if (t + p / 2 > easy) break;
    out.push({ p, w: false }); t += p;
  }
  if (prog) {
    const a = z1.fast + 4, b = Z.z2.fast + 6, n = Math.max(2, Math.round((s.fast! * 60) / ((a + b) / 2)));
    for (let i = 0; i < n; i++) out.push({ p: Math.round(a + ((b - a) * i) / (n - 1)), w: true });
  }
  return out;
}

/** Between the threshold and the easy zone ("marathon" pace): belongs to neither. */
export function zoneGap(Z: Zones) { const a = Z.z2.slow + 1, b = Z.z1.fast - 1; return b >= a ? { fast: a, slow: b } : null; }
const inGap = (p: number, Z: Zones) => { const g = zoneGap(Z); return !!g && p >= g.fast - 0.5 && p <= g.slow + 0.5; };

export interface Tag { tag: string; tone: "ink" | "line" | "acc" | "err" }
/** Pace of a part against a zone. */
export function zoneMark(pace: number | null, key: string, Z: Zones): Tag | null {
  if (!pace) return null;
  const z = zoneRange(key, Z), name = ZONE_TXT[key] ?? key;
  const outward = (key === "z1" && pace < z.fast - 2) || (key === "z2" && pace > z.slow + 2);
  if (outward && inGap(pace, Z)) return { tag: "між зонами", tone: "line" };
  if (pace < z.fast - 2) return { tag: `швидше за ${name}`, tone: "line" };
  if (pace > z.slow + 2) return { tag: `повільніше за ${name}`, tone: "line" };
  return { tag: `${name} темп`, tone: "ink" };
}
/** Pace of the session against its work zone. */
export function verdict(type: string, pace: number | null, Z: Zones): Tag | null {
  const w = typeOf(type).work; if (!w || !pace) return null;
  const r = zoneRange(w, Z);
  if (w === "race" || w === "tt") { const d = Math.round(pace - r.fast); return d <= 0 ? { tag: "ціль виконано", tone: "acc" } : { tag: `+${d} с/км до цілі`, tone: "line" }; }
  if (((w === "z1" && pace < r.fast) || (w === "z2" && pace > r.slow)) && inGap(pace, Z)) return { tag: "марафонський, між зонами", tone: "line" };
  if (pace < r.fast) return { tag: `швидше зони на ${Math.round(r.fast - pace)} с`, tone: "line" };
  if (pace > r.slow) return { tag: `повільніше зони на ${Math.round(pace - r.slow)} с`, tone: "line" };
  return { tag: "у зоні", tone: "ink" };
}

/** Planned minutes of the work part. */
export function planWorkMin(type: string, lvl: number) {
  const s = spec(type, lvl); if (!s) return null;
  if (s.tmpl === "progression") return s.fast ?? null;
  if (s.reps && type !== "hills") return s.reps.n * s.reps.min;
  return null;
}

/** Findings of a run report: sentences, each with an optional verdict pill. */
export interface Finding { text: string; tag?: Tag }
export function findings(rep: Report, planType: string, lvl: number, Z: Zones, opts: { marked: boolean; rh?: number | null }): Finding[] {
  const out: Finding[] = [], type = rep.as || planType, w = typeOf(type).work, same = type === planType;
  const say = (text: string, tag?: Tag | null) => out.push(tag ? { text, tag } : { text });
  const planMin = dur(type, lvl) ?? 0, factMin = Math.round(rep.t / 60), diff = factMin - planMin;
  if (!same) say(`Розібрано як «${typeOf(type).name}» (за планом був «${typeOf(planType).name}»).`);
  else if (type !== "start") say(Math.abs(diff) <= Math.max(5, planMin * 0.1) ? `Тривалість як у плані: ${factMin} хв.`
    : diff < 0 ? `Коротше плану на ${-diff} хв (${factMin} замість ${planMin}).` : `Довше плану на ${diff} хв (${factMin} замість ${planMin}).`);
  const ceil = hrCeil(Z);
  if (rep.tmpl === "steady") {
    const e = rep.easy || { pace: rep.pace, hr: rep.hr, first40: undefined };
    if (e.pace) {
      const vd = verdict(type, e.pace, Z), inz = vd?.tag === "у зоні";
      say(`${e.first40 ? "Перші 40 хв" : "Темп"}: ${fmtPace(e.pace)} /км${e.hr ? `, пульс ${e.hr}` : ""}.`, vd);
      const h = rep.hr || e.hr;
      let calm = -1;
      if (h && h > ceil) say(`${inz ? "Темп у зоні, але пульс" : "Пульс"} ${h}${e.first40 ? " за всю пробіжку" : ""} вище стелі ${ceil} для легкого дня. Це вже помірна робота: наступного разу пригальмуй.`, { tag: "пульс високий", tone: "err" });
      else if (h) { calm = out.length; say(`Пульс ${h} до стелі ${ceil}: справді легко.`, { tag: "легко", tone: "ink" }); }
      const sp = rep.spread;
      if (sp && sp.t) {
        const pc = (v: number) => Math.round((v / sp.t) * 100), mn = (v: number) => Math.round(v / 60);
        const src = sp.from === "stream" ? "посекундно" : `по ${sp.n} колах${sp.min ? ` (від ${fmtPace(sp.min)} до ${fmtPace(sp.max!)})` : ""}`;
        const paceOff = sp.fast / sp.t >= 0.15 || sp.slow / sp.t >= 0.25, hrOff = sp.hrOver / sp.t >= 0.15;
        say(`Розподіл ${src}: у зоні ${pc(sp.in)}% часу, швидше ${pc(sp.fast)}% (${mn(sp.fast)} хв), повільніше ${pc(sp.slow)}%; пульс вище ${ceil}: ${mn(sp.hrOver)} хв. ${paceOff ? "Темп нерівний: середнє тут ховає відрізки поза зоною." : hrOff ? "Темп рівний, але чимала частина часу пройшла вище стелі пульсу." : "Біг рівний, середньому можна вірити."}`,
          paceOff || hrOff ? null : { tag: "рівно", tone: "ink" });
        if (calm >= 0 && (paceOff || hrOff)) out[calm] = { text: `Пульс ${h} до стелі ${ceil} лише в середньому, див. розподіл нижче.` };
      }
    }
    if (rep.hr && rep.hr >= Z.thrHR && !opts.marked) say(`Середній пульс ${rep.hr}, як на порозі (${Z.thrHR}). Якщо це був старт або інше тренування, познач це в блоці «Фактично було».`);
    if (rep.drift) { const d = rep.drift.pct;
      say(`Дрейф темп/пульс між половинами: ${d.toFixed(1)}% (${fmtPace(rep.drift.a.pace)} при ${rep.drift.a.hr} → ${fmtPace(rep.drift.b.pace)} при ${rep.drift.b.hr}). ${d < 5 ? "Менше 5%: аеробна база тримає цю тривалість." : "5% і більше: на цій тривалості база ще не тримає, пульс повзе вгору."}`,
        d < 5 ? { tag: "база тримає", tone: "ink" } : { tag: "дрейф", tone: "line" }); }
  } else if (rep.tmpl === "test") {
    const wk = rep.work as (Part & { km: number }) | null;
    if (wk && wk.pace) { const p = wk.pace, km = wk.km, k5 = km === 5;
      say(`${k5 ? "5 км" : km === 10 ? "10 км" : "Півмарафон"}: ${mmss(wk.t)} (${fmtPace(p)} /км)${type === "start" ? ", найкращий відрізок у Strava" : ""}.`, verdict(type, p, Z));
      say(k5 ? `Це ≈${mmss(p * K5_TO_10K * 10)} на 10 км і поріг ≈${fmtPace(p * K5_TO_THR)} /км.` : km === 10 ? `Поріг за цим результатом ≈${fmtPace(p / THR_TO_10K)} /км.` : `За формулою Ріґеля це ≈${mmss(eq10(km, wk.t) * 10)} на 10 км.`);
      if (rep.splits && rep.splits.length >= 3) { const a = rep.splits[0], b = rep.splits[rep.splits.length - 1], sp = Math.max(...rep.splits) - Math.min(...rep.splits);
        say(`По кілометрах: ${rep.splits.map(fmtPace).join(" · ")}. ${sp <= 8 ? "Рівно." : b > a + 5 ? "Кінець повільніший: старт був зашвидкий." : `Розкид ${sp} с/км.`}`, sp <= 8 ? { tag: "рівно", tone: "ink" } : null); }
    } else say(type === "start" ? "Strava не знайшла найкращих 5 км, 10 км чи півмарафону в цій пробіжці." : "Strava не дала найкращого результату на цю дистанцію. Запиши час вручну.");
  } else if (rep.tmpl === "progression") {
    const wk = rep.work;
    if (!wk) say("Не знайшов прискорення наприкінці: темп рівний усю пробіжку.");
    else {
      const fw = Math.round(wk.t / 60), pw = same ? planWorkMin(type, lvl) : null;
      say(`Швидка частина: ${fw} хв, ${wk.km.toFixed(1)} км, від ${fmtPace(wk.from)} до ${fmtPace(wk.to)} /км${wk.endHr ? `, пульс на фініші ${wk.endHr}` : ""}.`);
      say(`Останнє коло відносно порогового темпу ${fmtPace(Z.z2.fast)}–${fmtPace(Z.z2.slow)}.`, verdict(type, wk.to, Z));
      if (pw) { if (fw < pw * 0.7) say(`Це коротше плану (${pw} хв). Наступного разу можна почати прискорюватись трохи раніше.`);
        else if (fw > pw * 1.3) say(`Довше за план (${pw} хв).`); else say(`Обсяг як у плані: ${pw} хв.`, { tag: "як у плані", tone: "ink" }); }
      if (wk.endHr && wk.endHr > Z.thrHR) say(`На фініші пульс вищий за пороговий ${Z.thrHR}: це вже робота вище порогу.`);
    }
  } else {
    const wk = rep.work;
    if (!wk) say(`Не знайшов відрізків${w ? " у робочому темпі" : ""}. Якщо вони були, запиши темп вручну.`);
    else {
      const R = rep.reps ?? [], n = R.length, planN = rep.planN ?? n;
      const head = same ? `Зроблено ${n} з ${planN} ${plural(planN, "повтору", "повторів", "повторів")}` : `${n} ${plural(n, "відрізок", "відрізки", "відрізків")}`;
      if (rep.tmpl === "blocks" && rep.blocks && rep.blocks.length) {
        const pick = (k: "z2" | "z3") => partOf(rep.blocks!.filter(b => b[k]).map(b => [b[k]!.t, b[k]!.km * 1000, b[k]!.hr || 0, 0]));
        const z2 = pick("z2"), z3 = pick("z3");
        say(`${same ? `Блоків ${rep.blocks.length} з ${planN}` : `Блоків ${rep.blocks.length}`}.`);
        if (z2?.pace) say(`Порогова частина: ${fmtPace(z2.pace)} /км${z2.hr ? `, пульс ${z2.hr}` : ""}.`, zoneMark(z2.pace, "z2", Z));
        if (z3?.pace) say(`Швидка частина: ${fmtPace(z3.pace)} /км${z3.hr ? `, пульс ${z3.hr}` : ""}.`, zoneMark(z3.pace, "z3", Z));
      } else {
        const avgMin = wk.t / Math.max(1, n) / 60, mins = spec(type, lvl)?.reps?.mins;
        say(`${head} ${mins ? `(${R.map(r => Math.round((r.t / 60) * 2) / 2).join("–")} хв, за планом ${mins.join("–")})` : `по ≈${avgMin < 1.5 ? Math.round(avgMin * 60) + " с" : avgMin.toFixed(1).replace(".0", "") + " хв"}`}: середній темп ${fmtPace(wk.pace)} /км${wk.hr ? `, пульс ${wk.hr}` : ""}.`,
          w ? zoneMark(wk.pace, w === "z2" || w === "z3" ? w : "z3", Z) : null);
      }
      if (n >= 3 && w) {
        const h = Math.floor(n / 2), A = R.slice(0, h), B = R.slice(-2), avg = (x: Part[], k: "pace" | "hr") => x.reduce((a, r) => a + (r[k] ?? 0), 0) / x.length;
        const pa = avg(A, "pace"), pb = avg(B, "pace"), ha = A.filter(r => r.hr), hb = B.filter(r => r.hr);
        const dh = ha.length && hb.length ? Math.round(avg(hb, "hr") - avg(ha, "hr")) : null;
        const spread = Math.round(Math.max(...R.map(r => r.pace ?? 0)) - Math.min(...R.map(r => r.pace ?? 0)));
        if (pb - pa > 5) say(`Останні два повільніші на ${Math.round(pb - pa)} с/км${dh !== null ? ` при пульсі ${dh >= 0 ? "+" : ""}${dh}` : ""}: втома під кінець.`);
        else say(`Відрізки рівні: розкид ${spread} с/км${dh !== null && dh > 0 ? `, пульс під кінець +${dh}` : ""}.`, { tag: "рівно", tone: "ink" });
      }
      if (type === "longint" && wk.hr && wk.hr > Z.thrHR + 4) say(`Пульс на відрізках вище порогу (${Z.thrHR}). Можна трохи стриматись.`);
      if (rep.from === "stream") say("Відрізки знайдено за потоком темпу: кола на годиннику не збігаються з повторами.");
    }
  }
  if (isHot(rep, opts.rh)) say(`Було ${rep.temp}°C${opts.rh != null ? `, вологість ${opts.rh}%` : ""}. У спеку пульс на тому самому темпі вищий на 5–10 уд/хв, а дрейф більший, тож цей день оцінюй м'якше.`, { tag: "спека", tone: "acc" });
  return out;
}

/** The race plan by km for a goal pace. */
export function racePlan(p: number) {
  return [
    ["0–1 км", `не швидше ${fmtPace(p - 2)}`, "Стримайся. Адреналін робить цей темп легким, а зайві 5 с тут коштують 20 с на фініші."],
    ["1–3 км", `${fmtPace(p)}–${fmtPace(p + 2)}`, "Знайди ритм і групу, сховайся від вітру."],
    ["3–7 км", fmtPace(p), "Рівно. 6–8 км найважчі психологічно: тут працюють фрази і рахунок по кілометру."],
    ["7–10 км", `${fmtPace(p)} і швидше`, "Якщо є сили, додавай з 8-го км, а останні 400 м біжи на все."],
  ];
}

/** The shape strip of a session: planned minutes in order. e = easy, w2/w3 = work in the threshold/fast zone, t = test or race. */
export function shapeOf(type: string, lvl: number): [number, "e" | "w2" | "w3" | "t"][] {
  const s = spec(type, lvl); if (!s) return [];
  const R = s.reps, out: [number, "e" | "w2" | "w3" | "t"][] = [], add = (m: number | undefined, k: "e" | "w2" | "w3" | "t") => { if (m && m > 0) out.push([m, k]); };
  const wk = s.zone === "z2" ? "w2" : "w3";
  add(s.warm, "e");
  if (s.tmpl === "steady") add(s.easy, "e");
  else if (s.tmpl === "progression") { add(s.easy, "e"); add(s.fast, "w2"); }
  else if (s.tmpl === "test") add(s.main, "t");
  else if (type === "longfartlek" && R) { add(s.easy! - R.n * (R.min + R.rest), "e"); for (let i = 0; i < R.n; i++) { add(R.min, wk); add(R.rest, "e"); } }
  else if (s.tmpl === "blocks" && R) { for (let i = 0; i < R.n; i++) { add(R.z2, "w2"); add(R.z3, "w3"); if (i < R.n - 1) add(R.rest, "e"); } }
  else if (R) { for (let i = 0; i < R.n; i++) { add(R.mins ? R.mins[i] : R.min, wk); if (i < R.n - 1) add(R.rests ? R.rests[i] : R.rest, "e"); } }
  add(s.cool, "e");
  return out;
}
export const fmtHM = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
