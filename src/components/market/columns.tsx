import { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { useFmt, type Fmt } from '@/lib/hooks';
import type { MarketRow } from '@/data/MarketContext';
import type { Column } from '@/components/ui';
import { Badge, BandBadge, ShariahBadge, V } from '@/components/ui';
import { SymbolCell, WeightCell } from './cells';
import { DASH } from '@/lib/format';

export type ColumnId =
  | 'rank'
  | 'symbol'
  | 'sector'
  | 'price'
  | 'change'
  | 'changePct'
  | 'volume'
  | 'avgVolume'
  | 'turnover'
  | 'marketCap'
  | 'freeFloatCap'
  | 'weight'
  | 'pointsPerUnit'
  | 'todayPoints'
  | 'impactBand'
  | 'liquidity'
  | 'shariah'
  | 'dividendYield'
  | 'pe'
  | 'eps'
  | 'beta'
  | 'perf1m'
  | 'perf1y'
  | 'volatility'
  | 'range52'
  | 'week52High'
  | 'week52Low';

/**
 * One definition per column, reused by every table in the product so a figure
 * is formatted and sorted identically wherever it appears.
 */
export function useStockColumns(): Record<ColumnId, Column<MarketRow>> {
  const { t, L } = useI18n();
  const fmt: Fmt = useFmt();

  return useMemo(() => {
    const num = (
      key: ColumnId,
      label: string,
      value: (r: MarketRow) => number | null,
      render?: (r: MarketRow) => React.ReactNode,
      opts: Partial<Column<MarketRow>> = {},
    ): Column<MarketRow> => ({
      key,
      label,
      align: 'end',
      value,
      render: render ?? ((r) => <V>{value(r) == null ? DASH : fmt.num(value(r))}</V>),
      ...opts,
    });

    return {
      rank: {
        key: 'rank',
        label: t('g.rank'),
        width: 48,
        sortable: false,
        render: () => null,
      },
      symbol: {
        key: 'symbol',
        label: t('g.company'),
        value: (r) => r.symbol,
        render: (r) => <SymbolCell row={r} />,
      },
      sector: {
        key: 'sector',
        label: t('g.sector'),
        value: (r) => (r.sector ? L(r.sector.name) : null),
        optional: true,
        defaultHidden: true,
      },
      price: num('price', t('g.price'), (r) => r.price),
      change: num(
        'change',
        t('g.change'),
        (r) => r.quote?.change ?? null,
        (r) => (
          <span className={`num ${(r.quote?.change ?? 0) >= 0 ? 'up' : 'down'}`}>
            <V>{r.quote?.change == null ? DASH : fmt.num(r.quote.change, { signed: true })}</V>
          </span>
        ),
        { optional: true, defaultHidden: true },
      ),
      changePct: num(
        'changePct',
        t('g.changePct'),
        (r) => r.changePct,
        (r) => (
          <Badge tone={(r.changePct ?? 0) > 0 ? 'up' : (r.changePct ?? 0) < 0 ? 'down' : 'flat'}>
            {r.changePct == null ? DASH : fmt.pct(r.changePct, { signed: true })}
          </Badge>
        ),
      ),
      volume: num(
        'volume',
        t('g.volume'),
        (r) => r.volume,
        (r) => <V>{fmt.compact(r.volume)}</V>,
      ),
      avgVolume: num(
        'avgVolume',
        t('g.avgVolume'),
        (r) => r.quote?.avgVolume30d ?? null,
        (r) => <V>{fmt.compact(r.quote?.avgVolume30d ?? null)}</V>,
        { optional: true, defaultHidden: true },
      ),
      turnover: num(
        'turnover',
        t('stock.turnover'),
        (r) => r.turnover,
        (r) => <V>{fmt.compact(r.turnover)}</V>,
        { optional: true },
      ),
      marketCap: num(
        'marketCap',
        t('g.marketCap'),
        (r) => r.marketCap,
        (r) => <V>{fmt.compact(r.marketCap)}</V>,
      ),
      freeFloatCap: num(
        'freeFloatCap',
        t('weight.freeFloatCap'),
        (r) => r.constituent?.indexMarketCap ?? null,
        (r) => <V>{fmt.compact(r.constituent?.indexMarketCap ?? null)}</V>,
        { optional: true },
      ),
      weight: num(
        'weight',
        t('weight.weight'),
        (r) => r.weightPct,
        (r) => <WeightCell value={r.weightPct} />,
      ),
      pointsPerUnit: num(
        'pointsPerUnit',
        t('weight.pointsPerSar'),
        (r) => r.pointsPerUnit,
        (r) => (
          <V>{r.pointsPerUnit == null ? DASH : fmt.num(r.pointsPerUnit, { decimals: 4 })}</V>
        ),
      ),
      todayPoints: num(
        'todayPoints',
        t('weight.dailyImpact'),
        (r) => r.todayPoints,
        (r) => (
          <span className={`num ${(r.todayPoints ?? 0) >= 0 ? 'up' : 'down'}`}>
            <V>
              {r.todayPoints == null
                ? DASH
                : fmt.num(r.todayPoints, { decimals: 2, signed: true })}
            </V>
          </span>
        ),
      ),
      impactBand: {
        key: 'impactBand',
        label: t('stock.impact'),
        align: 'end',
        value: (r) => r.weightPct,
        render: (r) => <BandBadge band={r.impactBand} />,
        optional: true,
      },
      liquidity: {
        key: 'liquidity',
        label: t('stock.liquidity'),
        align: 'end',
        value: (r) => r.turnover,
        render: (r) => <BandBadge band={r.liquidityBand} />,
        optional: true,
      },
      shariah: {
        key: 'shariah',
        label: t('sh.status'),
        value: (r) => r.shariahStatus,
        render: (r) => <ShariahBadge status={r.shariahStatus} />,
      },
      dividendYield: num(
        'dividendYield',
        t('div.yield'),
        (r) => r.dividendYieldPct,
        (r) => <V>{r.dividendYieldPct == null ? DASH : fmt.pct(r.dividendYieldPct)}</V>,
      ),
      pe: num('pe', t('stock.pe'), (r) => r.peRatio, undefined, { optional: true }),
      eps: num(
        'eps',
        t('stock.eps'),
        (r) => r.fundamentals?.eps ?? null,
        (r) => <V>{r.fundamentals?.eps == null ? DASH : fmt.num(r.fundamentals.eps, { decimals: 2 })}</V>,
        { optional: true, defaultHidden: true },
      ),
      beta: num('beta', t('stock.beta'), (r) => r.beta, undefined, {
        optional: true,
        defaultHidden: true,
      }),
      perf1m: num(
        'perf1m',
        `${t('stock.performance')} 1M`,
        (r) => r.perf1m,
        (r) => (
          <span className={`num ${(r.perf1m ?? 0) >= 0 ? 'up' : 'down'}`}>
            <V>{r.perf1m == null ? DASH : fmt.pct(r.perf1m, { signed: true })}</V>
          </span>
        ),
        { optional: true },
      ),
      perf1y: num(
        'perf1y',
        `${t('stock.performance')} 1Y`,
        (r) => r.perf1y,
        (r) => (
          <span className={`num ${(r.perf1y ?? 0) >= 0 ? 'up' : 'down'}`}>
            <V>{r.perf1y == null ? DASH : fmt.pct(r.perf1y, { signed: true })}</V>
          </span>
        ),
        { optional: true, defaultHidden: true },
      ),
      volatility: num(
        'volatility',
        `${t('rank.volatile')}`,
        (r) => r.volatilityPct,
        (r) => <V>{r.volatilityPct == null ? DASH : fmt.pct(r.volatilityPct)}</V>,
        { optional: true, defaultHidden: true },
      ),
      range52: num(
        'range52',
        t('scr.f.range52'),
        (r) => r.range52Pct,
        (r) => <V>{r.range52Pct == null ? DASH : fmt.pct(r.range52Pct, { decimals: 0 })}</V>,
        { optional: true, defaultHidden: true },
      ),
      week52High: num(
        'week52High',
        t('stock.week52High'),
        (r) => r.quote?.week52High ?? null,
        undefined,
        { optional: true, defaultHidden: true },
      ),
      week52Low: num(
        'week52Low',
        t('stock.week52Low'),
        (r) => r.quote?.week52Low ?? null,
        undefined,
        { optional: true, defaultHidden: true },
      ),
    };
  }, [t, L, fmt]);
}

/** Adds a 1-based rank column reflecting current sort order. */
export function withRank(columns: Column<MarketRow>[], rows: MarketRow[]): Column<MarketRow>[] {
  const index = new Map(rows.map((r, i) => [r.symbol, i + 1]));
  return [
    {
      key: 'rank',
      label: '#',
      width: 44,
      sortable: false,
      render: (r) => <span className="rank-cell num">{index.get(r.symbol)}</span>,
    },
    ...columns,
  ];
}
