import {
  countTrades,
  getDb,
  listTrades,
  readFavorites,
  readSettings,
  type TradeRow,
} from "./db";
import { getMarket } from "./market";
import {
  meanRao,
  plPercent,
  raoMapToPoints,
  replayFills,
  startingRao,
  unrealizedOnOpen,
  type ClosedFill,
  type Fill,
  type Replay,
} from "./book";
import {
  comparePriceGapPct,
  fillPrice,
  humanToRao,
  humanToRaoAllowZero,
  parseRao,
  raoToHuman,
  valueOfAlpha,
} from "./money";
import { isHighSlippage, isThinPool } from "./market-math";
import { taostatsAll, taostatsGet, TaostatsError } from "./taostats";
import { etDateKey, inEtRange } from "./time";
import type {
  BookMode,
  DashboardPayload,
  HistoryPayload,
  HistoryRow,
  QuotePayload,
  QuoteView,
  SettingsPayload,
  TradeHighlight,
} from "./types";

export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

type SlippageRow = {
  alpha_fee: string;
  alpha_price: string;
  block_number: number;
  diff: string;
  direction: string;
  exceeds_reserve: boolean;
  expected_output_tokens: string;
  input_tokens: string;
  netuid: number;
  output_tokens: string;
  slippage: string;
  tao_fee: string;
  timestamp: string;
};

type PortfolioRow = {
  netuid: number;
  balance: string;
  balance_as_tao: string;
  realised_profit_tao: string;
  unrealised_profit_tao: string;
  total_bought_alpha_as_tao: string;
  current_market_price_tao: string;
  hotkey: string;
};

type StakeEvent = {
  id: string;
  action: string;
  alpha: string | null;
  alpha_price_in_tao: string | null;
  amount: string;
  coldkey: string;
  extrinsic_id: string | null;
  hotkey: string;
  is_transfer: boolean;
  netuid: number | null;
  registration_collateral: boolean;
  timestamp: string;
  validator_swap: boolean;
};

const slippageCache = new Map<string, { at: number; row: SlippageRow }>();
const realCache = new Map<string, { at: number; portfolio: PortfolioRow[]; events: StakeEvent[]; truncated: boolean }>();

function namesFrom(subnets: { netuid: number; name: string }[]): Map<number, string> {
  return new Map(subnets.map((row) => [row.netuid, row.name]));
}

function pricesFrom(subnets: { netuid: number; priceTao: string | null }[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of subnets) {
    if (row.priceTao) map.set(row.netuid, row.priceTao);
  }
  return map;
}

function virtualFills(rows: TradeRow[]): Fill[] {
  return rows.map((row) => ({
    id: String(row.id),
    at: row.created_at,
    netuid: row.netuid,
    side: row.side,
    tao: humanToRao(row.tao_amount),
    alpha: humanToRao(row.alpha_amount),
    price: row.price_fill,
    reason: row.reason,
  }));
}

function replayVirtual(): { replay: Replay; starting: string } {
  const settings = readSettings();
  const replay = replayFills(virtualFills(listTrades()), startingRao(settings.starting_tao));
  return { replay, starting: settings.starting_tao };
}

function highlights(closed: ClosedFill[], names: Map<number, string>): {
  winRate: string | null;
  winSample: number;
  wins: number;
  avgWinTao: string | null;
  avgLossTao: string | null;
  best: TradeHighlight | null;
  worst: TradeHighlight | null;
} {
  const wins = closed.filter((row) => row.realized > 0n);
  const losses = closed.filter((row) => row.realized < 0n);
  const pick = (rows: ClosedFill[], dir: "max" | "min"): TradeHighlight | null => {
    if (rows.length === 0) return null;
    const chosen = rows.reduce((best, row) => {
      if (dir === "max") return row.realized > best.realized ? row : best;
      return row.realized < best.realized ? row : best;
    });
    const name = names.get(chosen.netuid) ?? "Unknown";
    return {
      label: `SN ${chosen.netuid} ${name}`,
      tao: raoToHuman(chosen.realized, 4),
      at: chosen.at,
    };
  };
  const avg = (rows: ClosedFill[]) => {
    const mean = meanRao(rows.map((row) => row.realized));
    return mean == null ? null : raoToHuman(mean, 4);
  };
  return {
    winRate: closed.length ? ((wins.length / closed.length) * 100).toFixed(2) : null,
    winSample: closed.length,
    wins: wins.length,
    avgWinTao: avg(wins),
    avgLossTao: avg(losses),
    best: pick(closed, "max"),
    worst: pick(closed, "min"),
  };
}

