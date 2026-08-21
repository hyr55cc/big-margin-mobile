/* =========================================================================
   BIG MARGIN — Portfolio aggregation
   Joins the user's transaction ledger to the live market snapshot.
   ========================================================================= */

import { useMemo } from 'react';
import { dAdd, dMul, dSub, isFiniteNumber, round } from './decimal';
import { buildPosition, breakEven, type PositionState } from './calc/position';
import { usePortfolio } from '@/store/portfolio';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import type { Currency, MarketId, ShariahStatus, Transaction } from '@/types';

export interface Position extends PositionState {
  row: MarketRow | null;
  market: MarketId | null;
  currency: Currency;
  price: number | null;
  marketValue: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
  todayPnl: number | null;
  breakEvenPrice: number | null;
  requiredRecoveryPct: number | null;
  weightInPortfolioPct: number | null;
  shariahStatus: ShariahStatus;
  indexWeightPct: number | null;
  totalReturn: number | null;
  totalReturnPct: number | null;
}

export interface PortfolioSummary {
  positions: Position[];
  closedSymbols: string[];
  cash: number;
  invested: number;
  currentValue: number;
  realised: number;
  unrealised: number;
  todayPnl: number;
  dividends: number;
  totalReturn: number;
  totalReturnPct: number | null;
  totalValue: number;
  /** Portfolio market value split by Shariah classification, in percent. */
  shariahMix: Record<ShariahStatus, number>;
  /** Σ (position weight × TASI weight) for Saudi holdings. */
  indexExposurePct: number | null;
  warnings: string[];
  baseCurrency: Currency;
  /** True when a position is priced in a currency other than the base. */
  mixedCurrency: boolean;
}

/**
 * Cash balance from deposits, withdrawals, trades and dividends.
 * Cash is tracked in the portfolio's base currency; FX conversion is a backend
 * concern and is deliberately not guessed here.
 */
function cashBalance(txs: Transaction[]): number {
  let cash = 0;
  for (const t of txs) {
    const fees = dAdd(t.commission || 0, t.fees || 0, t.otherCosts || 0);
    switch (t.kind) {
      case 'deposit':
        cash = dAdd(cash, t.price ?? 0);
        break;
      case 'withdrawal':
        cash = dSub(cash, t.price ?? 0);
        break;
      case 'buy':
        if (isFiniteNumber(t.price) && isFiniteNumber(t.quantity)) {
          cash = dSub(cash, dAdd(dMul(t.price, t.quantity), fees));
        }
        break;
      case 'sell':
        if (isFiniteNumber(t.price) && isFiniteNumber(t.quantity)) {
          cash = dAdd(cash, dSub(dMul(t.price, t.quantity), fees));
        }
        break;
      case 'dividend':
        if (isFiniteNumber(t.price)) {
          cash = dAdd(cash, dMul(t.price, t.quantity ?? 0));
        }
        break;
    }
  }
  return round(cash, 4);
}

