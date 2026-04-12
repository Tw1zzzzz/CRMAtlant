# AGENTS.md

## Назначение

Этот файл нужен как краткая инструкция для агентной работы по репозиторию `CRMAtlant`.
Описания ниже основаны на текущем состоянии проекта, его скриптах, конфигурации и структуре каталогов.

## Стек проекта

### Frontend

- React 18 + TypeScript
- Vite 5 (`@vitejs/plugin-react-swc`)
- React Router 6
- TanStack React Query
- Tailwind CSS 3
- shadcn/ui + Radix UI
- MUI (`@mui/material`, `@mui/icons-material`)
- Recharts / Chart.js / Nivo для графиков

### Backend

- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT-аутентификация
- `node-cron` для фоновых задач
- `multer` / файловые загрузки
- `nodemailer` и `resend`

### Инфраструктура и окружение

- Корневой frontend и backend в `src/server` живут как два отдельных npm-пакета
- Локальная разработка идет через `npm` и отдельные `package-lock.json`
- Для production есть `Dockerfile`, `docker-compose.yml` и отдельный deploy-контур в `deploy/`
- Vite dev server работает на `8080` и проксирует `/api`, `/uploads`, `/health`, `/health-check` на backend
- Backend по умолчанию использует порт `5001`, читает `.env` из корня проекта

## Структура проекта

- `src/` — frontend-приложение
- `src/components`, `src/pages`, `src/hooks`, `src/lib`, `src/services` — основные зоны frontend-кода
- `src/server/` — backend на Express/Mongoose
- `src/server/routes`, `controllers`, `services`, `models`, `middleware` — основные backend-слои
- `tests/` — smoke/behavior тесты для frontend и сквозных правок
- `src/server/tests/` — smoke/contract/behavior тесты backend
- `dist/` и `src/server/dist/` — артефакты сборки, вручную не редактировать

## Ключевые команды

### Установка зависимостей

```bash
npm install
npm run server:install
```

### Локальная разработка

Запускает Vite и backend одновременно:

```bash
npm run dev
```

Отдельный запуск backend:

```bash
npm run server:dev
```

Отдельный запуск frontend preview после сборки:

```bash
npm run preview
```

### Сборка

Сборка frontend:

```bash
npm run build
```

Сборка backend:

```bash
npm run server:build
```

Полная локальная production-подготовка:

```bash
npm run build
npm run server:build
```

### Тесты и линтинг

Frontend lint:

```bash
npm run lint
```

Frontend smoke/behavior tests:

```bash
npm run test:frontend
```

Backend smoke/contract tests:

```bash
npm run test:backend
```

Все основные тесты:

```bash
npm test
```

### Docker

Локальный контейнерный запуск:

```bash
docker compose up --build
```

Production deploy-стек описан в:

- `deploy/docker-compose.prod.yml`
- `deploy/README.md`

## Правила кода

### Общие

- Пиши изменения на TypeScript, если редактируешь TypeScript-зону проекта.
- Не редактируй вручную `dist/`, `src/server/dist/`, `node_modules/`.
- Не меняй архитектуру без необходимости: в проекте уже есть разделение на frontend в корне и backend в `src/server`.
- Если правка касается маршрутов, синхронизируй frontend и backend одновременно: UI-роуты живут в `src/lib/routes.ts` и `src/App.tsx`, API-роуты регистрируются в `src/server/server.ts`.
- Сохраняй существующий язык интерфейса и сообщений: пользовательские тексты в проекте в основном на русском.

### Frontend

- Используй функциональные React-компоненты и хуки.
- Для внутренних импортов frontend предпочитай алиас `@/`, он настроен в `tsconfig.json` и `vite.config.ts`.
- Существующий UI построен на смеси Tailwind, shadcn/ui, Radix и местами MUI; при изменениях сохраняй этот стиль, а не вводи новый UI-слой без причины.
- Новые страницы и защищенные маршруты добавляй согласованно: `src/lib/routes.ts` -> `src/App.tsx` -> навигация/guard-логика.
- Для сетевого слоя и клиентских helper-функций ориентируйся на существующие файлы в `src/lib` и `src/services`.

### Backend

- Backend строже frontend по TypeScript-настройкам: старайся не вводить `any` и не ослаблять типизацию без крайней необходимости.
- Новые endpoint'ы добавляй по текущей структуре: `routes` -> `controllers/services` -> при необходимости `models/types/utils`.
- Если добавляешь новый API-роут, не забудь зарегистрировать его в `src/server/server.ts`.
- Backend читает `.env` из корня проекта; новые env-переменные нужно документировать минимум в `.env-example`.
- Для файловых загрузок, health-check и MongoDB-подключения сохраняй текущие соглашения, а не дублируй альтернативную инфраструктуру.

### Стиль и качество

- В репозитории нет отдельного formatter-скрипта, поэтому не делай массовых косметических правок без необходимости.
- ESLint настроен только на frontend `ts/tsx`; отсутствие ошибки линтера не означает, что backend-проверка пройдена.
- Во frontend встречается смешанный стиль кавычек и форматирования; в пределах изменяемого файла придерживайся локальной консистентности.
- Комментарии добавляй только там, где код без них трудно понять.
- Следи за кодировкой файлов: не добавляй текст с битой UTF-8/Windows-1251 кодировкой.


## Инструкции самопроверки

### Минимум перед завершением frontend-задачи

```bash
npm run lint
npm run test:frontend
```

Если правка влияет на сборку, роутинг, импорт модулей, Tailwind или Vite-конфиг:

```bash
npm run build
```

### Минимум перед завершением backend-задачи

```bash
npm run test:backend
npm run server:build
```

### Минимум перед завершением сквозной задачи

```bash
npm run lint
npm test
npm run build
npm run server:build
```

### Ручная проверка

После `npm run dev` проверь:

- frontend открывается на `http://localhost:8080`
- backend отвечает через Vite proxy
- health endpoints доступны: `/health` и `/health-check`
- если менялся backend без реальной MongoDB, убедись, что dev-сценарий не сломан фоллбеком на `mongodb-memory-server`
- если менялись загрузки файлов, проверь сценарии `/uploads`
- если менялись auth/payments/Faceit/support flows, проверь их вручную, потому что часть логики завязана на `.env` и внешние интеграции

## Практические замечания для агентов

- Перед началом работы смотри `package.json` в корне и `src/server/package.json`: команды frontend и backend разделены.
- Для полной сборки проекта недостаточно одного `npm run build`: backend собирается отдельной командой.
- Для задач только по backend не нужно трогать Vite-конфиг и frontend-артефакты.
- Для задач только по frontend не нужно менять `src/server/dist` и production Docker-артефакты без прямой причины.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `PLANS.md`) from design to implementation.
