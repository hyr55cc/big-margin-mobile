/* =========================================================================
   BIG MARGIN — Index impact mathematics (TASI and any free-float index)

   TASI is a free-float market-capitalisation weighted index:

       Index Level = Σ (free-float shares × price) ÷ Divisor

   Two consequences drive every figure on the Impact pages:

   1. Sensitivity — a one-unit move in constituent i changes the index by
          free-float shares(i) ÷ Divisor
      which, expressed with the published weight, equals
          weight(i) × Index Level ÷ price(i)
      The second form is preferred because weight, level and price are the
      three fields a data provider is most likely to supply.

   2. Contribution — the points constituent i added to today's index move:
          weight(i) × change%(i) ÷ 100 × previous index level

   Results are always labelled 'calculated'. Where an input is missing the
   result is 'unavailable' and the UI shows "Data unavailable" — never zero.
   ========================================================================= */

import { isFiniteNumber, round } from '../decimal';
import type { ImpactResult, Maybe } from '@/types';

export const POINTS_PER_UNIT_FORMULA =
  'Points per 1 unit = Weight% ÷ 100 × Index Level ÷ Price\n(equivalently: free-float shares ÷ index divisor)';

export const CONTRIBUTION_FORMULA =
  'Contribution (points) = Weight% ÷ 100 × Change% ÷ 100 × Previous Index Level';

export interface ImpactInput {
  symbol: string;
  indexId: string;
  indexLevel: Maybe<number>;
  /** Index level at the previous close, used for today's contribution. */
  indexPreviousLevel?: Maybe<number>;
  weightPct: Maybe<number>;
  price: Maybe<number>;
  changePct?: Maybe<number>;
  /** Optional: exact free-float share count and divisor, when published. */
  freeFloatShares?: Maybe<number>;
  divisor?: Maybe<number>;
}

/** Points of index movement per one currency unit of share-price movement. */
export function pointsPerUnit(input: ImpactInput): Maybe<number> {
  const { indexLevel, weightPct, price, freeFloatShares, divisor } = input;

  // Preferred when the index administrator's divisor is on file.
  if (isFiniteNumber(freeFloatShares) && isFiniteNumber(divisor) && divisor !== 0) {
    return round(freeFloatShares / divisor, 8);
  }

  if (
    !isFiniteNumber(indexLevel) ||
    !isFiniteNumber(weightPct) ||
    !isFiniteNumber(price) ||
    price <= 0
  ) {
    return null;
  }
  return round(((weightPct / 100) * indexLevel) / price, 8);
}

/** Index points contributed by a constituent's move today. */
export function contributionPoints(input: ImpactInput): Maybe<number> {
  const { weightPct, changePct, indexLevel, indexPreviousLevel } = input;
  const base = isFiniteNumber(indexPreviousLevel) ? indexPreviousLevel : indexLevel;
  if (!isFiniteNumber(weightPct) || !isFiniteNumber(changePct) || !isFiniteNumber(base)) {
    return null;
  }
  return round((weightPct / 100) * (changePct / 100) * base, 6);
}

/** Points produced by moving a constituent by a given percentage. */
export function pointsForPctMove(
  input: ImpactInput,
  movePct: number,
): Maybe<number> {
  const { weightPct, indexLevel } = input;
  if (!isFiniteNumber(weightPct) || !isFiniteNumber(indexLevel) || !isFiniteNumber(movePct)) {
    return null;
  }
  return round((weightPct / 100) * (movePct / 100) * indexLevel, 6);
}

/** Points produced by moving a constituent by an absolute price amount. */
export function pointsForPriceMove(
  input: ImpactInput,
  priceDelta: number,
): Maybe<number> {
  const ppu = pointsPerUnit(input);
  if (ppu == null || !isFiniteNumber(priceDelta)) return null;
  return round(ppu * priceDelta, 6);
}

export function computeImpact(input: ImpactInput): ImpactResult {
  const ppu = pointsPerUnit(input);
  const today = contributionPoints(input);
  const usable = ppu != null || today != null;

  return {
    symbol: input.symbol,
    indexId: input.indexId,
    indexLevel: isFiniteNumber(input.indexLevel) ? input.indexLevel : NaN,
    indexDivisor: input.divisor ?? null,
    weightPct: input.weightPct ?? null,
    price: input.price ?? null,
    pointsPerUnit: ppu,
    todayPoints: today,
    formula: `${POINTS_PER_UNIT_FORMULA}\n${CONTRIBUTION_FORMULA}`,
    computedAt: new Date().toISOString(),
    status: usable ? 'calculated' : 'unavailable',
    ...(usable ? {} : { note: 'Missing weight, price or index level.' }),
  };
}

/**
 * Implied divisor derived from the index level and the aggregate free-float
 * market cap of the constituents on file. Only meaningful when the
 * constituent list is complete; the UI labels it Calculated and says so.
 */
