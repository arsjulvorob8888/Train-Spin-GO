import { createHash } from "node:crypto";

/** GTObase library depths confirmed from the library list. 8-max is only these four. */
export const EIGHT_MAX_STACKS = [40, 50, 75, 100];

/** 9-max depths from the same library list. Never import these into the 8-max pack. */
export const NINE_MAX_STACKS = [30, 25, 20, 17, 15, 12.5, 10];

export const TOTAL_COMBOS = 1326;

const RANKS = "AKQJT98765432";

export const HANDS = (() => {
  const hands = [];
  for (let i = 0; i < RANKS.length; i++) hands.push(RANKS[i] + RANKS[i]);
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) {
      hands.push(RANKS[i] + RANKS[j] + "s");
      hands.push(RANKS[i] + RANKS[j] + "o");
    }
  }
  return hands;
})();

const HAND_SET = new Set(HANDS);

export function comboWeight(hand) {
  if (hand.length === 2) return 6;
  if (hand.endsWith("s")) return 4;
  return 12;
}

/**
 * Viewer page used as the single baseline.
 * Ante, blinds, and the 17.07 / 82.93 split were read off this page.
 * No chipEV/ICM control was present; model stays null.
 */
export const BASELINE_40_UTG = {
  key: "40:rfi:UTG",
  library: "MTT 8-max",
  viewerId: 110,
  query: 40,
  url: "https://www.gtobase.com/viewer?id=110&q=40#onePlayer-strategy",
  antePerPlayer: 0.12,
  sb: 0.5,
  bb: 1,
  raiseLabel: "Raise to 2.00",
  raisePct: 17.07,
  foldPct: 82.93,
};

/** Keys overwritten or added by the dominant checkpoint. Everything else is the prior pack. */
export const DOMINANT_CHECKPOINT_KEYS = [
  "100:rfi:BTN",
  "100:rfi:CO",
  "100:rfi:HJ",
  "100:rfi:LJ",
  "100:rfi:SB",
  "100:rfi:UTG1",
  "75:rfi:BTN",
  "75:rfi:CO",
  "75:rfi:HJ",
  "75:rfi:LJ",
  "75:rfi:SB",
  "75:rfi:UTG1",
  "50:rfi:BTN",
  "50:rfi:CO",
  "50:rfi:HJ",
  "50:rfi:LJ",
  "50:rfi:SB",
  "50:rfi:UTG1",
  "40:rfi:BTN",
  "40:rfi:CO",
  "40:rfi:HJ",
  "40:rfi:LJ",
  "40:rfi:SB",
  "40:rfi:UTG",
  "40:rfi:UTG1",
  "40:vs-open:BB-vs-SB",
  "40:vs-open:BB-vs-SBlimp",
  "40:vs-open:SB-vs-BTN",
];

const SECRET_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "cookie",
  "cookies",
  "authorization",
  "apikey",
  "api_key",
  "session",
  "email",
  "credentials",
]);

const AGGREGATE_TOLERANCE = 0.02;

export function chartsHash(charts) {
  return createHash("sha256").update(JSON.stringify(charts)).digest("hex");
}

export function decodeCode(code) {
  const mix = { f: 0, c: 0, r: 0, a: 0 };
  if (!code) {
    mix.f = 100;
    return mix;
  }
  const parts = code.match(/[arc]\d*/g) ?? [];
  if (!parts.length || parts.join("") !== code) throw new Error(`Bad action code ${code}`);
  let used = 0;
  for (const part of parts) {
    const pct = part.length === 1 ? 100 : Number(part.slice(1));
    if (!Number.isInteger(pct) || pct <= 0 || pct > 100) throw new Error(`Bad action code ${code}`);
    mix[part[0]] += pct;
    used += pct;
  }
  mix.f = Math.max(0, 100 - used);
  return mix;
}

/**
 * Same tie order as src/lib/spin-drill/mix.ts primary().
 * Comparison is strict, and fold is the starting best, so a tie with fold stays fold.
 * A tie between two played actions keeps the earlier of all-in, raise, call.
 */
