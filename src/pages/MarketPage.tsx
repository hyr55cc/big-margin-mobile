import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, PRIMARY_INDEX } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, CardHead, DataTable, Metric, Seg, Select, StatusBadge, Badge } from '@/components/ui';
import { useStockColumns, withRank } from '@/components/market/columns';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import { LineChart } from '@/components/charts';
import { useAsync } from '@/lib/hooks';
import { getProvider } from '@/data/registry';
import type { MarketId, Timeframe } from '@/types';
import { DASH } from '@/lib/format';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'];

export default function MarketPage() {
  const { market: param } = useParams();
  const market: MarketId = param?.toLowerCase() === 'us' ? 'US' : 'SA';
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rowsFor, indices, statuses, sectors, loading } = useMarket();
  const cols = useStockColumns();

  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [tf, setTf] = useState<Timeframe>('1M');

  const indexId = PRIMARY_INDEX[market];
  const index = indices.find((i) => i.id === indexId);
  const rows = rowsFor(market);

  const filtered = useMemo(
    () =>
      sectorFilter === 'all'
        ? rows
        : rows.filter((r) => r.instrument.sectorId === sectorFilter),
    [rows, sectorFilter],
  );

  const series = useAsync(
    () => getProvider().getIndexSeries(indexId, tf),
    [indexId, tf],
  );

  const marketSectors = sectors.filter((s) => s.market === market);

  const breadth = useMemo(() => {
    const priced = rows.filter((r) => r.changePct != null);
    return {
      up: priced.filter((r) => (r.changePct as number) > 0).length,
      down: priced.filter((r) => (r.changePct as number) < 0).length,
      flat: priced.filter((r) => (r.changePct as number) === 0).length,
      volume: priced.reduce((s, r) => s + (r.volume ?? 0), 0),
      turnover: priced.reduce((s, r) => s + (r.turnover ?? 0), 0),
    };
  }, [rows]);

  const tableColumns = [
    cols.symbol,
    cols.price,
    cols.changePct,
    cols.volume,
    cols.turnover,
    cols.marketCap,
    ...(market === 'SA' ? [cols.weight, cols.todayPoints] : []),
    cols.dividendYield,
    cols.shariah,
    cols.pe,
    cols.perf1m,
    cols.impactBand,
    cols.liquidity,
    cols.range52,
  ];

  return (
    <div className="stack stack-5">
      <PageHead
        title={market === 'SA' ? t('dash.saudiMarket') : t('dash.usMarket')}
        sub={index ? L(index.name) : undefined}
        right={<MarketStatusPill status={statuses[market]} showTime />}
      />

      <div className="grid grid-2">
        <Card>
          <CardHead
            title={index ? L(index.name) : indexId}
            right={
              <>
                <Seg value={tf} options={TIMEFRAMES.map((x) => ({ value: x, label: x }))} onChange={setTf} />
                {index && <StatusBadge provenance={index.provenance} />}
              </>
            }
          />
          <div className="card-body stack stack-4">
            <div className="row row-4 row-wrap" style={{ alignItems: 'flex-end' }}>
              <span
                className={`metric-value xl ${(index?.changePct ?? 0) >= 0 ? 'up' : 'down'}`}
              >
                {index?.level == null ? DASH : fmt.num(index.level)}
              </span>
              <Badge tone={(index?.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                {index?.changePct == null ? DASH : fmt.pct(index.changePct, { signed: true })}
              </Badge>
            </div>
            {series.data && series.data.candles.length > 1 && (
              <LineChart
                height={230}
                series={[
                  {
                    key: indexId,
                    name: index ? L(index.name) : indexId,
                    points: series.data.candles.map((c) => ({ t: c.t, v: c.c })),
                  },
                ]}
                formatValue={(v) => fmt.num(v, { decimals: 0 })}
                formatLabel={(x) => (tf === '1D' ? fmt.time(x) : fmt.date(x))}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title={t('g.market')} icon="activity" />
          <div className="card-body">
            <div className="metric-grid">
              <Metric
                label={t('dash.advancers')}
                value={<span className="up">{fmt.int(breadth.up)}</span>}
              />
              <Metric
                label={t('dash.decliners')}
                value={<span className="down">{fmt.int(breadth.down)}</span>}
              />
              <Metric label={t('dash.unchanged')} value={fmt.int(breadth.flat)} />
              <Metric label={t('dash.totalVolume')} value={fmt.compact(breadth.volume)} />
              <Metric label={t('dash.totalValue')} value={fmt.compact(breadth.turnover)} />
              <Metric
                label={t('weight.constituents')}
                value={fmt.int(rows.length)}
                sub={t('g.demo')}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title={t('nav.markets')}
          right={
            <Select
              value={sectorFilter}
              onChange={setSectorFilter}
              options={[
                { value: 'all', label: t('g.all') },
                ...marketSectors.map((s) => ({ value: s.id, label: L(s.name) })),
              ]}
            />
          }
        />
        <DataTable
          rows={filtered}
          columns={withRank(tableColumns, filtered)}
          rowKey={(r) => r.symbol}
          initialSort="marketCap"
          onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
          exportName={`big-margin-${market.toLowerCase()}-market`}
          loading={loading}
          pageSize={30}
        />
      </Card>

      <Disclaimers shariah />
    </div>
  );
}
