/* =========================================================================
   BIG MARGIN — Position mathematics
   Average cost, realised/unrealised P&L, break-even, target price.

   Rules enforced here:
   • Average cost is ALWAYS total cost ÷ total shares. Never a mean of prices.
   • Fees, commission and other costs are part of cost basis on the buy side
     and are deducted from proceeds on the sell side.
   • Realised and unrealised results are kept strictly separate.
   • Every public function returns a Calculation<T> carrying inputs + formula.
   ========================================================================= */

import { dAdd, dDiv, dMul, dSub, isFiniteNumber, round } from '../decimal';
import type { Calculation, Transaction } from '@/types';

const now = () => new Date().toISOString();

function calc<T>(
  value: T,
  inputs: Record<string, number | string | null>,
  formula: string,
): Calculation<T> {
  return { value, inputs, formula, computedAt: now(), status: 'calculated' };
}

function unavailable<T>(
  fallback: T,
  inputs: Record<string, number | string | null>,
  formula: string,
): Calculation<T> {
  return { value: fallback, inputs, formula, computedAt: now(), status: 'unavailable' };
}

/* ------------------------------------------------------------------ */
/* Average cost                                                        */
/* ------------------------------------------------------------------ */

export interface BuyLot {
  price: number;
  quantity: number;
  commission?: number;
  fees?: number;
  otherCosts?: number;
  date?: string;
}

export interface AverageCostResult {
  totalShares: number;
  grossCost: number;
  totalFees: number;
  totalCost: number;
  /** Share-price-only weighted average. */
  weightedAveragePrice: number | null;
  /** Total cost (fees included) ÷ shares. This is the figure that matters. */
  trueAverageCost: number | null;
}

export function averageCost(lots: BuyLot[]): Calculation<AverageCostResult> {
  const clean = lots.filter(
    (l) => isFiniteNumber(l.price) && isFiniteNumber(l.quantity) && l.quantity > 0,
  );

  let totalShares = 0;
  let grossCost = 0;
  let totalFees = 0;

  for (const l of clean) {
    totalShares = dAdd(totalShares, l.quantity);
    grossCost = dAdd(grossCost, dMul(l.price, l.quantity));
    totalFees = dAdd(
      totalFees,
      l.commission ?? 0,
      l.fees ?? 0,
      l.otherCosts ?? 0,
    );
  }

  const totalCost = dAdd(grossCost, totalFees);
  const weightedAveragePrice = dDiv(grossCost, totalShares);
  const trueAverageCost = dDiv(totalCost, totalShares);

  const inputs = {
    lots: clean.length,
    totalShares,
    grossCost: round(grossCost, 4),
    totalFees: round(totalFees, 4),
  };

  const result: AverageCostResult = {
    totalShares,
    grossCost: round(grossCost, 4),
    totalFees: round(totalFees, 4),
    totalCost: round(totalCost, 4),
    weightedAveragePrice:
      weightedAveragePrice == null ? null : round(weightedAveragePrice, 6),
    trueAverageCost:
      trueAverageCost == null ? null : round(trueAverageCost, 6),
  };

  if (totalShares <= 0) {
    return unavailable(
      result,
      inputs,
      'Average Cost = Total Cost ÷ Total Shares',
    );
  }

  return calc(
    result,
    inputs,
    'Total Cost = Σ(price × quantity) + Σ(commission + fees + other)\nAverage Cost = Total Cost ÷ Total Shares',
  );
}

/* ------------------------------------------------------------------ */
/* Averaging down / up simulation                                      */
/* ------------------------------------------------------------------ */

export interface AveragingResult {
  newShares: number;
  newAverage: number | null;
  averageChange: number | null;
  averageChangePct: number | null;
  newCostBasis: number;
  addedCost: number;
}

