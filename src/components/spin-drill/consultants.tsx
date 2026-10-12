import { useEffect, useState } from "react";
import { readSources, writeSources, type SourceConfig, type SourceId } from "@/lib/spin-drill/sources";

const CARDS: {
  id: SourceId;
  name: string;
  price: string;
  speed: string;
  when: string;
  href: string;
  note: string;
}[] = [
  {
    id: "deepsolver",
    name: "Deepsolver API",
    price: "от $1 875 в месяц или $0.025 за расчёт",
    speed: "2–20 секунд",
    when: "После раздачи, только хедз-ап постфлоп. В 3-max на живом ходу не успевает и multiway API не считает.",
    href: "https://deepsolver.com/api",
    note: "Оплата на стороне Deepsolver. Сюда вставляется ключ, который они выдают после оплаты. Деньги через это приложение не списываются.",
  },
  {
    id: "snowie",
    name: "PokerSnowie",
    price: "отдельный договор, публичной цены API нет",
    speed: "секунды",
    when: "Второй взгляд после сессии. Это нейросеть, не равновесие. Живой ход не ждёт.",
    href: "https://www.pokersnowie.com/",
    note: "API дают по запросу. Пока ключа нет, совет не меняется.",
  },
  {
    id: "deepfold",
    name: "DEEPFOLD",
    price: "подписка на их сайте",
    speed: "разбор раздачи, не ход",
    when: "Вставить share-ссылку PokerCraft после игры. В момент решения не участвует.",
    href: "https://deepfold.co/en/how-to-use",
    note: "Нужен, когда захотите чужой разбор готовой руки. На кнопку Fold или Raise не влияет.",
  },
];

export function Consultants() {
  const [sources, setSources] = useState<Record<SourceId, SourceConfig> | null>(null);
  useEffect(() => {
    setSources(readSources());
  }, []);
  if (!sources) return null;
  function save(next: Record<SourceId, SourceConfig>) {
    setSources(next);
    writeSources(next);
  }
  const armed = CARDS.filter((card) => sources[card.id].on && sources[card.id].token.trim()).length;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Как принимается решение</h2>
        <p className="mt-2 text-sm text-muted">
          За столом время короткое, поэтому ход считает только местный чарт. Он бесплатный и отвечает сразу. Внешние солверы подключаются ключом и спрашиваются после раздачи, если успеют. Пока ключа нет, они молчат и ничего не замедляют.
        </p>
        <p className="mt-3 font-mono text-2xl font-semibold">Сейчас: местный солвер{armed ? ` + ${armed} внешн.` : ""}</p>
      </section>
      <section className="rounded-2xl border border-ok/50 bg-ok/10 p-4">
        <h2 className="text-lg font-semibold">Местный солвер</h2>
        <p className="mt-1 text-sm">Включён всегда. Цена $0. Задержка нет. Чарт 15bb и сдвиг по эффективному стеку, пот-оддсы, блеф и банк.</p>
      </section>
      {CARDS.map((card) => {
        const item = sources[card.id];
        return (
          <section key={card.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">{card.name}</h2>
              <button
                type="button"
                onClick={() => save({ ...sources, [card.id]: { ...item, on: !item.on } })}
                className={item.on ? "h-9 rounded-full bg-fg px-3 text-xs text-bg" : "h-9 rounded-full bg-surface-2 px-3 text-xs text-muted"}
              >
                {item.on ? "Будет спрашиваться" : "Выключен"}
              </button>
            </div>
            <p className="mt-2 text-sm">{card.when}</p>
            <p className="mt-1 text-sm text-muted">Скорость: {card.speed}. Цена: {card.price}.</p>
            <p className="mt-1 text-xs text-muted">{card.note}</p>
            <a href={card.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
              Открыть тариф и оплатить у них
            </a>
            <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-subtle">
              Ключ API
              <input
                value={item.token}
                onChange={(event) => save({ ...sources, [card.id]: { ...item, token: event.target.value } })}
                placeholder="Вставите, когда купите доступ"
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg normal-case"
              />
            </label>
          </section>
        );
      })}
    </div>
  );
}
