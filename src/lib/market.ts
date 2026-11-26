import { readFavorites } from "./db";
import { formatAge } from "./time";
import { raoToHuman, parseRao } from "./money";
import {
  emissionShares,
  fullyDilutedTao,
  interpretMarketCapTao,
  interpretSpotPrice,
  type EmissionInput,
} from "./market-math";
import { taostatsAll, taostatsGet, TaostatsError } from "./taostats";
import type { MarketPayload, SeriesPoint, SubnetCard, SubnetDetail } from "./types";
import { safeHttpUrl } from "./format";

const TTL_MS = 90_000;
const MIN_UPSTREAM_MS = 60_000;

type CacheEntry = { at: number; payload: MarketPayload };

let cache: CacheEntry | null = null;
let lastUpstream = 0;
let inflight: Promise<MarketPayload> | null = null;

type PoolRow = {
  netuid: number;
  price: string;
  market_cap: string;
  tao_in_pool: string;
  alpha_in_pool: string;
  alpha_staked: string;
  alpha_out: string | null;
  total_alpha: string;
  symbol: string;
  startup_mode: boolean;
  subnet_emission_enabled: boolean | null;
  block_number: number;
  timestamp: string;
};

type AggRow = {
  netuid: number;
  price_change_1_hour: string | null;
  price_change_1_day: string | null;
  price_change_1_week: string | null;
  tao_buy_volume_24_hr: string;
  tao_sell_volume_24_hr: string;
  tao_volume_24_hr: string;
  seven_day_prices: { price: string; timestamp: string }[];
};

type IdentityRow = {
  netuid: number;
  subnet_name: string;
  logo_url: string | null;
  subnet_url: string | null;
  github_repo: string | null;
};

type MetricRow = {
  netuid: number;
  emission: string | null;
  excess_tao: string | null;
  subnet_emission_enabled?: boolean | null;
  registration_timestamp: string | null;
};

type PriceRow = { price: string };

function raoField(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  try {
    return raoToHuman(parseRao(value), 4);
  } catch {
    return null;
  }
}

