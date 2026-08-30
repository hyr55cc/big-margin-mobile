/* =========================================================================
   BIG MARGIN — Contract and chain analytics

   Sits between the raw feed and the screen. Two jobs:

   1. Derive what the vendor did not send. A cheap feed often carries prices
      but no Greeks, or Greeks but no implied volatility. Rather than blank
      the column, BIG MARGIN solves IV from the mid price and prices the
      Greeks from it — and stamps the result 'calculated' so the origin of
      every number stays visible.
   2. Compute what no vendor sends: moneyness, intrinsic and extrinsic split,
      break-even, spread, volume/OI ratio, chain-level put-call ratios and
      max pain.

   Nothing here invents a price. If the inputs are missing, the output is
   null and the interface shows "Data unavailable".
   ========================================================================= */

import { isFiniteNumber, round } from '../decimal';
import {
  breakEvenPrice,
  extrinsicValue,
  greeks as bsGreeks,
  impliedVolatility,
  intrinsicValue,
  moneyness,
  probabilityItm,
  yearsToExpiry,
  DEFAULT_RISK_FREE_RATE,
} from './blackScholes';
import type {
  ChainRow,
  ChainSummary,
  ContractAnalytics,
  Greeks,
  Maybe,
  OptionChain,
  OptionContract,
  UnusualActivity,
} from '@/types/options';

export const ANALYTICS_FORMULA = [
  'Mid = (Bid + Ask) ÷ 2',
  'Intrinsic (call) = max(0, Spot − Strike)   ·   Intrinsic (put) = max(0, Strike − Spot)',
  'Extrinsic = Premium − Intrinsic',
  'Break-even (call) = Strike + Premium   ·   (put) = Strike − Premium',
  'Probability ITM = N(d₂) for a call, N(−d₂) for a put  [risk-neutral]',
  'Volume / OI = Volume ÷ Open Interest',
].join('\n');

export interface ModelParams {
  riskFreeRate: number;
  dividendYield: number;
}

export const DEFAULT_MODEL: ModelParams = {
  riskFreeRate: DEFAULT_RISK_FREE_RATE,
  dividendYield: 0,
};

/* ------------------------------------------------------------------ */
/* Per-contract                                                        */
/* ------------------------------------------------------------------ */

/** Midpoint of the quote, falling back to last when only one side quotes. */
export function midPrice(c: OptionContract): Maybe<number> {
  if (isFiniteNumber(c.bid) && isFiniteNumber(c.ask) && c.ask >= c.bid) {
    return round((c.bid + c.ask) / 2, 4);
  }
  if (isFiniteNumber(c.last)) return c.last;
  if (isFiniteNumber(c.ask)) return c.ask;
  if (isFiniteNumber(c.bid)) return c.bid;
  return null;
}

export function analyseContract(
  c: OptionContract,
  spot: Maybe<number>,
  model: ModelParams = DEFAULT_MODEL,
): ContractAnalytics {
  const now = new Date().toISOString();
  const mid = midPrice(c);
  const premium = mid;

  const spread =
    isFiniteNumber(c.bid) && isFiniteNumber(c.ask) ? round(c.ask - c.bid, 4) : null;
  const spreadPct =
    spread != null && mid != null && mid > 0 ? round((spread / mid) * 100, 2) : null;

  const intrinsic = isFiniteNumber(spot)
    ? intrinsicValue(spot, c.strike, c.right)
    : null;
  const extrinsic = isFiniteNumber(spot)
    ? extrinsicValue(premium, spot, c.strike, c.right)
    : null;

  const timeYears = yearsToExpiry(c.dte);
  const vol =
    c.impliedVolatilityPct != null && c.impliedVolatilityPct > 0
      ? c.impliedVolatilityPct / 100
      : null;

  const pItm =
    isFiniteNumber(spot) && vol != null && timeYears > 0
      ? probabilityItm({
          spot,
          strike: c.strike,
          timeYears,
          volatility: vol,
          rate: model.riskFreeRate,
          dividendYield: model.dividendYield,
          right: c.right,
        })
      : null;

  const volumeOiRatio =
    isFiniteNumber(c.volume) && isFiniteNumber(c.openInterest) && c.openInterest > 0
      ? round(c.volume / c.openInterest, 3)
      : null;

  const usable = mid != null || intrinsic != null;

  return {
    moneyness: moneyness(spot, c.strike, c.right),
    intrinsicValue: intrinsic,
    extrinsicValue: extrinsic,
    breakEven: breakEvenPrice(c.strike, premium, c.right),
    spread,
    spreadPct,
    mid,
    probabilityItm: pItm,
    volumeOiRatio,
    premiumPerContract: mid == null ? null : round(mid * c.multiplier, 2),
    formula: ANALYTICS_FORMULA,
    computedAt: now,
    status: usable ? 'calculated' : 'unavailable',
  };
}