export function usePortfolioSummary(): PortfolioSummary {
  const activeId = usePortfolio((s) => s.activeId);
  const portfolios = usePortfolio((s) => s.portfolios);
  const allTx = usePortfolio((s) => s.transactions);
  const { bySymbol } = useMarket();

  return useMemo(() => {
    const portfolio = portfolios.find((p) => p.id === activeId) ?? portfolios[0];
    const baseCurrency: Currency = portfolio?.baseCurrency ?? 'SAR';
    const txs = allTx.filter((t) => t.portfolioId === (portfolio?.id ?? activeId));

    const symbols = Array.from(
      new Set(txs.filter((t) => t.symbol).map((t) => t.symbol as string)),
    );

    const warnings: string[] = [];
    const built = symbols.map((sym) => {
      const state = buildPosition(sym, txs);
      warnings.push(...state.warnings);
      return state;
    });

    const open = built.filter((p) => p.shares > 0);
    const closedSymbols = built.filter((p) => p.shares <= 0).map((p) => p.symbol);

    const enriched: Position[] = open.map((p) => {
      const row = bySymbol.get(p.symbol) ?? null;
      const price = row?.price ?? null;
      const marketValue = price == null ? null : round(dMul(p.shares, price), 4);
      const unrealised = marketValue == null ? null : round(dSub(marketValue, p.costBasis), 4);
      const unrealisedPct =
        unrealised == null || p.costBasis === 0
          ? null
          : round((unrealised / p.costBasis) * 100, 4);
      const changeAbs = row?.quote?.change ?? null;
      const todayPnl = changeAbs == null ? null : round(dMul(p.shares, changeAbs), 4);
      const be = breakEven({
        totalCost: p.costBasis,
        shares: p.shares,
        currentPrice: price,
      });
      const totalReturn =
        unrealised == null ? null : round(dAdd(unrealised, p.realisedProfit, p.dividendIncome), 4);
      return {
        ...p,
        row,
        market: row?.market ?? null,
        currency: row?.instrument.currency ?? baseCurrency,
        price,
        marketValue,
        unrealised,
        unrealisedPct,
        todayPnl,
        breakEvenPrice: be.value.breakEvenPrice,
        requiredRecoveryPct: be.value.requiredRecoveryPct,
        weightInPortfolioPct: null,
        shariahStatus: row?.shariahStatus ?? 'unknown',
        indexWeightPct: row?.weightPct ?? null,
        totalReturn,
        totalReturnPct:
          totalReturn == null || p.costBasis === 0
            ? null
            : round((totalReturn / p.costBasis) * 100, 4),
      };
    });

    const currentValue = round(
      enriched.reduce((s, p) => dAdd(s, p.marketValue ?? 0), 0),
      4,
    );
    enriched.forEach((p) => {
      p.weightInPortfolioPct =
        currentValue > 0 && p.marketValue != null
          ? round((p.marketValue / currentValue) * 100, 4)
          : null;
    });

    const invested = round(
      enriched.reduce((s, p) => dAdd(s, p.costBasis), 0),
      4,
    );
    const realised = round(
      built.reduce((s, p) => dAdd(s, p.realisedProfit), 0),
      4,
    );
    const dividends = round(
      built.reduce((s, p) => dAdd(s, p.dividendIncome), 0),
      4,
    );
    const unrealised = round(
      enriched.reduce((s, p) => dAdd(s, p.unrealised ?? 0), 0),
      4,
    );
    const todayPnl = round(
      enriched.reduce((s, p) => dAdd(s, p.todayPnl ?? 0), 0),
      4,
    );
    const cash = cashBalance(txs);
    const totalReturn = round(dAdd(unrealised, realised, dividends), 4);

    const mix: Record<ShariahStatus, number> = {
      compliant: 0,
      non_compliant: 0,
      unknown: 0,
    };
    for (const p of enriched) {
      if (p.marketValue == null) continue;
      mix[p.shariahStatus] = dAdd(mix[p.shariahStatus], p.marketValue);
    }
    const mixTotal = mix.compliant + mix.non_compliant + mix.unknown;
    (Object.keys(mix) as ShariahStatus[]).forEach((k) => {
      mix[k] = mixTotal > 0 ? round((mix[k] / mixTotal) * 100, 2) : 0;
    });

    const saudi = enriched.filter((p) => p.market === 'SA' && p.indexWeightPct != null);
    const saudiValue = saudi.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    const indexExposurePct =
      saudiValue > 0
        ? round(
            saudi.reduce(
              (s, p) => s + ((p.marketValue ?? 0) / saudiValue) * (p.indexWeightPct as number),
              0,
            ),
            4,
          )
        : null;

    return {
      positions: enriched.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)),
      closedSymbols,
      cash,
      invested,
      currentValue,
      realised,
      unrealised,
      todayPnl,
      dividends,
      totalReturn,
      totalReturnPct: invested > 0 ? round((totalReturn / invested) * 100, 4) : null,
      totalValue: round(dAdd(currentValue, cash), 4),
      shariahMix: mix,
      indexExposurePct,
      warnings,
      baseCurrency,
      mixedCurrency: new Set(enriched.map((p) => p.currency)).size > 1,
    };
  }, [activeId, portfolios, allTx, bySymbol]);
}
