import { parseTexasDump, readTexas, texasHit, TEXAS_ENABLED, writeTexas, boardKey, type TexBook } from "@/lib/spin-drill/texas-solver";
import type { Card } from "@/lib/poker/cards";
import { useState } from "react";

export function TexasPanel({ board, hole, toCall, pot }: { board: Card[]; hole: [Card, Card] | null; toCall: number | null; pot: number | null }) {
  const [book, setBook] = useState<TexBook | null>(() => readTexas());
  const [error, setError] = useState("");
  if (!TEXAS_ENABLED) return null;
  const ready = board.length >= 3;
  const hit = book && ready ? texasHit(book, board, hole, toCall, pot) : null;
  const missed = hit && "miss" in hit ? hit.miss : "";
  const found = hit && !("miss" in hit) ? hit : null;

  async function load(file: File) {
    setError("");
    if (!ready) {
      setError("Сначала откройте флоп. Файл привяжется к этим картам.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError("Файл больше 40 МБ. В TexasSolver поставьте set_dump_rounds 1 и посчитайте заново.");
      return;
    }
    try {
      const dump = JSON.parse(await file.text()) as unknown;
      const root = parseTexasDump(dump);
      const next = { board: boardKey(board), root, at: Date.now(), kept: "saved" as const };
      writeTexas(next);
      setBook(readTexas());
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
            {book ? "Заменить файл" : "Загрузить output_result.json"}
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
                writeTexas(null);
                setBook(null);
                setError("");
              }}
            >
              Убрать
            </button>
          ) : null}
        </div>
      </div>
      {found ? (
        <>
          <p className="mt-1 text-2xl font-semibold leading-none text-sky-100">{found.action}</p>
          <p className="mt-1 text-xs text-sky-200/80">
            {found.board} · {found.where}
            {found.kept === "session" ? " · файл только до обновления страницы" : ""}
          </p>
          <p className="mt-1 text-sm leading-snug text-sky-50/90">{found.mix}. Частоты из вашего файла, не из чарта. Кнопка чарта не меняется.</p>
        </>
      ) : (
        <p className="mt-1 text-sm leading-snug text-sky-100/80">
          {error || missed || (book ? "Откройте борд, на который считали файл." : "Посчитайте борд у себя в TexasSolver и положите сюда output_result.json. На сайте он не запускается.")}
        </p>
      )}
    </aside>
  );
}
