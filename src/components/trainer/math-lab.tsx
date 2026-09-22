"use client";

import { Button } from "@/components/ui/button";
import { VILLAINS, continuePct, exploitSpec, type Villain } from "@/lib/poker/exploit";
import { chipEvCall, equityNeeded, potOdds, stealEv, stealFoldEquity } from "@/lib/poker/icm";
import { chartFor, STACKS, type StackDepth } from "@/lib/poker/spin";
import { useMemo, useState } from "react";

export function MathLab() {
  const [stack, setStack] = useState<StackDepth>(15);
  const [pot, setPot] = useState(16.5);
  const [call, setCall] = useState(14);
  const [eq, setEq] = useState(42);
  const [villain, setVillain] = useState<Villain>("gto");

  const need = equityNeeded(call, pot);
  const odds = potOdds(call, pot);
  const chip = chipEvCall(eq / 100, call, pot);
  const callOk = eq / 100 + 0.001 >= need;

  const gtoOpen = chartFor(stack, "btn_rfi");
  const gtoDef = chartFor(stack, "bb_vs_btn_raise");
  const open = exploitSpec(gtoOpen, villain, false);
  const def = exploitSpec(gtoDef, villain, true);
  const openPct = continuePct(open);
  const defPct = continuePct(def);
  const gtoOpenPct = continuePct(gtoOpen);
  const foldEq = stealFoldEquity(defPct);
  const steal = stealEv({
    openChips: 2,
    pot: 1.5,
    foldEq,
    calledEquity: 0.42,
  });

  const rows = useMemo(
    () =>
      VILLAINS.map((v) => {
        const o = continuePct(exploitSpec(gtoOpen, v.id, false));
        const d = continuePct(exploitSpec(gtoDef, v.id, true));
        return { ...v, open: o, def: d, fold: stealFoldEquity(d) * 100 };
      }),
    [gtoOpen, gtoDef],
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Математика</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Пот-оддсы, эквити, стил
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Приз Spin — почти всегда победителю. ICM первого места ≈ доля фишек. Решение колла: ваше эквити
          против их диапазона, не против «двух случайных карт».
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">Колл олл-ина</h2>
          <label className="mt-4 block text-sm text-muted">
            Банк, bb
            <input
              type="range"
              min={3}
              max={40}
              step={0.5}
              value={pot}
              onChange={(e) => setPot(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <span className="font-mono text-fg">{pot.toFixed(1)}</span>
          </label>
          <label className="mt-3 block text-sm text-muted">
            Колл, bb
            <input
              type="range"
              min={1}
              max={25}
              step={0.5}
              value={call}
              onChange={(e) => setCall(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <span className="font-mono text-fg">{call.toFixed(1)}</span>
          </label>
          <label className="mt-3 block text-sm text-muted">
            Эквити vs их диапазон, %
            <input
              type="range"
              min={15}
              max={80}
              step={1}
              value={eq}
              onChange={(e) => setEq(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <span className="font-mono text-fg">{eq}%</span>
          </label>
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
            <div>
              <dt className="text-muted">Пот-оддсы</dt>
              <dd className="text-lg text-fg">{(odds * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-muted">Нужно эквити</dt>
              <dd className="text-lg text-fg">{(need * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-muted">Chip EV колла</dt>
              <dd className={chip >= 0 ? "text-lg text-call" : "text-lg text-fold"}>{chip.toFixed(2)} bb</dd>
            </div>
            <div>
              <dt className="text-muted">Решение</dt>
              <dd className="text-lg text-fg">{callOk ? "CALL" : "FOLD"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">
            Формула: нужно call / (pot + call). Если эквити выше — колл печатает фишки. Против нита эквити
            той же руки падает: их джем сильнее. Против маньяка — растёт.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">Стил с BTN</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STACKS.map((bb) => (
              <Button key={bb} size="sm" variant={stack === bb ? "primary" : "secondary"} onClick={() => setStack(bb)}>
                {bb}bb
              </Button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {VILLAINS.map((v) => (
              <Button key={v.id} size="sm" variant={villain === v.id ? "primary" : "secondary"} onClick={() => setVillain(v.id)}>
                {v.label}
              </Button>
            ))}
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">GTO open BTN</dt>
              <dd className="font-mono">{gtoOpenPct.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Ваш open vs {VILLAINS.find((v) => v.id === villain)?.label}</dt>
              <dd className="font-mono">{openPct.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">BB продолжает</dt>
              <dd className="font-mono">{defPct.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Фолд-эквити стила</dt>
              <dd className="font-mono">{(foldEq * 100).toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">EV минрейза 2bb (модель)</dt>
              <dd className="font-mono">{steal.toFixed(2)} bb</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">
            EV стила ≈ FE × пот + (1−FE) × (эквити × банк − (1−эквити) × рейз). Ниты фолдят чаще — стилите
            шире. Лузы защищаются — режьте мусор, вэлью оставляйте.
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Оппонент</th>
              <th className="px-4 py-3 font-medium">BTN open</th>
              <th className="px-4 py-3 font-medium">BB vs 2x</th>
              <th className="px-4 py-3 font-medium">Фолд BB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/70">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted">{r.blurb}</div>
                </td>
                <td className="px-4 py-3 font-mono">{r.open.toFixed(1)}%</td>
                <td className="px-4 py-3 font-mono">{r.def.toFixed(1)}%</td>
                <td className="px-4 py-3 font-mono">{r.fold.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
