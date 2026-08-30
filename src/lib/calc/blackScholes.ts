/* =========================================================================
   BIG MARGIN — Option pricing, Greeks and implied volatility

   Black–Scholes–Merton with a continuous dividend yield. This exists because
   an affordable options feed frequently ships prices without Greeks, or
   Greeks without implied volatility. Rather than blank those columns, BIG
   MARGIN computes them — and labels every computed figure 'calculated', the
   same rule the rest of the product follows.

   Two honest limits, stated here because they belong next to the model:

   • Listed US equity options are AMERICAN and may be exercised early, while
     this model prices EUROPEAN exercise. For calls on non-dividend-payers
     the two coincide; elsewhere the model slightly understates puts and
     understates deep-ITM calls on high-yield names. It is the same model the
     industry quotes IV from, so it is the right reference — but it is a
     model, not a quote.
   • The risk-free rate and dividend yield are inputs, not observations. Feed
     them from the product's own configuration and change them deliberately.
   ========================================================================= */

import { isFiniteNumber, round } from '../decimal';
import type { Greeks, Maybe, Moneyness, OptionRight } from '@/types/options';

/** Trading-day convention used to convert DTE into a year fraction. */
export const DAYS_PER_YEAR = 365;

/** Default annual risk-free rate as a decimal. Override per deployment. */
export const DEFAULT_RISK_FREE_RATE = 0.045;

export interface PricingInputs {
  /** Underlying spot price. */
  spot: number;
  strike: number;
  /** Time to expiry in years. */
  timeYears: number;
  /** Volatility as a decimal, e.g. 0.28 for 28%. */
  volatility: number;
  /** Continuously compounded risk-free rate as a decimal. */
  rate?: number;
  /** Continuous dividend yield as a decimal. */
  dividendYield?: number;
  right: OptionRight;
}

/* ------------------------------------------------------------------ */
/* Normal distribution                                                 */
/* ------------------------------------------------------------------ */

/** Standard normal probability density. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution.
 * Abramowitz & Stegun 7.1.26 applied to erf; accurate to ~1.5e-7, which is
 * far finer than any bid-ask spread this is used against.
 */
