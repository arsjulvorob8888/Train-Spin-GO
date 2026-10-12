import { BB_CALL_EQ, HU_HANDS, SB_PUSH } from "@/lib/spin-drill/hu-nash-data";

/** Flip to false to remove the heads-up advisor without touching the chart. */
export const HU_ADVISOR_ENABLED = true;

const STORAGE_KEY = "spin-hu-advisor";
const handIndex = new Map<string, number>(HU_HANDS.map((hand, index) => [hand, index]));

export function readHuAdvisorEnabled(): boolean {
  if (!HU_ADVISOR_ENABLED) return false;
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function writeHuAdvisorEnabled(on: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
}

export type HuNash = {
  action: string;
  line: string;
  why: string;
  agrees: boolean | null;
};

export function huNash(spotId: string, bb: number, klass: string, street: string, chart: string): HuNash | null {
  if (!HU_ADVISOR_ENABLED || !spotId.startsWith("hu_")) return null;
  if (street !== "Префлоп") {
    return {
      action: "Молчит",
      line: "Только префлоп",
      why: "Пуш/фолд считается до флопа. На флопе, тёрне и ривере решение по-прежнему у чарта.",
      agrees: null,
    };
  }
  const stack = Math.round(bb);
  if (stack > 25) {
    return {
      action: "Молчит",
      line: "Глубже 25bb",
      why: "Таблица хедз-апа кончается на 25bb. Дальше играйте чарт.",
      agrees: null,
    };
  }
  if (spotId === "hu_bb_limp" || spotId === "hu_bb_raise") {
    return {
      action: "Не этот спот",
      line: "Лимп или рейз",
      why: "Nash здесь умеет только пуш против фолда и колл против пуша. Против лимпа и рейза 2bb остаётся чарт.",
      agrees: null,
    };
  }
  const at = handIndex.get(klass);
  if (at == null || stack < 1) return null;
  const depth = Math.max(1, Math.min(25, stack));
  if (spotId === "hu_sb") {
    const freq = SB_PUSH[depth - 1]?.[at] ?? 0;
    const action = freq >= 0.95 ? "All-in" : freq <= 0.05 ? "Fold" : `Пуш ${Math.round(freq * 100)}%`;
    const chartPush = /all-in|пуш/i.test(chart);
    const chartFold = /^fold$|^фолд$/i.test(chart);
    const agrees = action === "All-in" ? chartPush : action === "Fold" ? chartFold : null;
    const band = depth <= 12 ? "на коротком стеке это основная линия" : "на этом стеке минрейз чарта часто лучше пуша";
    return {
      action,
      line: `SB · ${depth}bb`,
      why: `${klass}: в равновесии пуш/фолд ${action === "Fold" ? "рука вне пуша" : action === "All-in" ? "рука в пуше" : `пушится в ${Math.round(freq * 100)}%`}. ${band}. Кнопку чарта это не меняет.`,
      agrees,
    };
  }
  if (spotId === "hu_bb_jam") {
    const eq = BB_CALL_EQ[depth - 1]?.[at] ?? 0;
    const need = ((depth - 1) / (2 * depth)) * 100;
    const edge = eq - need;
    const action = edge > 2 ? "Call" : edge < -2 ? "Fold" : "На грани";
    const chartCall = /^call$|^колл$/i.test(chart);
    const chartFold = /^fold$|^фолд$/i.test(chart);
    const agrees = action === "Call" ? chartCall : action === "Fold" ? chartFold : null;
    return {
      action,
      line: `BB против пуша · ${depth}bb`,
      why: `${klass}: эквити против Nash-пуша ${Math.round(eq)}%, для колла нужно ${Math.round(need)}%. ${action === "На грани" ? "Разница маленькая — смотрите чарт." : "Это вторая линия, подсветка чарта не меняется."}`,
      agrees,
    };
  }
  return null;
}
