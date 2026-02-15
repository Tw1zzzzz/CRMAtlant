# DOCKER DEPLOYMENT FIX - Исправление проблем с Docker деплоем

## Проблема
Пользователь не мог успешно собрать и запустить проект на сервере через `docker-compose` из-за нескольких критических ошибок в конфигурации Docker.

## Выявленные проблемы

### 1. Неправильная структура Dockerfile
- **Проблема**: Неверные пути копирования серверных файлов
- **Детали**: 
  - `COPY src/server/package*.json ./server/` - неправильный путь назначения
  - `COPY --from=build /app/src/server/dist ./server/dist` - неверная структура папок
  - `CMD ["node", "server/dist/index.js"]` - неправильный путь к исполняемому файлу

### 2. Отсутствие оптимизации Docker context
- **Проблема**: Отсутствие `.dockerignore` файла
- **Последствия**: Большой размер Docker context, медленная сборка

### 3. Неполная конфигурация docker-compose.yml
- **Проблема**: Отсутствие health checks, неправильная сеть
- **Детали**:
  - Нет проверки здоровья MongoDB
  - Отсутствует настройка сети между контейнерами
  - Неполные переменные окружения

## Исправления

### 1. Обновленный Dockerfile
```dockerfile
FROM node:20-alpine as build

WORKDIR /app

# Copy root package.json and install frontend dependencies
COPY package*.json ./
RUN npm install --no-fund --no-audit

# Copy server package.json and install server dependencies
COPY src/server/package*.json ./src/server/
RUN cd src/server && npm install --no-fund --no-audit

# Copy all source code
COPY . .

# Build frontend
RUN npm run build

# Build server
RUN cd src/server && npm run build

FROM node:20-alpine as production

WORKDIR /app

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy built server
COPY --from=build /app/src/server/dist ./dist/server

# Copy server package.json
COPY --from=build /app/src/server/package*.json ./

# Install only production dependencies for server
RUN npm install --omit=dev --no-fund --no-audit

# Create uploads directory
RUN mkdir -p /app/uploads

# Set permissions
RUN chmod -R 755 /app

ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/server/index.js"]
```

### 2. Добавлен .dockerignore
```dockerignore
node_modules
npm-debug.log
Dockerfile
.dockerignore
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
.idea
*.log
dist
src/server/dist
uploads
.DS_Store
*.md
fix.md
task
planning/*.md
*.pdf
aalitycs
cloud
project
Top_players
aanaliticaa
.vercel
*.sql
*.sqlite
.next
out
```

### 3. Улучшенный docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
      - JWT_SECRET=${JWT_SECRET:-supersecretkey}
      - PORT=5000
    depends_on:
      mongo:
        condition: service_healthy
    restart: always
    volumes:
      - uploads-data:/app/uploads
    networks:
      - app-network

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=mongouser
      - MONGO_INITDB_ROOT_PASSWORD=mongopassword
      - MONGO_INITDB_DATABASE=esports-mood-tracker
    restart: always
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s

volumes:
  mongo-data:
    driver: local
  uploads-data:
    driver: local

networks:
  app-network:
    driver: bridge
```

## Добавленные инструменты

### 1. Скрипт деплоя для Linux/macOS (deploy.sh)
- Автоматическая проверка установки Docker
- Остановка старых контейнеров
- Очистка системы
- Создание .env файла
- Сборка и запуск

### 2. Скрипт деплоя для Windows (deploy.bat)
- Аналогичная функциональность для Windows
- Проверка команд Windows
- Правильная обработка ошибок

### 3. Подробная документация (DEPLOYMENT.md)
- Пошаговые инструкции
- Диагностика проблем
- Полезные команды
- Мониторинг и обслуживание

## Ключевые изменения

### Структура файлов в контейнере:
```
/app/
  ├── dist/               # Frontend build
  ├── dist/server/        # Server build
  ├── uploads/           # User uploads
  ├── package.json       # Server dependencies
  └── node_modules/      # Production dependencies
```

### Переменные окружения:
```env
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
NODE_ENV=production
MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
PORT=5000
```

## Результат
После применения всех исправлений:
1. ✅ Docker образы собираются без ошибок
2. ✅ Контейнеры запускаются успешно
3. ✅ MongoDB подключается корректно
4. ✅ Приложение доступно на порту 5000
5. ✅ Volumes корректно монтируются
6. ✅ Логи доступны для отладки

## Команды для проверки работоспособности

```bash
# Запуск (Windows)
deploy.bat

# Запуск (Linux/macOS)
./deploy.sh

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Проверка приложения
curl http://localhost:5000

# Проверка MongoDB
docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
```

## Дата создания
2025-01-28

## Статус
✅ Завершено и протестировано 