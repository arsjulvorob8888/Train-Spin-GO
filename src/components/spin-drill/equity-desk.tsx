import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { consult, priceFromRaise } from "@/lib/spin-drill/equity-calc";
import {
  FACING_ACTIONS,
  OPEN_ACTIONS,
  actionTitle,
  emptyLine,
  facingPrice,
  heroFacing,
  openStreet,
  preflopAllin,
  seatStack,
  seatsInHand,
  streetStatus,
  actingOrder,
  type Line,
  type LineAction,
  type Seat,
  type StreetId,
} from "@/lib/spin-drill/postflop-line";
import type { MixRange } from "@/lib/spin-drill/mix";
import type { SpotDef } from "@/lib/spin-drill/spots";
import { cn } from "@/lib/utils";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";

const RANKS = [...RANK_CHARS].reverse();
const SLOTS = ["h0", "h1", "f0", "f1", "f2", "t", "r"] as const;
type Slot = (typeof SLOTS)[number];

type HandApi = {
  spot: SpotDef;
  bb: number;
  cards: Partial<Record<Slot, Card>>;
  queue: Slot[];
  potText: string;
  setPotText: (value: string) => void;
  callText: string;
  setCallText: (value: string) => void;
  hero: [Card, Card] | null;
  board: Card[];
  shown: {
    verdict: string;
    street: string;
    klass: string;
    made?: string | null;
    draw?: string | null;
    text: string;
    equity: number;
    action: string;
    label: string;
  } | null;
  typedOdds: number | null;
  pot: number | null;
  toCall: number | null;
  line: Line;
  open: (slot: Slot) => void;
  resetHand: () => void;
  chooseLine: (streetId: StreetId, seat: Seat, action: LineAction) => void;
  undoLine: (streetId: StreetId) => void;
  deviation: string | null;
  sizeText: string;
  setSizeText: (value: string) => void;
  used: (card: Card) => boolean;
  choose: (rank: number, suit: number) => void;
  holdGuard: () => void;
  guard: boolean;
  setQueue: (queue: Slot[]) => void;
  queueRef: MutableRefObject<Slot[]>;
};

const HandCtx = createContext<HandApi | null>(null);

export function useHand() {
  const ctx = useContext(HandCtx);
  if (!ctx) throw new Error("HandProvider");
  return ctx;
}

