import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { consult } from "@/lib/spin-drill/equity-calc";
import { LINE_ACTIONS, callSize, type Line, type LineAction, type StreetId } from "@/lib/spin-drill/postflop-line";
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
  const [potText, setPotText] = useState("");
  const [callText, setCallText] = useState("");
  const [line, setLine] = useState<Line>({});
  const pot = parseBb(potText);
  const toCall = parseBb(callText);

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
    const once = consult({ hero, board, spotId: spot.id, bb, range, labels, pot, toCall, line });
    return { ...once, label: labels[once.action] };
  }, [hero, board, spot.id, bb, range, labels, pot, toCall, line]);
  const street = board.length >= 5 ? "Ривер" : board.length === 4 ? "Тёрн" : board.length >= 3 ? "Флоп" : "Префлоп";
  const typedOdds = pot != null && toCall != null && toCall > 0 ? toCall / (pot + toCall) : null;

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
      {street !== "Префлоп" ? (
        <>
          <p className="mt-2 text-sm text-fg">
            {street}. Префлоп задан слева. Ниже — что сделал оппонент на каждой улице, как в солвере.
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            <div className="w-24 shrink-0">
              <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Префлоп</p>
              <p className="mt-1 rounded-md bg-fg px-2 py-2 text-xs leading-tight text-bg">{spot.vs}</p>
            </div>
            {(
              [
                ["flop", "Флоп", board.length >= 3],
                ["turn", "Тёрн", board.length >= 4],
                ["river", "Ривер", board.length >= 5],
              ] as const
            ).map(([id, title, ready]) => (
              <div key={id} className={cn("w-24 shrink-0", ready ? "" : "opacity-40")}>
                <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">{title}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {ready ? (
                    LINE_ACTIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseLine(id, item.id)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-left text-xs",
                          line[id] === item.id ? "border-fg bg-fg text-bg" : "border-border bg-surface text-muted",
                        )}
                      >
                        {item.label}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted">нет карты</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
          Банк, bb
          <input
            inputMode="decimal"
            value={potText}
            placeholder="6"
            onChange={(event) => setPotText(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
          />
        </label>
        <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
          Докинуть, bb
          <input
            inputMode="decimal"
            value={callText}
            placeholder="4"
            onChange={(event) => setCallText(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
          />
        </label>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {typedOdds != null
          ? `Pot odds: нужно ${Math.round(typedOdds * 100)}%  ·  ${trimNum(toCall!)} / (${trimNum(pot!)} + ${trimNum(toCall!)})`
          : "Банк — уже лежит, вместе со ставкой оппонента. Докинуть — твоя сумма."}
      </p>
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
              <p className="font-mono text-xs text-muted">
                {shown.street} · {shown.klass}
              </p>
              <p className="text-2xl font-semibold leading-none">{shown.verdict}</p>
              {shown.street !== "Префлоп" ? (
                <p className="mt-1 text-lg leading-none">{shown.made ?? "борд"}{shown.draw ? ` · ${shown.draw}` : ""}</p>
              ) : null}
            </div>
            <p className="font-mono text-3xl font-semibold leading-none">{Math.round(shown.equity * 100)}%</p>
          </div>
          <p className="text-sm leading-snug text-muted">{shown.text}</p>
          <p className="font-mono text-xs text-subtle">
            выигрыш {Math.round(shown.win * 100)}% · ничья {Math.round(shown.tie * 100)}%
            {shown.need != null ? ` · нужно ${Math.round(shown.need * 100)}%` : ""}
          </p>
          {shown.likely.length ? (
            <div>
              <p className="text-xs text-muted">
                {line.flop || line.turn || line.river ? "Руки на этой линии" : "Верх диапазона оппонента"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {shown.likely.map((item) => (
                  <span key={item.hand} className="rounded-full bg-surface px-2 py-0.5 font-mono text-xs">
                    {item.hand}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">
              {line.flop || line.turn || line.river
                ? "На этой линии из префлоп-диапазона рук почти не остаётся."
                : "На этой глубине рейндж пустой, считаю против случайной руки."}
            </p>
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

  function chooseLine(streetId: StreetId, action: LineAction) {
    const turningOff = line[streetId] === action;
    setLine((prev) => {
      const next = { ...prev };
      if (turningOff) delete next[streetId];
      else next[streetId] = action;
      return next;
    });
    if (turningOff) return;
    const size = callSize(action, pot, bb);
    if (size === 0) setCallText("");
    else if (size != null) setCallText(trimNum(size));
  }

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

function parseBb(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function trimNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
