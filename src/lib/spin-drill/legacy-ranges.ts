import type { Mix, MixRange } from "./mix";

export const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
export const COLOR = { fold: "var(--fold)", call: "var(--call)", raise: "var(--raise)", allin: "var(--allin)" };
export const ORDER = ["allin","raise","call","fold"];

export function handAt(r: number, c: number): string {
  const a = RANKS[r]!;
  const b = RANKS[c]!;
  if (r === c) return a + b;
  return c > r ? a + b + "s" : b + a + "o";
}
export function allHands(): string[] {
  const h: string[] = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) h.push(handAt(i, j));
  return h;
}
export const ALL = allHands();
export function z(): Mix {
  return { fold: 0, call: 0, raise: 0, allin: 0 };
}
export function fill(list: string[], action: keyof Mix): MixRange {
  const o: MixRange = {};
  list.forEach((h) => {
    const m = z();
    m[action] = 100;
    o[h] = m;
  });
  return o;
}
export function pack(spec: Record<string, Partial<Mix>>): MixRange {
  const o: MixRange = {};
  Object.entries(spec).forEach(([h, parts]) => {
    const m = z();
    Object.assign(m, parts);
    o[h] = m;
  });
  return o;
}

export const BTN_RAISE = ["AA","KK","QQ","JJ","TT","99","88","77","66","AKs","AQs","AJs","ATs","A9s","A8s","A7s","KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","Q9s","Q8s","Q7s","J9s","J8s","T8s","98s","97s","87s","86s","AKo","A7o","A6o","A5o","K9o","KTo","QJo","QTo","JTo"];
export const BTN_ALLIN = ["A6s","A5s","A4s","A3s","QTs","JTs","T9s","A9o","A8o","44","33","22"];
export const BTN_MIX = {
  A2s:{raise:36,allin:64}, AQo:{raise:91,allin:9}, AJo:{raise:93,allin:7},
  ATo:{raise:23,allin:77}, A4o:{raise:81,fold:19}, KQo:{raise:57,allin:43},
  KJo:{raise:53,allin:47}, QJs:{raise:72,allin:28}, Q9o:{raise:27,fold:73},
  J7s:{raise:39,fold:61}, T9o:{raise:61,fold:39}, T7s:{raise:36,fold:64},
  "76s":{raise:45,fold:55}, "55":{raise:53,allin:47}
};
export const RANGE_BTN: MixRange = Object.assign({}, fill(BTN_RAISE,"raise"), fill(BTN_ALLIN,"allin"), pack(BTN_MIX));

export const SBF_RAISE = ["AA","AKs","KK","KQs","KJs","KTs","K9s","QQ","JJ","JTs","J3s","KTo","TT","T9s","Q9o","K8o","K7o","K6o","K5o","Q2s"];
export const SBF_ALLIN = ["A3s","A2s","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o","KJo","QJo","T7s","97s","87s","86s","76s","44","33","22"];
export const SBF_CALL = ["ATs","A4s","K4s","K3s","K2s","Q9s","Q8s","Q7s","T2s","94s","84s","K3o","52s"];
export const SBF_MIX = {
  AQs:{raise:80,call:20}, AJs:{call:82,raise:18}, A9s:{call:63,raise:37},
  A8s:{raise:84,call:16}, A7s:{raise:79,call:21}, A6s:{raise:78,call:22},
  A5s:{raise:89,call:11}, AKo:{raise:42,call:44,allin:14},
  K8s:{call:78,raise:22}, K7s:{call:68,allin:32}, K6s:{allin:62,call:38},
  K5s:{call:67,allin:33}, KQo:{allin:51,raise:41,call:8},
  QJs:{call:56,allin:44}, QTs:{raise:89,call:11}, Q6s:{allin:80,call:20},
  Q5s:{call:79,raise:21}, Q4s:{raise:59,call:41}, Q3s:{call:72,raise:28},
  J9s:{raise:79,call:21}, J8s:{call:68,allin:32}, J7s:{allin:60,call:40},
  J6s:{call:82,raise:18}, J5s:{call:57,raise:43}, J4s:{raise:86,call:14},
  J2s:{call:68,raise:32}, QTo:{call:54,raise:34,allin:12},
  JTo:{allin:36,raise:36,call:28}, T8s:{allin:38,raise:37,call:25},
  T6s:{raise:68,call:32}, T5s:{call:74,raise:26}, T4s:{call:67,raise:33},
  T3s:{call:70,raise:30}, K9o:{raise:86,call:14}, J9o:{raise:54,call:46},
  T9o:{allin:68,call:32}, "99":{raise:84,call:16}, "98s":{allin:52,raise:48},
  "96s":{allin:63,call:37}, "95s":{raise:78,call:22}, "93s":{call:64,fold:36},
  Q8o:{raise:91,call:9}, J8o:{raise:67,call:33}, T8o:{raise:64,call:36},
  "98o":{allin:80,call:20}, "88":{raise:89,call:11}, "85s":{raise:67,call:33},
  Q7o:{call:57,raise:43}, J7o:{call:68,raise:16,fold:16}, T7o:{call:67,raise:33},
  "97o":{raise:50,call:50}, "87o":{allin:45,call:39,raise:16},
  "77":{raise:66,call:34}, "75s":{call:83,raise:17}, "74s":{raise:68,call:32},
  Q6o:{call:64,fold:36}, "86o":{fold:76,call:24}, "76o":{call:47,raise:27,fold:26},
  "66":{raise:53,call:47}, "65s":{allin:85,call:15}, "64s":{raise:63,call:37},
  "63s":{call:52,raise:48}, Q5o:{fold:75,call:25}, "65o":{fold:83,call:17},
  "55":{allin:46,raise:30,call:24}, "54s":{call:79,raise:21}, "53s":{raise:75,call:25},
  K4o:{raise:62,call:38}, "43s":{raise:70,call:30}, K2o:{fold:61,call:39}
};
export const RANGE_SB_FOLD: MixRange = Object.assign({}, fill(SBF_RAISE,"raise"), fill(SBF_ALLIN,"allin"), fill(SBF_CALL,"call"), pack(SBF_MIX));

