/* =========================================================================
   BIG MARGIN — Joined market snapshot

   The four layers of the product — market data, index data, Shariah data and
   the user's own data — meet here. Pages read `MarketRow`, which carries an
   instrument's quote, fundamentals, index weight, computed index impact and
   Shariah classification in one object, so a stock is never presented as a
   set of disconnected facts.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Fundamentals,
  IndexConstituent,
  IndexQuote,
  Instrument,
  MarketId,
  MarketStatus,
  Quote,
  Sector,
  ShariahMethodology,
  ShariahScreening,
  ShariahStatus,
} from '@/types';
import { getProvider, isDemoData } from './registry';
import {
  computeImpact,
  impactBand,
  impliedDivisor,
  liquidityBand,
  type Band,
} from '@/lib/calc/indexImpact';
import type { ImpactResult } from '@/types';
import { useSettings } from '@/store/settings';
import { round } from '@/lib/decimal';

export const PRIMARY_INDEX: Record<MarketId, string> = {
  SA: 'TASI',
  US: 'SPX',
};

export interface MarketRow {
  symbol: string;
  market: MarketId;
  instrument: Instrument;
  quote: Quote | null;
  fundamentals: Fundamentals | null;
  constituent: IndexConstituent | null;
  sector: Sector | null;
  screening: ShariahScreening | null;
  shariahStatus: ShariahStatus;
  impact: ImpactResult | null;
  /** Convenience accessors used by tables, screener and charts. */
  price: number | null;
  changePct: number | null;
  marketCap: number | null;
  turnover: number | null;
  volume: number | null;
  weightPct: number | null;
  pointsPerUnit: number | null;
  todayPoints: number | null;
  dividendYieldPct: number | null;
  peRatio: number | null;
  beta: number | null;
  perf1m: number | null;
  perf1y: number | null;
  volatilityPct: number | null;
  /** Position within the 52-week range, 0 = at the low, 100 = at the high. */
  range52Pct: number | null;
  impactBand: Band | null;
  liquidityBand: Band | null;
}

export interface IndexInfo {
  quote: IndexQuote;
  /** Official divisor when published, otherwise null. */
  divisor: number | null;
  /** Divisor derived from constituents when none is published. */
  derivedDivisor: number | null;
  aggregateFreeFloatCap: number | null;
}

interface MarketSnapshot {
  rows: MarketRow[];
  bySymbol: Map<string, MarketRow>;
  sectors: Sector[];
  indices: IndexQuote[];
  indexInfo: Map<string, IndexInfo>;
  statuses: Record<MarketId, MarketStatus | null>;
  methodologies: ShariahMethodology[];
  loadedAt: string;
}

interface MarketContextValue extends MarketSnapshot {
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  methodologyId: string;
  setMethodologyId: (id: string) => void;
  isDemo: boolean;
  providerName: string;
  rowsFor: (market?: MarketId) => MarketRow[];
  indexLevel: (indexId: string) => number | null;
}

const EMPTY: MarketSnapshot = {
  rows: [],
  bySymbol: new Map(),
  sectors: [],
  indices: [],
  indexInfo: new Map(),
  statuses: { SA: null, US: null },
  methodologies: [],
  loadedAt: '',
};