export function simulateAveraging(
  currentShares: number,
  currentAverage: number,
  addPrice: number,
  addShares: number,
  addFees = 0,
): Calculation<AveragingResult> {
  const validBase =
    isFiniteNumber(currentShares) &&
    isFiniteNumber(currentAverage) &&
    currentShares >= 0;
  const validAdd =
    isFiniteNumber(addPrice) && isFiniteNumber(addShares) && addShares > 0;

  const existingCost = validBase ? dMul(currentShares, currentAverage) : 0;
  const addedCost = validAdd ? dAdd(dMul(addPrice, addShares), addFees) : 0;
  const newShares = dAdd(validBase ? currentShares : 0, validAdd ? addShares : 0);
  const newCostBasis = dAdd(existingCost, addedCost);
  const newAverage = dDiv(newCostBasis, newShares);
  const averageChange =
    newAverage == null || !validBase ? null : round(dSub(newAverage, currentAverage), 6);
  const averageChangePct =
    averageChange == null || currentAverage === 0
      ? null
      : round((averageChange / currentAverage) * 100, 4);

  const result: AveragingResult = {
    newShares,
    newAverage: newAverage == null ? null : round(newAverage, 6),
    averageChange,
    averageChangePct,
    newCostBasis: round(newCostBasis, 4),
    addedCost: round(addedCost, 4),
  };

  const inputs = {
    currentShares,
    currentAverage,
    addPrice,
    addShares,
    addFees,
  };

  const formula =
    'New Average = (Current Shares × Current Average + Added Shares × Added Price + Fees) ÷ (Current Shares + Added Shares)';

  if (!validAdd || newShares <= 0) return unavailable(result, inputs, formula);
  return calc(result, inputs, formula);
}

/** Shares purchasable with a cash amount at a given price. */
export function sharesForAmount(
  amount: number,
  price: number,
  allowFractional = false,
): number | null {
  if (!isFiniteNumber(amount) || !isFiniteNumber(price) || price <= 0) return null;
  const raw = amount / price;
  return allowFractional ? round(raw, 6) : Math.floor(raw);
}

/* ------------------------------------------------------------------ */
/* Break-even                                                          */
/* ------------------------------------------------------------------ */

export interface BreakEvenResult {
  breakEvenPrice: number | null;
  currentPrice: number | null;
  difference: number | null;
  requiredRecoveryPct: number | null;
  above: boolean | null;
}

/**
 * Break-even is the sale price at which net proceeds equal total cost.
 * Sell-side fees are included, expressed either as a flat amount or a rate.
 */
export function breakEven(opts: {
  totalCost: number;
  shares: number;
  currentPrice?: number | null;
  sellFeesFlat?: number;
  /** Sell fee as a fraction of proceeds, e.g. 0.00155 for 15.5 bps. */
  sellFeeRate?: number;
}): Calculation<BreakEvenResult> {
  const { totalCost, shares, currentPrice = null, sellFeesFlat = 0, sellFeeRate = 0 } =
    opts;

  const formula =
    'Break-Even = (Total Cost + Flat Sell Fees) ÷ (Shares × (1 − Sell Fee Rate))';

  const inputs = {
    totalCost,
    shares,
    sellFeesFlat,
    sellFeeRate,
    currentPrice,
  };

  const denom = dMul(shares, 1 - sellFeeRate);
  if (!isFiniteNumber(shares) || shares <= 0 || denom <= 0) {
    return unavailable(
      {
        breakEvenPrice: null,
        currentPrice,
        difference: null,
        requiredRecoveryPct: null,
        above: null,
      },
      inputs,
      formula,
    );
  }

  const be = round(dAdd(totalCost, sellFeesFlat) / denom, 6);
  const difference =
    currentPrice == null ? null : round(dSub(currentPrice, be), 6);
  const requiredRecoveryPct =
    currentPrice == null || currentPrice <= 0
      ? null
      : round(((be - currentPrice) / currentPrice) * 100, 4);

  return calc(
    {
      breakEvenPrice: be,
      currentPrice,
      difference,
      requiredRecoveryPct,
      above: currentPrice == null ? null : currentPrice >= be,
    },
    inputs,
    formula,
  );
}

/* ------------------------------------------------------------------ */
/* Profit & loss on a round trip                                       */
/* ------------------------------------------------------------------ */

export interface PnLResult {
  grossProfit: number | null;
  netProfit: number | null;
  totalCost: number | null;
  proceeds: number | null;
  returnPct: number | null;
  totalFees: number;
}

