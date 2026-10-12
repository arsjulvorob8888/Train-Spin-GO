import { boardFromDump, boardKey, forgetTexas, loadTexas, parseTexasDump, rememberTexas, texasBoards, texasFor, texasHit, TEXAS_ENABLED, type TexBook } from "@/lib/spin-drill/texas-solver";
import type { Card } from "@/lib/poker/cards";
import { useEffect, useState } from "react";

export function TexasPanel({
  board,
  hole,
  toCall,
  pot,
  oop,
}: {
  board: Card[];
  hole: [Card, Card] | null;
  toCall: number | null;
  pot: number | null;
  oop: boolean;
}) {
  const [books, setBooks] = useState<TexBook[]>([]);
  const [error, setError] = useState("");
  const refresh = () => setBooks(texasBoards());
  useEffect(() => {
    void loadTexas().then(refresh);
  }, []);
  if (!TEXAS_ENABLED) return null;
  const ready = board.length >= 3;
  const book = ready ? texasFor(board) : null;
  const hit = book ? texasHit(book, board, hole, toCall, pot, oop) : null;
  const missed = hit && "miss" in hit ? hit.miss : "";
  const found = hit && !("miss" in hit) ? hit : null;

  async function load(file: File) {
    setError("");
    if (!ready) {
      setError("Сначала откройте флоп. Файл запомнится для этих карт.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError("Файл больше 40 МБ. В TexasSolver поставьте set_dump_rounds 1 и посчитайте заново.");
      return;
    }
    try {
      const dump = JSON.parse(await file.text()) as unknown;
      const root = parseTexasDump(dump);
      const cards = boardFromDump(dump) ?? boardKey(board);
      const id = [...cards].sort().join("|");
      await rememberTexas({ id, board: cards, root, at: Date.now(), name: file.name });
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Файл не прочитался.");
    }
  }

  return (
    <aside className="mt-3 w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium tracking-[0.14em] text-sky-200/80 uppercase">TexasSolver</p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-[11px] text-sky-100 underline">
            {books.length ? "Добавить борд" : "Загрузить output_result.json"}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void load(file);
              }}
            />
          </label>
          {book ? (
            <button
              type="button"
              className="text-[11px] text-sky-100 underline"
              onClick={() => {
                void forgetTexas(book.id).then(refresh);
                setError("");
              }}
            >
              Убрать этот борд
            </button>
          ) : null}
        </div>
      </div>
      {found ? (
        <>
          <p className="mt-1 text-2xl font-semibold leading-none text-sky-100">{found.action}</p>
          <p className="mt-1 text-xs text-sky-200/80">
            {found.board} · {found.where} · {found.name}
          </p>
          <p className="mt-1 text-sm leading-snug text-sky-50/90">{found.mix}. Это частота из файла, не из чарта. Кнопка чарта не меняется.</p>
        </>
      ) : (
        <p className="mt-1 text-sm leading-snug text-sky-100/80">
          {error ||
            missed ||
            (ready
              ? `Для ${boardKey(board).join(" ")} файла ещё нет. Загрузите его один раз: борд останется в браузере.`
              : "Откройте флоп. Уже загруженные борды подставятся сами.")}
        </p>
      )}
      <p className="mt-1 text-[11px] text-sky-200/70">
        Сохранено бордов: {books.length}. Повторно путь не нужен. На сервере солвер не считается: один борд занимает минуты.
        {book ? " Файл не хранит карты борда, он привязан к флопу, который был открыт при загрузке." : ""}
      </p>
    </aside>
  );
}
