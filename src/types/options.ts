/* =========================================================================
   BIG MARGIN — Options domain model

   Options are a separate data domain from equities: a different vendor, a
   different licence tier, and a different refresh profile. The types live
   apart from `src/types/index.ts` for the same reason the provider does.

   Every field a vendor may omit is Maybe<T>. Greeks and implied volatility
   are the fields most often missing from a cheap feed, so the product is
   built to compute them (labelled 'calculated') rather than to hide the row.
   ========================================================================= */

import type { Currency, DataStatus, Maybe, Provenance } from './index';

// Re-exported so the options modules import their shared vocabulary from one
// place rather than reaching into the equity model for a single alias.
export type { Maybe, Provenance, Currency, DataStatus };

export type OptionRight = 'call' | 'put';
export type Moneyness = 'ITM' | 'ATM' | 'OTM';

/** Weekly, monthly (third-Friday) or a long-dated LEAPS series. */
export type ExpiryKind = 'weekly' | 'monthly' | 'quarterly' | 'leaps';

export type OptionStyle = 'american' | 'european';

/* ------------------------------- Greeks -------------------------------- */

export interface Greeks {
  /** ∂V/∂S — change in contract value per 1 unit of underlying move. */
  delta: Maybe<number>;
  /** ∂²V/∂S² — rate of change of delta. */
  gamma: Maybe<number>;
  /** ∂V/∂t — value lost per calendar day, conventionally negative. */
  theta: Maybe<number>;
  /** ∂V/∂σ — value change per 1 percentage point of implied volatility. */
  vega: Maybe<number>;
  /** ∂V/∂r — value change per 1 percentage point of the risk-free rate. */
  rho: Maybe<number>;
  /** Where these numbers came from: the feed, or BIG MARGIN's own model. */
  status: Extract<DataStatus, 'live' | 'delayed' | 'calculated' | 'unavailable'>;
}

export const EMPTY_GREEKS: Greeks = {
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  rho: null,
  status: 'unavailable',
};

/* ------------------------------ Expiries ------------------------------- */

export interface OptionExpiry {
  /** ISO date of expiration, e.g. "2026-09-18". */
  date: string;
  kind: ExpiryKind;
  /** Calendar days to expiration, from today. */
  dte: number;
  /** Contracts listed on this expiry, when the vendor reports it. */
  contractCount: Maybe<number>;
}

/* ------------------------------ Contracts ------------------------------ */

export interface OptionContract {
  /** OCC-style symbol, e.g. "AAPL260918C00190000". */
  contractSymbol: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  expiry: string;
  dte: number;
  currency: Currency;

  bid: Maybe<number>;
  ask: Maybe<number>;
  last: Maybe<number>;
  change: Maybe<number>;
  changePct: Maybe<number>;
  volume: Maybe<number>;
  openInterest: Maybe<number>;

  /** Implied volatility as a percentage, e.g. 28.4 means 28.4%. */
  impliedVolatilityPct: Maybe<number>;
  greeks: Greeks;

  /** Shares per contract — 100 in the standard US listing. */
  multiplier: number;
  style: OptionStyle;

  provenance: Provenance;
}

/** One strike row pairing the call and the put, as a chain is read. */
export interface ChainRow {
  strike: number;
  call: Maybe<OptionContract>;
  put: Maybe<OptionContract>;
}

export interface OptionChain {
  underlying: string;
  expiry: string;
  dte: number;
  /** Underlying price used for moneyness and model inputs. */
  underlyingPrice: Maybe<number>;
  rows: ChainRow[];
  provenance: Provenance;
}

/* ------------------------- Derived per-contract ------------------------ */

/**
 * Everything BIG MARGIN computes about a contract, kept separate from the
 * contract itself so sourced and derived values are never confused.
 */
export interface ContractAnalytics {
  moneyness: Maybe<Moneyness>;
  /** Immediate exercise value per share. */
  intrinsicValue: Maybe<number>;
  /** Premium above intrinsic — the time and volatility component. */
  extrinsicValue: Maybe<number>;
  /** Underlying price at which a bought contract returns its premium. */
  breakEven: Maybe<number>;
  /** Ask minus bid. */
  spread: Maybe<number>;
  spreadPct: Maybe<number>;
  /** Midpoint of bid and ask — the fairest single price to model from. */
  mid: Maybe<number>;
  /** Risk-neutral probability of finishing in the money, N(d2) / N(−d2). */
  probabilityItm: Maybe<number>;
  /** Traded volume ÷ open interest — the standard unusual-activity ratio. */
  volumeOiRatio: Maybe<number>;
  /** Premium at risk: mid × multiplier. */
  premiumPerContract: Maybe<number>;
  formula: string;
  computedAt: string;
  status: Extract<DataStatus, 'calculated' | 'unavailable'>;
}

/* -------------------------- Chain-level summary ------------------------ */

export interface ChainSummary {
  underlying: string;
  expiry: string;
  callVolume: Maybe<number>;
  putVolume: Maybe<number>;
  callOpenInterest: Maybe<number>;
  putOpenInterest: Maybe<number>;
  putCallVolumeRatio: Maybe<number>;
  putCallOiRatio: Maybe<number>;
  /** Open-interest-weighted average IV across the expiry. */
  averageIvPct: Maybe<number>;
  /** Strike carrying the largest combined open interest. */
  maxPainStrike: Maybe<number>;
  totalPremium: Maybe<number>;
  status: Extract<DataStatus, 'calculated' | 'unavailable'>;
}

