import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { evaluateBest, unpack } from "@/lib/poker/evaluate";
import { consult, priceFromRaise } from "@/lib/spin-drill/equity-calc";
import { journalSummary, readJournal } from "@/lib/spin-drill/journal";
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
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
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
    win: number;
    tie: number;
    who: string;
    likely: { hand: string; pct: number }[];
    need: number | null;
    action: string;
    label: string;
    bluff: {
      on: boolean;
      title: string;
      action: string;
      reasons: string[];
      equity: number;
      foldNeed: number | null;
      bet: number | null;
      pot: number | null;
    } | null;
  } | null;
  typedOdds: number | null;
  pot: number | null;
  toCall: number | null;
  line: Line;
  open: (slot: Slot) => void;
  resetHand: () => void;
  chooseLine: (streetId: StreetId, seat: Seat, action: LineAction) => void;
  reviseLine: (streetId: StreetId, index: number, action: LineAction) => void;
  undoLine: (streetId: StreetId) => void;
  deviation: string | null;
  sizeText: string;
  setSizeText: (value: string) => void;
  result: "" | "win" | "fold";
  setResult: (value: "" | "win" | "fold") => void;
  handNonce: number;
  out: Seat[];
  setOut: (seats: Seat[]) => void;
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
  const [out, setOutState] = useState<Seat[]>([]);
  const outKey = out.join(",");
  function setOut(seats: Seat[]) {
    const next = seats.join(",");
    if (next === outKey) return;
    const gone = new Set(seats);
    setOutState(seats);
    setLine((prev) => {
      const strip = (acts: { seat: Seat; action: LineAction }[]) => acts.filter((act) => !gone.has(act.seat));
      const flop = strip(prev.flop);
      const turn = strip(prev.turn);
      const river = strip(prev.river);
      if (flop.length === prev.flop.length && turn.length === prev.turn.length && river.length === prev.river.length) return prev;
      return { flop, turn, river };
    });
  }
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
      out,
    });
    return { ...once, label: labels[once.action] };
  }, [hero, board, spot.id, bb, range, labels, pot, toCall, line, sizeText, outKey]);
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
    setOutState([]);
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
    const order = seatsInHand(spot.id, out);
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
    const order = seatsInHand(spot.id, out);
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

  function reviseLine(streetId: StreetId, index: number, action: LineAction) {
    const acts = line[streetId];
    if (index < 0 || index >= acts.length || acts[index]?.action === action) return;
    const seat = acts[index]!.seat;
    const kept = acts.slice(0, index);
    const prior: Line = {
      flop: streetId === "flop" ? kept : line.flop,
      turn: streetId === "flop" ? [] : streetId === "turn" ? kept : line.turn,
      river: streetId === "river" ? kept : [],
    };
    const order = seatsInHand(spot.id, out);
    const jammed = preflopAllin(spot.id);
    const status = streetStatus(order, prior, streetId, jammed);
    if (seat === spot.hero) {
      const advice = suggested(shown?.verdict ?? "", status.facing);
      setDeviation(
        advice && action !== advice
          ? `Солвер советует ${actionTitle(advice, pot, seatStack(seat, bb))}. Вы выбрали ${actionTitle(action, pot, seatStack(seat, bb))}. Так матожидание ниже линии чарта.`
          : null,
      );
    } else setDeviation(null);
    const next: Line = { ...prior, [streetId]: [...kept, { seat, action }] };
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
    reviseLine,
    undoLine,
    deviation,
    sizeText,
    setSizeText,
    result,
    setResult,
    handNonce,
    out,
    setOut,
    used,
    choose,
    holdGuard,
    guard,
    setQueue,
    queueRef,
  };

  return <HandCtx.Provider value={api}>{children}</HandCtx.Provider>;
}