export function dominantLetter(code) {
  const mix = decodeCode(code);
  const order = ["a", "r", "c", "f"];
  let best = "f";
  for (const letter of order) {
    if (mix[letter] > mix[best]) best = letter;
  }
  return best === "f" ? "" : best;
}

export function actionCombos(hands, letter) {
  let play = 0;
  for (const [hand, code] of Object.entries(hands)) {
    const mix = decodeCode(code);
    play += (comboWeight(hand) * (mix[letter] || 0)) / 100;
  }
  return play;
}

export function actionPct(hands, letter) {
  return (actionCombos(hands, letter) / TOTAL_COMBOS) * 100;
}

function assertNoSecrets(value, path = "") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      throw new Error(`Refusing capture field ${path}${key}. Do not put account data in the repo.`);
    }
    assertNoSecrets(child, `${path}${key}.`);
  }
}

export function letterForAction(label, stack) {
  const text = String(label).trim();
  if (/^fold$/i.test(text)) return "f";
  if (/^check$/i.test(text) || /^call/i.test(text)) return "c";
  const match = /(\d+(?:\.\d+)?)/.exec(text);
  const size = match ? Number(match[1]) : null;
  if (/all-?in/i.test(text) || (size != null && size >= stack - 0.001)) return "a";
  if (/raise/i.test(text)) return "r";
  throw new Error(`No pack letter for action "${label}" at ${stack}bb`);
}

function stackOf(key) {
  const stack = Number(String(key).split(":")[0]);
  if (!Number.isFinite(stack)) throw new Error(`Bad chart key ${key}`);
  return stack;
}

function rejectStack(stack) {
  if (NINE_MAX_STACKS.includes(stack)) {
    throw new Error(
      `Stack ${stack}bb is on the GTObase 9-max list (${NINE_MAX_STACKS.join(", ")}). Do not import it into 8-max.`,
    );
  }
  if (!EIGHT_MAX_STACKS.includes(stack)) {
    throw new Error(`Stack ${stack}bb is not a GTObase 8-max depth. The library lists only ${EIGHT_MAX_STACKS.join(", ")}bb.`);
  }
}

function settingsFor(file, chart) {
  if (file.library !== "MTT 8-max") throw new Error('library must be "MTT 8-max"');
  const stack = stackOf(chart.key);
  rejectStack(stack);
  const viewerId = chart.viewerId ?? file.viewerId;
  const query = chart.query ?? file.query;
  const antePerPlayer = chart.antePerPlayer ?? file.antePerPlayer;
  const sb = chart.sb ?? file.sb;
  const bb = chart.bb ?? file.bb;
  if (viewerId == null || query == null) throw new Error(`${chart.key} is missing viewerId or query`);
  if (stack !== Number(query)) throw new Error(`${chart.key} does not match query ${query}`);
  if (Number(viewerId) === BASELINE_40_UTG.viewerId && Number(query) !== BASELINE_40_UTG.query) {
    throw new Error("Viewer id 110 is the opened 40bb page only. Do not reuse it for another stack.");
  }
  if (chart.viewerId == null && stack !== Number(file.query)) {
    throw new Error(`${chart.key} needs its own viewer id. The file id was only confirmed for ${file.query}bb.`);
  }
  if (antePerPlayer == null || sb == null || bb == null) throw new Error(`${chart.key} is missing ante or blinds from the page header`);
  const model = chart.model !== undefined ? chart.model : file.model;
  if (model != null) {
    const seen = chart.modelSeenAt || file.modelSeenAt;
    if (!seen) throw new Error(`${chart.key} sets model without modelSeenAt. Do not infer chipEV or ICM.`);
  }
  return {
    stack,
    viewerId: Number(viewerId),
    query: Number(query),
    antePerPlayer: Number(antePerPlayer),
    sb: Number(sb),
    bb: Number(bb),
    model: model ?? null,
    modelSeenAt: chart.modelSeenAt || file.modelSeenAt || null,
  };
}

