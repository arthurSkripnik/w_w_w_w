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
