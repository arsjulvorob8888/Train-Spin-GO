import { useEffect, useMemo, useState } from "react";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { RANK_CHARS, SUIT_GLYPHS, handClass, isRedSuit, type Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";
import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { continuePct, type MixAction } from "@/lib/spin-drill/mix";
import { actionWord, spotsOf, type MttPack } from "@/lib/mtt/charts";
import { bluffLine, nashLine, playAction, resolveLive, SEATS, sizeLine, type LiveNode, type MttSeat } from "@/lib/mtt/live";
import { cn } from "@/lib/utils";

type Act = "fold" | "limp" | "raise" | "call" | "3bet" | "allin";
type Btn = { id: Act; label: string };
type Col = { key: string; seat: MttSeat; hero: boolean; title: string; actions: Btn[]; selected: Act | ""; wanted: Act | "" };
type Outcome = "pending" | "fold" | "win" | "flop";

const MADE = ["старшая карта", "пара", "две пары", "сет", "стрит", "флеш", "фулл-хаус", "каре", "стрит-флеш"];

export function MttDesk() {
  const [pack, setPack] = useState<MttPack | null>(null);
  const [error, setError] = useState("");
  const [stack, setStack] = useState(30);
  const [hero, setHero] = useState<MttSeat>("UTG");
  const [pick, setPick] = useState<Record<string, Act>>({});
  const [klass, setKlass] = useState("");
  const [hole, setHole] = useState<[Card | null, Card | null]>([null, null]);
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [slot, setSlot] = useState("");
  const [street, setStreet] = useState<Record<string, Act>>({});

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
  const dealt = hole[0] && hole[1] ? handClass(hole[0], hole[1]) : klass;
  const built = pack ? buildLine(pack, spots, stack, hero, pick, dealt) : null;

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
    setPick({});
    setKlass("");
    setHole([null, null]);
    setBoard([null, null, null, null, null]);
    setSlot("");
    setStreet({});
  }

  function put(card: Card) {
    if (slot === "h0" || slot === "h1") {
      const copy: [Card | null, Card | null] = [...hole];
      copy[slot === "h0" ? 0 : 1] = card;
      setHole(copy);
      setSlot(slot === "h0" && !copy[1] ? "h1" : "");
      return;
    }
    if (slot.startsWith("b")) {
      const copy = [...board];
      copy[Number(slot.slice(1))] = card;
      setBoard(copy);
      setSlot("");
    }
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!pack || !built) return <p className="text-sm text-muted">Загружаю MTT 8-max…</p>;

  const node = built.node;
  const advice = built.advice;
  const word = built.outcome === "win" ? "Банк ваш" : advice ? actionWord(advice, node?.call ?? "Call") : "Ждём";
  const size = built.outcome === "win" ? "Флопа нет." : built.outcome === "fold" ? "Карты дальше не открывайте." : node && advice ? sizeLine(advice, stack, node.kind, node.call) : "Сначала ходы до вас. Флоп откроется, только если раздача идёт дальше.";
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
        <span className="ml-auto grid h-11 min-w-[4.5rem] place-items-center rounded-xl border-2 border-ok bg-ok/15 px-2">
          <span className="text-[9px] font-medium uppercase leading-none text-ok">Эфф.</span>
          <span className="font-mono text-lg font-semibold leading-none">{stack}</span>
        </span>
        <button type="button" onClick={nextHand} className="h-11 rounded-full bg-ok px-4 text-sm font-semibold text-bg">
          Новая раздача
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {pack.stacks.map((item) => (
          <button key={item} type="button" onClick={() => setStack(item)} className={cn("h-7 rounded-full px-2 font-mono text-[11px]", item === stack ? "bg-zinc-600 text-zinc-100" : "bg-zinc-900 text-zinc-500")}>
            {item}bb
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-1">
        <div className="shrink-0 rounded-lg border border-border p-1">
          <p className="px-1 text-[11px] font-medium">Вы</p>
          <div className="mt-1 flex gap-1">
            {[0, 1].map((index) => (
              <CardFace key={index} card={hole[index] ?? null} cue={!hole[index]} active={slot === `h${index}`} onClick={() => setSlot(slot === `h${index}` ? "" : `h${index}`)} />
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
          onCard={(index) => setSlot(slot === `b${index}` ? "" : `b${index}`)}
          active={slot}
          onStreet={(key, action) => setStreet((prev) => ({ ...prev, [key]: action }))}
        />
      ) : null}

      {slot ? <CardPicker used={[...hole, ...board]} onPick={put} /> : null}

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[auto_minmax(280px,1fr)]">
        <div className="w-full max-w-[440px]">
          {node ? <MixGrid compact range={node.range} selected={dealt || null} onPick={setKlass} bb={stack} /> : <p className="text-sm text-muted">Рейндж появится, когда ход дойдёт до вас.</p>}
          {node ? <p className="mt-2 text-xs text-muted">В игре {continuePct(node.range, ALL).toFixed(1)}% рук. Один цвет — преобладающее действие. {node.exact ? `Чарт ${node.stackUsed}bb.` : `Приближение, ближайший чарт ${node.stackUsed}bb.`}</p> : null}
        </div>
        <div className="min-w-0 space-y-2 lg:sticky lg:top-3">
          <div className={cn("rounded-xl border p-4", advice && advice !== "fold" ? "border-ok" : "border-border")}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Решение солвера</p>
            <p className="mt-1 text-5xl font-semibold leading-none">{post?.word ?? word}</p>
            <p className="mt-2 text-lg font-medium">{post?.size ?? size}</p>
            <p className="mt-2 text-sm text-muted">{post?.why ?? (built.outcome === "win" ? "Все сбросили. Банк ваш, флопа нет." : built.outcome === "fold" ? "Вы сбросили. Раздача закрыта." : node ? `${node.title}. ${node.blurb}` : "Отметьте действия до вас слева направо.")}</p>
            {dealt ? <p className="mt-1 text-xs text-muted">Префлоп · {dealt}</p> : <p className="mt-1 text-xs text-muted">Нажмите клетку рейнджа или введите карты.</p>}
          </div>
          {bluff && !post ? (
            <div className={cn("rounded-xl border p-3 text-sm", bluff.on ? "border-amber-400/70 bg-amber-400/10" : "border-border text-muted")}>
              <p className="text-[10px] font-medium uppercase tracking-wide">{bluff.on ? "Блеф" : "Почему не блеф"}</p>
              <p className="mt-1">{bluff.text}</p>
            </div>
          ) : null}
          {advice && !post ? (
            <div className="rounded-xl border border-border p-3 text-sm text-muted">
              <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Неш</p>
              <p className="mt-1">{nashLine(stack, advice, node?.kind ?? "open")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildLine(pack: MttPack, spots: ReturnType<typeof spotsOf>, stack: number, hero: MttSeat, pick: Record<string, Act>, hand: string) {
  const cols: Col[] = [];
  let opener: MttSeat | null = null;
  let limp = false;
  let threeFrom: MttSeat | null = null;
  const idx = SEATS.indexOf(hero);

  const stop = (node: LiveNode | null, advice: MixAction | null, outcome: Outcome) => ({ cols, node, advice, outcome });

  for (const seat of SEATS.slice(0, idx)) {
    const facing = Boolean(opener);
    const actions = facing ? faceBtns(stack) : openBtns(seat, stack);
    const selected = pick[`pre:${seat}`] ?? "";
    cols.push({ key: `pre:${seat}`, seat, hero: false, title: seat === "UTG1" ? "UTG+1" : seat, actions, selected, wanted: "" });
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
    stack,
    hero,
    opener: threeFrom ? null : opener,
    limp: limp && !opener && !threeFrom,
    three: null,
    cold: Boolean(threeFrom),
  });
  const advice = hand ? playAction(node, hand, stack) : null;
  const wanted = advice ? asAct(advice, facingKind) : "";
  const heroSelected = pick.hero ?? "";
  cols.push({
    key: "hero",
    seat: hero,
    hero: true,
    title: "Вы · ваш ход",
    actions: heroBtns(hero, stack, facingKind),
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
        actions: aggressor ? jamBtns(stack) : faceBtns(stack),
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
      stack,
      hero,
      opener: null,
      limp: false,
      three: aggressor === "SB" || aggressor === "BB" ? "blind" : "ip",
      cold: false,
    });
    const backAdvice = hand ? playAction(backNode, hand, stack) : null;
    const back = pick.back ?? "";
    cols.push({
      key: "back",
      seat: hero,
      hero: true,
      title: "Вы · на 3-бет",
      actions: jamBtns(stack),
      selected: back,
      wanted: backAdvice ? asAct(backAdvice, "three") : "",
    });
    if (!back) return stop(backNode, backAdvice, "pending");
    if (back === "fold") return stop(backNode, backAdvice, "fold");
    return stop(backNode, backAdvice, "flop");
  }

  if (opener && (heroSelected === "3bet" || heroSelected === "allin")) {
    const selected = pick[`ans:${opener}`] ?? "";
    cols.push({ key: `ans:${opener}`, seat: opener, hero: false, title: `${opener} · на 3-бет`, actions: jamBtns(stack), selected, wanted: "" });
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
      <div className={cn("rounded px-1 py-0.5 text-[11px] font-medium", col.hero ? "bg-ok text-bg" : col.seat === "SB" ? "bg-amber-800/80 text-amber-50" : col.seat === "BB" ? "bg-orange-900/80 text-orange-50" : "bg-zinc-700 text-zinc-50")}>
        {col.title}
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

function CardPicker({ used, onPick }: { used: (Card | null)[]; onPick: (card: Card) => void }) {
  const taken = (rank: number, suit: number) => used.some((card) => card && card.rank === rank && card.suit === suit);
  return (
    <div className="mt-2 space-y-1">
      {[0, 1, 2, 3].map((suit) => (
        <div key={suit} className="flex flex-wrap gap-1">
          {Array.from({ length: 13 }, (_, index) => 12 - index).map((rank) => {
            const dead = taken(rank, suit);
            return (
              <button key={`${rank}${suit}`} type="button" disabled={dead} onClick={() => onPick({ rank, suit })} className={cn("h-8 w-8 rounded font-mono text-[11px]", dead ? "opacity-20" : isRedSuit(suit) ? "bg-surface-2 text-suit-red" : "bg-surface-2 text-fg")}>
                {RANK_CHARS[rank] === "T" ? "10" : RANK_CHARS[rank]}
                {SUIT_GLYPHS[suit]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
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