function checkBaselineSettings(chart, settings) {
  if (chart.key !== BASELINE_40_UTG.key) return;
  const problems = [];
  if (settings.viewerId !== BASELINE_40_UTG.viewerId || settings.query !== BASELINE_40_UTG.query) problems.push("viewer");
  if (settings.antePerPlayer !== BASELINE_40_UTG.antePerPlayer) problems.push("ante");
  if (settings.sb !== BASELINE_40_UTG.sb || settings.bb !== BASELINE_40_UTG.bb) problems.push("blinds");
  if (chart.actions) {
    const labels = new Map(chart.actions.map((action) => [action.label, action.aggregatePct]));
    if (labels.get(BASELINE_40_UTG.raiseLabel) !== BASELINE_40_UTG.raisePct) problems.push("raise aggregate");
    if (labels.get("Fold") !== BASELINE_40_UTG.foldPct) problems.push("fold aggregate");
  }
  if (problems.length) {
    throw new Error(`40:rfi:UTG capture does not match the opened baseline page (${problems.join(", ")})`);
  }
}

function tokenize(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const re =
    /\[(\d+(?:\.\d+)?)\]\s*([AKQJT98765432]{2}[so]?)\s*\[\/\1\]|([AKQJT98765432]{2}[so]?)\s*:\s*(\d+(?:\.\d+)?)|([AKQJT98765432]{2}[so]?)/g;
  const tokens = [];
  let match;
  let last = 0;
  while ((match = re.exec(text))) {
    const gap = text.slice(last, match.index);
    if (!/^[\s,;]*$/.test(gap)) throw new Error(`Clipboard has unexpected text "${gap.slice(0, 24)}"`);
    last = match.index + match[0].length;
    const hand = match[2] || match[3] || match[5];
    if (!HAND_SET.has(hand)) throw new Error(`Clipboard hand ${hand} is not a canonical class`);
    if (match[1] != null) tokens.push({ hand, kind: "bracket", value: Number(match[1]) });
    else if (match[3]) tokens.push({ hand, kind: "pair", value: Number(match[4]) });
    else tokens.push({ hand, kind: "bare", value: 1 });
  }
  if (!/^[\s,;]*$/.test(text.slice(last))) throw new Error("Clipboard has an unparsed tail");
  return tokens;
}

function weightsFromTokens(tokens, decoder) {
  const weights = {};
  for (const token of tokens) {
    let weight;
    if (decoder === "bracket") {
      if (token.kind !== "bracket") throw new Error("Mixed clipboard syntax");
      weight = token.value / 100;
    } else if (decoder === "fraction") {
      if (token.kind === "bracket") throw new Error("skip");
      if (token.kind === "pair" && token.value > 1) throw new Error("skip");
      weight = token.kind === "bare" ? 1 : token.value;
    } else if (decoder === "percent") {
      if (token.kind === "bracket") throw new Error("skip");
      weight = (token.kind === "bare" ? 100 : token.value) / 100;
    } else if (decoder === "combos") {
      if (token.kind === "bracket") throw new Error("skip");
      const count = token.kind === "bare" ? comboWeight(token.hand) : token.value;
      weight = count / comboWeight(token.hand);
    } else {
      throw new Error(`Unknown decoder ${decoder}`);
    }
    if (!(weight >= 0) || weight > 1.001) throw new Error("skip");
    weights[token.hand] = (weights[token.hand] || 0) + weight;
    if (weights[token.hand] > 1.001) throw new Error(`Hand ${token.hand} exceeds 100% in one action`);
  }
  return weights;
}

function comboPctOf(weights) {
  let play = 0;
  for (const [hand, weight] of Object.entries(weights)) play += comboWeight(hand) * weight;
  return (play / TOTAL_COMBOS) * 100;
}

function sameWeights(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Math.abs((left[key] || 0) - (right[key] || 0)) > 1e-9) return false;
  }
  return true;
}

/**
 * Clipboard syntax is not verified against GTObase.
 * Try the candidate readings and keep a reading only when it is the unique match
 * for the action's printed aggregate, or when every match encodes the same weights.
 */
