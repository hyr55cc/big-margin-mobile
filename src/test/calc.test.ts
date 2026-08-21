/* =========================================================================
   BIG MARGIN — calculation engine tests
   The numbers users act on come from these functions, so each one is pinned
   to a hand-worked example, including the missing-data and edge cases.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import {
  averageCost,
  breakEven,
  buildPosition,
  profitLoss,
  simulateAveraging,
  targetPrice,
  targetReturn,
  totalReturn,
} from '@/lib/calc/position';
import {
  computeImpact,
  contributionPoints,
  impactBand,
  impliedDivisor,
  pointsForPctMove,
  pointsPerUnit,
  runScenario,
} from '@/lib/calc/indexImpact';
import { allocateCapital, dividendIncome, trailingYield } from '@/lib/calc/income';
import { dAdd, parseNum, pctChange, round } from '@/lib/decimal';
import { fmtCompact, fmtNum, fmtPct, toCsv, DASH } from '@/lib/format';
import type { Transaction } from '@/types';

/* ------------------------------ decimal ------------------------------- */

describe('decimal', () => {
  it('adds without binary float drift', () => {
    expect(dAdd(0.1, 0.2)).toBe(0.3);
    expect(dAdd(0.1, 0.2, 0.3)).toBe(0.6);
    // The classic case: 100 × 0.07 in floats is 7.000000000000001.
    expect(dAdd(...Array(10).fill(0.1))).toBe(1);
  });

  it('rounds half away from zero, defeating 1.005 → 1.00', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
    expect(round(-1.005, 2)).toBe(-1.01);
  });

  it('returns null rather than Infinity on a zero base', () => {
    expect(pctChange(0, 10)).toBeNull();
    expect(pctChange(null, 10)).toBeNull();
    expect(pctChange(50, 55)).toBe(10);
  });

  it('parses Arabic-Indic digits and separators', () => {
    expect(parseNum('١٢٣٤')).toBe(1234);
    expect(parseNum('1,250.75')).toBe(1250.75);
    expect(parseNum('١٢٫٥')).toBe(12.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});

/* ---------------------------- average cost ---------------------------- */

describe('averageCost', () => {
  it('uses total cost ÷ total shares, never a mean of prices', () => {
    // 100 @ 10 and 900 @ 20 → the naive mean of prices is 15, the truth is 19.
    const r = averageCost([
      { price: 10, quantity: 100 },
      { price: 20, quantity: 900 },
    ]);
    expect(r.value.totalShares).toBe(1000);
    expect(r.value.grossCost).toBe(19000);
    expect(r.value.weightedAveragePrice).toBe(19);
    expect(r.value.trueAverageCost).toBe(19);
    expect(r.status).toBe('calculated');
  });

  it('absorbs commission, fees and other costs into the true average', () => {
    const r = averageCost([
      { price: 50, quantity: 100, commission: 15, fees: 5, otherCosts: 5 },
      { price: 60, quantity: 100, commission: 15, fees: 5 },
    ]);
    expect(r.value.grossCost).toBe(11000);
    expect(r.value.totalFees).toBe(45);
    expect(r.value.totalCost).toBe(11045);
    expect(r.value.weightedAveragePrice).toBe(55);
    expect(r.value.trueAverageCost).toBe(55.225);
  });

  it('reports unavailable rather than dividing by zero', () => {
    const r = averageCost([]);
    expect(r.status).toBe('unavailable');
    expect(r.value.trueAverageCost).toBeNull();
  });

  it('ignores malformed lots instead of poisoning the total', () => {
    const r = averageCost([
      { price: 10, quantity: 100 },
      { price: Number.NaN, quantity: 50 },
      { price: 12, quantity: -5 },
    ]);
    expect(r.value.totalShares).toBe(100);
    expect(r.value.trueAverageCost).toBe(10);
  });
});

/* --------------------------- averaging sim ---------------------------- */

describe('simulateAveraging', () => {
  it('lowers the average when adding below cost', () => {
    const r = simulateAveraging(500, 55, 45, 300);
    expect(r.value.newShares).toBe(800);
    // (500×55 + 300×45) / 800 = 51.25
    expect(r.value.newAverage).toBe(51.25);
    expect(r.value.averageChange).toBe(-3.75);
    expect(r.value.newCostBasis).toBe(41000);
  });

  it('counts the fees paid on the additional purchase', () => {
    const r = simulateAveraging(100, 10, 10, 100, 50);
    // (1000 + 1000 + 50) / 200 = 10.25
    expect(r.value.newAverage).toBe(10.25);
  });

  it('handles a first purchase from a standing start', () => {
    const r = simulateAveraging(0, 0, 25, 400);
    expect(r.value.newAverage).toBe(25);
    expect(r.value.newShares).toBe(400);
  });
});

/* ----------------------------- break-even ----------------------------- */

describe('breakEven', () => {
  it('adds sell-side fees to the price that clears cost', () => {
    const r = breakEven({ totalCost: 10000, shares: 200, sellFeesFlat: 40 });
    expect(r.value.breakEvenPrice).toBe(50.2);
  });

  it('supports a proportional sell fee', () => {
    const r = breakEven({ totalCost: 10000, shares: 100, sellFeeRate: 0.002 });
    // 10000 / (100 × 0.998) = 100.2004008…
    expect(r.value.breakEvenPrice).toBeCloseTo(100.200401, 5);
  });

  it('reports the recovery still required from the current price', () => {
    const r = breakEven({ totalCost: 11000, shares: 200, currentPrice: 50 });
    expect(r.value.breakEvenPrice).toBe(55);
    expect(r.value.requiredRecoveryPct).toBe(10);
    expect(r.value.above).toBe(false);
  });

  it('is unavailable with no shares, never Infinity', () => {
    const r = breakEven({ totalCost: 500, shares: 0 });
    expect(r.status).toBe('unavailable');
    expect(r.value.breakEvenPrice).toBeNull();
  });
});

/* ---------------------------- profit / loss --------------------------- */

describe('profitLoss', () => {
  it('separates gross from net and computes return on total cost', () => {
    const r = profitLoss({
      buyPrice: 50,
      sellPrice: 60,
      shares: 500,
      buyFees: 30,
      sellFees: 30,
    });
    expect(r.value.grossProfit).toBe(5000);
    expect(r.value.netProfit).toBe(4940);
    expect(r.value.totalCost).toBe(25030);
    expect(r.value.proceeds).toBe(29970);
    expect(r.value.returnPct).toBeCloseTo(19.7363, 3);
  });

  it('handles a loss symmetrically', () => {
    const r = profitLoss({ buyPrice: 60, sellPrice: 50, shares: 100, buyFees: 10, sellFees: 10 });
    expect(r.value.grossProfit).toBe(-1000);
    expect(r.value.netProfit).toBe(-1020);
    expect((r.value.returnPct as number) < 0).toBe(true);
  });

  it('is unavailable with zero shares', () => {
    const r = profitLoss({ buyPrice: 10, sellPrice: 12, shares: 0 });
    expect(r.status).toBe('unavailable');
    expect(r.value.netProfit).toBeNull();
  });
});

/* ------------------------------ targets ------------------------------- */

describe('targets', () => {
  it('finds the price a profit goal requires, fees included', () => {
    const r = targetPrice({ averageCost: 50, shares: 500, targetProfit: 10000, sellFees: 50 });
    // (25000 + 10000 + 50) / 500 = 70.1
    expect(r.value.requiredPrice).toBe(70.1);
    expect(r.value.profitPerShare).toBe(20);
    expect(r.value.returnPct).toBe(40);
  });

  it('converts a percentage goal into a required price', () => {
    const r = targetReturn({ investment: 25000, shares: 500, targetReturnPct: 20 });
    expect(r.value.targetProfit).toBe(5000);
    expect(r.value.targetValue).toBe(30000);
    expect(r.value.requiredPrice).toBe(60);
  });

  it('keeps capital gain and dividend income separate in total return', () => {
    const r = totalReturn({ costBasis: 100000, currentValue: 120000, dividendIncome: 5000 });
    expect(r.value.capitalGain).toBe(20000);
    expect(r.value.dividendIncome).toBe(5000);
    expect(r.value.totalReturn).toBe(25000);
    expect(r.value.totalReturnPct).toBe(25);
    expect(r.value.capitalGainPct).toBe(20);
    expect(r.value.dividendReturnPct).toBe(5);
  });
});

/* ------------------------- transaction ledger ------------------------- */

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  portfolioId: 'pf',
  kind: 'buy',
  symbol: '2222',
  market: 'SA',
  date: '2026-01-01',
  quantity: 100,
  price: 30,
  commission: 0,
  fees: 0,
  otherCosts: 0,
  currency: 'SAR',
  note: '',
  ...p,
});

