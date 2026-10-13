import { emptyMix, primary, type Mix, type MixAction, type MixRange } from "@/lib/spin-drill/mix";
import { chartKey, type MttPack, type MttSpot } from "@/lib/mtt/charts";

export const SEATS = ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB", "BB"] as const;
export type MttSeat = (typeof SEATS)[number];

export type LiveKind = "walk" | "open" | "defend" | "limp" | "three" | "cold";

export type LiveNode = {
  kind: LiveKind;
  title: string;
  blurb: string;
  call: string;
  exact: boolean;
  stackUsed: number;
  range: MixRange;
};

const R = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

function pairs(from: string, to = "A"): string[] {
  const a = R.indexOf(to);
  const b = R.indexOf(from);
  const out: string[] = [];
  for (let i = a; i <= b; i++) out.push(`${R[i]}${R[i]}`);
  return out;
}

function suited(high: string, lows: string): string[] {
  return [...lows].map((low) => `${high}${low}s`);
}

function off(high: string, lows: string): string[] {
  return [...lows].map((low) => `${high}${low}o`);
}

function one(action: MixAction): Mix {
  const mix = emptyMix();
  mix[action] = 100;
  return mix;
}

function paint(raise: string[], call: string[] = [], allin: string[] = []): MixRange {
  const range: MixRange = {};
  for (const hand of raise) range[hand] = one("raise");
  for (const hand of call) range[hand] = one("call");
  for (const hand of allin) range[hand] = one("allin");
  return range;
}

export function dominantRange(range: MixRange): MixRange {
  const out: MixRange = {};
  for (const [hand, mix] of Object.entries(range)) {
    const action = primary(mix);
    if (action === "fold") continue;
    out[hand] = one(action);
  }
  return out;
}

export function chartOpenSize(stack: number): number {
  return stack <= 20 ? 2 : 2.3;
}

export function chartThreeSize(stack: number): number {
  return stack <= 20 ? 6 : 7.5;
}

function defendWider(hand: string): boolean {
  if (hand.length < 2) return false;
  if (hand.length === 2) return true;
  if (hand[2] === "s" || hand[0] === "A") return true;
  return "KQJT".includes(hand[0] ?? "") && "KQJT".includes(hand[1] ?? "");
}

function marginalCall(hand: string): boolean {
  if (hand.length === 2) return false;
  if (hand[0] === "A" && "KQJ".includes(hand[1] ?? "")) return false;
  if (hand.startsWith("KQ")) return false;
  if (hand[0] === "A" && hand[2] === "s") return false;
  return true;
}

/** Shift the chart action when the real raise is not the size the chart assumed. */
export function pricedAction(action: MixAction, hand: string, raiseTo: number | null, chartTo: number | null, stack: number): { action: MixAction; note: string } {
  if (!hand || raiseTo == null || chartTo == null || !(chartTo > 0)) return { action, note: "" };
  const to = Math.round(raiseTo * 10) / 10;
  const chart = Math.round(chartTo * 10) / 10;
  if (to >= stack * 0.7 && to < stack - 0.2) {
    if (action === "fold") return { action, note: `Рейз ${to}bb — почти пуш при стеке ${stack}bb. Чарт и так сбрасывает.` };
    if (!isValue(hand)) return { action: "fold", note: `Рейз ${to}bb — почти пуш. Колл только с сильной рукой, эта вне пуша.` };
    return { action: "allin", note: `Рейз ${to}bb оставляет мало фишек. Сильная рука идёт пушем, не коллом.` };
  }
  if (Math.abs(to - chart) < 0.4) return { action, note: "" };
  if (to <= chart - 0.4 && action === "fold" && defendWider(hand)) {
    return { action: "call", note: `Рейз ${to}bb меньше чартовых ${chart}bb. Колл дешевле, диапазон открытия шире. Эта рука уже платит.` };
  }
  if (to >= chart + 0.6 && action === "call" && marginalCall(hand)) {
    return { action: "fold", note: `Рейз ${to}bb больше чартовых ${chart}bb. Краевой колл чарта против такого размера — фолд.` };
  }
  if (to >= chart * 1.8 && action === "raise" && !isValue(hand)) {
    return { action: "fold", note: `Рейз ${to}bb почти вдвое больше чарта ${chart}bb. Тонкий 3-бет не ставим.` };
  }
  if (to > chart) return { action, note: `Рейз ${to}bb крупнее чарта ${chart}bb. Рука всё ещё в диапазоне.` };
  return { action, note: `Рейз ${to}bb мельче чарта ${chart}bb. Рука и так играется.` };
}

export function isValue(hand: string): boolean {
  if (hand.length === 2) return "AKQJT".includes(hand[0] ?? "");
  if (hand.startsWith("AK") || hand.startsWith("AQ")) return true;
  return hand.endsWith("s") && hand[0] === "A" && "KQJ".includes(hand[1] ?? "");
}