export function decodeClipboard(clipboard, aggregatePct) {
  const tokens = tokenize(clipboard);
  if (!tokens.length) return { status: "empty", candidates: [] };
  const kinds = new Set(tokens.map((token) => token.kind));
  const decoders = kinds.has("bracket") ? ["bracket"] : ["fraction", "percent", "combos"];
  const candidates = [];
  for (const decoder of decoders) {
    try {
      const weights = weightsFromTokens(tokens, decoder);
      const pct = comboPctOf(weights);
      candidates.push({ decoder, weights, pct, delta: Math.abs(pct - aggregatePct) });
    } catch (error) {
      if (error.message !== "skip") throw error;
    }
  }
  const hits = candidates.filter((item) => item.delta <= AGGREGATE_TOLERANCE);
  if (hits.length === 1) return { status: "unique", chosen: hits[0], candidates };
  if (hits.length > 1 && hits.every((item) => sameWeights(item.weights, hits[0].weights))) {
    return { status: "unique", chosen: { ...hits[0], decoder: hits.map((item) => item.decoder).join("+") }, candidates };
  }
  return { status: hits.length ? "ambiguous" : "none", candidates };
}

function percentsFromWeights(weights) {
  const rows = Object.entries(weights)
    .filter(([, value]) => value > 0)
    .map(([letter, value]) => {
      const exact = value * 100;
      return { letter, floor: Math.floor(exact + 1e-9), frac: exact - Math.floor(exact + 1e-9) };
    });
  let used = rows.reduce((sum, row) => sum + row.floor, 0);
  const target = Math.round(Object.values(weights).reduce((sum, value) => sum + value, 0) * 100);
  const order = rows.sort((a, b) => b.frac - a.frac || a.letter.localeCompare(b.letter));
  let index = 0;
  while (used < target) {
    order[index % order.length].floor += 1;
    used += 1;
    index += 1;
  }
  const pct = { r: 0, c: 0, a: 0 };
  for (const row of rows) pct[row.letter] = row.floor;
  return pct;
}

export function encodeWeights(byLetter) {
  const present = ["a", "r", "c"].filter((letter) => (byLetter[letter] || 0) >= 0.995);
  if (present.length === 1 && ["a", "r", "c"].every((letter) => letter === present[0] || (byLetter[letter] || 0) <= 0.005)) {
    return present[0];
  }
  const pct = percentsFromWeights(byLetter);
  const sum = pct.a + pct.r + pct.c;
  if (sum > 100) throw new Error("Rounded frequencies exceed 100");
  if (!sum) return "";
  const parts = [];
  for (const letter of ["a", "r", "c"]) {
    if (!pct[letter]) continue;
    parts.push(pct[letter] >= 100 ? letter : `${letter}${pct[letter]}`);
  }
  return parts.join("");
}

function handsFromCodes(hands) {
  const out = {};
  for (const [hand, code] of Object.entries(hands ?? {})) {
    if (!HAND_SET.has(hand)) throw new Error(`Unknown hand ${hand}`);
    const mix = decodeCode(code);
    const sum = mix.a + mix.r + mix.c;
    if (sum > 100) throw new Error(`${hand} frequencies sum to ${sum}`);
    if (!code) continue;
    out[hand] = code;
  }
  if (!Object.keys(out).length) throw new Error("Chart has no played hands");
  return out;
}