const Ctx = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const [methodologyId, setMethodologyId] = useState('aaoifi');
  const refreshSeconds = useSettings((s) => s.refreshSeconds);

  useEffect(() => {
    let alive = true;
    const p = getProvider();
    setLoading(true);

    (async () => {
      const [instruments, quotes, fundamentals, sectors, indices, methodologies] =
        await Promise.all([
          p.listInstruments(),
          p.listQuotes(),
          p.listFundamentals(),
          p.listSectors(),
          p.listIndices(),
          p.listMethodologies(),
        ]);

      const activeMethodology =
        methodologies.find((m) => m.id === methodologyId)?.id ??
        methodologies[0]?.id ??
        methodologyId;

      const [screenings, statusSA, statusUS] = await Promise.all([
        p.listScreenings(activeMethodology),
        p.getMarketStatus('SA'),
        p.getMarketStatus('US'),
      ]);

      const indexIds = Array.from(new Set(indices.map((i) => i.id)));
      const constituentLists = await Promise.all(
        indexIds.map((id) => p.listConstituents(id)),
      );
      const divisors = await Promise.all(
        indexIds.map((id) => p.getIndexDivisor(id)),
      );

      if (!alive) return;

      const quoteBy = new Map(quotes.map((q) => [q.symbol, q]));
      const fundBy = new Map(fundamentals.map((f) => [f.symbol, f]));
      const sectorBy = new Map(sectors.map((s) => [s.id, s]));
      const screenBy = new Map(screenings.map((s) => [s.symbol, s]));

      const indexInfo = new Map<string, IndexInfo>();
      const constituentByIndex = new Map<string, Map<string, IndexConstituent>>();

      indexIds.forEach((id, i) => {
        const list = constituentLists[i];
        constituentByIndex.set(id, new Map(list.map((c) => [c.symbol, c])));
        const iq = indices.find((x) => x.id === id)!;
        const aggregate = list.reduce((s, c) => s + (c.indexMarketCap ?? 0), 0);
        indexInfo.set(id, {
          quote: iq,
          divisor: divisors[i],
          derivedDivisor: impliedDivisor(aggregate || null, iq.level),
          aggregateFreeFloatCap: aggregate || null,
        });
      });

      // Median turnover per market gives the liquidity band a reference point.
      const medianTurnover: Record<MarketId, number | null> = { SA: null, US: null };
      (['SA', 'US'] as MarketId[]).forEach((m) => {
        const vals = quotes
          .filter((q) => q.market === m && q.turnover != null)
          .map((q) => q.turnover as number)
          .sort((a, b) => a - b);
        medianTurnover[m] = vals.length ? vals[Math.floor(vals.length / 2)] : null;
      });

      const rows: MarketRow[] = instruments.map((inst) => {
        const quote = quoteBy.get(inst.symbol) ?? null;
        const fundamentalsRow = fundBy.get(inst.symbol) ?? null;
        const primaryIndex = PRIMARY_INDEX[inst.market];
        const constituent =
          constituentByIndex.get(primaryIndex)?.get(inst.symbol) ?? null;
        const info = indexInfo.get(primaryIndex);
        const screening = screenBy.get(inst.symbol) ?? null;

        const impact =
          info == null
            ? null
            : computeImpact({
                symbol: inst.symbol,
                indexId: primaryIndex,
                indexLevel: info.quote.level,
                indexPreviousLevel:
                  info.quote.level != null && info.quote.change != null
                    ? info.quote.level - info.quote.change
                    : null,
                weightPct: constituent?.weightPct ?? null,
                price: quote?.price ?? null,
                changePct: quote?.changePct ?? null,
                freeFloatShares: inst.freeFloatShares,
                divisor: info.divisor ?? info.derivedDivisor,
              });

        const range52Pct =
          quote?.price != null &&
          quote.week52High != null &&
          quote.week52Low != null &&
          quote.week52High > quote.week52Low
            ? round(
                ((quote.price - quote.week52Low) /
                  (quote.week52High - quote.week52Low)) *
                  100,
                2,
              )
            : null;

        return {
          symbol: inst.symbol,
          market: inst.market,
          instrument: inst,
          quote,
          fundamentals: fundamentalsRow,
          constituent,
          sector: sectorBy.get(inst.sectorId) ?? null,
          screening,
          shariahStatus: screening?.status ?? 'unknown',
          impact,
          price: quote?.price ?? null,
          changePct: quote?.changePct ?? null,
          marketCap: quote?.marketCap ?? null,
          turnover: quote?.turnover ?? null,
          volume: quote?.volume ?? null,
          weightPct: constituent?.weightPct ?? null,
          pointsPerUnit: impact?.pointsPerUnit ?? null,
          todayPoints: impact?.todayPoints ?? null,
          dividendYieldPct: fundamentalsRow?.dividendYieldPct ?? null,
          peRatio: fundamentalsRow?.peRatio ?? null,
          beta: fundamentalsRow?.beta ?? null,
          perf1m: quote?.perf1m ?? null,
          perf1y: quote?.perf1y ?? null,
          volatilityPct: quote?.volatilityPct ?? null,
          range52Pct,
          impactBand: impactBand(constituent?.weightPct ?? null),
          liquidityBand: liquidityBand(
            quote?.turnover ?? null,
            medianTurnover[inst.market],
          ),
        };
      });

      setSnapshot({
        rows,
        bySymbol: new Map(rows.map((r) => [r.symbol, r])),
        sectors,
        indices,
        indexInfo,
        statuses: { SA: statusSA, US: statusUS },
        methodologies,
        loadedAt: new Date().toISOString(),
      });
      setError(null);
      setLoading(false);
    })().catch((e: Error) => {
      if (!alive) return;
      setError(e);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [nonce, methodologyId]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (refreshSeconds <= 0) return;
    const id = setInterval(refresh, refreshSeconds * 1000);
    return () => clearInterval(id);
  }, [refreshSeconds, refresh]);

  const rowsFor = useCallback(
    (market?: MarketId) =>
      market ? snapshot.rows.filter((r) => r.market === market) : snapshot.rows,
    [snapshot.rows],
  );

  const indexLevel = useCallback(
    (indexId: string) => snapshot.indexInfo.get(indexId)?.quote.level ?? null,
    [snapshot.indexInfo],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      ...snapshot,
      loading,
      error,
      refresh,
      methodologyId,
      setMethodologyId,
      isDemo: isDemoData(),
      providerName: getProvider().info.name,
      rowsFor,
      indexLevel,
    }),
    [snapshot, loading, error, refresh, methodologyId, rowsFor, indexLevel],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>');
  return ctx;
}

/** Convenience: one row by symbol, or null while the snapshot is loading. */
export function useRow(symbol: string | undefined): MarketRow | null {
  const { bySymbol } = useMarket();
  if (!symbol) return null;
  return bySymbol.get(symbol) ?? null;
}