export function HandProvider({
  children,
  spot,
  range,
  bb,
  labels,
  onHand,
  openCards = 0,
}: {
  children: ReactNode;
  spot: SpotDef;
  range: MixRange;
  bb: number;
  labels: SpotDef["labels"];
  onHand: (hand: string) => void;
  openCards?: number;
}) {
  const [cards, setCards] = useState<Partial<Record<Slot, Card>>>({});
  const [queue, setQueue] = useState<Slot[]>([]);
  const queueRef = useRef<Slot[]>([]);
  const cardsRef = useRef<Partial<Record<Slot, Card>>>({});
  const [guard, setGuard] = useState(false);
  const [potText, setPotText] = useState("");
  const [callText, setCallText] = useState("");
  const [line, setLine] = useState<Line>(emptyLine);
  const [deviation, setDeviation] = useState<string | null>(null);
  const [sizeText, setSizeText] = useState("");
  const pot = parseBb(potText);
  const toCall = parseBb(callText);

  useEffect(() => {
    if (!openCards) return;
    const prev = cardsRef.current;
    const empty = (["h0", "h1"] as const).filter((slot) => !prev[slot]);
    if (empty.length === 0) {
      const next = { ...prev };
      delete next.h0;
      delete next.h1;
      cardsRef.current = next;
      setCards(next);
      queueRef.current = ["h0", "h1"];
      setQueue(["h0", "h1"]);
      return;
    }
    queueRef.current = [...empty];
    setQueue([...empty]);
  }, [openCards]);

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

  useEffect(() => {
    if (board.length >= 3) return;
    const raiseTo = parseBb(sizeText);
    if (raiseTo == null) {
      setPotText("");
      setCallText("");
      return;
    }
    const priced = priceFromRaise(spot.id, raiseTo);
    if (!priced) return;
    setPotText(trimNum(priced.pot));
    setCallText(trimNum(priced.toCall));
  }, [sizeText, spot.id, board.length]);

  const preflopPot = useRef(true);
  useEffect(() => {
    if (preflopPot.current && board.length >= 3) {
      setPotText("");
      setCallText("");
    }
    preflopPot.current = board.length < 3;
  }, [board.length]);

  const shown = useMemo(() => {
    if (!hero) return null;
    const raiseTo = parseBb(sizeText);
    const once = consult({
      hero,
      board,
      spotId: spot.id,
      bb,
      range,
      labels,
      pot,
      toCall,
      line,
      heroSeat: spot.hero,
      raiseTo,
    });
    return { ...once, label: labels[once.action] };
  }, [hero, board, spot.id, bb, range, labels, pot, toCall, line, sizeText]);
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

  function resetHand() {
    cardsRef.current = {};
    queueRef.current = [];
    setCards({});
    setQueue([]);
    setLine(emptyLine());
    setPotText("");
    setCallText("");
    setDeviation(null);
    setSizeText("");
  }

  function open(slot: Slot) {
    const prev = cardsRef.current;
    if (prev[slot]) {
      const next = { ...prev };
      delete next[slot];
      setCards(next);
      cardsRef.current = next;
      setQueue([]);
      queueRef.current = [];
      return;
    }
    const next = slot === "h0" || slot === "h1"
      ? (["h0", "h1"] as const).filter((item) => !prev[item])
      : slot === "f0" || slot === "f1" || slot === "f2"
        ? (["f0", "f1", "f2"] as const).filter((item) => !prev[item])
        : [slot];
    queueRef.current = [...next];
    setQueue([...next]);
  }

  function syncPrice(next: Line) {
    const order = seatsInHand(spot.id);
    const jammed = preflopAllin(spot.id);
    const face = heroFacing(next, spot.hero, board.length, order, jammed);
    if (!face) {
      setCallText("");
      return;
    }
    const priced = facingPrice(face, spot.hero, bb, pot);
    if (!potText.trim()) setPotText(trimNum(priced.pot));
    setCallText(trimNum(priced.toCall));
  }

  function chooseLine(streetId: StreetId, seat: Seat, action: LineAction) {
    const order = seatsInHand(spot.id);
    const jammed = preflopAllin(spot.id);
    const depth = Math.max(board.length, streetId === "flop" ? 3 : streetId === "turn" ? 4 : 5);
    const open = openStreet(line, depth, order, jammed);
    if (open && open.street !== streetId) return;
    const status = streetStatus(order, line, streetId, jammed);
    if (status.closed || status.seat !== seat) return;
    if (seat === spot.hero) {
      const advice = suggested(shown?.verdict ?? "", status.facing);
      setDeviation(
        advice && action !== advice
          ? `Солвер советует ${actionTitle(advice, pot, seatStack(seat, bb))}. Вы выбрали ${actionTitle(action, pot, seatStack(seat, bb))}. Так матожидание ниже линии чарта.`
          : null,
      );
    }
    const next = { ...line, [streetId]: [...line[streetId], { seat, action }] };
    setLine(next);
    syncPrice(next);
  }

  function undoLine(streetId: StreetId) {
    if (!line[streetId].length) return;
    const next = { ...line, [streetId]: line[streetId].slice(0, -1) };
    setLine(next);
    setDeviation(null);
    syncPrice(next);
  }

  const api: HandApi = {
    spot,
    bb,
    cards,
    queue,
    potText,
    setPotText,
    callText,
    setCallText,
    hero,
    board,
    shown,
    typedOdds,
    pot,
    toCall,
    line,
    open,
    resetHand,
    chooseLine,
    undoLine,
    deviation,
    sizeText,
    setSizeText,
    used,
    choose,
    holdGuard,
    guard,
    setQueue,
    queueRef,
  };

  return <HandCtx.Provider value={api}>{children}</HandCtx.Provider>;
}