function handsFromClipboard(chart) {
  const stack = stackOf(chart.key);
  const letters = new Map();
  for (const action of chart.actions ?? []) {
    const letter = letterForAction(action.label, stack);
    if (letters.has(letter) && letter !== "f") {
      throw new Error(`${chart.key} maps two actions to "${letter}". Keep each raise size separate; all-in is "a".`);
    }
    letters.set(letter, action);
  }
  const decoded = [];
  for (const [letter, action] of letters) {
    if (action.aggregatePct == null) throw new Error(`${chart.key} action "${action.label}" is missing aggregatePct`);
    if (!action.clipboard) {
      decoded.push({ letter, label: action.label, status: "empty", aggregatePct: action.aggregatePct, hasClipboard: false });
      continue;
    }
    const result = decodeClipboard(action.clipboard, Number(action.aggregatePct));
    decoded.push({ letter, label: action.label, aggregatePct: Number(action.aggregatePct), hasClipboard: true, ...result });
  }
  const blockers = decoded.filter((item) => item.letter !== "f" && item.status !== "unique");
  if (blockers.length) return { hands: null, decoded };
  const perHand = {};
  for (const item of decoded) {
    if (item.letter === "f" || !item.chosen) continue;
    for (const [hand, weight] of Object.entries(item.chosen.weights)) {
      perHand[hand] ??= { r: 0, c: 0, a: 0, f: 0 };
      perHand[hand][item.letter] += weight;
    }
  }
  const fold = decoded.find((item) => item.letter === "f" && item.chosen);
  const hands = {};
  for (const [hand, weights] of Object.entries(perHand)) {
    const played = weights.r + weights.c + weights.a;
    if (fold) {
      const folded = fold.chosen.weights[hand] || 0;
      if (played + folded > 1.02) throw new Error(`${hand} action weights sum over 100%`);
    } else if (played > 1.02) {
      throw new Error(`${hand} action weights sum over 100%`);
    }
    const code = encodeWeights(weights);
    if (code) hands[hand] = code;
  }
  if (!Object.keys(hands).length) throw new Error(`${chart.key} decoded to an empty range`);
  return { hands, decoded };
}

function canonical(hands) {
  return JSON.stringify(Object.entries(hands).sort(([a], [b]) => a.localeCompare(b)));
}

function assertNotCopied(pack, key, hands) {
  const body = canonical(hands);
  for (const [other, chart] of Object.entries(pack.charts)) {
    if (other === key) continue;
    if (canonical(chart) === body) {
      throw new Error(`${key} is an exact copy of ${other}. Do not reuse a nearby stack.`);
    }
  }
}

/**
 * Plan a capture. Does not mutate the pack.
 * Clipboard charts stay write-blocked until semantics is "verified" and one reading matches the printed aggregate.
 * Pack-code charts skip clipboard guessing. Neither path writes unless the caller passes write.
 */
