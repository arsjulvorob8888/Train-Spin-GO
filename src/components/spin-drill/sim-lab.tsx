"use client";

import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { primary, type MixAction } from "@/lib/spin-drill/mix";
import { addTotals, emptyTotals, fieldRoi, playBatch, PRIZES, type SimTotals } from "@/lib/spin-drill/sim-engine";
import {
  chartStrategy,
  cloneStrategy,
  parseStrategy,
  pure,
  readVersions,
  spotChoices,
  writeVersions,
  type SavedVersion,
  type SimStrategy,
  type StyleId,
} from "@/lib/spin-drill/sim-strategy";
import { cn } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

const ACTIONS: MixAction[] = ["fold", "call", "raise", "allin"];
const PAINT: Record<MixAction, string> = {
  fold: "bg-fold",
  call: "bg-call",
  raise: "bg-raise",
  allin: "bg-allin",
};

export function SimLab() {
  const [strategy, setStrategy] = useState<SimStrategy>(() => chartStrategy());
  const [versions, setVersions] = useState<SavedVersion[]>(() => readVersions());
  const [spotId, setSpotId] = useState("btn");
  const [totals, setTotals] = useState<SimTotals | null>(null);
  const [before, setBefore] = useState<SimTotals | null>(null);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(1000);
  const [error, setError] = useState("");
  const stop = useRef(false);
  const spots = useMemo(() => spotChoices(), []);
  const range = strategy.ranges[spotId] ?? {};

  function patch(next: Partial<SimStrategy>) {
    setStrategy((current) => ({ ...current, ...next }));
  }

  function paint(hand: string) {
    const now = primary(range[hand] ?? pure("fold"));
    const next = ACTIONS[(ACTIONS.indexOf(now) + 1) % ACTIONS.length]!;
    setStrategy((current) => ({
      ...current,
      ranges: { ...current.ranges, [spotId]: { ...current.ranges[spotId], [hand]: pure(next) } },
    }));
  }

  function dropVersion(id: string) {
    const next = versions.filter((version) => version.id !== id);
    setVersions(next);
    writeVersions(next);
  }

  function saveVersion() {
    const item: SavedVersion = {
      id: `${Date.now()}`,
      name: strategy.name || "Версия",
      savedAt: new Date().toISOString(),
      strategy: cloneStrategy(strategy),
    };
    const next = [item, ...versions].slice(0, 20);
    setVersions(next);
    writeVersions(next);
  }

  function download() {
    const blob = new Blob([JSON.stringify(strategy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${strategy.name || "strategy"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function upload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setStrategy(parseStrategy(String(reader.result ?? "")));
        setError("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Файл не прочитан");
      }
    };
    reader.readAsText(file);
  }

  async function run() {
    stop.current = false;
    setRunning(true);
    setError("");
    setBefore(totals);
    try {
      let acc = emptyTotals();
      let seed = Date.now() % 1000000000;
      let left = target;
      setTotals(acc);
      while (left > 0 && !stop.current) {
        const chunk = Math.min(40, left);
        const part = playBatch(strategy, chunk, seed);
        seed += 997;
        acc = merge(acc, part);
        setTotals(acc);
        left -= chunk;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Симуляция остановилась");
    }
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Симулятор (эксперимент)</h2>
        <p className="mt-1 text-sm text-muted">
          Здесь прогоняется ваша стратегия, а не случайная игра. Префлоп — загруженные рейнджи. Постфлоп — те же действия, что пишет солвер: Check, Raise 2, Raise 4, All-in, Call, Fold. Призы и блайнды — PokerOK 3-max. Равные игроки получают около {fieldRoi().toFixed(1)}% ROI из-за рейка. Смотрите «против поля»: это и есть результат стратегии.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Название</span>
            <input
              value={strategy.name}
              onChange={(event) => patch({ name: event.target.value })}
              className="h-11 rounded-md border border-border bg-surface-2 px-3"
            />
          </label>
          <button type="button" className="h-11 rounded-md bg-fg px-3 text-sm font-medium text-bg" onClick={download}>
            Скачать стратегию
          </button>
          <label className="h-11 cursor-pointer rounded-md border border-border px-3 text-sm leading-[2.75rem]">
            Загрузить
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" className="h-11 rounded-md border border-border px-3 text-sm" onClick={saveVersion}>
            Сохранить версию
          </button>
          <button type="button" className="h-11 rounded-md border border-border px-3 text-sm" onClick={() => setStrategy(chartStrategy())}>
            Вернуть исходную
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
        {versions.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {versions.map((version) => (
              <span key={version.id} className="inline-flex items-center rounded-full border border-border">
                <button type="button" className="h-9 px-3 text-xs" onClick={() => setStrategy(cloneStrategy(version.strategy))}>
                  {version.name}
                </button>
                <button type="button" className="h-9 border-l border-border px-2 text-xs text-muted" onClick={() => dropVersion(version.id)} aria-label="Удалить версию">
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-2">
        <Toggle on={strategy.potOdds} label="Постфлоп как солвер" text="Вкл: Check, Raise 2, Raise 4, All-in, Call и Fold по эквити и цене банка. Выкл: после префлопа только чек, колл с парой." onClick={() => patch({ potOdds: !strategy.potOdds })} />
        <Toggle on={strategy.adaptStack} label="Учитывать стек" text="Короче 9bb ваш рейз становится олл-ином, глубже 22bb олл-ин становится рейзом. У оппонентов это включено всегда." onClick={() => patch({ adaptStack: !strategy.adaptStack })} />
        <Toggle on={strategy.bluff} label="Добавить блеф" text="Поверх солвера: часть чеков с баттона и воздуха становится Raise 2, если стиль оппонентов достаточно часто сбрасывает." onClick={() => patch({ bluff: !strategy.bluff })} />
        <Toggle on={strategy.mirror} label="Оппоненты копируют чарт" text="Выкл: вы играете свою правку, они — исходный чарт. Вкл: все трое играют одно и то же, так проверяется сам чарт." onClick={() => patch({ mirror: !strategy.mirror })} />
        <Toggle on={strategy.fixedStack} label="Фиксированный стек" text="Выкл: стек берётся из множителя. Вкл: каждая игра начинается с выбранной глубины." onClick={() => patch({ fixedStack: !strategy.fixedStack })} />
        <label className="rounded-xl bg-surface-2 p-3 text-sm">
          <span className="font-medium">Стиль оппонентов</span>
          <select
            value={strategy.style}
            onChange={(event) => patch({ style: event.target.value as StyleId })}
            className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-2"
          >
            <option value="off">Не учитывать, играют чарт</option>
            <option value="reg">Регуляр, тот же чарт</option>
            <option value="nit">Нит, фолдит шире</option>
            <option value="lag">Агрессивный, входит шире</option>
          </select>
        </label>
        <Slider label={`Поправка колла: ${(strategy.edge * 100).toFixed(0)}%`} min={-5} max={15} value={Math.round(strategy.edge * 100)} onChange={(value) => patch({ edge: value / 100 })} />
        <Slider label={`Частота блефа: ${Math.round(strategy.bluffFreq * 100)}%`} min={0} max={40} value={Math.round(strategy.bluffFreq * 100)} onChange={(value) => patch({ bluffFreq: value / 100 })} />
        <Slider label={`Стек эксперимента: ${strategy.stackBb.toFixed(0)}bb`} min={8} max={50} value={strategy.stackBb} onChange={(value) => patch({ stackBb: value, fixedStack: true })} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[200, 1000, 5000].map((n) => (
            <button key={n} type="button" className={cn("h-11 rounded-full border px-3 text-sm", target === n ? "border-fg bg-fg text-bg" : "border-border")} onClick={() => setTarget(n)}>
              {n} игр
            </button>
          ))}
          <button type="button" className="h-11 rounded-md bg-fg px-4 text-sm font-medium text-bg" disabled={running} onClick={() => void run()}>
            {running ? "Счёт..." : "Прогнать стратегию"}
          </button>
          {running ? (
            <button type="button" className="h-11 rounded-md border border-border px-3 text-sm" onClick={() => (stop.current = true)}>
              Стоп
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-muted">Сначала прогоните как есть. Потом поменяйте один рейндж, блеф или тип игрока и прогоните снова: разница с прошлым результатом появится под цифрами.</p>
        {totals ? <Report totals={totals} previous={before} /> : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-medium">Рейнджи стратегии</h3>
          <select value={spotId} onChange={(event) => setSpotId(event.target.value)} className="h-11 rounded-md border border-border bg-surface-2 px-2 text-sm">
            {spots.map((spot) => (
              <option key={spot.id} value={spot.id}>
                {spot.title}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">Клик по клетке ставит 100%: Fold → Call → Raise → All-in. Смеси чарта живут, пока клетку не тронули.</span>
        </div>
        <div className="grid max-w-[520px] grid-cols-13 gap-px">
          {Array.from({ length: 13 }, (_, row) =>
            Array.from({ length: 13 }, (_, col) => {
              const hand = handAt(row, col);
              const action = primary(range[hand] ?? pure("fold"));
              return (
                <button key={hand} type="button" className={cn("aspect-square font-mono text-[9px] font-bold text-fg", PAINT[action])} onClick={() => paint(hand)}>
                  {hand}
                </button>
              );
            }),
          )}
        </div>
      </section>
    </div>
  );
}

function Toggle({ on, label, text, onClick }: { on: boolean; label: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="rounded-xl bg-surface-2 p-3 text-left" onClick={onClick}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className={cn("rounded-full px-2 py-0.5 font-mono text-xs", on ? "bg-fg text-bg" : "bg-surface text-muted")}>{on ? "вкл" : "выкл"}</span>
      </span>
      <span className="mt-1 block text-sm text-muted">{text}</span>
    </button>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="rounded-xl bg-surface-2 p-3 text-sm">
      <span className="font-medium">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full" />
    </label>
  );
}

function Report({ totals, previous }: { totals: SimTotals; previous: SimTotals | null }) {
  const n = Math.max(1, totals.games);
  const roi = (totals.profit / n) * 100;
  const mean = totals.profit / n;
  const variance = Math.max(0, totals.sumSq / n - mean * mean);
  const se = Math.sqrt(variance / n);
  const points = totals.curve;
  const low = Math.min(...points, 0);
  const high = Math.max(...points, 0);
  const peak = Math.max(...points);
  const floor = Math.min(...points);
  const span = high - low || 1;
  const line = points
    .map((value, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 600;
      const y = 150 - ((value - low) / span) * 140;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const zero = 150 - ((0 - low) / span) * 140;
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="ROI" value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`} />
        <Stat label="Против поля" value={`${roi - fieldRoi() >= 0 ? "+" : ""}${(roi - fieldRoi()).toFixed(1)}%`} />
        <Stat label="Профит, бай-ины" value={`${totals.profit >= 0 ? "+" : ""}${totals.profit.toFixed(1)}`} />
        <Stat label="1 / 2 / 3 место" value={`${pct(totals.wins, n)} / ${pct(totals.second, n)} / ${pct(totals.third, n)}`} />
        <Stat label="95% коридор ROI" value={`±${(1.96 * se * 100).toFixed(1)}%`} />
        <Stat label="Лучшая точка" value={`${peak.toFixed(1)} би`} />
        <Stat label="Просадка" value={`${floor.toFixed(1)} би`} />
        <Stat label="Игр" value={String(totals.games)} />
        <Stat label="Среднее за игру" value={`${mean >= 0 ? "+" : ""}${mean.toFixed(3)} би`} />
      </div>
      {previous && previous.games > 0 ? <Delta current={roi - fieldRoi()} past={(previous.profit / previous.games) * 100 - fieldRoi()} /> : null}
      <svg viewBox="0 0 600 160" className="h-40 w-full rounded-xl bg-surface-2">
        <line x1="0" x2="600" y1={zero} y2={zero} stroke="currentColor" strokeOpacity="0.25" />
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={line} />
      </svg>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-xs text-subtle">
            <tr>
              <th className="py-1 pr-3">Множитель</th>
              <th className="py-1 pr-3">Шанс</th>
              <th className="py-1 pr-3">Стек</th>
              <th className="py-1 pr-3">Призы</th>
              <th className="py-1 pr-3">Игр</th>
              <th className="py-1">ROI</th>
            </tr>
          </thead>
          <tbody>
            {PRIZES.map((row) => {
              const got = totals.byMult[row.mult];
              const chance = (row.weight / 100000000) * 100;
              const local = got && got.games ? (got.profit / got.games) * 100 : 0;
              return (
                <tr key={row.mult} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-mono">x{row.mult}</td>
                  <td className="py-1.5 pr-3 font-mono">{chance.toFixed(chance < 1 ? 3 : 1)}%</td>
                  <td className="py-1.5 pr-3 font-mono">{row.stack / 20}bb</td>
                  <td className="py-1.5 pr-3 font-mono">{row.places.filter((place) => place > 0).map((place) => `${place}x`).join(" / ") || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono">{got?.games ?? 0}</td>
                  <td className="py-1.5 font-mono">{got?.games ? `${local >= 0 ? "+" : ""}${local.toFixed(0)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Delta({ current, past }: { current: number; past: number }) {
  const diff = current - past;
  return (
    <p className="text-sm text-muted">
      Против поля сейчас {signed(current)}%. Прошлый прогон {signed(past)}%. Разница {signed(diff)} п.п.
      {diff > 0.5 ? " Эта правка лучше предыдущей." : diff < -0.5 ? " Эта правка хуже предыдущей." : " Разница внутри шума, нужен более длинный прогон."}
    </p>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

function pct(part: number, total: number): string {
  return `${Math.round((part / total) * 100)}%`;
}

function merge(into: SimTotals, part: SimTotals): SimTotals {
  const next = emptyTotals();
  next.curve = into.curve.slice();
  next.byMult = JSON.parse(JSON.stringify(into.byMult)) as SimTotals["byMult"];
  next.games = into.games;
  next.profit = into.profit;
  next.wins = into.wins;
  next.second = into.second;
  next.third = into.third;
  next.sumSq = into.sumSq;
  next.maxUp = into.maxUp;
  next.maxDown = into.maxDown;
  addTotals(next, part);
  return next;
}
