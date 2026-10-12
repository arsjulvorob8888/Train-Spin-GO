/** Heads-up postflop line. Equity versus the chart range, not a full GTO tree. */
export const HU_POSTFLOP_ENABLED = true;

export type HuPostflop = {
  action: string;
  line: string;
  why: string;
  agrees: boolean | null;
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function agrees(action: string, chart: string): boolean | null {
  const name = chart.toLowerCase();
  const mine = action.toLowerCase();
  if (mine.startsWith("fold") || mine.startsWith("фолд")) return /^fold$|^фолд$/.test(name);
  if (mine.startsWith("check") || mine.startsWith("чек")) return /check|чек/.test(name);
  if (mine.startsWith("call") || mine.startsWith("колл") || mine.startsWith("на грани")) return /call|колл/.test(name);
  if (mine.includes("all-in") || mine.includes("пуш")) return /all-in|пуш/.test(name);
  if (mine.startsWith("bet") || mine.startsWith("raise")) return /bet|raise|бет|рейз|ставь/.test(name);
  return null;
}

export function huPostflop(opts: {
  players: number;
  bb: number;
  street: string;
  equity: number;
  need: number | null;
  made: string | null;
  draw: string | null;
  chart: string;
  pot: number | null;
}): HuPostflop | null {
  if (!HU_POSTFLOP_ENABLED) return null;
  if (opts.street === "Префлоп") return null;
  if (opts.players > 2) {
    return {
      action: "Не этот спот",
      line: `${opts.street} · трое в банке`,
      why: "Встроенная линия считает только хедз-ап. Пока на улице трое, играйте чарт.",
      agrees: null,
    };
  }
  const equity = opts.equity;
  const need = opts.need != null && opts.need > 0 ? opts.need : null;
  const short = opts.bb <= 12;
  const draw = opts.draw ?? "";
  const semi = /флеш-дро|стрит-дро|гатшот/.test(draw);
  const made = opts.made ?? "";
  const strong = /сет|стрит|флеш|фулл|каре/.test(made);
  const size = (part: number) => {
    if (opts.pot == null || opts.pot <= 0) return "";
    const bet = Math.round(opts.pot * part * 10) / 10;
    return ` · ${bet}bb`;
  };

  if (need != null) {
    const edge = equity - need;
    let action = "Fold";
    if (short && (strong || equity >= 0.62)) action = "All-in";
    else if (edge >= -0.02) action = edge < 0.03 ? "На грани · Call" : "Call";
    const why =
      action === "Fold"
        ? `Эквити ${pct(equity)} ниже цены колла ${pct(need)}. Фолд.`
        : action === "All-in"
          ? `Стек ${Math.round(opts.bb)}bb, эквити ${pct(equity)} при цене ${pct(need)}. Короткий стек: пуш, а не маленький рейз.`
          : `Эквити ${pct(equity)}, для колла нужно ${pct(need)}. ${action.startsWith("На грани") ? "Разница маленькая." : "Колл по цене банка."}`;
    return { action, line: `${opts.street} · против ставки`, why: `${why} Это сравнение с диапазоном чарта, не готовое дерево солвера. Кнопка чарта не меняется.`, agrees: agrees(action, opts.chart) };
  }

  let action = "Check";
  if (short && (strong || equity >= 0.55)) action = "All-in";
  else if (strong || equity >= 0.68) action = `Bet 66%${size(0.66)}`;
  else if (equity >= 0.48 || semi) action = `Bet 33%${size(0.33)}`;
  const why =
    action === "Check"
      ? `Ставки нет. Эквити ${pct(equity)} против диапазона — мало для ставки${semi ? "" : ""}. Чек.`
      : action === "All-in"
        ? `Стек ${Math.round(opts.bb)}bb и эквити ${pct(equity)}. На таком стеке ставка и есть пуш.`
        : `Ставки нет. Эквити ${pct(equity)}${semi ? `, есть дро (${draw})` : ""}${strong ? `, готовая рука: ${made}` : ""}. Размер уже в действии.`;
  return {
    action,
    line: `${opts.street} · без ставки`,
    why: `${why} Считается в браузере по эквити, не внешним солвером. Кнопка чарта не меняется.`,
    agrees: agrees(action, opts.chart),
  };
}