describe('buildPosition', () => {
  it('keeps realised and unrealised results strictly separate', () => {
    const pos = buildPosition('2222', [
      tx({ date: '2026-01-01', kind: 'buy', quantity: 100, price: 30 }),
      tx({ date: '2026-02-01', kind: 'buy', quantity: 100, price: 40 }),
      tx({ date: '2026-03-01', kind: 'sell', quantity: 100, price: 50 }),
    ]);
    // Average cost after both buys is 35; selling 100 at 50 realises 1,500.
    expect(pos.shares).toBe(100);
    expect(pos.averageCost).toBe(35);
    expect(pos.costBasis).toBe(3500);
    expect(pos.realisedProfit).toBe(1500);
  });

  it('applies fees to cost basis on the buy and to proceeds on the sell', () => {
    const pos = buildPosition('2222', [
      tx({ kind: 'buy', quantity: 100, price: 10, commission: 20 }),
      tx({ date: '2026-02-01', kind: 'sell', quantity: 50, price: 12, commission: 10 }),
    ]);
    // Cost basis 1,020 → average 10.20. Sale of 50 removes 510 of cost,
    // proceeds 600 − 10 = 590, so realised = 80.
    expect(pos.averageCost).toBe(10.2);
    expect(pos.realisedProfit).toBe(80);
    expect(pos.shares).toBe(50);
    expect(pos.costBasis).toBe(510);
  });

  it('flags an oversell instead of going negative', () => {
    const pos = buildPosition('2222', [
      tx({ kind: 'buy', quantity: 100, price: 10 }),
      tx({ date: '2026-02-01', kind: 'sell', quantity: 150, price: 12 }),
    ]);
    expect(pos.shares).toBe(0);
    expect(pos.warnings.length).toBe(1);
  });

  it('processes transactions in date order regardless of entry order', () => {
    const later = buildPosition('2222', [
      tx({ date: '2026-03-01', kind: 'sell', quantity: 100, price: 50 }),
      tx({ date: '2026-01-01', kind: 'buy', quantity: 100, price: 30 }),
      tx({ date: '2026-02-01', kind: 'buy', quantity: 100, price: 40 }),
    ]);
    expect(later.realisedProfit).toBe(1500);
    expect(later.warnings.length).toBe(0);
  });

  it('accrues dividend income without touching cost basis', () => {
    const pos = buildPosition('2222', [
      tx({ kind: 'buy', quantity: 1000, price: 30 }),
      tx({ date: '2026-04-01', kind: 'dividend', price: 1.5, quantity: null }),
    ]);
    expect(pos.dividendIncome).toBe(1500);
    expect(pos.costBasis).toBe(30000);
    expect(pos.averageCost).toBe(30);
  });

  it('zeroes the position cleanly when fully sold', () => {
    const pos = buildPosition('2222', [
      tx({ kind: 'buy', quantity: 100, price: 10 }),
      tx({ date: '2026-02-01', kind: 'sell', quantity: 100, price: 15 }),
    ]);
    expect(pos.shares).toBe(0);
    expect(pos.costBasis).toBe(0);
    expect(pos.averageCost).toBeNull();
    expect(pos.realisedProfit).toBe(500);
  });
});

