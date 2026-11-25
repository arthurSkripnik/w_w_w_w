# Run Plan v2

Нова версія Run Plan, окремий артефакт. Живий план (plan-app, v52) не чіпаємо.
Стек і порядок робіт: https://claude.ai/artifact/QABed8TjoVBSwpSwXFbtAU

## Збірка
```
npm install
npm run build      # tsc + vite → dist/index.html (один файл)
```
dist/index.html публікується як артефакт (capabilities: db, user, mcp Strava list_activities).

## Структура
```
src/main.tsx            вхід: стилі + оболонка
src/app/routes.ts       список екранів (SCREENS), desktopOnly = нема в нижній панелі телефону
src/app/Shell.tsx       верхня панель / нижня на телефоні, вибір екрана
src/screens/            екрани (поки Home з перевіркою зв'язку + заглушки)
src/platform/claude.ts  єдине місце, що торкається window.claude (db, mcp)
src/data/schema.ts      схеми колекцій (Zod)
src/domain/             чисті формули з v52: зони, структура сесій, розбір пробіжки, точність, навантаження/форма, аеробна база
src/ui/                 базові елементи (index.tsx), chart() на Observable Plot (chart.ts), <Chart> (Chart.tsx)
src/store/              data.ts (сигнали колекцій), derived.ts (похідні), actions.ts (усі записи), strava.ts (синхронізація)
src/styles/             @layer tokens → base → components → screens; tokens.css = 00-tokens.css з v52 без змін
```

## Кроки
1. Каркас (готово 2026-11-24) · 2. Модель даних (2026-11-24) · 3. store (2026-11-24)
4. стилі й базові елементи · 5. Головна · 6. Календар, картка дня, Профіль · 7. Лабораторія · 8. База тренувань · 9. Персональні плани

## Дані (крок 2)
Схеми всіх колекцій: `src/data/schema.ts` (Zod). Модель погоджена: https://claude.ai/artifact/29zpL4nqzukHra56R4C6k6

Разове перенесення з v52 (лише читає джерела, пише JSON по документу, кожен перевіряє схемою):
```
node tools/migrate.ts <plan-app/src/js> <plan-state.json> <coach dir> <out dir>
```
Дані користувача в репозиторій не потрапляють: `out dir` тримати поза ним. Запис у базу артефакта робить Claude (ArtifactData batch).

## Store (крок 3)
- `store/data.ts`: одна підписка `onSnapshot` на колекцію, документи перевіряються схемою, лежать у сигналах. Екрани базу не чіпають.
- `store/derived.ts`: дні плану з тренуванням, пробіжкою, розбором і точністю; зони від порогу на дату; форма (втома 7 днів / 6 тижнів); аеробна база.
- `store/actions.ts`: logDay, swapDays, setLevel, addInjury, updateInjury, setLayout, updateAthlete, addThreshold. Кожен запис проходить схему.
- `store/strava.ts`: syncPlan (дні плану: кола, best efforts, факти з потоку), syncArchive (пробіжки з 18.12.2024 до плану, лише підсумки).
- Потік (stream) не зберігається: те, що з нього треба розбору (перші 40 хв довгої, дрейф, відрізки за потоком, час у зонах пульсу), пишеться в `runs.stream` при імпорті.

Звірка з живим v52 (ті самі дані → ті самі числа). Дані користувача поза репозиторієм:
```
node tools/v52-dump.cjs <plan-app/src/js> <state.json> 2026-11-24 v52.json
V2_DATA=<out dir migrate.ts> V52_JSON=v52.json V52_TODAY=2026-11-24 npm test
```

