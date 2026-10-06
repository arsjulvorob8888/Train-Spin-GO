import { RANK_CHARS, SUIT_GLYPHS, handClass, isRedSuit, type Card } from "@/lib/poker/cards";
import { consult } from "@/lib/spin-drill/equity-calc";
import {
  actionName,
  legal,
  liveSeats,
  matchSpot,
  nextToAct,
  postOrder,
  putsOf,
  toCall,
  type Act,
  type PfAction,
  type Seat,
} from "@/lib/spin-drill/hand-sim";
import { mixOf, primary, type MixAction } from "@/lib/spin-drill/mix";
import { emptyLine, lastBySeat, type Line, type LineAction, type StreetId } from "@/lib/spin-drill/postflop-line";
import { findSpot } from "@/lib/spin-drill/spots";
import { rangeAtStack } from "@/lib/spin-drill/stack-ranges";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const RANKS = [...RANK_CHARS].reverse();
const DEPTHS = [8, 10, 12, 15, 20, 25];

export function HandSim() {
  const [stack, setStack] = useState(15);
  const [hero, setHero] = useState<Seat>("BTN");
  const [history, setHistory] = useState<Act[]>([]);
  const [cards, setCards] = useState<Partial<Record<string, Card>>>({});
  const [street, setStreet] = useState<"pre" | StreetId | "over">("pre");
  const [line, setLine] = useState<Line>(emptyLine());
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const [chartId, setChartId] = useState("btn");
  const heroCards = cards.h0 && cards.h1 ? ([cards.h0, cards.h1] as [Card, Card]) : null;
  const board = useMemo(() => {
    if (!cards.f0 || !cards.f1 || !cards.f2) return [] as Card[];
    const flop = [cards.f0, cards.f1, cards.f2];
    if (cards.t && street !== "pre" && street !== "flop") flop.push(cards.t);
    if (cards.r && (street === "river" || street === "over")) flop.push(cards.r);
    return flop;
  }, [cards, street]);
  const money = putsOf(stack, history);
  const who = street === "pre" ? nextToAct(stack, history) : "over";

  useEffect(() => {
    if (street !== "pre") return;
    if (who !== "over") return;
    const seats = liveSeats(stack, history);
    if (seats.includes(hero) && seats.length >= 2) setStreet("flop");
    else {
      setStreet("over");
      setNote(seats.includes(hero) ? "Все сбросили. Банк ваш без вскрытия." : "Раздача закрыта.");
    }
  }, [who, street, stack, history, hero]);

  function reset(nextStack = stack, nextHero = hero) {
    setStack(nextStack);
    setHero(nextHero);
    setHistory([]);
    setCards({});
    setStreet("pre");
    setLine(emptyLine());
    setNote(null);
    setPicking(null);
  }

  function playPre(seat: Seat, action: PfAction) {
    const next = [...history, { seat, action }];
    setHistory(next);
    if (seat === hero && action === "fold") {
      setStreet("over");
      setNote("Фолд. На дистанции это сохраняет стек: одна раздача ничего не гарантирует.");
    }
  }

  const spotId = street === "pre" && who === hero ? matchSpot(hero, stack, history) : null;
  useEffect(() => {
    if (spotId) setChartId(spotId);
  }, [spotId]);
  const advice = useMemo(() => {
    if (!heroCards || !spotId) return null;
    const spot = findSpot(spotId);
    const range = rangeAtStack(spot.range, spot.id, stack);
    const labels = {
      ...spot.labels,
      allin: `All-in ${stack}`,
      raise: stack >= 20 ? "Raise 2.5" : spot.labels.raise,
      call: spot.id === "sb_fold" || spot.id === "hu_sb" ? "Limp" : spot.labels.call,
    };
    const klass = handClass(heroCards[0], heroCards[1]);
    const mix = mixOf(range, klass);
    const action = primary(mix);
    return { klass, action, label: labels[action], spot: spot.vs };
  }, [heroCards, spotId, stack]);

  const post = useMemo(() => {
    if (!heroCards || street === "pre" || street === "over") return null;
    const need = street === "flop" ? 3 : street === "turn" ? 4 : 5;
    if (board.length < need) return null;
    const order = postOrder(liveSeats(stack, history));
    const acted = lastBySeat(line[street]);
    const actor = order.find((seat) => !acted[seat]);
    if (!actor || actor !== hero) return { actor: actor ?? null, order, result: null as null };
    const spot = findSpot(chartId);
    const range = rangeAtStack(spot.range, spot.id, stack);
    const labels = { ...spot.labels, allin: `All-in ${stack}` };
    const result = consult({
      hero: heroCards,
      board: board.slice(0, need),
      spotId: spot.id,
      bb: stack,
      range,
      labels,
      pot: money.pot,
      toCall: facingSize(order, acted, money.pot, stack),
      line,
      heroSeat: hero,
    });
    return { actor, order, result };
  }, [heroCards, street, board, stack, history, line, chartId, money.pot, hero]);

  const prompt = describePrompt(street, who, hero, heroCards, board.length, post?.actor ?? null);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Раздача Spin & Go</h2>
        <p className="mt-1 text-sm text-muted">
          Трое, блайнды 0.5 и 1. Вы вносите действия по кругу. Банк считается сам. На вашем ходе — одно действие с лучшим ожиданием. Оно не выигрывает каждую раздачу, оно выигрывает деньги на дистанции.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {DEPTHS.map((depth) => (
          <button
            key={depth}
            type="button"
            onClick={() => reset(depth, hero)}
            className={cn("h-10 rounded-md px-3 font-mono text-sm", stack === depth ? "bg-fg text-bg" : "bg-surface text-muted")}
          >
            {depth}bb
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(["BTN", "SB", "BB"] as const).map((seat) => (
          <button
            key={seat}
            type="button"
            onClick={() => reset(stack, seat)}
            className={cn("h-10 rounded-md px-3 text-sm", hero === seat ? "bg-fg text-bg" : "bg-surface text-muted")}
          >
            Вы {seat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["BTN", "SB", "BB"] as const).map((seat) => (
          <div key={seat} className={cn("rounded-xl border p-2", seat === hero ? "border-ok" : "border-border")}>
            <div className="flex justify-between text-xs">
              <span>{seat}{seat === hero ? " · вы" : ""}</span>
              <span className="font-mono">{round(stack - (seat === "SB" ? 0.5 : seat === "BB" ? 1 : 0))}bb</span>
            </div>
            <p className="mt-1 text-sm">{lastAction(history, seat) ?? "—"}</p>
          </div>
        ))}
      </div>
      <p className="font-mono text-sm">
        Банк {money.pot}bb
        {who === hero ? ` · докинуть ${toCall(stack, history, hero)}bb` : ""}
      </p>
      {history.length ? (
        <p className="text-sm text-muted">{history.map((act) => `${act.seat} ${actionName(act.action, history)}`).join(" → ")}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">{prompt}</p>
        {street !== "over" && who === hero && street === "pre" ? (
          <div className="mt-3 flex gap-2">
            {(["h0", "h1"] as const).map((slot) => (
              <CardFace key={slot} card={cards[slot] ?? null} active={picking === slot} onClick={() => open(slot)} />
            ))}
          </div>
        ) : null}
        {street === "flop" && board.length < 3 ? (
          <div className="mt-3 flex gap-1">
            {(["f0", "f1", "f2"] as const).map((slot) => (
              <CardFace key={slot} card={cards[slot] ?? null} active={picking === slot} small onClick={() => open(slot)} />
            ))}
          </div>
        ) : null}
        {street === "turn" && !cards.t ? (
          <div className="mt-3">
            <CardFace card={null} active={picking === "t"} small onClick={() => open("t")} />
          </div>
        ) : null}
        {street === "river" && !cards.r ? (
          <div className="mt-3">
            <CardFace card={null} active={picking === "r"} small onClick={() => open("r")} />
          </div>
        ) : null}

        {street === "pre" && who !== "over" && who !== hero ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {legal(stack, history, who).map((action) => (
              <button key={action} type="button" className="h-11 rounded-md bg-surface-2 px-3 text-sm" onClick={() => playPre(who, action)}>
                {actionName(action, history)}
              </button>
            ))}
          </div>
        ) : null}

        {street === "pre" && who === hero && advice ? (
          <Verdict
            title={advice.label}
            text={`Префлоп, ${advice.spot}, ${stack}bb. Чарт этой линии: ${advice.label}. Это действие с лучшим ожиданием против поля. Одна раздача всё равно может проиграться.`}
            onPlay={() => playPre(hero, toPf(advice.action, legal(stack, history, hero)))}
          />
        ) : null}
        {street === "pre" && who === hero && heroCards && !advice ? (
          <p className="mt-3 text-sm text-muted">Этой префлоп-линии нет в чартах. Без чарта на коротком стеке: мусор — фолд, рука которой готовы играть стек — олл-ин.</p>
        ) : null}

        {post?.actor && post.actor !== hero ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(facing(post.order, lastBySeat(line[street as StreetId]), post.actor) ? ["fold", "call", "raise", "allin"] : ["check", "bet33", "bet66", "allin"]).map((action) => (
              <button
                key={action}
                type="button"
                className="h-11 rounded-md bg-surface-2 px-3 text-sm"
                onClick={() => playPost(post.actor as Seat, action as LineAction)}
              >
                {postName(action as LineAction)}
              </button>
            ))}
          </div>
        ) : null}
        {post?.result ? (
          <Verdict
            title={post.result.verdict}
            text={post.result.text}
            onPlay={() => playPost(hero, verdictAction(post.result!.verdict, post.order, lastBySeat(line[street as StreetId])))}
          />
        ) : null}
        {note ? <p className="mt-3 text-sm">{note}</p> : null}
        {picking ? (
          <div className="mt-3 rounded-xl border border-border p-2">
            <div className="grid grid-cols-7 gap-1">
              {RANKS.map((glyph) => {
                const value = RANK_CHARS.indexOf(glyph);
                return (
                  <button key={glyph} type="button" className={cn("h-8 rounded-md font-mono text-sm", rank === value ? "bg-fg text-bg" : "bg-surface-2")} onClick={() => setRank(value)}>
                    {glyph === "T" ? "10" : glyph}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {SUIT_GLYPHS.map((glyph, suit) => (
                <button key={glyph} type="button" disabled={rank == null} className={cn("h-10 rounded-md bg-card-face font-mono text-xl disabled:opacity-40", isRedSuit(suit) ? "text-suit-red" : "text-card-ink")} onClick={() => choose(suit)}>
                  {glyph}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {street !== "pre" || history.length > 0 ? (
        <button type="button" className="h-10 text-sm text-muted" onClick={() => reset()}>
          Новая раздача
        </button>
      ) : null}
    </div>
  );

  function open(slot: string) {
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

  function choose(suit: number) {
    if (picking == null || rank == null) return;
    const card = { rank, suit };
    if (Object.entries(cards).some(([slot, item]) => slot !== picking && item && item.rank === card.rank && item.suit === card.suit)) return;
    setCards({ ...cards, [picking]: card });
    setPicking(null);
    setRank(null);
  }

  function playPost(seat: Seat, action: LineAction) {
    if (street !== "flop" && street !== "turn" && street !== "river") return;
    const map = { ...lastBySeat(line[street]), [seat]: action };
    const order = postOrder(liveSeats(stack, history));
    const acts = order.filter((item) => map[item]).map((item) => ({ seat: item, action: map[item]! }));
    const next = { ...line, [street]: acts };
    setLine(next);
    if (seat === hero && action === "fold") {
      setStreet("over");
      setNote("Фолд. Цена банка или сила руки не оплачивают продолжение.");
      return;
    }
    const left = order.filter((item) => item !== seat && map[item] !== "fold" && !map[item]);
    const foldedNow = order.filter((item) => map[item] === "fold");
    if (order.length - foldedNow.length <= 1 && left.length === 0) {
      setStreet("over");
      setNote("Остальные сбросили. Банк ваш.");
      return;
    }
    if (order.every((item) => map[item])) {
      if (street === "flop") setStreet("turn");
      else if (street === "turn") setStreet("river");
      else {
        setStreet("over");
        setNote("Ривер сыгран. Дальше только вскрытие.");
      }
    }
  }
}

function Verdict({ title, text, onPlay }: { title: string; text: string; onPlay: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-ok p-3">
      <p className="text-[10px] font-medium tracking-wide text-subtle uppercase">Ваше действие</p>
      <p className="mt-1 text-3xl font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-snug text-muted">{text}</p>
      <button type="button" className="mt-3 h-12 w-full rounded-md bg-fg text-sm font-medium text-bg" onClick={onPlay}>
        Сыграть: {title}
      </button>
    </div>
  );
}

function CardFace({ card, active, small, onClick }: { card: Card | null; active: boolean; small?: boolean; onClick: () => void }) {
  const red = card ? isRedSuit(card.suit) : false;
  return (
    <button type="button" onClick={onClick} className={cn("rounded-md border bg-card-face font-mono font-semibold", small ? "h-11 w-8 text-xs" : "h-16 w-12 text-sm", active ? "border-fg" : "border-transparent", card ? (red ? "text-suit-red" : "text-card-ink") : "text-subtle")}>
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

function lastAction(history: Act[], seat: Seat): string | null {
  const act = [...history].reverse().find((item) => item.seat === seat);
  return act ? actionName(act.action, history) : null;
}

function toPf(action: MixAction, options: PfAction[]): PfAction {
  if (action === "fold") return "fold";
  if (action === "allin") return "allin";
  if (action === "raise") return options.includes("raise") ? "raise" : "allin";
  if (options.includes("check")) return "check";
  if (options.includes("limp")) return "limp";
  return "call";
}

function facing(order: Seat[], acts: Partial<Record<Seat, LineAction>>, seat: Seat): boolean {
  const index = order.indexOf(seat);
  return order.slice(0, index).some((item) => {
    const action = acts[item];
    return action === "bet33" || action === "bet66" || action === "raise" || action === "allin";
  });
}

function facingSize(order: Seat[], acts: Partial<Record<Seat, LineAction>>, pot: number, stack: number): number | null {
  let size: number | null = null;
  for (const seat of order) {
    const action = acts[seat];
    if (action === "bet33") size = round(pot / 3);
    if (action === "bet66") size = round(pot * 0.66);
    if (action === "raise") size = round(pot);
    if (action === "allin") size = stack;
  }
  return size;
}

function verdictAction(verdict: string, order: Seat[], acts: Partial<Record<Seat, LineAction>>): LineAction {
  const against = order.some((seat) => {
    const action = acts[seat];
    return action === "bet33" || action === "bet66" || action === "raise" || action === "allin";
  });
  if (verdict === "Фолд") return "fold";
  if (verdict === "Чек") return "check";
  if (verdict === "Колл") return "call";
  if (verdict === "Рейз") return "raise";
  return against ? "raise" : "bet66";
}

function postName(action: LineAction): string {
  if (action === "check") return "Check";
  if (action === "bet33") return "Bet 33%";
  if (action === "bet66") return "Bet 66%";
  if (action === "fold") return "Fold";
  if (action === "call") return "Call";
  if (action === "raise") return "Raise";
  return "All-in";
}

function describePrompt(
  street: "pre" | StreetId | "over",
  who: Seat | "over",
  hero: Seat,
  heroCards: [Card, Card] | null,
  board: number,
  postActor: Seat | null,
): string {
  if (street === "over") return "Раздача закончена.";
  if (street === "pre") {
    if (who === hero) return heroCards ? "Ваш ход на префлопе." : "Ваш ход. Две карты.";
    if (who === "over") return "Префлоп закрыт.";
    return `Ход ${who}. Что он сделал?`;
  }
  if (street === "flop" && board < 3) return "Три карты флопа.";
  if (street === "turn" && board < 4) return "Карта тёрна.";
  if (street === "river" && board < 5) return "Карта ривера.";
  if (postActor && postActor !== hero) return `Ход ${postActor} на ${street === "flop" ? "флопе" : street === "turn" ? "тёрне" : "ривере"}.`;
  if (postActor === hero) return "Ваш ход. Решение по борду, диапазону и банку.";
  return "Дальше.";
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
