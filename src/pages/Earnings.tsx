import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Card,
  CardHead,
  DataTable,
  Notice,
  Seg,
  StatusBadge,
  V,
  type Column,
} from '@/components/ui';
import { SymbolCell } from '@/components/market/cells';
import { DASH } from '@/lib/format';
import type { EarningsEvent, MarketId } from '@/types';

type View = 'today' | 'tomorrow' | 'week' | 'nextWeek' | 'all';

function inView(date: string | null, view: View): boolean {
  if (view === 'all') return true;
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(date).getTime() - today.getTime()) / 86400000);
  switch (view) {
    case 'today':
      return diff === 0;
    case 'tomorrow':
      return diff === 1;
    case 'week':
      return diff >= 0 && diff <= 7;
    case 'nextWeek':
      return diff > 7 && diff <= 14;
  }
}

export default function Earnings() {
  const { t } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { bySymbol } = useMarket();

  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [view, setView] = useState<View>('all');

  const state = useAsync(() => getProvider().listEarnings({}), []);

  const rows = useMemo(
    () =>
      (state.data ?? [])
        .filter((e) => market === 'all' || e.market === market)
        .filter((e) => inView(e.date, view))
        .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1)),
    [state.data, market, view],
  );

  const columns: Column<EarningsEvent>[] = [
    {
      key: 'date',
      label: t('earn.reportDate'),
      align: 'end',
      value: (e) => e.date,
      render: (e) => (
        <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
          <span className="num">{fmt.date(e.date)}</span>
          <span className="row row-2">
            {e.timing !== 'unspecified' && (
              <Badge tone="outline">{t(`earn.${e.timing}` as 'earn.bmo')}</Badge>
            )}
            <Badge tone={e.dateConfirmed ? 'up' : 'gold'}>
              {e.dateConfirmed ? t('earn.confirmed') : t('earn.provisional')}
            </Badge>
          </span>
        </span>
      ),
      width: 150,
    },
    {
      key: 'symbol',
      label: t('g.company'),
      value: (e) => e.symbol,
      render: (e) => {
        const row = bySymbol.get(e.symbol);
        return row ? <SymbolCell row={row} showFlag /> : <span className="sym">{e.symbol}</span>;
      },
    },
    { key: 'period', label: t('earn.period'), value: (e) => e.period },
    {
      key: 'epsEstimate',
      label: t('earn.epsEstimate'),
      align: 'end',
      value: (e) => e.epsEstimate,
      render: (e) =>
        e.epsEstimate == null ? (
          <span className="unavailable" title={t('earn.noEstimate')}>
            {t('earn.noEstimate')}
          </span>
        ) : (
          <span className="num">{fmt.num(e.epsEstimate, { decimals: 3 })}</span>
        ),
    },
    {
      key: 'epsActual',
      label: t('earn.epsActual'),
      align: 'end',
      value: (e) => e.epsActual,
      render: (e) => {
        if (e.epsActual == null) return <span className="unavailable">{DASH}</span>;
        const beat = e.epsEstimate != null ? e.epsActual - e.epsEstimate : null;
        return (
          <span className="row row-2 row-end">
            <span className="num">{fmt.num(e.epsActual, { decimals: 3 })}</span>
            {beat != null && (
              <Badge tone={beat >= 0 ? 'up' : 'down'}>
                {fmt.num(beat, { decimals: 3, signed: true })}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: 'revActual',
      label: t('earn.revActual'),
      align: 'end',
      value: (e) => e.revenueActual,
      render: (e) => <V>{fmt.compact(e.revenueActual)}</V>,
      optional: true,
    },
    {
      key: 'revEstimate',
      label: t('earn.revEstimate'),
      align: 'end',
      value: (e) => e.revenueEstimate,
      render: (e) => <V>{fmt.compact(e.revenueEstimate)}</V>,
      optional: true,
      defaultHidden: true,
    },
    {
      key: 'netIncome',
      label: t('earn.netIncome'),
      align: 'end',
      value: (e) => e.netIncome,
      render: (e) => <V>{fmt.compact(e.netIncome)}</V>,
      optional: true,
    },
    {
      key: 'prior',
      label: t('earn.priorNetIncome'),
      align: 'end',
      value: (e) => e.priorPeriodNetIncome,
      render: (e) => <V>{fmt.compact(e.priorPeriodNetIncome)}</V>,
      optional: true,
    },
    {
      key: 'status',
      label: t('g.dataStatus'),
      align: 'end',
      value: (e) => e.provenance.status,
      render: (e) => <StatusBadge provenance={e.provenance} />,
      optional: true,
    },
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('earn.title')} sub={t('earn.sub')} />

      <Notice tone="info">{t('earn.noEstimateNote')}</Notice>

      <Card>
        <CardHead title={t('earn.title')} icon="calendar" />
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(e) => e.id}
          initialSort="date"
          initialDir="asc"
          onRowClick={(e) => navigate(`/app/stock/${e.symbol}`)}
          exportName="big-margin-earnings"
          loading={state.loading}
          pageSize={30}
          toolbar={
            <>
              <Seg
                value={view}
                onChange={setView}
                options={[
                  { value: 'today', label: t('g.today') },
                  { value: 'tomorrow', label: t('g.tomorrow') },
                  { value: 'week', label: t('g.thisWeek') },
                  { value: 'nextWeek', label: t('g.nextWeek') },
                  { value: 'all', label: t('g.all') },
                ]}
              />
              <Seg
                value={market}
                onChange={setMarket}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'SA', label: '🇸🇦' },
                  { value: 'US', label: '🇺🇸' },
                ]}
              />
            </>
          }
        />
      </Card>

      <Disclaimers />
    </div>
  );
}