/**
 * Fills in implied volatility and Greeks the vendor did not supply, marking
 * them 'calculated'. Vendor-supplied values are never overwritten — a real
 * quote always outranks a model.
 */
export function enrichContract(
  c: OptionContract,
  spot: Maybe<number>,
  model: ModelParams = DEFAULT_MODEL,
): OptionContract {
  // Every Greek is checked on its own: a feed that supplies delta but not vega
  // is common, and filling the gaps must not cost the value the feed did give.
  const hasGreeks =
    c.greeks.delta != null &&
    c.greeks.gamma != null &&
    c.greeks.theta != null &&
    c.greeks.vega != null &&
    c.greeks.rho != null;
  const hasIv = c.impliedVolatilityPct != null && c.impliedVolatilityPct > 0;
  if (hasGreeks && hasIv) return c;

  const timeYears = yearsToExpiry(c.dte);
  if (!isFiniteNumber(spot) || timeYears <= 0) return c;

  let ivPct = hasIv ? (c.impliedVolatilityPct as number) : null;

  if (ivPct == null) {
    const mid = midPrice(c);
    if (mid != null && mid > 0) {
      const solved = impliedVolatility({
        price: mid,
        spot,
        strike: c.strike,
        timeYears,
        right: c.right,
        rate: model.riskFreeRate,
        dividendYield: model.dividendYield,
      });
      if (solved != null) ivPct = round(solved * 100, 4);
    }
  }

  if (ivPct == null) return c;

  let nextGreeks: Greeks = c.greeks;
  if (!hasGreeks) {
    const modelled = bsGreeks({
      spot,
      strike: c.strike,
      timeYears,
      volatility: ivPct / 100,
      rate: model.riskFreeRate,
      dividendYield: model.dividendYield,
      right: c.right,
    });
    // Vendor value wins field by field; the model only fills what is missing.
    // The status becomes 'calculated' because at least one number is modelled,
    // which is what the contract sheet reads to label the Greeks' source.
    nextGreeks = {
      delta: c.greeks.delta ?? modelled.delta,
      gamma: c.greeks.gamma ?? modelled.gamma,
      theta: c.greeks.theta ?? modelled.theta,
      vega: c.greeks.vega ?? modelled.vega,
      rho: c.greeks.rho ?? modelled.rho,
      status: modelled.status === 'unavailable' ? c.greeks.status : 'calculated',
    };
  }

  return { ...c, impliedVolatilityPct: ivPct, greeks: nextGreeks };
}

