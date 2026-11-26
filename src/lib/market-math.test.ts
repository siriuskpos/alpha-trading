import assert from "node:assert/strict";
import test from "node:test";
import {
  emissionShares,
  fullyDilutedTao,
  interpretMarketCapTao,
  interpretSpotPrice,
} from "./market-math";

test("spot price matches the reserve ratio, and a rao-scaled twin is divided once", () => {
  const tao = String(1000 * 1e9);
  const alpha = String(200_000 * 1e9);
  const plain = interpretSpotPrice("0.005", tao, alpha);
  assert.equal(plain.priceTao, 0.005);
  assert.equal(plain.divisor, 1);
  const scaled = interpretSpotPrice(String(0.005 * 1e9), tao, alpha);
  assert.equal(scaled.divisor, 1e9);
  assert.ok(scaled.priceTao != null && Math.abs(scaled.priceTao - 0.005) < 1e-9);
});

test("a price outside the weighted-pool band is hidden", () => {
  const tao = String(1000 * 1e9);
  const alpha = String(200_000 * 1e9);
  const hidden = interpretSpotPrice("42", tao, alpha);
  assert.equal(hidden.priceTao, null);
  assert.match(hidden.note ?? "", /Hidden/);
});

test("market cap accepts TAO or rao only inside the pool-to-total band", () => {
  const price = 0.006745;
  const band = { minAlpha: 3_600_000, maxAlpha: 8_000_000 };
  const tao = interpretMarketCapTao(String(price * 6_080_000), price, band);
  assert.ok(tao.tao != null && Math.abs(tao.tao - price * 6_080_000) < 1);
  const asRao = price * 6_080_000 * 1e9;
  const rao = interpretMarketCapTao(String(asRao), price, band);
  assert.ok(rao.tao != null && Math.abs(rao.tao - price * 6_080_000) / (price * 6_080_000) < 0.01);
  const mismatch = interpretMarketCapTao("123", price, band);
  assert.equal(mismatch.tao, null);
});

test("FDV is 21,000,000 alpha times spot", () => {
  const price = 0.006745;
  const fdv = fullyDilutedTao(price);
  assert.ok(fdv != null && Math.abs(fdv - 21_000_000 * price) < 1e-6);
});

test("emission share uses TAO emission plus excess, not the miner split", () => {
  const shares = emissionShares([
    { netuid: 0, emission: "999", excess: "0", enabled: true },
    { netuid: 1, emission: "100", excess: "50", enabled: true },
    { netuid: 2, emission: "50", excess: "0", enabled: true },
    { netuid: 3, emission: "999", excess: "0", enabled: false },
  ]);
  assert.equal(shares.has(0), false);
  assert.ok(Math.abs((shares.get(1) ?? 0) - 75) < 1e-9);
  assert.ok(Math.abs((shares.get(2) ?? 0) - 25) < 1e-9);
  assert.equal(shares.get(3), 0);
});
