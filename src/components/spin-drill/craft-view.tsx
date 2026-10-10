import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { findCraft, placeText, readCraft, type CraftHand } from "@/lib/spin-drill/craft";
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
  useEffect(() => {
    setHands(readCraft());
  }, []);
  if (!hands.length) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">PokerCraft</h2>
        <p className="mt-2 text-sm text-muted">Раздач пока нет. Сыграйте руку в Стратегии и нажмите галочку или «Новая раздача» — разбор сохранится сюда.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">PokerCraft</h2>
      <p className="mt-1 text-sm text-muted">Каждая закрытая раздача: банк, пот-оддсы, эквити, блеф и вскрытие.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="py-2 pr-3 font-medium">Дата</th>
              <th className="py-2 pr-3 font-medium">Время</th>
              <th className="py-2 pr-3 font-medium">Раздача</th>
              <th className="py-2 font-medium">Разбор</th>
            </tr>
          </thead>
          <tbody>
            {hands.map((hand) => {
              const stamp = when(hand.at);
              return (
                <tr key={hand.id} className="border-t border-border">
                  <td className="py-2 pr-3 font-mono text-xs">{stamp.day}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{stamp.time}</td>
                  <td className="py-2 pr-3">
                    {hand.heroSeat} · {hand.klass || hand.hole} · {hand.bb}bb
                    <span className="mt-0.5 block text-xs text-muted">
                      {hand.spotTitle} · {placeText(hand.result)}
                      {hand.verdict ? ` · ${hand.verdict}` : ""}
                    </span>
                  </td>
                  <td className="py-2">
                    <Link to="/pokercraft/$id" params={{ id: hand.id }} className="text-sm underline">
                      Открыть
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
  const mix = range && hand.klass ? mixOf(range, hand.klass) : null;
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
      </header>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Решение солвера</h2>
        <p className="mt-2 text-3xl font-semibold">{hand.verdict || "—"}</p>
        <p className="mt-2 text-sm leading-relaxed">{hand.text || "Солвер не успел посчитать эту руку."}</p>
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

      <section className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">Рейндж на старте</h2>
        <p className="mt-2 text-muted">
          {chart ? `Чарт этого спота на ${hand.bb}bb для ${hand.klass}: ${chart}.` : "Клетка чарта не сохранилась."} Это решение против диапазона, пока карты соперника закрыты.
        </p>
        {mix ? (
          <p className="mt-2 font-mono text-xs">
            fold {Math.round(mix.fold)}% · call {Math.round(mix.call)}% · raise {Math.round(mix.raise)}% · all-in {Math.round(mix.allin)}%
          </p>
        ) : null}
      </section>

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

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wide text-subtle">{title}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
    </div>
  );
}
