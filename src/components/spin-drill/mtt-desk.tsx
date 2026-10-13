import { useEffect, useMemo, useState } from "react";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { continuePct } from "@/lib/spin-drill/mix";
import { actionWord, spotsOf, type MttPack } from "@/lib/mtt/charts";
import { bluffLine, nashLine, playAction, resolveLive, SEATS, sizeLine, type MttSeat } from "@/lib/mtt/live";
import { cn } from "@/lib/utils";

type Scene = "fold" | "open" | "limp" | "three-blind" | "three-ip" | "cold";

export function MttDesk() {
  const [pack, setPack] = useState<MttPack | null>(null);
  const [error, setError] = useState("");
  const [stack, setStack] = useState(30);
  const [hero, setHero] = useState<MttSeat>("BTN");
  const [scene, setScene] = useState<Scene>("fold");
  const [opener, setOpener] = useState<MttSeat>("UTG");
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
  const before = SEATS.slice(0, SEATS.indexOf(hero));
  const openSeat = before.includes(opener) ? opener : (before[0] ?? null);
  const node = pack
    ? resolveLive({
        pack,
        spots,
        stack,
        hero,
        opener: scene === "open" ? openSeat : null,
        limp: scene === "limp",
        three: scene === "three-blind" ? "blind" : scene === "three-ip" ? "ip" : null,
        cold: scene === "cold",
      })
    : null;
  const action = node && node.kind !== "walk" ? playAction(node, hand, stack) : null;
  const word = action ? actionWord(action, node?.call ?? "Call") : "Банк ваш";
  const size = node ? sizeLine(action ?? "call", stack, node.kind, node.call) : "";
  const bluff = action ? bluffLine(hand, action, hero, node?.kind ?? "open") : null;
  const played = node ? continuePct(node.range, ALL) : 0;

  function pickHero(next: MttSeat) {
    setHero(next);
    const earlier = SEATS.slice(0, SEATS.indexOf(next));
    if (!earlier.includes(opener) && earlier[0]) setOpener(earlier[0]);
    if (!earlier.length && scene === "open") setScene("fold");
    if (next !== "BB" && scene === "limp") setScene("fold");
    if (next !== "BTN" && next !== "BB" && scene === "cold") setScene("fold");
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!pack || !node) return <p className="text-sm text-muted">Загружаю MTT 8-max…</p>;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">MTT · 8-max · совет в раздаче</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">Позиция, что сделали до вас, рука. Одно действие и размер ставки. Миксы убраны: в клетке только преобладающее. Постфлоп 8-max этот пакет не считает — деньги MTT здесь на префлопе, пуше и стиле.</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {pack.stacks.map((item) => (
          <button key={item} type="button" onClick={() => setStack(item)} className={cn("h-8 rounded-full px-2.5 font-mono text-xs", item === stack ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
            {item}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {SEATS.map((seat) => (
          <button key={seat} type="button" onClick={() => pickHero(seat)} className={cn("h-9 rounded-full px-3 text-sm", seat === hero ? "bg-ok text-bg" : "bg-surface-2 text-fg")}>
            {seat === "UTG1" ? "UTG+1" : seat}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <SceneButton on={scene === "fold"} onClick={() => setScene("fold")}>Все сбросили</SceneButton>
        <SceneButton on={scene === "open"} onClick={() => setScene("open")}>Мне открыли</SceneButton>
        {hero === "BB" ? <SceneButton on={scene === "limp"} onClick={() => setScene("limp")}>SB лимп</SceneButton> : null}
        <SceneButton on={scene === "three-blind"} onClick={() => setScene("three-blind")}>Я открыл · 3-бет блайнда</SceneButton>
        <SceneButton on={scene === "three-ip"} onClick={() => setScene("three-ip")}>Я открыл · 3-бет в позиции</SceneButton>
        {hero === "BTN" || hero === "BB" ? <SceneButton on={scene === "cold"} onClick={() => setScene("cold")}>Холодный 4-бет</SceneButton> : null}
      </div>
      {scene === "open" ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted">Открыл</span>
          {before.map((seat) => (
            <button key={seat} type="button" onClick={() => setOpener(seat)} className={cn("h-8 rounded-full px-3 text-xs", openSeat === seat ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
              {seat === "UTG1" ? "UTG+1" : seat}
            </button>
          ))}
        </div>
      ) : null}
      {node.kind === "walk" ? (
        <p className="rounded-2xl border border-ok bg-ok/10 p-4 text-2xl font-semibold">Все сбросили. Банк ваш.</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <MixGrid range={node.range} selected={hand} onPick={setHand} bb={stack} />
            <p className="mt-2 text-xs text-muted">
              В игре {played.toFixed(1)}% рук. Один цвет — преобладающее действие. {node.exact ? "Точный чарт." : "Приближение, точного узла нет."} Стек чарта {node.stackUsed}bb.
            </p>
          </div>
          <div className="space-y-2">
            <div className={cn("rounded-2xl border p-4", action === "fold" ? "border-border" : "border-ok bg-ok/10")}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{stack}bb · {hero === "UTG1" ? "UTG+1" : hero} · {hand}</p>
              <p className="mt-1 text-4xl font-semibold leading-none">{word}</p>
              <p className="mt-2 text-lg font-medium">{size}</p>
              <p className="mt-2 text-sm text-muted">{node.title}. {node.blurb}</p>
            </div>
            {bluff ? (
              <div className={cn("rounded-xl border p-3 text-sm", bluff.on ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-border text-muted")}>
                <p className="text-[10px] font-medium uppercase tracking-wide">{bluff.on ? "Блеф" : "Почему не блеф"}</p>
                <p className="mt-1">{bluff.text}</p>
              </div>
            ) : null}
            <div className="rounded-xl border border-border p-3 text-sm text-muted">
              <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Неш</p>
              <p className="mt-1">{action ? nashLine(stack, action, node.kind) : ""}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SceneButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-8 rounded-full px-3 text-xs", on ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
      {children}
    </button>
  );
}