function numOrNull(value: string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getMarket(fresh = false): Promise<MarketPayload> {
  const payload = await loadCachedMarket(fresh);
  const favorites = new Set(readFavorites());
  return {
    ...payload,
    subnets: payload.subnets.map((row) => ({ ...row, favorite: favorites.has(row.netuid) })),
  };
}

async function loadCachedMarket(fresh = false): Promise<MarketPayload> {
  const now = Date.now();
  if (cache && !fresh && now - cache.at < TTL_MS) {
    return { ...cache.payload, stale: false };
  }
  if (cache && fresh && now - lastUpstream < MIN_UPSTREAM_MS) {
    return {
      ...cache.payload,
      stale: true,
      warning:
        cache.payload.warning ??
        "Taostats was queried less than a minute ago. Showing the cached snapshot so the free rate limit holds.",
    };
  }
  if (inflight) return inflight;
  inflight = loadMarket()
    .then((payload) => {
      cache = { at: Date.now(), payload };
      lastUpstream = Date.now();
      return payload;
    })
    .catch((error: unknown) => {
      if (cache && error instanceof TaostatsError && (error.status === 429 || error.status === 502)) {
        return {
          ...cache.payload,
          stale: true,
          warning: error.message,
        };
      }
      throw error;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function loadMarket(): Promise<MarketPayload> {
  const notes: string[] = [];
  const pools = await taostatsAll<PoolRow>("/v1/subnets/pools", { order_by: "netuid", order_dir: "asc" }, 3);

  const [agg, identities, metrics, price] = await Promise.all([
    taostatsAll<AggRow>("/v1/subnets/pools/aggregate", {}, 3).catch((error: unknown) => {
      notes.push(error instanceof Error ? error.message : "Pool aggregates failed.");
      return { rows: [] as AggRow[], truncated: false };
    }),
    taostatsAll<IdentityRow>("/v1/subnets/identities", {}, 3).catch((error: unknown) => {
      notes.push(error instanceof Error ? error.message : "Subnet names failed.");
      return { rows: [] as IdentityRow[], truncated: false };
    }),
    taostatsAll<MetricRow>("/v1/subnets/metrics", { order_by: "netuid", order_dir: "asc" }, 3).catch(
      (error: unknown) => {
        notes.push(error instanceof Error ? error.message : "Emission metrics failed.");
        return { rows: [] as MetricRow[], truncated: false };
      },
    ),
    taostatsGet<PriceRow>("/v1/price/simple").catch((error: unknown) => {
      notes.push(error instanceof Error ? error.message : "TAO price failed.");
      return { data: [] as PriceRow[] };
    }),
  ]);

  const aggBy = new Map(agg.rows.map((row) => [row.netuid, row]));
  const nameBy = new Map(identities.rows.map((row) => [row.netuid, row]));
  const metricBy = new Map(metrics.rows.map((row) => [row.netuid, row]));
  const favorites = new Set(readFavorites());

  const emissionInput: EmissionInput[] = pools.rows.map((pool) => {
    const metric = metricBy.get(pool.netuid);
    return {
      netuid: pool.netuid,
      emission: metric?.emission ?? null,
      excess: metric?.excess_tao ?? null,
      enabled: pool.subnet_emission_enabled ?? null,
    };
  });
  const shares = metrics.rows.length > 0 ? emissionShares(emissionInput) : new Map<number, number | null>();
  if (metrics.rows.length === 0) {
    notes.push("Emission share is blank because the Taostats metrics endpoint did not return rows.");
  }

  let hiddenPrices = 0;
  let hiddenCaps = 0;
  const draft: SubnetCard[] = [];

  for (const pool of pools.rows) {
    if (pool.netuid === 0) continue;
    const spot = interpretSpotPrice(pool.price, pool.tao_in_pool, pool.alpha_in_pool);
    if (!spot.priceTao && spot.note) hiddenPrices += 1;
    const poolAlpha = numOrNull(pool.alpha_in_pool) / 1e9;
    const totalAlpha = numOrNull(pool.total_alpha) / 1e9;
    const staked = numOrNull(pool.alpha_staked) / 1e9;
    const alphaOut = pool.alpha_out != null ? numOrNull(pool.alpha_out) / 1e9 : 0;
    const maxAlpha = Math.max(totalAlpha, poolAlpha + staked, alphaOut, poolAlpha);
    const cap = interpretMarketCapTao(pool.market_cap, spot.priceTao, {
      minAlpha: poolAlpha,
      maxAlpha,
    });
    if (cap.tao == null && spot.priceTao != null) hiddenCaps += 1;
    const fdv = fullyDilutedTao(spot.priceTao);
    const aggRow = aggBy.get(pool.netuid);
    const identity = nameBy.get(pool.netuid);
    const share = shares.get(pool.netuid);
    const divisor = spot.divisor;
    const sparkline =
      aggRow?.seven_day_prices?.flatMap((point) => {
        const raw = Number(point.price);
        if (!Number.isFinite(raw) || !divisor) return [];
        return [{ t: point.timestamp, v: raw / divisor }];
      }) ?? [];
    const buy = raoField(aggRow?.tao_buy_volume_24_hr);
    const sell = raoField(aggRow?.tao_sell_volume_24_hr);
    const buyN = buy != null ? Number(buy) : null;
    const sellN = sell != null ? Number(sell) : null;
    const net = buyN != null && sellN != null ? (buyN - sellN).toString() : null;
    const registered = metricBy.get(pool.netuid)?.registration_timestamp ?? null;
    const name = identity?.subnet_name && identity.subnet_name !== "Unknown"
      ? identity.subnet_name
      : `Subnet ${pool.netuid}`;

    draft.push({
      netuid: pool.netuid,
      name,
      symbol: pool.symbol || "α",
      logoUrl: safeHttpUrl(identity?.logo_url),
      subnetUrl: safeHttpUrl(identity?.subnet_url),
      github: safeHttpUrl(identity?.github_repo),
      priceTao: spot.priceTao != null ? String(spot.priceTao) : null,
      priceNote: spot.note,
      priceDivisor: divisor,
      ageLabel: formatAge(registered),
      registeredAt: registered,
      marketCapTao: cap.tao != null ? String(cap.tao) : null,
      marketCapNote: cap.note,
      fdvTao: fdv != null ? String(fdv) : null,
      emissionSharePct: share == null ? null : String(share),
      sparkline,
      change1h: aggRow?.price_change_1_hour ?? null,
      change24h: aggRow?.price_change_1_day ?? null,
      change7d: aggRow?.price_change_1_week ?? null,
      volume24hTao: raoField(aggRow?.tao_volume_24_hr),
      taoIn24h: buy,
      taoOut24h: sell,
      netFlowTao: net,
      poolTao: raoField(pool.tao_in_pool),
      poolAlpha: raoField(pool.alpha_in_pool),
      rank: 0,
      startupMode: Boolean(pool.startup_mode),
      favorite: favorites.has(pool.netuid),
      blockNumber: pool.block_number,
      timestamp: pool.timestamp,
    });
  }

  draft.sort((a, b) => {
    const am = a.marketCapTao != null ? Number(a.marketCapTao) : -1;
    const bm = b.marketCapTao != null ? Number(b.marketCapTao) : -1;
    if (bm !== am) return bm - am;
    return (Number(b.poolTao) || 0) - (Number(a.poolTao) || 0);
  });
  draft.forEach((row, index) => {
    row.rank = index + 1;
  });

  if (hiddenPrices > 0) {
    notes.push(
      `Spot price hidden on ${hiddenPrices} subnet${hiddenPrices === 1 ? "" : "s"}: the Taostats price did not sit in the weighted-pool band of the reserves.`,
    );
  }
  if (hiddenCaps > 0) {
    notes.push(
      `Market cap hidden on ${hiddenCaps} subnet${hiddenCaps === 1 ? "" : "s"}: Taostats market_cap did not match spot × a supply between pool alpha and total alpha.`,
    );
  }
  notes.push("FDV is 21,000,000 α × the Taostats spot price, in TAO. It is not an EMA figure.");

  const newest = draft.reduce<string | null>((best, row) => {
    if (!best || row.timestamp > best) return row.timestamp;
    return best;
  }, null);

  return {
    subnets: draft,
    taoUsd: price.data?.[0]?.price ?? null,
    fetchedAt: newest ?? new Date().toISOString(),
    stale: false,
    warning: null,
    notes,
    cacheSeconds: 90,
  };
}

export async function getSubnetDetail(netuid: number): Promise<SubnetDetail> {
  const market = await getMarket(false);
  const card = market.subnets.find((row) => row.netuid === netuid);
  if (!card) {
    throw new TaostatsError(`SN ${netuid} is not in the current Taostats pool list.`, 404);
  }
  let series: SeriesPoint[] = card.sparkline.map((point) => ({ t: point.t, v: point.v }));
  let seriesNote: string | null = null;
  try {
    const history = await taostatsGet<PoolRow>("/v1/subnets/pools/history", {
      netuid,
      frequency: "by_hour",
      limit: 200,
      order_by: "timestamp",
      order_dir: "desc",
    });
    if (card.priceDivisor && history.data?.length) {
      series = history.data
        .map((row) => ({ t: row.timestamp, v: Number(row.price) / card.priceDivisor! }))
        .filter((point) => Number.isFinite(point.v))
        .reverse();
    } else if (!card.priceDivisor) {
      seriesNote = card.priceNote ?? "Hourly prices are hidden because the spot price failed its unit check.";
      series = [];
    }
  } catch (error) {
    seriesNote =
      error instanceof Error
        ? `${error.message} The chart is the 7-day sample from the screener instead.`
        : "Hourly history failed. The chart is the 7-day sample from the screener instead.";
  }
  return { ...card, series, seriesNote };
}

export function cacheAgeMs(): number | null {
  if (!cache) return null;
  return Date.now() - cache.at;
}