export function planCapture(file, pack, options = {}) {
  assertNoSecrets(file);
  const replace = new Set(options.replace ?? []);
  const errors = [];
  const notes = [];
  const charts = [];
  const mode = file.mode ?? (file.charts?.some((chart) => chart.hands) ? "codes" : "clipboard");
  if (mode === "clipboard" && file.semantics !== "verified") {
    notes.push('Clipboard syntax is unverified. Set semantics to "verified" only after one baseline reading matches 17.07 and 82.93. No write.');
  }
  for (const chart of file.charts ?? []) {
    try {
      const settings = settingsFor(file, chart);
      checkBaselineSettings(chart, settings);
      let hands = null;
      let decoded = null;
      if (mode === "codes") {
        hands = handsFromCodes(chart.hands);
      } else {
        const result = handsFromClipboard(chart);
        hands = result.hands;
        decoded = result.decoded;
        for (const item of decoded ?? []) {
          if (item.status === "empty") notes.push(`${chart.key} "${item.label}" has no clipboard text`);
          if (item.status === "ambiguous") notes.push(`${chart.key} "${item.label}" matches more than one clipboard reading`);
          if (item.status === "none") notes.push(`${chart.key} "${item.label}" matched no clipboard reading within ${AGGREGATE_TOLERANCE}pp of ${item.aggregatePct}`);
          if (item.candidates) {
            for (const candidate of item.candidates) {
              notes.push(`${chart.key} "${item.label}" ${candidate.decoder} → ${candidate.pct.toFixed(2)}% (printed ${item.aggregatePct})`);
            }
          }
        }
      }
      if (!hands) {
        const raise = decoded?.find((item) => item.label === BASELINE_40_UTG.raiseLabel);
        if (chart.key === BASELINE_40_UTG.key && raise?.hasClipboard && raise.status !== "unique") {
          throw new Error("Baseline raise clipboard does not reproduce 17.07%");
        }
        charts.push({ key: chart.key, settings, hands: null, decoded, replaces: false });
        continue;
      }
      assertNotCopied(pack, chart.key, hands);
      const exists = Boolean(pack.charts[chart.key]);
      if (exists && !replace.has(chart.key)) {
        throw new Error(`${chart.key} already exists. Pass --replace ${chart.key} to overwrite it. Existing ranges are left unchanged.`);
      }
      if (chart.key === BASELINE_40_UTG.key && mode === "clipboard") {
        const raise = decoded?.find((item) => item.label === BASELINE_40_UTG.raiseLabel);
        const fold = decoded?.find((item) => item.label === "Fold");
        if (!raise?.chosen || Math.abs(raise.chosen.pct - BASELINE_40_UTG.raisePct) > AGGREGATE_TOLERANCE) {
          throw new Error("Baseline raise clipboard does not reproduce 17.07%");
        }
        if (fold?.clipboard && (!fold.chosen || Math.abs(fold.chosen.pct - BASELINE_40_UTG.foldPct) > AGGREGATE_TOLERANCE)) {
          throw new Error("Baseline fold clipboard does not reproduce 82.93%");
        }
      }
      charts.push({
        key: chart.key,
        settings,
        hands,
        decoded,
        replaces: exists,
        raisePct: Number(actionPct(hands, "r").toFixed(2)),
        callPct: Number(actionPct(hands, "c").toFixed(2)),
        allinPct: Number(actionPct(hands, "a").toFixed(2)),
      });
    } catch (error) {
      errors.push(error.message);
    }
  }
  const clipboardBlocked = mode === "clipboard" && file.semantics !== "verified";
  const writeAllowed = errors.length === 0 && charts.length > 0 && charts.every((chart) => chart.hands) && !clipboardBlocked;
  if (!options.termsReviewed && options.write) {
    notes.push("termsReviewed is not set. --write is refused until you review GTObase terms yourself. This tool does not decide permission.");
  }
  return {
    ok: errors.length === 0,
    writeAllowed: writeAllowed && Boolean(options.termsReviewed),
    mode,
    errors,
    notes,
    charts,
  };
}

export function applyCapture(pack, plan) {
  if (!plan.writeAllowed) throw new Error("Capture is not writable");
  const next = structuredClone(pack);
  next.imports ??= [];
  const imported = [];
  for (const chart of plan.charts) {
    next.charts[chart.key] = chart.hands;
    imported.push({
      key: chart.key,
      viewerId: chart.settings.viewerId,
      query: chart.settings.query,
      antePerPlayer: chart.settings.antePerPlayer,
      sb: chart.settings.sb,
      bb: chart.settings.bb,
      model: chart.settings.model,
      modelSeenAt: chart.settings.modelSeenAt,
    });
  }
  next.imports.push({ at: new Date().toISOString(), library: "MTT 8-max", mode: plan.mode, charts: imported });
  return next;
}

export function auditPack(pack) {
  const byNode = new Map();
  for (const key of Object.keys(pack.charts)) {
    const [stack, scenario, name] = key.split(":");
    const id = `${scenario}:${name}`;
    const stacks = byNode.get(id) ?? [];
    stacks.push(Number(stack));
    byNode.set(id, stacks);
  }
  const rows = [];
  for (const [id, stacks] of [...byNode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const have = EIGHT_MAX_STACKS.filter((stack) => stacks.includes(stack));
    const miss = EIGHT_MAX_STACKS.filter((stack) => !stacks.includes(stack));
    const gto = EIGHT_MAX_STACKS.filter((stack) => DOMINANT_CHECKPOINT_KEYS.includes(`${stack}:${id}`));
    rows.push({ id, have, miss, gtoCheckpoint: gto });
  }
  const utg = pack.charts[BASELINE_40_UTG.key];
  return {
    charts: Object.keys(pack.charts).length,
    stacksField: pack.stacks,
    stack75InField: pack.stacks.includes(75),
    baselineStoredRaisePct: Number(actionPct(utg, "r").toFixed(2)),
    baselineStoredRaiseCombos: actionCombos(utg, "r"),
    rows,
  };
}
