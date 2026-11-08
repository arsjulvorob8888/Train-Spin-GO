import assert from "node:assert/strict";
import { test } from "node:test";
import { rangeMeta, rangeMetaText } from "./range-meta.ts";

const SPOTS = ["btn", "sb_raise", "bb_vs_btn_raise", "sb_fold", "hu_sb", "hu_bb_limp", "hu_bb_raise", "hu_bb_jam", "unknown-spot"];

test("every chart caption keeps its date and does not print the source name", () => {
  for (const id of SPOTS) {
    const text = rangeMetaText(id);
    assert.equal(text, `Обновлено ${rangeMeta(id).updated}`);
    assert.doesNotMatch(text, /gtobase/i);
    assert.match(rangeMeta(id).source, /gtobase\.com/i);
  }
  const header = rangeMetaText("btn");
  const training = `BTN open · BTN · 15bb. ${header}. В GAME откроется этот спот и этот рейндж.`;
  const accuracy = `Точность · BTN open ${header}`;
  const simulator = header;
  const reward = `BTN open. ${header}. Сейчас 15bb, это тот же спот на 20bb.`;
  for (const surface of [header, training, accuracy, simulator, reward]) {
    assert.doesNotMatch(surface, /gtobase/i);
    assert.match(surface, /2026-11-08/);
  }
});
