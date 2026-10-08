import { handClass, partialShuffle, remainingDeck, type Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";
import { mixOf, primary, type MixAction, type MixRange } from "@/lib/spin-drill/mix";
import { findSpot } from "@/lib/spin-drill/spots";
import { rangeAtStack } from "@/lib/spin-drill/stack-ranges";
import { facingPrice, lineNote, narrowSeat, openStreet, preflopAllin, seatsInHand, type Line, type Seat } from "@/lib/spin-drill/postflop-line";

const CAT_RU = [
  "старшая карта",
  "пара",
  "две пары",
  "сет",
  "стрит",
  "флеш",
  "фулл-хаус",
  "каре",
  "стрит-флеш",
];

type Spec = { spotId: string; actions: MixAction[]; who: string };

const VILLAIN: Record<string, Spec> = {
  btn: { spotId: "bb_vs_btn_raise", actions: ["call", "raise", "allin"], who: "BB, который не сбрасывает рейз" },
  btn_vs_3bet: { spotId: "bb_vs_btn_raise", actions: ["raise", "allin"], who: "блайнд в 3-бете" },
  btn_vs_jam: { spotId: "bb_vs_btn_raise", actions: ["allin"], who: "блайнд, который запушил" },
  sb_fold: { spotId: "bb_vs_sb_raise", actions: ["call", "raise", "allin"], who: "BB, который не сбрасывает" },
  sb_limp: { spotId: "btn", actions: ["call"], who: "баттон, который залимпил" },
  sb_raise: { spotId: "btn", actions: ["raise"], who: "баттон, открывший рейзом" },
  sb_push: { spotId: "btn", actions: ["allin"], who: "баттон, который запушил" },
  sb_iso: { spotId: "bb_vs_sb_limp", actions: ["raise", "allin"], who: "BB, который изолейтит лимп" },
  sb_vs_bb_jam: { spotId: "bb_vs_sb_limp", actions: ["allin"], who: "BB, который запушил против лимпа" },
  bb_vs_btn_raise: { spotId: "btn", actions: ["raise"], who: "баттон, открывший рейзом" },
  bb_vs_btn_jam: { spotId: "btn", actions: ["allin"], who: "баттон, который запушил" },
  bb_vs_btn_limp: { spotId: "btn", actions: ["call"], who: "баттон, который залимпил" },
  bb_vs_sb_limp: { spotId: "sb_fold", actions: ["call"], who: "SB, который залимпил" },
  bb_vs_sb_raise: { spotId: "sb_fold", actions: ["raise"], who: "SB, открывший рейзом" },
  bb_vs_sb_jam: { spotId: "sb_fold", actions: ["allin"], who: "SB, который запушил" },
  bb_squeeze: { spotId: "btn", actions: ["raise"], who: "баттон, открывший рейз" },
  bb_vs_reshove: { spotId: "sb_raise", actions: ["allin"], who: "SB, который репушит" },
  hu_sb: { spotId: "hu_bb_raise", actions: ["call", "raise", "allin"], who: "BB, который не сбрасывает" },
  hu_bb_limp: { spotId: "hu_sb", actions: ["call"], who: "SB, который залимпил" },
  hu_bb_raise: { spotId: "hu_sb", actions: ["raise"], who: "SB, открывший рейзом" },
  hu_bb_jam: { spotId: "hu_sb", actions: ["allin"], who: "SB, который запушил" },
};

type Combo = { a: Card; b: Card; w: number; klass: string };

function keyOf(card: Card): string {
  return `${card.rank}.${card.suit}`;
}

function blocked(card: Card, used: Set<string>): boolean {
  return used.has(keyOf(card));
}

function expand(klass: string, used: Set<string>): [Card, Card][] {
  const hi = "23456789TJQKA".indexOf(klass[0] ?? "");
  const lo = "23456789TJQKA".indexOf(klass[1] ?? "");
  if (hi < 0 || lo < 0) return [];
  const out: [Card, Card][] = [];
  if (klass.length === 2) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        const a = { rank: hi, suit: s1 };
        const b = { rank: lo, suit: s2 };
        if (!blocked(a, used) && !blocked(b, used)) out.push([a, b]);
      }
    }
    return out;
  }
  if (klass.endsWith("s")) {
    for (let suit = 0; suit < 4; suit++) {
      const a = { rank: hi, suit };
      const b = { rank: lo, suit };
      if (!blocked(a, used) && !blocked(b, used)) out.push([a, b]);
    }
    return out;
  }
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (s1 === s2) continue;
      const a = { rank: hi, suit: s1 };
      const b = { rank: lo, suit: s2 };
      if (!blocked(a, used) && !blocked(b, used)) out.push([a, b]);
    }
  }
  return out;
}