/* ---------------------------- index impact ---------------------------- */

describe('index impact', () => {
  const base = {
    symbol: '2222',
    indexId: 'TASI',
    indexLevel: 11000,
    weightPct: 10,
    price: 30,
  };

  it('derives points per unit from weight, level and price', () => {
    // 10% × 11000 / 30 = 36.6667 points per 1 SAR.
    expect(pointsPerUnit(base)).toBeCloseTo(36.66666667, 6);
  });

  it('prefers the published divisor when one is on file', () => {
    // 2,000,000,000 free-float shares ÷ divisor 50,000,000 = 40 points per SAR.
    expect(
      pointsPerUnit({ ...base, freeFloatShares: 2_000_000_000, divisor: 50_000_000 }),
    ).toBe(40);
  });

  it('agrees with the weight formula when both paths are available', () => {
    // The stock is 10% of the index, so its free-float cap is
    // 0.10 × level × divisor. Solving for the divisor that makes a given
    // share count consistent with a 10% weight at a price of 30:
    const shares = 366_666_666.67;
    const divisor = (shares * 30) / (0.1 * 11000);
    expect(pointsPerUnit({ ...base, freeFloatShares: shares, divisor })).toBeCloseTo(
      pointsPerUnit(base) as number,
      4,
    );
  });

  it('computes today’s contribution from weight × change × previous level', () => {
    // 10% × 2% × 11000 = 22 points.
    expect(
      contributionPoints({ ...base, changePct: 2, indexPreviousLevel: 11000 }),
    ).toBe(22);
  });

  it('returns null — not zero — when an input is missing', () => {
    expect(pointsPerUnit({ ...base, weightPct: null })).toBeNull();
    expect(pointsPerUnit({ ...base, price: 0 })).toBeNull();
    expect(contributionPoints({ ...base, changePct: null })).toBeNull();
    const res = computeImpact({ ...base, weightPct: null, price: null });
    expect(res.status).toBe('unavailable');
  });

  it('labels every impact result as calculated', () => {
    expect(computeImpact({ ...base, changePct: 1 }).status).toBe('calculated');
  });

  it('derives an implied divisor from cap and level', () => {
    expect(impliedDivisor(1.1e11, 11000)).toBe(10_000_000);
    expect(impliedDivisor(null, 11000)).toBeNull();
    expect(impliedDivisor(1.1e11, 0)).toBeNull();
  });

  it('scales a percentage move into index points', () => {
    expect(pointsForPctMove(base, 3)).toBeCloseTo(33, 6);
    expect(pointsForPctMove(base, -3)).toBeCloseTo(-33, 6);
  });

  it('sums a multi-stock scenario and splits contributors by sign', () => {
    const r = runScenario(
      [
        { symbol: '2222', weightPct: 10, price: 30, movePct: 2 },
        { symbol: '1120', weightPct: 5, price: 80, movePct: 3 },
        { symbol: '2010', weightPct: 4, price: 70, movePct: -2 },
      ],
      11000,
    );
    // 22 + 16.5 − 8.8 = 29.7 points.
    expect(r.totalPoints).toBeCloseTo(29.7, 6);
    expect(r.positivePoints).toBeCloseTo(38.5, 6);
    expect(r.negativePoints).toBeCloseTo(-8.8, 6);
    expect(r.estimatedLevel).toBeCloseTo(11029.7, 4);
    expect(r.status).toBe('calculated');
  });

  it('marks a scenario unavailable when nothing can be computed', () => {
    const r = runScenario([{ symbol: 'X', weightPct: null, price: null, movePct: 5 }], 11000);
    expect(r.totalPoints).toBeNull();
    expect(r.status).toBe('unavailable');
  });

  it('bands impact by weight and returns null for missing weight', () => {
    expect(impactBand(9)).toBe('veryHigh');
    expect(impactBand(3)).toBe('high');
    expect(impactBand(1)).toBe('medium');
    expect(impactBand(0.05)).toBe('veryLow');
    expect(impactBand(null)).toBeNull();
  });
});

