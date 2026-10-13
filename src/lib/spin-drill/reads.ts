import { chartRaiseTo } from "@/lib/spin-drill/equity-calc";
import { readBlind, readCraft } from "@/lib/spin-drill/craft";
import type { MixAction } from "@/lib/spin-drill/mix";
import { openStreet, preflopAllin, seatsInHand, type Line, type LineAction, type Seat } from "@/lib/spin-drill/postflop-line";

export type Trick = {
  title: string;
  action: string;
  why: string;
  deviate: boolean;
};

export type Habits = {
  hands: number;
  foldedToUs: number;
  calledUs: number;
  limps: number;
};

const LIMP = new Set(["bb_vs_btn_limp", "bb_vs_sb_limp", "bb_vs_limp_call"]);
const OPEN = new Set(["btn", "sb_fold", "hu_sb"]);
const FACING = new Set(["btn_vs_3bet", "bb_vs_btn_raise", "bb_vs_sb_raise", "bb_squeeze", "sb_iso", "hu_bb_raise", "bb_vs_limp_iso"]);

export function spinHabits(): Habits {
  const id = readBlind()?.gameId;
  const empty = { hands: 0, foldedToUs: 0, calledUs: 0, limps: 0 };
  if (!id) return empty;
  const hands = readCraft().filter((hand) => hand.gameId === id);
  let foldedToUs = 0;
  let calledUs = 0;
  let limps = 0;
  for (const hand of hands) {
    const played = (hand.played ?? "").toLowerCase();
    const aggr = played.startsWith("raise") || played.startsWith("all-in") || played === "allin";
    if (aggr && hand.result === "win") foldedToUs += 1;
    if (aggr && (hand.result === "hero" || hand.result === "villain" || hand.result === "split")) calledUs += 1;
    if (hand.spotId === "sb_limp" || hand.spotId.startsWith("bb_vs_btn_limp") || hand.spotId === "bb_vs_sb_limp" || hand.spotId.startsWith("bb_vs_limp")) limps += 1;
  }
  return { hands: hands.length, foldedToUs, calledUs, limps };
}

function isoCandidate(klass: string): boolean {
  if (klass.length < 2) return false;
  if (klass.length === 2) return true;
  const hi = klass[0]!;
  const lo = klass[1]!;
  const suited = klass[2] === "s";
  const gap = "AKQJT98765432".indexOf(hi) - "AKQJT98765432".indexOf(lo);
  if (gap < 1) return false;
  if (suited && (hi === "A" || hi === "K" || hi === "Q" || gap <= 3)) return true;
  if (hi === "A" && "KQJT".includes(lo)) return true;
  return "KQJT".includes(hi) && "KQJT".includes(lo);
}

function defendCandidate(klass: string): boolean {
  return isoCandidate(klass) || klass[2] === "s" || klass[0] === "A";
}

function marginal(klass: string): boolean {
  if (klass.length === 2) return false;
  if (klass[0] === "A" && "KQJ".includes(klass[1]!) ) return false;
  if (klass.startsWith("KQ")) return false;
  if (klass[0] === "A" && klass[2] === "s") return false;
  return true;
}

function checkRaised(line: Line, street: "flop" | "turn" | "river", hero: Seat): boolean {
  const seen = new Map<Seat, LineAction[]>();
  for (const act of line[street]) {
    if (act.seat === hero) continue;
    const list = seen.get(act.seat) ?? [];
    list.push(act.action);
    seen.set(act.seat, list);
  }
  for (const list of seen.values()) {
    if (list.includes("check") && (list.includes("raise") || list.includes("allin"))) return true;
  }
  return false;
}