function villainSpec(spotId: string, live: Seat[], hero: Seat): Spec {
  const base = VILLAIN[spotId] ?? { spotId, actions: ["call", "raise", "allin"] as MixAction[], who: "случайная рука" };
  const left = live.filter((seat) => seat !== hero);
  if (left.length !== 1) return base;
  const only = left[0];
  if (spotId === "btn" && only === "SB") {
    return { spotId: "sb_raise", actions: ["call"], who: "SB, который заколлировал рейз. BB сбросил, остались двое. Рендж всё ещё 3-max, не хедз-ап" };
  }
  if (spotId === "btn" && only === "BB") {
    return { spotId: "bb_vs_btn_raise", actions: ["call"], who: "BB, который заколлировал рейз. SB сбросил, остались двое. Рендж всё ещё 3-max, не хедз-ап" };
  }
  if ((spotId === "sb_raise" || spotId === "sb_limp") && only === "BTN") {
    return { spotId: "btn", actions: spotId === "sb_limp" ? ["call"] : ["raise"], who: "BTN остался один против вас. BB сбросил. Рендж 3-max, не хедз-ап" };
  }
  if (spotId === "sb_push" && only === "BTN") {
    return { spotId: "btn", actions: ["allin"], who: "BTN в олл-ине. BB сбросил, остались двое. Рендж 3-max, не хедз-ап" };
  }
  return base;
}

function villainCombos(spotId: string, bb: number, used: Set<string>, live: Seat[], hero: Seat): { combos: Combo[]; who: string; random: boolean } {
  const spec = villainSpec(spotId, live, hero);
  const spot = findSpot(spec.spotId);
  const range = rangeAtStack(spot.range, spot.id, bb);
  const combos: Combo[] = [];
  for (const klass of Object.keys(range)) {
    const mix = mixOf(range, klass);
    const freq = spec.actions.reduce((sum, action) => sum + (mix[action] || 0), 0) / 100;
    if (freq <= 0) continue;
    for (const [a, b] of expand(klass, used)) combos.push({ a, b, w: freq, klass });
  }
  if (combos.length < 8) return { combos: [], who: "случайная рука", random: true };
  return { combos, who: spec.who, random: false };
}

function spotPrice(spotId: string, bb: number): { toCall: number; pot: number } | null {
  const stack = Math.max(1, bb);
  if (spotId === "bb_vs_btn_jam") return { toCall: Math.max(0.5, stack - 1), pot: stack + 1.5 };
  if (spotId === "bb_vs_sb_jam" || spotId === "hu_bb_jam") return { toCall: Math.max(0.5, stack - 1), pot: stack + 1 };
  if (spotId === "sb_push") return { toCall: Math.max(0.5, stack - 0.5), pot: stack + 1.5 };
  if (spotId === "btn_vs_jam" || spotId === "bb_vs_reshove" || spotId === "sb_vs_bb_jam") {
    return { toCall: Math.max(0.5, stack - 2), pot: stack + 3.5 };
  }
  if (spotId === "bb_vs_btn_raise" || spotId === "hu_bb_raise") return { toCall: 1, pot: 3.5 };
  if (spotId === "bb_vs_sb_raise") return { toCall: 1, pot: 3 };
  if (spotId === "sb_raise") return { toCall: 1.5, pot: 3.5 };
  if (spotId === "btn_vs_3bet") return { toCall: Math.max(1, Math.min(6, stack / 3)), pot: 7 };
  return null;
}

