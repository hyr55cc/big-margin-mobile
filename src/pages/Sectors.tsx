import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Card,
  CardHead,
  DataTable,
  Seg,
  ShariahBadge,
  V,
  type Column,
} from '@/components/ui';
import { useStockColumns } from '@/components/market/columns';
import { BarChart, seriesColor, useChartTheme } from '@/components/charts';
import { DASH } from '@/lib/format';
import type { MarketId } from '@/types';

interface SectorAgg {
  id: string;
  name: { ar: string; en: string };
  market: MarketId;
  companies: number;
  marketCap: number | null;
  weightPct: number | null;
  avgChangePct: number | null;
  best: MarketRow | null;
  worst: MarketRow | null;
  highestImpact: MarketRow | null;
  compliant: number;
  nonCompliant: number;
  unknown: number;
}

export default function Sectors() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { rowsFor, sectors } = useMarket();
  const cols = useStockColumns();

  const [market, setMarket] = useState<MarketId>('SA');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = rowsFor(market);

  const aggregates: SectorAgg[] = useMemo(() => {
    const marketSectors = sectors.filter((s) => s.market === market);
    return marketSectors
      .map((s) => {
        const members = rows.filter((r) => r.instrument.sectorId === s.id);
        const priced = members.filter((r) => r.changePct != null);
        const capped = members.filter((r) => r.marketCap != null);
        const weighted = members.filter((r) => r.weightPct != null);
        const sortedByChange = [...priced].sort(
          (a, b) => (b.changePct as number) - (a.changePct as number),
        );
        return {
          id: s.id,
          name: s.name,
          market,
          companies: members.length,
          marketCap: capped.length
            ? capped.reduce((sum, r) => sum + (r.marketCap as number), 0)
            : null,
          weightPct: weighted.length
            ? weighted.reduce((sum, r) => sum + (r.weightPct as number), 0)
            : null,
          avgChangePct: priced.length
            ? priced.reduce((sum, r) => sum + (r.changePct as number), 0) / priced.length
            : null,
          best: sortedByChange[0] ?? null,
          worst: sortedByChange[sortedByChange.length - 1] ?? null,
          highestImpact:
            [...weighted].sort((a, b) => (b.weightPct as number) - (a.weightPct as number))[0] ??
            null,
          compliant: members.filter((r) => r.shariahStatus === 'compliant').length,
          nonCompliant: members.filter((r) => r.shariahStatus === 'non_compliant').length,
          unknown: members.filter((r) => r.shariahStatus === 'unknown').length,
        };
      })
      .filter((s) => s.companies > 0)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  }, [rows, sectors, market]);

  const columns: Column<SectorAgg>[] = [
    {
      key: 'name',
      label: t('g.sector'),
      value: (s) => L(s.name),
      render: (s) => (
        <span className="co-name">
          <span className="n1">{L(s.name)}</span>
          <span className="n2">
            {s.companies} {t('sectors.companies')}
          </span>
        </span>
      ),
    },
    {
      key: 'marketCap',
      label: t('g.marketCap'),
      align: 'end',
      value: (s) => s.marketCap,
      render: (s) => <V>{fmt.compact(s.marketCap)}</V>,
    },
    {
      key: 'weight',
      label: t('sectors.sectorWeight'),
      align: 'end',
      value: (s) => s.weightPct,
      render: (s) => <V>{s.weightPct == null ? DASH : fmt.pct(s.weightPct, { decimals: 2 })}</V>,
    },
    {
      key: 'avg',
      label: t('sectors.avgPerf'),
      align: 'end',
      value: (s) => s.avgChangePct,
      render: (s) => (
        <Badge tone={(s.avgChangePct ?? 0) >= 0 ? 'up' : 'down'}>
          {s.avgChangePct == null ? DASH : fmt.pct(s.avgChangePct, { signed: true })}
        </Badge>
      ),
    },
    {
      key: 'best',
      label: t('sectors.best'),
      value: (s) => s.best?.symbol ?? null,
      render: (s) =>
        s.best ? (
          <span className="row row-2">
            <span className="sym">{s.best.symbol}</span>
            <span className="num up t-sm">{fmt.pct(s.best.changePct, { signed: true })}</span>
          </span>
        ) : (
          <span className="unavailable">{DASH}</span>
        ),
      optional: true,
    },
    {
      key: 'worst',
      label: t('sectors.worst'),
      value: (s) => s.worst?.symbol ?? null,
      render: (s) =>
        s.worst ? (
          <span className="row row-2">
            <span className="sym">{s.worst.symbol}</span>
            <span className="num down t-sm">{fmt.pct(s.worst.changePct, { signed: true })}</span>
          </span>
        ) : (
          <span className="unavailable">{DASH}</span>
        ),
      optional: true,
    },
    {
      key: 'impact',
      label: t('sectors.highestImpact'),
      value: (s) => s.highestImpact?.weightPct ?? null,
      render: (s) =>
        s.highestImpact ? (
          <span className="row row-2">
            <span className="sym">{s.highestImpact.symbol}</span>
            <span className="num t-sm muted">
              {fmt.pct(s.highestImpact.weightPct, { decimals: 2 })}
            </span>
          </span>
        ) : (
          <span className="unavailable">{DASH}</span>
        ),
      optional: true,
    },
    {
      key: 'shariah',
      label: t('sh.status'),
      align: 'end',
      value: (s) => s.compliant,
      render: (s) => (
        <span className="row row-2 row-end">
          <Badge tone="up">{s.compliant}</Badge>
          <Badge tone="down">{s.nonCompliant}</Badge>
          {s.unknown > 0 && <Badge tone="neutral">{s.unknown}</Badge>}
        </span>
      ),
    },
  ];

  const drill = expanded ? rows.filter((r) => r.instrument.sectorId === expanded) : [];
  const expandedSector = aggregates.find((s) => s.id === expanded);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('sectors.title')}
        sub={t('sectors.sub')}
        right={
          <Seg
            value={market}
            onChange={(m) => {
              setMarket(m);
              setExpanded(null);
            }}
            options={[
              { value: 'SA', label: '🇸🇦 ' + t('nav.saudi') },
              { value: 'US', label: '🇺🇸 ' + t('nav.us') },
            ]}
          />
        }
      />

      <Card>
        <CardHead title={t('sectors.sectorWeight')} />
        <div className="card-body">
          <BarChart
            items={aggregates.map((s, i) => ({
              key: s.id,
              label: L(s.name),
              value: s.marketCap,
              color: seriesColor(theme, i),
              sub: `${s.companies}`,
            }))}
            formatValue={(v) => fmt.compact(v)}
            onSelect={(id) => setExpanded(id === expanded ? null : id)}
          />
        </div>
      </Card>

      <Card>
        <CardHead title={t('sectors.title')} />
        <DataTable
          rows={aggregates}
          columns={columns}
          rowKey={(s) => s.id}
          initialSort="marketCap"
          onRowClick={(s) => setExpanded(s.id === expanded ? null : s.id)}
          exportName={`big-margin-sectors-${market.toLowerCase()}`}
          pageSize={30}
        />
      </Card>

      {expandedSector && (
        <Card>
          <CardHead
            title={L(expandedSector.name)}
            sub={`${expandedSector.companies} ${t('sectors.companies')}`}
          />
          <DataTable
            rows={drill}
            columns={[
              cols.symbol,
              cols.price,
              cols.changePct,
              cols.marketCap,
              ...(market === 'SA' ? [cols.weight, cols.todayPoints] : []),
              cols.dividendYield,
              cols.shariah,
            ]}
            rowKey={(r) => r.symbol}
            initialSort="marketCap"
            onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
            pageSize={25}
          />
        </Card>
      )}

      <div className="grid grid-3">
        {aggregates.slice(0, 3).map((s) => (
          <Card key={s.id} className="card-pad">
            <div className="stack stack-3">
              <span className="h-card">{L(s.name)}</span>
              <div className="row row-3 row-wrap">
                <ShariahBadge status="compliant" />
                <span className="num">{s.compliant}</span>
                <ShariahBadge status="non_compliant" />
                <span className="num">{s.nonCompliant}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Disclaimers shariah />
    </div>
  );
}
