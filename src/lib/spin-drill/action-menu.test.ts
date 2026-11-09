import assert from "node:assert/strict";
import { test } from "node:test";
import { legalOffers, sbFacingBtnOpen } from "./action-menu.ts";

test("SB can raise over a BTN open of 3bb at 15bb", () => {
  const menu = sbFacingBtnOpen(15, 3);
  assert.deepEqual(menu.map((item) => item.id), ["fold", "call", "raise", "allin"]);
  const raise = menu.find((item) => item.id === "raise")!;
  assert.equal(raise.spot, "bb_vs_sb_3bet");
  assert.equal(raise.label, "Raise 5");
  assert.ok(Number(raise.label.slice(6)) < 15);
});

test("a BTN raise that leaves no room becomes call or all-in only", () => {
  const menu = sbFacingBtnOpen(15, 8);
  assert.deepEqual(menu.map((item) => item.id), ["fold", "call", "allin"]);
});

test("calling an all-in does not also offer all-in", () => {
  const menu = legalOffers({ stack: 14.5, posted: 0.5, betTo: 15, lastRaise: 14, preferTo: 20 });
  assert.deepEqual(menu.map((item) => item.id), ["fold", "call"]);
});

test("a raise below the minimum is lifted, and a raise above the stack is removed", () => {
  const small = legalOffers({ stack: 14.5, posted: 0.5, betTo: 3, lastRaise: 2, preferTo: 4 });
  assert.equal(small.find((item) => item.id === "raise")?.to, 5);
  const jammed = legalOffers({ stack: 3, posted: 0.5, betTo: 2, lastRaise: 1, preferTo: 6 });
  assert.equal(jammed.find((item) => item.id === "raise"), undefined);
  assert.equal(jammed.some((item) => item.id === "allin"), true);
});

test("an unopened big blind can check and is not offered a call", () => {
  const menu = legalOffers({ stack: 14, posted: 1, betTo: 1, lastRaise: 1, preferTo: 4, canCheck: true });
  assert.deepEqual(menu.map((item) => item.id), ["check", "raise", "allin"]);
});
