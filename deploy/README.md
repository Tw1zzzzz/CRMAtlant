# Deploy

## Что внутри

- `docker-compose.prod.yml` — production-compose для `app` и `mongo`
- `scripts/install-docker-ubuntu.sh` — установка Docker на Ubuntu
- `scripts/deploy.sh` — сборка и запуск приложения
- `scripts/backup-mongo.sh` — backup MongoDB в архив
- `nginx/esports-mood-tracker.conf` — шаблон reverse proxy

## Быстрый запуск на Ubuntu

1. Скопируйте репозиторий на сервер.
2. Выполните `bash deploy/scripts/install-docker-ubuntu.sh`.
3. Перелогиньтесь на сервер.
4. Создайте `deploy/.env.production` на основе `deploy/.env.production.example`.
5. Запустите `bash deploy/scripts/deploy.sh`.
6. Проверьте контейнеры: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps`.

## Что обязательно заполнить в `.env.production`

- `JWT_SECRET`
- `MONGO_ROOT_USERNAME`
- `MONGO_ROOT_PASSWORD`
- `CORS_ORIGIN`
- `APP_PORT`, если нужен не `5000`

## Nginx и HTTPS

1. Скопируйте `deploy/nginx/esports-mood-tracker.conf` в `/etc/nginx/sites-available/`.
2. Замените `example.com` на свой домен.
3. Обновите `proxy_pass`, если меняли `APP_PORT`.
4. Активируйте конфиг и перезапустите nginx.
5. Выпустите сертификат через `certbot --nginx -d your-domain`.