export function PotFields() {
  const { potText, setPotText, callText, setCallText, shown } = useHand();
  const live = shown != null && shown.need != null && shown.need > 0;
  const box = cn(
    "mt-0.5 h-11 w-[4.5rem] rounded-md border bg-surface px-2 font-mono text-base text-fg normal-case",
    live ? "border-ok ring-2 ring-ok/70" : "border-border",
  );
  return (
    <div className={cn("ml-auto flex items-end gap-1.5 rounded-xl px-1", live ? "bg-ok/10" : "")} title={live ? "Эти числа меняют решение солвера" : "Банк и сумма колла"}>
      <label className={cn("block text-[10px] font-medium tracking-wide uppercase", live ? "text-ok" : "text-subtle")}>
        Банк
        <input inputMode="decimal" value={potText} placeholder="6" aria-label="Банк, bb" onChange={(event) => setPotText(event.target.value)} className={box} />
      </label>
      <label className={cn("block text-[10px] font-medium tracking-wide uppercase", live ? "text-ok" : "text-subtle")}>
        Докинуть
        <input inputMode="decimal" value={callText} placeholder="4" aria-label="Докинуть, bb" onChange={(event) => setCallText(event.target.value)} className={box} />
      </label>
    </div>
  );
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
  const cardOpened = useRef(0);
  const pickerWasOpen = useRef(false);
  if (queue.length > 0 && !pickerWasOpen.current) cardOpened.current = Date.now();
  pickerWasOpen.current = queue.length > 0;

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
          <div className="flex w-full flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">
                {isSummary(shown.verdict, shown.street) ? "Итог раздачи" : shown.bluff?.on ? "Солвер: это блеф" : "Решение солвера"}
              </p>
              <p className={cn("text-4xl font-semibold leading-none sm:text-5xl", shown.bluff?.on ? "text-bluff" : isSummary(shown.verdict, shown.street) ? (shown.verdict === "Нет пары" ? "text-zinc-200" : "text-ok") : "")}>
                {shown.verdict}
              </p>
              <p className="mt-2 text-sm text-muted">
                {shown.label === shown.verdict ? "Совпадает с чартом" : `Чарт на этот размер: ${shown.label}`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {shown.street} · {shown.klass}
                {shown.made ? ` · ${shown.made}` : ""}
                {shown.draw ? ` · ${shown.draw}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Эквити</p>
              <p className="font-mono text-5xl font-semibold leading-none">{Math.round(shown.equity * 100)}%</p>
              {shown.need != null && shown.need > 0 ? (
                <p className={cn("mt-1 font-mono text-sm", shown.equity + 0.01 >= shown.need ? "text-ok" : "text-bad")}>
                  нужно {Math.round(shown.need * 100)}%
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">колл не требуется</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Отметьте карты слева. Решение, эквити и пот-оддс появятся в этом блоке, рядом с рейнджем.</p>
        )}
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
      {shown && result !== "win" && result !== "fold" ? <OddsBar need={shown.need} equity={shown.equity} street={shown.street} /> : null}
      {shown && result !== "win" && result !== "fold" ? <EquityLesson shown={shown} pot={pot} toCall={toCall} /> : null}
      {shown && result !== "win" && result !== "fold" ? <BluffNotice bluff={shown.bluff} /> : null}
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
                if (Date.now() - cardOpened.current < 500) return;
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
  cue,
  onClick,
}: {
  card: Card | null;
  active: boolean;
  small?: boolean;
  cue?: boolean;
  onClick: () => void;
}) {
  const red = card ? isRedSuit(card.suit) : false;
  const ask = Boolean(cue && !card);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border bg-card-face font-mono font-semibold",
        small ? "h-11 w-8 text-xs" : "h-16 w-12 text-sm",
        ask ? "next-step border-ok" : active ? "border-fg" : "border-transparent",
        card ? (red ? "text-suit-red" : "text-card-ink") : ask ? "text-ok" : "text-subtle",
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
  const a = cards.h0;
  const b = cards.h1;
  const pair = Boolean(a && b && a.rank === b.rank);
  const face = a ? (RANK_CHARS[a.rank] === "T" ? "10" : RANK_CHARS[a.rank]) : "";
  const label = pair ? `Пара ${face}` : "";
  const heard = useRef("");
  useEffect(() => {
    if (!label || heard.current === label) return;
    heard.current = label;
    playHandSting(1);
  }, [label]);
  return (
    <div className="w-[5.6rem] shrink-0 rounded-lg border border-border p-1">
      <p className="px-1 text-[11px] font-medium">Вы</p>
      <div className="mt-1 flex gap-1">
        {(["h0", "h1"] as const).map((slot) => (
          <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} small onClick={() => open(slot)} />
        ))}
      </div>
      {label ? (
        <p key={label} className="hand-hit relative mt-1 overflow-hidden rounded bg-ok px-1.5 py-1 text-xs font-semibold leading-tight text-bg">
          <span className="bluff-sheen pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          {label}
        </p>
      ) : null}
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
  onRevise,
  onUndo,
  out,
}: {
  spotId: string;
  hero: Seat;
  bb: number;
  line: Line;
  only: StreetId;
  hint: string;
  onAction: (seat: Seat, action: LineAction) => void;
  onRevise: (index: number, action: LineAction) => void;
  onUndo: () => void;
  out: Seat[];
}) {
  const seats = seatsInHand(spotId, out);
  const jammed = preflopAllin(spotId);
  const acts = line[only];
  const status = streetStatus(seats, line, only, jammed);
  const { pot, potText, setPotText, callText, setCallText } = useHand();
  const raiseSized = (action: LineAction | null) => action === "bet33" || action === "bet66" || action === "betpot" || action === "raise";
  const cols: { seat: Seat; selected: LineAction | null; live: boolean }[] = acts.map((act) => ({
    seat: act.seat,
    selected: act.action,
    live: false,
  }));
  if (!status.closed && status.seat) cols.push({ seat: status.seat, selected: null, live: true });
  const suggest = status.seat === hero ? suggested(hint, status.facing) : null;
  const sizeAt = cols.reduce((at, col, index) => (col.seat !== hero && raiseSized(col.selected) ? index : at), -1);
  return (
    <>
      {cols.map((col, index) => {
        const prior: Line = { ...line, [only]: acts.slice(0, index) };
        const faced = col.live ? status.facing : streetStatus(seats, prior, only, jammed).facing;
        const menu = (faced ? FACING_ACTIONS : OPEN_ACTIONS).filter((item) => item.id !== "bet66" && item.id !== "betpot");
        return (
          <Fragment key={`${col.seat}-${index}`}>
            <div
              className={cn(
                "w-[6.4rem] shrink-0 rounded-lg border p-1",
                col.seat === hero ? "border-2 border-ok bg-ok/15 shadow-[0_0_0_3px] shadow-ok/25" : "border-border",
              )}
            >
              <div className={cn("flex items-center justify-between rounded px-1 py-0.5 text-[11px]", col.seat === hero ? "bg-ok text-bg" : seatHead(col.seat))}>
                <span className="font-medium">{col.seat === hero ? "Вы · ваш ход" : col.seat}</span>
                <span className="font-mono">{seatStack(col.seat, bb)}</span>
              </div>
              <div className="mt-1 flex flex-col">
                {menu.map((item) => {
                  const on = col.selected === item.id;
                  const wanted = col.live && col.seat === hero && (suggest === item.id || (item.id === "bet33" && (suggest === "bet66" || suggest === "betpot")));
                  const bluffWanted = wanted && hint.toLowerCase().includes("блеф");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (on) return;
                        if (col.live) onAction(col.seat, item.id);
                        else onRevise(index, item.id);
                      }}
                      className={cn(
                        "rounded px-1 py-1 text-left text-xs",
                        on ? "bg-fg font-medium text-bg" : bluffWanted ? "bluff-card bg-bluff/25 font-semibold text-bluff ring-2 ring-bluff" : wanted ? "bg-ok/20 font-semibold text-fg ring-1 ring-ok" : "text-muted",
                      )}
                    >
                      {streetActionLabel(item.id, index === sizeAt, callText)}
                      {bluffWanted && !on ? " · БЛЕФ" : wanted && !on ? " · солвер" : ""}
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
            {index === sizeAt ? (
              <div className="w-[11.5rem] shrink-0 rounded-lg border border-ok/60 bg-ok/5 p-1 text-[11px]">
                <span className="block px-1 font-medium">Рейз {col.seat}, bb</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[2, 2.5, 3, 4, 6, 8].map((size) => {
                    const on = Number(callText.replace(",", ".")) === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setCallText(String(size));
                          if (!potText.trim() && pot != null && pot > 0) setPotText(String(pot));
                        }}
                        className={cn("h-8 rounded px-2 font-mono text-xs", on ? "bg-fg font-semibold text-bg" : "bg-surface-2 text-muted")}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <input
                  inputMode="decimal"
                  value={callText}
                  placeholder="2"
                  aria-label={`Размер рейза ${col.seat}, bb`}
                  onChange={(event) => setCallText(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg"
                />
                <span className="mt-1 block px-1 leading-tight text-muted">Это рейз {col.seat}. Меняет цену колла и его диапазон.</span>
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function streetActionLabel(action: LineAction, ownsSize: boolean, callText: string): string {
  if (action === "check") return "Check";
  if (action === "fold") return "Fold";
  if (action === "call") return "Call";
  if (action === "allin") return "All-in";
  if (!ownsSize || !callText.trim()) return "Raise";
  const size = Number(callText.replace(",", "."));
  if (!Number.isFinite(size) || size <= 0) return "Raise";
  const text = Number.isInteger(size) ? String(size) : String(Math.round(size * 10) / 10);
  return `Raise ${text}`;
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
  const { spot, bb, cards, queue, hero, board, shown, line, open, chooseLine, reviseLine, undoLine, out } = useHand();
  const latest = useRef<HTMLDivElement>(null);
  const heard = useRef(0);
  const holeNow = hero ? [hero[0], hero[1]] : [];
  const flopHand = showdown(board.length >= 3 ? [...holeNow, ...board.slice(0, 3)] : []);
  const turnHand = showdown(board.length >= 4 ? [...holeNow, ...board.slice(0, 4)] : []);
  const riverHand = showdown(board.length >= 5 ? [...holeNow, ...board.slice(0, 5)] : []);
  const madeRank = (hand: { category: number; bare: boolean } | null) => (hand && !hand.bare ? hand.category : 0);
  const flopRank = madeRank(flopHand);
  const turnRank = madeRank(turnHand);
  const riverRank = madeRank(riverHand);
  const bestRank = Math.max(flopRank, turnRank, riverRank);
  const fxRiver = riverRank > 0 && riverRank >= turnRank && riverRank >= flopRank;
  const fxTurn = !fxRiver && turnRank > 0 && turnRank >= flopRank;
  const fxFlop = !fxRiver && !fxTurn && flopRank > 0;
  useEffect(() => {
    if (!openBoard) return;
    latest.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openBoard, board.length, line.flop.length, line.turn.length, line.river.length]);
  useEffect(() => {
    if (!openBoard || !hero || bestRank <= heard.current) {
      heard.current = bestRank;
      return;
    }
    playHandSting(bestRank);
    heard.current = bestRank;
  }, [openBoard, hero, bestRank]);
  if (!openBoard) return null;
  const seats = seatsInHand(spot.id, out);
  const jammed = preflopAllin(spot.id);
  const hole = hero ? [hero[0], hero[1]] : [];
  const flopClosed = board.length >= 3 && streetStatus(seats, line, "flop", jammed).closed;
  const turnClosed = board.length >= 4 && streetStatus(seats, line, "turn", jammed).closed;
  const finished = handFinished(spot.id, line, board.length, out);
  const hint = shown?.verdict ?? "";
  const askFlop = board.length < 3;
  const askTurn = flopClosed && board.length < 4;
  const askRiver = turnClosed && board.length < 5;
  return (
    <div className="flex flex-col gap-2">
      <div ref={board.length < 4 ? latest : undefined} className={cn("flex flex-wrap items-start gap-1", !hero ? "pointer-events-none opacity-40" : "")}>
        <div className={cn("shrink-0 rounded-lg border p-1", askFlop ? "next-step border-ok bg-ok/10" : "border-border")}>
          <p className={cn("px-1 text-[11px] font-medium", askFlop ? "text-ok" : "")}>{askFlop ? "Дальше · флоп" : "Флоп"}</p>
          <div className="mt-1 flex gap-1">
            {(["f0", "f1", "f2"] as const).map((slot) => (
              <CardSlot key={slot} card={cards[slot] ?? null} active={queue[0] === slot} cue={askFlop} small onClick={() => open(slot)} />
            ))}
          </div>
          <Holding cards={board.length >= 3 ? [...hole, ...board.slice(0, 3)] : []} fx={fxFlop} />
        </div>
        {board.length >= 3 ? (
          <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="flop" hint={hint} out={out} onAction={(seat, action) => chooseLine("flop", seat, action)} onRevise={(index, action) => reviseLine("flop", index, action)} onUndo={() => undoLine("flop")} />
        ) : null}
        {flopClosed ? <CycleMark label="флоп" /> : null}
      </div>
      {flopClosed ? (
        <div ref={board.length < 5 ? latest : undefined} className="flex flex-wrap items-start gap-1">
          <div className={cn("shrink-0 rounded-lg border p-1", askTurn ? "next-step border-ok bg-ok/10" : "border-border")}>
            <p className={cn("px-1 text-[11px] font-medium", askTurn ? "text-ok" : "")}>{askTurn ? "Дальше · тёрн" : "Тёрн"}</p>
            <div className="mt-1">
              <CardSlot card={cards.t ?? null} active={queue[0] === "t"} cue={askTurn} small onClick={() => open("t")} />
            </div>
            {askTurn ? <p className="mt-1 px-1 text-[10px] font-medium text-ok">Откройте карту</p> : null}
            <Holding cards={board.length >= 4 ? [...hole, ...board.slice(0, 4)] : []} fx={fxTurn} />
          </div>
          {board.length >= 4 ? (
            <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="turn" hint={hint} out={out} onAction={(seat, action) => chooseLine("turn", seat, action)} onRevise={(index, action) => reviseLine("turn", index, action)} onUndo={() => undoLine("turn")} />
          ) : null}
          {turnClosed ? <CycleMark label="тёрн" /> : null}
        </div>
      ) : null}
      {turnClosed ? (
        <div ref={latest} className="flex flex-wrap items-start gap-1">
          <div className={cn("shrink-0 rounded-lg border p-1", askRiver ? "next-step border-ok bg-ok/10" : "border-border")}>
            <p className={cn("px-1 text-[11px] font-medium", askRiver ? "text-ok" : "")}>{askRiver ? "Дальше · ривер" : "Ривер"}</p>
            <div className="mt-1">
              <CardSlot card={cards.r ?? null} active={queue[0] === "r"} cue={askRiver} small onClick={() => open("r")} />
            </div>
            {askRiver ? <p className="mt-1 px-1 text-[10px] font-medium text-ok">Откройте карту</p> : null}
            <Holding cards={board.length >= 5 ? [...hole, ...board.slice(0, 5)] : []} fx={fxRiver} />
          </div>
          {board.length >= 5 ? (
            <StreetColumns spotId={spot.id} hero={spot.hero} bb={bb} line={line} only="river" hint={hint} out={out} onAction={(seat, action) => chooseLine("river", seat, action)} onRevise={(index, action) => reviseLine("river", index, action)} onUndo={() => undoLine("river")} />
          ) : null}
          {finished ? <DoneMark label={showdown([...hole, ...board])?.label ?? "Итог"} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Holding({ cards, fx }: { cards: Card[]; fx?: boolean }) {
  const made = showdown(cards);
  if (!made) return null;
  const rare = made.category >= 4;
  return (
    <p className={cn("relative mt-1 overflow-hidden rounded px-1.5 py-1 text-xs font-semibold leading-tight", made.bare ? "bg-zinc-700 text-zinc-50" : rare ? "bg-bluff text-bg" : "bg-ok text-bg", fx && !made.bare ? (rare ? "hand-rare" : "hand-hit") : "")}>
      {fx && !made.bare ? <span className="bluff-sheen pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" /> : null}
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

function showdown(cards: Card[]): { label: string; bare: boolean; category: number } | null {
  if (cards.length < 5 || cards.some((card) => !card)) return null;
  const hand = evaluateBest(cards);
  const { category, values } = unpack(hand.score);
  const rank = RANK_CHARS[values[0] ?? 0] ?? "";
  const second = RANK_CHARS[values[1] ?? 0] ?? "";
  if (category <= 0) return { label: `Нет пары · старшая ${rank}`, bare: true, category: 0 };
  if (category === 1) return { label: `Пара ${rank}`, bare: false, category };
  if (category === 2) return { label: `Две пары ${rank} и ${second}`, bare: false, category };
  if (category === 3) return { label: `Сет ${rank}`, bare: false, category };
  const names = ["", "", "", "", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш"];
  return { label: names[category] ?? "Комбинация", bare: false, category };
}

function handFinished(spotId: string, line: Line, boardLength: number, out: Seat[]): boolean {
  if (boardLength < 3) return false;
  const seats = seatsInHand(spotId, out);
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
  const name = verdict.toLowerCase();
  if (name === "fold" || name === "фолд") return "fold";
  if (name === "call" || name === "колл") return "call";
  if (name === "check" || name === "чек") return "check";
  if (name.includes("блеф") || name.startsWith("raise 2")) return "bet33";
  if (name.startsWith("raise 6")) return facing ? "raise" : "betpot";
  if (name.startsWith("raise 4") || name === "ставка") return facing ? "raise" : "bet66";
  if (name === "raise" || name === "рейз") return facing ? "raise" : "bet66";
  if (name.startsWith("all-in") || name === "пуш") return "allin";
  return null;
}

function OddsBar({ need, equity, street }: { need: number | null; equity: number; street: string }) {
  const eq = Math.round(equity * 100);
  if (need == null || need <= 0) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-bg px-3 py-3">
        <p className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">Пот-оддс</p>
        <p className="mt-1 text-sm">Ставки нет, коллировать нечего. Как только появится цена, здесь будут две цифры: сколько нужно и сколько у руки.</p>
      </div>
    );
  }
  const req = Math.round(need * 100);
  const ok = equity + 0.01 >= need;
  const scale = Math.max(req, eq, 1);
  return (
    <div className={cn("mt-3 rounded-xl border px-3 py-3", ok ? "border-ok bg-ok/10" : "border-bad bg-bad/10")}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">Нужно на колл</p>
          <p className="font-mono text-4xl font-semibold leading-none">{req}%</p>
        </div>
        <p className={cn("pb-1 text-sm font-medium", ok ? "text-ok" : "text-bad")}>{ok ? "Колл по шансам" : "Фолд по шансам"}</p>
        <div className="text-right">
          <p className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">У руки</p>
          <p className="font-mono text-4xl font-semibold leading-none">{eq}%</p>
        </div>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div className="absolute inset-y-0 left-0 bg-fg/20" style={{ width: `${Math.min(100, (req / scale) * 100)}%` }} />
        <div className={cn("absolute inset-y-0 left-0", ok ? "bg-ok" : "bg-bad")} style={{ width: `${Math.min(100, (eq / scale) * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {street === "Префлоп"
          ? "Пот-оддс обязателен. Если рука ниже цены, солвер меняет колл на фолд. На пуше фолд чарта не расширяется: в нём уже сидит ICM."
          : "Пот-оддс обязателен. Рука ниже цены — фолд, даже если чарт на другой размер говорил колл."}
      </p>
    </div>
  );
}

function playBluffSting() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = playBluffSting.ctx ?? new Ctx();
  playBluffSting.ctx = ctx;
  void ctx.resume();
  const now = ctx.currentTime;
  [523, 659, 784, 1046].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = now + index * 0.07;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}
playBluffSting.ctx = null as AudioContext | null;

function playHandSting(category: number) {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = playBluffSting.ctx ?? new Ctx();
  playBluffSting.ctx = ctx;
  void ctx.resume();
  const now = ctx.currentTime;
  const notes =
    category >= 8 ? [523, 659, 784, 1046, 1318] : category >= 6 ? [494, 659, 784, 1046] : category >= 4 ? [440, 554, 659, 880] : category >= 3 ? [392, 494, 587] : category >= 2 ? [349, 440, 523] : [330, 415];
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = category >= 4 ? "triangle" : "sine";
    osc.frequency.value = freq;
    const start = now + index * 0.08;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(category >= 4 ? 0.09 : 0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (category >= 4 ? 0.28 : 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

function BluffNotice({
  bluff,
}: {
  bluff: {
    on: boolean;
    title: string;
    action: string;
    reasons: string[];
    equity: number;
    foldNeed: number | null;
    bet: number | null;
    pot: number | null;
  } | null;
}) {
  const saw = journalSummary(readJournal()).saw;
  const sticky = Boolean(bluff?.on) && saw.station >= 3 && saw.station >= saw.nit && saw.station >= saw.lag;
  const on = Boolean(bluff?.on) && !sticky;
  useEffect(() => {
    if (!on) return;
    playBluffSting();
  }, [on, bluff?.title, bluff?.action]);
  if (!bluff) return null;
  const fold = bluff.foldNeed == null ? null : Math.round(bluff.foldNeed * 100);
  const eq = Math.round(bluff.equity * 100);
  const reasons = sticky
    ? [`Журнал: стол коллирует всё. Нужные ${fold ?? 0}% фолда вы здесь не получите.`, "Дро есть, но ставка без руки этому оппоненту платит. Чек."]
    : bluff.reasons;
  return (
    <div className={cn("relative mt-3 overflow-hidden rounded-xl border px-3 py-3", on ? "bluff-card border-2 border-bluff bg-bluff/15" : "border-border bg-bg")}>
      {on ? <div className="bluff-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" /> : null}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={cn("text-[10px] font-medium tracking-[0.2em] uppercase", on ? "text-bluff" : "text-subtle")}>{on ? "Блеф берём" : "Блеф не берём"}</p>
          <p className={cn("mt-1 text-2xl font-semibold", on ? "text-bluff" : "")}>{sticky ? "Не блефуй" : bluff.title}</p>
          <p className="mt-1 text-sm">{on ? `Действие: ${bluff.action}` : `Вместо блефа: ${sticky ? "Чек" : bluff.action}`}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Нужен фолд</p>
          <p className={cn("font-mono text-4xl font-semibold leading-none", on ? "text-bluff" : "")}>{fold == null ? "—" : `${fold}%`}</p>
          <p className="mt-1 font-mono text-xs text-muted">эквити {eq}%</p>
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

function EquityLesson({
  shown,
  pot,
  toCall,
}: {
  shown: {
    equity: number;
    win: number;
    tie: number;
    who: string;
    likely: { hand: string; pct: number }[];
    need: number | null;
    verdict: string;
    street: string;
  };
  pot: number | null;
  toCall: number | null;
}) {
  const eq = shown.equity;
  const win = Math.round(shown.win * 100);
  const tie = Math.round(shown.tie * 100);
  const eqPct = Math.round(eq * 100);
  const priced = shown.need != null && shown.need > 0;
  const need = priced ? Math.round(shown.need! * 100) : null;
  const ev = priced && pot != null && toCall != null && toCall > 0 ? eq * (pot + toCall) - toCall : null;
  const shoving = /all-in|пуш|блеф|raise/i.test(shown.verdict);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-bg px-3 py-3 text-sm">
      <p className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">Как считалось</p>
      <p>
        Эквити — ваша доля банка на вскрытии против диапазона «{shown.who}». Это не шанс, что оппонент сбросит.
      </p>
      <p className="font-mono text-xs leading-relaxed text-fg">
        EQ = (победы + ничьи / 2) / все пробы
        <br />
        {win}% побед + {tie}% ничьих / 2 = {eqPct}%
      </p>
      <p className="text-muted">
        {shown.street === "Префлоп"
          ? "В каждой пробе солвер добирает флоп, тёрн и ривер из оставшейся колоды. Цифра уже включает все будущие карты, а не только то, что на руках сейчас."
          : "Незакрытые карты борда в каждой пробе добираются из колоды. Дро уже сидит в этой цифре, отдельно ауты прибавлять не нужно."}
      </p>
      {shown.likely.length > 0 ? (
        <p className="text-muted">
          Чаще всего у оппонента: {shown.likely.slice(0, 4).map((hand) => `${hand.hand} ${hand.pct}%`).join(" · ")}.
        </p>
      ) : null}
      {priced && need != null ? (
        <>
          <p>Пот-оддс — минимальное эквити, при котором колл не теряет фишки.</p>
          <p className="font-mono text-xs leading-relaxed text-fg">
            нужно = докинуть / (банк + докинуть) = {need}%
            <br />
            EV колла = EQ × (банк + докинуть) − докинуть
            {ev != null ? ` = ${ev >= 0 ? "+" : ""}${ev.toFixed(2)} bb` : ""}
          </p>
          <p className="text-muted">
            {eq + 0.01 >= shown.need!
              ? `Рука ${eqPct}% выше цены ${need}%. Колл по фишкам плюсовой.`
              : `Рука ${eqPct}% ниже цены ${need}%. Колл сжигает фишки, даже если рука выглядит сильной.`}
          </p>
        </>
      ) : shoving ? (
        <>
          <p>Пуш и рейз — не колл. Кроме доли банка на вскрытии есть фолд-эквити: то, что забираете, когда оппонент сбрасывает.</p>
          <p className="font-mono text-xs leading-relaxed text-fg">
            EV = F × банк сейчас + (1 − F) × (EQ × банк после колла − риск)
          </p>
          <p className="text-muted">
            F — как часто сбрасывают. В одну руку это не измерить, чарт уже это заложил. Поэтому {shown.verdict} при эквити {eqPct}% может быть верным: {eqPct}% — только ветка, где вас заколлировали.
          </p>
        </>
      ) : (
        <p className="text-muted">Ставки нет, формула колла не включается. Эквити показывает, насколько рука впереди диапазона, если дойдёте до вскрытия.</p>
      )}
    </div>
  );
}
