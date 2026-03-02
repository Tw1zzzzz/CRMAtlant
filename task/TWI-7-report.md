# TWI-7: Рефакторинг CRM и расследование проблемы БД/бэкенда

## Дата
- 2026-03-01

## Симптом
- После авторизации часть пользовательских сценариев работала нестабильно или не работала вообще.
- Наблюдалась картина "регистрация работает, остальной функционал ломается".

## Root Cause
- В кодовой базе использовались смешанные API base URL:
  - часть запросов шла через относительный `/api` (через Vite proxy);
  - часть запросов была жёстко привязана к `http://localhost:5000`.
- При реальной конфигурации проекта backend работает на `PORT=5001` (см. `.env`), поэтому часть CRUD-запросов уходила не в тот сервер/порт.

## Что исправлено
- Убраны жёсткие ссылки на `localhost:5000` в рабочих frontend-модулях.
- В dev-режиме вызовы унифицированы на относительный путь (`/api`) через текущий origin.
- В `vite.config.ts` добавлен proxy для:
  - `/uploads`
  - `/health`
  - `/health-check`
- Для Faceit OAuth callback обновлён fallback redirect URI на порт из env (`PORT`) с дефолтом `5001`.
- Добавлен анти-регрессионный smoke-check, который валит тест при появлении `localhost:5000` в frontend-исходниках.

## Изменённые файлы
- `vite.config.ts`
- `src/lib/constants.ts`
- `src/utils/constants.ts`
- `src/utils/apiUtils.ts`
- `src/utils/fileService.ts`
- `src/utils/api/playerCard.ts`
- `src/utils/api/playerDashboard.ts`
- `src/components/AddPlayerForm.tsx`
- `src/pages/ExcelImport.tsx`
- `src/components/Cs2AnalyticsPanel.tsx`
- `src/pages/PlayerCard.tsx`
- `src/utils/imageUtils.ts`
- `src/server/controllers/faceitController.ts`
- `tests/frontend.smoke.test.cjs`

## Проверки
- `npm run test:frontend` — passed
- `npm run test:backend` — passed

## Риски и замечания
- В репозитории уже есть большой объём параллельных незакоммиченных изменений; фиксы внесены точечно без откатов.
- Для полного закрытия TWI-7 нужно дополнительно пройти ручной smoke после логина по ключевым сценариям (создание/чтение/обновление/удаление основных сущностей CRM).
