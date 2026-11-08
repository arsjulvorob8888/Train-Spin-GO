import assert from "node:assert/strict";
import { test } from "node:test";
import { rangeMeta, rangeMetaText } from "./range-meta.ts";

test("BTN open caption keeps the date and does not print the source name", () => {
  assert.equal(rangeMetaText("btn"), "Обновлено 2026-11-08");
  assert.equal(rangeMeta("btn").updated, "2026-11-08");
  assert.equal(rangeMeta("btn").source, "GTOBase.com");
  assert.doesNotMatch(rangeMetaText("btn"), /GTOBase|GTObase/i);
});