function presentHistory(
  replay: Replay,
  prices: Map<number, string>,
  names: Map<number, string>,
  hidePl: boolean,
): HistoryRow[] {
  const rows: HistoryRow[] = replay.rows.map((row) => {
    const current = prices.get(row.netuid) ?? null;
    let pl: bigint | null = null;
    let cost: bigint | null = null;
    let unrealized = false;
    if (!hidePl && row.side === "sell") {
      pl = row.pl;
      cost = row.costBasis;
    } else if (!hidePl && row.side === "buy" && row.status === "open" && row.costBasis != null && current) {
      pl = valueOfAlpha(row.remainingAlpha, current) - row.costBasis;
      cost = row.costBasis;
      unrealized = true;
    }
    let reason = row.reason;
    if (row.unmatchedAlpha > 0n) {
      reason = `${reason} Part of this sell had no matching buy in the fetched trades, so P/L covers only the matched alpha.`.trim();
    }
    return {
      id: row.id,
      at: row.at,
      side: row.side,
      netuid: row.netuid,
      name: names.get(row.netuid) ?? "Unknown",
      sizeTao: raoToHuman(row.sizeTao, 4),
      sizeAlpha: raoToHuman(row.sizeAlpha, 4),
      priceTao: row.price,
      currentPriceTao: current,
      plTao: pl == null ? null : raoToHuman(pl, 4),
      plPct: plPercent(pl, cost),
      status: row.status,
      unrealized,
      reason,
    };
  });
  rows.reverse();
  return rows;
}

function subnetPl(replay: Replay, unrealized: Map<number, bigint | null>, names: Map<number, string>) {
  const realized = new Map<number, bigint>();
  for (const row of replay.closed) {
    realized.set(row.netuid, (realized.get(row.netuid) ?? 0n) + row.realized);
  }
  const ids = new Set<number>([...realized.keys(), ...unrealized.keys()]);
  return [...ids].map((netuid) => {
    const realizedTao = Number(raoToHuman(realized.get(netuid) ?? 0n, 6));
    const open = unrealized.get(netuid);
    const openTao = open == null ? 0 : Number(raoToHuman(open, 6));
    return {
      netuid,
      name: names.get(netuid) ?? "Unknown",
      tao: realizedTao + openTao,
    };
  });
}

