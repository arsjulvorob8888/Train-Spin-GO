import { handClass, partialShuffle, remainingDeck, type Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";
import { mixOf, primary, type MixAction, type MixRange } from "@/lib/spin-drill/mix";
import { findSpot } from "@/lib/spin-drill/spots";
import { rangeAtStack } from "@/lib/spin-drill/stack-ranges";

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

function villainCombos(spotId: string, bb: number, used: Set<string>): { combos: Combo[]; who: string; random: boolean } {
  const spec = VILLAIN[spotId] ?? { spotId, actions: ["call", "raise", "allin"] as MixAction[], who: "случайная рука" };
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

function likelyHands(combos: Combo[]): { hand: string; pct: number }[] {
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
    .sort((a, b) => strength(b[0]) - strength(a[0]))
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
}): { verdict: string; text: string } {
  const pct = Math.round(opts.equity * 100);
  if (opts.street !== "Префлоп") {
    const hand = opts.made ?? "старшая карта";
    const extra = opts.draw ? `, ${opts.draw}` : "";
    const dropped = `Префлоп-чарт этой руки (${opts.label}) здесь не действие: борд уже открыт.`;
    if (opts.need == null) {
      const strong = (opts.made != null && opts.made !== "старшая карта" && opts.made !== "пара") || opts.equity >= 0.62;
      if (strong) {
        return {
          verdict: "Ставка",
          text: `${opts.street}: ${hand}${extra}. Эквити ${pct}% против диапазона, который дошёл до борда. Ставь вэлью. ${dropped}`,
        };
      }
      if (opts.draw || opts.equity >= 0.38) {
        return {
          verdict: "Чек",
          text: `${opts.street}: ${hand}${extra}. Эквити ${pct}%. Без ставки оппонента чаще чек. ${dropped}`,
        };
      }
      return {
        verdict: "Чек",
        text: `${opts.street}: ${hand}${extra}. Эквити ${pct}%. Чек, блефовать без аутов нечем. ${dropped}`,
      };
    }
    const need = Math.round(opts.need * 100);
    if (opts.equity >= opts.need + 0.18 && opts.equity >= 0.55) {
      return {
        verdict: "Рейз",
        text: `${opts.street}: ${hand}${extra}. Нужно ${need}% на колл, у руки ${pct}%. Рейз вэлью. ${dropped}`,
      };
    }
    if (opts.equity + 0.01 >= opts.need) {
      return {
        verdict: "Колл",
        text: `${opts.street}: ${hand}${extra}. Нужно ${need}% на колл, у руки ${pct}%. Колл по шансам банка. ${dropped}`,
      };
    }
    return {
      verdict: "Фолд",
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
    call: "Колл оставляет банк. Чарт не хочет ставить сюда весь стек.",
    fold: "В рейндж входа эта рука не входит: её слишком часто доминируют.",
  };
  return {
    verdict: opts.label,
    text: `Префлоп. На ${opts.bb}bb чарт: ${opts.label}. Против диапазона «${opts.who}» у руки около ${pct}% банка. ${why[opts.action]}`,
  };
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
  iterations?: number;
}): Consult {
  const klass = handClass(opts.hero[0], opts.hero[1]);
  const mix = mixOf(opts.range, klass);
  const action = primary(mix);
  const used = new Set([...opts.hero, ...opts.board].map(keyOf));
  const villain = villainCombos(opts.spotId, opts.bb, used);
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
  } else {
    let total = 0;
    for (const combo of villain.combos) total += combo.w;
    for (let i = 0; i < iterations; i++) {
      let ticket = Math.random() * total;
      let combo = villain.combos[0]!;
      for (const item of villain.combos) {
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
  const auto = opts.board.length < 3 ? spotPrice(opts.spotId, opts.bb) : null;
  const userPrice =
    opts.toCall != null && opts.toCall > 0 && opts.pot != null && opts.pot >= 0
      ? opts.toCall / (opts.pot + opts.toCall)
      : null;
  const need = userPrice ?? (auto ? auto.toCall / (auto.pot + auto.toCall) : null);
  const draws = opts.board.length >= 3 ? analyzeDraws(opts.hero, opts.board) : null;
  const drawBits = [
    draws?.flushDraw ? "флеш-дро" : "",
    draws?.oesd ? "двусторонний стрит-дро" : "",
    draws?.gutshot && !draws.oesd ? "гатшот" : "",
    draws && draws.overcards > 0 ? `${draws.overcards} оверкарты` : "",
  ].filter(Boolean);
  const made =
    opts.board.length >= 3 ? CAT_RU[evaluateBest([...opts.hero, ...opts.board]).category] ?? null : null;
  const street = opts.board.length >= 5 ? "Ривер" : opts.board.length === 4 ? "Тёрн" : opts.board.length >= 3 ? "Флоп" : "Префлоп";
  const said = advice({
    action,
    label: opts.labels[action],
    equity,
    who: villain.who,
    bb: opts.bb,
    need,
    street,
    made,
    draw: drawBits.length ? drawBits.join(", ") : null,
  });

  return {
    klass,
    action,
    equity,
    win: win / iterations,
    tie: tie / iterations,
    who: villain.who,
    likely: villain.random ? [] : likelyHands(villain.combos),
    need,
    made,
    draw: drawBits.length ? drawBits.join(", ") : null,
    street,
    verdict: said.verdict,
    random: villain.random,
    text: said.text,
  };
}
