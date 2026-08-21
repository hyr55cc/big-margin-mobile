import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useDebounced, useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Check,
  DataTable,
  Field,
  NumInput,
  Seg,
  Select,
  TextInput,
} from '@/components/ui';
import { useStockColumns, withRank } from '@/components/market/columns';
import type { MarketId, ShariahStatus } from '@/types';
import type { MessageKey } from '@/i18n';

interface Range {
  min: number | null;
  max: number | null;
}

const EMPTY: Range = { min: null, max: null };

interface Filters {
  market: MarketId | 'all';
  shariah: ShariahStatus | 'all';
  sectorIds: string[];
  query: string;
  marketCap: Range;
  price: Range;
  volume: Range;
  avgVolume: Range;
  turnover: Range;
  dividendYield: Range;
  weight: Range;
  pointsPerUnit: Range;
  perf1m: Range;
  perf1y: Range;
  pe: Range;
  beta: Range;
  range52: Range;
  volatility: Range;
}

const DEFAULT_FILTERS: Filters = {
  market: 'all',
  shariah: 'all',
  sectorIds: [],
  query: '',
  marketCap: EMPTY,
  price: EMPTY,
  volume: EMPTY,
  avgVolume: EMPTY,
  turnover: EMPTY,
  dividendYield: EMPTY,
  weight: EMPTY,
  pointsPerUnit: EMPTY,
  perf1m: EMPTY,
  perf1y: EMPTY,
  pe: EMPTY,
  beta: EMPTY,
  range52: EMPTY,
  volatility: EMPTY,
};

interface Preset {
  id: string;
  label: MessageKey;
  desc: MessageKey;
  apply: (f: Filters) => Filters;
  sort: string;
}

const PRESETS: Preset[] = [
  {
    id: 'topImpact',
    label: 'scr.preset.topImpact',
    desc: 'scr.preset.topImpactDesc',
    apply: (f) => ({ ...f, market: 'SA', weight: { min: 1, max: null } }),
    sort: 'weight',
  },
  {
    id: 'shariahLeaders',
    label: 'scr.preset.shariahLeaders',
    desc: 'scr.preset.shariahLeadersDesc',
    apply: (f) => ({ ...f, shariah: 'compliant', marketCap: { min: 5e9, max: null } }),
    sort: 'marketCap',
  },
  {
    id: 'highDividend',
    label: 'scr.preset.highDividend',
    desc: 'scr.preset.highDividendDesc',
    apply: (f) => ({ ...f, dividendYield: { min: 4, max: null } }),
    sort: 'dividendYield',
  },
  {
    id: 'highLiquidity',
    label: 'scr.preset.highLiquidity',
    desc: 'scr.preset.highLiquidityDesc',
    apply: (f) => ({ ...f, turnover: { min: 5e7, max: null } }),
    sort: 'turnover',
  },
  {
    id: 'marketLeaders',
    label: 'scr.preset.marketLeaders',
    desc: 'scr.preset.marketLeadersDesc',
    apply: (f) => ({ ...f, marketCap: { min: 2e10, max: null } }),
    sort: 'marketCap',
  },
  {
    id: 'shariahImpact',
    label: 'scr.preset.shariahImpact',
    desc: 'scr.preset.shariahImpactDesc',
    apply: (f) => ({
      ...f,
      market: 'SA',
      shariah: 'compliant',
      weight: { min: 0.8, max: null },
    }),
    sort: 'weight',
  },
  {
    id: 'shariahDividend',
    label: 'scr.preset.shariahDividend',
    desc: 'scr.preset.shariahDividendDesc',
    apply: (f) => ({ ...f, shariah: 'compliant', dividendYield: { min: 3, max: null } }),
    sort: 'dividendYield',
  },
  {
    id: 'largeCapShariah',
    label: 'scr.preset.largeCapShariah',
    desc: 'scr.preset.largeCapShariahDesc',
    apply: (f) => ({ ...f, shariah: 'compliant', marketCap: { min: 3e10, max: null } }),
    sort: 'marketCap',
  },
];

function inRange(v: number | null, r: Range): boolean {
  if (r.min == null && r.max == null) return true;
  if (v == null) return false;
  if (r.min != null && v < r.min) return false;
  if (r.max != null && v > r.max) return false;
  return true;
}