export function tableRead(opts: {
  spotId: string;
  hero: Seat;
  klass: string;
  chart: MixAction;
  chartLabel: string;
  verdict: string;
  bluff: boolean;
  raiseTo: number | null;
  bb: number;
  street: string;
  made: string | null;
  draw: string | null;
  line: Line;
  boardLength: number;
  habits: Habits;
}): Trick | null {
  const chart = opts.chart;
  const sticky = opts.habits.calledUs >= 3 && opts.habits.foldedToUs <= 1;
  const overfold = opts.habits.foldedToUs >= 3 && opts.habits.calledUs === 0;
  const order = seatsInHand(opts.spotId);
  const open = opts.boardLength >= 3 ? openStreet(opts.line, opts.boardLength, order, preflopAllin(opts.spotId)) : null;
  const face = open?.status.facing ? open.status.action : null;
  const streetId = open?.street ?? null;
  const raised = streetId ? checkRaised(opts.line, streetId, opts.hero) : false;
  const pair = opts.made === "пара";
  const strongDraw = Boolean(opts.draw && (opts.draw.includes("флеш-дро") || opts.draw.includes("двусторонний")));
  const air = !opts.made || opts.made === "старшая карта";

  if (opts.street !== "Префлоп" && face && (raised || face === "betpot" || face === "allin") && pair && !strongDraw && opts.verdict.toLowerCase().startsWith("call")) {
    return {
      title: raised ? "Чек-рейз — сила" : "Крупная ставка — сила",
      action: "Fold",
      deviate: true,
      why: raised
        ? "На $0.25–$5 чек-рейз почти никогда не блеф: две пары, сет или монстр-дро. Одна пара без своего дро сдаётся."
        : "Пот и олл-ин на этих лимитах ставят с рукой. Одна пара без дро не обязана платить. Чарт звал колл — здесь фолд дешевле.",
    };
  }

  if (opts.street !== "Префлоп" && face === "bet33" && (pair || opts.draw) && opts.verdict.toLowerCase() === "fold") {
    return {
      title: "Мелкая ставка — слабая рука",
      action: "Call",
      deviate: true,
      why: "Треть банка на микролимитах чаще проба или дро, не монстр. Пару и дро не сбрасывайте: цена маленькая, диапазон шире чарта.",
    };
  }

  if (sticky && (opts.bluff || (opts.street !== "Префлоп" && !face && air && /raise|став|блеф/i.test(opts.verdict)))) {
    return {
      title: "Этот стол коллирует",
      action: "Check",
      deviate: true,
      why: `В спине на ваш рейз уже дошли до вскрытия ${opts.habits.calledUs} раз и сбросили ${opts.habits.foldedToUs}. Блеф против них в минусе. Чек.`,
    };
  }

  if (LIMP.has(opts.spotId)) {
    if ((chart === "fold" || chart === "call") && isoCandidate(opts.klass)) {
      return {
        title: "Лимп — не ловушка",
        action: "Raise",
        deviate: true,
        why: "На $0.25–$5 лимп почти никогда не AA и не KK. Рука играется против слабого диапазона: изо, не чек и не фолд. Чарт здесь сдаёт банк бесплатно.",
      };
    }
    if (chart === "raise" || chart === "allin") {
      return {
        title: "Лимп слабый",
        action: opts.chartLabel,
        deviate: false,
        why: "Лимп на этих лимитах капнут. Чарт уже изолирует — не коллируйте вплоскую, берите рейз с кнопки.",
      };
    }
  }

  const chartTo = chartRaiseTo(opts.spotId, opts.bb);
  if (FACING.has(opts.spotId) && opts.raiseTo != null && chartTo != null && opts.raiseTo < opts.bb - 0.2) {
    if (opts.raiseTo <= chartTo - 0.4 && chart === "fold" && defendCandidate(opts.klass)) {
      return {
        title: "Минирейз шире чарта",
        action: "Call",
        deviate: true,
        why: `Рейз ${trim(opts.raiseTo)}bb меньше чартовых ${trim(chartTo)}bb. Так открываются шире, а колл дешевле. Рука, которую чарт сбрасывает против обычного рейза, здесь колл.`,
      };
    }
    if (opts.raiseTo >= chartTo + 0.6 && chart === "call" && marginal(opts.klass)) {
      return {
        title: "Крупный рейз — сильнее",
        action: "Fold",
        deviate: true,
        why: `Рейз ${trim(opts.raiseTo)}bb больше чартовых ${trim(chartTo)}bb. Крупный размер на микролимитах сужает диапазон. Краевая рука чарта больше не обязана платить.`,
      };
    }
  }

  if (overfold && OPEN.has(opts.spotId) && chart === "fold" && isoCandidate(opts.klass)) {
    return {
      title: "В этом спине фолдят стил",
      action: "Raise",
      deviate: true,
      why: `На ваш рейз уже ${opts.habits.foldedToUs} фолда и ни одного колла. Следующий стил шире чарта: эта рука забирает блайнды чаще, чем должна по рейнджу.`,
    };
  }

  if (opts.habits.hands >= 3 && (overfold || sticky || opts.habits.limps >= 2)) {
    const bit = overfold
      ? `фолдят на рейз (${opts.habits.foldedToUs} из ${opts.habits.foldedToUs + opts.habits.calledUs})`
      : sticky
        ? `коллируют (${opts.habits.calledUs} вскрытия)`
        : `лимпят (${opts.habits.limps})`;
    return {
      title: "Заметки по столу",
      action: opts.chartLabel,
      deviate: false,
      why: `Этот спин: ${bit}. Ход чарта не меняю — выборки ещё мало для другой кнопки, но линию уже видно.`,
    };
  }

  return null;
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}
