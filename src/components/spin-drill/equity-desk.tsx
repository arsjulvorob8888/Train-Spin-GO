import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { consult } from "@/lib/spin-drill/equity-calc";
import {
  FACING_ACTIONS,
  OPEN_ACTIONS,
  callSize,
  emptyLine,
  seatStack,
  seatsInHand,
  type Line,
  type LineAction,
  type Seat,
  type StreetId,
} from "@/lib/spin-drill/postflop-line";
import type { MixRange } from "@/lib/spin-drill/mix";
import type { SpotDef } from "@/lib/spin-drill/spots";
import { cn } from "@/lib/utils";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  const [queue, setQueue] = useState<Slot[]>([]);
  const queueRef = useRef<Slot[]>([]);
  const cardsRef = useRef<Partial<Record<Slot, Card>>>({});
  const [guard, setGuard] = useState(false);
  const [potText, setPotText] = useState("");
  const [callText, setCallText] = useState("");
  const [line, setLine] = useState<Line>(emptyLine);
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
    const once = consult({ hero, board, spotId: spot.id, bb, range, labels, pot, toCall, line, heroSeat: spot.hero });
    return { ...once, label: labels[once.action] };
  }, [hero, board, spot.id, bb, range, labels, pot, toCall, line]);
  const typedOdds = pot != null && toCall != null && toCall > 0 ? toCall / (pot + toCall) : null;

  function used(card: Card): boolean {
    return SLOTS.some((slot) => cards[slot] && cards[slot]!.rank === card.rank && cards[slot]!.suit === card.suit);
  }

  function choose(rank: number, suit: number) {
    const slot = queueRef.current[0];
    if (!slot) return;
    const prev = cardsRef.current;
    if (SLOTS.some((item) => prev[item] && prev[item]!.rank === rank && prev[item]!.suit === suit)) return;
    const next = { ...prev, [slot]: { rank, suit } };
    cardsRef.current = next;
    setCards(next);
    const rest = queueRef.current.slice(1);
    queueRef.current = rest;
    setQueue(rest);
    if (rest.length === 0) holdGuard();
    if (next.h0 && next.h1) onHand(shownKlass(next.h0, next.h1));
  }

  function holdGuard() {
    setGuard(true);
    window.setTimeout(() => setGuard(false), 250);
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface-2 p-3">
      <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 border-b border-ok bg-surface-2 px-3 py-3">
        {shown ? (
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Действие</p>
              <p className="text-3xl font-semibold leading-none">{shown.verdict}</p>
              <p className="mt-1 text-xs text-muted">
                {shown.street} · {shown.klass}
                {shown.made ? ` · ${shown.made}` : ""}
                {shown.draw ? ` · ${shown.draw}` : ""}
              </p>
            </div>
            <p className="font-mono text-4xl font-semibold leading-none">{Math.round(shown.equity * 100)}%</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Действие появится здесь сразу после двух карт.</p>
        )}
        {shown ? <p className="mt-2 text-sm leading-snug text-muted">{shown.text}</p> : null}
      </div>
      <p className="text-sm font-medium">Раздача по шагам</p>
      <p className="mt-0.5 text-xs text-muted">Сверху вниз: стол, карты, оппоненты, банк. Рекомендация в конце.</p>

      <Step n={1} title="Стол" done>
        <p className="text-sm">
          Вы: {spot.hero} · {bb}bb · {spot.vs}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {spot.steps.map((step) => (
            <li key={step.label}>
              {step.label}: {step.did}
            </li>
          ))}
        </ul>
      </Step>

      <Step n={2} title="Ваши карты" done={Boolean(hero)}>
        <div className="flex gap-2">
          {(["h0", "h1"] as const).map((slot) => (
            <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} onClick={() => open(slot)} />
          ))}
        </div>
      </Step>

      <Step n={3} title="Флоп" done={board.length >= 3} locked={!hero}>
        <div className="flex gap-1">
          {(["f0", "f1", "f2"] as const).map((slot) => (
            <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
          ))}
        </div>
        {board.length >= 3 ? (
          <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="flop" onAction={(seat, action) => chooseLine("flop", seat, action)} />
        ) : (
          <p className="mt-1 text-xs text-muted">Три карты, затем действие каждого оппонента по очереди.</p>
        )}
      </Step>

      <Step n={4} title="Тёрн" done={board.length >= 4} locked={board.length < 3}>
        <CardSlot card={cards.t ?? null} active={queue[0] === "t"} small onClick={() => open("t")} />
        {board.length >= 4 ? (
          <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="turn" onAction={(seat, action) => chooseLine("turn", seat, action)} />
        ) : null}
      </Step>

      <Step n={5} title="Ривер" done={board.length >= 5} locked={board.length < 4}>
        <CardSlot card={cards.r ?? null} active={queue[0] === "r"} small onClick={() => open("r")} />
        {board.length >= 5 ? (
          <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="river" onAction={(seat, action) => chooseLine("river", seat, action)} />
        ) : null}
      </Step>

      <Step n={6} title="Банк" done={pot != null} locked={!hero}>
        <div className="grid grid-cols-2 gap-2">
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
            ? `Нужно ${Math.round(typedOdds * 100)}%  ·  ${trimNum(toCall!)} / (${trimNum(pot!)} + ${trimNum(toCall!)})`
            : "Банк — уже лежит, со ставкой оппонента. Докинуть — ваша сумма."}
        </p>
      </Step>

      {typeof document !== "undefined" && (queue.length > 0 || guard)
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center",
                queue.length > 0 ? "bg-black/60" : "",
              )}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (queue.length > 0) {
                  queueRef.current = [];
                  setQueue([]);
                  holdGuard();
                }
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {queue.length > 0 ? (
                <div
                  className="w-full max-w-sm rounded-2xl border border-border bg-surface p-3"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <p className="text-sm font-medium">{pickerTitle(queue[0]!)}</p>
                  <div className="mt-2 max-h-[70vh] space-y-1 overflow-auto">
                    {RANKS.map((glyph) => {
                      const value = RANK_CHARS.indexOf(glyph);
                      return (
                        <div key={glyph} className="grid grid-cols-4 gap-1">
                          {SUIT_GLYPHS.map((suitGlyph, suit) => {
                            const taken = used({ rank: value, suit });
                            return (
                              <button
                                key={suitGlyph}
                                type="button"
                                disabled={taken}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!taken) choose(value, suit);
                                }}
                                className={cn(
                                  "h-9 rounded-md bg-card-face font-mono text-sm font-semibold disabled:opacity-100",
                                  taken ? "ring-2 ring-yellow-400" : "",
                                  isRedSuit(suit) ? "text-suit-red" : "text-card-ink",
                                )}
                              >
                                {glyph === "T" ? "10" : glyph}
                                {suitGlyph}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
      {hero ? (
        <button type="button" className="mt-2 h-8 text-xs text-muted" onClick={() => { cardsRef.current = {}; queueRef.current = []; setCards({}); setQueue([]); setLine(emptyLine()); setPotText(""); setCallText(""); }}>
          Начать раздачу заново
        </button>
      ) : null}
    </div>
  );

  function chooseLine(streetId: StreetId, seat: Seat, action: LineAction) {
    const turningOff = line[streetId][seat] === action;
    const next = {
      ...line,
      [streetId]: { ...line[streetId] },
    };
    if (turningOff) delete next[streetId][seat];
    else next[streetId][seat] = action;
    setLine(next);
    if (turningOff) return;
    const order = seatsInHand(spot.id).filter((item) => item !== spot.hero);
    let size: number | null = null;
    for (const item of order) {
      const picked = next[streetId][item];
      if (!picked) continue;
      const priced = callSize(picked, pot, bb);
      if (priced != null && picked !== "check" && picked !== "fold") size = priced;
      if (priced === 0 && (picked === "check" || picked === "fold")) size = size ?? 0;
    }
    if (size === 0) setCallText("");
    else if (size != null) setCallText(trimNum(size));
  }

  function open(slot: Slot) {
    if (cards[slot]) {
      const next = { ...cards };
      delete next[slot];
      setCards(next);
      cardsRef.current = next;
      setQueue([]);
      queueRef.current = [];
      return;
    }
    const next = slot === "h0" || slot === "h1"
      ? (["h0", "h1"] as const).filter((item) => !cards[item])
      : slot === "f0" || slot === "f1" || slot === "f2"
        ? (["f0", "f1", "f2"] as const).filter((item) => !cards[item])
        : [slot];
    queueRef.current = [...next];
    setQueue([...next]);
  }
}

function pickerTitle(slot: Slot): string {
  if (slot === "h0") return "Ваши карты · первая";
  if (slot === "h1") return "Ваши карты · вторая";
  if (slot === "f0") return "Флоп · первая";
  if (slot === "f1") return "Флоп · вторая";
  if (slot === "f2") return "Флоп · третья";
  if (slot === "t") return "Тёрн";
  return "Ривер";
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

function Step({
  n,
  title,
  done,
  locked,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("mt-3 border-t border-border pt-3", locked ? "pointer-events-none opacity-40" : "")}>
      <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">
        {n}. {title}
        {done ? " · готово" : ""}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
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

function WizardLine({
  spotId,
  hero,
  bb,
  line,
  only,
  onAction,
}: {
  spotId: string;
  hero: Seat;
  bb: number;
  line: Line;
  only: StreetId;
  onAction: (seat: Seat, action: LineAction) => void;
}) {
  const seats = seatsInHand(spotId);
  return (
    <div className="mt-2 flex gap-1 overflow-x-auto">
      {seats.map((seat, index) => {
        const facing = seats.slice(0, index).some((prev) => {
          const action = line[only][prev];
          return action === "bet33" || action === "bet66" || action === "raise" || action === "allin";
        });
        const earlier = seats.slice(0, index).filter((prev) => prev !== hero);
        const waiting = ! (seat === hero) && earlier.some((prev) => !line[only][prev]);
        const actions = facing ? FACING_ACTIONS : OPEN_ACTIONS;
        const chosen = line[only][seat];
        const mine = seat === hero;
        return (
          <div
            key={seat}
            className={cn(
              "w-[5.5rem] shrink-0 rounded-lg border p-1",
              mine ? "border-ok" : waiting ? "border-border opacity-40" : "border-border",
            )}
          >
            <div className="flex items-center justify-between px-1 text-[11px]">
              <span className="font-medium">{seat}</span>
              <span className="font-mono text-muted">{seatStack(seat, bb)}</span>
            </div>
            <div className={cn("mt-1 flex flex-col", waiting ? "pointer-events-none" : "")}>
              {mine ? (
                <p className="px-1 py-1 text-xs text-muted">ваш ход</p>
              ) : (
                actions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onAction(seat, item.id)}
                    className={cn(
                      "rounded px-1 py-1 text-left text-xs",
                      chosen === item.id ? "bg-fg text-bg" : "text-muted",
                    )}
                  >
                    {item.label}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
