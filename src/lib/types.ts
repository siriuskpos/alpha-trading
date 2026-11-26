export type BookMode = "virtual" | "real";

export type SparkPoint = { t: string; v: number };

export type SubnetCard = {
  netuid: number;
  name: string;
  symbol: string;
  logoUrl: string | null;
  subnetUrl: string | null;
  github: string | null;
  priceTao: string | null;
  priceNote: string | null;
  priceDivisor: number | null;
  ageLabel: string;
  registeredAt: string | null;
  marketCapTao: string | null;
  marketCapNote: string | null;
  fdvTao: string | null;
  emissionSharePct: string | null;
  sparkline: SparkPoint[];
  change1h: string | null;
  change24h: string | null;
  change7d: string | null;
  volume24hTao: string | null;
  taoIn24h: string | null;
  taoOut24h: string | null;
  netFlowTao: string | null;
  poolTao: string | null;
  poolAlpha: string | null;
  rank: number;
  startupMode: boolean;
  favorite: boolean;
  blockNumber: number;
  timestamp: string;
};

export type MarketPayload = {
  subnets: SubnetCard[];
  taoUsd: string | null;
  fetchedAt: string;
  stale: boolean;
  warning: string | null;
  notes: string[];
  cacheSeconds: number;
};

export type SettingsPayload = {
  coldkey: string;
  thinPoolTao: string;
  startingTao: string;
  virtualTradeCount: number;
  favorites: number[];
};

export type QuoteView = {
  netuid: number;
  side: "buy" | "sell";
  inputTao: string;
  inputAlpha: string;
  outputTao: string;
  outputAlpha: string;
  midPriceTao: string;
  fillPriceTao: string;
  slippagePct: string;
  feeTao: string;
  feeAlpha: string;
  gapPct: string | null;
  exceedsReserve: boolean;
  blockNumber: number;
  timestamp: string;
  thin: boolean;
  highSlippage: boolean;
  poolTao: string | null;
};

export type PositionView = {
  alpha: string;
  costTao: string;
  valueTao: string | null;
  unrealizedTao: string | null;
  avgPriceTao: string | null;
};

export type QuotePayload = {
  quote: QuoteView | null;
  position: PositionView;
  cashTao: string;
  thresholdTao: string;
  warning: string | null;
};

export type TradeHighlight = {
  label: string;
  tao: string;
  at: string;
};

export type HoldingView = {
  netuid: number;
  name: string;
  alpha: string;
  valueTao: string | null;
  valueUsd: string | null;
  unrealizedTao: string | null;
};

export type ChartPoint = { t: string; v: number };

export type DashboardPayload = {
  mode: BookMode;
  investedTao: string;
  gainedTao: string;
  lostTao: string;
  realizedTao: string;
  unrealizedTao: string | null;
  taoUsd: string | null;
  cashTao: string | null;
  startingTao: string | null;
  winRate: string | null;
  winSample: number;
  wins: number;
  avgWinTao: string | null;
  avgLossTao: string | null;
  best: TradeHighlight | null;
  worst: TradeHighlight | null;
  equity: ChartPoint[];
  daily: ChartPoint[];
  holdings: HoldingView[];
  bySubnet: { netuid: number; name: string; tao: number }[];
  fetchedAt: string | null;
  warning: string | null;
  notes: string[];
  coldkey: string | null;
};

export type HistoryRow = {
  id: string;
  at: string;
  side: "buy" | "sell";
  netuid: number;
  name: string;
  sizeTao: string;
  sizeAlpha: string;
  priceTao: string | null;
  currentPriceTao: string | null;
  plTao: string | null;
  plPct: string | null;
  status: "open" | "closed";
  unrealized: boolean;
  reason: string;
};

export type HistoryPayload = {
  mode: BookMode;
  rows: HistoryRow[];
  warning: string | null;
  notes: string[];
  fetchedAt: string | null;
  truncated: boolean;
};

export type SeriesPoint = { t: string; v: number };

export type SubnetDetail = SubnetCard & {
  series: SeriesPoint[];
  seriesNote: string | null;
};
