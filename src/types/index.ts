/* =========================================================================
   BIG MARGIN — Domain types
   Every data-bearing record carries provenance: source, timestamps, status.
   ========================================================================= */

export type MarketId = 'SA' | 'US';
export type Currency = 'SAR' | 'USD';

/** Provenance status shown next to every figure in the UI. */
export type DataStatus =
  | 'live'
  | 'delayed'
  | 'calculated'
  | 'estimated'
  | 'unavailable';

/** Envelope attached to every value or record served by a data provider. */
export interface Provenance {
  source: string;
  /** ISO-8601 timestamp of when the underlying source produced the value. */
  asOf: string;
  /** ISO-8601 timestamp of when BIG MARGIN last refreshed it. */
  lastUpdated: string;
  status: DataStatus;
  /** Delay in minutes when status === 'delayed'. */
  delayMinutes?: number;
  /** Set when status === 'unavailable'. */
  reason?: string;
}

/** A value that may legitimately be missing. Never fabricate a substitute. */
export type Maybe<T> = T | null;

export interface Localized {
  ar: string;
  en: string;
}

/* ------------------------------ Market -------------------------------- */

export type MarketSession =
  | 'pre'
  | 'open'
  | 'closed'
  | 'after'
  | 'auction'
  | 'holiday';

export interface MarketStatus {
  market: MarketId;
  session: MarketSession;
  /** Local exchange time, ISO-8601. */
  localTime: string;
  timezone: string;
  nextChangeAt: Maybe<string>;
  provenance: Provenance;
}

export interface Sector {
  id: string;
  name: Localized;
  market: MarketId;
}

export interface Instrument {
  /** Exchange symbol: "2222" (Tadawul) or "AAPL" (US). */
  symbol: string;
  market: MarketId;
  currency: Currency;
  name: Localized;
  shortName: Localized;
  sectorId: string;
  isin: Maybe<string>;
  listedShares: Maybe<number>;
  freeFloatShares: Maybe<number>;
  /** Index memberships, e.g. ["TASI", "NOMU"] or ["SPX", "NDX"]. */
  indices: string[];
  logoUrl: Maybe<string>;
  website: Maybe<string>;
  description: Maybe<Localized>;
}

export interface Quote {
  symbol: string;
  market: MarketId;
  currency: Currency;
  price: Maybe<number>;
  previousClose: Maybe<number>;
  open: Maybe<number>;
  dayHigh: Maybe<number>;
  dayLow: Maybe<number>;
  change: Maybe<number>;
  changePct: Maybe<number>;
  volume: Maybe<number>;
  avgVolume30d: Maybe<number>;
  turnover: Maybe<number>;
  trades: Maybe<number>;
  week52High: Maybe<number>;
  week52Low: Maybe<number>;
  marketCap: Maybe<number>;
  freeFloatMarketCap: Maybe<number>;
  /** Trailing performance in percent. Null when history is unavailable. */
  perf1w: Maybe<number>;
  perf1m: Maybe<number>;
  perf3m: Maybe<number>;
  perf1y: Maybe<number>;
  /** Annualised realised volatility in percent, from daily returns. */
  volatilityPct: Maybe<number>;
  provenance: Provenance;
}

export interface Fundamentals {
  symbol: string;
  peRatio: Maybe<number>;
  eps: Maybe<number>;
  bookValuePerShare: Maybe<number>;
  priceToBook: Maybe<number>;
  beta: Maybe<number>;
  dividendYieldPct: Maybe<number>;
  returnOnEquityPct: Maybe<number>;
  netMarginPct: Maybe<number>;
  revenueTtm: Maybe<number>;
  netIncomeTtm: Maybe<number>;
  totalAssets: Maybe<number>;
  totalDebt: Maybe<number>;
  provenance: Provenance;
}

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface PriceSeries {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  provenance: Provenance;
}

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface IndexQuote {
  id: string;
  name: Localized;
  market: MarketId;
  level: Maybe<number>;
  change: Maybe<number>;
  changePct: Maybe<number>;
  advancers: Maybe<number>;
  decliners: Maybe<number>;
  unchanged: Maybe<number>;
  volume: Maybe<number>;
  turnover: Maybe<number>;
  provenance: Provenance;
}

