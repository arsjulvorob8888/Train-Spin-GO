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
