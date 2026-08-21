/* =========================================================================
   BIG MARGIN — Dividend income and capital allocation
   ========================================================================= */

import { dAdd, dDiv, dMul, dSub, isFiniteNumber, round } from '../decimal';
import type { Calculation, DividendFrequency, Maybe } from '@/types';

const now = () => new Date().toISOString();

function calc<T>(
  value: T,
  inputs: Record<string, number | string | null>,
  formula: string,
  status: 'calculated' | 'unavailable' = 'calculated',
): Calculation<T> {
  return { value, inputs, formula, computedAt: now(), status };
}

/* ------------------------------------------------------------------ */
/* Dividend income                                                     */
/* ------------------------------------------------------------------ */

export const PERIODS_PER_YEAR: Record<DividendFrequency, number | null> = {
  annual: 1,
  semi_annual: 2,
  quarterly: 4,
  monthly: 12,
  irregular: null,
  unknown: null,
};

export interface DividendResult {
  incomePerPeriod: number | null;
  annualIncome: number | null;
  monthlyEquivalent: number | null;
  yieldPct: number | null;
  yieldOnCostPct: number | null;
  positionValue: number | null;
}

export function dividendIncome(opts: {
  shares: number;
  dps: number;
  sharePrice?: Maybe<number>;
  averageCost?: Maybe<number>;
  frequency?: DividendFrequency;
  /** Withholding or other deduction as a fraction, e.g. 0.05 for 5%. */
  withholdingRate?: number;
}): Calculation<DividendResult> {
  const {
    shares,
    dps,
    sharePrice = null,
    averageCost = null,
    frequency = 'annual',
    withholdingRate = 0,
  } = opts;

  const formula =
    'Income per Period = Shares × DPS × (1 − Withholding)\nAnnual Income = Income per Period × Periods per Year\nYield % = Annual DPS ÷ Share Price × 100';

  const inputs = {
    shares,
    dps,
    sharePrice,
    averageCost,
    frequency,
    withholdingRate,
  };

  if (!isFiniteNumber(shares) || !isFiniteNumber(dps) || shares <= 0) {
    return calc(
      {
        incomePerPeriod: null,
        annualIncome: null,
        monthlyEquivalent: null,
        yieldPct: null,
        yieldOnCostPct: null,
        positionValue: null,
      },
      inputs,
      formula,
      'unavailable',
    );
  }

  const gross = dMul(shares, dps);
  const incomePerPeriod = dMul(gross, 1 - withholdingRate);
  const periods = PERIODS_PER_YEAR[frequency];
  const annualIncome = periods == null ? null : dMul(incomePerPeriod, periods);
  const annualDps = periods == null ? null : dMul(dps, periods);
  const monthlyEquivalent = annualIncome == null ? null : dDiv(annualIncome, 12);

  const yieldPct =
    annualDps != null && isFiniteNumber(sharePrice) && sharePrice > 0
      ? round((annualDps / sharePrice) * 100, 4)
      : null;

  const yieldOnCostPct =
    annualDps != null && isFiniteNumber(averageCost) && averageCost > 0
      ? round((annualDps / averageCost) * 100, 4)
      : null;

  const positionValue = isFiniteNumber(sharePrice)
    ? round(dMul(shares, sharePrice), 4)
    : null;

  return calc(
    {
      incomePerPeriod: round(incomePerPeriod, 4),
      annualIncome: annualIncome == null ? null : round(annualIncome, 4),
      monthlyEquivalent:
        monthlyEquivalent == null ? null : round(monthlyEquivalent, 4),
      yieldPct,
      yieldOnCostPct,
      positionValue,
    },
    inputs,
    formula,
  );
}

/** Trailing dividend yield from announced distributions over 12 months. */
export function trailingYield(
  announcedLast12m: number[],
  price: Maybe<number>,
): Maybe<number> {
  if (!isFiniteNumber(price) || price <= 0 || announcedLast12m.length === 0) {
    return null;
  }
  const total = announcedLast12m.filter(isFiniteNumber).reduce((a, b) => dAdd(a, b), 0);
  if (total === 0) return null;
  return round((total / price) * 100, 4);
}

/* ------------------------------------------------------------------ */
/* Capital allocation                                                  */
/* ------------------------------------------------------------------ */

export interface AllocationLeg {
  symbol: string;
  price: Maybe<number>;
  allocationPct: number;
  allowFractional?: boolean;
}

export interface AllocationLegResult extends AllocationLeg {
  investAmount: number | null;
  shares: number | null;
  actualSpend: number | null;
  actualPct: number | null;
  leftover: number | null;
}

export interface AllocationResult {
  legs: AllocationLegResult[];
  capital: number;
  totalRequested: number;
  totalSpent: number;
  remainingCash: number;
  overAllocated: boolean;
}

export function allocateCapital(
  capital: number,
  legs: AllocationLeg[],
): Calculation<AllocationResult> {
  const formula =
    'Investment(i) = Capital × Allocation%(i) ÷ 100\nShares(i) = floor(Investment(i) ÷ Price(i))\nActual Spend(i) = Shares(i) × Price(i)';

  const inputs = { capital, positions: legs.length };

  const totalRequestedPct = legs.reduce(
    (s, l) => s + (isFiniteNumber(l.allocationPct) ? l.allocationPct : 0),
    0,
  );

  const results: AllocationLegResult[] = legs.map((leg) => {
    const investAmount = isFiniteNumber(capital) && isFiniteNumber(leg.allocationPct)
      ? round(dMul(capital, leg.allocationPct / 100), 4)
      : null;

    if (investAmount == null || !isFiniteNumber(leg.price) || leg.price <= 0) {
      return {
        ...leg,
        investAmount,
        shares: null,
        actualSpend: null,
        actualPct: null,
        leftover: null,
      };
    }

    const raw = investAmount / leg.price;
    const shares = leg.allowFractional ? round(raw, 6) : Math.floor(raw);
    const actualSpend = round(dMul(shares, leg.price), 4);
    const actualPct = capital > 0 ? round((actualSpend / capital) * 100, 4) : null;
    return {
      ...leg,
      investAmount,
      shares,
      actualSpend,
      actualPct,
      leftover: round(dSub(investAmount, actualSpend), 4),
    };
  });

  const totalSpent = round(
    results.reduce((s, r) => dAdd(s, r.actualSpend ?? 0), 0),
    4,
  );

  const value: AllocationResult = {
    legs: results,
    capital,
    totalRequested: round(totalRequestedPct, 4),
    totalSpent,
    remainingCash: isFiniteNumber(capital) ? round(dSub(capital, totalSpent), 4) : 0,
    overAllocated: totalRequestedPct > 100.000001,
  };

  return calc(
    value,
    inputs,
    formula,
    isFiniteNumber(capital) && capital > 0 ? 'calculated' : 'unavailable',
  );
}
