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
        {totals ? <Report totals={totals} previous={before} strategy={strategy} /> : null}
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

function Report({ totals, previous, strategy }: { totals: SimTotals; previous: SimTotals | null; strategy: SimStrategy }) {
  const n = Math.max(1, totals.games);
  const roi = (totals.profit / n) * 100;
  const mean = totals.profit / n;
  const variance = Math.max(0, totals.sumSq / n - mean * mean);
  const se = Math.sqrt(variance / n);
  const ci = 1.96 * se * 100;
  const field = fieldRoi();
  const versus = roi - field;
  const first = totals.wins / n;
  const second = totals.second / n;
  const third = totals.third / n;
  const points = totals.curve;
  const peak = Math.max(...points);
  const floor = Math.min(...points);
  const common = [2, 3].map((mult) => {
    const got = totals.byMult[mult];
    return { mult, games: got?.games ?? 0, roi: got?.games ? (got.profit / got.games) * 100 : 0 };
  });
  const lines = readResult({ strategy, roi, versus, ci, field, first, second, third, games: totals.games, common, previous });
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="ROI" value={`${signed(roi)}%`} hint="Доход на каждый бай-ин. Сюда уже входит рейк." tone={roi >= field ? "ok" : "bad"} />
        <Stat label="Против поля" value={`${signed(versus)}%`} hint={`Ноль — это уровень рейка, около ${field.toFixed(1)}%. Плюс значит, что стратегия обыгрывает поле.`} tone={versus > ci ? "ok" : versus < -ci ? "bad" : "flat"} />
        <Stat label="Профит, бай-ины" value={`${signed(totals.profit)}`} hint="Сумма за весь прогон. Одна удачная x100 двигает её сильнее, чем сто обычных игр." />
        <Stat label="1 / 2 / 3 место" value={`${pct(totals.wins, n)} / ${pct(totals.second, n)} / ${pct(totals.third, n)}`} hint="У равных игроков около 33 / 33 / 33. Сдвиг показывает, вылетаете вы рано или не добираете победы." />
        <Stat label="95% коридор" value={`±${ci.toFixed(1)}%`} hint="Если «против поля» внутри этой вилки, разница ещё может быть случайностью." tone={ci > 8 ? "bad" : "flat"} />
        <Stat label="Лучшая точка" value={`${signed(peak)} би`} hint="Самый высокий банкролл на дистанции. Показывает удачный отрезок, не силу стратегии." />
        <Stat label="Просадка" value={`${floor.toFixed(1)} би`} hint="Насколько банк уходил в минус. Такой запас бай-инов нужен, чтобы досидеть этот отрезок." tone={floor < -20 ? "bad" : "flat"} />
        <Stat label="Среднее за игру" value={`${signed(mean)} би`} hint="То же, что ROI, но в бай-инах. Минус 0.07 — это просто рейк, не ошибка чарта." />
      </div>
      <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm leading-relaxed">
        <p className="font-medium">Что это значит</p>
        <ul className="mt-2 space-y-2 text-muted">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <BankrollChart points={points} games={totals.games} />
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
              const rare = row.mult >= 50;
              return (
                <tr key={row.mult} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-mono">x{row.mult}</td>
                  <td className="py-1.5 pr-3 font-mono">{chance.toFixed(chance < 1 ? 3 : 1)}%</td>
                  <td className="py-1.5 pr-3 font-mono">{row.stack / 20}bb</td>
                  <td className="py-1.5 pr-3 font-mono">{row.places.filter((place) => place > 0).map((place) => `${place}x`).join(" / ") || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono">{got?.games ?? 0}</td>
                  <td className={cn("py-1.5 font-mono", got?.games ? (local >= field ? "text-ok" : "text-bad") : "", rare && "text-subtle")}>
                    {got?.games ? `${signed(local)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Смотрите x2 и x3: это больше 90% игр, стек 15bb, платит только первое место. x50 и выше серые не потому, что плохие, а потому что на коротком прогоне их почти нет.</p>
      </div>
    </div>
  );
}

function readResult(opts: {
  strategy: SimStrategy;
  roi: number;
  versus: number;
  ci: number;
  field: number;
  first: number;
  second: number;
  third: number;
  games: number;
  common: { mult: number; games: number; roi: number }[];
  previous: SimTotals | null;
}): string[] {
  const { strategy, versus, ci, field, first, second, third, games, common, previous } = opts;
  const lines: string[] = [];
  lines.push(
    `«${strategy.name}» за ${games} игр даёт ROI ${signed(opts.roi)}%. Рейк забирает около ${Math.abs(field).toFixed(1)}%, поэтому навык — это ${signed(versus)}% против поля.`,
  );
  if (Math.abs(versus) <= ci) {
    lines.push(`Разница меньше коридора ±${ci.toFixed(1)}%. По этому прогону стратегия не отличима от поля. Не меняйте рейндж, пока не прогоните 5000 игр.`);
  } else if (versus > 0) {
    lines.push(`Плюс больше коридора ±${ci.toFixed(1)}%. Сохраните версию и повторите на 5000 играх. Если плюс останется, правка рабочая.`);
  } else {
    lines.push(`Минус больше коридора ±${ci.toFixed(1)}%. Стратегия сдаёт сверх рейка. Сначала уберите лишние коллы, и только потом пробуйте блеф.`);
  }
  if (Math.abs(first - 1 / 3) < 0.035 && Math.abs(second - third) < 0.06) {
    lines.push("Места близки к 33 / 33 / 33. Чарт сам по себе не отдаёт крупного преимущества. Плюс появляется, когда вы подстраиваетесь под тип стола, а не когда ломаете весь рейндж.");
  } else if (third > first + 0.08 && third > second + 0.05) {
    lines.push("Третьих мест заметно больше вторых: вы вылетаете первым. На BB против рейза и против олл-ина замените пограничный Call на Fold и прогоните снова.");
  } else if (first < 0.3 && second > first) {
    lines.push("Первых мест мало, вторых много. Вы доживаете, но не забираете турнир. С баттона можно открывать шире. Блеф добавляйте только против нитов.");
  } else if (first > 0.37) {
    lines.push("Первых мест больше трети. Стратегия чаще забирает банк. Проверьте, не держится ли это на одном джекпоте: сравните ROI у x2 и x3.");
  }
  const named = common.filter((row) => row.games > 0).map((row) => `x${row.mult} ${signed(row.roi)}% (${row.games})`);
  if (named.length) {
    lines.push(`Основные структуры: ${named.join(", ")}. Если здесь минус, а общий ROI спасает редкий множитель, стратегию это не улучшает.`);
  }
  if (strategy.mirror) {
    lines.push("Оппоненты копируют ваш чарт. Так проверяют сам чарт: «против поля» должно быть около нуля. Чтобы оценить одну правку, выключите этот переключатель.");
  } else if (!strategy.potOdds) {
    lines.push("Постфлоп солвера выключен, остался только префлоп-чарт. Включите «Постфлоп как солвер» и сравните «против поля»: разница и есть цена линий Check, Raise 2, Raise 4 и All-in.");
  } else if (!strategy.bluff && strategy.style === "nit") {
    lines.push("Стол нитовый, блеф выключен. Включите блеф на 15–20% и прогоните снова: нит сбрасывает стилы чаще чарта.");
  } else if (strategy.bluff && strategy.style !== "nit") {
    lines.push("Блеф включён не против нита. Если «против поля» не выросло, выключите его: регуляр и агрессивный игрок коллируют стилы.");
  } else if (strategy.style === "lag" && strategy.edge < 0.04) {
    lines.push("Против агрессивных поднимите поправку колла до 4–8%. Вы перестанете оплачивать ставки, которые они делают шире чарта.");
  } else if (strategy.edge > 0.08) {
    lines.push("Поправка колла уже очень строгая. Если первых мест стало меньше, верните её ближе к нулю: вы фолдите руки, которые чарт хотел коллировать.");
  } else {
    lines.push("Следующий шаг: выберите тип стола, поменяйте только один переключатель и сравните «против поля» с этим прогоном. Одну клетку рейнджа меняйте так же, по одной.");
  }
  if (previous && previous.games > 0) {
    const past = (previous.profit / previous.games) * 100 - field;
    const diff = versus - past;
    lines.push(
      `Прошлый прогон был ${signed(past)}% против поля. Сейчас ${signed(diff)} п.п. ${diff > 0.5 ? "Эта правка лучше." : diff < -0.5 ? "Эта правка хуже, верните прошлую версию." : "Сдвиг внутри шума."}`,
    );
  }
  return lines;
}

function BankrollChart({ points, games }: { points: number[]; games: number }) {
  const width = 640;
  const height = 228;
  const left = 58;
  const right = 16;
  const top = 22;
  const bottom = 36;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const low = Math.min(...points, 0);
  const high = Math.max(...points, 0);
  const span = high - low || 1;
  const yOf = (value: number) => top + (1 - (value - low) / span) * plotH;
  const xOf = (index: number) => left + (index / Math.max(1, points.length - 1)) * plotW;
  const line = points.map((value, index) => `${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1] ?? 0;
  const color = last >= 0 ? "#3dba7c" : "#e25555";
  const area = `${left.toFixed(1)},${yOf(0).toFixed(1)} ${line} ${(left + plotW).toFixed(1)},${yOf(0).toFixed(1)}`;
  const yTicks = [...new Set([high, 0, low])];
  const xTicks = [0, Math.round(games / 2), games];
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full rounded-xl bg-surface-2 text-fg" role="img" aria-label="График банкролла">
        <text x={left} y={14} fill="currentColor" fontSize="11" opacity="0.72">
          Банкролл, бай-ины
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={left + plotW} y1={yOf(tick)} y2={yOf(tick)} stroke="currentColor" strokeOpacity={tick === 0 ? 0.5 : 0.14} />
            <text x={left - 8} y={yOf(tick) + 4} textAnchor="end" fill="currentColor" fontSize="11" opacity="0.78">
              {tick.toFixed(0)}
            </text>
          </g>
        ))}
        <polygon points={area} fill={color} opacity="0.14" />
        <polyline fill="none" stroke={color} strokeWidth="2.25" points={line} />
        <circle cx={xOf(points.length - 1)} cy={yOf(last)} r="3.5" fill={color} />
        {xTicks.map((tick) => {
          const index = points.length <= 1 ? 0 : Math.round((tick / Math.max(1, games)) * (points.length - 1));
          return (
            <text key={tick} x={xOf(index)} y={height - 8} textAnchor={tick === 0 ? "start" : tick === games ? "end" : "middle"} fill="currentColor" fontSize="11" opacity="0.78">
              {tick}
            </text>
          );
        })}
        <text x={left + plotW} y={height - 22} textAnchor="end" fill="currentColor" fontSize="11" opacity="0.55">
          игры
        </text>
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-muted">
        Ось Y — банкролл в бай-инах, ось X — сколько турниров уже сыграно. Горизонтальная линия на нуле — старт. Линия ниже нуля значит, что бай-ины ещё не отбиты. Точка справа — итог прогона, {signed(last)} би.
      </figcaption>
    </figure>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function Stat({ label, value, hint, tone = "flat" }: { label: string; value: string; hint: string; tone?: "ok" | "bad" | "flat" }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-lg", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-subtle">{hint}</p>
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
