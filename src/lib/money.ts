/** 1 TAO = 1e9 rao. Amounts move as integers so fills do not drift. */

export const RAO = 1_000_000_000n;
const PRICE_DP = 12;
const PRICE_SCALE = 10n ** BigInt(PRICE_DP);

/** Parse a Taostats rao string. The integer is already rao, not TAO. */
export function parseRao(value: string | null | undefined): bigint {
  if (value == null) return 0n;
  const s = value.trim();
  if (s === "") return 0n;
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Not a rao amount: ${value}`);
  }
  const neg = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  let v = BigInt(whole);
  if (frac.length > 0 && frac[0] >= "5") v += 1n;
  return neg ? -v : v;
}

/** Human TAO or alpha. At most 9 decimal places — one rao. */
export function humanToRaoAllowZero(value: string): bigint {
  const s = value.trim();
  if (/^0+(?:\.0+)?$/.test(s)) return 0n;
  return humanToRao(s);
}

export function humanToRao(value: string): bigint {
  const s = value.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error("Amount must be a number greater than zero.");
  }
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 9) {
    throw new Error("Use at most 9 decimal places. 1 TAO = 1e9 rao.");
  }
  if (whole.length > 12) {
    throw new Error("That amount is larger than this book will accept.");
  }
  const rao = BigInt(whole) * RAO + BigInt((frac + "000000000").slice(0, 9));
  if (rao <= 0n) throw new Error("Amount must be greater than zero.");
  return rao;
}

export function raoToHuman(rao: bigint, maxDp = 9): string {
  const neg = rao < 0n;
  const v = neg ? -rao : rao;
  const dp = Math.max(0, Math.min(9, maxDp));
  const whole = v / RAO;
  let frac = (v % RAO).toString().padStart(9, "0").slice(0, dp);
  frac = frac.replace(/0+$/, "");
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

/** TAO-per-alpha price string, up to 12 decimal places, scaled integer. */
export function priceToScale(value: string): bigint {
  const s = value.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Not a price: ${value}`);
  }
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(PRICE_DP)).slice(0, PRICE_DP);
  const round = frac.length > PRICE_DP && frac[PRICE_DP] >= "5" ? 1n : 0n;
  return BigInt(whole) * PRICE_SCALE + BigInt(padded) + round;
}

export function scaleToPrice(scale: bigint): string {
  const neg = scale < 0n;
  const v = neg ? -scale : scale;
  const whole = v / PRICE_SCALE;
  const frac = (v % PRICE_SCALE).toString().padStart(PRICE_DP, "0").replace(/0+$/, "");
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

/** Alpha rao × TAO-per-alpha = TAO rao. */
export function valueOfAlpha(alphaRao: bigint, priceTao: string): bigint {
  return (alphaRao * priceToScale(priceTao)) / PRICE_SCALE;
}

/** TAO rao / alpha rao = TAO per alpha. */
export function fillPrice(taoRao: bigint, alphaRao: bigint): string {
  if (alphaRao <= 0n) throw new Error("Alpha out is zero, so there is no fill price.");
  const scale = (taoRao * PRICE_SCALE) / alphaRao;
  return scaleToPrice(scale);
}

export function comparePriceGapPct(fill: string, mid: string): number | null {
  const f = Number(fill);
  const m = Number(mid);
  if (!Number.isFinite(f) || !Number.isFinite(m) || m === 0) return null;
  return ((f - m) / m) * 100;
}
