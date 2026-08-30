/* =========================================================================
   BIG MARGIN — Options strategy engine

   Any strategy is a list of legs, so there is one payoff function rather
   than twelve. That matters for correctness: a bespoke formula per strategy
   is twelve chances to get a sign wrong, and it cannot price the custom
   combination a user builds by hand.

   The expiry payoff of a leg portfolio is piecewise linear with kinks only
   at the strikes. So the extremes are found EXACTLY by evaluating the
   critical points — S = 0, every strike, and far above the highest strike —
   rather than by sampling a grid and hoping the peak was sampled. Likewise
   break-evens are solved by linear interpolation between adjacent critical
   points, not searched for.

   One asymmetry worth stating: the downside is always bounded because a
   share price cannot fall below zero, while the upside is not. Unlimited
   profit or loss is therefore decided by the slope above the highest strike.
   ========================================================================= */

import { isFiniteNumber, round } from '../decimal';
import { greeks as bsGreeks, yearsToExpiry } from './blackScholes';
import { DEFAULT_MODEL, type ModelParams } from './options';
import type {
  Maybe,
  StrategyId,
  StrategyLeg,
  StrategyResult,
} from '@/types/options';

export const STRATEGY_FORMULA = [
  'P&L(S) = Σ legs  qty × multiplier × (payoff_at_expiry(S) − entry price)',
  'call payoff = max(0, S − K)   ·   put payoff = max(0, K − S)   ·   stock payoff = S',
  'Net premium = Σ (−qty × multiplier × price)   [negative = net debit]',
  'Break-even = the price where P&L(S) crosses zero',
].join('\n');

/* ------------------------------------------------------------------ */
/* Payoff                                                              */
/* ------------------------------------------------------------------ */

/**
 * A leg with no premium yields NaN, never a zero cost. Treating an unquoted
 * contract as free would draw a payoff line that is wrong in the one direction
 * that flatters the position, so the whole curve goes unavailable instead.
 */
function legPayoffAtExpiry(leg: StrategyLeg, spot: number): number {
  if (!isFiniteNumber(leg.price)) return NaN;
  if (leg.kind === 'stock') {
    return leg.quantity * (spot - leg.price);
  }
  if (leg.strike == null || leg.right == null) return 0;
  const intrinsic =
    leg.right === 'call'
      ? Math.max(0, spot - leg.strike)
      : Math.max(0, leg.strike - spot);
  return leg.quantity * leg.multiplier * (intrinsic - leg.price);
}

/** Total profit or loss of the position if the underlying settles at `spot`. */
export function payoffAtExpiry(legs: StrategyLeg[], spot: number): number {
  if (!isFiniteNumber(spot)) return NaN;
  return round(
    legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, spot), 0),
    4,
  );
}

/** Slope of the payoff above the highest strike — decides unbounded ends. */
function upperSlope(legs: StrategyLeg[]): number {
  return legs.reduce((s, leg) => {
    if (leg.kind === 'stock') return s + leg.quantity;
    if (leg.right === 'call') return s + leg.quantity * leg.multiplier;
    return s;
  }, 0);
}

function criticalPoints(legs: StrategyLeg[]): number[] {
  const strikes = legs
    .map((l) => l.strike)
    .filter((k): k is number => isFiniteNumber(k) && k > 0);
  const maxStrike = strikes.length ? Math.max(...strikes) : 100;
  const points = new Set<number>([0, ...strikes]);
  // One point well above the last kink pins the far end of the payoff line.
  points.add(round(maxStrike * 3 + 100, 4));
  return [...points].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* Break-evens                                                         */
/* ------------------------------------------------------------------ */

/** Prices where the payoff crosses zero, exact between linear segments. */
export function breakEvens(legs: StrategyLeg[]): number[] {
  const points = criticalPoints(legs);
  const out: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const pa = payoffAtExpiry(legs, a);
    const pb = payoffAtExpiry(legs, b);
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) continue;

    if (Math.abs(pa) < 1e-9) {
      out.push(round(a, 4));
      continue;
    }
    if (pa < 0 !== pb < 0) {
      // Linear within the segment, so one interpolation is exact.
      const t = pa / (pa - pb);
      out.push(round(a + t * (b - a), 4));
    }
  }

  const last = points[points.length - 1];
  if (Math.abs(payoffAtExpiry(legs, last)) < 1e-9) out.push(round(last, 4));

  return [...new Set(out)].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* Full evaluation                                                     */
/* ------------------------------------------------------------------ */

