import { cn } from "@/lib/utils";

type Leaf = { label: string; spot: string };
type Branch = { label: string; children: Leaf[] };

const TREE: Branch[] = [
  {
    label: "Fold",
    children: [
      { label: "Limp", spot: "bb_vs_sb_limp" },
      { label: "Raise 2", spot: "bb_vs_sb_raise" },
      { label: "All-in", spot: "bb_vs_sb_jam" },
    ],
  },
  {
    label: "Limp",
    children: [
      { label: "Fold", spot: "bb_vs_btn_limp" },
      { label: "Call", spot: "bb_vs_limp_call" },
      { label: "Raise 4", spot: "bb_vs_limp_iso" },
      { label: "All-in", spot: "bb_vs_limp_jam" },
    ],
  },
  {
    label: "Raise 2",
    children: [
      { label: "Fold", spot: "bb_vs_btn_raise" },
      { label: "Call", spot: "bb_squeeze" },
      { label: "All-in", spot: "bb_vs_reshove" },
    ],
  },
  {
    label: "All-in",
    children: [
      { label: "Fold", spot: "bb_vs_btn_jam" },
      { label: "Call", spot: "bb_vs_jam_call" },
    ],
  },
];

export function BbLine({
  spotId,
  bb,
  onSpot,
}: {
  spotId: string;
  bb: number;
  onSpot: (id: string) => void;
}) {
  const btn = TREE.find((branch) => branch.children.some((leaf) => leaf.spot === spotId)) ?? TREE[0]!;
  const sb = btn.children.find((leaf) => leaf.spot === spotId) ?? btn.children[0]!;
  return (
    <div className="flex gap-1 overflow-x-auto">
      <SeatColumn
        seat="BTN"
        stack={bb}
        actions={TREE.map((branch) => (branch.label === "All-in" ? `All-in ${bb}` : branch.label))}
        selected={btn.label === "All-in" ? `All-in ${bb}` : btn.label}
        onPick={(label) => {
          const plain = label.startsWith("All-in") ? "All-in" : label;
          const next = TREE.find((branch) => branch.label === plain) ?? TREE[0]!;
          onSpot(next.children[0]!.spot);
        }}
      />
      <SeatColumn
        seat="SB"
        stack={Math.round((bb - 0.5) * 10) / 10}
        actions={btn.children.map((leaf) => (leaf.label === "All-in" ? `All-in ${bb}` : leaf.label))}
        selected={sb.label === "All-in" ? `All-in ${bb}` : sb.label}
        onPick={(label) => {
          const plain = label.startsWith("All-in") ? "All-in" : label;
          const next = btn.children.find((leaf) => leaf.label === plain) ?? btn.children[0]!;
          onSpot(next.spot);
        }}
      />
      <SeatColumn seat="BB" stack={Math.round((bb - 1) * 10) / 10} hero actions={["ваш рейндж"]} selected="" onPick={() => {}} />
    </div>
  );
}

function SeatColumn({
  seat,
  stack,
  actions,
  selected,
  hero,
  onPick,
}: {
  seat: string;
  stack: number;
  actions: string[];
  selected: string;
  hero?: boolean;
  onPick: (label: string) => void;
}) {
  return (
    <div className={cn("w-[5.6rem] shrink-0 rounded-lg border p-1", hero ? "border-ok" : "border-border")}>
      <div className="flex items-center justify-between px-1 text-[11px]">
        <span className="font-medium">{seat}</span>
        <span className="font-mono text-muted">{stack}</span>
      </div>
      <div className="mt-1 flex flex-col">
        {actions.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            className={cn(
              "rounded px-1 py-1 text-left text-xs",
              label === selected ? "bg-fg text-bg" : "text-muted",
              hero ? "cursor-default" : "",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
