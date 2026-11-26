import { fillPrice, humanToRaoAllowZero, raoToHuman, valueOfAlpha } from "./money";
import { etDateKey } from "./time";

export type Fill = {
  id: string;
  at: string;
  netuid: number;
  side: "buy" | "sell";
  tao: bigint;
  alpha: bigint;
  /** Execution price in TAO per alpha, when the source gave one. */
  price: string | null;
  reason: string;
};

export type OpenLot = { alpha: bigint; cost: bigint };

export type ClosedFill = {
  id: string;
  at: string;
  netuid: number;
  realized: bigint;
  cost: bigint;
};

export type ReplayRow = {
  id: string;
  at: string;
  side: "buy" | "sell";
  netuid: number;
  sizeTao: bigint;
  sizeAlpha: bigint;
  price: string | null;
  reason: string;
  status: "open" | "closed";
  unrealized: boolean;
  /** Realized on sells. Buys stay null here; open-buy unrealized is priced later. */
  pl: bigint | null;
  costBasis: bigint | null;
  remainingAlpha: bigint;
  /** Set when a sell was larger than the buys we have. P/L covers only the matched alpha. */
  unmatchedAlpha: bigint;
};

export type Replay = {
  cash: bigint;
  invested: bigint;
  realized: bigint;
  gained: bigint;
  lost: bigint;
  closed: ClosedFill[];
  rows: ReplayRow[];
  open: Map<number, OpenLot>;
  /** Last equity of each ET day, in TAO rao. */
  equityByDay: Map<string, bigint>;
  dailyRealized: Map<string, bigint>;
};

type Lot = { id: string; alpha: bigint; cost: bigint };

function priceOf(fill: Fill): string | null {
  if (fill.price) return fill.price;
  if (fill.alpha > 0n && fill.tao >= 0n) {
    try {
      return fillPrice(fill.tao, fill.alpha);
    } catch {
      return null;
    }
  }
  return null;
}

function markOpen(books: Map<number, Lot[]>, marks: Map<number, string>): bigint {
  let value = 0n;
  for (const [netuid, lots] of books) {
    const price = marks.get(netuid);
    if (!price) continue;
    for (const lot of lots) {
      if (lot.alpha > 0n) value += valueOfAlpha(lot.alpha, price);
    }
  }
  return value;
}

function consume(lots: Lot[], alpha: bigint): { cost: bigint; matched: bigint } {
  let need = alpha;
  let cost = 0n;
  const next: Lot[] = [];
  for (const lot of lots) {
    if (need <= 0n || lot.alpha <= 0n) {
      if (lot.alpha > 0n) next.push(lot);
      continue;
    }
    if (lot.alpha <= need) {
      cost += lot.cost;
      need -= lot.alpha;
    } else {
      const takeCost = (lot.cost * need) / lot.alpha;
      cost += takeCost;
      next.push({ id: lot.id, alpha: lot.alpha - need, cost: lot.cost - takeCost });
      need = 0n;
    }
  }
  lots.length = 0;
  lots.push(...next);
  return { cost, matched: alpha - need };
}

/**
 * FIFO replay. Buys open lots at the TAO paid. Sells close oldest lots.
 * A sell larger than the open lots does not invent a cost for the extra alpha:
 * realized P/L is only on the matched portion, and `unmatchedAlpha` records the rest.
 * Equity marks open lots at the latest execution price seen for that subnet.
 */
