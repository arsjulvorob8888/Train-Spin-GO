export type MixAction = "fold" | "call" | "raise" | "allin";

export type Mix = Record<MixAction, number>;

export type MixRange = Record<string, Mix>;

export const ACTION_ORDER: MixAction[] = ["allin", "raise", "call", "fold"];

export function emptyMix(): Mix {
  return { fold: 0, call: 0, raise: 0, allin: 0 };
}

export function mixOf(range: MixRange, hand: string): Mix {
  const m = range[hand];
  if (!m) return { fold: 100, call: 0, raise: 0, allin: 0 };
  const out: Mix = {
    fold: m.fold || 0,
    call: m.call || 0,
    raise: m.raise || 0,
    allin: m.allin || 0,
  };
  const sum = out.fold + out.call + out.raise + out.allin;
  if (sum < 100) out.fold += 100 - sum;
  return out;
}

export function primary(m: Mix): MixAction {
  return ACTION_ORDER.reduce((best, a) => ((m[a] || 0) > (m[best] || 0) ? a : best), "fold" as MixAction);
}

export function segs(m: Mix): { a: MixAction; p: number }[] {
  return ACTION_ORDER.map((a) => ({ a, p: m[a] || 0 })).filter((s) => s.p > 0);
}

export function isMix(m: Mix): boolean {
  return Math.max(m.fold || 0, m.call || 0, m.raise || 0, m.allin || 0) < 95;
}

export function grade(m: Mix, choice: MixAction): "correct" | "mix" | "wrong" {
  const f = m[choice] || 0;
  if (f <= 0) return "wrong";
  if (choice === primary(m)) return "correct";
  if (f >= 20) return "mix";
  return "wrong";
}

export function comboWeight(hand: string): number {
  if (hand.length === 2) return 6;
  if (hand.endsWith("s")) return 4;
  return 12;
}

export function continueHands(range: MixRange, all: string[]): string[] {
  return all.filter((h) => {
    const m = mixOf(range, h);
    return (m.raise || 0) + (m.allin || 0) + (m.call || 0) > 0;
  });
}

export function continuePct(range: MixRange, all: string[]): number {
  let play = 0;
  let total = 0;
  for (const h of all) {
    const w = comboWeight(h);
    total += w;
    const m = mixOf(range, h);
    play += (w * (100 - (m.fold || 0))) / 100;
  }
  return total ? (play / total) * 100 : 0;
}
