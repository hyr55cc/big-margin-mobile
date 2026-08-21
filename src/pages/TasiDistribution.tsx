import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, CardHead, Metric, Notice, Seg } from '@/components/ui';
import {
  BarChart,
  DonutChart,
  Treemap,
  magnitudeColor,
  seriesColor,
  useChartTheme,
  type TreeItem,
} from '@/components/charts';

type Mode = 'treemap' | 'bar' | 'donut';
type Scope = 'top10' | 'top20' | 'all' | 'sector';

export default function TasiDistribution() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { rowsFor, sectors } = useMarket();

  const [mode, setMode] = useState<Mode>('treemap');
  const [scope, setScope] = useState<Scope>('top20');

  const constituents = useMemo(
    () =>
      rowsFor('SA')
        .filter((r) => r.weightPct != null)
        .sort((a, b) => (b.weightPct as number) - (a.weightPct as number)),
    [rowsFor],
  );

  const maxWeight = constituents[0]?.weightPct ?? 1;

  const bySector = useMemo(() => {
    const map = new Map<string, { weight: number; count: number }>();
    for (const r of constituents) {
      const key = r.instrument.sectorId;
      const cur = map.get(key) ?? { weight: 0, count: 0 };
      cur.weight += r.weightPct as number;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: sectors.find((s) => s.id === id)?.name ?? { ar: id, en: id },
        ...v,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [constituents, sectors]);

  const scoped = useMemo(() => {
    if (scope === 'top10') return constituents.slice(0, 10);
    if (scope === 'top20') return constituents.slice(0, 20);
    return constituents;
  }, [constituents, scope]);

  const treeItems: TreeItem[] = useMemo(() => {
    if (scope === 'sector') {
      const total = bySector.reduce((s, x) => s + x.weight, 0) || 1;
      return bySector.map((s, i) => ({
        key: s.id,
        label: L(s.name),
        size: s.weight,
        color: seriesColor(theme, i),
        valueLabel: `${fmt.pct(s.weight, { decimals: 2 })} · ${s.count}`,
        group: undefined,
      }));
      void total;
    }
    return scoped.map((r) => ({
      key: r.symbol,
      label: r.symbol,
      size: r.weightPct as number,
      color: magnitudeColor((r.weightPct as number) / maxWeight),
      valueLabel: fmt.pct(r.weightPct, { decimals: 2 }),
    }));
  }, [scope, scoped, bySector, theme, fmt, L, maxWeight]);

  const top5 = constituents.slice(0, 5).reduce((s, r) => s + (r.weightPct as number), 0);
  const top10 = constituents.slice(0, 10).reduce((s, r) => s + (r.weightPct as number), 0);
  const top20 = constituents.slice(0, 20).reduce((s, r) => s + (r.weightPct as number), 0);

  return (
    <div className="stack stack-5">
      <PageHead title={t('dist.title')} sub={t('dist.sub')} status="delayed" />

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric label={t('dist.top5Share')} value={fmt.pct(top5)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('dist.top10Share')} value={fmt.pct(top10)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric label={`${t('dist.top20')}`} value={fmt.pct(top20)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('weight.constituents')}
            value={fmt.int(constituents.length)}
            size="xl"
            sub={`${bySector.length} ${t('nav.sectors')}`}
          />
        </Card>
      </div>

      <Card>
        <CardHead
          title={t('dist.title')}
          right={
            <>
              <Seg
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'top10', label: t('dist.top10') },
                  { value: 'top20', label: t('dist.top20') },
                  { value: 'all', label: t('dist.all') },
                  { value: 'sector', label: t('dist.bySector') },
                ]}
              />
              <Seg
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'treemap', label: t('dist.treemap') },
                  { value: 'bar', label: t('dist.bar') },
                  { value: 'donut', label: t('dist.donut') },
                ]}
              />
            </>
          }
        />
        <div className="card-body">
          {mode === 'treemap' && (
            <Treemap
              items={treeItems}
              height={scope === 'all' ? 560 : 420}
              onSelect={(key) =>
                scope === 'sector' ? navigate('/app/sectors') : navigate(`/app/stock/${key}`)
              }
            />
          )}

          {mode === 'bar' &&
            (scope === 'sector' ? (
              <BarChart
                items={bySector.map((s, i) => ({
                  key: s.id,
                  label: L(s.name),
                  value: s.weight,
                  color: seriesColor(theme, i),
                  sub: `${s.count}`,
                }))}
                formatValue={(v) => fmt.pct(v, { decimals: 2 })}
                onSelect={() => navigate('/app/sectors')}
              />
            ) : (
              <BarChart
                items={scoped.map((r) => ({
                  key: r.symbol,
                  label: `${r.symbol} · ${L(r.instrument.shortName)}`,
                  value: r.weightPct,
                }))}
                formatValue={(v) => fmt.pct(v, { decimals: 2 })}
                onSelect={(sym) => navigate(`/app/stock/${sym}`)}
              />
            ))}

          {mode === 'donut' && (
            <DonutChart
              size={260}
              items={
                scope === 'sector'
                  ? bySector.map((s) => ({ key: s.id, label: L(s.name), value: s.weight }))
                  : [
                      ...scoped.slice(0, 7).map((r) => ({
                        key: r.symbol,
                        label: `${r.symbol} ${L(r.instrument.shortName)}`,
                        value: r.weightPct as number,
                      })),
                      {
                        key: 'other',
                        label: t('g.total'),
                        value: constituents
                          .slice(7)
                          .reduce((s, r) => s + (r.weightPct as number), 0),
                      },
                    ]
              }
              formatValue={(v) => fmt.pct(v, { decimals: 2 })}
              onSelect={(key) => key !== 'other' && scope !== 'sector' && navigate(`/app/stock/${key}`)}
              center={
                <div className="stack" style={{ gap: 0 }}>
                  <span className="eyebrow">TASI</span>
                  <span className="metric-value">{fmt.pct(100, { decimals: 0 })}</span>
                </div>
              }
            />
          )}
        </div>
      </Card>

      <Notice tone="info">{t('weight.sub')}</Notice>

      <Disclaimers />
    </div>
  );
}
