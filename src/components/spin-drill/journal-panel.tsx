import { journalSummary, readJournal, writeJournal, type SeatMark, type SessionLog } from "@/lib/spin-drill/journal";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const MARKS: { id: SeatMark; label: string }[] = [
  { id: "nit", label: "Фолдил лишнее" },
  { id: "station", label: "Коллил всё" },
  { id: "lag", label: "Резил широко" },
];

export function JournalPanel() {
  const [rows, setRows] = useState<SessionLog[]>(() => readJournal());
  const [stake, setStake] = useState<0.25 | 1>(0.25);
  const [games, setGames] = useState("20");
  const [profit, setProfit] = useState("0");
  const [note, setNote] = useState("");
  const [saw, setSaw] = useState<Record<SeatMark, number>>({ nit: 0, station: 0, lag: 0 });
  const summary = useMemo(() => journalSummary(rows), [rows]);
  const curve = useMemo(() => running(rows), [rows]);

  function save() {
    const count = Math.round(Number(games));
    const result = Number(profit);
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(result)) return;
    const next: SessionLog = {
      id: `${Date.now()}`,
      at: new Date().toISOString(),
      stake,
      games: count,
      profit: result,
      saw: { ...saw },
      note: note.trim(),
    };
    const all = [next, ...rows].slice(0, 80);
    writeJournal(all);
    setRows(all);
    setNote("");
    setSaw({ nit: 0, station: 0, lag: 0 });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="font-medium">Журнал сессии</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Сюда пишется то, что случилось за столом. Солвер сам рейндж не переписывает: сначала выборка, потом одна правка в симуляторе.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([0.25, 1] as const).map((value) => (
            <button key={value} type="button" onClick={() => setStake(value)} className={cn("h-10 rounded-md px-3 text-sm", stake === value ? "bg-fg text-bg" : "border border-border")}>
              ${value}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-subtle">
            Турниров
            <input value={games} onChange={(event) => setGames(event.target.value)} inputMode="numeric" className="mt-1 h-11 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-base text-fg" />
          </label>
          <label className="text-xs text-subtle">
            Результат, бай-ины
            <input value={profit} onChange={(event) => setProfit(event.target.value)} inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-base text-fg" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MARKS.map((mark) => (
            <button key={mark.id} type="button" onClick={() => setSaw((prev) => ({ ...prev, [mark.id]: prev[mark.id] + 1 }))} className="h-10 rounded-md border border-border px-3 text-sm">
              {mark.label} · {saw[mark.id]}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Что повторялось: лимп, пуш только с тузов, колл второй пары" className="mt-3 h-20 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm" />
        <button type="button" onClick={save} className="mt-3 h-11 rounded-md bg-fg px-4 text-sm font-medium text-bg">
          Записать сессию
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-6 font-mono text-sm">
          <p>Игр {summary.games}</p>
          <p className={summary.profit >= 0 ? "text-ok" : "text-bad"}>
            {summary.profit >= 0 ? "+" : ""}
            {summary.profit.toFixed(1)} бай-инов
          </p>
          <p className={summary.roi >= 0 ? "text-ok" : "text-bad"}>ROI {summary.roi.toFixed(1)}%</p>
          <p className="text-muted">рейк поля {summary.field}%</p>
        </div>
        <p className="mt-2 text-sm text-muted">{summary.text}</p>
        {curve.length > 1 ? <Curve points={curve} /> : null}
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="border-t border-border pt-2">
              <span className="font-mono text-xs text-subtle">{row.at.slice(0, 16).replace("T", " ")} · ${row.stake} · {row.games} игр · </span>
              <span className={cn("font-mono", row.profit >= 0 ? "text-ok" : "text-bad")}>
                {row.profit >= 0 ? "+" : ""}
                {row.profit}
              </span>
              {row.note ? <span className="text-muted"> — {row.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function running(rows: SessionLog[]) {
  const ordered = rows.slice().reverse();
  let games = 0;
  let profit = 0;
  const points = [{ games: 0, profit: 0 }];
  for (const row of ordered) {
    games += row.games;
    profit += row.profit;
    points.push({ games, profit });
  }
  return points;
}

function Curve({ points }: { points: { games: number; profit: number }[] }) {
  const width = 640;
  const height = 180;
  const maxG = Math.max(1, ...points.map((point) => point.games));
  const values = points.flatMap((point) => [point.profit, (-0.07 * point.games)]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (games: number) => (games / maxG) * (width - 24) + 12;
  const y = (profit: number) => height - 16 - ((profit - min) / span) * (height - 32);
  const line = points.map((point) => `${x(point.games)},${y(point.profit)}`).join(" ");
  const rake = points.map((point) => `${x(point.games)},${y(-0.07 * point.games)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-44 w-full">
      <line x1={12} x2={width - 12} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} />
      <polyline fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" points={rake} />
      <polyline fill="none" stroke="currentColor" strokeWidth={2.4} points={line} />
    </svg>
  );
}
