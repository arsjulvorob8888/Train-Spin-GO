import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { RANK_CHARS, SUIT_GLYPHS, handClass, isRedSuit, type Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";
import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { continuePct, type MixAction } from "@/lib/spin-drill/mix";
import { actionWord, spotsOf, type MttPack } from "@/lib/mtt/charts";
import { bluffLine, nashLine, playAction, resolveLive, SEATS, sizeLine, type LiveNode, type MttSeat } from "@/lib/mtt/live";
import { playBluffSting, playDrawSting, playHandSting } from "@/components/spin-drill/equity-desk";
import { cn } from "@/lib/utils";

type Act = "fold" | "limp" | "raise" | "call" | "3bet" | "allin";
type Btn = { id: Act; label: string };
type Col = { key: string; seat: MttSeat; hero: boolean; title: string; chips: string; actions: Btn[]; selected: Act | ""; wanted: Act | "" };
type Outcome = "pending" | "fold" | "win" | "flop";
type SlotId = "h0" | "h1" | "b0" | "b1" | "b2" | "b3" | "b4";
type Stacks = Record<MttSeat, number>;

const MADE = ["старшая карта", "пара", "две пары", "сет", "стрит", "флеш", "фулл-хаус", "каре", "стрит-флеш"];
const RANKS = [...RANK_CHARS].reverse();

function chipsOf(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function freshStacks(depth: number): Stacks {
  const next = Object.fromEntries(SEATS.map((seat) => [seat, depth])) as Stacks;
  next.SB = chipsOf(depth - 0.5);
  next.BB = chipsOf(depth - 1);
  return next;
}

function rotateStacks(stacks: Stacks): Stacks {
  const next = {} as Stacks;
  SEATS.forEach((seat, index) => {
    const from = SEATS[(index + SEATS.length - 1) % SEATS.length]!;
    next[seat] = stacks[from];
  });
  next.SB = chipsOf(next.SB - 0.5);
  next.BB = chipsOf(next.BB - 1);
  return next;
}

function stillIn(pick: Record<string, Act>, hero: MttSeat): MttSeat[] {
  return SEATS.filter((seat) => {
    if (pick[`pre:${seat}`] === "fold" || pick[`post:${seat}`] === "fold" || pick[`ans:${seat}`] === "fold") return false;
    if (seat === hero && (pick.hero === "fold" || pick.back === "fold")) return false;
    return true;
  });
}

function effectOf(stacks: Stacks, hero: MttSeat, pick: Record<string, Act>, charts: number[]): { bb: number; chart: number; why: string } {
  const live = stillIn(pick, hero);
  const mine = stacks[hero];
  const others = live.filter((seat) => seat !== hero).map((seat) => stacks[seat]);
  const values = live.map((seat) => stacks[seat]);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const even = spread <= 1.5;
  const raw = even || !others.length ? mine : Math.min(mine, ...others);
  const bb = chipsOf(raw);
  const chart = charts.reduce((best, item) => (Math.abs(item - bb) < Math.abs(best - bb) ? item : best), charts[0] ?? 30);
  const who = live.filter((seat) => seat !== hero).map((seat) => `${seat === "UTG1" ? "UTG+1" : seat} ${stacks[seat]}`).join(", ");
  const why = even
    ? `Стеки почти равны, разница только блайнды. Чарт ${chart}bb.`
    : `Вы ${mine}bb, в раздаче ${who}. Эффективный ${bb}bb — меньший из них. Чарт ${chart}bb.`;
  return { bb, chart, why };
}

export function MttDesk() {
  const [pack, setPack] = useState<MttPack | null>(null);
  const [error, setError] = useState("");
  const [stacks, setStacks] = useState<Stacks>(() => freshStacks(30));
  const [hero, setHero] = useState<MttSeat>("UTG");
  const [pick, setPick] = useState<Record<string, Act>>({});
  const [klass, setKlass] = useState("");
  const [cards, setCards] = useState<Partial<Record<SlotId, Card>>>({});
  const cardsRef = useRef<Partial<Record<SlotId, Card>>>({});
  const queueRef = useRef<SlotId[]>([]);
  const [queue, setQueue] = useState<SlotId[]>([]);
  const openedAt = useRef(0);
  const [street, setStreet] = useState<Record<string, Act>>({});
  const flopAsk = useRef(false);
  const turnAsk = useRef(false);
  const riverAsk = useRef(false);
  const heardHand = useRef(0);
  const heardDraw = useRef("");
  const heardBluff = useRef(false);

  useEffect(() => {
    let live = true;
    fetch("/mtt-8max.json")
      .then((res) => (res.ok ? (res.json() as Promise<MttPack>) : Promise.reject(new Error("load"))))
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
  const depth = pack ? effectOf(stacks, hero, pick, pack.stacks) : { bb: 30, chart: 30, why: "" };
  const dealt = cards.h0 && cards.h1 ? handClass(cards.h0, cards.h1) : klass;
  const built = pack ? buildLine(pack, spots, depth.bb, depth.chart, stacks, hero, pick, dealt) : null;
  const hole: [Card | null, Card | null] = [cards.h0 ?? null, cards.h1 ?? null];
  const board = [cards.b0 ?? null, cards.b1 ?? null, cards.b2 ?? null, cards.b3 ?? null, cards.b4 ?? null];

  function showQueue(slots: SlotId[]) {
    queueRef.current = slots;
    setQueue(slots);
    openedAt.current = Date.now();
  }

  useEffect(() => {
    if (built?.outcome !== "flop" || !cards.h0 || !cards.h1) {
      if (built?.outcome !== "flop") {
        flopAsk.current = false;
        turnAsk.current = false;
        riverAsk.current = false;
      }
      return;
    }
    if (queueRef.current.length) return;
    if (!cards.b0 && !flopAsk.current) {
      flopAsk.current = true;
      showQueue(["b0", "b1", "b2"]);
      return;
    }
    if (cards.b0 && cards.b1 && cards.b2 && street["флоп"] && !cards.b3 && !turnAsk.current) {
      turnAsk.current = true;
      showQueue(["b3"]);
      return;
    }
    if (cards.b3 && street["тёрн"] && !cards.b4 && !riverAsk.current) {
      riverAsk.current = true;
      showQueue(["b4"]);
    }
  }, [built?.outcome, cards, street, queue.length]);

  useEffect(() => {
    const pair = cards.h0 && cards.h1 ? [cards.h0, cards.h1] : null;
    const known = [cards.b0, cards.b1, cards.b2, cards.b3, cards.b4].filter((card): card is Card => Boolean(card));
    if (!pair || known.length < 3) {
      heardHand.current = 0;
      heardDraw.current = "";
      return;
    }
    const made = evaluateBest([...pair, ...known]);
    if (made.category > 0 && made.category > heardHand.current) {
      playHandSting(made.category);
      heardHand.current = made.category;
    }
    if (known.length >= 5) return;
    const draw = analyzeDraws(pair, known);
    const key = `${draw.flushDraw ? "f" : ""}${draw.oesd ? "o" : ""}${draw.gutshot ? "g" : ""}`;
    if (key && key !== heardDraw.current) {
      playDrawSting(Boolean(draw.flushDraw || draw.oesd));
      heardDraw.current = key;
    }
    if (!key) heardDraw.current = "";
  }, [cards]);

  function choose(key: string, action: Act) {
    setPick((prev) => {
      const next = { ...prev, [key]: action };
      const seat = key.startsWith("pre:") ? key.slice(4) : key.startsWith("post:") ? key.slice(5) : "";
      const from = seat ? SEATS.indexOf(seat as MttSeat) + 1 : 0;
      if (key.startsWith("pre:")) {
        for (const item of SEATS.slice(from)) delete next[`pre:${item}`];
        delete next.hero;
        delete next.back;
        for (const item of SEATS) delete next[`post:${item}`];
        for (const item of SEATS) delete next[`ans:${item}`];
      }
      if (key === "hero") {
        delete next.back;
        for (const item of SEATS) {
          delete next[`post:${item}`];
          delete next[`ans:${item}`];
        }
      }
      if (key.startsWith("post:")) {
        for (const item of SEATS.slice(from)) delete next[`post:${item}`];
        delete next.back;
      }
      return next;
    });
    setStreet({});
  }

  function nextHand() {
    const i = SEATS.indexOf(hero);
    setHero(SEATS[(i + 1) % SEATS.length]!);
    setStacks((prev) => rotateStacks(prev));
    setPick({});
    setKlass("");
    cardsRef.current = {};
    setCards({});
    showQueue(["h0", "h1"]);
    setStreet({});
    flopAsk.current = false;
    turnAsk.current = false;
    riverAsk.current = false;
    heardHand.current = 0;
    heardDraw.current = "";
  }

  function open(slot: SlotId) {
    const prev = cardsRef.current;
    if (prev[slot]) {
      const next = { ...prev };
      delete next[slot];
      cardsRef.current = next;
      setCards(next);
      if (slot === "h0" || slot === "h1") setKlass("");
      showQueue([]);
      return;
    }
    const group: SlotId[] = slot === "h0" || slot === "h1" ? ["h0", "h1"] : slot === "b0" || slot === "b1" || slot === "b2" ? ["b0", "b1", "b2"] : [slot];
    showQueue(group.filter((item) => !prev[item]));
  }

  function chooseCard(rank: number, suit: number) {
    const slot = queueRef.current[0];
    if (!slot) return;
    const prev = cardsRef.current;
    if (Object.values(prev).some((card) => card && card.rank === rank && card.suit === suit)) return;
    const next = { ...prev, [slot]: { rank, suit } };
    cardsRef.current = next;
    setCards(next);
    if (next.h0 && next.h1) setKlass(handClass(next.h0, next.h1));
    showQueue(queueRef.current.slice(1));
  }

  function correctStack(seat: MttSeat, value: number) {
    setStacks((prev) => ({ ...prev, [seat]: chipsOf(value) }));
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!pack || !built) return <p className="text-sm text-muted">Загружаю MTT 8-max…</p>;

  const node = built.node;
  const advice = built.advice;
  const word = built.outcome === "win" ? "Банк ваш" : advice ? actionWord(advice, node?.call ?? "Call") : "Ждём";
  const size = built.outcome === "win" ? "Флопа нет." : built.outcome === "fold" ? "Карты дальше не открывайте." : node && advice ? sizeLine(advice, depth.bb, node.kind, node.call) : "Сначала ходы до вас. Флоп откроется, только если раздача идёт дальше.";
  const bluff = node && advice && dealt ? bluffLine(dealt, advice, hero, node.kind) : null;
  const known = board.filter((card): card is Card => Boolean(card));
  const post = built.outcome === "flop" && hole[0] && hole[1] ? postAdvice(hole[0], hole[1], known, street) : null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {SEATS.map((seat) => (
          <button
            key={seat}
            type="button"
            onClick={() => {
              setHero(seat);
              setPick({});
              setStreet({});
            }}
            className={cn("h-10 rounded-full px-3 text-sm", seat === hero ? "bg-fg text-bg" : "bg-surface-2 text-muted")}
          >
            {seat === "UTG1" ? "UTG+1" : seat}
            {seat === hero ? " · вы" : ""}
          </button>
        ))}
        <span className="ml-auto grid h-11 min-w-[4.5rem] place-items-center rounded-xl border-2 border-ok bg-ok/15 px-2" title={depth.why}>
          <span className="text-[9px] font-medium uppercase leading-none text-ok">Эфф.</span>
          <span className="font-mono text-lg font-semibold leading-none">{depth.bb}</span>
        </span>
        <button type="button" onClick={nextHand} className="h-11 rounded-full bg-ok px-4 text-sm font-semibold text-bg">
          Новая раздача
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-1">
        {SEATS.map((seat) => {
          const mine = seat === hero;
          return (
            <label key={seat} className="block w-14 text-center">
              <span className={cn("block text-[11px] font-semibold leading-none", mine ? "text-ok" : "text-fg")}>{seat === "UTG1" ? "+1" : seat}</span>
              <span className={cn("mt-0.5 block h-3 text-[10px] font-medium leading-none", mine ? "text-ok" : "text-transparent")}>{mine ? "Вы" : "·"}</span>
              <input
                inputMode="decimal"
                aria-label={`Стек ${seat}`}
                defaultValue={String(stacks[seat])}
                key={`${seat}-${stacks[seat]}`}
                onBlur={(event) => {
                  const n = Number(event.target.value.replace(",", "."));
                  if (n >= 0.5 && n <= 300) correctStack(seat, n);
                }}
                className={cn("mt-1 h-11 w-14 rounded-md border bg-surface px-1 text-center font-mono text-sm text-fg", mine ? "border-ok ring-2 ring-ok/60" : "border-border")}
              />
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {pack.stacks.map((item) => (
          <button key={item} type="button" onClick={() => setStacks(freshStacks(item))} className={cn("h-7 rounded-full px-2 font-mono text-[11px]", item === depth.chart ? "bg-zinc-600 text-zinc-100" : "bg-zinc-900 text-zinc-500")}>
            {item}bb
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{depth.why} Блайнды снимаются при новой раздаче. Если стол разъехался — поправьте поле, солвер сразу берёт новое число.</p>

      <div className="mt-3 flex flex-wrap items-start gap-1">
        <div className="shrink-0 rounded-lg border border-border p-1">
          <p className="px-1 text-[11px] font-medium">Вы</p>
          <div className="mt-1 flex gap-1">
            {[0, 1].map((index) => (
              <CardFace key={index} card={hole[index] ?? null} cue={!hole[index]} active={queue[0] === `h${index}`} onClick={() => open(index === 0 ? "h0" : "h1")} />
            ))}
          </div>
          {dealt ? <p className="mt-1 px-1 font-mono text-[11px] text-muted">{dealt}</p> : null}
        </div>
        {built.cols.map((col, index) => (
          <ActionCol key={col.key} col={col} live={!col.selected && built.cols.slice(0, index).every((item) => item.selected)} onPick={(action) => choose(col.key, action)} />
        ))}
        {built.outcome === "win" ? <p className="self-center rounded-lg border border-ok bg-ok/10 px-3 py-2 text-sm font-medium">Все сбросили. Банк ваш, флопа нет.</p> : null}
        {built.outcome === "fold" ? <p className="self-center text-sm text-muted">Вы сбросили. Раздача закрыта.</p> : null}
      </div>

      {built.outcome === "flop" ? (
        <StreetRow
          hole={hole}
          board={board}
          street={street}
          post={post}
          onCard={(index) => open(`b${index}` as SlotId)}
          active={queue[0] ?? ""}
          onStreet={(key, action) => setStreet((prev) => ({ ...prev, [key]: action }))}
        />
      ) : null}

      {typeof document !== "undefined" && queue.length > 0
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center"
              onPointerDown={() => {
                if (Date.now() - openedAt.current < 500) return;
                showQueue([]);
              }}
            >
              <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-3" onPointerDown={(event) => event.stopPropagation()}>
                <p className="text-sm font-medium">{slotTitle(queue[0]!)}</p>
                <div className="mt-2 max-h-[70vh] space-y-1 overflow-auto">
                  {RANKS.map((glyph) => {
                    const rank = RANK_CHARS.indexOf(glyph);
                    return (
                      <div key={glyph} className="grid grid-cols-4 gap-1">
                        {SUIT_GLYPHS.map((suitGlyph, suit) => {
                          const taken = [...hole, ...board].some((card) => card && card.rank === rank && card.suit === suit);
                          return (
                            <button
                              key={suitGlyph}
                              type="button"
                              disabled={taken}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!taken) chooseCard(rank, suit);
                              }}
                              className={cn("h-9 rounded-md bg-card-face font-mono text-sm font-semibold disabled:opacity-100", taken ? "ring-2 ring-yellow-400" : "", isRedSuit(suit) ? "text-suit-red" : "text-card-ink")}
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
            </div>,
            document.body,
          )
        : null}

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[auto_minmax(280px,1fr)]">
        <div className="w-full max-w-[440px]">
          {node ? <MixGrid compact range={node.range} selected={dealt || null} onPick={setKlass} bb={depth.chart} /> : <p className="text-sm text-muted">Рейндж появится, когда ход дойдёт до вас.</p>}
          {node ? <p className="mt-2 text-xs text-muted">В игре {continuePct(node.range, ALL).toFixed(1)}% рук. Один цвет — преобладающее действие. {node.exact ? `Чарт ${node.stackUsed}bb.` : `Приближение, ближайший чарт ${node.stackUsed}bb.`}</p> : null}
        </div>
        <div className="min-w-0 space-y-2 lg:sticky lg:top-3">
          <div className={cn("rounded-xl border p-4", advice && advice !== "fold" ? "border-ok" : "border-border")}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Решение солвера</p>
                <p className="mt-1 text-5xl font-semibold leading-none">{post?.word ?? word}</p>
                <p className="mt-2 text-lg font-medium">{post?.size ?? size}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Рука</p>
                <p className="font-mono text-3xl font-semibold leading-none">{dealt || "—"}</p>
                <p className="mt-1 text-xs text-muted">{depth.chart}bb чарт</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">{post?.why ?? (built.outcome === "win" ? "Все сбросили. Банк ваш, флопа нет." : built.outcome === "fold" ? "Вы сбросили. Раздача закрыта." : node ? `${node.title}. ${node.blurb}` : "Отметьте действия до вас слева направо. Карты — плюс слева, окно как в Spin&Go.")}</p>
          </div>
          {bluff && !post ? <BluffSound on={bluff.on} /> : null}
          {bluff && !post ? (
            <div className={cn("relative overflow-hidden rounded-xl border px-3 py-3", bluff.on ? "border-2 border-bluff bg-bluff/15" : "border-border bg-bg")}>
              {bluff.on ? <div className="bluff-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" /> : null}
              <p className={cn("text-[10px] font-medium tracking-[0.2em] uppercase", bluff.on ? "text-bluff" : "text-subtle")}>{bluff.on ? "Блеф берём" : "Блеф не берём"}</p>
              <p className={cn("mt-1 text-2xl font-semibold", bluff.on ? "text-bluff" : "")}>{bluff.on ? "Стил по чарту" : "Без блефа"}</p>
              <p className="mt-1 text-sm">{bluff.text}</p>
            </div>
          ) : null}
          {advice && !post ? (
            <div className="rounded-xl border border-border p-3 text-sm text-muted">
              <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Неш</p>
              <p className="mt-1">{nashLine(depth.bb, advice, node?.kind ?? "open")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildLine(pack: MttPack, spots: ReturnType<typeof spotsOf>, depth: number, chart: number, stacks: Stacks, hero: MttSeat, pick: Record<string, Act>, hand: string) {
  const cols: Col[] = [];
  let opener: MttSeat | null = null;
  let limp = false;
  let threeFrom: MttSeat | null = null;
  const idx = SEATS.indexOf(hero);

  const stop = (node: LiveNode | null, advice: MixAction | null, outcome: Outcome) => ({ cols, node, advice, outcome });

  for (const seat of SEATS.slice(0, idx)) {
    const facing = Boolean(opener);
    const actions = facing ? faceBtns(depth) : openBtns(seat, depth);
    const selected = pick[`pre:${seat}`] ?? "";
    cols.push({ key: `pre:${seat}`, seat, hero: false, title: seat === "UTG1" ? "UTG+1" : seat, chips: trim(stacks[seat]), actions, selected, wanted: "" });
    if (!selected) return stop(null, null, "pending");
    if ((selected === "raise" || selected === "allin") && !opener) opener = seat;
    else if (selected === "3bet" || (opener && selected === "allin")) threeFrom = seat;
    if (selected === "limp" && !opener) limp = true;
  }

  if (hero === "BB" && !opener && !limp && !threeFrom) return stop(null, null, "win");

  const facingKind = threeFrom ? "three" : opener ? "raise" : limp ? "limp" : "open";
  const node = resolveLive({
    pack,
    spots,
    stack: chart,
    hero,
    opener: threeFrom ? null : opener,
    limp: limp && !opener && !threeFrom,
    three: null,
    cold: Boolean(threeFrom),
  });
  const advice = hand ? playAction(node, hand, depth) : null;
  const wanted = advice ? asAct(advice, facingKind) : "";
  const heroSelected = pick.hero ?? "";
  cols.push({
    key: "hero",
    seat: hero,
    hero: true,
    title: "Вы · ваш ход",
    chips: trim(stacks[hero]),
    actions: heroBtns(hero, depth, facingKind),
    selected: heroSelected,
    wanted,
  });
  if (!heroSelected) return stop(node, advice, "pending");
  if (heroSelected === "fold") return stop(node, advice, "fold");

  if (!opener && !threeFrom && (heroSelected === "raise" || heroSelected === "allin" || heroSelected === "limp")) {
    let aggressor: MttSeat | null = null;
    let called = heroSelected === "limp";
    for (const seat of SEATS.slice(idx + 1)) {
      const selected = pick[`post:${seat}`] ?? "";
      cols.push({
        key: `post:${seat}`,
        seat,
        hero: false,
        title: seat === "UTG1" ? "UTG+1" : seat,
        chips: trim(stacks[seat]),
        actions: aggressor ? jamBtns(depth) : faceBtns(depth),
        selected,
        wanted: "",
      });
      if (!selected) return stop(node, advice, "pending");
      if (selected === "call" || selected === "limp") called = true;
      if (selected === "3bet" || selected === "allin") {
        aggressor = seat;
        break;
      }
    }
    if (!aggressor) return stop(node, advice, called ? "flop" : "win");
    const backNode = resolveLive({
      pack,
      spots,
      stack: chart,
      hero,
      opener: null,
      limp: false,
      three: aggressor === "SB" || aggressor === "BB" ? "blind" : "ip",
      cold: false,
    });
    const backAdvice = hand ? playAction(backNode, hand, depth) : null;
    const back = pick.back ?? "";
    cols.push({
      key: "back",
      seat: hero,
      hero: true,
      title: "Вы · на 3-бет",
      chips: trim(stacks[hero]),
      actions: jamBtns(depth),
      selected: back,
      wanted: backAdvice ? asAct(backAdvice, "three") : "",
    });
    if (!back) return stop(backNode, backAdvice, "pending");
    if (back === "fold") return stop(backNode, backAdvice, "fold");
    return stop(backNode, backAdvice, "flop");
  }

  if (opener && (heroSelected === "3bet" || heroSelected === "allin")) {
    const selected = pick[`ans:${opener}`] ?? "";
    cols.push({ key: `ans:${opener}`, seat: opener, hero: false, title: `${opener} · на 3-бет`, chips: trim(stacks[opener]), actions: jamBtns(depth), selected, wanted: "" });
    if (!selected) return stop(node, advice, "pending");
    if (selected === "fold") return stop(node, advice, "win");
    return stop(node, advice, "flop");
  }

  return stop(node, advice, "flop");
}

function openBtns(seat: MttSeat, stack: number): Btn[] {
  const raise = stack <= 20 ? "Raise 2" : "Raise 2.3";
  const jam = { id: "allin" as Act, label: `All-in ${stack}` };
  if (seat === "SB") return [{ id: "fold", label: "Fold" }, { id: "limp", label: "Limp" }, { id: "raise", label: raise }, jam];
  return [{ id: "fold", label: "Fold" }, { id: "raise", label: raise }, jam];
}

function faceBtns(stack: number): Btn[] {
  return [
    { id: "fold", label: "Fold" },
    { id: "call", label: "Call" },
    { id: "3bet", label: stack <= 20 ? "3-bet 6" : "3-bet 7.5" },
    { id: "allin", label: `All-in ${stack}` },
  ];
}

function jamBtns(stack: number): Btn[] {
  return [
    { id: "fold", label: "Fold" },
    { id: "call", label: "Call" },
    { id: "allin", label: `All-in ${stack}` },
  ];
}

function heroBtns(hero: MttSeat, stack: number, facing: string): Btn[] {
  if (facing === "three") return jamBtns(stack);
  if (facing === "limp") return [{ id: "call", label: "Check" }, { id: "raise", label: stack <= 20 ? "Raise 4" : "Raise 4.5" }, { id: "allin", label: `All-in ${stack}` }];
  if (facing === "raise") return faceBtns(stack);
  return openBtns(hero, stack);
}

function asAct(action: MixAction, facing: string): Act {
  if (action === "fold") return "fold";
  if (action === "allin") return "allin";
  if (action === "call") return "call";
  if (facing === "raise" || facing === "three") return "3bet";
  return "raise";
}

function ActionCol({ col, live, onPick }: { col: Col; live: boolean; onPick: (action: Act) => void }) {
  return (
    <div className={cn("w-[6.4rem] shrink-0 rounded-lg border p-1", col.hero ? "border-2 border-ok bg-ok/15 shadow-[0_0_0_3px] shadow-ok/25" : live ? "next-step border-ok bg-ok/10" : "border-border")}>
      <div className={cn("flex items-center justify-between rounded px-1 py-0.5 text-[11px] font-medium", col.hero ? "bg-ok text-bg" : col.seat === "SB" ? "bg-amber-800/80 text-amber-50" : col.seat === "BB" ? "bg-orange-900/80 text-orange-50" : "bg-zinc-700 text-zinc-50")}>
        <span>{col.title}</span>
        <span className="font-mono">{col.chips}</span>
      </div>
      <div className="mt-1 flex flex-col">
        {col.actions.map((action) => {
          const on = col.selected === action.id;
          const wanted = Boolean(col.wanted && action.id === col.wanted);
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onPick(action.id)}
              className={cn("rounded px-1 py-1 text-left text-xs", on ? "bg-fg font-medium text-bg" : wanted ? "bg-ok/20 font-semibold ring-2 ring-ok" : "text-muted")}
            >
              {action.label}
              {wanted && !on ? " · солвер" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardFace({ card, cue, active, onClick }: { card: Card | null; cue?: boolean; active: boolean; onClick: () => void }) {
  const red = card ? isRedSuit(card.suit) : false;
  return (
    <button type="button" onClick={onClick} className={cn("h-14 w-10 rounded-md border bg-card-face font-mono text-xs font-semibold", cue ? "next-step border-ok text-ok" : active ? "border-fg" : "border-transparent", card ? (red ? "text-suit-red" : "text-card-ink") : "")}>
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

function BluffSound({ on }: { on: boolean }) {
  const heard = useRef(false);
  useEffect(() => {
    if (on && !heard.current) playBluffSting();
    heard.current = on;
  }, [on]);
  return null;
}

function StreetBadge({ hole, board }: { hole: [Card, Card]; board: Card[] }) {
  if (board.length < 3) return null;
  const made = evaluateBest([...hole, ...board]);
  const name = MADE[made.category] ?? "";
  const draw = board.length < 5 ? analyzeDraws(hole, board) : null;
  const drawName = draw?.flushDraw ? "Флеш-дро" : draw?.oesd ? "Стрит-дро" : draw?.gutshot ? "Гатшот" : "";
  if (!name && !drawName) return null;
  const strong = made.category >= 1;
  return (
    <p className={cn("mt-1 rounded px-1.5 py-1 text-xs font-semibold leading-tight", strong ? "bg-ok text-bg" : "bg-zinc-700 text-zinc-50")}>
      {made.category > 0 ? name : "Старшая"}
      {drawName ? ` · ${drawName}` : ""}
    </p>
  );
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function slotTitle(slot: SlotId): string {
  if (slot === "h0") return "Ваши карты · первая";
  if (slot === "h1") return "Ваши карты · вторая";
  if (slot === "b0") return "Флоп · первая";
  if (slot === "b1") return "Флоп · вторая";
  if (slot === "b2") return "Флоп · третья";
  if (slot === "b3") return "Тёрн";
  return "Ривер";
}

function postAdvice(a: Card, b: Card, board: Card[], street: Record<string, Act>): { word: string; size: string; why: string } | null {
  if (board.length < 3) return { word: "Флоп", size: "Откройте три карты.", why: "Постфлоп считается по вашей руке и дро, не по префлоп-чарту." };
  const made = evaluateBest([a, b, ...board]);
  const draw = board.length < 5 ? analyzeDraws([a, b], board) : null;
  const name = MADE[made.category] ?? "рука";
  const strong = made.category >= 2;
  const pair = made.category >= 1;
  const drawName = draw?.flushDraw ? "флеш-дро" : draw?.oesd ? "стрит-дро" : draw?.gutshot ? "гатшот" : "";
  const streetName = board.length >= 5 ? "ривер" : board.length === 4 ? "тёрн" : "флоп";
  const opp = street[streetName] ?? "";
  if (!opp) return { word: "Ход соперника", size: "Отметьте чек или ставку.", why: `${name}${drawName ? `, ${drawName}` : ""}.` };
  if (opp === "raise" && !strong && !draw?.flushDraw && !draw?.oesd) {
    return { word: "Fold", size: "Фолд на ставку.", why: `${name} без сильного дро не защищается против ставки.` };
  }
  if (opp === "raise") return { word: strong ? "Raise" : "Call", size: strong ? "Рейз, это ценность." : "Колл.", why: `${name}${drawName ? `, ${drawName}` : ""}.` };
  if (pair || strong || draw?.flushDraw || draw?.oesd) return { word: "Bet 33%", size: "Ставка треть банка.", why: `${name}${drawName ? `, ${drawName}` : ""}. Чек сдаёт улицу.` };
  return { word: "Check", size: "Чек. Блеф на мультивее не ставим.", why: `${name}. Воздух без дро не блефуется.` };
}

function StreetRow({
  hole,
  board,
  street,
  post,
  onCard,
  active,
  onStreet,
}: {
  hole: [Card | null, Card | null];
  board: (Card | null)[];
  street: Record<string, Act>;
  post: { word: string; size: string; why: string } | null;
  onCard: (index: number) => void;
  active: string;
  onStreet: (key: string, action: Act) => void;
}) {
  const ready = Boolean(hole[0] && hole[1]);
  const names = [
    { id: "флоп", from: 0, count: 3 },
    { id: "тёрн", from: 3, count: 1 },
    { id: "ривер", from: 4, count: 1 },
  ];
  let open = ready;
  return (
    <div className="mt-3 space-y-2">
      {!ready ? <p className="text-sm text-ok">Дальше флоп. Сначала две ваши карты.</p> : null}
      {names.map((row) => {
        if (!open) return null;
        const cards = board.slice(row.from, row.from + row.count);
        const filled = cards.every(Boolean);
        const show = row.id === "флоп" || board.slice(0, row.from).every(Boolean);
        if (!show) return null;
        const node = (
          <div key={row.id} className="flex flex-wrap items-start gap-1">
            <div className={cn("rounded-lg border p-1", filled ? "border-border" : "next-step border-ok bg-ok/10")}>
              <p className="px-1 text-[11px] font-medium">{filled ? row.id : `Дальше · ${row.id}`}</p>
              <div className="mt-1 flex gap-1">
                {cards.map((card, index) => (
                  <CardFace key={row.from + index} card={card} cue={!card} active={active === `b${row.from + index}`} onClick={() => onCard(row.from + index)} />
                ))}
              </div>
              {filled && hole[0] && hole[1] ? <StreetBadge hole={[hole[0], hole[1]]} board={board.slice(0, row.from + row.count).filter((card): card is Card => Boolean(card))} /> : null}
            </div>
            {filled ? (
              <>
                <MiniCol title="Оппонент" actions={[{ id: "call", label: "Check" }, { id: "raise", label: "Bet" }]} selected={street[row.id] ?? ""} wanted="" onPick={(action) => onStreet(row.id, action)} />
                {street[row.id] ? (
                  <MiniCol
                    title="Вы · ваш ход"
                    hero
                    actions={[
                      { id: "fold", label: "Fold" },
                      { id: "call", label: post?.word === "Check" || post?.word === "Call" ? post.word : "Check" },
                      { id: "raise", label: post?.word.startsWith("Bet") || post?.word === "Raise" ? post.word : "Bet 33%" },
                    ]}
                    selected=""
                    wanted={postWanted(post)}
                    onPick={() => undefined}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        );
        if (!filled || !street[row.id] || street[row.id] === "fold") open = false;
        return node;
      })}
    </div>
  );
}

function postWanted(post: { word: string } | null): Act | "" {
  if (!post) return "";
  if (post.word === "Fold") return "fold";
  if (post.word === "Raise" || post.word.startsWith("Bet")) return "raise";
  return "call";
}

function MiniCol({ title, hero, actions, selected, wanted, onPick }: { title: string; hero?: boolean; actions: Btn[]; selected: Act | ""; wanted: Act | ""; onPick: (action: Act) => void }) {
  return (
    <div className={cn("w-[6.4rem] shrink-0 rounded-lg border p-1", hero ? "border-2 border-ok bg-ok/15" : "border-border")}>
      <div className={cn("rounded px-1 py-0.5 text-[11px] font-medium", hero ? "bg-ok text-bg" : "bg-zinc-700 text-zinc-50")}>{title}</div>
      <div className="mt-1 flex flex-col">
        {actions.map((action) => {
          const on = selected === action.id;
          const want = wanted && action.id === wanted;
          return (
            <button key={action.label} type="button" onClick={() => onPick(action.id)} className={cn("rounded px-1 py-1 text-left text-xs", on || want ? "bg-ok/20 font-semibold ring-2 ring-ok" : "text-muted")}>
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