/** Raise size the chart assumes, in bb. Null when this spot has no single size. */
export function chartRaiseTo(spotId: string, bb: number): number | null {
  if (
    spotId === "hu_bb_jam" ||
    spotId === "bb_vs_sb_jam" ||
    spotId === "bb_vs_btn_jam" ||
    spotId === "sb_push" ||
    spotId === "btn_vs_jam" ||
    spotId === "bb_vs_reshove" ||
    spotId === "sb_vs_bb_jam" ||
    spotId === "bb_vs_limp_jam" ||
    spotId === "bb_vs_jam_call"
  ) {
    return bb;
  }
  if (spotId === "hu_bb_limp" || spotId === "bb_vs_sb_limp" || spotId === "bb_vs_btn_limp" || spotId === "sb_limp") return 1;
  if (spotId === "btn_vs_3bet") return Math.min(bb, Math.max(4, Math.round(bb / 3)));
  if (
    spotId === "hu_bb_raise" ||
    spotId === "bb_vs_btn_raise" ||
    spotId === "bb_vs_sb_raise" ||
    spotId === "sb_raise" ||
    spotId === "bb_vs_limp_iso" ||
    spotId === "sb_iso"
  ) {
    return spotId === "bb_vs_limp_iso" ? 4 : spotId === "sb_iso" ? 4 : 2;
  }
  return null;
}

/** Pot and the amount left to call when the opponent raised to `raiseTo` instead of the chart size. */
export function priceFromRaise(spotId: string, raiseTo: number): { toCall: number; pot: number } | null {
  const to = Math.round(raiseTo * 10) / 10;
  if (!(to > 0)) return null;
  const call = (posted: number, dead = 0) => {
    const toCall = Math.max(0, Math.round((to - posted) * 10) / 10);
    const pot = Math.round((to + posted + dead) * 10) / 10;
    return { toCall, pot };
  };
  if (spotId === "btn_vs_3bet" || spotId === "btn_vs_jam") return call(2, 1);
  if (spotId === "sb_raise" || spotId === "sb_push" || spotId === "sb_limp") return call(0.5, 1);
  if (spotId === "sb_iso" || spotId === "sb_vs_bb_jam") return call(1, 0);
  if (spotId === "bb_vs_reshove" || spotId === "bb_squeeze") return call(1, 2);
  if (spotId.startsWith("bb_vs_btn") || spotId === "bb_vs_limp_iso" || spotId === "bb_vs_limp_call" || spotId === "bb_vs_limp_jam") {
    return call(1, 0.5);
  }
  if (spotId.startsWith("bb_") || spotId.startsWith("hu_bb")) return call(1, 0);
  if (spotId === "hu_sb") return call(0.5, 1);
  return null;
}

export type Consult = {
  klass: string;
  action: MixAction;
  equity: number;
  win: number;
  tie: number;
  who: string;
  likely: { hand: string; pct: number }[];
  need: number | null;
  made: string | null;
  draw: string | null;
  text: string;
  street: "Префлоп" | "Флоп" | "Тёрн" | "Ривер";
  verdict: string;
  random: boolean;
};

function likelyHands(combos: Combo[], byWeight: boolean): { hand: string; pct: number }[] {
  const weight = new Map<string, number>();
  let total = 0;
  for (const combo of combos) {
    weight.set(combo.klass, (weight.get(combo.klass) ?? 0) + combo.w);
    total += combo.w;
  }
  const order = "23456789TJQKA";
  const strength = (klass: string) => {
    const hi = order.indexOf(klass[0] ?? "");
    const lo = order.indexOf(klass[1] ?? "");
    return (klass.length === 2 ? 400 : 0) + hi * 16 + lo + (klass.endsWith("s") ? 8 : 0);
  };
  return [...weight.entries()]
    .sort((a, b) => (byWeight ? b[1] - a[1] : strength(b[0]) - strength(a[0])))
    .slice(0, 6)
    .map(([hand, value]) => ({ hand, pct: total ? Math.round((value / total) * 100) : 0 }));
}