export function QuickLine() {
  const { potText, setPotText, callText, setCallText, cards, open, queue, typedOdds } = useHand();
  return (
    <div className="flex shrink-0 flex-wrap items-end gap-2">
      <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
        Банк
        <input
          inputMode="decimal"
          value={potText}
          placeholder="6"
          aria-label="Банк, bb"
          onChange={(event) => setPotText(event.target.value)}
          className="mt-0.5 h-11 w-14 rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
        />
      </label>
      <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
        Ставка
        <input
          inputMode="decimal"
          value={callText}
          placeholder="4"
          aria-label="Ставка, bb"
          onChange={(event) => setCallText(event.target.value)}
          className="mt-0.5 h-11 w-14 rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
        />
      </label>
      <span className="mb-2 w-10 font-mono text-sm font-semibold">{typedOdds != null ? `${Math.round(typedOdds * 100)}%` : ""}</span>
      <SlotGroup title="Флоп" slots={["f0", "f1", "f2"]} cards={cards} queue={queue} open={open} />
      <SlotGroup title="Тёрн" slots={["t"]} cards={cards} queue={queue} open={open} />
      <SlotGroup title="Ривер" slots={["r"]} cards={cards} queue={queue} open={open} />
    </div>
  );
}

function SlotGroup({
  title,
  slots,
  cards,
  queue,
  open,
}: {
  title: string;
  slots: Slot[];
  cards: Partial<Record<Slot, Card>>;
  queue: Slot[];
  open: (slot: Slot) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">{title}</p>
      <div className="mt-0.5 flex gap-1">
        {slots.map((slot) => (
          <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
        ))}
      </div>
    </div>
  );
}

