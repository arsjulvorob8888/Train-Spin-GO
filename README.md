# Spin Drill

Тренажёр **Spin & Go 3-max · 15bb · ICM 50/30/20**.

Полное префлоп-дерево: 21 спот (BTN, SB, BB, heads-up), микс-частоты, тренировка с клавиатурой, статистика по рукам и **математика на реальных раздачах**.

## Споты

| Позиция | Сценарии |
|---|---|
| **BTN** | Unopened, vs 3-bet, vs 3-bet jam |
| **SB** | vs BTN Fold / Limp / Raise 2 / All-in, vs BB iso, vs BB jam |
| **BB** | vs BTN 2x / All-in / Limp, vs SB Limp / Raise 2 / All-in, squeeze, reshove |
| **HU** | SB first in, BB vs Limp / 2x / All-in |

Клавиши в тренировке: **F** fold · **C** call/limp/check · **R** raise · **A** all-in.

## Математика

Вкладка **Математика** — раздачи из спина, не теория в вакууме. Считаете пот-оддсы, эквити, ауты, EV, фолд-эквити, ICM и комбо. Неверный ответ открывает пошаговый разбор: формула, подстановка, решение профи и типичная утечка.

## Запуск

```bash
npm install
npm run dev
```

Приложение слушает `http://localhost:8080`.

```bash
npm run typecheck
npm run build
```

Прогресс хранится в `localStorage`. Стек: React 19, TanStack Start, Tailwind v4.

## Render.com (train-spin-go.onrender.com)

Это **не** статический сайт. Если в Render выбран **Static Site**, страница будет `Not Found` — в репозитории нет корневого `index.html`, сервер собирает Nitro.

Нужен **Web Service** из репозитория [arsjulvorob8888/Train-Spin-GO](https://github.com/arsjulvorob8888/Train-Spin-GO), ветка `main`:

| Поле | Значение |
|---|---|
| Тип | **Web Service** (Node) |
| Build | `npm install && npm run build:render` |
| Start | `node .output/server/index.mjs` |
| Auto-Deploy | On Commit |
| `NODE_VERSION` | `22` |
| `NITRO_PRESET` | `node-server` |
| `HOST` | `0.0.0.0` |

Либо **New → Blueprint** и этот `render.yaml` — имя сервиса `train-spin-go`, автодеплой с каждого пуша в `main`.

## Закрытый вход владельца

Сервер не отдаёт страницы, API и файлы диапазонов, пока нет сессии владельца. Регистрации нет. Пароль в репозиторий не кладётся.

На своей машине (пароль вводится в stdin, в аргументы не попадает):

```bash
node scripts/owner-auth-setup.mjs
```

Скрипт печатает две строки. Их нужно вставить в Environment сервиса Render и перезапустить его. Локально те же строки можно положить в `.env` (файл в gitignore). Не используйте пароль от другого сайта.

| Переменная | Назначение |
|---|---|
| `OWNER_PASSWORD_HASH` | scrypt-хеш пароля, не сам пароль |
| `OWNER_SESSION_SECRET` | секрет подписи cookie, не короче 32 символов |

Пока любой из них пустой или хеш не в формате `scrypt:…`, приложение отвечает **503** и ничего из тренажёра не отдаёт. `GET /healthz` остаётся без входа и возвращает только `{"ok":true}` — это проверка Render.

В `render.yaml` проверка сменена с `/` на `/healthz`. Если сервис создан вручную, в Dashboard → Health Check Path поставьте `/healthz`. Иначе после деплоя Render увидит 401 на `/` и сочтёт сервис сломанным. Тип сервиса оставьте **Web Service** (Node), `NITRO_PRESET=node-server`. Static Site снова отдаст файлы в обход входа.

Вход: пароль на странице «Личный тренажёр». Выход: кнопка «Выйти». Cookie `owner_session`: HttpOnly, SameSite=Lax, Secure на https, срок 12 часов.

Если сейчас висит Static Site с тем же URL: удалите его (или смените тип на Web Service) и создайте сервис заново с таблицей выше. Иначе Render так и будет искать `index.html`.
