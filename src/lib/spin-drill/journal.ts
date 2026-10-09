export type SeatMark = "nit" | "station" | "lag";

export type SessionLog = {
  id: string;
  at: string;
  stake: 0.25 | 1;
  games: number;
  profit: number;
  saw: Record<SeatMark, number>;
  note: string;
};

const KEY = "spin-journal";

export function readJournal(): SessionLog[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as SessionLog[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function writeJournal(rows: SessionLog[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 80)));
}

export function journalSummary(rows: SessionLog[]) {
  const games = rows.reduce((sum, row) => sum + row.games, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const roi = games ? (profit / games) * 100 : 0;
  const saw = { nit: 0, station: 0, lag: 0 };
  for (const row of rows) {
    saw.nit += row.saw?.nit ?? 0;
    saw.station += row.saw?.station ?? 0;
    saw.lag += row.saw?.lag ?? 0;
  }
  const field = -7;
  let text = "Пока сессий нет. После игры запишите число турниров и результат в бай-инах.";
  if (games > 0 && games < 200) text = `Сыграно ${games}. Это шум. Рейндж не трогаем, пока не будет хотя бы 300 игр.`;
  else if (games >= 200 && roi < field - 8) text = "Вы отдаёте больше рейка. Проверьте, не стилите ли мусор и не блефуете ли на постфлопе.";
  else if (games >= 200 && roi > 0 && games < 1000) text = "Плюс после рейка есть, но выборка короткая. Чарт не расширяем до 1000 игр.";
  else if (games >= 200) text = "Результат рядом с рейком или пока не доказан. Клетки меняются только если один и тот же тип стола повторяется в журнале.";
  if (saw.station > saw.nit && saw.station > saw.lag && saw.station >= 3) text += " Пометки — колл-станции: блеф остаётся выключенным, ставите велью.";
  else if (saw.nit > saw.station && saw.nit > saw.lag && saw.nit >= 3) text += " Пометки — ниты: стил только по клетке, их пуш не коллировать шире.";
  else if (saw.lag > saw.nit && saw.lag > saw.station && saw.lag >= 3) text += " Пометки — агрессивные: не раздувайте банк без руки, их рейз чаще сила.";
  return { games, profit, roi, saw, text, field };
}
