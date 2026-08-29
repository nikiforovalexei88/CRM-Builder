# Деплой CRM Builder на Timeweb VPS

Цель: поднять CRM на `crm.nikiforov-alexei.ru` рядом с уже работающим `payroll.nikiforov-alexei.ru`.

Важно: текущая версия CRM в коде работает на SQLite (`data/crm.sqlite`). Для PostgreSQL нужен отдельный этап миграции DB-адаптера и схемы Drizzle обратно на `pg-core`. Ниже инструкция для первого стабильного деплоя текущей версии; блок PostgreSQL оставлен как подготовка инфраструктуры.

## 1. DNS

В DNS домена создать A-запись:

```text
crm.nikiforov-alexei.ru -> 188.225.77.128
```

## 2. Установить пакеты на Ubuntu 24.04

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.25.0 --activate
```

## 3. Подготовить пользователя и папки

```bash
sudo adduser --system --group --home /var/www/crm-builder crm-builder
sudo mkdir -p /var/www/crm-builder /var/log/crm-builder
sudo chown -R crm-builder:crm-builder /var/www/crm-builder /var/log/crm-builder
```

## 4. Скачать проект

```bash
sudo -u crm-builder git clone -b версии git@github.com:nikiforovalexei88/CRM-Builder.git /var/www/crm-builder
cd /var/www/crm-builder
sudo -u crm-builder pnpm install --frozen-lockfile
```

Если сервер не имеет SSH-ключа к GitHub, временно используйте HTTPS clone или добавьте deploy key в GitHub.

## 5. Production env

```bash
sudo -u crm-builder cp deploy/env.production.example .env.production
sudo nano .env.production
```

Заполнить:

```text
SESSION_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## 6. Собрать проект

```bash
sudo -u crm-builder pnpm run typecheck
sudo -u crm-builder pnpm --filter @workspace/api-server run build
sudo -u crm-builder pnpm --filter @workspace/crm run build
```

Если базы еще нет:

```bash
sudo -u crm-builder pnpm --filter @workspace/scripts run setup-sqlite
sudo -u crm-builder pnpm --filter @workspace/scripts run import-excel
```

## 7. systemd

```bash
sudo cp deploy/crm-builder.service /etc/systemd/system/crm-builder.service
sudo systemctl daemon-reload
sudo systemctl enable crm-builder
sudo systemctl start crm-builder
sudo systemctl status crm-builder
```

Проверка:

```bash
curl http://127.0.0.1:5001/api/healthz
```

## 8. nginx

```bash
sudo cp deploy/nginx-crm.nikiforov-alexei.ru.conf /etc/nginx/sites-available/crm.nikiforov-alexei.ru
sudo ln -s /etc/nginx/sites-available/crm.nikiforov-alexei.ru /etc/nginx/sites-enabled/crm.nikiforov-alexei.ru
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS

```bash
sudo certbot --nginx -d crm.nikiforov-alexei.ru
```

Проверка автообновления:

```bash
sudo certbot renew --dry-run
```

## 10. PostgreSQL подготовка

Инфраструктурно базу можно создать так:

```bash
sudo -u postgres psql
```

```sql
CREATE USER crm_builder WITH PASSWORD 'replace-with-strong-password';
CREATE DATABASE crm_builder OWNER crm_builder;
\q
```

Но подключать `DATABASE_URL=postgres://...` сейчас нельзя: приложение в этой версии использует SQLite/libSQL-драйвер и SQLite-схему. Чтобы перейти на PostgreSQL, нужен отдельный этап:

- вернуть DB adapter на `pg`;
- перевести схемы `lib/db/src/schema/*` на `drizzle-orm/pg-core`;
- сделать миграцию данных из SQLite в PostgreSQL;
- обновить production env на `DATABASE_URL`.

## 11. Обновление версии

```bash
cd /var/www/crm-builder
sudo -u crm-builder git pull origin версии
sudo -u crm-builder pnpm install --frozen-lockfile
sudo -u crm-builder pnpm --filter @workspace/api-server run build
sudo -u crm-builder pnpm --filter @workspace/crm run build
sudo systemctl restart crm-builder
sudo systemctl status crm-builder
```
