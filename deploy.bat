@echo off
echo 🚀 Начинаем деплой проекта...

REM Проверяем наличие Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker не установлен. Установите Docker и попробуйте снова.
    pause
    exit /b 1
)

REM Проверяем наличие Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова.
        pause
        exit /b 1
    )
)

REM Останавливаем существующие контейнеры
echo 🛑 Останавливаем существующие контейнеры...
docker-compose down -v

REM Очищаем старые образы
echo 🧹 Очищаем старые образы...
docker system prune -f

REM Создаем переменные окружения, если их нет
if not exist ".env" (
    echo 📝 Создаем файл .env...
    (
    echo JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
    echo NODE_ENV=production
    echo MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
    echo PORT=5000
    ) > .env
    echo ✅ Файл .env создан. Измените переменные окружения при необходимости.
)

REM Собираем и запускаем контейнеры
echo 🔨 Собираем Docker образы...
docker-compose build --no-cache

echo ▶️ Запускаем контейнеры...
docker-compose up -d

REM Проверяем статус
echo 🔍 Проверяем статус контейнеров...
docker-compose ps

echo ✅ Деплой завершен!
echo 🌐 Приложение доступно по адресу: http://localhost:5000
echo 💾 MongoDB доступна по адресу: localhost:27017
echo.
echo 📋 Полезные команды:
echo   - Просмотр логов: docker-compose logs -f
echo   - Остановка: docker-compose down
echo   - Перезапуск: docker-compose restart
echo   - Вход в контейнер приложения: docker-compose exec app sh
echo   - Вход в MongoDB: docker-compose exec mongo mongosh

pause 