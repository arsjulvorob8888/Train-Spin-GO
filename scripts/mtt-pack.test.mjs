import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BASELINE_40_UTG,
  DOMINANT_CHECKPOINT_KEYS,
  actionPct,
  applyCapture,
  auditPack,
  chartsHash,
  decodeClipboard,
  dominantLetter,
  letterForAction,
  planCapture,
} from "./mtt-pack.mjs";

const packPath = new URL("../server/private/mtt-8max.json", import.meta.url);
const pack = JSON.parse(readFileSync(packPath, "utf8"));
const PACK_HASH = chartsHash(pack.charts);

function forty(extra = {}) {
  return {
    library: "MTT 8-max",
    viewerId: 110,
    query: 40,
    antePerPlayer: 0.12,
    sb: 0.5,
    bb: 1,
    model: null,
    ...extra,
  };
}

test("stored 40bb UTG chart stays the dominant checkpoint and is short of the page aggregate", () => {
  assert.equal(Object.keys(pack.charts).length, 211);
  assert.equal(pack.source, "GTObase.com dominant (partial 2026-11-08) + prior");
  assert.equal(PACK_HASH, "bff998a5b2bcbae8dcbd129b969927dce9713d492dbe8410f96927df45f210ba");
  const hands = pack.charts[BASELINE_40_UTG.key];
  assert.equal(Object.keys(hands).length, 39);
  assert.ok(Object.values(hands).every((code) => code === "r"));
  assert.equal(actionPct(hands, "r").toFixed(2), "16.89");
  assert.ok(Math.abs(actionPct(hands, "r") - BASELINE_40_UTG.raisePct) > 0.1);
  assert.equal(pack.charts["75:rfi:UTG"], undefined);
  assert.equal(pack.stacks.includes(75), false);
  for (const key of DOMINANT_CHECKPOINT_KEYS) {
    assert.ok(pack.charts[key], key);
    assert.ok(Object.values(pack.charts[key]).every((code) => /^[arc]$/.test(code)), key);
  }
});

test("audit separates the 8-max library depths from the dominant checkpoint", () => {
  const audit = auditPack(pack);
  assert.equal(audit.baselineStoredRaisePct, 16.89);
  assert.equal(audit.stack75InField, false);
  const utg = audit.rows.find((row) => row.id === "rfi:UTG");
  assert.deepEqual(utg.miss, [75]);
  assert.deepEqual(utg.gtoCheckpoint, [40]);
  const cold = audit.rows.find((row) => row.id === "vs-open:cold-BTN");
  assert.deepEqual(cold.gtoCheckpoint, []);
  assert.deepEqual(cold.miss, [40, 75]);
});

test("dominant ties prefer all-in, then raise, then call, and a tie with fold stays fold", () => {
  assert.equal(dominantLetter("a50c50"), "a");
  assert.equal(dominantLetter("r50c50"), "r");
  assert.equal(dominantLetter("c50"), "");
  assert.equal(dominantLetter("c51"), "c");
  assert.equal(dominantLetter("r50"), "");
  assert.equal(dominantLetter("r30"), "");
});

test("40bb SB action labels stay separate sizes", () => {
  assert.equal(letterForAction("Call1", 40), "c");
  assert.equal(letterForAction("Raise3.3", 40), "r");
  assert.equal(letterForAction("Raise40", 40), "a");
  assert.equal(letterForAction("Raise40(allin)", 40), "a");
  assert.equal(letterForAction("Raise to 2.00", 40), "r");
});

