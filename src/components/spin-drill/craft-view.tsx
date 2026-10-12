import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HandReview } from "@/components/spin-drill/review-range";
import { handClass, tryParseCard } from "@/lib/poker/cards";
import { findCraft, groupGames, handMoney, placeText, readBank, readCraft, removeCraft, removeSpins, setBankCash, trackHands, updateCraft, updateSpin, type BankBook, type CraftHand, type GameGroup } from "@/lib/spin-drill/craft";
import { mixOf, primary } from "@/lib/spin-drill/mix";
import { findSpot } from "@/lib/spin-drill/spots";
import { rangeAtStack } from "@/lib/spin-drill/stack-ranges";

function when(at: number): { day: string; time: string } {
  const date = new Date(at);
  return {
    day: date.toLocaleDateString("ru-RU"),
    time: date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function CraftTable() {
  const [hands, setHands] = useState<CraftHand[]>([]);
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [editId, setEditId] = useState("");
  useEffect(() => {
    setHands(readCraft());
  }, []);
  function reload(next?: CraftHand[]) {
    const rows = next ?? readCraft();
    setHands(rows);
    setPicked((ids) => ids.filter((id) => rows.some((hand) => hand.id === id)));
  }
  const shown = hands.filter((hand) => {
    if (filter === "50") return false;
    if (filter === "BTN" || filter === "SB" || filter === "BB") return hand.heroSeat === filter;
    if (filter === "15") return hand.bb <= 16;
    if (filter === "25") return hand.bb > 16 && hand.bb <= 25;
    return true;
  });
  const slice = filter === "50" ? hands.slice(0, 50) : shown;
  const track = trackHands(slice);
  const visibleIds = slice.map((hand) => hand.id);
  const allOn = visibleIds.length > 0 && visibleIds.every((id) => picked.includes(id));
  function drop(ids: string[]) {
    if (!ids.length) return;
    const word = ids.length === 1 ? "эту раздачу" : `${ids.length} раздач`;
    if (!window.confirm(`Удалить ${word} из журнала? Трекер пересчитается. Разбор тоже пропадёт.`)) return;
    removeCraft(ids);
    if (ids.includes(editId)) setEditId("");
    reload();
  }
  return (
    <div className="space-y-4">
      <BankRoll />
      <GameList
        hands={slice}
        showEmpty={filter === "all"}
        picked={picked}
        setPicked={setPicked}
        allOn={allOn}
        visibleIds={visibleIds}
        editId={editId}
        setEditId={setEditId}
        onDrop={drop}
        onReload={reload}
      />
      {hands.length ? (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Трекер</h2>
        <p className="mt-1 text-sm text-muted">Как PokerTracker по вашим раздачам: винрейт, фактические фишки и EV решения. ROI спина в долларах здесь нет — в архиве руки, а не финиш турнира.</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {[
            ["all", "Все"],
            ["50", "Последние 50"],
            ["BTN", "BTN"],
            ["SB", "SB"],
            ["BB", "BB"],
            ["15", "15bb"],
            ["25", "25bb"],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={filter === id ? "h-8 rounded-full bg-fg px-3 text-xs text-bg" : "h-8 rounded-full bg-surface-2 px-3 text-xs text-muted"}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat name="Winrate" value={num(track.winrate, "%")} hint={`${track.wins} из ${track.hands} раздач банк ваш. В спине мало: нужен перевес над соперниками, не 33%.`} />
          <Stat name="bb/100" value={signed(track.bb100)} hint={`Факт ${signed(track.net)} bb за выборку. Выигрыш — банк, который уже лежал. Проигрыш вскрытия — цена колла. Фолд — 0.`} />
          <Stat name="EV bb/100" value={signed(track.ev100)} hint={`Матожидание ${signed(track.ev)} bb. Колл заменён на эквити × (банк + колл) − колл. Так трекеры убирают удачу борда.`} />
          <Stat name="По чарту" value={num(track.match, "%")} hint="Доля рук, где ваше действие совпало с тем, что сказал солвер." />
          <Stat name="VPIP" value={num(track.vpip, "%")} hint="Как часто вы сами вложили фишки: лимп, колл, рейз или пуш. Блайнд не считается." />
          <Stat name="PFR" value={num(track.pfr, "%")} hint="Как часто рейз или олл-ин. Большой разрыв с VPIP — много лимпов и коллов." />
          <Stat name="WWSF" value={num(track.wwsf, "%")} hint="Won when saw flop: как часто забираете банк, если дошли до флопа." />
          <Stat name="W$SD" value={num(track.wsd, "%")} hint={`Вскрытие ${num(track.wtsd, "%")} рук, дошедших до флопа (WTSD). W$SD — сколько из вскрытий выиграли.`} />
        </div>
        <Curve points={track.curve} />
        <p className="mt-1 text-[11px] text-muted">Сплошная линия — факт, пунктир — EV. Ноль посредине. Рост вверх — плюс в больших блайндах.</p>
        {track.bySeat.length ? <Split title="По позиции" rows={track.bySeat} /> : null}
        {track.byStack.length ? <Split title="По стеку" rows={track.byStack} /> : null}
      </section>
      ) : null}
    </div>
  );
}

function GameList({
  hands,
  showEmpty,
  picked,
  setPicked,
  allOn,
  visibleIds,
  editId,
  setEditId,
  onDrop,
  onReload,
}: {
  hands: CraftHand[];
  showEmpty: boolean;
  picked: string[];
  setPicked: (ids: string[] | ((ids: string[]) => string[])) => void;
  allOn: boolean;
  visibleIds: string[];
  editId: string;
  setEditId: (id: string) => void;
  onDrop: (ids: string[]) => void;
  onReload: () => void;
}) {
  const [rows, setRows] = useState<GameGroup[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [marked, setMarked] = useState<string[]>([]);
  const [editGame, setEditGame] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const book = readBank();
    const grouped = groupGames(hands, book.spins);
    const next = showEmpty ? grouped : grouped.filter((row) => row.hands.length > 0);
    setRows(next);
    setMarked((ids) => ids.filter((id) => next.some((row) => row.id === id)));
  }, [hands, showEmpty, tick]);
  const gameIds = rows.map((row) => row.id);
  const gamesOn = gameIds.length > 0 && gameIds.every((id) => marked.includes(id));
  function dropGames(ids: string[]) {
    if (!ids.length) return;
    const word = ids.length === 1 ? "эту игру" : `${ids.length} игр`;
    if (!window.confirm(`Удалить ${word} из журнала? Деньги банка пересчитаются. Раздачи внутри закрытого спина тоже пропадут.`)) return;
    const open = rows.find((row) => row.id === "open");
    const spinIds = ids.filter((id) => id !== "open");
    if (spinIds.length) {
      const handIds = rows.filter((row) => spinIds.includes(row.id)).flatMap((row) => row.hands.map((hand) => hand.id));
      if (handIds.length) removeCraft(handIds);
      removeSpins(spinIds);
    }
    if (ids.includes("open") && open?.hands.length) removeCraft(open.hands.map((hand) => hand.id));
    setMarked([]);
    setEditGame("");
    setTick((value) => value + 1);
    onReload();
  }
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Игры</h2>
        <input type="checkbox" className="h-5 w-5 accent-orange-500" checked={gamesOn} aria-label="Выбрать все игры" onChange={() => setMarked(gamesOn ? [] : gameIds)} />
        <button type="button" disabled={!marked.length} onClick={() => dropGames(marked)} className="h-8 rounded-full bg-surface-2 px-3 text-xs text-fg disabled:opacity-40">
          Удалить игры{marked.length ? ` (${marked.length})` : ""}
        </button>
        <button type="button" disabled={!picked.length} onClick={() => onDrop(picked)} className="h-8 rounded-full bg-surface-2 px-3 text-xs text-fg disabled:opacity-40">
          Удалить раздачи{picked.length ? ` (${picked.length})` : ""}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Спинов пока нет. Закройте игру победой или поражением — она появится одной строкой, а раздачи откроются внутри.</p>
      ) : (
        <ul className="mt-3">
          {rows.map((row) => {
            const stamp = when(row.at);
            const open = openId === row.id;
            const multiple = row.buy != null && row.buy > 0 && row.prize != null ? Math.round(row.prize / row.buy) : null;
            const delta = row.won == null || row.buy == null || row.prize == null ? null : row.won ? row.prize - row.buy : -row.buy;
            return (
              <li key={row.id} className="border-t border-border">
                <div className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-orange-500"
                    checked={marked.includes(row.id)}
                    aria-label="Выбрать игру"
                    onChange={() => setMarked((ids) => (ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id]))}
                  />
                  <button type="button" onClick={() => setOpenId(open ? null : row.id)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left text-sm">
                    <span>
                      {stamp.day} {stamp.time}
                      {row.won == null ? " · спин не закрыт" : ` · ${row.won ? "выигрыш" : "проигрыш"}`}
                      {multiple != null ? ` · x${multiple}` : ""}
                      {row.buy != null ? ` · бай-ин $${row.buy}` : ""}
                      <span className="mt-0.5 block text-xs text-muted">{row.hands.length} раздач · нажмите, чтобы разобрать</span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-xs">
                      {delta == null ? "—" : `${delta > 0 ? "+" : ""}$${delta}`}
                      {row.cash != null ? <span className="mt-0.5 block text-muted">{money(row.cash)}</span> : null}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {row.won == null ? null : (
                      <button type="button" onClick={() => setEditGame(editGame === row.id ? "" : row.id)} className="h-7 rounded-full bg-surface-2 px-2 text-xs text-fg">
                        Изменить
                      </button>
                    )}
                    <button type="button" onClick={() => dropGames([row.id])} className="h-7 rounded-full bg-surface-2 px-2 text-xs text-fg">
                      Удалить
                    </button>
                  </div>
                </div>
                {editGame === row.id && row.won != null ? (
                  <div className="mb-2 ml-6 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { updateSpin(row.id, true); setEditGame(""); setTick((value) => value + 1); }} className="h-8 rounded-full bg-fg px-3 text-xs text-bg">
                      Это выигрыш
                    </button>
                    <button type="button" onClick={() => { updateSpin(row.id, false); setEditGame(""); setTick((value) => value + 1); }} className="h-8 rounded-full bg-surface-2 px-3 text-xs text-fg">
                      Это проигрыш
                    </button>
                  </div>
                ) : null}
                {open ? (
                  row.hands.length === 0 ? (
                    <p className="pb-2 text-xs text-muted">В этом спине раздачи не записаны.</p>
                  ) : (
                    <div className="overflow-x-auto pb-2">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-subtle">
                          <tr>
                            <th className="w-8 py-1 pr-2 font-medium">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-orange-500"
                                checked={allOn}
                                aria-label="Выбрать все на экране"
                                onChange={() => setPicked(allOn ? picked.filter((id) => !visibleIds.includes(id)) : [...new Set([...picked, ...visibleIds])])}
                              />
                            </th>
                            <th className="py-1 pr-3 font-medium">Раздача</th>
                            <th className="py-1 pr-3 font-medium">bb</th>
                            <th className="py-1 pr-3 font-medium">EV</th>
                            <th className="py-1 font-medium">Разбор</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.hands.map((hand) => {
                            const handStamp = when(hand.at);
                            const chips = handMoney(hand);
                            const editing = editId === hand.id;
                            return (
                              <tr key={hand.id} className="border-t border-border align-top">
                                <td className="py-2 pr-2">
                                  <input
                                    type="checkbox"
                                className="h-4 w-4 accent-orange-500"
                                    checked={picked.includes(hand.id)}
                                    aria-label="Выбрать раздачу"
                                    onChange={() => setPicked((ids) => (ids.includes(hand.id) ? ids.filter((id) => id !== hand.id) : [...ids, hand.id]))}
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  {handStamp.time} · {hand.heroSeat} · {hand.klass || hand.hole} · {hand.bb}bb
                                  <span className="mt-0.5 block text-xs text-muted">
                                    {hand.spotTitle} · {placeText(hand.result)}
                                    {hand.verdict ? ` · ${hand.verdict}` : ""}
                                  </span>
                                  {hand.note ? <span className="mt-0.5 block text-xs text-fg">{hand.note}</span> : null}
                                  {editing ? (
                                    <HandEdit
                                      hand={hand}
                                      onCancel={() => setEditId("")}
                                      onSave={(result, note) => {
                                        updateCraft(hand.id, { result, note });
                                        setEditId("");
                                        onReload();
                                      }}
                                    />
                                  ) : null}
                                </td>
                                <td className="py-2 pr-3 font-mono text-xs">{signed(chips.net)}</td>
                                <td className="py-2 pr-3 font-mono text-xs">{signed(chips.ev)}</td>
                                <td className="py-2">
                                  <div className="flex flex-col items-start gap-1">
                                    <Link to="/pokercraft/$id" params={{ id: hand.id }} className="text-sm underline">
                                      Открыть
                                    </Link>
                                    <button type="button" onClick={() => setEditId(editing ? "" : hand.id)} className="text-sm text-muted underline">
                                      Изменить
                                    </button>
                                    <button type="button" onClick={() => onDrop([hand.id])} className="text-sm text-muted underline">
                                      Удалить
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const RESULTS: { id: CraftHand["result"]; label: string }[] = [
  { id: "win", label: "Все сбросили" },
  { id: "hero", label: "Выиграл вскрытие" },
  { id: "villain", label: "Проиграл вскрытие" },
  { id: "split", label: "Ничья" },
  { id: "fold", label: "Фолд" },
  { id: "", label: "Не отмечено" },
];

function HandEdit({ hand, onSave, onCancel }: { hand: CraftHand; onSave: (result: CraftHand["result"], note: string) => void; onCancel: () => void }) {
  const [result, setResult] = useState<CraftHand["result"]>(hand.result);
  const [note, setNote] = useState(hand.note ?? "");
  return (
    <div className="mt-2 rounded-lg border border-border bg-bg p-2">
      <p className="text-[10px] uppercase tracking-wide text-subtle">Результат</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {RESULTS.map((item) => (
          <button key={item.label} type="button" onClick={() => setResult(item.id)} className={result === item.id ? "h-7 rounded-full bg-fg px-2 text-[11px] text-bg" : "h-7 rounded-full bg-surface-2 px-2 text-[11px] text-muted"}>
            {item.label}
          </button>
        ))}
      </div>
      <label className="mt-2 block text-[10px] uppercase tracking-wide text-subtle">
        Заметка
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Что поправить в этой руке" className="mt-1 h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg normal-case" />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => onSave(result, note.trim())} className="h-8 rounded-full bg-fg px-3 text-xs text-bg">
          Сохранить
        </button>
        <button type="button" onClick={onCancel} className="h-8 rounded-full bg-surface-2 px-3 text-xs text-muted">
          Отмена
        </button>
      </div>
    </div>
  );
}

function money(value: number): string {
  return `$${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BankRoll() {
  const [book, setBook] = useState<BankBook | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const sync = () => {
      const next = readBank();
      setBook(next);
      setDraft(next.cash.toFixed(2).replace(".", ","));
    };
    sync();
    window.addEventListener("spin-bank", sync);
    return () => window.removeEventListener("spin-bank", sync);
  }, []);
  if (!book) return null;
  const profit = Math.round((book.cash - book.anchor) * 100) / 100;
  const spent = book.spins.reduce((sum, spin) => sum + spin.buy, 0);
  const roi = spent > 0 ? Math.round(((book.cash - book.anchor) / spent) * 1000) / 10 : null;
  const wins = book.spins.filter((spin) => spin.won).length;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Банк</h2>
      <p className="mt-1 font-mono text-3xl font-semibold">{money(book.cash)}</p>
      <p className="mt-1 text-sm text-muted">
        Старт {money(book.anchor)} · профит {profit > 0 ? "+" : ""}
        {money(profit)} · спинов {book.spins.length} · побед {wins}
        {roi == null ? "" : ` · ROI ${roi}%`}
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cash = Number(draft.replace(",", ".").replace(/[^0-9.-]/g, ""));
          if (!Number.isFinite(cash)) return;
          setBankCash(cash);
          const next = readBank();
          setBook(next);
          setDraft(next.cash.toFixed(2).replace(".", ","));
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Банк, доллары" className="h-9 w-28 rounded-md border border-border bg-bg px-2 font-mono text-sm" />
        <button type="submit" className="h-9 rounded-full bg-fg px-3 text-xs text-bg">
          Записать банк
        </button>
      </form>
    </section>
  );
}

function num(value: number | null, suffix: string): string {
  if (value == null) return "—";
  return `${value}${suffix}`;
}

function signed(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value}`;
}

function Stat({ name, value, hint }: { name: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <p className="text-[10px] uppercase tracking-wide text-subtle">{name}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

function Split({ title, rows }: { title: string; rows: { label: string; hands: number; winrate: number | null; bb100: number | null; ev100: number | null }[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{title}</p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wide text-subtle">
            <tr>
              <th className="py-1 pr-3 font-medium">Срез</th>
              <th className="py-1 pr-3 font-medium">Рук</th>
              <th className="py-1 pr-3 font-medium">Winrate</th>
              <th className="py-1 pr-3 font-medium">bb/100</th>
              <th className="py-1 font-medium">EV bb/100</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-1 pr-3">{row.label}</td>
                <td className="py-1 pr-3 font-mono text-xs">{row.hands}</td>
                <td className="py-1 pr-3 font-mono text-xs">{num(row.winrate, "%")}</td>
                <td className="py-1 pr-3 font-mono text-xs">{signed(row.bb100)}</td>
                <td className="py-1 font-mono text-xs">{signed(row.ev100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Curve({ points }: { points: { net: number; ev: number }[] }) {
  if (points.length < 2) return <p className="mt-3 text-xs text-muted">График появится со второй раздачи.</p>;
  const values = points.flatMap((point) => [point.net, point.ev]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const width = 640;
  const height = 160;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / span) * (height - 12) - 6;
  const path = (key: "net" | "ev") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-40 w-full text-fg">
      <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.25" />
      <path d={path("ev")} fill="none" stroke="currentColor" strokeOpacity="0.55" strokeDasharray="5 4" />
      <path d={path("net")} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function CraftDetail({ id }: { id: string }) {
  const [hand, setHand] = useState<CraftHand | null | undefined>(undefined);
  useEffect(() => {
    setHand(findCraft(id));
  }, [id]);
  if (hand === undefined) return <main className="mx-auto max-w-3xl p-5 text-sm text-muted">Открываю разбор…</main>;
  if (!hand) {
    return (
      <main className="mx-auto max-w-3xl p-5">
        <p className="text-sm">Раздача не найдена в этом браузере.</p>
        <Link to="/" className="mt-3 inline-block text-sm underline">
          Назад к солверу
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl p-5">
      <Link to="/" className="text-sm text-muted underline">
        Назад к солверу
      </Link>
      <Report hand={hand} />
    </main>
  );
}

function Report({ hand }: { hand: CraftHand }) {
  const stamp = when(hand.at);
  const spot = findSpot(hand.spotId);
  const range = spot ? rangeAtStack(spot.range, spot.id, hand.bb) : null;
  const klass = heroClass(hand.hole) || hand.klass;
  const mix = range && klass ? mixOf(range, klass) : null;
  const chart = mix ? spot?.labels[primary(mix)] : "";
  const need = hand.need == null ? null : Math.round(hand.need * 100);
  const eq = hand.equity == null ? null : Math.round(hand.equity * 100);
  return (
    <article className="mt-4 space-y-4">
      <header>
        <p className="font-mono text-xs text-subtle">
          {stamp.day} · {stamp.time}
          {hand.prize != null ? ` · банк спина $${hand.prize}` : ""} · старт {hand.bb}bb
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {hand.heroSeat} · {hand.hole || hand.klass || "без карт"} · {placeText(hand.result)}
        </h1>
        <p className="mt-1 text-sm text-muted">{hand.spotTitle}</p>
        {hand.note ? <p className="mt-2 text-sm">{hand.note}</p> : null}
      </header>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Решение солвера</h2>
        <p className="mt-2 text-3xl font-semibold">{hand.verdict || "—"}</p>
        <p className="mt-2 text-sm leading-relaxed">{hand.text || "Солвер не успел посчитать эту руку."}</p>
        {mix ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Чарт {klass}: fold {Math.round(mix.fold)}% · call {Math.round(mix.call)}% · raise {Math.round(mix.raise)}% · all-in {Math.round(mix.allin)}%{chart ? ` · чаще всего ${chart}` : ""}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Fact title="Эквити против рейнджа" value={eq == null ? "—" : `${eq}%`} />
        <Fact title="Нужно на колл" value={need == null ? "ставки не было" : `${need}%`} />
        <Fact title="Банк / докинуть" value={`${hand.pot ?? "—"} / ${hand.toCall ?? "—"} bb`} />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">Пот-оддсы</h2>
        <p className="mt-2 text-muted">
          {need == null || eq == null
            ? "Цены колла не было: либо чек, либо раздача закрылась до ставки."
            : `Нужно ${need}% = докинуть / (банк + докинуть). У руки ${eq}%. ${eq + 1 >= need ? "Колл по шансам банка." : "Фолд: эквити не оплачивает ставку."}`}
        </p>
        <p className="mt-2 text-muted">Линия: {hand.line || "только префлоп"}.</p>
        {hand.board ? <p className="mt-1 text-muted">Борд: {hand.board}.</p> : null}
        {hand.made ? <p className="mt-1">Готовая рука: {hand.made}{hand.draw ? ` · ${hand.draw}` : ""}.</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">Блеф</h2>
        {hand.bluff ? (
          <>
            <p className="mt-2 font-medium">
              {hand.bluff.on ? hand.bluff.action : hand.bluff.title}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
              {hand.bluff.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-muted">Блеф на этой улице не считался.</p>
        )}
      </section>

      <HandReview hole={hand.hole} board={hand.board} villains={hand.villains} range={range} heroHand={klass} />

      <section className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">Вскрытие</h2>
        <p className="mt-2">Наши карты: {hand.hole || "—"}. Соперники: {hand.villains || "не показаны"}.</p>
        <p className="mt-2 text-muted">
          До вскрытия эквити {eq == null ? "не считалось" : `${eq}%`} против рейнджа. После открытых карт место: {placeText(hand.result)}.
          {hand.result === "hero" || hand.result === "win"
            ? " Выиграли, потому что на вскрытии рука старше или все сбросили."
            : hand.result === "villain"
              ? " Проиграли вскрытие: у соперника старше комбинация, чем давал средний рейндж."
              : hand.result === "fold"
                ? " Банк отдан без вскрытия."
                : hand.result === "split"
                  ? " Одинаковая комбинация, банк делится."
                  : " Победитель не отмечен."}
        </p>
      </section>
    </article>
  );
}

function heroClass(hole: string): string {
  const cards = hole
    .split(/\s+/)
    .map((token) => tryParseCard(token))
    .filter((card) => card != null);
  if (cards.length < 2) return "";
  return handClass(cards[0]!, cards[1]!);
}

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wide text-subtle">{title}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
    </div>
  );
}