export function normCdf(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/* ------------------------------------------------------------------ */
/* Core pricing                                                        */
/* ------------------------------------------------------------------ */

interface D1D2 {
  d1: number;
  d2: number;
  discount: number;
  carry: number;
  sqrtT: number;
}

function terms(i: PricingInputs): D1D2 | null {
  const { spot, strike, timeYears, volatility } = i;
  const rate = i.rate ?? DEFAULT_RISK_FREE_RATE;
  const q = i.dividendYield ?? 0;
  if (
    !isFiniteNumber(spot) ||
    !isFiniteNumber(strike) ||
    !isFiniteNumber(timeYears) ||
    !isFiniteNumber(volatility) ||
    spot <= 0 ||
    strike <= 0 ||
    timeYears <= 0 ||
    volatility <= 0
  ) {
    return null;
  }
  const sqrtT = Math.sqrt(timeYears);
  const d1 =
    (Math.log(spot / strike) + (rate - q + (volatility * volatility) / 2) * timeYears) /
    (volatility * sqrtT);
  const d2 = d1 - volatility * sqrtT;
  return {
    d1,
    d2,
    discount: Math.exp(-rate * timeYears),
    carry: Math.exp(-q * timeYears),
    sqrtT,
  };
}

/** Theoretical option value per share. Null when an input is unusable. */
export function optionPrice(i: PricingInputs): Maybe<number> {
  const t = terms(i);
  if (!t) {
    // At or past expiry the option is worth exactly its intrinsic value.
    if (isFiniteNumber(i.spot) && isFiniteNumber(i.strike) && (i.timeYears ?? 0) <= 0) {
      return intrinsicValue(i.spot, i.strike, i.right);
    }
    return null;
  }
  const { d1, d2, discount, carry } = t;
  if (i.right === 'call') {
    return round(i.spot * carry * normCdf(d1) - i.strike * discount * normCdf(d2), 6);
  }
  return round(i.strike * discount * normCdf(-d2) - i.spot * carry * normCdf(-d1), 6);
}

/**
 * All five Greeks, in the units a trading screen displays:
 * delta and gamma per 1 unit of underlying, theta PER CALENDAR DAY, and vega
 * and rho PER 1 PERCENTAGE POINT — not per unit — because that is how they
 * are read.
 */
export function greeks(i: PricingInputs): Greeks {
  const t = terms(i);
  if (!t) return { ...NULL_GREEKS };

  const { d1, d2, discount, carry, sqrtT } = t;
  const rate = i.rate ?? DEFAULT_RISK_FREE_RATE;
  const q = i.dividendYield ?? 0;
  const { spot, strike, timeYears, volatility, right } = i;
  const pdf = normPdf(d1);

  const delta =
    right === 'call' ? carry * normCdf(d1) : carry * (normCdf(d1) - 1);

  const gamma = (carry * pdf) / (spot * volatility * sqrtT);

  // Vega is identical for calls and puts; /100 converts to "per 1 IV point".
  const vega = (spot * carry * pdf * sqrtT) / 100;

  const thetaAnnual =
    right === 'call'
      ? -(spot * carry * pdf * volatility) / (2 * sqrtT) -
        rate * strike * discount * normCdf(d2) +
        q * spot * carry * normCdf(d1)
      : -(spot * carry * pdf * volatility) / (2 * sqrtT) +
        rate * strike * discount * normCdf(-d2) -
        q * spot * carry * normCdf(-d1);

  const rho =
    right === 'call'
      ? (strike * timeYears * discount * normCdf(d2)) / 100
      : (-strike * timeYears * discount * normCdf(-d2)) / 100;

  return {
    delta: round(delta, 6),
    gamma: round(gamma, 6),
    theta: round(thetaAnnual / DAYS_PER_YEAR, 6),
    vega: round(vega, 6),
    rho: round(rho, 6),
    status: 'calculated',
  };
}

const NULL_GREEKS: Greeks = {
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  rho: null,
  status: 'unavailable',
};

/* ------------------------------------------------------------------ */
/* Implied volatility                                                  */
/* ------------------------------------------------------------------ */

/**
 * Implied volatility from a traded price, as a decimal.
 *
 * Bisection rather than Newton–Raphson: vega collapses toward zero for deep
 * in- and out-of-the-money contracts, where Newton diverges. Bisection is
 * slower and always converges, which is the right trade for a chain where a
 * few hundred strikes are solved at once and a single divergence would show
 * up as a nonsense number on screen.
 *
 * Returns null when the target price is outside the no-arbitrage bounds —
 * a stale quote or a crossed market, which should read as "unavailable"
 * rather than as a fabricated volatility.
 */
export function impliedVolatility(opts: {
  price: number;
  spot: number;
  strike: number;
  timeYears: number;
  right: OptionRight;
  rate?: number;
  dividendYield?: number;
  tolerance?: number;
  maxIterations?: number;
}): Maybe<number> {
  const {
    price,
    spot,
    strike,
    timeYears,
    right,
    rate = DEFAULT_RISK_FREE_RATE,
    dividendYield = 0,
    tolerance = 1e-6,
    maxIterations = 100,
  } = opts;

  if (
    !isFiniteNumber(price) ||
    !isFiniteNumber(spot) ||
    !isFiniteNumber(strike) ||
    price <= 0 ||
    spot <= 0 ||
    strike <= 0 ||
    timeYears <= 0
  ) {
    return null;
  }

  // No-arbitrage bounds. A price below intrinsic or above the underlying
  // cannot be produced by any volatility.
  const discount = Math.exp(-rate * timeYears);
  const carry = Math.exp(-dividendYield * timeYears);
  const lowerBound =
    right === 'call'
      ? Math.max(0, spot * carry - strike * discount)
      : Math.max(0, strike * discount - spot * carry);
  const upperBound = right === 'call' ? spot * carry : strike * discount;

  if (price < lowerBound - tolerance || price > upperBound + tolerance) return null;

  let lo = 1e-4;
  let hi = 5;

  const priceAt = (vol: number) =>
    optionPrice({ spot, strike, timeYears, volatility: vol, rate, dividendYield, right }) ?? NaN;

  let pLo = priceAt(lo);
  let pHi = priceAt(hi);
  if (!Number.isFinite(pLo) || !Number.isFinite(pHi)) return null;
  // Target must be bracketed; if it sits above a 500% vol price, give up
  // rather than extrapolate.
  if (price < pLo || price > pHi) return null;

  for (let n = 0; n < maxIterations; n++) {
    const mid = (lo + hi) / 2;
    const pMid = priceAt(mid);
    if (!Number.isFinite(pMid)) return null;
    if (Math.abs(pMid - price) < tolerance || hi - lo < tolerance) {
      return round(mid, 6);
    }
    if (pMid < price) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2, 6);
}

/* ------------------------------------------------------------------ */
/* Contract arithmetic                                                 */
/* ------------------------------------------------------------------ */

/** Value from immediate exercise, per share. Never negative. */
export function intrinsicValue(
  spot: number,
  strike: number,
  right: OptionRight,
): Maybe<number> {
  if (!isFiniteNumber(spot) || !isFiniteNumber(strike)) return null;
  return round(right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot), 6);
}

