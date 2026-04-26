# DropCulture: Global Trade

Telegram Mini App — симулятор цифрового трейдера.  
Відкривай паки, колекціонуй рідкісні сфери, торгуй на маркеті.

## Стек

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Hono + tRPC (єдиний сервер)
- **БД**: MySQL + Drizzle ORM
- **Auth**: Telegram initData + JWT (Bearer token)

## Швидкий старт

### 1. Вимоги
- Node.js 20+
- MySQL 8+ (або Docker)

### 2. MySQL через Docker (найшвидше)
```bash
docker run -d --name dropculture-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=dropculture \
  -p 3306:3306 mysql:8
```

### 3. Налаштування
```bash
cp .env.example .env
# Заповни .env (мінімум: APP_SECRET + DATABASE_URL)
```

### 4. Встановлення та БД
```bash
npm install
npm run db:push      # створює таблиці
npx tsx db/seed.ts   # заповнює Digital Souls колекцію
```

### 5. Запуск
```bash
npm run dev          # http://localhost:3000
```

## Структура

```
api/              Backend (Hono + tRPC)
  game-router.ts  Пак-відкриття, інвентар, щоденний пак, streak
  market-router.ts Маркетплейс — продаж, покупка, комісія 2%
  telegram-auth-router.ts Telegram авторизація
  queries/        SQL запити через Drizzle ORM

src/pages/        Frontend сторінки
  Home.tsx        Головна — профіль, щоденний пак
  PackOpen.tsx    Анімація відкриття пакету
  Inventory.tsx   Інвентар гравця
  Market.tsx      Маркетплейс
  ItemDetail.tsx  Деталі предмета

db/
  schema.ts       Схема БД (users, items, market, etc.)
  seed.ts         Digital Souls колекція (10 сфер)
```

## Команди

| Команда | Дія |
|---------|-----|
| `npm run dev` | Dev сервер з HMR |
| `npm run build` | Production білд |
| `npm start` | Production запуск |
| `npm run db:push` | Застосувати схему до БД |
| `npm run db:generate` | Згенерувати міграції |
| `npx tsx db/seed.ts` | Заповнити БД |

## Деплой на Railway

1. Підключи GitHub репо до Railway
2. Додай MySQL сервіс
3. Встав змінні з `.env.example` у Railway Environment
4. Railway автоматично запустить `npm run build && npm start`

## Деплой на VPS (Ubuntu)

```bash
# 1. Клонуй репо
git clone https://github.com/your/dropculture.git && cd dropculture

# 2. Встанови залежності
npm install

# 3. Білд
npm run build

# 4. БД
npm run db:push && npx tsx db/seed.ts

# 5. PM2
npm install -g pm2
pm2 start "npm start" --name dropculture
pm2 save && pm2 startup
```