export const SBR_RAISE = ["AA"];
export const SBR_ALLIN = ["AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
  "AKo","KK","KQs","KJs","KTs","AQo","KQo","QQ","QJs","Q9s",
  "AJo","KJo","JJ","J9s","ATo","TT","T9s","A9o","99","98s","88","77","66","55","22"];
export const SBR_MIX = {
  K9s:{allin:93,raise:7}, QTs:{allin:92,raise:8}, JTs:{allin:80,raise:20},
  T8s:{fold:80,allin:13,raise:7}, A8o:{allin:93,raise:7}, A7o:{fold:93,raise:7},
  QJo:{fold:95,raise:5}, "44":{allin:96,raise:4}, "33":{allin:99,raise:1}
};
export const RANGE_SB_RAISE: MixRange = Object.assign({}, fill(SBR_RAISE,"raise"), fill(SBR_ALLIN,"allin"), pack(SBR_MIX));

export const SBP_CALL = ["AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
  "AKs","AQs","AJs","ATs","A9s","A8s","A7s",
  "AKo","AQo","AJo","ATo","A9o",
  "KQs","KJs","KQo","KJo","QJs"];
export const RANGE_SB_PUSH: MixRange = fill(SBP_CALL,"call");

export const SBL_ALLIN = ["ATs","A6s","A5s","A4s","A3s","A2s","KTs","JTs","J9s","T9s","99","88","77","66","44","33"];
export const SBL_RAISE = ["AKs","AQs","AJs","A9s","JJ","TT"];
export const SBL_CALL = ["K8s","K7s","K3s","Q8s","Q7s","Q6s","J7s","T7s","97s","96s","86s","75s","65s","64s","54s","22"];
export const SBL_MIX = {
  AA:{raise:64,call:36}, A8s:{raise:70,call:22,allin:8}, A7s:{raise:50,call:50},
  AKo:{allin:62,raise:38}, AQo:{allin:70,raise:30}, AJo:{allin:68,raise:32},
  ATo:{allin:72,raise:28}, A9o:{allin:70,raise:30}, A8o:{allin:75,call:25},
  A7o:{allin:48,raise:32,call:20}, A6o:{call:68,raise:32},
  A5o:{allin:50,raise:30,call:20}, A4o:{allin:50,call:32,raise:18},
  A3o:{call:78,raise:22}, A2o:{call:64,raise:36},
  KK:{raise:70,call:24,allin:6}, KQs:{raise:72,allin:28}, KJs:{call:64,raise:36},
  K9s:{allin:74,raise:26}, K6s:{call:72,raise:28}, K5s:{call:62,raise:38},
  K4s:{call:88,raise:12}, K2s:{fold:70,call:30},
  KQo:{allin:72,raise:28}, KJo:{allin:80,raise:20}, KTo:{call:72,allin:28},
  K9o:{call:78,raise:22},
  QQ:{raise:78,call:16,allin:6}, QJs:{allin:78,call:22}, QTs:{allin:74,raise:26},
  Q9s:{allin:80,raise:20}, QJo:{call:76,raise:24}, QTo:{call:76,raise:24},
  J8s:{call:60,raise:40}, JTo:{call:64,raise:36},
  T8s:{allin:58,raise:30,call:12}, "98s":{allin:76,raise:24},
  "87s":{allin:60,raise:32,call:8}, "85s":{fold:62,call:38},
  "76s":{call:74,raise:26}, "55":{allin:58,raise:22,call:20},
  "22":{call:80,allin:20}
};
export const RANGE_SB_LIMP: MixRange = Object.assign({}, fill(SBL_ALLIN,"allin"), fill(SBL_RAISE,"raise"), fill(SBL_CALL,"call"), pack(SBL_MIX));