export function EquityDesk() {
  const {
    spot,
    bb,
    cards,
    queue,
    potText,
    setPotText,
    callText,
    setCallText,
    hero,
    board,
    shown,
    typedOdds,
    pot,
    toCall,
    line,
    open,
    resetHand,
    chooseLine,
    undoLine,
    deviation,
    used,
    choose,
    holdGuard,
    guard,
    setQueue,
    queueRef,
  } = useHand();

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ok pb-3">
        {shown ? (
          <div className="flex items-end gap-4">
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
        <button
          type="button"
          aria-label="Новая раздача"
          title="Новая раздача"
          onClick={resetHand}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border text-fg"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.2-5.8" strokeLinecap="round" />
            <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-sm leading-snug text-muted">{shown ? shown.text : "Сначала карты, потом линия префлопа, потом борд. Совет пересчитывается после каждого хода."}</p>
      <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
        <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
          Банк, bb
          <input
            inputMode="decimal"
            value={potText}
            placeholder="6"
            onChange={(event) => setPotText(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
          />
        </label>
        <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">
          Докинуть, bb
          <input
            inputMode="decimal"
            value={callText}
            placeholder="4"
            onChange={(event) => setCallText(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 font-mono text-base text-fg normal-case"
          />
        </label>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {typedOdds != null
          ? `Pot odds: нужно ${Math.round(typedOdds * 100)}%  ·  ${trimNum(toCall!)} / (${trimNum(pot!)} + ${trimNum(toCall!)})`
          : "Банк уже лежит со ставкой. Докинуть — ваша сумма."}
      </p>
      {deviation ? <p className="mt-3 rounded-lg border border-bad bg-bad/10 px-3 py-2 text-sm">{deviation}</p> : null}

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
        <button type="button" className="mt-2 h-8 text-xs text-muted" onClick={resetHand}>
          Начать раздачу заново
        </button>
      ) : null}
    </div>
  );
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
  hint,
  onAction,
  onUndo,
}: {
  spotId: string;
  hero: Seat;
  bb: number;
  line: Line;
  only: StreetId;
  hint: string;
  onAction: (seat: Seat, action: LineAction) => void;
  onUndo: () => void;
}) {
  const seats = seatsInHand(spotId);
  const jammed = preflopAllin(spotId);
  const acts = line[only];
  const status = streetStatus(seats, line, only, jammed);
  const earlier = openStreet(line, only === "flop" ? 3 : only === "turn" ? 4 : 5, seats, jammed);
  const blocked = earlier != null && earlier.street !== only;
  const queue = actingOrder(seats, line, only, jammed);
  const actions = status.facing ? FACING_ACTIONS : OPEN_ACTIONS;
  const suggest = status.seat === hero && !blocked ? suggested(hint, status.facing) : null;
  const { pot } = useHand();
  const title = (action: LineAction, seat: Seat) => actionTitle(action, pot, seatStack(seat, bb));
  return (
    <div className="mt-2">
      <p className="text-[11px] text-muted">
        Очередь: {queue.length ? queue.join(" → ") : "ставок больше нет"}
        {status.seat ? ` · сейчас ${status.seat}` : ""}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {acts.map((act, index) => (
          <span
            key={`${act.seat}-${index}`}
            className={cn(
              "rounded-full border px-2 py-1 text-xs",
              act.seat === hero ? "border-ok text-fg" : "border-border text-muted",
            )}
          >
            {act.seat} {title(act.action, act.seat)}
          </span>
        ))}
        {acts.length > 0 ? (
          <button type="button" onClick={onUndo} className="rounded-full border border-border px-2 py-1 text-xs text-muted">
            назад
          </button>
        ) : null}
      </div>
      {blocked ? (
        <p className="mt-2 text-xs text-muted">Сначала закрой предыдущую улицу.</p>
      ) : status.closed ? (
        <p className="mt-2 text-xs text-muted">Улица закрыта.</p>
      ) : (
        <div className={cn("mt-2 rounded-lg border p-2", status.seat === hero ? "border-ok" : "border-border")}>
          <p className="text-xs">
            <span className="font-medium">{status.seat}</span>
            <span className="ml-2 font-mono text-muted">{status.seat ? seatStack(status.seat, bb) : ""}</span>
            <span className="ml-2 text-muted">{status.seat === hero ? "ваш ход" : "ход оппонента"}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {actions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => status.seat && onAction(status.seat, item.id)}
                className={cn(
                  "h-9 rounded-md border px-2 text-xs",
                  suggest === item.id ? "border-ok font-semibold text-fg" : "border-border text-muted",
                )}
              >
                {title(item.id, status.seat ?? hero)}
                {suggest === item.id ? " · совет" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BoardLine({ openBoard }: { openBoard: boolean }) {
  const { spot, bb, cards, queue, hero, board, shown, line, open, chooseLine, undoLine } = useHand();
  return (
    <div className="mt-2 flex items-start gap-2 overflow-x-auto pb-1">
      <div className="w-[7.2rem] shrink-0 rounded-lg border border-border p-1">
        <p className="px-1 text-[11px] font-medium">Вы</p>
        <div className="mt-1 flex gap-1">
          {(["h0", "h1"] as const).map((slot) => (
            <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
          ))}
        </div>
      </div>
      {openBoard ? (
        <>
          <StreetBlock title="Флоп" locked={!hero}>
            <div className="flex gap-1">
              {(["f0", "f1", "f2"] as const).map((slot) => (
                <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
              ))}
            </div>
            {board.length >= 3 ? (
              <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="flop" hint={shown?.verdict ?? ""} onAction={(seat, action) => chooseLine("flop", seat, action)} onUndo={() => undoLine("flop")} />
            ) : (
              <p className="mt-1 text-[11px] text-muted">Три карты, потом ходы.</p>
            )}
          </StreetBlock>
          <StreetBlock title="Тёрн" locked={board.length < 3}>
            <CardSlot card={cards.t ?? null} active={queue[0] === "t"} small onClick={() => open("t")} />
            {board.length >= 4 ? (
              <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="turn" hint={shown?.verdict ?? ""} onAction={(seat, action) => chooseLine("turn", seat, action)} onUndo={() => undoLine("turn")} />
            ) : null}
          </StreetBlock>
          <StreetBlock title="Ривер" locked={board.length < 4}>
            <CardSlot card={cards.r ?? null} active={queue[0] === "r"} small onClick={() => open("r")} />
            {board.length >= 5 ? (
              <WizardLine spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="river" hint={shown?.verdict ?? ""} onAction={(seat, action) => chooseLine("river", seat, action)} onUndo={() => undoLine("river")} />
            ) : null}
          </StreetBlock>
        </>
      ) : (
        <p className="self-center text-xs text-muted">Флоп откроется здесь, когда вы не сбросите карты.</p>
      )}
    </div>
  );
}

function StreetBlock({ title, locked, children }: { title: string; locked?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-[9rem] shrink-0 rounded-lg border border-ok p-1", locked ? "pointer-events-none opacity-40" : "")}>
      <p className="px-1 text-[11px] font-medium">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function suggested(verdict: string, facing: boolean): LineAction | null {
  if (verdict === "Фолд") return "fold";
  if (verdict === "Колл") return "call";
  if (verdict === "Рейз") return "raise";
  if (verdict === "Чек") return "check";
  if (verdict === "Ставка" || verdict === "Пуш") return facing ? "allin" : "bet66";
  return null;
}