/** Applies enrichment across a whole chain. */
export function enrichChain(chain: OptionChain, model: ModelParams = DEFAULT_MODEL): OptionChain {
  const spot = chain.underlyingPrice;
  return {
    ...chain,
    rows: chain.rows.map((r) => ({
      strike: r.strike,
      call: r.call ? enrichContract(r.call, spot, model) : null,
      put: r.put ? enrichContract(r.put, spot, model) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Chain level                                                         */
/* ------------------------------------------------------------------ */

function sumOf(values: Array<Maybe<number>>): Maybe<number> {
  const valid = values.filter(isFiniteNumber);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

/**
 * Max pain: the strike at which the aggregate intrinsic value owed to option
 * holders at expiry is smallest. A widely watched figure, and a descriptive
 * one — it is arithmetic on open interest, not a prediction of settlement.
 */
export function maxPainStrike(rows: ChainRow[], multiplier = 100): Maybe<number> {
  const strikes = rows.map((r) => r.strike).filter(isFiniteNumber);
  if (strikes.length === 0) return null;

  let best: { strike: number; pain: number } | null = null;

  for (const candidate of strikes) {
    let pain = 0;
    let contributed = false;
    for (const row of rows) {
      const callOi = row.call?.openInterest;
      const putOi = row.put?.openInterest;
      if (isFiniteNumber(callOi) && candidate > row.strike) {
        pain += callOi * (candidate - row.strike) * multiplier;
        contributed = true;
      }
      if (isFiniteNumber(putOi) && candidate < row.strike) {
        pain += putOi * (row.strike - candidate) * multiplier;
        contributed = true;
      }
    }
    if (!contributed) continue;
    if (best == null || pain < best.pain) best = { strike: candidate, pain };
  }

  return best?.strike ?? null;
}

export function summariseChain(chain: OptionChain): ChainSummary {
  const calls = chain.rows.map((r) => r.call).filter((c): c is OptionContract => c != null);
  const puts = chain.rows.map((r) => r.put).filter((c): c is OptionContract => c != null);

  const callVolume = sumOf(calls.map((c) => c.volume));
  const putVolume = sumOf(puts.map((c) => c.volume));
  const callOi = sumOf(calls.map((c) => c.openInterest));
  const putOi = sumOf(puts.map((c) => c.openInterest));

  // Weighting IV by open interest keeps a single illiquid far-OTM strike
  // from dominating the average, which a plain mean would allow.
  const weighted = [...calls, ...puts].filter(
    (c) => isFiniteNumber(c.impliedVolatilityPct) && isFiniteNumber(c.openInterest),
  );
  const weightTotal = weighted.reduce((s, c) => s + (c.openInterest as number), 0);
  const averageIvPct =
    weightTotal > 0
      ? round(
          weighted.reduce(
            (s, c) => s + (c.impliedVolatilityPct as number) * (c.openInterest as number),
            0,
          ) / weightTotal,
          2,
        )
      : null;

  const totalPremium = sumOf(
    [...calls, ...puts].map((c) => {
      const mid = midPrice(c);
      return mid != null && isFiniteNumber(c.volume) ? mid * c.volume * c.multiplier : null;
    }),
  );

  const anyData = callVolume != null || putVolume != null || callOi != null || putOi != null;

  return {
    underlying: chain.underlying,
    expiry: chain.expiry,
    callVolume,
    putVolume,
    callOpenInterest: callOi,
    putOpenInterest: putOi,
    putCallVolumeRatio:
      isFiniteNumber(putVolume) && isFiniteNumber(callVolume) && callVolume > 0
        ? round(putVolume / callVolume, 3)
        : null,
    putCallOiRatio:
      isFiniteNumber(putOi) && isFiniteNumber(callOi) && callOi > 0
        ? round(putOi / callOi, 3)
        : null,
    averageIvPct,
    maxPainStrike: maxPainStrike(chain.rows),
    totalPremium: totalPremium == null ? null : round(totalPremium, 0),
    status: anyData ? 'calculated' : 'unavailable',
  };
}

/* ------------------------------------------------------------------ */
/* Unusual activity                                                    */
/* ------------------------------------------------------------------ */

/**
 * Contracts trading far above their own open interest. The volume/OI ratio
 * is the standard screen: above 1 means more contracts changed hands today
 * than were outstanding at the open, which usually signals new positioning.
 *
 * This is a description of today's tape, not a signal — the UI says so.
 */
export function findUnusualActivity(
  chain: OptionChain,
  opts: { minRatio?: number; minVolume?: number; limit?: number } = {},
): UnusualActivity[] {
  const { minRatio = 1, minVolume = 100, limit = 25 } = opts;
  const all: OptionContract[] = [];
  for (const row of chain.rows) {
    if (row.call) all.push(row.call);
    if (row.put) all.push(row.put);
  }

  const scored: UnusualActivity[] = [];
  for (const c of all) {
    if (!isFiniteNumber(c.volume) || !isFiniteNumber(c.openInterest) || c.openInterest <= 0) {
      continue;
    }
    const ratio = c.volume / c.openInterest;
    if (ratio < minRatio || c.volume < minVolume) continue;
    const mid = midPrice(c);
    scored.push({
      contract: c,
      volumeOiRatio: round(ratio, 3),
      volumeVsAverage: null,
      premium: mid == null ? null : round(mid * c.volume * c.multiplier, 0),
    });
  }

  return scored.sort((a, b) => b.volumeOiRatio - a.volumeOiRatio).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* IV rank and percentile                                              */
/* ------------------------------------------------------------------ */

/** Where today's IV sits inside its own 52-week range, 0–100. */
export function ivRank(
  current: Maybe<number>,
  low: Maybe<number>,
  high: Maybe<number>,
): Maybe<number> {
  if (!isFiniteNumber(current) || !isFiniteNumber(low) || !isFiniteNumber(high)) return null;
  if (high <= low) return null;
  return round(((current - low) / (high - low)) * 100, 2);
}

/** Share of past observations below today's IV, 0–100. */
export function ivPercentile(current: Maybe<number>, history: number[]): Maybe<number> {
  if (!isFiniteNumber(current) || history.length === 0) return null;
  const below = history.filter((v) => isFiniteNumber(v) && v < current).length;
  return round((below / history.length) * 100, 2);
}
