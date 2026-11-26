/**
 * Units checked against the Taostats field docs and public explorer figures.
 *
 * FDV: Backprop's SN62 page (late Nov 2026) showed about 0.006745 τ and
 * FDV $25.70m. 21,000,000 × 0.006745 τ ≈ 141,645 τ, and 141,645 × ~$181
 * (the TAO price implied by $1.22 / 0.006745) ≈ $25.6m. So FDV here is
 * 21,000,000 alpha × the Taostats spot price, in TAO. Sites that price FDV
 * off an EMA will differ; this app does not swap in an EMA it was not given.
 *
 * Emission share is (SubnetTaoInEmission + SubnetExcessTao) / that sum over
 * non-root subnets. Miner, validator, owner, and burn fractions are a split
 * of alpha emission and are not this number. A subnet with emission switched
 * off contributes 0.
 */

export const ALPHA_HARD_CAP = 21_000_000;
export const HIGH_SLIPPAGE_PCT = 1;

export function fullyDilutedTao(priceTao: number | null): number | null {
  if (priceTao == null || !(priceTao > 0) || !Number.isFinite(priceTao)) return null;
  return ALPHA_HARD_CAP * priceTao;
}

/**
 * Pool `price` is documented only as a decimal string. The equal-weight spot
 * is TAO reserve / alpha reserve. Weighted pools multiply that by w_base/w_quote,
 * which the runtime keeps between about 0.01 and 99. A raw value outside that
 * band is not divided by a guessed scale — the price is hidden.
 */
export function interpretSpotPrice(
  priceRaw: string,
  taoInRao: string,
  alphaInRao: string,
): { priceTao: number | null; divisor: number | null; note: string | null } {
  const raw = Number(priceRaw);
  const tao = Number(taoInRao) / 1e9;
  const alpha = Number(alphaInRao) / 1e9;
  if (!Number.isFinite(raw) || raw < 0 || !Number.isFinite(tao) || !Number.isFinite(alpha)) {
    return {
      priceTao: null,
      divisor: null,
      note: "Spot price hidden because the pool price or reserves could not be read.",
    };
  }
  if (alpha <= 0) {
    if (raw === 0) return { priceTao: 0, divisor: 1, note: null };
    return {
      priceTao: null,
      divisor: null,
      note: "Spot price hidden because this pool has no alpha reserve to check the price against.",
    };
  }
  const ratio = tao / alpha;
  const fits = (price: number) => {
    if (!(price > 0)) return false;
    if (!(ratio > 0)) return price < 1_000;
    const k = price / ratio;
    return k >= 0.008 && k <= 120;
  };
  if (fits(raw)) return { priceTao: raw, divisor: 1, note: null };
  if (fits(raw / 1e9)) return { priceTao: raw / 1e9, divisor: 1e9, note: null };
  return {
    priceTao: null,
    divisor: null,
    note: `Taostats price ${priceRaw} is outside the weighted-pool band of reserve ratio ${ratio.toFixed(8)}. Hidden, not rewritten.`,
  };
}

/**
 * `market_cap` has no unit in the Taostats schema. Circulating alpha is at
 * least the alpha sitting in the pool and at most total alpha (and the 21M
 * cap). The raw string is accepted only when raw, or raw/1e9, lands in that
 * band at the spot price. Otherwise the cell stays blank.
 */
export function interpretMarketCapTao(
  raw: string,
  priceTao: number | null,
  band: { minAlpha: number; maxAlpha: number },
): { tao: number | null; note: string | null } {
  if (priceTao == null || !(priceTao > 0)) {
    return { tao: null, note: "Market cap hidden because the spot price failed its unit check." };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { tao: null, note: "Taostats market_cap was not a usable number, so it is hidden." };
  }
  if (band.maxAlpha <= 0 && band.minAlpha <= 0) {
    const asTao = n / priceTao;
    if (asTao <= ALPHA_HARD_CAP * 1.02) return { tao: n, note: null };
    const asRao = n / 1e9 / priceTao;
    if (asRao <= ALPHA_HARD_CAP * 1.02) return { tao: n / 1e9, note: null };
    return {
      tao: null,
      note: "Taostats market_cap does not match spot × a supply inside the 21,000,000 alpha cap. The cell is blank on purpose.",
    };
  }
  const min = Math.max(0, band.minAlpha * 0.85);
  const cap = Math.max(band.maxAlpha, band.minAlpha, 0);
  const max = Math.min(ALPHA_HARD_CAP * 1.02, cap > 0 ? cap * 1.15 : ALPHA_HARD_CAP);
  const candidates = [
    { tao: n, supply: n / priceTao },
    { tao: n / 1e9, supply: n / 1e9 / priceTao },
  ].filter((c) => Number.isFinite(c.supply) && c.supply >= min && c.supply <= Math.max(max, min) && c.tao >= 0);

  if (candidates.length === 0) {
    return {
      tao: null,
      note: "Taostats market_cap does not match spot × a supply between pool alpha and total alpha. The cell is blank on purpose.",
    };
  }
  candidates.sort((a, b) => {
    const mid = band.maxAlpha > 0 ? band.maxAlpha : band.minAlpha;
    return Math.abs(a.supply - mid) - Math.abs(b.supply - mid);
  });
  return { tao: candidates[0].tao, note: null };
}

export type EmissionInput = {
  netuid: number;
  emission: string | null;
  excess: string | null;
  enabled: boolean | null;
};

/** Share of TAO emission, in percent. Root is omitted. Null means the row had no figure. */
export function emissionShares(rows: EmissionInput[]): Map<number, number | null> {
  const parts = rows.map((row) => {
    if (row.netuid === 0) return 0;
    if (row.enabled === false) return 0;
    if (row.emission == null && row.excess == null) return null;
    const emission = Number(row.emission ?? 0);
    const excess = Number(row.excess ?? 0);
    if (!Number.isFinite(emission) || !Number.isFinite(excess)) return null;
    return Math.max(0, emission) + Math.max(0, excess);
  });
  const total = parts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
  const out = new Map<number, number | null>();
  rows.forEach((row, index) => {
    if (row.netuid === 0) return;
    const part = parts[index];
    if (part == null || total <= 0) out.set(row.netuid, null);
    else out.set(row.netuid, (part / total) * 100);
  });
  return out;
}

export function isHighSlippage(slippagePct: string | null): boolean {
  if (slippagePct == null) return false;
  const n = Number(slippagePct);
  return Number.isFinite(n) && Math.abs(n) >= HIGH_SLIPPAGE_PCT;
}

export function isThinPool(poolTao: number | null, thresholdTao: number): boolean {
  if (poolTao == null || !Number.isFinite(poolTao)) return false;
  return poolTao < thresholdTao;
}
