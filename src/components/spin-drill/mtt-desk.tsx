import { useEffect, useMemo, useState } from "react";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { continuePct, mixOf, primary, segs, type MixAction } from "@/lib/spin-drill/mix";
import { actionWord, chartKey, GROUP_LABEL, rangeOf, spotsOf, type MttGroup, type MttPack, type MttSpot } from "@/lib/mtt/charts";
import { cn } from "@/lib/utils";

const GROUPS: MttGroup[] = ["open", "face", "three", "cold"];

export function MttDesk() {
  const [pack, setPack] = useState<MttPack | null>(null);
  const [error, setError] = useState("");
  const [stack, setStack] = useState(30);
  const [group, setGroup] = useState<MttGroup>("open");
  const [spotId, setSpotId] = useState("rfi:BTN");
  const [hand, setHand] = useState("AKs");

  useEffect(() => {
    let live = true;
    fetch("/mtt-8max.json")
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<MttPack>;
      })
      .then((next) => {
        if (live) setPack(next);
      })
      .catch(() => {
        if (live) setError("Чарты не загрузились.");
      });
    return () => {
      live = false;
    };
  }, []);

  const spots = useMemo(() => (pack ? spotsOf(pack) : []), [pack]);
  const visible = spots.filter((spot) => spot.group === group && spot.stacks.includes(stack));
  const spot = visible.find((item) => item.id === spotId) ?? visible[0] ?? null;
  const range = spot && pack ? rangeOf(pack.charts[chartKey(stack, spot)]) : {};
  const mix = hand ? mixOf(range, hand) : null;
  const action = mix ? primary(mix) : null;
  const played = continuePct(range, ALL);

  function pickStack(next: number) {
    setStack(next);
    const still = spots.find((item) => item.id === spotId && item.group === group && item.stacks.includes(next));
    if (!still) {
      const fallback = spots.find((item) => item.group === group && item.stacks.includes(next));
      if (fallback) setSpotId(fallback.id);
    }
  }

  function pickGroup(next: MttGroup) {
    setGroup(next);
    const fallback = spots.find((item) => item.group === next && item.stacks.includes(stack));
    if (fallback) setSpotId(fallback.id);
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!pack) return <p className="text-sm text-muted">Загружаю чарты MTT 8-max…</p>;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">MTT · техасский холдем · 8-max</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Префлоп-чарты на 16 стеков: открытие, игра против рейза, против 3-бета и холодный 4-бет. Нажмите клетку — солвер скажет действие и частоту.
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {pack.stacks.map((item) => (
          <button key={item} type="button" onClick={() => pickStack(item)} className={cn("h-8 rounded-full px-3 font-mono text-xs", item === stack ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
            {item}bb
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {GROUPS.map((item) => (
          <button key={item} type="button" onClick={() => pickGroup(item)} className={cn("h-8 rounded-full px-3 text-xs", item === group ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
            {GROUP_LABEL[item]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {visible.map((item) => (
          <button key={item.id} type="button" onClick={() => setSpotId(item.id)} className={cn("h-8 rounded-full px-3 text-xs", item.id === spot?.id ? "bg-ok text-bg" : "bg-surface-2 text-fg")}>
            {item.title}
          </button>
        ))}
      </div>
      {spot && mix && action ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <MixGrid range={range} selected={hand} onPick={setHand} bb={stack} />
            <p className="mt-2 text-xs text-muted">Входит {played.toFixed(1)}% рук. Красный — рейз, зелёный — {spot.call === "Check" ? "чек" : "колл"}, оранжевый — олл-ин, серый — фолд.</p>
          </div>
          <Decision hand={hand} action={action} mix={mix} spot={spot} stack={stack} />
        </div>
      ) : (
        <p className="text-sm text-muted">На {stack}bb в этом разделе чартов нет. Для 3-бета и холодного 4-бета есть 30, 50 и 100bb.</p>
      )}
      <p className="text-[11px] text-subtle">
        Источник чартов:{" "}
        <a className="underline" href={pack.source} target="_blank" rel="noreferrer">
          poker-hand-review
        </a>
        , лицензия {pack.license}. Это префлоп 8-max MTT, не постфлоп и не ICM под конкретный стол выплат.
      </p>
    </section>
  );
}

function Decision({
  hand,
  action,
  mix,
  spot,
  stack,
}: {
  hand: string;
  action: MixAction;
  mix: ReturnType<typeof mixOf>;
  spot: MttSpot;
  stack: number;
}) {
  const word = actionWord(action, spot.call);
  const parts = segs(mix).filter((part) => part.p > 0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{stack}bb · {spot.title}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{hand}</p>
      <p className="mt-1 text-4xl font-semibold leading-none">{word}</p>
      <p className="mt-2 text-sm text-muted">{spot.blurb}</p>
      <div className="mt-3 space-y-1">
        {parts.map((part) => (
          <p key={part.a} className="flex items-center justify-between font-mono text-sm">
            <span>{actionWord(part.a, spot.call)}</span>
            <span>{part.p}%</span>
          </p>
        ))}
      </div>
    </div>
  );
}
