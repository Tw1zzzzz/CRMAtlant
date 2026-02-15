#!/bin/bash

# Скрипт для деплоя проекта esports-mood-tracker

echo "🚀 Начинаем деплой проекта..."

# Проверяем наличие Docker и Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

# Останавливаем существующие контейнеры
echo "🛑 Останавливаем существующие контейнеры..."
docker-compose down -v

# Очищаем старые образы
echo "🧹 Очищаем старые образы..."
docker system prune -f

# Создаем переменные окружения, если их нет
if [ ! -f ".env" ]; then
    echo "📝 Создаем файл .env..."
    cat > .env << EOF
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
NODE_ENV=production
MONGODB_URI=mongodb://mongouser:mongopassword@mongo:27017/esports-mood-tracker?authSource=admin
PORT=5000
EOF
    echo "✅ Файл .env создан. Измените переменные окружения при необходимости."
fi

# Собираем и запускаем контейнеры
echo "🔨 Собираем Docker образы..."
docker-compose build --no-cache

echo "▶️ Запускаем контейнеры..."
docker-compose up -d

# Проверяем статус
echo "🔍 Проверяем статус контейнеров..."
docker-compose ps

echo "✅ Деплой завершен!"
echo "🌐 Приложение доступно по адресу: http://localhost:5000"
echo "💾 MongoDB доступна по адресу: localhost:27017"
echo ""
echo "📋 Полезные команды:"
echo "  - Просмотр логов: docker-compose logs -f"
echo "  - Остановка: docker-compose down"
echo "  - Перезапуск: docker-compose restart"
echo "  - Вход в контейнер приложения: docker-compose exec app sh"
echo "  - Вход в MongoDB: docker-compose exec mongo mongosh" 