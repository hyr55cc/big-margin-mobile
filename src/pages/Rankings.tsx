import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, DataTable, Seg, Tabs } from '@/components/ui';
import { useStockColumns, withRank, type ColumnId } from '@/components/market/columns';
import type { MarketId } from '@/types';
import type { MessageKey } from '@/i18n';

type RankId =
  | 'cap'
  | 'weight'
  | 'impact'
  | 'gainers'
  | 'losers'
  | 'volume'
  | 'dividend'
  | 'volatile'
  | 'momentum'
  | 'shariah';

interface RankSpec {
  id: RankId;
  label: MessageKey;
  sortKey: ColumnId;
  metric: (r: MarketRow) => number | null;
  direction: 'desc' | 'asc';
  filter?: (r: MarketRow) => boolean;
  saudiOnly?: boolean;
  extraColumns?: ColumnId[];
}

const SPECS: RankSpec[] = [
  { id: 'cap', label: 'rank.largestCap', sortKey: 'marketCap', metric: (r) => r.marketCap, direction: 'desc' },
  {
    id: 'weight',
    label: 'rank.largestWeight',
    sortKey: 'weight',
    metric: (r) => r.weightPct,
    direction: 'desc',
    saudiOnly: true,
    extraColumns: ['pointsPerUnit'],
  },
  {
    id: 'impact',
    label: 'rank.largestImpact',
    sortKey: 'todayPoints',
    metric: (r) => (r.todayPoints == null ? null : Math.abs(r.todayPoints)),
    direction: 'desc',
    saudiOnly: true,
    extraColumns: ['weight', 'pointsPerUnit'],
  },
  { id: 'gainers', label: 'rank.gainers', sortKey: 'changePct', metric: (r) => r.changePct, direction: 'desc' },
  { id: 'losers', label: 'rank.losers', sortKey: 'changePct', metric: (r) => r.changePct, direction: 'asc' },
  { id: 'volume', label: 'rank.volume', sortKey: 'turnover', metric: (r) => r.turnover, direction: 'desc', extraColumns: ['volume', 'avgVolume'] },
  {
    id: 'dividend',
    label: 'rank.dividend',
    sortKey: 'dividendYield',
    metric: (r) => r.dividendYieldPct,
    direction: 'desc',
  },
  {
    id: 'volatile',
    label: 'rank.volatile',
    sortKey: 'volatility',
    metric: (r) => r.volatilityPct,
    direction: 'desc',
    extraColumns: ['volatility', 'beta'],
  },
  {
    id: 'momentum',
    label: 'rank.momentum',
    sortKey: 'perf1m',
    metric: (r) => r.perf1m,
    direction: 'desc',
    extraColumns: ['perf1m', 'perf1y'],
  },
  {
    id: 'shariah',
    label: 'rank.shariah',
    sortKey: 'marketCap',
    metric: (r) => r.marketCap,
    direction: 'desc',
    filter: (r) => r.shariahStatus === 'compliant',
  },
];

export default function Rankings() {
  const { t } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rowsFor, loading } = useMarket();
  const cols = useStockColumns();

  const [market, setMarket] = useState<MarketId>('SA');
  const [tab, setTab] = useState<RankId>('cap');

  const spec = SPECS.find((s) => s.id === tab)!;
  const available = SPECS.filter((s) => !s.saudiOnly || market === 'SA');

  const rows = useMemo(() => {
    const base = rowsFor(market)
      .filter((r) => spec.metric(r) != null)
      .filter((r) => (spec.filter ? spec.filter(r) : true));
    return base.sort((a, b) => {
      const av = spec.metric(a) as number;
      const bv = spec.metric(b) as number;
      return spec.direction === 'desc' ? bv - av : av - bv;
    });
  }, [rowsFor, market, spec]);

  const columns = useMemo(() => {
    const base: ColumnId[] = [
      'symbol',
      'price',
      'changePct',
      'marketCap',
      ...(spec.extraColumns ?? []),
      'dividendYield',
      'shariah',
    ];
    const unique = [...new Set(base)];
    return unique.map((id) => cols[id]);
  }, [cols, spec]);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('rank.title')}
        right={
          <Seg
            value={market}
            onChange={(m) => {
              setMarket(m);
              if (m === 'US' && SPECS.find((s) => s.id === tab)?.saudiOnly) setTab('cap');
            }}
            options={[
              { value: 'SA', label: '🇸🇦 ' + t('nav.saudi') },
              { value: 'US', label: '🇺🇸 ' + t('nav.us') },
            ]}
          />
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={available.map((s) => ({ value: s.id, label: t(s.label) }))}
      />

      <Card>
        <DataTable
          rows={rows}
          columns={withRank(columns, rows)}
          rowKey={(r) => r.symbol}
          initialSort={spec.sortKey}
          initialDir={spec.direction}
          onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
          exportName={`big-margin-ranking-${spec.id}`}
          loading={loading}
          pageSize={25}
          toolbar={
            <span className="t-sm muted-3">
              {fmt.int(rows.length)} {t('g.results')}
            </span>
          }
        />
      </Card>

      <Disclaimers shariah={tab === 'shariah'} />
    </div>
  );
}