export async function virtualDashboard(): Promise<DashboardPayload> {
  let marketError: string | null = null;
  const market = await getMarket(false).catch((error: unknown) => {
    if (error instanceof TaostatsError) {
      marketError = error.message;
      return null;
    }
    throw error;
  });
  const { replay, starting } = replayVirtual();
  const names = namesFrom(market?.subnets ?? []);
  const prices = pricesFrom(market?.subnets ?? []);
  const open = unrealizedOnOpen(replay.open, prices);
  const stats = highlights(replay.closed, names);
  const equity = new Map(replay.equityByDay);
  if (replay.rows.length > 0 && open.missing.length === 0) {
    let live = replay.cash;
    for (const [netuid, lot] of replay.open) {
      const price = prices.get(netuid);
      if (!price) continue;
      live += valueOfAlpha(lot.alpha, price);
    }
    const today = etDateKey(new Date().toISOString());
    if (today) equity.set(today, live);
  }
  const taoUsd = market?.taoUsd ?? null;
  const notes = [
    "Open P/L is marked at the Taostats spot (mid), not at an unwind quote.",
    "Today on the balance line uses that live mid. Earlier days use the last virtual fill on each subnet.",
    "Win rate counts closed sells. A sell is a win when realized P/L is above zero.",
  ];
  if (open.missing.length > 0) {
    notes.push(
      `Unrealized omits SN ${open.missing.join(", SN ")} because that spot price failed its unit check.`,
    );
  }
  if (marketError) notes.push(marketError);
  if (market?.warning) notes.push(market.warning);
  return {
    mode: "virtual",
    investedTao: raoToHuman(replay.invested, 4),
    gainedTao: raoToHuman(replay.gained, 4),
    lostTao: raoToHuman(replay.lost, 4),
    realizedTao: raoToHuman(replay.realized, 4),
    unrealizedTao: open.missing.length > 0 && open.total == null ? null : raoToHuman(open.total ?? 0n, 4),
    taoUsd,
    cashTao: raoToHuman(replay.cash, 4),
    startingTao: starting,
    ...stats,
    equity: replay.rows.length ? raoMapToPoints(equity) : [],
    daily: raoMapToPoints(replay.dailyRealized),
    holdings: [...replay.open.entries()].map(([netuid, lot]) => {
      const price = prices.get(netuid) ?? null;
      const value = price ? valueOfAlpha(lot.alpha, price) : null;
      const usd = value != null && taoUsd ? Number(raoToHuman(value, 6)) * Number(taoUsd) : null;
      return {
        netuid,
        name: names.get(netuid) ?? "Unknown",
        alpha: raoToHuman(lot.alpha, 4),
        valueTao: value == null ? null : raoToHuman(value, 4),
        valueUsd: usd == null || !Number.isFinite(usd) ? null : usd.toFixed(2),
        unrealizedTao: open.byNetuid.get(netuid) == null ? null : raoToHuman(open.byNetuid.get(netuid)!, 4),
      };
    }),
    bySubnet: subnetPl(replay, open.byNetuid, names),
    fetchedAt: market?.fetchedAt ?? null,
    warning: marketError ?? market?.warning ?? null,
    notes,
    coldkey: null,
  };
}

async function loadReal(coldkey: string, fresh: boolean) {
  const hit = realCache.get(coldkey);
  if (hit && !fresh && Date.now() - hit.at < 90_000) return hit;
  const [portfolio, events] = await Promise.all([
    taostatsGet<PortfolioRow>("/v1/alpha/portfolio", { coldkey }),
    taostatsAll<StakeEvent>(
      "/v1/subnets/stake-events",
      { coldkey, trades_only: true, order_dir: "desc" },
      15,
    ),
  ]);
  const packed = {
    at: Date.now(),
    portfolio: portfolio.data ?? [],
    events: events.rows,
    truncated: events.truncated,
  };
  realCache.set(coldkey, packed);
  return packed;
}

function emptyReal(coldkey: string | null, warning: string, notes: string[] = []): DashboardPayload {
  return {
    mode: "real",
    investedTao: "0",
    gainedTao: "0",
    lostTao: "0",
    realizedTao: "0",
    unrealizedTao: "0",
    taoUsd: null,
    cashTao: null,
    startingTao: null,
    winRate: null,
    winSample: 0,
    wins: 0,
    avgWinTao: null,
    avgLossTao: null,
    best: null,
    worst: null,
    equity: [],
    daily: [],
    holdings: [],
    bySubnet: [],
    fetchedAt: null,
    warning,
    notes,
    coldkey,
  };
}