function advice(opts: {
  action: MixAction;
  label: string;
  equity: number;
  who: string;
  bb: number;
  need: number | null;
  street: "Префлоп" | "Флоп" | "Тёрн" | "Ривер";
  made: string | null;
  draw: string | null;
  facing: "none" | "bet" | "allin";
  aggressor: string;
  phase: "act" | "wait" | "done";
  waiting: string;
  customTo: number | null;
  customOff: boolean;
}): { verdict: string; text: string } {
  const pct = Math.round(opts.equity * 100);
  if (opts.customOff && opts.street === "Префлоп" && opts.need != null && opts.customTo != null) {
    const need = Math.round(opts.need * 100);
    const allin = opts.customTo >= opts.bb - 0.15;
    const pricedIn = opts.equity + 0.01 >= opts.need;
    const verdict = allin ? `All-in ${opts.bb}` : pricedIn && opts.equity >= opts.need + 0.18 && opts.equity >= 0.55 ? "Raise" : pricedIn ? "Call" : "Fold";
    return {
      verdict,
      text: `Оппонент поставил до ${opts.customTo}bb, это не размер чарта. Нужно ${need}% на колл, у руки ${pct}%. ${verdict}. Чарт на стандартный размер говорил: ${opts.label}.`,
    };
  }
  if (opts.street !== "Префлоп" && opts.phase === "wait") {
    const hand = opts.made ?? "старшая карта";
    return {
      verdict: `Ход ${opts.waiting}`,
      text: `${opts.street}: сейчас ходит ${opts.waiting}. Эквити ${pct}%, ${hand}${opts.draw ? `, ${opts.draw}` : ""}. Отметь его действие — совет для тебя пересчитается.`,
    };
  }
  if (opts.street !== "Префлоп" && opts.phase === "done") {
    const hand = opts.made ?? "старшая карта";
    const bare = hand === "старшая карта";
    if (opts.street === "Ривер") {
      return {
        verdict: bare ? "Нет пары" : hand.charAt(0).toUpperCase() + hand.slice(1),
        text: `Раздача закрыта. ${bare ? "Пары нет, осталась старшая карта." : `Комбинация: ${hand}.`} Эквити против диапазона было ${pct}%. Это итог, следующий ход уже не нужен.`,
      };
    }
    return {
      verdict: "Дальше",
      text: `${opts.street} закрыт. Сейчас ${bare ? "пары нет, старшая карта" : hand}${opts.draw ? `, ${opts.draw}` : ""}. Эквити ${pct}%. Открой следующую карту.`,
    };
  }
  if (opts.street !== "Префлоп") {
    const hand = opts.made ?? "старшая карта";
    const extra = opts.draw ? `, ${opts.draw}` : "";
    const bare = !opts.draw && (opts.made == null || opts.made === "старшая карта");
    const shape = bare ? "Пары и дро нет." : "";
    if (opts.facing !== "none") {
      const who = opts.facing === "allin" ? `${opts.aggressor} в олл-ине` : `${opts.aggressor} уже поставил`;
      const need = opts.need == null ? null : Math.round(opts.need * 100);
      if (opts.facing !== "allin" && opts.need != null && opts.equity >= opts.need + 0.18 && opts.equity >= 0.55) {
        return {
          verdict: "Raise",
          text: `${opts.street}: ${who}. ${hand}${extra}. ${shape} Нужно ${need}% на колл, у руки ${pct}%. Рейз вэлью.`,
        };
      }
      if (opts.need != null && opts.equity + 0.01 >= opts.need) {
        return {
          verdict: "Call",
          text: `${opts.street}: ${who}. ${hand}${extra}. ${shape} Нужно ${need}% на колл, у руки ${pct}%. Колл. Чек уже невозможен.`,
        };
      }
      return {
        verdict: "Fold",
        text: `${opts.street}: ${who}. ${hand}${extra}. ${shape} ${need == null ? "" : `Нужно ${need}% на колл, у руки ${pct}%. `}Фолд: в ответ на ставку чек невозможен.`,
      };
    }
    const dropped = `Префлоп-чарт этой руки (${opts.label}) здесь не действие: борд уже открыт.`;
    if (opts.need == null) {
      const monster = opts.made != null && opts.made !== "старшая карта" && opts.made !== "пара";
      const strong = monster || opts.equity >= 0.62;
      if (monster && opts.equity >= 0.7) {
        return {
          verdict: "All-in",
          text: `${opts.street}: ${hand}${extra}. Эквити ${pct}% против диапазона, который дошёл до борда. Стек короткий, вэлью — олл-ин. ${dropped}`,
        };
      }
      if (strong) {
        return {
          verdict: "Raise 4",
          text: `${opts.street}: ${hand}${extra}. Эквити ${pct}% против диапазона, который дошёл до борда. Вэлью — Raise 4. ${dropped}`,
        };
      }
      if (opts.equity >= 0.5) {
        return {
          verdict: "Raise 2",
          text: `${opts.street}: ${hand}${extra}. Эквити ${pct}%. Тонкое вэлью — Raise 2, не крупный рейз. ${dropped}`,
        };
      }
      return {
        verdict: "Check",
        text: `${opts.street}: ${hand}${extra}. Эквити ${pct}%. ${opts.draw ? "Дро есть, но без ставки оппонента чаще чек." : "Чек, ставить нечего."} ${dropped}`,
      };
    }
    const need = Math.round(opts.need * 100);
    if (opts.equity >= opts.need + 0.18 && opts.equity >= 0.55) {
      return {
        verdict: "Raise 4",
        text: `${opts.street}: ${hand}${extra}. Нужно ${need}% на колл, у руки ${pct}%. Вэлью — Raise 4. ${dropped}`,
      };
    }
    if (opts.equity + 0.01 >= opts.need) {
      return {
        verdict: "Call",
        text: `${opts.street}: ${hand}${extra}. Нужно ${need}% на колл, у руки ${pct}%. Колл по шансам банка. ${dropped}`,
      };
    }
    return {
      verdict: "Fold",
      text: `${opts.street}: ${hand}${extra}. Нужно ${need}% на колл, у руки ${pct}%. Фолд: эквити не оплачивает ставку. ${dropped}`,
    };
  }
  if (opts.need != null) {
    const need = Math.round(opts.need * 100);
    const pricedIn = opts.equity + 0.01 >= opts.need;
    const price = pricedIn
      ? `Цена колла ${need}%, у руки ${pct}%. Колл по шансам банка.`
      : `Цена колла ${need}%, у руки ${pct}%. По шансам банка это фолд.`;
    return {
      verdict: opts.label,
      text: `${price} Префлоп-чарт на ${opts.bb}bb: ${opts.label}. Если цифры расходятся, на коротком стеке верь чарту: в нём уже есть фолды оппонента и ICM.`,
    };
  }
  const why: Record<MixAction, string> = {
    allin: "Пуш забирает банк сразу, когда оппонент сбрасывает, и оставляет это эквити, когда коллирует.",
    raise: "Рейз меньше пуша: блайнды сбрасывают чаще, а рука ещё может играть флоп.",
    call: opts.label.startsWith("Check") ? "Check|FOLD: чек, если ставки нет, иначе фолд. В рейз эта рука не идёт." : "Колл оставляет банк. Чарт не хочет ставить сюда весь стек.",
    fold: "В рейндж входа эта рука не входит: её слишком часто доминируют.",
  };
  return {
    verdict: opts.label,
    text: `Префлоп. На ${opts.bb}bb чарт: ${opts.label}. Против диапазона «${opts.who}» у руки около ${pct}% банка. ${why[opts.action]}`,
  };
}

