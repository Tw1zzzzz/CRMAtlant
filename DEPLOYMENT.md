# Deploy На Сервер

Ниже конкретный сценарий деплоя именно этого проекта на VPS с Ubuntu 22.04+.

Проект уже подготовлен к запуску через Docker:

- `deploy/docker-compose.prod.yml`
- `deploy/.env.production.example`
- `deploy/scripts/deploy.sh`
- `deploy/scripts/backup-mongo.sh`
- `deploy/scripts/install-docker-ubuntu.sh`
- `deploy/nginx/esports-mood-tracker.conf`

## Что будет поднято

После деплоя у вас будут работать:

- `app` контейнер: frontend + backend Node.js
- `mongo` контейнер: MongoDB 7
- `nginx` на сервере: reverse proxy на приложение
- `certbot`: HTTPS сертификат

По умолчанию приложение слушает порт `5000`.

## Что нужно заранее

- VPS с Ubuntu 22.04 или новее
- домен, который смотрит на IP сервера
- доступ по SSH
- репозиторий проекта на локальной машине

## Важное замечание по env

В коде backend используется переменная `STAFF_PRIVILEGE_KEY`. В `deploy/.env.production.example` ее сейчас нет, но для production ее лучше добавить вручную.

Минимально рекомендую задать:

- `JWT_SECRET`
- `STAFF_PRIVILEGE_KEY`
- `MONGO_ROOT_USERNAME`
- `MONGO_ROOT_PASSWORD`
- `CORS_ORIGIN`

## Вариант переноса проекта на сервер

Самый удобный вариант: заливать через Git.

Если репозиторий уже на GitHub/GitLab:

```bash
ssh root@YOUR_SERVER_IP
cd /opt
git clone YOUR_REPO_URL esports-mood-tracker
cd esports-mood-tracker
```

Если Git-репозитория нет, можно просто скопировать папку с локальной машины:

```bash
scp -r /Users/twizz/Documents/CRMMatvey/esports-mood-tracker root@YOUR_SERVER_IP:/opt/
ssh root@YOUR_SERVER_IP
cd /opt/esports-mood-tracker
```

## Шаг 1. Подключитесь к серверу

```bash
ssh root@YOUR_SERVER_IP
```

Если вы подключаетесь не под `root`, используйте пользователя с `sudo`.

## Шаг 2. Установите Docker

Из корня проекта выполните:

```bash
bash deploy/scripts/install-docker-ubuntu.sh
```

После установки переподключитесь к серверу:

```bash
exit
ssh root@YOUR_SERVER_IP
cd /opt/esports-mood-tracker
```

Проверьте, что Docker работает:

```bash
docker --version
docker compose version
```

## Шаг 3. Создайте production env

Скопируйте шаблон:

```bash
cp deploy/.env.production.example deploy/.env.production
```

Откройте файл:

```bash
nano deploy/.env.production
```

Рекомендуемое содержимое:

```env
PROJECT_NAME=esports-mood-tracker
APP_PORT=5000
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=your-long-random-jwt-secret
STAFF_PRIVILEGE_KEY=your-long-random-staff-key
MONGODB_URI=mongodb://mongo:27017/esports-mood-tracker
CORS_ORIGIN=https://your-domain.com,http://your-domain.com
MONGO_DATABASE=esports-mood-tracker
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-strong-mongo-password
MONGO_PORT=27017
```

Если хотите закрыть сайт только под HTTPS, можно оставить только:

```env
CORS_ORIGIN=https://your-domain.com
```

## Шаг 4. Соберите и запустите проект

Из корня репозитория:

```bash
bash deploy/scripts/deploy.sh
```

Этот скрипт делает:

1. останавливает старые контейнеры
2. пересобирает образ приложения
3. поднимает `app` и `mongo`
4. показывает статус контейнеров

## Шаг 5. Проверьте, что контейнеры запустились

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps
```

Проверьте health-check приложения:

```bash
curl http://127.0.0.1:5000/health-check
```

Ожидаемый ответ:

```json
{"status":"ok","timestamp":"..."}
```

Если нужно посмотреть логи:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f app
```

