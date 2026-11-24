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
src/styles/             @layer tokens → base → components → screens; tokens.css = 00-tokens.css з v52 без змін
```

## Кроки
1. Каркас (готово 2026-11-24)
2. Модель даних · 3. store · 4. стилі й базові елементи · 5. Головна · 6. Календар, картка дня, Профіль · 7. Лабораторія · 8. База тренувань · 9. Персональні плани