/* ------------------------------- Index -------------------------------- */

export interface IndexConstituent {
  symbol: string;
  indexId: string;
  /** Weight in percent, e.g. 11.42 means 11.42%. */
  weightPct: Maybe<number>;
  /** Free-float adjusted market cap used by the index calculation. */
  indexMarketCap: Maybe<number>;
  /** Free-float factor applied by the index provider (0–1). */
  freeFloatFactor: Maybe<number>;
  /** Capping factor applied by the index provider (0–1), if any. */
  cappingFactor: Maybe<number>;
  provenance: Provenance;
}

/** Result of an index-impact computation. Always DataStatus 'calculated'. */
export interface ImpactResult {
  symbol: string;
  indexId: string;
  indexLevel: number;
  indexDivisor: Maybe<number>;
  weightPct: Maybe<number>;
  price: Maybe<number>;
  /** Index points moved per 1 currency unit of share-price movement. */
  pointsPerUnit: Maybe<number>;
  /** Index points contributed by today's actual move. */
  todayPoints: Maybe<number>;
  formula: string;
  computedAt: string;
  status: Extract<DataStatus, 'calculated' | 'unavailable'>;
  note?: string;
}

/* ------------------------------ Shariah ------------------------------- */

export type ShariahStatus = 'compliant' | 'non_compliant' | 'unknown';

export interface ShariahMethodology {
  id: string;
  name: Localized;
  shortName: string;
  description: Localized;
  /** Human-readable rule set displayed on the methodology page. */
  rules: Array<{
    key: string;
    label: Localized;
    threshold: string;
    basis: Localized;
  }>;
  sourceName: string;
  sourceUrl: Maybe<string>;
  lastUpdated: string;
}

export interface ShariahRatio {
  key: string;
  label: Localized;
  /** Numerator / denominator expressed as percent. Null when inputs missing. */
  valuePct: Maybe<number>;
  thresholdPct: Maybe<number>;
  passes: Maybe<boolean>;
  numerator: Maybe<number>;
  denominator: Maybe<number>;
  formula: string;
}

export interface ShariahScreening {
  symbol: string;
  methodologyId: string;
  status: ShariahStatus;
  ratios: ShariahRatio[];
  /** Income from non-permissible activities, as % of total revenue. */
  nonCompliantIncomePct: Maybe<number>;
  purificationPerShare: Maybe<number>;
  screeningDate: Maybe<string>;
  provenance: Provenance;
  note: Maybe<Localized>;
}

export interface ShariahHistoryEntry {
  symbol: string;
  methodologyId: string;
  date: string;
  status: ShariahStatus;
  reason: Maybe<Localized>;
  source: string;
}

/* ---------------------- Dividends / actions / earnings ---------------- */

export type DividendKind = 'cash' | 'stock' | 'special';
export type DividendFrequency =
  | 'annual'
  | 'semi_annual'
  | 'quarterly'
  | 'monthly'
  | 'irregular'
  | 'unknown';

export interface Dividend {
  id: string;
  symbol: string;
  market: MarketId;
  kind: DividendKind;
  /** Dividend per share in the instrument's currency. */
  amountPerShare: Maybe<number>;
  currency: Currency;
  frequency: DividendFrequency;
  declaredDate: Maybe<string>;
  exDate: Maybe<string>;
  recordDate: Maybe<string>;
  payDate: Maybe<string>;
  /** True only for board-announced dividends; false for projections. */
  announced: boolean;
  provenance: Provenance;
}

export type CorporateActionKind =
  | 'cash_dividend'
  | 'stock_dividend'
  | 'rights_issue'
  | 'capital_increase'
  | 'capital_reduction'
  | 'split'
  | 'reverse_split'
  | 'share_grant'
  | 'general_meeting';

