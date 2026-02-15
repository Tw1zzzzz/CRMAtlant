@echo off
echo ========================================
echo   Docker Installation and Project Setup
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Этот скрипт должен быть запущен от имени администратора
    echo Щелкните правой кнопкой мыши на файл и выберите "Запуск от имени администратора"
    pause
    exit /b 1
)

echo 🔍 Проверяем наличие Docker...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker уже установлен
    goto :run_project
)

echo 📥 Docker не найден. Начинаем установку...

REM Try winget first
echo Пробуем установить через winget...
winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
if %errorlevel% equ 0 (
    echo ✅ Docker Desktop установлен через winget
    goto :docker_installed
)

REM If winget fails, provide manual installation instructions
echo ❌ Не удалось установить через winget
echo.
echo 📋 Пожалуйста, установите Docker Desktop вручную:
echo 1. Перейдите на https://desktop.docker.com/win/stable/Docker%%20Desktop%%20Installer.exe
echo 2. Скачайте и запустите установщик
echo 3. Следуйте инструкциям установки
echo 4. Перезагрузите компьютер после установки
echo 5. Запустите этот скрипт снова
echo.
start https://desktop.docker.com/win/stable/Docker%%20Desktop%%20Installer.exe
pause
exit /b 1

:docker_installed
echo.
echo ⚠️  Docker Desktop установлен, но требует перезагрузки
echo После перезагрузки:
echo 1. Запустите Docker Desktop
echo 2. Дождитесь полной загрузки
echo 3. Запустите этот скрипт снова
echo.
pause
exit /b 0

:run_project
echo.
echo 🚀 Docker найден! Запускаем проект...

REM Check if Docker Desktop is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Desktop не запущен или не готов
    echo Пожалуйста:
    echo 1. Запустите Docker Desktop
    echo 2. Дождитесь полной загрузки (индикатор станет зеленым)
    echo 3. Запустите этот скрипт снова
    pause
    exit /b 1
)

echo ✅ Docker работает!
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Создаем файл .env...
    (
    echo JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
    echo NODE_ENV=production
    echo MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
    echo PORT=5000
    ) > .env
    echo ✅ Файл .env создан
)

echo 🛑 Останавливаем старые контейнеры...
docker-compose down -v >nul 2>&1

echo 🧹 Очищаем старые образы...
docker system prune -f >nul 2>&1

echo 🔨 Собираем Docker образы...
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo ❌ Ошибка при сборке образов
    echo Проверьте логи выше
    pause
    exit /b 1
)

echo ▶️  Запускаем контейнеры...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ Ошибка при запуске контейнеров
    echo Проверьте логи: docker-compose logs
    pause
    exit /b 1
)

echo.
echo 🔍 Проверяем статус контейнеров...
docker-compose ps

echo.
echo ✅ Проект успешно запущен!
echo 🌐 Приложение доступно по адресу: http://localhost:5000
echo 💾 MongoDB доступна по адресу: localhost:27017
echo.
echo 📋 Полезные команды:
echo   docker-compose logs -f     - просмотр логов
echo   docker-compose down        - остановка
echo   docker-compose restart     - перезапуск
echo.

REM Wait a moment and try to open the application
timeout /t 3 /nobreak >nul
echo 🌐 Открываем приложение в браузере...
start http://localhost:5000

pause 