export async function realDashboard(): Promise<DashboardPayload> {
  const settings = readSettings();
  if (!settings.coldkey) {
    return emptyReal(null, "No coldkey in Settings — Real mode is empty.");
  }
  const market = await getMarket(false);
  const book = await loadReal(settings.coldkey, false);
  const names = namesFrom(market.subnets);
  const prices = pricesFrom(market.subnets);
  const byNetuid = new Map<number, { alpha: bigint; value: bigint; realized: bigint; unrealized: bigint; bought: bigint }>();
  for (const row of book.portfolio) {
    const slot = byNetuid.get(row.netuid) ?? { alpha: 0n, value: 0n, realized: 0n, unrealized: 0n, bought: 0n };
    slot.alpha += parseRao(row.balance);
    slot.value += parseRao(row.balance_as_tao);
    slot.realized += parseRao(row.realised_profit_tao);
    slot.unrealized += parseRao(row.unrealised_profit_tao);
    slot.bought += parseRao(row.total_bought_alpha_as_tao);
    byNetuid.set(row.netuid, slot);
  }
  let invested = 0n;
  let realized = 0n;
  let unrealized = 0n;
  let gained = 0n;
  let lost = 0n;
  for (const slot of byNetuid.values()) {
    invested += slot.bought;
    realized += slot.realized;
    unrealized += slot.unrealized;
    if (slot.realized > 0n) gained += slot.realized;
    else if (slot.realized < 0n) lost += slot.realized;
  }

  const fills = stakeFills(book.events);
  const replay = replayFills(fills, 0n);
  const stats = book.truncated
    ? { winRate: null, winSample: 0, wins: 0, avgWinTao: null, avgLossTao: null, best: null, worst: null }
    : highlights(replay.closed, names);
  const taoUsd = market.taoUsd;
  const notes = [
    "Realized, unrealized, invested, gained, and lost tiles sum Taostats portfolio fields (stored in rao, shown in TAO). Gained and lost split that realized figure by subnet.",
    "Win rate, best and worst trade, the daily bars, and the balance line are FIFO on stake and unstake events (trades_only). Emissions are not fills.",
    "Registration-collateral legs are left out. This book is read-only and is never added to the virtual book.",
  ];
  if (book.truncated) {
    notes.push("Stake-event history hit the 3,000 row cap, so per-trade stats are hidden. Portfolio tiles still come from Taostats.");
  }
  const fifoRealized = replay.realized;
  const gap = realized - fifoRealized;
  if (!book.truncated && (gap > 1_000_000n || gap < -1_000_000n)) {
    notes.push("Portfolio realized and the FIFO sum of these events differ by more than 0.001 τ. The realized tile keeps the portfolio number.");
  }
  if (market.warning) notes.push(market.warning);

  return {
    mode: "real",
    investedTao: raoToHuman(invested, 4),
    gainedTao: raoToHuman(gained, 4),
    lostTao: raoToHuman(lost, 4),
    realizedTao: raoToHuman(realized, 4),
    unrealizedTao: raoToHuman(unrealized, 4),
    taoUsd,
    cashTao: null,
    startingTao: null,
    ...stats,
    equity: book.truncated ? [] : raoMapToPoints(replay.equityByDay),
    daily: book.truncated ? [] : raoMapToPoints(replay.dailyRealized),
    holdings: [...byNetuid.entries()]
      .filter(([, slot]) => slot.alpha > 0n)
      .map(([netuid, slot]) => {
        const usd = taoUsd ? Number(raoToHuman(slot.value, 6)) * Number(taoUsd) : null;
        return {
          netuid,
          name: names.get(netuid) ?? "Unknown",
          alpha: raoToHuman(slot.alpha, 4),
          valueTao: raoToHuman(slot.value, 4),
          valueUsd: usd == null || !Number.isFinite(usd) ? null : usd.toFixed(2),
          unrealizedTao: raoToHuman(slot.unrealized, 4),
        };
      }),
    bySubnet: [...byNetuid.entries()].map(([netuid, slot]) => ({
      netuid,
      name: names.get(netuid) ?? "Unknown",
      tao: Number(raoToHuman(slot.realized + slot.unrealized, 6)),
    })),
    fetchedAt: market.fetchedAt,
    warning: market.warning,
    notes,
    coldkey: settings.coldkey,
  };
}

function stakeFills(events: StakeEvent[]): Fill[] {
  const fills: Fill[] = [];
  for (const event of events) {
    if (event.netuid == null) continue;
    if (event.registration_collateral || event.is_transfer || event.validator_swap) continue;
    if (event.action !== "stake" && event.action !== "unstake") continue;
    const alpha = event.alpha ? parseRao(event.alpha) : 0n;
    const tao = parseRao(event.amount);
    if (alpha <= 0n && tao <= 0n) continue;
    fills.push({
      id: event.id,
      at: event.timestamp,
      netuid: event.netuid,
      side: event.action === "stake" ? "buy" : "sell",
      tao,
      alpha,
      price: event.alpha_price_in_tao,
      reason: event.extrinsic_id ? `Extrinsic ${event.extrinsic_id}` : "On-chain stake event",
    });
  }
  return fills;
}

