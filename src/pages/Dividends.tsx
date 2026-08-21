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
  Check,
  DataTable,
  Field,
  Metric,
  Notice,
  NumInput,
  Seg,
  Select,
  ShariahBadge,
  StatusBadge,
  V,
  type Column,
} from '@/components/ui';
import { SymbolCell } from '@/components/market/cells';
import { dividendIncome, PERIODS_PER_YEAR } from '@/lib/calc/income';
import { DASH } from '@/lib/format';
import type { Dividend, MarketId } from '@/types';

interface DividendRow extends Dividend {
  price: number | null;
  yieldPct: number | null;
  shariah: 'compliant' | 'non_compliant' | 'unknown';
  sectorId: string | null;
}

function DividendCalculator() {
  const { t } = useI18n();
  const fmt = useFmt();
  const [shares, setShares] = useState<number | null>(1000);
  const [dps, setDps] = useState<number | null>(1.5);
  const [price, setPrice] = useState<number | null>(30);
  const [frequency, setFrequency] = useState<keyof typeof PERIODS_PER_YEAR>('quarterly');

  const result = dividendIncome({
    shares: shares ?? 0,
    dps: dps ?? 0,
    sharePrice: price,
    frequency,
  });

  return (
    <Card>
      <CardHead title={t('div.calculator')} icon="calculator" />
      <div className="card-body stack stack-4">
        <div className="grid grid-4">
          <Field label={t('g.shares')}>
            <NumInput value={shares} onChange={setShares} min={0} />
          </Field>
          <Field label={t('div.dps')}>
            <NumInput value={dps} onChange={setDps} step={0.05} />
          </Field>
          <Field label={t('g.price')}>
            <NumInput value={price} onChange={setPrice} step={0.05} />
          </Field>
          <Field label={t('div.frequency')}>
            <Select
              value={frequency}
              onChange={setFrequency}
              options={(
                ['annual', 'semi_annual', 'quarterly', 'monthly'] as const
              ).map((f) => ({ value: f, label: t(`freq.${f}` as 'freq.annual') }))}
            />
          </Field>
        </div>

        <div className="metric-grid">
          <Metric
            label={t('div.income')}
            value={<V>{fmt.num(result.value.incomePerPeriod)}</V>}
            size="xl"
            status="calculated"
          />
          <Metric label={t('div.annualIncome')} value={<V>{fmt.num(result.value.annualIncome)}</V>} />
          <Metric
            label={t('div.monthlyEquivalent')}
            value={<V>{fmt.num(result.value.monthlyEquivalent)}</V>}
          />
          <Metric label={t('div.yield')} value={<V>{fmt.pct(result.value.yieldPct)}</V>} />
        </div>

        <code className="formula t-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-3)' }}>
          {result.formula}
        </code>
      </div>
    </Card>
  );
}

