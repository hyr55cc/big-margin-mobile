import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Card,
  CardHead,
  DataTable,
  FormulaTip,
  Metric,
  Notice,
  Select,
  TextInput,
} from '@/components/ui';
import { useStockColumns, withRank } from '@/components/market/columns';
import { POINTS_PER_UNIT_FORMULA } from '@/lib/calc/indexImpact';

export default function TasiWeight() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rowsFor, sectors, indexInfo, loading } = useMarket();
  const cols = useStockColumns();

  const [q, setQ] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [shariahFilter, setShariahFilter] = useState<'all' | 'compliant' | 'non_compliant' | 'unknown'>('all');

  const info = indexInfo.get('TASI');
  const all = rowsFor('SA');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((r) => r.weightPct != null)
      .filter((r) => sectorFilter === 'all' || r.instrument.sectorId === sectorFilter)
      .filter((r) => shariahFilter === 'all' || r.shariahStatus === shariahFilter)
      .filter(
        (r) =>
          !needle ||
          r.symbol.toLowerCase().includes(needle) ||
          r.instrument.name.en.toLowerCase().includes(needle) ||
          r.instrument.name.ar.includes(q.trim()),
      )
      .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0));
  }, [all, q, sectorFilter, shariahFilter]);

  const totals = useMemo(() => {
    const sorted = [...all]
      .filter((r) => r.weightPct != null)
      .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0));
    const sum = (n: number) =>
      sorted.slice(0, n).reduce((s, r) => s + (r.weightPct as number), 0);
    return {
      count: sorted.length,
      top5: sum(5),
      top10: sum(10),
      top20: sum(20),
      covered: sorted.reduce((s, r) => s + (r.weightPct as number), 0),
    };
  }, [all]);

  const saudiSectors = sectors.filter((s) => s.market === 'SA');

  const tableColumns = [
    cols.symbol,
    cols.sector,
    cols.price,
    cols.changePct,
    cols.marketCap,
    cols.freeFloatCap,
    cols.weight,
    cols.pointsPerUnit,
    cols.todayPoints,
    cols.shariah,
    cols.volume,
    cols.turnover,
    cols.impactBand,
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('weight.title')} sub={t('weight.sub')} status="delayed" />

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric
            label={t('weight.constituents')}
            value={fmt.int(totals.count)}
            size="xl"
          />
        </Card>
        <Card className="card-pad">
          <Metric label={t('dist.top5Share')} value={fmt.pct(totals.top5)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('dist.top10Share')} value={fmt.pct(totals.top10)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('impact.divisor')}
            value={
              info?.divisor != null
                ? fmt.num(info.divisor, { decimals: 0 })
                : info?.derivedDivisor != null
                  ? fmt.num(info.derivedDivisor, { decimals: 0 })
                  : '—'
            }
            size="xl"
            status={info?.divisor != null ? 'delayed' : 'calculated'}
            tip={t('impact.divisorNote')}
          />
        </Card>
      </div>

      {info?.divisor == null && (
        <Notice tone="info">{t('impact.divisorNote')}</Notice>
      )}

      <Card>
        <CardHead
          title={t('weight.title')}
          sub={
            <span className="row row-2">
              {t('weight.pointsPerSar')}
              <FormulaTip
                text={t('impact.formulaBody')}
                formula={POINTS_PER_UNIT_FORMULA}
              />
            </span>
          }
        />
        <DataTable
          rows={rows}
          columns={withRank(tableColumns, rows)}
          rowKey={(r) => r.symbol}
          initialSort="weight"
          onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
          exportName="big-margin-tasi-weights"
          loading={loading}
          pageSize={30}
          toolbar={
            <>
              <div style={{ width: 210 }}>
                <TextInput value={q} onChange={setQ} placeholder={t('g.searchShort')} />
              </div>
              <Select
                value={sectorFilter}
                onChange={setSectorFilter}
                options={[
                  { value: 'all', label: t('g.sector') },
                  ...saudiSectors.map((s) => ({ value: s.id, label: L(s.name) })),
                ]}
              />
              <Select
                value={shariahFilter}
                onChange={setShariahFilter}
                options={[
                  { value: 'all', label: `${t('sh.status')}: ${t('g.all')}` },
                  { value: 'compliant', label: t('sh.compliant') },
                  { value: 'non_compliant', label: t('sh.nonCompliant') },
                  { value: 'unknown', label: t('sh.unknown') },
                ]}
              />
              <span className="t-sm muted-3">
                {fmt.int(rows.length)} {t('g.results')}
              </span>
            </>
          }
        />
      </Card>

      <Disclaimers shariah />
    </div>
  );
}