function bucket(seat: MttSeat): "EP" | "MP" | "CO" | "BTN" | "SB" | "BB" {
  if (seat === "UTG" || seat === "UTG1") return "EP";
  if (seat === "LJ" || seat === "HJ") return "MP";
  return seat;
}

function lookup(pack: MttPack, spots: MttSpot[], stack: number, id: string): { range: MixRange; used: number; exact: boolean; spot: MttSpot } | null {
  const spot = spots.find((item) => item.id === id);
  if (!spot) return null;
  const exact = spot.stacks.includes(stack);
  const used = exact ? stack : spot.stacks.reduce((best, item) => (Math.abs(item - stack) < Math.abs(best - stack) ? item : best));
  return { range: dominantRange(decodeHands(pack.charts[chartKey(used, spot)])), used, exact, spot };
}

function decodeHands(hands: Record<string, string> | undefined): MixRange {
  const range: MixRange = {};
  if (!hands) return range;
  for (const [hand, code] of Object.entries(hands)) {
    const mix = emptyMix();
    let used = 0;
    for (const part of code.match(/[arc]\d*/g) ?? []) {
      const key: MixAction = part[0] === "a" ? "allin" : part[0] === "r" ? "raise" : "call";
      const pct = part.length === 1 ? 100 : Number(part.slice(1));
      mix[key] = pct;
      used += pct;
    }
    mix.fold = Math.max(0, 100 - used);
    range[hand] = mix;
  }
  return range;
}

function bbDefend(opener: MttSeat, stack: number): MixRange {
  const early = opener === "UTG" || opener === "UTG1";
  const middle = opener === "LJ" || opener === "HJ" || opener === "CO";
  if (stack <= 12) {
    if (early) return paint([], [], [...pairs("7"), ...suited("A", "KQJ"), ...off("A", "KQ"), "KQs"]);
    if (middle) return paint([], [], [...pairs("5"), ...suited("A", "KQJT9"), ...off("A", "KQJT"), "KQs", "KJs"]);
    return paint([], [], [...pairs("2"), ...suited("A", "KQJT98765432"), ...off("A", "KQJT98"), ...suited("K", "QJT9"), ...off("K", "QJT"), ...suited("Q", "JT9"), "QJo", "J9s", "T9s", "98s"]);
  }
  if (early) {
    return paint([...pairs("J"), "AKs", "AKo"], [...pairs("9", "T"), "AQs", "AJs", "KQs", "AQo"]);
  }
  if (middle) {
    return paint([...pairs("T"), ...suited("A", "KQ"), "AKo", "AQo", "KQs"], [...pairs("7", "9"), "AJs", "ATs", "KJs", "QJs", "JTs", "AJo", "KQo"]);
  }
  if (opener === "BTN") {
    return paint(
      [...pairs("8"), ...suited("A", "KQJT"), ...off("A", "KQJ"), "KQs", "KJs"],
      [...pairs("2", "7"), ...suited("A", "98765432"), ...suited("K", "QJT9"), ...suited("Q", "JT9"), ...suited("J", "T9"), ...suited("T", "98"), "97s", "87s", ...off("A", "T9"), "KTo", "QTo", "JTo"],
    );
  }
  return paint(
    [...pairs("7"), ...suited("A", "KQJT98"), ...off("A", "KQJT"), ...suited("K", "QJT"), ...off("K", "QJ"), "QTs", "QJo", "JTs"],
    [...pairs("2", "6"), ...suited("A", "765432"), ...suited("K", "9876"), ...suited("Q", "987"), ...suited("J", "98"), ...suited("T", "98"), "97s", "86s", ...off("A", "987"), ...off("K", "T9"), ...off("Q", "T9"), "J9o", "T9o"],
  );
}

function inPositionDefend(stack: number): MixRange {
  if (stack <= 12) return paint([], [], [...pairs("5"), ...suited("A", "KQJT9"), ...off("A", "KQJT"), "KQs"]);
  return paint([...pairs("Q"), "AKs", "AKo"], [...pairs("2", "J"), ...suited("A", "KQJT"), ...off("A", "KQJ"), ...suited("K", "QJT"), "KQo", "QTs", "JTs", "T9s", "98s"]);
}

function sbDefend(stack: number): MixRange {
  if (stack <= 15) return paint([], [], [...pairs("7"), ...suited("A", "KQJT"), ...off("A", "KQ"), "KQs"]);
  return paint([...pairs("T"), "AQs", "AKs", "AKo", "AQo"], []);
}