export function profitLoss(opts: {
  buyPrice: number;
  sellPrice: number;
  shares: number;
  buyFees?: number;
  sellFees?: number;
}): Calculation<PnLResult> {
  const { buyPrice, sellPrice, shares, buyFees = 0, sellFees = 0 } = opts;

  const formula =
    'Gross Profit = (Sell Price − Buy Price) × Shares\nNet Profit = Gross Profit − Buy Fees − Sell Fees\nReturn % = Net Profit ÷ Total Cost × 100';

  const inputs = { buyPrice, sellPrice, shares, buyFees, sellFees };

  if (
    !isFiniteNumber(buyPrice) ||
    !isFiniteNumber(sellPrice) ||
    !isFiniteNumber(shares) ||
    shares <= 0
  ) {
    return unavailable(
      {
        grossProfit: null,
        netProfit: null,
        totalCost: null,
        proceeds: null,
        returnPct: null,
        totalFees: dAdd(buyFees, sellFees),
      },
      inputs,
      formula,
    );
  }

  const grossProfit = dMul(dSub(sellPrice, buyPrice), shares);
  const totalFees = dAdd(buyFees, sellFees);
  const netProfit = dSub(grossProfit, totalFees);
  const totalCost = dAdd(dMul(buyPrice, shares), buyFees);
  const proceeds = dSub(dMul(sellPrice, shares), sellFees);
  const returnPct = totalCost === 0 ? null : round((netProfit / totalCost) * 100, 4);

  return calc(
    {
      grossProfit: round(grossProfit, 4),
      netProfit: round(netProfit, 4),
      totalCost: round(totalCost, 4),
      proceeds: round(proceeds, 4),
      returnPct,
      totalFees: round(totalFees, 4),
    },
    inputs,
    formula,
  );
}

/* ------------------------------------------------------------------ */
/* Target price / target return                                        */
/* ------------------------------------------------------------------ */

export interface TargetPriceResult {
  requiredPrice: number | null;
  targetValue: number | null;
  profitPerShare: number | null;
  returnPct: number | null;
}

/** Price required to realise a given net profit, after sell fees. */
export function targetPrice(opts: {
  averageCost: number;
  shares: number;
  targetProfit: number;
  sellFees?: number;
}): Calculation<TargetPriceResult> {
  const { averageCost: avg, shares, targetProfit, sellFees = 0 } = opts;
  const formula =
    'Required Price = (Average Cost × Shares + Target Profit + Sell Fees) ÷ Shares';
  const inputs = { averageCost: avg, shares, targetProfit, sellFees };

  if (!isFiniteNumber(avg) || !isFiniteNumber(shares) || shares <= 0) {
    return unavailable(
      {
        requiredPrice: null,
        targetValue: null,
        profitPerShare: null,
        returnPct: null,
      },
      inputs,
      formula,
    );
  }

  const costBasis = dMul(avg, shares);
  const targetValue = dAdd(costBasis, targetProfit, sellFees);
  const requiredPrice = dDiv(targetValue, shares);
  const profitPerShare = dDiv(targetProfit, shares);
  const returnPct = costBasis === 0 ? null : round((targetProfit / costBasis) * 100, 4);

  return calc(
    {
      requiredPrice: requiredPrice == null ? null : round(requiredPrice, 6),
      targetValue: round(targetValue, 4),
      profitPerShare: profitPerShare == null ? null : round(profitPerShare, 6),
      returnPct,
    },
    inputs,
    formula,
  );
}

export interface TargetReturnResult {
  targetProfit: number | null;
  targetValue: number | null;
  requiredPrice: number | null;
}

/** Price required to hit a percentage return on an investment. */
export function targetReturn(opts: {
  investment: number;
  shares: number;
  targetReturnPct: number;
}): Calculation<TargetReturnResult> {
  const { investment, shares, targetReturnPct } = opts;
  const formula =
    'Target Profit = Investment × Target Return % ÷ 100\nRequired Price = (Investment + Target Profit) ÷ Shares';
  const inputs = { investment, shares, targetReturnPct };

  if (
    !isFiniteNumber(investment) ||
    !isFiniteNumber(shares) ||
    shares <= 0 ||
    !isFiniteNumber(targetReturnPct)
  ) {
    return unavailable(
      { targetProfit: null, targetValue: null, requiredPrice: null },
      inputs,
      formula,
    );
  }

  const targetProfit = dMul(investment, targetReturnPct / 100);
  const targetValue = dAdd(investment, targetProfit);
  const requiredPrice = dDiv(targetValue, shares);

  return calc(
    {
      targetProfit: round(targetProfit, 4),
      targetValue: round(targetValue, 4),
      requiredPrice: requiredPrice == null ? null : round(requiredPrice, 6),
    },
    inputs,
    formula,
  );
}

/* ------------------------------------------------------------------ */
/* Total return: capital gain + dividends                              */
/* ------------------------------------------------------------------ */

export interface TotalReturnResult {
  capitalGain: number | null;
  dividendIncome: number;
  totalReturn: number | null;
  totalReturnPct: number | null;
  capitalGainPct: number | null;
  dividendReturnPct: number | null;
}