function overlaps(a: Combo, b: Combo): boolean {
  return (
    (a.a.rank === b.a.rank && a.a.suit === b.a.suit) ||
    (a.a.rank === b.b.rank && a.a.suit === b.b.suit) ||
    (a.b.rank === b.a.rank && a.b.suit === b.a.suit) ||
    (a.b.rank === b.b.rank && a.b.suit === b.b.suit)
  );
}

function pickCombo(combos: Combo[]): Combo {
  let total = 0;
  for (const combo of combos) total += combo.w;
  let ticket = Math.random() * total;
  for (const combo of combos) {
    ticket -= combo.w;
    if (ticket <= 0) return combo;
  }
  return combos[combos.length - 1]!;
}

export function consult(opts: {
  hero: [Card, Card];
  board: Card[];
  spotId: string;
  bb: number;
  range: MixRange;
  labels: Record<MixAction, string>;
  pot?: number | null;
  toCall?: number | null;
  line?: Line;
  heroSeat?: Seat;
  raiseTo?: number | null;
  out?: Seat[];
  iterations?: number;
}): Consult {
  const klass = handClass(opts.hero[0], opts.hero[1]);
  const mix = mixOf(opts.range, klass);
  const charted = findSpot(opts.spotId);
  const action = charted.actions.includes(primary(mix))
    ? primary(mix)
    : primary(mix) === "fold" && charted.actions.includes("call")
      ? "call"
      : primary(mix);
  const used = new Set([...opts.hero, ...opts.board].map(keyOf));
  const heroSeat = opts.heroSeat ?? "BTN";
  const order = seatsInHand(opts.spotId, opts.out ?? []);
  const villain = villainCombos(opts.spotId, opts.bb, used, order, heroSeat);
  const opponents = order.filter((seat) => seat !== heroSeat);
  const acted = opponents.filter((seat) =>
    opts.line ? (["flop", "turn", "river"] as const).some((street) => opts.line![street].some((act) => act.seat === seat)) : false,
  );
  const perSeat =
    opts.line && acted.length
      ? acted.map((seat) => ({ seat, combos: narrowSeat(villain.combos, opts.board, opts.line!, seat) }))
      : [];
  const combos = perSeat.length ? perSeat.flatMap((seat) => seat.combos) : villain.combos;
  const note = opts.line ? lineNote(opts.line) : "";
  const who = note && !villain.random ? `${villain.who}; ${note}` : villain.who;
  const iterations = opts.iterations ?? 1400;
  let win = 0;
  let tie = 0;
  let share = 0;
  const boardNeed = Math.max(0, 5 - opts.board.length);

  if (villain.random) {
    const deck = remainingDeck([...opts.hero, ...opts.board]);
    for (let i = 0; i < iterations; i++) {
      const pool = deck.slice();
      partialShuffle(pool, boardNeed + 2);
      const opp: Card[] = [pool[0]!, pool[1]!];
      const full = opts.board.concat(pool.slice(2, 2 + boardNeed));
      const heroScore = evaluateBest([...opts.hero, ...full]).score;
      const oppScore = evaluateBest([...opp, ...full]).score;
      if (heroScore > oppScore) {
        win += 1;
        share += 1;
      } else if (heroScore === oppScore) {
        tie += 1;
        share += 0.5;
      }
    }
  } else if (perSeat.length > 0) {
    const live = perSeat.filter((seat) => seat.combos.length > 0);
    for (let i = 0; i < iterations; i++) {
      const chosen: Combo[] = [];
      let blocked = false;
      for (const seat of live) {
        const pool = seat.combos.filter(
          (combo) => !chosen.some((taken) => overlaps(taken, combo)),
        );
        if (!pool.length) {
          blocked = true;
          break;
        }
        chosen.push(pickCombo(pool));
      }
      if (blocked || !chosen.length) continue;
      const dead = chosen.flatMap((combo) => [combo.a, combo.b]);
      const deck = remainingDeck([...opts.hero, ...opts.board, ...dead]);
      partialShuffle(deck, boardNeed);
      const full = opts.board.concat(deck.slice(0, boardNeed));
      const heroScore = evaluateBest([...opts.hero, ...full]).score;
      let best = heroScore;
      let winners = 1;
      for (const combo of chosen) {
        const score = evaluateBest([combo.a, combo.b, ...full]).score;
        if (score > best) {
          best = score;
          winners = 1;
        } else if (score === best) winners += 1;
      }
      if (heroScore === best && winners === 1) {
        win += 1;
        share += 1;
      } else if (heroScore === best) {
        tie += 1;
        share += 1 / winners;
      }
    }
  } else if (combos.length > 0) {
    let total = 0;
    for (const combo of combos) total += combo.w;
    for (let i = 0; i < iterations; i++) {
      let ticket = Math.random() * total;
      let combo = combos[0]!;
      for (const item of combos) {
        ticket -= item.w;
        if (ticket <= 0) {
          combo = item;
          break;
        }
      }
      const deck = remainingDeck([...opts.hero, ...opts.board, combo.a, combo.b]);
      partialShuffle(deck, boardNeed);
      const full = opts.board.concat(deck.slice(0, boardNeed));
      const heroScore = evaluateBest([...opts.hero, ...full]).score;
      const oppScore = evaluateBest([combo.a, combo.b, ...full]).score;
      if (heroScore > oppScore) {
        win += 1;
        share += 1;
      } else if (heroScore === oppScore) {
        tie += 1;
        share += 0.5;
      }
    }
  }

  const equity = share / iterations;
  const raiseTo = opts.raiseTo != null && opts.raiseTo > 0 ? opts.raiseTo : null;
  const chartTo = chartRaiseTo(opts.spotId, opts.bb);
  const customOff = raiseTo != null && chartTo != null && Math.abs(raiseTo - chartTo) > 0.2;
  const customPrice = raiseTo != null ? priceFromRaise(opts.spotId, raiseTo) : null;
  const auto = opts.board.length < 3 ? (customOff && customPrice ? customPrice : spotPrice(opts.spotId, opts.bb)) : null;
  const jammed = preflopAllin(opts.spotId);
  const open = opts.line && opts.board.length >= 3 ? openStreet(opts.line, opts.board.length, order, jammed) : null;
  const face =
    open && open.status.seat === heroSeat && open.status.facing && open.status.action && open.status.aggressor
      ? { street: open.street, seat: open.status.aggressor, action: open.status.action }
      : null;
  const priced = face ? facingPrice(face, heroSeat, opts.bb, opts.pot ?? null) : null;
  const userPrice =
    opts.toCall != null && opts.toCall > 0 && opts.pot != null && opts.pot >= 0
      ? opts.toCall / (opts.pot + opts.toCall)
      : null;
  const need = userPrice ?? (priced ? priced.toCall / (priced.pot + priced.toCall) : auto ? auto.toCall / (auto.pot + auto.toCall) : null);
  const facing = face ? (face.action === "allin" ? "allin" : "bet") : "none";
  const draws = opts.board.length >= 3 && opts.board.length < 5 ? analyzeDraws(opts.hero, opts.board) : null;
  const drawBits = [
    draws?.flushDraw ? "флеш-дро" : "",
    draws?.oesd ? "двусторонний стрит-дро" : "",
    draws?.gutshot && !draws.oesd ? "гатшот" : "",
    draws && draws.overcards > 0 ? `${draws.overcards} оверкарты` : "",
  ].filter(Boolean);
  const made =
    opts.board.length >= 3 ? CAT_RU[evaluateBest([...opts.hero, ...opts.board]).category] ?? null : null;
  const boardStreet = opts.board.length >= 5 ? "Ривер" : opts.board.length === 4 ? "Тёрн" : opts.board.length >= 3 ? "Флоп" : "Префлоп";
  const streetName = { flop: "Флоп", turn: "Тёрн", river: "Ривер" } as const;
  const street = open ? streetName[open.street] : boardStreet;
  const phase = open ? (open.status.seat === heroSeat ? "act" : "wait") : opts.board.length >= 3 ? "done" : "act";
  const said = advice({
    action,
    label: opts.labels[action],
    equity,
    who,
    bb: opts.bb,
    need,
    street,
    facing,
    aggressor: face?.seat ?? "",
    phase,
    waiting: open?.status.seat && open.status.seat !== heroSeat ? open.status.seat : "",
    made,
    draw: drawBits.length ? drawBits.join(", ") : null,
    customTo: customOff ? raiseTo : null,
    customOff,
  });

  return {
    klass,
    action,
    equity,
    win: win / iterations,
    tie: tie / iterations,
    who,
    likely: villain.random || combos.length === 0 ? [] : likelyHands(perSeat.length ? perSeat.flatMap((seat) => seat.combos.map((combo) => ({ ...combo, klass: `${seat.seat} ${combo.klass}` }))) : combos, Boolean(note)),
    need,
    made,
    draw: drawBits.length ? drawBits.join(", ") : null,
    street,
    verdict: said.verdict,
    random: villain.random,
    text: said.text,
  };
}