export function impliedDivisor(
  aggregateFreeFloatCap: Maybe<number>,
  indexLevel: Maybe<number>,
): Maybe<number> {
  if (
    !isFiniteNumber(aggregateFreeFloatCap) ||
    !isFiniteNumber(indexLevel) ||
    indexLevel === 0
  ) {
    return null;
  }
  return round(aggregateFreeFloatCap / indexLevel, 4);
}

/* ------------------------------------------------------------------ */
/* Multi-stock scenario                                                */
/* ------------------------------------------------------------------ */

export interface ScenarioLeg {
  symbol: string;
  name?: string;
  weightPct: Maybe<number>;
  price: Maybe<number>;
  /** Percentage move applied to this constituent in the scenario. */
  movePct: number;
}

export interface ScenarioLegResult extends ScenarioLeg {
  targetPrice: Maybe<number>;
  priceDelta: Maybe<number>;
  points: Maybe<number>;
}

export interface ScenarioResult {
  legs: ScenarioLegResult[];
  totalPoints: number | null;
  positivePoints: number;
  negativePoints: number;
  indexLevel: Maybe<number>;
  estimatedLevel: Maybe<number>;
  estimatedChangePct: Maybe<number>;
  formula: string;
  computedAt: string;
  status: 'calculated' | 'unavailable';
}

/**
 * A scenario is pure arithmetic on the supplied weights and prices.
 * It is explicitly not a forecast; the UI states this next to the result.
 */
export function runScenario(
  legs: ScenarioLeg[],
  indexLevel: Maybe<number>,
  indexId = 'TASI',
): ScenarioResult {
  const results: ScenarioLegResult[] = legs.map((leg) => {
    const points = pointsForPctMove(
      {
        symbol: leg.symbol,
        indexId,
        indexLevel,
        weightPct: leg.weightPct,
        price: leg.price,
      },
      leg.movePct,
    );
    const targetPrice =
      isFiniteNumber(leg.price) && isFiniteNumber(leg.movePct)
        ? round(leg.price * (1 + leg.movePct / 100), 4)
        : null;
    const priceDelta =
      targetPrice != null && isFiniteNumber(leg.price)
        ? round(targetPrice - leg.price, 4)
        : null;
    return { ...leg, points, targetPrice, priceDelta };
  });

  const usable = results.filter((r) => isFiniteNumber(r.points));
  const totalPoints =
    usable.length === 0
      ? null
      : round(
          usable.reduce((sum, r) => sum + (r.points as number), 0),
          6,
        );

  const positivePoints = round(
    usable.filter((r) => (r.points as number) > 0).reduce((s, r) => s + (r.points as number), 0),
    6,
  );
  const negativePoints = round(
    usable.filter((r) => (r.points as number) < 0).reduce((s, r) => s + (r.points as number), 0),
    6,
  );

  const estimatedLevel =
    totalPoints != null && isFiniteNumber(indexLevel)
      ? round(indexLevel + totalPoints, 4)
      : null;

  const estimatedChangePct =
    totalPoints != null && isFiniteNumber(indexLevel) && indexLevel !== 0
      ? round((totalPoints / indexLevel) * 100, 4)
      : null;

  return {
    legs: results,
    totalPoints,
    positivePoints,
    negativePoints,
    indexLevel: indexLevel ?? null,
    estimatedLevel,
    estimatedChangePct,
    formula:
      'Points(i) = Weight%(i) ÷ 100 × Move%(i) ÷ 100 × Index Level\nEstimated Level = Index Level + Σ Points(i)',
    computedAt: new Date().toISOString(),
    status: totalPoints == null ? 'unavailable' : 'calculated',
  };
}

/* ------------------------------------------------------------------ */
/* Qualitative bands                                                   */
/* ------------------------------------------------------------------ */

export type Band = 'veryHigh' | 'high' | 'medium' | 'low' | 'veryLow';

/** Impact band from index weight — descriptive only, never advisory. */
export function impactBand(weightPct: Maybe<number>): Band | null {
  if (!isFiniteNumber(weightPct)) return null;
  if (weightPct >= 6) return 'veryHigh';
  if (weightPct >= 2.5) return 'high';
  if (weightPct >= 0.8) return 'medium';
  if (weightPct >= 0.2) return 'low';
  return 'veryLow';
}

/** Liquidity band from traded value relative to the market's median. */
export function liquidityBand(
  turnover: Maybe<number>,
  marketMedianTurnover: Maybe<number>,
): Band | null {
  if (!isFiniteNumber(turnover) || !isFiniteNumber(marketMedianTurnover) || marketMedianTurnover <= 0) {
    return null;
  }
  const ratio = turnover / marketMedianTurnover;
  if (ratio >= 8) return 'veryHigh';
  if (ratio >= 3) return 'high';
  if (ratio >= 1) return 'medium';
  if (ratio >= 0.35) return 'low';
  return 'veryLow';
}