/* ------------------------------ Flow ----------------------------------- */

export type FlowKind = 'sweep' | 'block' | 'split' | 'standard';
export type FlowSentiment = 'bullish' | 'bearish' | 'neutral';

/**
 * A single notable options trade. Sentiment is the vendor's classification,
 * never BIG MARGIN's inference — an aggressive buy is not a forecast.
 */
export interface FlowTrade {
  id: string;
  contractSymbol: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  expiry: string;
  dte: number;
  price: Maybe<number>;
  size: Maybe<number>;
  premium: Maybe<number>;
  kind: FlowKind;
  /** Where the print sat relative to the quote, when the vendor reports it. */
  side: Maybe<'at_bid' | 'at_ask' | 'mid' | 'unknown'>;
  sentiment: Maybe<FlowSentiment>;
  impliedVolatilityPct: Maybe<number>;
  openInterest: Maybe<number>;
  volume: Maybe<number>;
  timestamp: string;
  provenance: Provenance;
}

export interface UnusualActivity {
  contract: OptionContract;
  volumeOiRatio: number;
  /** Volume relative to this contract's own recent average, when available. */
  volumeVsAverage: Maybe<number>;
  premium: Maybe<number>;
}

/* ---------------------------- IV statistics ---------------------------- */

export interface IvStats {
  underlying: string;
  currentIvPct: Maybe<number>;
  iv52wHighPct: Maybe<number>;
  iv52wLowPct: Maybe<number>;
  /** Position of current IV within its 52-week range, 0–100. */
  ivRank: Maybe<number>;
  /** Share of the last 252 sessions with IV below today's, 0–100. */
  ivPercentile: Maybe<number>;
  /** Realised volatility of the underlying, for comparison. */
  historicalVolatilityPct: Maybe<number>;
  provenance: Provenance;
}

/* ------------------------------ Strategies ----------------------------- */

export type StrategyId =
  | 'long_call'
  | 'long_put'
  | 'covered_call'
  | 'cash_secured_put'
  | 'bull_call_spread'
  | 'bear_put_spread'
  | 'bull_put_spread'
  | 'bear_call_spread'
  | 'long_straddle'
  | 'long_strangle'
  | 'iron_condor'
  | 'iron_butterfly'
  | 'custom';

export type LegKind = 'option' | 'stock';

export interface StrategyLeg {
  id: string;
  kind: LegKind;
  /** Positive to buy, negative to sell. */
  quantity: number;
  right: Maybe<OptionRight>;
  strike: Maybe<number>;
  expiry: Maybe<string>;
  /** Premium per share for an option leg, or entry price for a stock leg. */
  price: Maybe<number>;
  multiplier: number;
  contractSymbol: Maybe<string>;
}

export interface StrategyResult {
  strategyId: StrategyId;
  legs: StrategyLeg[];
  /** Net premium: negative when the position is a debit. */
  netPremium: Maybe<number>;
  maxProfit: Maybe<number>;
  /** Null when the loss is theoretically unbounded. */
  maxLoss: Maybe<number>;
  maxProfitUnlimited: boolean;
  maxLossUnlimited: boolean;
  breakEvens: number[];
  /** Capital that must be committed or held against assignment. */
  requiredCapital: Maybe<number>;
  riskRewardRatio: Maybe<number>;
  netDelta: Maybe<number>;
  netTheta: Maybe<number>;
  netVega: Maybe<number>;
  formula: string;
  computedAt: string;
  status: Extract<DataStatus, 'calculated' | 'unavailable'>;
}

/* --------------------------- Saved positions --------------------------- */

export interface WatchedContract {
  contractSymbol: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  expiry: string;
  addedAt: string;
}

export type OptionAlertKind =
  | 'contract_price_above'
  | 'contract_price_below'
  | 'iv_spike'
  | 'unusual_volume'
  | 'volume_oi_spike'
  | 'expiry_approaching'
  | 'break_even_reached';

export interface OptionAlert {
  id: string;
  contractSymbol: string;
  underlying: string;
  kind: OptionAlertKind;
  threshold: Maybe<number>;
  note: string;
  active: boolean;
  createdAt: string;
  lastTriggeredAt: Maybe<string>;
}

/* ------------------------------ Filters -------------------------------- */

export interface ChainFilters {
  right: OptionRight | 'both';
  moneyness: Moneyness | 'all';
  minStrike: Maybe<number>;
  maxStrike: Maybe<number>;
  minVolume: Maybe<number>;
  minOpenInterest: Maybe<number>;
  minIvPct: Maybe<number>;
  maxIvPct: Maybe<number>;
  minDelta: Maybe<number>;
  maxDelta: Maybe<number>;
  minPremium: Maybe<number>;
  maxPremium: Maybe<number>;
  maxSpreadPct: Maybe<number>;
  /** Limit rows to strikes near the money, which is how a chain is read. */
  strikeWindow: Maybe<number>;
}

export const DEFAULT_CHAIN_FILTERS: ChainFilters = {
  right: 'both',
  moneyness: 'all',
  minStrike: null,
  maxStrike: null,
  minVolume: null,
  minOpenInterest: null,
  minIvPct: null,
  maxIvPct: null,
  minDelta: null,
  maxDelta: null,
  minPremium: null,
  maxPremium: null,
  maxSpreadPct: null,
  strikeWindow: 20,
};
