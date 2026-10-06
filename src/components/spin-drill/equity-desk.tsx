import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { evaluateBest, unpack } from "@/lib/poker/evaluate";
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
  result: "" | "win" | "fold";
  setResult: (value: "" | "win" | "fold") => void;
  handNonce: number;
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
  onReset,
  openCards = 0,
}: {
  children: ReactNode;
  spot: SpotDef;
  range: MixRange;
  bb: number;
  labels: SpotDef["labels"];
  onHand: (hand: string) => void;
  onReset?: () => void;
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
  const [result, setResult] = useState<"" | "win" | "fold">("");
  const [handNonce, setHandNonce] = useState(0);
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
    setResult("");
    setHandNonce((n) => n + 1);
    onReset?.();
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
    result,
    setResult,
    handNonce,
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
    result,
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
        {result === "win" || result === "fold" ? (
          <div>
            <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Итог раздачи</p>
            <p className={cn("text-3xl font-semibold leading-none", result === "win" ? "text-ok" : "")}>
              {result === "win" ? "Вы выиграли" : "Вы сбросили"}
            </p>
            <p className="mt-1 text-xs text-muted">Префлоп закрыт. Карт дальше нет.</p>
          </div>
        ) : shown ? (
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">
                {isSummary(shown.verdict, shown.street) ? "Итог раздачи" : "Солвер ждёт"}
              </p>
              <p className={cn("text-3xl font-semibold leading-none", isSummary(shown.verdict, shown.street) ? (shown.verdict === "Нет пары" ? "text-zinc-200" : "text-ok") : "")}>
                {shown.verdict}
              </p>
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
      <p className="mt-2 text-sm leading-snug text-muted">
        {result === "win"
          ? "Все оппоненты сбросили. Вы забираете банк без флопа."
          : result === "fold"
            ? "Вы сбросили. Раздача закрыта, выбирать карты больше не нужно."
            : shown
              ? shown.text
              : "Сначала карты, потом линия префлопа, потом борд. Совет пересчитывается после каждого хода."}
      </p>
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

function seatHead(seat: string): string {
  if (seat === "SB") return "bg-amber-800/80 text-amber-50";
  if (seat === "BB") return "bg-orange-900/80 text-orange-50";
  return "bg-zinc-700 text-zinc-50";
}

export function Hole() {
  const { cards, queue, open } = useHand();
  return (
    <div className="w-[5.6rem] shrink-0 rounded-lg border border-border p-1">
      <p className="px-1 text-[11px] font-medium">Вы</p>
      <div className="mt-1 flex gap-1">
        {(["h0", "h1"] as const).map((slot) => (
          <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
        ))}
      </div>
    </div>
  );
}

function StreetColumns({
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
  const { pot, callText, setCallText } = useHand();
  const title = (action: LineAction, seat: Seat) => actionTitle(action, pot, seatStack(seat, bb));
  const cols: { seat: Seat; selected: LineAction | null; live: boolean }[] = acts.map((act) => ({
    seat: act.seat,
    selected: act.action,
    live: false,
  }));
  if (!status.closed && status.seat) cols.push({ seat: status.seat, selected: null, live: true });
  const suggest = status.seat === hero ? suggested(hint, status.facing) : null;
  const liveMenu = status.facing ? FACING_ACTIONS : OPEN_ACTIONS;
  const opponentLive = !status.closed && status.seat != null && status.seat !== hero;
  return (
    <>
      {cols.map((col, index) => {
        const menu =
          col.live ? liveMenu : col.selected === "fold" || col.selected === "call" || col.selected === "raise" ? FACING_ACTIONS : OPEN_ACTIONS;
        return (
          <div
            key={`${col.seat}-${index}`}
            className={cn("w-[6.4rem] shrink-0 rounded-lg border p-1", col.seat === hero ? "border-ok" : "border-border")}
          >
            <div className={cn("flex items-center justify-between rounded px-1 py-0.5 text-[11px]", seatHead(col.seat))}>
              <span className="font-medium">{col.seat === hero ? `${col.seat} · ваш ход` : col.seat}</span>
              <span className="font-mono">{seatStack(col.seat, bb)}</span>
            </div>
            <div className="mt-1 flex flex-col">
              {menu.map((item) => {
                const on = col.selected === item.id;
                const wanted = col.live && col.seat === hero && suggest === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!col.live}
                    onClick={() => col.live && onAction(col.seat, item.id)}
                    className={cn(
                      "rounded px-1 py-1 text-left text-xs",
                      on ? "bg-fg font-medium text-bg" : wanted ? "bg-ok/20 font-semibold text-fg ring-1 ring-ok" : "text-muted",
                      !col.live && !on ? "opacity-40" : "",
                    )}
                  >
                    {title(item.id, col.seat)}
                    {wanted && !on ? " · солвер" : ""}
                  </button>
                );
              })}
            </div>
            {index === cols.length - 1 && acts.length > 0 ? (
              <button type="button" onClick={onUndo} className="mt-1 w-full rounded px-1 py-0.5 text-left text-[11px] text-muted">
                назад
              </button>
            ) : null}
          </div>
        );
      })}
      {opponentLive ? (
        <label className="w-[6.4rem] shrink-0 rounded-lg border border-border p-1 text-[11px]">
          <span className="block px-1 font-medium">Его рейз, bb</span>
          <input
            inputMode="decimal"
            value={callText}
            placeholder="2"
            aria-label="Размер ставки оппонента, если он не как на кнопке"
            onChange={(event) => setCallText(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg"
          />
          <span className="mt-1 block px-1 leading-tight text-muted">Если поставил не 2 и не 4.</span>
        </label>
      ) : null}
    </>
  );
}

function CycleMark({ label }: { label: string }) {
  return (
    <div className="grid w-14 shrink-0 place-items-center self-center text-center text-ok" title={label}>
      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 12.5 10.5 15.5 16.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

export function BoardLine({ openBoard }: { openBoard: boolean }) {
  const { spot, bb, cards, queue, hero, board, shown, line, open, chooseLine, undoLine } = useHand();
  if (!openBoard) return null;
  const seats = seatsInHand(spot.id);
  const jammed = preflopAllin(spot.id);
  const hole = hero ? [hero[0], hero[1]] : [];
  const flopClosed = board.length >= 3 && streetStatus(seats, line, "flop", jammed).closed;
  const turnClosed = board.length >= 4 && streetStatus(seats, line, "turn", jammed).closed;
  const finished = handFinished(spot.id, line, board.length);
  const hint = shown?.verdict ?? "";
  return (
    <>
      <div className={cn("shrink-0 rounded-lg border border-border p-1", !hero ? "pointer-events-none opacity-40" : "")}>
        <p className="px-1 text-[11px] font-medium">Флоп</p>
        <div className="mt-1 flex gap-1">
          {(["f0", "f1", "f2"] as const).map((slot) => (
            <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
          ))}
        </div>
        <Holding cards={board.length >= 3 ? [...hole, ...board.slice(0, 3)] : []} />
      </div>
      {board.length >= 3 ? (
        <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="flop" hint={hint} onAction={(seat, action) => chooseLine("flop", seat, action)} onUndo={() => undoLine("flop")} />
      ) : null}
      {flopClosed ? <CycleMark label="флоп" /> : null}
      {flopClosed ? (
        <div className="shrink-0 rounded-lg border border-border p-1">
          <p className="px-1 text-[11px] font-medium">Тёрн</p>
          <div className="mt-1">
            <CardSlot card={cards.t ?? null} active={queue[0] === "t"} small onClick={() => open("t")} />
          </div>
          <Holding cards={board.length >= 4 ? [...hole, ...board.slice(0, 4)] : []} />
        </div>
      ) : null}
      {board.length >= 4 ? (
        <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="turn" hint={hint} onAction={(seat, action) => chooseLine("turn", seat, action)} onUndo={() => undoLine("turn")} />
      ) : null}
      {turnClosed ? <CycleMark label="тёрн" /> : null}
      {turnClosed ? (
        <div className="shrink-0 rounded-lg border border-border p-1">
          <p className="px-1 text-[11px] font-medium">Ривер</p>
          <div className="mt-1">
            <CardSlot card={cards.r ?? null} active={queue[0] === "r"} small onClick={() => open("r")} />
          </div>
          <Holding cards={board.length >= 5 ? [...hole, ...board.slice(0, 5)] : []} />
        </div>
      ) : null}
      {board.length >= 5 ? (
        <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="river" hint={hint} onAction={(seat, action) => chooseLine("river", seat, action)} onUndo={() => undoLine("river")} />
      ) : null}
      {finished ? <DoneMark label={showdown([...hole, ...board])?.label ?? "Итог"} /> : null}
    </>
  );
}

function Holding({ cards }: { cards: Card[] }) {
  const made = showdown(cards);
  if (!made) return null;
  return (
    <p className={cn("mt-1 rounded px-1.5 py-1 text-xs font-semibold leading-tight", made.bare ? "bg-zinc-700 text-zinc-50" : "bg-ok text-bg")}>
      {made.label}
    </p>
  );
}

function DoneMark({ label }: { label: string }) {
  return (
    <div className="grid w-24 shrink-0 place-items-center self-center text-center text-ok" title="Раздача закрыта">
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 12.5 10.5 15.5 16.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[11px] font-semibold leading-tight">Раздача закрыта</span>
      <span className="mt-0.5 text-[11px] font-medium leading-tight text-fg">{label}</span>
    </div>
  );
}

function showdown(cards: Card[]): { label: string; bare: boolean } | null {
  if (cards.length < 5 || cards.some((card) => !card)) return null;
  const hand = evaluateBest(cards);
  const { category, values } = unpack(hand.score);
  const rank = RANK_CHARS[values[0] ?? 0] ?? "";
  const second = RANK_CHARS[values[1] ?? 0] ?? "";
  if (category <= 0) return { label: `Нет пары · старшая ${rank}`, bare: true };
  if (category === 1) return { label: `Пара ${rank}`, bare: false };
  if (category === 2) return { label: `Две пары ${rank} и ${second}`, bare: false };
  if (category === 3) return { label: `Сет ${rank}`, bare: false };
  const names = ["", "", "", "", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш"];
  return { label: names[category] ?? "Комбинация", bare: false };
}

function handFinished(spotId: string, line: Line, boardLength: number): boolean {
  if (boardLength < 3) return false;
  const seats = seatsInHand(spotId);
  const jammed = preflopAllin(spotId);
  const streets: StreetId[] = ["flop"];
  if (boardLength >= 4) streets.push("turn");
  if (boardLength >= 5) streets.push("river");
  const last = streets[streets.length - 1]!;
  if (!streetStatus(seats, line, last, jammed).closed) return false;
  const folded = (["flop", "turn", "river"] as const).some((street) => line[street].some((act) => act.action === "fold"));
  return last === "river" || folded;
}

function isSummary(verdict: string, street: string): boolean {
  return street === "Ривер" && ["Нет пары", "Пара", "Две пары", "Сет", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш"].includes(verdict);
}

function suggested(verdict: string, facing: boolean): LineAction | null {
  if (verdict === "Фолд") return "fold";
  if (verdict === "Колл") return "call";
  if (verdict === "Рейз") return "raise";
  if (verdict === "Чек") return "check";
  if (verdict === "Ставка" || verdict === "Пуш") return facing ? "allin" : "bet66";
  return null;
}