export function evaluateStrategy(
  legs: StrategyLeg[],
  opts: {
    strategyId?: StrategyId;
    spot?: Maybe<number>;
    /** Implied volatility as a percentage, for the net Greeks. */
    ivPct?: Maybe<number>;
    model?: ModelParams;
  } = {},
): StrategyResult {
  const { strategyId = 'custom', spot = null, ivPct = null, model = DEFAULT_MODEL } = opts;
  const now = new Date().toISOString();

  const usable = legs.filter(
    (l) =>
      isFiniteNumber(l.quantity) &&
      l.quantity !== 0 &&
      (l.kind === 'stock' || (isFiniteNumber(l.strike) && l.right != null)),
  );

  if (usable.length === 0) {
    return {
      strategyId,
      legs,
      netPremium: null,
      maxProfit: null,
      maxLoss: null,
      maxProfitUnlimited: false,
      maxLossUnlimited: false,
      breakEvens: [],
      requiredCapital: null,
      riskRewardRatio: null,
      netDelta: null,
      netTheta: null,
      netVega: null,
      formula: STRATEGY_FORMULA,
      computedAt: now,
      status: 'unavailable',
    };
  }

  // Every leg must carry a price before any of this means anything: a missing
  // premium is not a zero premium, so the result goes unavailable as a whole
  // rather than reporting a free position.
  const priced = usable.every((l) => isFiniteNumber(l.price));
  if (!priced) {
    return {
      strategyId,
      legs,
      netPremium: null,
      maxProfit: null,
      maxLoss: null,
      maxProfitUnlimited: false,
      maxLossUnlimited: false,
      breakEvens: [],
      requiredCapital: null,
      riskRewardRatio: null,
      netDelta: null,
      netTheta: null,
      netVega: null,
      formula: STRATEGY_FORMULA,
      computedAt: now,
      status: 'unavailable',
    };
  }

  // Negative = debit paid, positive = credit received.
  const netPremium = round(
    usable
      .filter((l) => l.kind === 'option')
      .reduce((s, l) => s - l.quantity * l.multiplier * (l.price as number), 0),
    4,
  );

  const points = criticalPoints(usable);
  const values = points.map((p) => payoffAtExpiry(usable, p));
  const slope = upperSlope(usable);

  const maxProfitUnlimited = slope > 1e-9;
  const maxLossUnlimited = slope < -1e-9;

  // Exclude the synthetic far point from the extremes when that end runs
  // away — otherwise the reported figure is just wherever we stopped looking.
  const interior = values.slice(0, values.length - 1);
  const finiteMax = Math.max(...(maxProfitUnlimited ? interior : values));
  const finiteMin = Math.min(...(maxLossUnlimited ? interior : values));

  const maxProfit = maxProfitUnlimited ? null : round(finiteMax, 2);
  const maxLoss = maxLossUnlimited ? null : round(finiteMin, 2);

  // Capital at risk is the worst outcome; unbounded risk has no number.
  const requiredCapital =
    maxLoss == null ? null : round(Math.abs(Math.min(0, maxLoss)), 2);

  const riskRewardRatio =
    maxProfit != null && maxLoss != null && Math.abs(maxLoss) > 1e-9
      ? round(maxProfit / Math.abs(maxLoss), 3)
      : null;

  /* ---- net Greeks, when a volatility and a spot are available ---- */
  let netDelta: Maybe<number> = null;
  let netTheta: Maybe<number> = null;
  let netVega: Maybe<number> = null;

  if (isFiniteNumber(spot) && isFiniteNumber(ivPct) && ivPct > 0) {
    let d = 0;
    let th = 0;
    let v = 0;
    let any = false;
    for (const leg of usable) {
      if (leg.kind === 'stock') {
        d += leg.quantity;
        any = true;
        continue;
      }
      const dte = leg.expiry ? daysBetweenToday(leg.expiry) : null;
      const timeYears = dte == null ? null : yearsToExpiry(dte);
      if (timeYears == null || timeYears <= 0 || leg.strike == null || leg.right == null) {
        continue;
      }
      const g = bsGreeks({
        spot,
        strike: leg.strike,
        timeYears,
        volatility: ivPct / 100,
        rate: model.riskFreeRate,
        dividendYield: model.dividendYield,
        right: leg.right,
      });
      if (g.delta == null) continue;
      const scale = leg.quantity * leg.multiplier;
      d += (g.delta ?? 0) * scale;
      th += (g.theta ?? 0) * scale;
      v += (g.vega ?? 0) * scale;
      any = true;
    }
    if (any) {
      netDelta = round(d, 4);
      netTheta = round(th, 4);
      netVega = round(v, 4);
    }
  }

  return {
    strategyId,
    legs,
    netPremium,
    maxProfit,
    maxLoss,
    maxProfitUnlimited,
    maxLossUnlimited,
    breakEvens: breakEvens(usable),
    requiredCapital,
    riskRewardRatio,
    netDelta,
    netTheta,
    netVega,
    formula: STRATEGY_FORMULA,
    computedAt: now,
    status: 'calculated',
  };
}