export async function dashboard(mode: BookMode): Promise<DashboardPayload> {
  if (mode === "real") return realDashboard();
  return virtualDashboard();
}

export async function history(mode: BookMode, from: string | null, to: string | null): Promise<HistoryPayload> {
  if (mode === "virtual") {
    let marketError: string | null = null;
    const market = await getMarket(false).catch((error: unknown) => {
      if (error instanceof TaostatsError) {
        marketError = error.message;
        return null;
      }
      throw error;
    });
    const { replay } = replayVirtual();
    const names = namesFrom(market?.subnets ?? []);
    const prices = pricesFrom(market?.subnets ?? []);
    const rows = presentHistory(replay, prices, names, false).filter((row) => inEtRange(row.at, from, to));
    return {
      mode,
      rows,
      warning: marketError ?? market?.warning ?? null,
      notes: [
        "Times are America/New_York. P/L on an open buy is unrealized on the alpha still held from that fill, marked at the spot. P/L on a sell is realized. Fully closed buys keep their prices and leave P/L on the sell, so the column is not a sum.",
        "Losing trades stay in this list. Nothing here deletes them.",
      ],
      fetchedAt: market?.fetchedAt ?? null,
      truncated: false,
    };
  }
  const settings = readSettings();
  if (!settings.coldkey) {
    return {
      mode,
      rows: [],
      warning: "No coldkey in Settings — Real mode is empty.",
      notes: [],
      fetchedAt: null,
      truncated: false,
    };
  }
  const market = await getMarket(false);
  const book = await loadReal(settings.coldkey, false);
  const replay = replayFills(stakeFills(book.events), 0n);
  const rows = presentHistory(replay, pricesFrom(market.subnets), namesFrom(market.subnets), book.truncated).filter((row) =>
    inEtRange(row.at, from, to),
  );
  const notes = [
    "Times are America/New_York. Real rows are Taostats stake and unstake events with trades_only=true. The reason column is the extrinsic id and cannot be edited.",
    "P/L uses FIFO against those events. A sell larger than the buys in this list does not get an invented cost.",
  ];
  if (book.truncated) notes.push("History was capped at 3,000 events, so per-trade P/L is hidden.");
  return {
    mode,
    rows,
    warning: market.warning,
    notes,
    fetchedAt: market.fetchedAt,
    truncated: book.truncated,
  };
}

function confirmSentence(quote: QuoteView): string {
  const bits: string[] = [];
  if (quote.thin && quote.poolTao) {
    bits.push(`This pool holds ${quote.poolTao} τ, under your thin-pool line.`);
  } else if (quote.thin) {
    bits.push("This pool is under your thin-pool line.");
  }
  if (quote.highSlippage) {
    bits.push(`Runtime slippage on this quote is ${quote.slippagePct}%.`);
  }
  return `${bits.join(" ")} Confirm to log the virtual trade anyway.`;
}

async function slippage(netuid: number, side: "buy" | "sell", amountRao: bigint, fresh: boolean): Promise<SlippageRow> {
  const direction = side === "buy" ? "tao_to_alpha" : "alpha_to_tao";
  const key = `${netuid}|${direction}|${amountRao.toString()}`;
  const hit = slippageCache.get(key);
  if (hit && !fresh && Date.now() - hit.at < 15_000) return hit.row;
  const page = await taostatsGet<SlippageRow>("/v1/subnets/slippage", {
    netuid,
    direction,
    input_tokens: amountRao.toString(),
  });
  const row = page.data?.[0];
  if (!row) throw new TaostatsError("Taostats returned no slippage quote for that size.", 502);
  slippageCache.set(key, { at: Date.now(), row });
  return row;
}