export function resolveLive(opts: {
  pack: MttPack;
  spots: MttSpot[];
  stack: number;
  hero: MttSeat;
  opener: MttSeat | null;
  limp: boolean;
  three: "ip" | "blind" | null;
  cold: boolean;
}): LiveNode {
  const { pack, spots, stack, hero, opener, limp, three, cold } = opts;
  if (cold) {
    const found = hero === "BTN" || hero === "BB" ? lookup(pack, spots, stack, `vs-open:cold-${hero}`) : null;
    if (found) {
      return {
        kind: "cold",
        title: found.spot.title,
        blurb: found.exact ? found.spot.blurb : `Ближайший чарт ${found.used}bb. ${found.spot.blurb}`,
        call: "Call",
        exact: found.exact,
        stackUsed: found.used,
        range: found.range,
      };
    }
    return {
      kind: "cold",
      title: `${hero} против 3-бета`,
      blurb: "Холодный колл почти всегда фолд. Пуш только с сильной рукой.",
      call: "Call",
      exact: false,
      stackUsed: stack,
      range: paint([], [], [...pairs("T"), "AKs", "AKo", "AQs", "AQo"]),
    };
  }
  if (three) {
    const group = bucket(hero);
    const id =
      group === "EP"
        ? `vs-open:EPopen-vs-${three === "ip" ? "IP" : "blind"}3bet`
        : group === "MP" || group === "CO"
          ? `vs-open:MPopen-vs-${three === "ip" ? "IP" : "blind"}3bet`
          : hero === "BTN"
            ? "vs-open:BTNopen-vs-blind3bet"
            : hero === "SB"
              ? "vs-open:SBopen-vs-BB3bet"
              : "";
    const found = id ? lookup(pack, spots, stack, id) : null;
    if (found) {
      const approx = hero === "CO" || (hero === "BTN" && three === "ip");
      return {
        kind: "three",
        title: found.spot.title,
        blurb: approx
          ? "Точного узла нет, взят ближайший чарт 3-бета. Короткий стек: колл сильной руки становится пушем."
          : found.exact
            ? found.spot.blurb
            : `Ближайший чарт ${found.used}bb. ${found.spot.blurb}`,
        call: "Call",
        exact: found.exact && !approx,
        stackUsed: found.used,
        range: found.range,
      };
    }
  }
  if (limp && hero === "BB") {
    const found = lookup(pack, spots, stack, "vs-open:BB-vs-SBlimp");
    if (found) {
      return {
        kind: "limp",
        title: found.spot.title,
        blurb: found.exact ? found.spot.blurb : `Ближайший чарт ${found.used}bb. ${found.spot.blurb}`,
        call: "Check",
        exact: found.exact,
        stackUsed: found.used,
        range: found.range,
      };
    }
  }
  if (!opener && !limp && !three && !cold) {
    if (hero === "BB") {
      return { kind: "walk", title: "Все сбросили", blurb: "Банк ваш. Карты не нужны.", call: "Check", exact: true, stackUsed: stack, range: {} };
    }
    const found = lookup(pack, spots, stack, `rfi:${hero}`);
    if (found) {
      return {
        kind: "open",
        title: found.spot.title,
        blurb: found.spot.blurb,
        call: "Call",
        exact: true,
        stackUsed: stack,
        range: found.range,
      };
    }
  }
  if (opener) {
    const hb = bucket(hero);
    const ob = bucket(opener);
    const id =
      hb === "EP" && (ob === "MP" || ob === "CO")
        ? "vs-open:EP-vs-MP"
        : hb === "EP" && (ob === "BTN" || ob === "SB" || ob === "BB")
          ? `vs-open:EP-vs-${ob}`
          : hb === "MP" && (ob === "BTN" || ob === "SB" || ob === "BB")
            ? `vs-open:MP-vs-${ob}`
            : hero === "BTN" && (opener === "SB" || opener === "BB")
              ? `vs-open:BTN-vs-${opener}`
              : hero === "SB" && opener === "BB"
                ? "vs-open:SB-vs-BB"
                : "";
    const found = id ? lookup(pack, spots, stack, id) : null;
    if (found && hero !== "BB") {
      const approx = hb === "EP" && ob === "CO";
      return {
        kind: "defend",
        title: approx ? `${hero} против открытия ${opener}` : found.spot.title,
        blurb: approx ? `Точного чарта CO нет, взята защита против MP. Чартовый стек ${found.used}bb.` : found.exact ? found.spot.blurb : `Ближайший чарт ${found.used}bb. ${found.spot.blurb}`,
        call: "Call",
        exact: found.exact && !approx,
        stackUsed: found.used,
        range: found.range,
      };
    }
    if (hero === "BB") {
      return {
        kind: "defend",
        title: `BB против открытия ${opener}`,
        blurb: stack <= 12 ? "Короткий стек: пуш или фолд. Это рабочий Неш, в пакете нет BB против рейза." : "В пакете нет BB против рейза. Это рабочая защита: 3-бет ценностью, колл спекуляции, остальное фолд.",
        call: "Call",
        exact: false,
        stackUsed: stack,
        range: bbDefend(opener, stack),
      };
    }
    if (hero === "SB") {
      return {
        kind: "defend",
        title: `SB против открытия ${opener}`,
        blurb: "Точного чарта нет. С малого блайнда без позиции колл почти нет: рейз или фолд, короткий стек — пуш.",
        call: "Call",
        exact: false,
        stackUsed: stack,
        range: sbDefend(stack),
      };
    }
    return {
      kind: "defend",
      title: `${hero} против открытия ${opener}`,
      blurb: "Точного чарта на эту пару позиций нет. Взята рабочая защита в позиции: 3-бет сильным, колл средним.",
      call: "Call",
      exact: false,
      stackUsed: stack,
      range: inPositionDefend(stack),
    };
  }
  return { kind: "open", title: "Нет узла", blurb: "Для этой линии нет чарта. Сузьтесь до открытия или одного рейза.", call: "Call", exact: false, stackUsed: stack, range: {} };
}