## Елементи й графіки (крок 4)
- `src/ui/index.tsx`: Grid (12 колонок, на телефоні 6), Card, Stat, Pill, Button, Segmented, Table, Field, Details, StatusLine, Empty. Вигляд у `styles/components.css`.
- `src/ui/chart.ts`: `chart(spec, width)` на Observable Plot, види: line (лінія в часі з точками, смугами зон, лінією «сьогодні», планом пунктиром), bars (тижні), spark, hbars (зони пульсу). Кольори лише з токенів, тож темна тема працює сама.
- Звичайний регістр у підписах; вердикти в пігулках замість КАПСУ й [OK].
- Сторінка-зразок: `#kit` (не в меню).

## Step 5: Головна

- `src/screens/Home.tsx`: headline sentence (days to the race, forecast against the goal), the widget grid, Strava sync.
- `src/widgets/`: one file per widget (`today`, `forecast`, `form`, `aerobic`, `weekkm`, `injuries`, `vo2max`, `sleep`, `week`), listed in `index.ts`. A widget is `{id, title, span 3|6|12, rows?, link?, C}`; the host draws the card frame and hides a widget that throws.
- `src/domain/home.ts`: the numbers ported from v52 (forecast, VDOT, sleep week, readiness, plan-week km, injuries now and 30-day strip); `src/store/home.ts` wraps them as signals.
- Order and visibility come from `layout/home` in the database; widgets missing there keep their default place.
- The step 3–4 check panels moved to the hidden `#kit` page.

## Step 6a: Календар і картка дня

- `src/screens/Calendar.tsx`: weeks by plan phase (grid) or day by day (list); `#calendar/<date>` opens the day card under its week (full screen on phones).
- `src/calendar/DayCell.tsx`: one day, shared with the Головна week; `DayCard.tsx`: numbers, «Легше / За планом / Довше», how to run, km splits, strength, race plan, 5 km test → threshold, move/swap/start/undo, «Фактично було», the fact (Strava, pace, HR, RPE); `Report.tsx`: the Strava report.
- `src/domain/types.ts` (session types), `src/domain/text.ts` (v52 texts, KPIs, splits, verdicts, findings, shape).
- New actions: `moveToRest`, `markStart`, `revertDay`, `setActual`, `setExclude`, `plannedLevel`; `pullDay` in `store/strava.ts`.

## Step 6b: Профіль

`src/screens/Profile.tsx`, numbers in `src/domain/profile.ts`, body areas in `src/domain/areas.ts`, styles in `src/styles/profile.css`.
Sections: 01 Тіло і сон (edit → `athlete/me`), 02 Що з цього виходить (VO2max, max HR, thresholds), 03 Поріг і ціль
(a new `thresholds/<today>` entry, source `manual`; earlier days keep their zones; the goal time is updated in `goals/<id>`),
04 Зони темпу, 05 Пульсові зони, 06 Історія порогу, 07 Травми (body map, heatmap 30 days / all, log, add a record),
08 Дані («Перерахувати звіти», «Завантажити історію», moved here from Головна). Sections open by link: `#profile/body|est|threshold|zones|hr|history|injuries|data`.
Not ported: manual pace zones; the «VO2max за фактом Strava» row (comes with the Лабораторія forecast).

## Step 7a: Лабораторія (аналітика)

Widgets are shared by every screen with a board (`src/widgets/Board.tsx`): a widget has a compact tile (`C`) and/or a
full card (`Full`), and `layout/<screen>` (`home`, `lab`) lists which widgets stand there, in order and at which size.
Without a saved layout a screen shows `DEFAULTS` from `src/widgets/index.ts`. The «···» menu on each card puts the
widget on the other screen or takes it off this one. Full cards: `src/widgets/full/` (forecast, form, vo2int, aerobic,
hrz, weeks, history); numbers in `src/domain/lab.ts`, signals in `src/store/lab.ts`. `#lab/<widget id>` scrolls to a card.
Parity: `V52_LAB=<dump with lab>` adds the forecast checks (`tools/v52-dump.cjs` now writes `lab`). Known differences:
06.11 (v52 counts an easy run without work as a threshold equivalent) and 13.11 (swapped day).