/** Premium above intrinsic — time plus volatility value. */
export function extrinsicValue(
  premium: Maybe<number>,
  spot: number,
  strike: number,
  right: OptionRight,
): Maybe<number> {
  const intrinsic = intrinsicValue(spot, strike, right);
  if (premium == null || intrinsic == null) return null;
  return round(Math.max(0, premium - intrinsic), 6);
}

/** Underlying price at which a long contract returns its premium at expiry. */
export function breakEvenPrice(
  strike: number,
  premium: Maybe<number>,
  right: OptionRight,
): Maybe<number> {
  if (!isFiniteNumber(strike) || premium == null) return null;
  return round(right === 'call' ? strike + premium : strike - premium, 6);
}

/**
 * ITM / ATM / OTM. "At the money" is a band, not a point: a strike within
 * 0.5% of spot reads as ATM, which matches how a chain is scanned.
 */
export function moneyness(
  spot: Maybe<number>,
  strike: number,
  right: OptionRight,
  atmBandPct = 0.5,
): Maybe<Moneyness> {
  if (!isFiniteNumber(spot) || !isFiniteNumber(strike) || spot <= 0) return null;
  const distancePct = (Math.abs(strike - spot) / spot) * 100;
  if (distancePct <= atmBandPct) return 'ATM';
  if (right === 'call') return strike < spot ? 'ITM' : 'OTM';
  return strike > spot ? 'ITM' : 'OTM';
}

/**
 * Risk-neutral probability of expiring in the money — N(d2) for a call,
 * N(−d2) for a put. This is a model output under the risk-neutral measure,
 * not a real-world forecast, and the UI says so.
 */
export function probabilityItm(i: PricingInputs): Maybe<number> {
  const t = terms(i);
  if (!t) return null;
  const p = i.right === 'call' ? normCdf(t.d2) : normCdf(-t.d2);
  return round(p * 100, 4);
}

/** Calendar days to a year fraction. */
export function yearsToExpiry(dte: number): number {
  return Math.max(0, dte) / DAYS_PER_YEAR;
}

/**
 * Whole calendar days between today and an ISO expiry date.
 *
 * Both ends are reduced to a date before subtracting, so the count does not
 * depend on the time of day the screen happens to be open: expiration day
 * itself is 0 DTE from the opening bell to the close, and the day before is
 * 1 — which is what a chain shows and what a trader means by the number.
 */
export function daysToExpiry(expiryIso: string, from: Date = new Date()): number {
  const end = Date.parse(`${expiryIso}T00:00:00Z`);
  if (!Number.isFinite(end)) return 0;
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

/**
 * Put–call parity residual: C − P − (S·e^(−qT) − K·e^(−rT)).
 * Zero within the spread means the two sides of the chain agree. Used by the
 * validation surface to catch a bad feed rather than shown to end users.
 */
export function parityResidual(opts: {
  callPrice: number;
  putPrice: number;
  spot: number;
  strike: number;
  timeYears: number;
  rate?: number;
  dividendYield?: number;
}): Maybe<number> {
  const {
    callPrice,
    putPrice,
    spot,
    strike,
    timeYears,
    rate = DEFAULT_RISK_FREE_RATE,
    dividendYield = 0,
  } = opts;
  if (![callPrice, putPrice, spot, strike, timeYears].every(isFiniteNumber)) return null;
  const lhs = callPrice - putPrice;
  const rhs =
    spot * Math.exp(-dividendYield * timeYears) - strike * Math.exp(-rate * timeYears);
  return round(lhs - rhs, 6);
}
