import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { consult } from "@/lib/spin-drill/equity-calc";
import type { MixRange } from "@/lib/spin-drill/mix";
import type { SpotDef } from "@/lib/spin-drill/spots";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const RANKS = [...RANK_CHARS].reverse();
const SLOTS = ["h0", "h1", "f0", "f1", "f2", "t", "r"] as const;
type Slot = (typeof SLOTS)[number];

export function EquityDesk({
  spot,
  range,
  bb,
  labels,
  onHand,
}: {
  spot: SpotDef;
  range: MixRange;
  bb: number;
  labels: SpotDef["labels"];
  onHand: (hand: string) => void;
}) {
  const [cards, setCards] = useState<Partial<Record<Slot, Card>>>({});
  const [picking, setPicking] = useState<Slot | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const hero = useMemo(() => {
    if (!cards.h0 || !cards.h1) return null;
    return [cards.h0, cards.h1] as [Card, Card];
  }, [cards]);
  const board = useMemo(() => {
    if (!cards.f0 || !cards.f1 || !cards.f2) return [];
    const flop = [cards.f0, cards.f1, cards.f2];
    if (cards.t) flop.push(cards.t);
    if (cards.t && cards.r) flop.push(cards.r);
    return flop;
  }, [cards]);

  const shown = useMemo(() => {
    if (!hero) return null;
    const once = consult({ hero, board, spotId: spot.id, bb, range, labels });
    return { ...once, label: labels[once.action] };
  }, [hero, board, spot.id, bb, range, labels]);

  function used(card: Card, except: Slot): boolean {
    return SLOTS.some((slot) => slot !== except && cards[slot] && cards[slot]!.rank === card.rank && cards[slot]!.suit === card.suit);
  }

  function choose(suit: number) {
    if (picking == null || rank == null) return;
    const card = { rank, suit };
    if (used(card, picking)) return;
    const next = { ...cards, [picking]: card };
    setCards(next);
    setPicking(null);
    setRank(null);
    if (next.h0 && next.h1) {
      const klass = shownKlass(next.h0, next.h1);
      onHand(klass);
    }
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-sm font-medium">Эквити</p>
      <p className="mt-0.5 text-xs text-muted">Две свои карты. Борд можно не заполнять.</p>
      <p className="mt-3 text-[10px] font-medium tracking-wide text-subtle uppercase">Мои карты</p>
      <div className="mt-1 flex gap-2">
        {(["h0", "h1"] as const).map((slot) => (
          <CardSlot key={slot} card={cards[slot] ?? null} active={picking === slot} onClick={() => open(slot)} />
        ))}
      </div>
      <p className="mt-3 text-[10px] font-medium tracking-wide text-subtle uppercase">Флоп · терн · ривер</p>
      <div className="mt-1 flex gap-1">
        {(["f0", "f1", "f2", "t", "r"] as const).map((slot) => (
          <CardSlot key={slot} card={cards[slot] ?? null} active={picking === slot} small onClick={() => open(slot)} />
        ))}
      </div>
      {picking ? (
        <div className="absolute top-12 right-2 left-2 z-20 rounded-xl border border-border bg-surface p-2 shadow-border">
          <div className="grid grid-cols-7 gap-1">
            {RANKS.map((glyph) => {
              const value = RANK_CHARS.indexOf(glyph);
              return (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => setRank(value)}
                  className={cn(
                    "h-8 rounded-md font-mono text-sm",
                    rank === value ? "bg-fg text-bg" : "bg-surface-2 text-fg",
                  )}
                >
                  {glyph === "T" ? "10" : glyph}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {SUIT_GLYPHS.map((glyph, suit) => (
              <button
                key={glyph}
                type="button"
                disabled={rank == null}
                onClick={() => choose(suit)}
                className={cn(
                  "h-10 rounded-md bg-card-face font-mono text-xl disabled:opacity-40",
                  isRedSuit(suit) ? "text-suit-red" : "text-card-ink",
                )}
              >
                {glyph}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {shown ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-muted">{shown.klass}</p>
              <p className="text-2xl font-semibold leading-none">{shown.label}</p>
            </div>
            <p className="font-mono text-3xl font-semibold leading-none">{Math.round(shown.equity * 100)}%</p>
          </div>
          <p className="text-sm leading-snug text-muted">{shown.text}</p>
          <p className="font-mono text-xs text-subtle">
            выигрыш {Math.round(shown.win * 100)}% · ничья {Math.round(shown.tie * 100)}%
            {shown.need != null ? ` · нужно ${Math.round(shown.need * 100)}%` : ""}
          </p>
          {shown.made ? <p className="text-sm">На борде: {shown.made}{shown.draw ? ` · ${shown.draw}` : ""}</p> : null}
          {shown.likely.length ? (
            <div>
              <p className="text-xs text-muted">Верх диапазона оппонента</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {shown.likely.map((item) => (
                  <span key={item.hand} className="rounded-full bg-surface px-2 py-0.5 font-mono text-xs">
                    {item.hand}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">На этой глубине рейндж пустой, считаю против случайной руки.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Нажми пустую карту, выбери достоинство и масть.</p>
      )}
      {hero ? (
        <button type="button" className="mt-2 h-8 text-xs text-muted" onClick={() => { setCards({}); setPicking(null); }}>
          Сбросить карты
        </button>
      ) : null}
    </div>
  );

  function open(slot: Slot) {
    if (cards[slot]) {
      const next = { ...cards };
      delete next[slot];
      setCards(next);
      setPicking(null);
      return;
    }
    setPicking(slot);
    setRank(null);
  }
}

function shownKlass(a: Card, b: Card): string {
  const order = "23456789TJQKA";
  const hi = order[Math.max(a.rank, b.rank)]!;
  const lo = order[Math.min(a.rank, b.rank)]!;
  if (a.rank === b.rank) return hi + lo;
  return hi + lo + (a.suit === b.suit ? "s" : "o");
}

function CardSlot({
  card,
  active,
  small,
  onClick,
}: {
  card: Card | null;
  active: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  const red = card ? isRedSuit(card.suit) : false;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border bg-card-face font-mono font-semibold",
        small ? "h-11 w-8 text-xs" : "h-16 w-12 text-sm",
        active ? "border-fg" : "border-transparent",
        card ? (red ? "text-suit-red" : "text-card-ink") : "text-subtle",
      )}
    >
      {card ? (
        <>
          {RANK_CHARS[card.rank] === "T" ? "10" : RANK_CHARS[card.rank]}
          <span className="block">{SUIT_GLYPHS[card.suit]}</span>
        </>
      ) : (
        "+"
      )}
    </button>
  );
}
