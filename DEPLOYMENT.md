# 🚀 Инструкции по деплою Esports Mood Tracker

## Предварительные требования

### На сервере должны быть установлены:
- **Docker** (версия 20.10 или выше)
- **Docker Compose** (версия 2.0 или выше)
- **Git** (для клонирования репозитория)

### Проверка установки:
```bash
docker --version
docker-compose --version
# или для новых версий
docker compose version
```

## 🔧 Исправленные проблемы

### Основные исправления в Docker конфигурации:

1. **Исправлен Dockerfile:**
   - Правильная последовательность копирования файлов
   - Корректные пути для серверных файлов
   - Оптимизированная структура multi-stage build

2. **Улучшен docker-compose.yml:**
   - Добавлены health checks для MongoDB
   - Настроена сеть между контейнерами
   - Правильная конфигурация volumes

3. **Добавлен .dockerignore:**
   - Исключены ненужные файлы и папки
   - Оптимизирован размер Docker context

## 🚀 Быстрый запуск

### Для Windows:
```cmd
# Запустите файл deploy.bat
deploy.bat
```

### Для Linux/macOS:
```bash
# Дайте права на выполнение (если нужно)
chmod +x deploy.sh

# Запустите скрипт
./deploy.sh
```

### Ручной запуск:
```bash
# 1. Остановите старые контейнеры
docker-compose down -v

# 2. Создайте .env файл (если его нет)
cp .env.example .env  # или создайте вручную

# 3. Соберите образы
docker-compose build --no-cache

# 4. Запустите контейнеры
docker-compose up -d

# 5. Проверьте статус
docker-compose ps
```

## 🔧 Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
NODE_ENV=production
MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
PORT=5000
```

## 📋 Полезные команды

### Просмотр логов:
```bash
# Все сервисы
docker-compose logs -f

# Только приложение
docker-compose logs -f app

# Только MongoDB
docker-compose logs -f mongo
```

### Управление контейнерами:
```bash
# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Пересборка с запуском
docker-compose up -d --build
```

### Отладка:
```bash
# Вход в контейнер приложения
docker-compose exec app sh

# Вход в MongoDB
docker-compose exec mongo mongosh

# Проверка сети
docker network ls
docker network inspect esports-mood-tracker_app-network
```

## 🌐 Доступ к приложению

После успешного запуска:
- **Приложение:** http://localhost:5000
- **MongoDB:** localhost:27017

## 🔍 Диагностика проблем

### Если контейнеры не запускаются:

1. **Проверьте логи:**
   ```bash
   docker-compose logs
   ```

2. **Проверьте статус:**
   ```bash
   docker-compose ps
   ```

3. **Проверьте доступные ресурсы:**
   ```bash
   docker system df
   docker system prune -f  # освободить место
   ```

### Если MongoDB не подключается:

1. **Проверьте здоровье MongoDB:**
   ```bash
   docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
   ```

2. **Проверьте переменные окружения:**
   ```bash
   docker-compose exec app env | grep MONGO
   ```

### Если приложение не отвечает:

1. **Проверьте порты:**
   ```bash
   netstat -tulpn | grep 5000
   # или
   ss -tulpn | grep 5000
   ```

2. **Проверьте логи приложения:**
   ```bash
   docker-compose logs -f app
   ```

## 🔄 Обновление приложения

```bash
# 1. Получите последние изменения
git pull origin main

# 2. Остановите контейнеры
docker-compose down

# 3. Пересоберите образы
docker-compose build --no-cache

# 4. Запустите заново
docker-compose up -d
```

## 📊 Мониторинг

### Просмотр использования ресурсов:
```bash
# Статистика контейнеров
docker stats

# Использование дискового пространства
docker system df
```

### Backup базы данных:
```bash
# Создание backup
docker-compose exec mongo mongodump --db esports-mood-tracker --out /data/backup

# Копирование backup с контейнера
docker cp $(docker-compose ps -q mongo):/data/backup ./backup
```

## 🚨 Важные заметки

1. **Безопасность:** Обязательно измените `JWT_SECRET` в production
2. **Порты:** Убедитесь, что порты 5000 и 27017 не заняты другими приложениями
3. **Файрвол:** Настройте файрвол для безопасного доступа к приложению
4. **SSL:** Для production рекомендуется использовать HTTPS (nginx + certbot)

##  Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь в правильности .env файла
3. Проверьте доступность портов
4. При необходимости очистите Docker: `docker system prune -a` 