function daysBetweenToday(expiryIso: string): number | null {
  const end = new Date(`${expiryIso}T21:00:00Z`).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export interface StrategyTemplate {
  id: StrategyId;
  /** Directional stance, used to group the picker. */
  outlook: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  legCount: number;
  /** True when the position is normally opened for a net credit. */
  credit: boolean;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  { id: 'long_call', outlook: 'bullish', legCount: 1, credit: false },
  { id: 'long_put', outlook: 'bearish', legCount: 1, credit: false },
  { id: 'covered_call', outlook: 'neutral', legCount: 2, credit: true },
  { id: 'cash_secured_put', outlook: 'bullish', legCount: 1, credit: true },
  { id: 'bull_call_spread', outlook: 'bullish', legCount: 2, credit: false },
  { id: 'bear_put_spread', outlook: 'bearish', legCount: 2, credit: false },
  { id: 'bull_put_spread', outlook: 'bullish', legCount: 2, credit: true },
  { id: 'bear_call_spread', outlook: 'bearish', legCount: 2, credit: true },
  { id: 'long_straddle', outlook: 'volatile', legCount: 2, credit: false },
  { id: 'long_strangle', outlook: 'volatile', legCount: 2, credit: false },
  { id: 'iron_condor', outlook: 'neutral', legCount: 4, credit: true },
  { id: 'iron_butterfly', outlook: 'neutral', legCount: 4, credit: true },
];

let legSeq = 0;
function leg(partial: Partial<StrategyLeg>): StrategyLeg {
  legSeq += 1;
  return {
    id: `leg_${legSeq}`,
    kind: 'option',
    quantity: 1,
    right: 'call',
    strike: null,
    expiry: null,
    price: null,
    multiplier: 100,
    contractSymbol: null,
    ...partial,
  };
}

/** Rounds to the nearest listed strike increment for a plausible default. */
function nearStrike(spot: number, offsetPct: number): number {
  const raw = spot * (1 + offsetPct / 100);
  const step = spot >= 200 ? 5 : spot >= 50 ? 2.5 : spot >= 20 ? 1 : 0.5;
  return round(Math.round(raw / step) * step, 2);
}

/**
 * Sensible opening legs for a template, placed around the current price.
 * Premiums are left null: they are quotes, and the builder fills them from
 * the chain or the user types them. Never guessed.
 */
export function buildTemplateLegs(
  id: StrategyId,
  spot: number,
  expiry: string,
): StrategyLeg[] {
  const atm = nearStrike(spot, 0);
  const up5 = nearStrike(spot, 5);
  const up10 = nearStrike(spot, 10);
  const down5 = nearStrike(spot, -5);
  const down10 = nearStrike(spot, -10);
  const o = (p: Partial<StrategyLeg>) => leg({ ...p, expiry });

  switch (id) {
    case 'long_call':
      return [o({ right: 'call', strike: atm, quantity: 1 })];
    case 'long_put':
      return [o({ right: 'put', strike: atm, quantity: 1 })];
    case 'covered_call':
      return [
        leg({ kind: 'stock', quantity: 100, multiplier: 1, price: round(spot, 2), right: null, strike: null }),
        o({ right: 'call', strike: up5, quantity: -1 }),
      ];
    case 'cash_secured_put':
      return [o({ right: 'put', strike: down5, quantity: -1 })];
    case 'bull_call_spread':
      return [
        o({ right: 'call', strike: atm, quantity: 1 }),
        o({ right: 'call', strike: up5, quantity: -1 }),
      ];
    case 'bear_put_spread':
      return [
        o({ right: 'put', strike: atm, quantity: 1 }),
        o({ right: 'put', strike: down5, quantity: -1 }),
      ];
    case 'bull_put_spread':
      return [
        o({ right: 'put', strike: down5, quantity: -1 }),
        o({ right: 'put', strike: down10, quantity: 1 }),
      ];
    case 'bear_call_spread':
      return [
        o({ right: 'call', strike: up5, quantity: -1 }),
        o({ right: 'call', strike: up10, quantity: 1 }),
      ];
    case 'long_straddle':
      return [
        o({ right: 'call', strike: atm, quantity: 1 }),
        o({ right: 'put', strike: atm, quantity: 1 }),
      ];
    case 'long_strangle':
      return [
        o({ right: 'call', strike: up5, quantity: 1 }),
        o({ right: 'put', strike: down5, quantity: 1 }),
      ];
    case 'iron_condor':
      return [
        o({ right: 'put', strike: down10, quantity: 1 }),
        o({ right: 'put', strike: down5, quantity: -1 }),
        o({ right: 'call', strike: up5, quantity: -1 }),
        o({ right: 'call', strike: up10, quantity: 1 }),
      ];
    case 'iron_butterfly':
      return [
        o({ right: 'put', strike: down5, quantity: 1 }),
        o({ right: 'put', strike: atm, quantity: -1 }),
        o({ right: 'call', strike: atm, quantity: -1 }),
        o({ right: 'call', strike: up5, quantity: 1 }),
      ];
    default:
      return [o({ right: 'call', strike: atm, quantity: 1 })];
  }
}

export { leg as makeLeg };
