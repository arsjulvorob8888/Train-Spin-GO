import { emptyMix, type Mix, type MixAction, type MixRange } from "@/lib/spin-drill/mix";

export type MttGroup = "open" | "face" | "three" | "cold";

export type MttPack = {
  source: string;
  license: string;
  stacks: number[];
  charts: Record<string, Record<string, string>>;
};

export type MttSpot = {
  id: string;
  scenario: string;
  name: string;
  group: MttGroup;
  title: string;
  blurb: string;
  call: string;
  stacks: number[];
};

const POS: Record<string, string> = {
  UTG: "UTG",
  UTG1: "UTG+1",
  LJ: "LJ",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB",
  EP: "EP",
  MP: "MP",
  IP: "поздняя",
  blind: "блайнд",
};

export const GROUP_LABEL: Record<MttGroup, string> = {
  open: "Открытие",
  face: "Против рейза",
  three: "Против 3-бета",
  cold: "Холодный 4-бет",
};

function pos(name: string): string {
  return POS[name] ?? name;
}

export function describe(scenario: string, name: string): Pick<MttSpot, "group" | "title" | "blurb" | "call"> {
  if (scenario === "rfi") {
    return {
      group: "open",
      title: `${pos(name)} открывает`,
      blurb: "Все до вас сбросили. Рейз — открытие, олл-ин — пуш со стека.",
      call: "Call",
    };
  }
  if (name === "BB-vs-SBlimp") {
    return {
      group: "face",
      title: "BB против лимпа SB",
      blurb: "Малый блайнд залимпил. Зелёная доля в чарте — чек, не колл.",
      call: "Check",
    };
  }
  const three = /^(\w+)open-vs-(\w+)3bet$/.exec(name);
  if (three) {
    return {
      group: "three",
      title: `${pos(three[1]!)} открыл · 3-бет ${pos(three[2]!)}`,
      blurb: "Вы уже открылись. Колл — продолжение, олл-ин — 4-бет пушем.",
      call: "Call",
    };
  }
  if (name.startsWith("cold-")) {
    return {
      group: "cold",
      title: `${pos(name.slice(5))} · холодный 4-бет`,
      blurb: "Вы не были открывающим. Узкий рейз или пуш против 3-бета.",
      call: "Call",
    };
  }
  const [hero, villain] = name.split("-vs-");
  return {
    group: "face",
    title: `${pos(hero ?? name)} против открытия ${pos(villain ?? "")}`,
    blurb: "Вам открылись. Колл — колл, рейз — 3-бет, олл-ин — пуш.",
    call: "Call",
  };
}

export function decodeMix(code: string | undefined): Mix {
  const mix = emptyMix();
  if (!code) {
    mix.fold = 100;
    return mix;
  }
  let used = 0;
  for (const part of code.match(/[arc]\d*/g) ?? []) {
    const key: MixAction = part[0] === "a" ? "allin" : part[0] === "r" ? "raise" : "call";
    const pct = part.length === 1 ? 100 : Number(part.slice(1));
    mix[key] = pct;
    used += pct;
  }
  mix.fold = Math.max(0, 100 - used);
  return mix;
}

export function rangeOf(hands: Record<string, string> | undefined): MixRange {
  const range: MixRange = {};
  if (!hands) return range;
  for (const [hand, code] of Object.entries(hands)) range[hand] = decodeMix(code);
  return range;
}

export function spotsOf(pack: MttPack): MttSpot[] {
  const found = new Map<string, number[]>();
  for (const key of Object.keys(pack.charts)) {
    const [stack, scenario, name] = key.split(":");
    const id = `${scenario}:${name}`;
    const list = found.get(id) ?? [];
    list.push(Number(stack));
    found.set(id, list);
  }
  return [...found.entries()]
    .map(([id, stacks]) => {
      const [scenario, name] = id.split(":");
      return { id, scenario: scenario!, name: name!, stacks: stacks.sort((a, b) => b - a), ...describe(scenario!, name!) };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export function chartKey(stack: number, spot: MttSpot): string {
  return `${stack}:${spot.scenario}:${spot.name}`;
}

export function actionWord(action: MixAction, call: string): string {
  if (action === "allin") return "All-in";
  if (action === "raise") return "Raise";
  if (action === "call") return call;
  return "Fold";
}