/* ------------------------------- income ------------------------------- */

describe('dividend income', () => {
  it('annualises by frequency and derives the monthly equivalent', () => {
    const r = dividendIncome({
      shares: 1000,
      dps: 1.5,
      sharePrice: 40,
      frequency: 'quarterly',
    });
    expect(r.value.incomePerPeriod).toBe(1500);
    expect(r.value.annualIncome).toBe(6000);
    expect(r.value.monthlyEquivalent).toBe(500);
    expect(r.value.yieldPct).toBe(15);
  });

  it('applies withholding to the income, not the yield basis', () => {
    const r = dividendIncome({ shares: 100, dps: 2, sharePrice: 50, frequency: 'annual', withholdingRate: 0.05 });
    expect(r.value.incomePerPeriod).toBe(190);
    expect(r.value.yieldPct).toBe(4);
  });

  it('leaves annual income null when the frequency is irregular', () => {
    const r = dividendIncome({ shares: 100, dps: 1, frequency: 'irregular' });
    expect(r.value.incomePerPeriod).toBe(100);
    expect(r.value.annualIncome).toBeNull();
    expect(r.value.yieldPct).toBeNull();
  });

  it('computes yield on cost separately from market yield', () => {
    const r = dividendIncome({
      shares: 100,
      dps: 1,
      sharePrice: 50,
      averageCost: 25,
      frequency: 'annual',
    });
    expect(r.value.yieldPct).toBe(2);
    expect(r.value.yieldOnCostPct).toBe(4);
  });

  it('refuses to compute a trailing yield without a price', () => {
    expect(trailingYield([1, 1, 1, 1], null)).toBeNull();
    expect(trailingYield([], 50)).toBeNull();
    expect(trailingYield([1, 1, 1, 1], 50)).toBe(8);
  });
});