export function playAction(node: LiveNode, hand: string, stack: number): MixAction {
  const mix = node.range[hand];
  let action: MixAction = mix ? primary(mix) : "fold";
  if (node.kind === "three" && stack <= 15 && action === "call") action = isValue(hand) ? "allin" : "fold";
  if (node.kind === "walk") action = "call";
  return action;
}

export function sizeLine(action: MixAction, stack: number, kind: LiveKind, call: string): string {
  if (kind === "walk") return "Ничего не ставьте. Банк уже ваш.";
  if (action === "fold") return "Fold. Не добирайте и не лимпите.";
  if (action === "allin") return `All-in ${stack}bb. Меньше не ставьте.`;
  if (action === "call") return call === "Check" ? "Check. Рейз только если клетка красная." : "Call. Без рейза.";
  if (kind === "open") return stack <= 20 ? "Raise 2bb." : "Raise 2.3bb.";
  if (kind === "three") return "4-бет: в позиции ×2.2 от 3-бета, без позиции — пуш, если стек короче 25bb.";
  if (kind === "limp") return stack <= 20 ? "Raise 4bb." : "Raise 4.5bb.";
  return stack <= 20 ? "3-бет до 6bb или пуш." : "3-бет: ×3 в позиции, ×4 без позиции.";
}

export function nashLine(stack: number, action: MixAction, kind: LiveKind): string {
  if (stack <= 15) {
    if (action === "allin") return "Неш этого стека — пуш. Минирейз отдаёт банк тем, кто сбросит, и оставляет вас без фишек, если колл.";
    if (action === "fold") return "Неш — фолд. Пуш этой руки на таком стеке минусовый: вас коллируют лучше.";
    if (action === "raise") return "Даже на коротком стеке чарт оставляет рейз, не пуш. Ставьте ровно указанный размер.";
    return "Колл на коротком стеке редок. Если рейз больше трети стека — лучше пуш или фолд.";
  }
  if (kind === "open" && action === "raise") return "Глубже 15bb равновесие — открытие маленьким рейзом, не пуш. Пуш сжигает руки, которые должны фолдить на 3-бет.";
  if (action === "allin") return "Пуш глубже 15bb только там, где клетка оранжевая. Остальные руки так не играйте.";
  return "Одно действие на руку. Смеси убраны: за столом играйте преобладающее.";
}

export function bluffLine(hand: string, action: MixAction, hero: MttSeat, kind: LiveKind): { on: boolean; text: string } | null {
  if (action !== "raise" && action !== "allin") {
    if (action === "fold" && (hero === "BTN" || hero === "CO" || hero === "SB") && kind === "open") {
      return { on: false, text: "Блеф не нужен. С этой позиции чарт уже стилит достаточно, эта рука за его краем." };
    }
    return { on: false, text: "Блеф не нужен. Чарт не ставит: либо колл по шансам, либо фолд." };
  }
  if (isValue(hand)) return { on: false, text: "Это ценность, не блеф. Ставьте тот же размер, что и блефом, чтобы размер не выдавал руку." };
  const late = hero === "CO" || hero === "BTN" || hero === "SB";
  if (kind === "open" && late) return { on: true, text: "Стил. Рука слабее, чем выглядит ставка: фолд эквити поздней позиции и есть причина рейза. Тот же размер, что у сильных рук." };
  if (kind === "defend" || kind === "three" || kind === "cold") return { on: true, text: "Блеф-рейз по чарту. Не увеличивайте размер и не ставьте вторую улицу без попадания: префлоп-блеф уже заложен в клетку." };
  return { on: true, text: "Чарт ставит эту руку как блеф или полублеф. Размер тот же, что у ценности." };
}