function RangeField({
  label,
  value,
  onChange,
  suffix,
  step,
}: {
  label: string;
  value: Range;
  onChange: (r: Range) => void;
  suffix?: string;
  step?: number;
}) {
  const { t } = useI18n();
  return (
    <Field label={label}>
      <div className="row row-2">
        <NumInput
          value={value.min}
          onChange={(v) => onChange({ ...value, min: v })}
          placeholder={t('scr.min')}
          step={step}
        />
        <NumInput
          value={value.max}
          onChange={(v) => onChange({ ...value, max: v })}
          placeholder={t('scr.max')}
          step={step}
          suffix={suffix}
        />
      </div>
    </Field>
  );
}

export default function Screener() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rows, sectors, loading } = useMarket();
  const cols = useStockColumns();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState('marketCap');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const debouncedQuery = useDebounced(filters.query, 200);

  const set = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((f) => ({ ...f, [key]: value }));
      setActivePreset(null);
    },
    [],
  );

  const results = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return rows.filter((r: MarketRow) => {
      if (filters.market !== 'all' && r.market !== filters.market) return false;
      if (filters.shariah !== 'all' && r.shariahStatus !== filters.shariah) return false;
      if (filters.sectorIds.length && !filters.sectorIds.includes(r.instrument.sectorId))
        return false;
      if (
        needle &&
        !(
          r.symbol.toLowerCase().includes(needle) ||
          r.instrument.name.en.toLowerCase().includes(needle) ||
          r.instrument.name.ar.includes(debouncedQuery.trim())
        )
      )
        return false;
      return (
        inRange(r.marketCap, filters.marketCap) &&
        inRange(r.price, filters.price) &&
        inRange(r.volume, filters.volume) &&
        inRange(r.quote?.avgVolume30d ?? null, filters.avgVolume) &&
        inRange(r.turnover, filters.turnover) &&
        inRange(r.dividendYieldPct, filters.dividendYield) &&
        inRange(r.weightPct, filters.weight) &&
        inRange(r.pointsPerUnit, filters.pointsPerUnit) &&
        inRange(r.perf1m, filters.perf1m) &&
        inRange(r.perf1y, filters.perf1y) &&
        inRange(r.peRatio, filters.pe) &&
        inRange(r.beta, filters.beta) &&
        inRange(r.range52Pct, filters.range52) &&
        inRange(r.volatilityPct, filters.volatility)
      );
    });
  }, [rows, filters, debouncedQuery]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.market !== 'all') n++;
    if (filters.shariah !== 'all') n++;
    if (filters.sectorIds.length) n++;
    if (filters.query.trim()) n++;
    (
      [
        'marketCap', 'price', 'volume', 'avgVolume', 'turnover', 'dividendYield',
        'weight', 'pointsPerUnit', 'perf1m', 'perf1y', 'pe', 'beta', 'range52', 'volatility',
      ] as const
    ).forEach((k) => {
      const r = filters[k];
      if (r.min != null || r.max != null) n++;
    });
    return n;
  }, [filters]);

  const applyPreset = (p: Preset) => {
    setFilters(p.apply({ ...DEFAULT_FILTERS }));
    setSort(p.sort);
    setActivePreset(p.id);
  };

  const sectorOptions = sectors.filter(
    (s) => filters.market === 'all' || s.market === filters.market,
  );

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('scr.title')}
        sub={t('scr.sub')}
        right={
          <>
            <Btn icon="refresh" onClick={() => { setFilters(DEFAULT_FILTERS); setActivePreset(null); }}>
              {t('g.reset')}
            </Btn>
            <Badge tone="brand">
              {fmt.int(results.length)} {t('scr.matches')}
            </Badge>
          </>
        }
      />

      <Card>
        <CardHead title={t('scr.presets')} icon="star" />
        <div className="card-body">
          <div className="grid grid-4">
            {PRESETS.map((p) => (
              <Card
                key={p.id}
                className="card-pad"
                onClick={() => applyPreset(p)}
                style={
                  activePreset === p.id
                    ? { borderColor: 'var(--bm-brand)', background: 'var(--bm-brand-soft)' }
                    : undefined
                }
              >
                <div className="stack" style={{ gap: 3 }}>
                  <span className="h-card">{t(p.label)}</span>
                  <span className="t-xs muted-3">{t(p.desc)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title={t('g.filters')}
          icon="filter"
          right={activeCount > 0 && <Badge tone="brand">{activeCount}</Badge>}
        />
        <div className="card-body stack stack-5">
          <div className="row row-4 row-wrap">
            <Field label={t('g.market')}>
              <Seg
                value={filters.market}
                onChange={(v) => set('market', v)}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'SA', label: '🇸🇦' },
                  { value: 'US', label: '🇺🇸' },
                ]}
              />
            </Field>
            <Field label={t('sh.status')}>
              <Seg
                value={filters.shariah}
                onChange={(v) => set('shariah', v)}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'compliant', label: t('sh.compliant') },
                  { value: 'non_compliant', label: t('sh.nonCompliant') },
                  { value: 'unknown', label: t('sh.unknown') },
                ]}
              />
            </Field>
            <Field label={t('g.searchShort')}>
              <div style={{ width: 220 }}>
                <TextInput
                  value={filters.query}
                  onChange={(v) => set('query', v)}
                  placeholder={t('g.search')}
                />
              </div>
            </Field>
          </div>

          <Field label={t('g.sector')}>
            <div className="pill-list">
              {sectorOptions.map((s) => (
                <Check
                  key={s.id}
                  checked={filters.sectorIds.includes(s.id)}
                  onChange={(on) =>
                    set(
                      'sectorIds',
                      on
                        ? [...filters.sectorIds, s.id]
                        : filters.sectorIds.filter((x) => x !== s.id),
                    )
                  }
                >
                  <span className="t-sm">{L(s.name)}</span>
                </Check>
              ))}
            </div>
          </Field>

          <div className="grid grid-4">
            <RangeField
              label={t('g.marketCap')}
              value={filters.marketCap}
              onChange={(r) => set('marketCap', r)}
              step={1e9}
            />
            <RangeField label={t('g.price')} value={filters.price} onChange={(r) => set('price', r)} />
            <RangeField
              label={t('g.volume')}
              value={filters.volume}
              onChange={(r) => set('volume', r)}
              step={1e5}
            />
            <RangeField
              label={t('g.avgVolume')}
              value={filters.avgVolume}
              onChange={(r) => set('avgVolume', r)}
              step={1e5}
            />
            <RangeField
              label={t('scr.f.liquidity')}
              value={filters.turnover}
              onChange={(r) => set('turnover', r)}
              step={1e6}
            />
            <RangeField
              label={t('div.yield')}
              value={filters.dividendYield}
              onChange={(r) => set('dividendYield', r)}
              suffix="%"
              step={0.5}
            />
            <RangeField
              label={t('weight.weight')}
              value={filters.weight}
              onChange={(r) => set('weight', r)}
              suffix="%"
              step={0.1}
            />
            <RangeField
              label={t('weight.pointsPerSar')}
              value={filters.pointsPerUnit}
              onChange={(r) => set('pointsPerUnit', r)}
              step={0.01}
            />
            <RangeField
              label={t('scr.f.perf')}
              value={filters.perf1m}
              onChange={(r) => set('perf1m', r)}
              suffix="%"
              step={1}
            />
            <RangeField
              label={`${t('stock.performance')} 1Y`}
              value={filters.perf1y}
              onChange={(r) => set('perf1y', r)}
              suffix="%"
              step={1}
            />
            <RangeField label={t('stock.pe')} value={filters.pe} onChange={(r) => set('pe', r)} />
            <RangeField
              label={t('stock.beta')}
              value={filters.beta}
              onChange={(r) => set('beta', r)}
              step={0.1}
            />
            <RangeField
              label={t('scr.f.range52')}
              value={filters.range52}
              onChange={(r) => set('range52', r)}
              suffix="%"
              step={5}
            />
            <RangeField
              label={t('rank.volatile')}
              value={filters.volatility}
              onChange={(r) => set('volatility', r)}
              suffix="%"
              step={2}
            />
          </div>

          <div className="row row-3">
            <Btn variant="primary" size="lg" icon="filter" onClick={() => undefined}>
              {t('scr.find')}
            </Btn>
            <span className="t-sm muted-3">
              {fmt.int(results.length)} {t('scr.matches')}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <DataTable
          rows={results}
          columns={withRank(
            [
              cols.symbol,
              cols.price,
              cols.changePct,
              cols.marketCap,
              cols.weight,
              cols.pointsPerUnit,
              cols.dividendYield,
              cols.shariah,
              cols.pe,
              cols.perf1m,
              cols.turnover,
              cols.beta,
              cols.range52,
              cols.impactBand,
              cols.liquidity,
            ],
            results,
          )}
          rowKey={(r) => r.symbol}
          initialSort={sort}
          onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
          exportName="big-margin-screener"
          loading={loading}
          pageSize={30}
          toolbar={
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: 'marketCap', label: t('g.marketCap') },
                { value: 'weight', label: t('weight.weight') },
                { value: 'dividendYield', label: t('div.yield') },
                { value: 'changePct', label: t('g.changePct') },
                { value: 'turnover', label: t('stock.turnover') },
              ]}
            />
          }
        />
      </Card>

      <Disclaimers shariah />
    </div>
  );
}
