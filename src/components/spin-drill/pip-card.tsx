import { cn } from "@/lib/utils";

const PIP: Record<string, string> = {
  s: "M12 2C12 2 4 10.2 4 14.2C4 17.4 6.5 20 10 20C10.6 20 11.2 19.9 11.7 19.6C11.3 20.6 10.4 22 8.5 22H15.5C13.6 22 12.7 20.6 12.3 19.6C12.8 19.9 13.4 20 14 20C17.5 20 20 17.4 20 14.2C20 10.2 12 2 12 2Z",
  h: "M12 21S3 13.6 3 8.6C3 5.5 5.5 3 8.4 3C10.1 3 11.5 3.9 12 5.2C12.5 3.9 13.9 3 15.6 3C18.5 3 21 5.5 21 8.6C21 13.6 12 21 12 21Z",
  d: "M12 2L19 12L12 22L5 12L12 2Z",
  c: "M12 3C9.8 3 8 4.8 8 7C8 8.4 8.7 9.6 9.8 10.3C7.6 10.6 6 12.4 6 14.7C6 17.1 8 19 10.4 19C11 19 11.5 18.9 12 18.6C11.6 19.6 10.6 21 8.8 21H15.2C13.4 21 12.4 19.6 12 18.6C12.5 18.9 13 19 13.6 19C16 19 18 17.1 18 14.7C18 12.4 16.4 10.6 14.2 10.3C15.3 9.6 16 8.4 16 7C16 4.8 14.2 3 12 3Z",
};
const GLYPH: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

export type Face = { rank: string; suit: string };

export function PipCard({ card, tilt = 0 }: { card?: Face | null; tilt?: number }) {
  if (!card) return <div className="h-[156px] w-[112px] rounded-[10px] bg-surface-2" />;
  const red = card.suit === "h" || card.suit === "d";
  const rank = card.rank === "T" ? "10" : card.rank;
  return (
    <div
      className={cn(
        "relative h-[156px] w-[112px] rounded-[10px] bg-card-face shadow-[0_18px_40px_rgba(0,0,0,0.45)]",
        red ? "text-suit-red" : "text-card-ink",
      )}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="absolute top-2 left-2 font-mono text-xl font-semibold leading-none">
        {rank}
        <div className="text-base">{GLYPH[card.suit]}</div>
      </div>
      <svg className="absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2" viewBox="0 0 24 24">
        <path fill="currentColor" d={PIP[card.suit]} />
      </svg>
    </div>
  );
}

export function MiniCard({ r, s, dim }: { r: string; s: string; dim?: boolean }) {
  const red = s === "h" || s === "d";
  const rank = r === "T" ? "10" : r;
  return (
    <div
      className={cn(
        "relative h-14 w-10 rounded-md font-mono text-xs font-semibold",
        dim ? "bg-surface-2 text-subtle" : "bg-card-face",
        !dim && (red ? "text-suit-red" : "text-card-ink"),
      )}
    >
      <span className="absolute top-1 left-1">{rank}</span>
      <span className="absolute right-1 bottom-1 text-sm">{GLYPH[s]}</span>
    </div>
  );
}
