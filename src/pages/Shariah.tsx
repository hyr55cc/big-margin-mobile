import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  DataTable,
  Metric,
  Notice,
  Seg,
  Select,
  ShariahBadge,
  TextInput,
  V,
  type Column,
} from '@/components/ui';
import { useStockColumns } from '@/components/market/columns';
import { ShariahRatios } from '@/components/market/ShariahPanel';
import { DonutChart, useChartTheme } from '@/components/charts';
import { DASH } from '@/lib/format';
import type { MarketId, ShariahStatus } from '@/types';
import type { MarketRow } from '@/data/MarketContext';

export default function Shariah() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { rows, rowsFor, methodologies, methodologyId, setMethodologyId, loading } = useMarket();
  const cols = useStockColumns();

  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [status, setStatus] = useState<ShariahStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const scope = market === 'all' ? rows : rowsFor(market);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scope
      .filter((r) => status === 'all' || r.shariahStatus === status)
      .filter(
        (r) =>
          !needle ||
          r.symbol.toLowerCase().includes(needle) ||
          r.instrument.name.en.toLowerCase().includes(needle) ||
          r.instrument.name.ar.includes(q.trim()),
      );
  }, [scope, status, q]);

  const counts = useMemo(() => {
    const compliant = scope.filter((r) => r.shariahStatus === 'compliant');
    const non = scope.filter((r) => r.shariahStatus === 'non_compliant');
    const unknown = scope.filter((r) => r.shariahStatus === 'unknown');
    const capOf = (list: MarketRow[]) => list.reduce((s, r) => s + (r.marketCap ?? 0), 0);
    const totalCap = capOf(scope) || 1;
    return {
      compliant: compliant.length,
      non: non.length,
      unknown: unknown.length,
      compliantCapPct: (capOf(compliant) / totalCap) * 100,
      nonCapPct: (capOf(non) / totalCap) * 100,
      unknownCapPct: (capOf(unknown) / totalCap) * 100,
    };
  }, [scope]);

  const methodology = methodologies.find((m) => m.id === methodologyId);

  const extra: Column<MarketRow>[] = [
    {
      key: 'income',
      label: t('sh.nonCompliantIncome'),
      align: 'end',
      value: (r) => r.screening?.nonCompliantIncomePct ?? null,
      render: (r) => (
        <V>
          {r.screening?.nonCompliantIncomePct == null
            ? DASH
            : fmt.pct(r.screening.nonCompliantIncomePct)}
        </V>
      ),
    },
    {
      key: 'debt',
      label: t('sh.ratios'),
      align: 'end',
      value: (r) => r.screening?.ratios.find((x) => x.key === 'debt')?.valuePct ?? null,
      render: (r) => {
        const ratios = r.screening?.ratios ?? [];
        if (ratios.length === 0) return <span className="unavailable">{DASH}</span>;
        return (
          <span className="row row-2 row-end">
            {ratios.map((x) => (
              <Badge key={x.key} tone={x.passes === false ? 'down' : x.passes ? 'up' : 'neutral'}>
                {x.valuePct == null ? DASH : fmt.pct(x.valuePct, { decimals: 0 })}
              </Badge>
            ))}
          </span>
        );
      },
      optional: true,
    },
    {
      key: 'screeningDate',
      label: t('sh.screeningDate'),
      align: 'end',
      value: (r) => r.screening?.screeningDate ?? null,
      render: (r) => <V>{fmt.date(r.screening?.screeningDate ?? null)}</V>,
      optional: true,
    },
  ];

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('sh.title')}
        sub={t('sh.sub')}
        right={
          <>
            <Select
              value={methodologyId}
              onChange={setMethodologyId}
              options={methodologies.map((m) => ({ value: m.id, label: m.shortName }))}
            />
            <Btn icon="external" onClick={() => navigate('/app/shariah/methodology')}>
              {t('sh.methodologyPage')}
            </Btn>
          </>
        }
      />

      <Notice tone="warn" icon="warning">
        {t('sh.disclaimer')}
      </Notice>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title={t('sh.status')}
            sub={methodology ? L(methodology.name) : methodologyId}
            icon="crescent"
          />
          <div className="card-body">
            <DonutChart
              size={200}
              items={[
                {
                  key: 'compliant',
                  label: t('sh.compliant'),
                  value: counts.compliantCapPct,
                  color: theme.up,
                },
                {
                  key: 'non',
                  label: t('sh.nonCompliant'),
                  value: counts.nonCapPct,
                  color: theme.down,
                },
                {
                  key: 'unknown',
                  label: t('sh.unknown'),
                  value: counts.unknownCapPct,
                  color: theme.flat,
                },
              ]}
              formatValue={(v) => fmt.pct(v, { decimals: 1 })}
              center={
                <div className="stack" style={{ gap: 0 }}>
                  <span className="eyebrow">{t('g.marketCap')}</span>
                  <span className="metric-value">{fmt.pct(counts.compliantCapPct, { decimals: 0 })}</span>
                </div>
              }
            />
          </div>
        </Card>

        <Card>
          <CardHead title={t('weight.constituents')} icon="layers" />
          <div className="card-body">
            <div className="metric-grid">
              <Metric
                label={t('sh.compliant')}
                value={<span className="up">{fmt.int(counts.compliant)}</span>}
                size="xl"
                sub={fmt.pct(counts.compliantCapPct, { decimals: 1 }) + ' ' + t('g.marketCap')}
              />
              <Metric
                label={t('sh.nonCompliant')}
                value={<span className="down">{fmt.int(counts.non)}</span>}
                size="xl"
                sub={fmt.pct(counts.nonCapPct, { decimals: 1 })}
              />
              <Metric
                label={t('sh.unknown')}
                value={fmt.int(counts.unknown)}
                size="xl"
                sub={fmt.pct(counts.unknownCapPct, { decimals: 1 })}
              />
            </div>
            {methodology && (
              <div className="stack stack-2" style={{ marginTop: 'var(--s-5)' }}>
                <span className="eyebrow">{t('sh.rules')}</span>
                {methodology.rules.map((r) => (
                  <div key={r.key} className="row row-between t-sm">
                    <span className="muted">{L(r.label)}</span>
                    <span className="num">{r.threshold}</span>
                  </div>
                ))}
                <Link
                  to={`/app/shariah/methodology/${methodology.id}`}
                  className="t-sm"
                  style={{ color: 'var(--bm-brand)' }}
                >
                  {t('sh.methodologyPage')} →
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={t('sh.title')} />
        <DataTable
          rows={filtered}
          columns={[
            cols.symbol,
            cols.shariah,
            ...extra,
            cols.price,
            cols.changePct,
            cols.marketCap,
            cols.weight,
            cols.dividendYield,
            cols.sector,
          ]}
          rowKey={(r) => r.symbol}
          initialSort="marketCap"
          onRowClick={(r) => setExpanded(expanded === r.symbol ? null : r.symbol)}
          exportName="big-margin-shariah"
          loading={loading}
          pageSize={30}
          toolbar={
            <>
              <div style={{ width: 200 }}>
                <TextInput value={q} onChange={setQ} placeholder={t('g.searchShort')} />
              </div>
              <Seg
                value={market}
                onChange={setMarket}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'SA', label: '🇸🇦' },
                  { value: 'US', label: '🇺🇸' },
                ]}
              />
              <Seg
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'compliant', label: t('sh.compliant') },
                  { value: 'non_compliant', label: t('sh.nonCompliant') },
                  { value: 'unknown', label: t('sh.unknown') },
                ]}
              />
            </>
          }
        />
      </Card>

      {expanded && (
        <Card>
          <CardHead
            title={
              <span className="row row-3">
                <span className="sym">{expanded}</span>
                <ShariahBadge status={rows.find((r) => r.symbol === expanded)?.shariahStatus ?? 'unknown'} />
              </span>
            }
            right={
              <Btn size="sm" onClick={() => navigate(`/app/stock/${expanded}`)}>
                {t('g.viewProfile')}
              </Btn>
            }
          />
          {(() => {
            const screening = rows.find((r) => r.symbol === expanded)?.screening;
            return screening ? <ShariahRatios screening={screening} /> : null;
          })()}
        </Card>
      )}

      <Disclaimers shariah />
    </div>
  );
}
