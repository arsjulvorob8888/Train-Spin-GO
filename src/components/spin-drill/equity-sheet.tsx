import { EQUITY_GROUPS, equityHint } from "@/lib/spin-drill/equity-anchors";
import { cn } from "@/lib/utils";

export function EquityHintLine({ hand, spotId }: { hand: string | null; spotId: string }) {
  const hint = equityHint(hand, spotId);
  if (!hint || !hand) return null;
  return (
    <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-muted">
      <span className="font-mono text-fg">{hand}</span>
      {" · "}
      <span className="font-medium text-fg">{hint.equity}</span>
      {" · "}
      {hint.note}
    </p>
  );
}

export function EquitySheet({ hand }: { hand?: string | null }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-medium">Грубая оценка в голове</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Это якоря, а не солвер. Эквити — шанс забрать банк к риверу, если дошли до вскрытия. За столом сравниваешь
          якорь с ценой колла: для пуша 15bb из блайнда нужно примерно 46–48%.
        </p>
      </section>
      {EQUITY_GROUPS.map((group) => (
        <section key={group.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="text-base font-medium">{group.title}</h3>
          <p className="mt-1 font-mono text-xs text-subtle">{group.versus}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{group.blurb}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-xs text-subtle">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Рука</th>
                  <th className="py-1.5 pr-3 font-medium">Эквити</th>
                  <th className="py-1.5 font-medium">Как помнить</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const on = !!hand && row.hands.includes(hand);
                  return (
                    <tr key={row.label} className={cn("border-t border-border", on && "bg-surface-2")}>
                      <td className="py-2 pr-3 font-mono">{row.label}</td>
                      <td className="py-2 pr-3 font-mono text-fg">{row.equity}</td>
                      <td className="py-2 text-muted">{row.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
