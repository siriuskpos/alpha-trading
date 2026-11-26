import assert from "node:assert/strict";
import test from "node:test";
import { fillPrice, humanToRao, parseRao, raoToHuman, valueOfAlpha } from "./money";

test("1 TAO is 1e9 rao", () => {
  assert.equal(humanToRao("1"), 1_000_000_000n);
  assert.equal(humanToRao("0.000000001"), 1n);
  assert.equal(raoToHuman(1_500_000_000n), "1.5");
});

test("rejects more than 9 decimal places", () => {
  assert.throws(() => humanToRao("1.0000000001"), /9 decimal/);
});

test("alpha value uses the TAO price", () => {
  const oneAlpha = humanToRao("1");
  assert.equal(valueOfAlpha(oneAlpha, "0.006745"), humanToRao("0.006745"));
  assert.equal(fillPrice(humanToRao("0.4"), humanToRao("100")), "0.004");
});

test("parseRao accepts integer rao strings", () => {
  assert.equal(parseRao("1500000000"), 1_500_000_000n);
  assert.equal(raoToHuman(parseRao("1500000000"), 4), "1.5");
});