export default function Dividends() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { bySymbol, sectors } = useMarket();

  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [compliantOnly, setCompliantOnly] = useState(false);
  const [announcedOnly, setAnnouncedOnly] = useState(true);

  const state = useAsync(() => getProvider().listDividends({}), []);

  const rows: DividendRow[] = useMemo(() => {
    const list = state.data ?? [];
    return list
      .map((d) => {
        const row = bySymbol.get(d.symbol);
        const price = row?.price ?? null;
        const periods = PERIODS_PER_YEAR[d.frequency];
        const yieldPct =
          d.amountPerShare != null && price != null && price > 0 && periods != null
            ? ((d.amountPerShare * periods) / price) * 100
            : null;
        return {
          ...d,
          price,
          yieldPct,
          shariah: row?.shariahStatus ?? 'unknown',
          sectorId: row?.instrument.sectorId ?? null,
        };
      })
      .filter((d) => market === 'all' || d.market === market)
      .filter((d) => sectorFilter === 'all' || d.sectorId === sectorFilter)
      .filter((d) => !compliantOnly || d.shariah === 'compliant')
      .filter((d) => !announcedOnly || d.announced)
      .sort((a, b) => ((a.exDate ?? '') < (b.exDate ?? '') ? 1 : -1));
  }, [state.data, bySymbol, market, sectorFilter, compliantOnly, announcedOnly]);

  const stats = useMemo(() => {
    const withYield = rows.filter((r) => r.yieldPct != null);
    const today = new Date().toISOString().slice(0, 10);
    return {
      count: rows.length,
      avgYield: withYield.length
        ? withYield.reduce((s, r) => s + (r.yieldPct as number), 0) / withYield.length
        : null,
      upcoming: rows.filter((r) => (r.exDate ?? '') >= today).length,
      announced: rows.filter((r) => r.announced).length,
    };
  }, [rows]);

  const columns: Column<DividendRow>[] = [
    {
      key: 'symbol',
      label: t('g.company'),
      value: (d) => d.symbol,
      render: (d) => {
        const row = bySymbol.get(d.symbol);
        return row ? (
          <SymbolCell row={row} showFlag />
        ) : (
          <span className="sym">{d.symbol}</span>
        );
      },
    },
    {
      key: 'dps',
      label: t('div.dps'),
      align: 'end',
      value: (d) => d.amountPerShare,
      render: (d) => (
        <V>{d.amountPerShare == null ? DASH : fmt.money(d.amountPerShare, d.currency, { decimals: 3 })}</V>
      ),
    },
    {
      key: 'yield',
      label: t('div.yield'),
      align: 'end',
      value: (d) => d.yieldPct,
      render: (d) => <V>{d.yieldPct == null ? DASH : fmt.pct(d.yieldPct)}</V>,
    },
    {
      key: 'frequency',
      label: t('div.frequency'),
      value: (d) => d.frequency,
      render: (d) => <Badge tone="outline">{t(`freq.${d.frequency}` as 'freq.annual')}</Badge>,
    },
    {
      key: 'exDate',
      label: t('div.exDate'),
      align: 'end',
      value: (d) => d.exDate,
      render: (d) => <V>{fmt.date(d.exDate)}</V>,
    },
    {
      key: 'payDate',
      label: t('div.payDate'),
      align: 'end',
      value: (d) => d.payDate,
      render: (d) => <V>{fmt.date(d.payDate)}</V>,
    },
    {
      key: 'recordDate',
      label: t('div.recordDate'),
      align: 'end',
      value: (d) => d.recordDate,
      render: (d) => <V>{fmt.date(d.recordDate)}</V>,
      optional: true,
      defaultHidden: true,
    },
    {
      key: 'declaredDate',
      label: t('div.declaredDate'),
      align: 'end',
      value: (d) => d.declaredDate,
      render: (d) => <V>{fmt.date(d.declaredDate)}</V>,
      optional: true,
      defaultHidden: true,
    },
    {
      key: 'announced',
      label: t('g.status'),
      value: (d) => (d.announced ? 'announced' : 'projected'),
      render: (d) => (
        <span className="row row-2">
          <Badge tone={d.announced ? 'up' : 'gold'}>
            {d.announced ? t('div.announced') : t('div.projected')}
          </Badge>
          <StatusBadge provenance={d.provenance} compact />
        </span>
      ),
    },
    {
      key: 'shariah',
      label: t('sh.status'),
      value: (d) => d.shariah,
      render: (d) => <ShariahBadge status={d.shariah} />,
    },
  ];

  const marketSectors = sectors.filter((s) => market === 'all' || s.market === market);

  return (
    <div className="stack stack-5">
      <PageHead title={t('div.title')} sub={t('div.sub')} />

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric label={t('g.total')} value={fmt.int(stats.count)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('div.yield')} value={<V>{fmt.pct(stats.avgYield)}</V>} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('g.upcoming')} value={fmt.int(stats.upcoming)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('div.announced')} value={fmt.int(stats.announced)} size="xl" />
        </Card>
      </div>

      <Notice tone="info">{t('div.projectedNote')}</Notice>

      <Card>
        <CardHead title={t('div.title')} icon="coins" />
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          initialSort="exDate"
          onRowClick={(d) => navigate(`/app/stock/${d.symbol}`)}
          exportName="big-margin-dividends"
          loading={state.loading}
          pageSize={30}
          toolbar={
            <>
              <Seg
                value={market}
                onChange={setMarket}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'SA', label: '🇸🇦' },
                  { value: 'US', label: '🇺🇸' },
                ]}
              />
              <Select
                value={sectorFilter}
                onChange={setSectorFilter}
                options={[
                  { value: 'all', label: t('g.sector') },
                  ...marketSectors.map((s) => ({ value: s.id, label: L(s.name) })),
                ]}
              />
              <Check checked={compliantOnly} onChange={setCompliantOnly}>
                <span className="t-sm">{t('sh.compliant')}</span>
              </Check>
              <Check checked={announcedOnly} onChange={setAnnouncedOnly}>
                <span className="t-sm">{t('div.announced')}</span>
              </Check>
            </>
          }
        />
      </Card>

      <DividendCalculator />

      <Disclaimers shariah />
    </div>
  );
}
