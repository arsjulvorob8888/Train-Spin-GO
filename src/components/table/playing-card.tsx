import { RANK_CHARS, SUIT_GLYPHS, isRedSuit, type Card } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  xs: "h-10 w-7 text-[10px]",
  sm: "h-14 w-10 text-[11px]",
  md: "h-[4.5rem] w-[3.2rem] text-sm",
  lg: "h-24 w-[4.25rem] text-base",
};

export function PlayingCard({
  card,
  hidden,
  size = "md",
  className,
}: {
  card?: Card | null;
  hidden?: boolean;
  size?: Size;
  className?: string;
}) {
  if (hidden || !card) {
    return (
      <div
        className={cn(
          "card-back relative rounded-sm",
          SIZES[size],
          className,
        )}
        aria-label="Facedown card"
      >
        <div className="absolute inset-[5px] rounded-[3px] border border-fg/15" />
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  return (
    <div
      className={cn(
        "card-face relative flex flex-col justify-between rounded-sm p-1 font-display font-semibold leading-none",
        SIZES[size],
        red ? "text-suit-red" : "text-card-ink",
        className,
      )}
      aria-label={`${RANK_CHARS[card.rank]} of ${["clubs", "diamonds", "hearts", "spades"][card.suit]}`}
    >
      <div className="flex flex-col items-start">
        <span>{RANK_CHARS[card.rank]}</span>
        <span className="-mt-0.5 text-[0.95em]">{SUIT_GLYPHS[card.suit]}</span>
      </div>
      <span className="self-center text-[1.35em] leading-none">{SUIT_GLYPHS[card.suit]}</span>
    </div>
  );
}