/* ----------------------------- allocation ----------------------------- */

describe('allocateCapital', () => {
  it('buys whole shares and reports the unallocated remainder', () => {
    const r = allocateCapital(100000, [
      { symbol: 'A', price: 30, allocationPct: 50 },
      { symbol: 'B', price: 70, allocationPct: 30 },
    ]);
    // 50,000/30 → 1,666 shares = 49,980. 30,000/70 → 428 shares = 29,960.
    expect(r.value.legs[0].shares).toBe(1666);
    expect(r.value.legs[0].actualSpend).toBe(49980);
    expect(r.value.legs[1].shares).toBe(428);
    expect(r.value.totalSpent).toBe(79940);
    expect(r.value.remainingCash).toBe(20060);
    expect(r.value.overAllocated).toBe(false);
  });

  it('flags an allocation above 100%', () => {
    const r = allocateCapital(1000, [
      { symbol: 'A', price: 10, allocationPct: 70 },
      { symbol: 'B', price: 10, allocationPct: 50 },
    ]);
    expect(r.value.overAllocated).toBe(true);
  });

  it('leaves shares null for an instrument with no price', () => {
    const r = allocateCapital(1000, [{ symbol: 'A', price: null, allocationPct: 50 }]);
    expect(r.value.legs[0].shares).toBeNull();
    expect(r.value.totalSpent).toBe(0);
  });
});

/* ----------------------------- formatting ----------------------------- */

describe('formatting', () => {
  it('renders an em dash for every flavour of missing value', () => {
    expect(fmtNum(null)).toBe(DASH);
    expect(fmtNum(undefined)).toBe(DASH);
    expect(fmtNum(Number.NaN)).toBe(DASH);
    expect(fmtPct(null)).toBe(DASH);
    expect(fmtCompact(null)).toBe(DASH);
  });

  it('never turns a missing value into zero', () => {
    expect(fmtNum(null)).not.toBe('0');
    expect(fmtPct(null)).not.toBe('0%');
  });

  it('signs positives only when asked', () => {
    expect(fmtPct(2.5, { signed: true })).toBe('+2.50%');
    expect(fmtPct(-2.5, { signed: true })).toBe('-2.50%');
    expect(fmtPct(2.5)).toBe('2.50%');
  });

  it('compacts magnitudes with sensible precision', () => {
    expect(fmtCompact(1_850_000_000_000)).toBe('1.85T');
    expect(fmtCompact(1_240_000_000)).toBe('1.24B');
    expect(fmtCompact(45_600_000)).toBe('45.6M');
    expect(fmtCompact(999)).toBe('999');
  });

  it('escapes CSV cells containing commas and quotes', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"'], [1, null, 3]])).toBe(
      'a,"b,c","say ""hi""\"\n1,,3',
    );
  });
});
