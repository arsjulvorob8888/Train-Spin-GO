/** Rough mental anchors — not a solver. Good enough to estimate at the table. */

export type AnchorRow = {
  hands: string[];
  label: string;
  equity: string;
  note: string;
};

export type AnchorGroup = {
  id: string;
  title: string;
  /** Spot ids where this table is the one to show under the cards. */
  spots: string[];
  versus: string;
  blurb: string;
  rows: AnchorRow[];
};

export const EQUITY_GROUPS: AnchorGroup[] = [
  {
    id: "vs-btn-jam",
    title: "Твоя рука против пуша 15bb с баттона",
    spots: ["sb_push", "bb_vs_btn_jam"],
    versus: "Широкий олл-ин BTN: пары, много тузов, бродвей, часть одномастных",
    blurb:
      "Колл такого пуша из блайнда требует примерно 46–48% эквити. Ниже — фолд, даже если рука выглядит знакомо. Цифры грубые: для решения за столом, не для солвера.",
    rows: [
      { hands: ["AA", "KK"], label: "AA / KK", equity: "80%+", note: "Сильный фаворит. Колл без раздумий." },
      { hands: ["QQ"], label: "QQ", equity: "~70–75%", note: "Всё ещё впереди широкого пуша." },
      { hands: ["JJ"], label: "JJ", equity: "~62–66%", note: "Уверенный колл." },
      { hands: ["TT", "99"], label: "TT / 99", equity: "~55–60%", note: "Колл. Часть ренджа — оверкарты, это флипы." },
      { hands: ["88", "77", "66"], label: "88–66", equity: "~52–55%", note: "Чуть впереди. Колл." },
      { hands: ["55", "44", "33", "22"], label: "55–22", equity: "~50%", note: "Часто флип против AK/AQ. На границе колла, 22 обычно колл." },
      { hands: ["AKs", "AKo"], label: "AK", equity: "~60–65%", note: "Колл. Одномастная ближе к 65%, разномастная к 60%." },
      { hands: ["AQs", "AQo"], label: "AQ", equity: "~55%", note: "Колл." },
      { hands: ["AJs", "AJo"], label: "AJ", equity: "~50%", note: "Тонкий колл: как раз около нужных 46–48%." },
      { hands: ["ATs"], label: "ATs", equity: "~45–48%", note: "На самой границе." },
      { hands: ["ATo"], label: "ATo", equity: "~41–44%", note: "Обычно мало. Фолд против пуша 15bb." },
      { hands: ["A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o"], label: "A9o и слабее", equity: "~38–42%", note: "Слабее ATo. Фолд." },
      { hands: ["KQs"], label: "KQs", equity: "~48%", note: "Граница. Одномастность чуть помогает." },
      { hands: ["KQo"], label: "KQo", equity: "~45%", note: "Чуть ниже нужного. Чаще фолд." },
      { hands: ["KJo", "KJs", "QJs", "QJo"], label: "KJ / QJ", equity: "~40–44%", note: "Фолд против широкого пуша 15bb." },
      { hands: ["76s", "65s", "87s", "98s", "54s"], label: "76s и похожие", equity: "~35–38%", note: "Мало эквити. Фолд, если нет очень хорошей цены." },
    ],
  },
  {
    id: "pairs",
    title: "Пары — самые частые споры",
    spots: [],
    versus: "Одна конкретная рука, не весь диапазон",
    blurb:
      "Когда виллана уже сузил до «скорее всего оверкарты или пара», хватает этих якорей. Пара против двух оверкарт — почти монетка, старшая рука чуть позади.",
    rows: [
      { hands: ["AA"], label: "AA", equity: "~82–87%", note: "Против KK ~82%, против AK ~87%, против 22 ~80%." },
      { hands: ["KK"], label: "KK", equity: "~70–82%", note: "Против QQ ~82%. Против AK только ~70%: у туза есть оверкарта." },
      { hands: ["QQ", "JJ"], label: "QQ / JJ", equity: "~57% vs AK", note: "Пара чуть впереди двух оверкарт. Против младшей пары всё ещё ~80%." },
      { hands: ["TT", "99", "88", "77", "66", "55", "44", "33", "22"], label: "TT–22 vs AK", equity: "~52–55%", note: "Флип. Пара — небольшой фаворит, не монетка 50/50 и не 70%." },
    ],
  },
  {
    id: "domination",
    title: "Тузы, бродвей и одномастные",
    spots: [],
    versus: "Одна конкретная рука",
    blurb: "Доминирование бьёт сильнее, чем «просто две оверкарты». Одномастность — это не отдельная стратегия, а +2–4%.",
    rows: [
      { hands: ["AKs", "AKo"], label: "AK", equity: "~70% vs AQ", note: "Против AQ ~70–74%. Против 76s ~62–65%. Против 22 ты позади: у пары ~52–55%." },
      { hands: ["AQs", "AQo"], label: "AQ", equity: "~55% vs пуш", note: "Против AJ ~70%. Против AK ты доминирован: остаётся ~26–30%." },
      { hands: ["AJs", "AJo"], label: "AJ", equity: "~50% vs пуш", note: "Против AT ещё впереди. Против AK/AQ — позади." },
      { hands: ["KQs", "KQo"], label: "KQ", equity: "~45% vs пуш", note: "Против AK ~28%. Делит короля и почти всегда хуже." },
      { hands: ["76s", "65s", "87s", "98s", "54s"], label: "76s", equity: "~35–38%", note: "Против AK и против широкого пуша. Не колл 15bb." },
      { hands: ["A5s", "A4s", "A3s", "A2s"], label: "A5s–A2s", equity: "+2–4% к разномастной", note: "Одномастность — небольшая прибавка, не повод коллировать слабый туз в пуш." },
    ],
  },
];

function rowHits(row: AnchorRow, hand: string): boolean {
  return row.hands.includes(hand);
}

export type EquityHint = {
  title: string;
  equity: string;
  note: string;
  versus: string;
};

/** Best one-line estimate for the hand that just arrived. */
export function equityHint(hand: string | null, spotId: string): EquityHint | null {
  if (!hand) return null;
  const spotGroup = EQUITY_GROUPS.find((g) => g.spots.includes(spotId));
  if (spotGroup) {
    const row = spotGroup.rows.find((r) => rowHits(r, hand));
    if (row) {
      return { title: spotGroup.title, equity: row.equity, note: row.note, versus: spotGroup.versus };
    }
  }
  for (const group of EQUITY_GROUPS) {
    if (group.spots.length) continue;
    const row = group.rows.find((r) => rowHits(r, hand));
    if (row) {
      return { title: group.title, equity: row.equity, note: row.note, versus: group.versus };
    }
  }
  return null;
}