## Шаг 6. Откройте порт 80 и 443

Если на сервере включен `ufw`:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

## Шаг 7. Настройте Nginx

Установите nginx:

```bash
apt update
apt install -y nginx
```

Скопируйте готовый конфиг:

```bash
cp deploy/nginx/esports-mood-tracker.conf /etc/nginx/sites-available/esports-mood-tracker.conf
```

Откройте его:

```bash
nano /etc/nginx/sites-available/esports-mood-tracker.conf
```

Замените:

- `example.com` на ваш домен
- `proxy_pass http://127.0.0.1:5000;` только если меняли `APP_PORT`

Пример:

```nginx
server {
  listen 80;
  server_name your-domain.com www.your-domain.com;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Активируйте сайт:

```bash
ln -sf /etc/nginx/sites-available/esports-mood-tracker.conf /etc/nginx/sites-enabled/esports-mood-tracker.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Теперь сайт должен открываться по `http://your-domain.com`.

## Шаг 8. Выпустите HTTPS сертификат

Установите certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Выпустите сертификат:

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Проверьте автообновление сертификата:

```bash
systemctl status certbot.timer
```

После этого сайт должен открываться по `https://your-domain.com`.

## Шаг 9. Как обновлять проект после изменений

Если вы деплоите через Git:

```bash
ssh root@YOUR_SERVER_IP
cd /opt/esports-mood-tracker
git pull
bash deploy/scripts/deploy.sh
```

Если вы заливаете проект вручную:

1. перезапишите файлы на сервере
2. зайдите в папку проекта
3. снова выполните `bash deploy/scripts/deploy.sh`

## Шаг 10. Backup MongoDB

Для ручного бэкапа:

```bash
bash deploy/scripts/backup-mongo.sh
```

Если хотите ежедневный backup в `03:30`, добавьте cron:

```bash
crontab -e
```

И вставьте:

```cron
30 3 * * * cd /opt/esports-mood-tracker && bash deploy/scripts/backup-mongo.sh >> /var/log/esports-mood-backup.log 2>&1
```

## Частые проверки после деплоя

Проверить контейнеры:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps
```

Посмотреть логи приложения:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f app
```

Посмотреть логи базы:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f mongo
```

Проверить nginx:

```bash
nginx -t
systemctl status nginx
```

## Если не запускается

### 1. Не открывается сайт

Проверьте:

- домен указывает на правильный IP
- открыты порты `80` и `443`
- `nginx -t` проходит без ошибок
- `curl http://127.0.0.1:5000/health-check` отвечает

### 2. Контейнер `app` падает

Смотрите логи:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs --tail=200 app
```

Частые причины:

- не задан `JWT_SECRET`
- не задан `STAFF_PRIVILEGE_KEY`
- неправильный `MONGODB_URI`
- конфликт порта

### 3. Backend не видит MongoDB

Проверьте, что в `deploy/.env.production` стоит:

```env
MONGODB_URI=mongodb://mongo:27017/esports-mood-tracker
```

И что контейнер базы жив:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps
```

## Кратко: самый короткий путь

Если нужен прям совсем короткий сценарий:

```bash
ssh root@YOUR_SERVER_IP
cd /opt
git clone YOUR_REPO_URL esports-mood-tracker
cd esports-mood-tracker
bash deploy/scripts/install-docker-ubuntu.sh
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
bash deploy/scripts/deploy.sh
curl http://127.0.0.1:5000/health-check
apt update && apt install -y nginx certbot python3-certbot-nginx
cp deploy/nginx/esports-mood-tracker.conf /etc/nginx/sites-available/esports-mood-tracker.conf
nano /etc/nginx/sites-available/esports-mood-tracker.conf
ln -sf /etc/nginx/sites-available/esports-mood-tracker.conf /etc/nginx/sites-enabled/esports-mood-tracker.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```