test("pack-code import adds one missing chart and does not touch the stored pack", () => {
  const plan = planCapture(
    forty({
      mode: "codes",
      viewerId: 999,
      query: 75,
      charts: [{ key: "75:rfi:UTG", hands: { "72o": "r40" } }],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.writeAllowed, true);
  const next = applyCapture(pack, plan);
  assert.equal(next.charts["75:rfi:UTG"]["72o"], "r40");
  assert.equal(chartsHash(pack.charts), PACK_HASH);
  assert.deepEqual(next.charts["40:rfi:UTG"], pack.charts["40:rfi:UTG"]);
  assert.equal(next.imports.at(-1).charts[0].model, null);
});

test("existing charts and nearby copies are refused", () => {
  const overwrite = planCapture(forty({ mode: "codes", charts: [{ key: "40:rfi:UTG", hands: { "72o": "r" } }] }), pack, {
    termsReviewed: true,
    write: true,
  });
  assert.match(overwrite.errors.join("\n"), /already exists/);
  const copied = planCapture(
    forty({
      mode: "codes",
      viewerId: 999,
      query: 75,
      charts: [{ key: "75:rfi:UTG", hands: pack.charts["40:rfi:UTG"] }],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.match(copied.errors.join("\n"), /exact copy/);
  assert.equal(chartsHash(pack.charts), PACK_HASH);
});

test("9-max depths, unknown depths, reused viewer id, inferred model, and secrets are refused", () => {
  const nine = planCapture(forty({ mode: "codes", query: 30, charts: [{ key: "30:rfi:UTG", hands: { AA: "r" } }] }), pack, {
    termsReviewed: true,
    write: true,
  });
  assert.match(nine.errors.join("\n"), /9-max/);
  const seventy = planCapture(
    forty({ mode: "codes", viewerId: 999, query: 70, charts: [{ key: "70:rfi:UTG", hands: { AA: "r" } }] }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.match(seventy.errors.join("\n"), /only 40, 50, 75, 100/);
  const reused = planCapture(
    forty({
      mode: "codes",
      charts: [{ key: "50:rfi:UTG", viewerId: 110, query: 50, antePerPlayer: 0.12, sb: 0.5, bb: 1, hands: { AA: "r" } }],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.match(reused.errors.join("\n"), /id 110/);
  const model = planCapture(forty({ mode: "codes", model: "chipEV", charts: [{ key: "40:vs-open:cold-BTN", hands: { AA: "a" } }] }), pack, {
    termsReviewed: true,
    write: true,
  });
  assert.match(model.errors.join("\n"), /chipEV or ICM/);
  assert.throws(() => planCapture(forty({ password: "nope", mode: "codes", charts: [] }), pack), /account data/);
});

test("two non-all-in raise sizes are not collapsed", () => {
  const plan = planCapture(
    forty({
      mode: "clipboard",
      semantics: "verified",
      charts: [
        {
          key: "40:vs-open:BTNopen-vs-blind3bet",
          actions: [
            { label: "Raise to 2.00", aggregatePct: 0.45, clipboard: "AA" },
            { label: "Raise to 6.00", aggregatePct: 0.45, clipboard: "KK" },
          ],
        },
      ],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.match(plan.errors.join("\n"), /two actions/);
});

test("unverified clipboard is reported and not writable", () => {
  const raisePct = (6 / 1326) * 100;
  const plan = planCapture(
    forty({
      mode: "clipboard",
      semantics: "unverified",
      charts: [
        {
          key: "40:vs-open:cold-BTN",
          actions: [{ label: "Raise to 2.00", aggregatePct: Number(raisePct.toFixed(2)), clipboard: "AA:1" }],
        },
      ],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.equal(plan.writeAllowed, false);
  assert.match(plan.notes.join("\n"), /unverified/);
  assert.equal(chartsHash(pack.charts), PACK_HASH);
});

test("a clipboard reading is accepted only when it matches the printed aggregate", () => {
  const unique = decodeClipboard("AA:1", (6 / 1326) * 100);
  assert.equal(unique.status, "unique");
  assert.equal(unique.chosen.decoder, "fraction");
  const combos = decodeClipboard("AKs:2", (2 / 1326) * 100);
  assert.equal(combos.status, "unique");
  assert.equal(combos.chosen.decoder, "combos");
  const ambiguous = decodeClipboard("AA", (6 / 1326) * 100);
  assert.equal(ambiguous.status, "unique");
  const none = decodeClipboard("AA:1", 50);
  assert.equal(none.status, "none");
});

test("a verified clipboard that matches its printed aggregate can be applied without touching other charts", () => {
  const pct = Number((((6 / 1326) * 100).toFixed(2)));
  const plan = planCapture(
    forty({
      mode: "clipboard",
      semantics: "verified",
      charts: [
        {
          key: "40:vs-open:cold-BTN",
          actions: [{ label: "Raise to 2.00", aggregatePct: pct, clipboard: "AA:1" }],
        },
      ],
    }),
    pack,
    { termsReviewed: true, write: true },
  );
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.writeAllowed, true);
  assert.equal(plan.charts[0].hands.AA, "r");
  const next = applyCapture(pack, plan);
  assert.equal(next.charts["40:vs-open:cold-BTN"].AA, "r");
  assert.equal(Object.keys(next.charts).length, Object.keys(pack.charts).length + 1);
  assert.equal(chartsHash(pack.charts), PACK_HASH);
});

test("verified baseline clipboard may replace 40:rfi:UTG only when the printed split matches", () => {
  const clipboard = Object.keys(pack.charts["40:rfi:UTG"])
    .map((hand) => `${hand}:1`)
    .join(",");
  const storedPct = actionPct(pack.charts["40:rfi:UTG"], "r");
  const wrong = planCapture(
    forty({
      mode: "clipboard",
      semantics: "verified",
      charts: [
        {
          key: "40:rfi:UTG",
          actions: [
            { label: "Raise to 2.00", aggregatePct: 17.07, clipboard },
            { label: "Fold", aggregatePct: 82.93, clipboard: "" },
          ],
        },
      ],
    }),
    pack,
    { termsReviewed: true, write: true, replace: ["40:rfi:UTG"] },
  );
  assert.match(wrong.errors.join("\n"), /17\.07/);
  assert.ok(Math.abs(storedPct - 17.07) > 0.1);
});

test("write stays off without a terms review flag", () => {
  const plan = planCapture(
    forty({
      mode: "codes",
      viewerId: 999,
      query: 75,
      charts: [{ key: "75:rfi:UTG", hands: { "72o": "r" } }],
    }),
    pack,
    { write: true },
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.writeAllowed, false);
  assert.match(plan.notes.join("\n"), /termsReviewed/);
});

test("commands do not rewrite the pack", () => {
  const before = createHash("sha256").update(readFileSync(packPath)).digest("hex");
  const audit = spawnSync(process.execPath, ["scripts/import-mtt-charts.mjs", "--audit"], { encoding: "utf8" });
  assert.equal(audit.status, 0, audit.stderr);
  assert.match(audit.stdout, /"baselineStoredRaisePct": 16.89/);
  const dry = spawnSync(process.execPath, ["scripts/import-mtt-charts.mjs", "--from", "scripts/fixtures/mtt-capture.example.json", "--write"], {
    encoding: "utf8",
  });
  assert.equal(dry.status, 2, dry.stdout + dry.stderr);
  const rebuild = spawnSync(process.execPath, ["scripts/build-mtt-charts.mjs"], { encoding: "utf8" });
  assert.equal(rebuild.status, 1);
  assert.match(rebuild.stderr, /Refusing to overwrite/);
  const after = createHash("sha256").update(readFileSync(packPath)).digest("hex");
  assert.equal(after, before);
});