export interface CorporateAction {
  id: string;
  symbol: string;
  market: MarketId;
  kind: CorporateActionKind;
  effectiveDate: Maybe<string>;
  announcedDate: Maybe<string>;
  detail: Localized;
  ratio: Maybe<string>;
  provenance: Provenance;
}

export interface EarningsEvent {
  id: string;
  symbol: string;
  market: MarketId;
  period: string;
  /** Scheduled or confirmed report date. */
  date: Maybe<string>;
  dateConfirmed: boolean;
  timing: 'bmo' | 'amc' | 'unspecified';
  epsEstimate: Maybe<number>;
  epsActual: Maybe<number>;
  revenueEstimate: Maybe<number>;
  revenueActual: Maybe<number>;
  priorPeriodNetIncome: Maybe<number>;
  netIncome: Maybe<number>;
  provenance: Provenance;
}

/**
 * What kind of event a story reports. This drives the importance rules, so it
 * is a *sourced* field: a provider that does not classify its feed leaves it
 * null, and the item's importance then reads "unavailable" rather than being
 * guessed from the wording of the headline.
 */
export type NewsCategory =
  | 'earnings'
  | 'dividend'
  | 'corporate_action'
  | 'capital'
  | 'mna'
  | 'regulatory'
  | 'management'
  | 'guidance'
  | 'rating'
  | 'general';

/** How much a story matters. Three levels, because more are not actionable. */
export type NewsImportance = 'critical' | 'important' | 'routine';

export interface NewsItem {
  id: string;
  headline: Localized;
  summary: Maybe<Localized>;
  sourceName: string;
  url: Maybe<string>;
  publishedAt: string;
  symbols: string[];
  market: Maybe<MarketId>;
  /** Event type, from the provider. Null when the feed does not classify. */
  category: Maybe<NewsCategory>;
  /**
   * True for a filing published by the exchange or regulator (Tadawul, SEC),
   * false for a media article, null when the provider does not say. An
   * official disclosure is a fact the company published about itself, which is
   * why it weighs more than coverage of it.
   */
  official: Maybe<boolean>;
  /** The provider's own importance rating, when it supplies one. */
  sourceImportance: Maybe<NewsImportance>;
  provenance: Provenance;
}

/* ------------------------------- User --------------------------------- */

export type TxKind = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal';

export interface Transaction {
  id: string;
  portfolioId: string;
  kind: TxKind;
  symbol: Maybe<string>;
  market: Maybe<MarketId>;
  date: string;
  /** Share quantity for buy/sell; null for cash movements. */
  quantity: Maybe<number>;
  /** Execution price per share, or dividend per share. */
  price: Maybe<number>;
  /** Brokerage commission. */
  commission: number;
  /** Exchange, VAT and any other charges. */
  fees: number;
  /** Free-text additional cost captured by the user. */
  otherCosts: number;
  currency: Currency;
  note: string;
}

export interface Portfolio {
  id: string;
  name: string;
  baseCurrency: Currency;
  createdAt: string;
}

export interface WatchlistEntry {
  symbol: string;
  market: MarketId;
  addedAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
  createdAt: string;
}

export type AlertKind =
  | 'price_above'
  | 'price_below'
  | 'pct_move'
  | 'volume_above'
  | 'weight_change'
  | 'shariah_change'
  | 'dividend_announced'
  | 'corporate_action'
  | 'earnings_upcoming';

export interface Alert {
  id: string;
  symbol: string;
  market: MarketId;
  kind: AlertKind;
  threshold: Maybe<number>;
  note: string;
  active: boolean;
  createdAt: string;
  lastTriggeredAt: Maybe<string>;
}

/* ----------------------------- Calculation ---------------------------- */

/**
 * Every calculated figure in BIG MARGIN is returned inside this envelope so
 * the UI can always show inputs, the formula used, and when it was computed.
 */
export interface Calculation<T> {
  value: T;
  inputs: Record<string, number | string | null>;
  formula: string;
  computedAt: string;
  status: Extract<DataStatus, 'calculated' | 'unavailable'>;
}