export function totalReturn(opts: {
  costBasis: number;
  currentValue: number;
  dividendIncome?: number;
  realisedProfit?: number;
}): Calculation<TotalReturnResult> {
  const {
    costBasis,
    currentValue,
    dividendIncome = 0,
    realisedProfit = 0,
  } = opts;

  const formula =
    'Capital Gain = Current Value − Cost Basis + Realised Profit\nTotal Return = Capital Gain + Dividend Income\nTotal Return % = Total Return ÷ Cost Basis × 100';
  const inputs = { costBasis, currentValue, dividendIncome, realisedProfit };

  if (!isFiniteNumber(costBasis) || !isFiniteNumber(currentValue)) {
    return unavailable(
      {
        capitalGain: null,
        dividendIncome,
        totalReturn: null,
        totalReturnPct: null,
        capitalGainPct: null,
        dividendReturnPct: null,
      },
      inputs,
      formula,
    );
  }

  const capitalGain = dAdd(dSub(currentValue, costBasis), realisedProfit);
  const total = dAdd(capitalGain, dividendIncome);
  const denom = costBasis;

  return calc(
    {
      capitalGain: round(capitalGain, 4),
      dividendIncome: round(dividendIncome, 4),
      totalReturn: round(total, 4),
      totalReturnPct: denom === 0 ? null : round((total / denom) * 100, 4),
      capitalGainPct: denom === 0 ? null : round((capitalGain / denom) * 100, 4),
      dividendReturnPct:
        denom === 0 ? null : round((dividendIncome / denom) * 100, 4),
    },
    inputs,
    formula,
  );
}

/* ------------------------------------------------------------------ */
/* Transaction ledger → position state                                 */
/* ------------------------------------------------------------------ */

export interface PositionState {
  symbol: string;
  shares: number;
  /** Cost of the shares still held, fees included. */
  costBasis: number;
  averageCost: number | null;
  realisedProfit: number;
  dividendIncome: number;
  totalFees: number;
  /** Set when the ledger tries to sell more than is held. */
  warnings: string[];
}

/**
 * Walks a symbol's transactions in date order using the weighted-average
 * cost method: a sale removes shares at the running average cost, so realised
 * profit and the remaining cost basis never contaminate each other.
 */
export function buildPosition(
  symbol: string,
  transactions: Transaction[],
): PositionState {
  const txs = transactions
    .filter((t) => t.symbol === symbol)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let shares = 0;
  let costBasis = 0;
  let realisedProfit = 0;
  let dividendIncome = 0;
  let totalFees = 0;
  const warnings: string[] = [];

  for (const t of txs) {
    const fees = dAdd(t.commission || 0, t.fees || 0, t.otherCosts || 0);

    if (t.kind === 'buy') {
      if (!isFiniteNumber(t.quantity) || !isFiniteNumber(t.price)) continue;
      shares = dAdd(shares, t.quantity);
      costBasis = dAdd(costBasis, dMul(t.price, t.quantity), fees);
      totalFees = dAdd(totalFees, fees);
    } else if (t.kind === 'sell') {
      if (!isFiniteNumber(t.quantity) || !isFiniteNumber(t.price)) continue;
      const qty = Math.min(t.quantity, shares);
      if (t.quantity > shares + 1e-9) {
        warnings.push(
          `Sale on ${t.date} exceeds shares held (${t.quantity} > ${shares}).`,
        );
      }
      if (shares <= 0) continue;
      const avg = costBasis / shares;
      const removedCost = dMul(avg, qty);
      const proceeds = dSub(dMul(t.price, qty), fees);
      realisedProfit = dAdd(realisedProfit, dSub(proceeds, removedCost));
      costBasis = dSub(costBasis, removedCost);
      shares = dSub(shares, qty);
      totalFees = dAdd(totalFees, fees);
      if (shares <= 1e-9) {
        shares = 0;
        costBasis = 0;
      }
    } else if (t.kind === 'dividend') {
      // Dividend per share × shares held, or a flat amount when quantity is null.
      const amount =
        isFiniteNumber(t.price) && isFiniteNumber(t.quantity)
          ? dMul(t.price, t.quantity)
          : isFiniteNumber(t.price)
            ? dMul(t.price, shares)
            : 0;
      dividendIncome = dAdd(dividendIncome, dSub(amount, fees));
    }
  }

  return {
    symbol,
    shares: round(shares, 6),
    costBasis: round(costBasis, 4),
    averageCost: shares > 0 ? round(costBasis / shares, 6) : null,
    realisedProfit: round(realisedProfit, 4),
    dividendIncome: round(dividendIncome, 4),
    totalFees: round(totalFees, 4),
    warnings,
  };
}