export function replayFills(fills: Fill[], startingCash: bigint): Replay {
  const ordered = [...fills].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const books = new Map<number, Lot[]>();
  const marks = new Map<number, string>();
  const rows: ReplayRow[] = [];
  const closed: ClosedFill[] = [];
  const equityByDay = new Map<string, bigint>();
  const dailyRealized = new Map<string, bigint>();

  let cash = startingCash;
  let invested = 0n;
  let realized = 0n;
  let gained = 0n;
  let lost = 0n;

  const snapshot = (at: string) => {
    const key = etDateKey(at);
    if (!key) return;
    equityByDay.set(key, cash + markOpen(books, marks));
  };

  for (const fill of ordered) {
    const px = priceOf(fill);
    if (px) marks.set(fill.netuid, px);
    const lots = books.get(fill.netuid) ?? [];
    books.set(fill.netuid, lots);

    if (fill.side === "buy") {
      cash -= fill.tao;
      invested += fill.tao;
      if (fill.alpha > 0n) lots.push({ id: fill.id, alpha: fill.alpha, cost: fill.tao });
      rows.push({
        id: fill.id,
        at: fill.at,
        side: "buy",
        netuid: fill.netuid,
        sizeTao: fill.tao,
        sizeAlpha: fill.alpha,
        price: px,
        reason: fill.reason,
        status: "open",
        unrealized: true,
        pl: null,
        costBasis: fill.tao,
        remainingAlpha: fill.alpha,
        unmatchedAlpha: 0n,
      });
    } else {
      const { cost, matched } = consume(lots, fill.alpha);
      const matchedTao = fill.alpha > 0n ? (fill.tao * matched) / fill.alpha : 0n;
      const pl = matched > 0n ? matchedTao - cost : null;
      const unmatched = fill.alpha - matched;
      cash += fill.tao;
      if (pl != null) {
        realized += pl;
        if (pl > 0n) gained += pl;
        else if (pl < 0n) lost += pl;
        closed.push({ id: fill.id, at: fill.at, netuid: fill.netuid, realized: pl, cost });
        const day = etDateKey(fill.at);
        if (day) dailyRealized.set(day, (dailyRealized.get(day) ?? 0n) + pl);
      }
      rows.push({
        id: fill.id,
        at: fill.at,
        side: "sell",
        netuid: fill.netuid,
        sizeTao: fill.tao,
        sizeAlpha: fill.alpha,
        price: px,
        reason: fill.reason,
        status: "closed",
        unrealized: false,
        pl,
        costBasis: matched > 0n ? cost : null,
        remainingAlpha: 0n,
        unmatchedAlpha: unmatched,
      });
    }
    snapshot(fill.at);
  }

  for (const row of rows) {
    if (row.side !== "buy") continue;
    const lot = (books.get(row.netuid) ?? []).find((item) => item.id === row.id);
    const remaining = lot?.alpha ?? 0n;
    row.remainingAlpha = remaining;
    if (remaining > 0n) {
      row.status = "open";
      row.unrealized = true;
      row.costBasis = lot?.cost ?? null;
      row.pl = null;
    } else {
      row.status = "closed";
      row.unrealized = false;
      row.pl = null;
      row.costBasis = null;
    }
  }

  const open = new Map<number, OpenLot>();
  for (const [netuid, lots] of books) {
    const alpha = lots.reduce((sum, lot) => sum + lot.alpha, 0n);
    const cost = lots.reduce((sum, lot) => sum + lot.cost, 0n);
    if (alpha > 0n) open.set(netuid, { alpha, cost });
  }

  return { cash, invested, realized, gained, lost, closed, rows, open, equityByDay, dailyRealized };
}

export function unrealizedOnOpen(open: Map<number, OpenLot>, prices: Map<number, string>): {
  total: bigint | null;
  byNetuid: Map<number, bigint | null>;
  missing: number[];
} {
  let total = 0n;
  let any = false;
  const byNetuid = new Map<number, bigint | null>();
  const missing: number[] = [];
  for (const [netuid, lot] of open) {
    const price = prices.get(netuid);
    if (!price) {
      byNetuid.set(netuid, null);
      missing.push(netuid);
      continue;
    }
    const value = valueOfAlpha(lot.alpha, price);
    const pl = value - lot.cost;
    byNetuid.set(netuid, pl);
    total += pl;
    any = true;
  }
  return { total: any || open.size === 0 ? total : null, byNetuid, missing };
}

export function plPercent(pl: bigint | null, cost: bigint | null): string | null {
  if (pl == null || cost == null || cost <= 0n) return null;
  const pct = (Number(pl) / Number(cost)) * 100;
  if (!Number.isFinite(pct)) return null;
  return pct.toFixed(4);
}

export function meanRao(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0n);
  return sum / BigInt(values.length);
}

export function raoMapToPoints(map: Map<string, bigint>): { t: string; v: number }[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, rao]) => ({ t, v: Number(raoToHuman(rao, 6)) }));
}

export function startingRao(startingTao: string): bigint {
  return humanToRaoAllowZero(startingTao);
}