export async function quoteFor(netuid: number, side: "buy" | "sell", amount: string | null): Promise<QuotePayload> {
  const settings = readSettings();
  const market = await getMarket(false);
  const card = market.subnets.find((row) => row.netuid === netuid);
  if (!card) throw new AppError(`SN ${netuid} is not in the current pool list.`, 404);
  const { replay } = replayVirtual();
  const lot = replay.open.get(netuid);
  const price = card.priceTao;
  const value = lot && price ? valueOfAlpha(lot.alpha, price) : null;
  const position = {
    alpha: raoToHuman(lot?.alpha ?? 0n, 4),
    costTao: raoToHuman(lot?.cost ?? 0n, 4),
    valueTao: value == null ? null : raoToHuman(value, 4),
    unrealizedTao: value == null || !lot ? null : raoToHuman(value - lot.cost, 4),
    avgPriceTao: lot && lot.alpha > 0n ? fillPrice(lot.cost, lot.alpha) : null,
  };
  const base = {
    position,
    cashTao: raoToHuman(replay.cash, 4),
    thresholdTao: settings.thin_pool_tao,
    warning: market.warning,
  };
  if (!amount || amount.trim() === "") {
    return { quote: null, ...base };
  }
  const amountRao = humanToRao(amount);
  const row = await slippage(netuid, side, amountRao, false);
  const output = parseRao(row.output_tokens);
  const tao = side === "buy" ? amountRao : output;
  const alpha = side === "buy" ? output : amountRao;
  if (alpha <= 0n || tao < 0n) {
    throw new AppError("The runtime quote returned no alpha. Try a different size.", 422);
  }
  const fill = fillPrice(tao, alpha);
  const poolTao = card.poolTao != null ? Number(card.poolTao) : null;
  const threshold = Number(settings.thin_pool_tao);
  const quote: QuoteView = {
    netuid,
    side,
    inputTao: side === "buy" ? raoToHuman(amountRao, 9) : raoToHuman(output, 9),
    inputAlpha: side === "sell" ? raoToHuman(amountRao, 9) : raoToHuman(output, 9),
    outputTao: side === "sell" ? raoToHuman(output, 9) : raoToHuman(amountRao, 9),
    outputAlpha: side === "buy" ? raoToHuman(output, 9) : raoToHuman(amountRao, 9),
    midPriceTao: row.alpha_price,
    fillPriceTao: fill,
    slippagePct: row.slippage,
    feeTao: raoToHuman(parseRao(row.tao_fee), 6),
    feeAlpha: raoToHuman(parseRao(row.alpha_fee), 6),
    gapPct: comparePriceGapPct(fill, row.alpha_price)?.toFixed(4) ?? null,
    exceedsReserve: row.exceeds_reserve,
    blockNumber: row.block_number,
    timestamp: row.timestamp,
    thin: isThinPool(poolTao, threshold),
    highSlippage: isHighSlippage(row.slippage),
    poolTao: card.poolTao,
  };
  return { quote, ...base };
}

