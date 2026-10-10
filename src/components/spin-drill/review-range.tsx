import { MixGrid } from "@/components/spin-drill/mix-grid";
import { PipCard, type Face } from "@/components/spin-drill/pip-card";
import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { mixOf, type MixRange } from "@/lib/spin-drill/mix";
import { RANK_CHARS, SUIT_CHARS, handClass, tryParseCard, type Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";
import { cn } from "@/lib/utils";

const NAMES = ["Старшая", "Пара", "Две пары", "Сет", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш"];
const TONE = ["bg-zinc-600", "bg-emerald-800", "bg-emerald-600", "bg-teal-500", "bg-indigo-500", "bg-fuchsia-600", "bg-amber-500", "bg-orange-500", "bg-rose-500"];

function faces(text: string): Face[] {
  const out: Face[] = [];
  for (const token of text.split(/\s+/)) {
    const card = tryParseCard(token);
    if (!card) continue;
    out.push({ rank: RANK_CHARS[card.rank] ?? "?", suit: SUIT_CHARS[card.suit] ?? "s" });
  }
  return out;
}

function cardsOf(text: string): Card[] {
  return text
    .split(/\s+/)
    .map((token) => tryParseCard(token))
    .filter((card): card is Card => card != null);
}

function rankOf(char: string): number {
  return "23456789TJQKA".indexOf(char);
}

function combos(hand: string): Card[][] {
  const high = rankOf(hand[0] ?? "");
  const low = rankOf(hand[1] ?? "");
  if (high < 0 || low < 0) return [];
  const out: Card[][] = [];
  if (hand.length === 2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([{ rank: high, suit: a }, { rank: low, suit: b }]);
  } else if (hand[2] === "s") {
    for (let suit = 0; suit < 4; suit++) out.push([{ rank: high, suit }, { rank: low, suit }]);
  } else {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([{ rank: high, suit: a }, { rank: low, suit: b }]);
  }
  return out;
}

function dead(combo: Card[], used: Card[]): boolean {
  return combo.some((card) => used.some((other) => other.rank === card.rank && other.suit === card.suit));
}

type Cell = { hand: string; live: number; total: number; category: number; draw: boolean };

function streetCells(range: MixRange, board: Card[], hero: Card[]): { cells: Cell[]; counts: number[] } {
  const used = [...board, ...hero];
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const cells: Cell[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = handAt(row, col);
      const mix = mixOf(range, hand);
      const plays = (mix.raise || 0) + (mix.call || 0) + (mix.allin || 0) > 0;
      const all = plays ? combos(hand) : [];
      const live = all.filter((combo) => !dead(combo, used));
      let category = -1;
      let draw = false;
      for (const combo of live) {
        const made = evaluateBest([...combo, ...board]).category;
        if (made > category) category = made;
        if (board.length < 5 && made < 4) {
          const info = analyzeDraws(combo, board);
          if (info.flushDraw || info.oesd || info.gutshot) draw = true;
        }
      }
      if (category >= 0) counts[category] = (counts[category] ?? 0) + live.length;
      cells.push({ hand, live: live.length, total: all.length, category, draw });
    }
  }
  return { cells, counts };
}

export function HandReview({ hole, board, villains, range, heroHand }: { hole: string; board: string; villains: string; range: MixRange | null; heroHand: string }) {
  const mine = faces(hole);
  const street = faces(board);
  const foes = villains.split("·").map((pair) => faces(pair)).filter((pair) => pair.length > 0);
  const knownHero = cardsOf(hole);
  const knownBoard = cardsOf(board);
  const stages = [
    { title: "Префлоп", take: 0, text: "Чарт спота до карт борда. Обведена ваша рука." },
    { title: "Флоп", take: 3, text: "Фолды чарта вычеркнуты. Серым — комбинации, которые уже невозможны. Цвет — старшая рука, которую клетка ещё собирает." },
    { title: "Тёрн", take: 4, text: "Та же продолжающая часть чарта, но с новой картой. Дро либо закрылось, либо осталось." },
    { title: "Ривер", take: 5, text: "Финальный рейндж: только живые комбинации и готовые руки. Дро больше нет." },
  ].filter((stage) => stage.take === 0 || knownBoard.length >= stage.take);
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Карты</h2>
        <div className="mt-4 flex flex-wrap items-end gap-8">
          <div>
            <p className="mb-2 text-xs text-muted">Вы</p>
            <div className="flex items-end">
              <div className="-mr-5">{mine[0] ? <PipCard card={mine[0]} tilt={-8} /> : <PipCard />}</div>
              {mine[1] ? <PipCard card={mine[1]} tilt={8} /> : null}
            </div>
          </div>
          {street.length ? (
            <div>
              <p className="mb-2 text-xs text-muted">Борд</p>
              <div className="flex gap-1.5">
                {street.map((card, index) => (
                  <PipCard key={`${card.rank}${card.suit}${index}`} card={card} small />
                ))}
              </div>
            </div>
          ) : null}
          {foes.map((pair, index) => (
            <div key={index}>
              <p className="mb-2 text-xs text-muted">Соперник {index + 1}</p>
              <div className="flex gap-1.5">
                {pair.map((card, cardIndex) => (
                  <PipCard key={`${card.rank}${card.suit}${cardIndex}`} card={card} small />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {range ? (
        stages.map((stage) =>
          stage.take === 0 ? (
            <section key={stage.title} className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">{stage.title}</h2>
              <p className="mt-1 text-sm text-muted">{stage.text}</p>
              <div className="mt-3">
                <MixGrid range={range} selected={heroHand} compact />
              </div>
            </section>
          ) : (
            <StreetRange key={stage.title} title={stage.title} text={stage.text} range={range} board={knownBoard.slice(0, stage.take)} hero={knownHero} heroHand={heroHand} />
          ),
        )
      ) : (
        <p className="text-sm text-muted">Чарт этого спота не сохранился, рейндж по улицам не из чего собрать.</p>
      )}
    </div>
  );
}

function StreetRange({ title, text, range, board, hero, heroHand }: { title: string; text: string; range: MixRange; board: Card[]; hero: Card[]; heroHand: string }) {
  const { cells, counts } = streetCells(range, board, hero);
  const live = cells.reduce((sum, cell) => sum + cell.live, 0);
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{text}</p>
      <p className="mt-2 text-xs text-muted">Живых комбинаций: {live}. {NAMES.map((name, index) => (counts[index] ? `${name} ${counts[index]}` : "")).filter(Boolean).join(" · ")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {NAMES.map((name, index) => (
          <span key={name} className="inline-flex items-center gap-1 text-[10px] text-muted">
            <i className={cn("block h-2.5 w-2.5 rounded-sm", TONE[index])} />
            {name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <i className="block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Дро
        </span>
      </div>
      <div className="relative mt-3 grid grid-cols-13 gap-px">
        {cells.map((cell) => {
          const tone = cell.live === 0 ? "bg-zinc-900" : cell.category >= 1 ? TONE[cell.category] : cell.draw ? "bg-blue-500" : TONE[0];
          return (
            <div key={cell.hand} className={cn("relative aspect-square", tone, cell.hand === heroHand && "z-10 outline outline-2 outline-offset-1 outline-white", cell.live === 0 && "opacity-35")} title={cell.hand}>
              <span className="absolute bottom-0.5 left-0.5 font-mono text-[8px] font-bold leading-none text-white [text-shadow:0_1px_2px_#000]">{cell.hand.length > 2 ? cell.hand.slice(0, 2) : cell.hand}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