export async function logTrade(input: {
  netuid: number;
  side: "buy" | "sell";
  amount: string;
  reason: string;
  confirmRisk: boolean;
}): Promise<{ id: number; quote: QuoteView }> {
  const reason = input.reason.trim();
  if (!reason) throw new AppError("Every virtual trade needs a reason. It locks after you log it.", 400);
  if (reason.length > 2000) throw new AppError("Reason is limited to 2000 characters.", 400);
  if (input.side !== "buy" && input.side !== "sell") throw new AppError("Side must be buy or sell.", 400);
  if (!Number.isInteger(input.netuid) || input.netuid <= 0) throw new AppError("Pick a subnet.", 400);
  const amountRao = humanToRao(input.amount);
  const preview = await quoteFor(input.netuid, input.side, input.amount);
  const quote = preview.quote;
  if (!quote) throw new AppError("Enter an amount before logging a trade.", 400);
  if (quote.exceedsReserve) {
    throw new AppError("This size is larger than the pool reserve, so it was not logged.", 400);
  }
  if ((quote.thin || quote.highSlippage) && !input.confirmRisk) {
    throw new AppError(confirmSentence(quote), 409);
  }
  const db = getDb();
  const id = db.transaction(() => {
    const fresh = replayVirtual().replay;
    if (input.side === "buy" && amountRao > fresh.cash) {
      throw new AppError(`Virtual cash is ${raoToHuman(fresh.cash, 4)} τ. This buy is larger.`, 400);
    }
    if (input.side === "sell") {
      const held = fresh.open.get(input.netuid)?.alpha ?? 0n;
      if (amountRao > held) {
        throw new AppError(`Virtual position is ${raoToHuman(held, 4)} α. This sell is larger.`, 400);
      }
    }
    const tao = input.side === "buy" ? quote.inputTao : quote.outputTao;
    const alpha = input.side === "buy" ? quote.outputAlpha : quote.inputAlpha;
    const info = db
      .prepare(
        `INSERT INTO virtual_trades (
          created_at, netuid, side, tao_amount, alpha_amount, price_mid, price_fill,
          slippage_pct, fee_tao, fee_alpha, reason, pool_tao, thin, quote_block
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        new Date().toISOString(),
        input.netuid,
        input.side,
        tao,
        alpha,
        quote.midPriceTao,
        quote.fillPriceTao,
        quote.slippagePct,
        quote.feeTao,
        quote.feeAlpha,
        reason,
        quote.poolTao ?? "",
        quote.thin ? 1 : 0,
        quote.blockNumber,
      );
    return Number(info.lastInsertRowid);
  })();
  return { id, quote };
}

export function getSettings(): SettingsPayload {
  const row = readSettings();
  return {
    coldkey: row.coldkey,
    thinPoolTao: row.thin_pool_tao,
    startingTao: row.starting_tao,
    virtualTradeCount: countTrades(),
    favorites: readFavorites(),
  };
}

export function saveSettings(input: { coldkey?: string; thinPoolTao?: string; startingTao?: string }): SettingsPayload {
  const current = readSettings();
  const coldkey = input.coldkey === undefined ? current.coldkey : normalizeColdkey(input.coldkey);
  const thin = input.thinPoolTao === undefined ? current.thin_pool_tao : normalizeThin(input.thinPoolTao);
  let starting = current.starting_tao;
  if (input.startingTao !== undefined && input.startingTao.trim() !== current.starting_tao) {
    if (countTrades() > 0) {
      throw new AppError("Starting TAO can change only while the virtual book is empty.", 400);
    }
    starting = normalizeStarting(input.startingTao);
  }
  getDb()
    .prepare("UPDATE settings SET coldkey = ?, thin_pool_tao = ?, starting_tao = ?, updated_at = ? WHERE id = 1")
    .run(coldkey, thin, starting, new Date().toISOString());
  return getSettings();
}

export function setFavorite(netuid: number, favorite: boolean): number[] {
  if (!Number.isInteger(netuid) || netuid < 0 || netuid > 4096) {
    throw new AppError("That subnet number is not valid.", 400);
  }
  const db = getDb();
  if (favorite) {
    db.prepare("INSERT OR IGNORE INTO favorites (netuid, created_at) VALUES (?, ?)").run(netuid, new Date().toISOString());
  } else {
    db.prepare("DELETE FROM favorites WHERE netuid = ?").run(netuid);
  }
  return readFavorites();
}

function normalizeColdkey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^5[1-9A-HJ-NP-Za-km-z]{46,49}$/.test(trimmed)) {
    throw new AppError(
      "Coldkey must be a public SS58 address starting with 5. This app never asks for a seed phrase or a private key.",
      400,
    );
  }
  return trimmed;
}

function normalizeThin(value: string): string {
  const rao = humanToRao(value);
  if (rao > humanToRao("1000000")) throw new AppError("Thin-pool line must be at most 1,000,000 τ.", 400);
  return raoToHuman(rao, 4);
}

function normalizeStarting(value: string): string {
  const rao = humanToRaoAllowZero(value);
  if (rao > humanToRao("1000000")) throw new AppError("Starting TAO must be at most 1,000,000.", 400);
  return raoToHuman(rao, 4);
}
