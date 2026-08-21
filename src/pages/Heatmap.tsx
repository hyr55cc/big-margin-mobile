import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, CardHead, Notice, Seg, Select } from '@/components/ui';
import {
  Treemap,
  magnitudeColor,
  performanceColor,
  useChartTheme,
  type TreeItem,
} from '@/components/charts';
import type { MarketId } from '@/types';

type SizeBy = 'marketCap' | 'weight' | 'volume' | 'turnover';
type ColorBy = 'performance' | 'weight' | 'perf1m';

export default function Heatmap() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { rowsFor, sectors } = useMarket();

  const [market, setMarket] = useState<MarketId>('SA');
  const [sizeBy, setSizeBy] = useState<SizeBy>('marketCap');
  const [colorBy, setColorBy] = useState<ColorBy>('performance');
  const [groupBySector, setGroupBySector] = useState<'off' | 'on'>('off');
  const [sectorFilter, setSectorFilter] = useState('all');

  const rows = useMemo(
    () =>
      rowsFor(market).filter(
        (r) => sectorFilter === 'all' || r.instrument.sectorId === sectorFilter,
      ),
    [rowsFor, market, sectorFilter],
  );

  const sizeOf = (r: (typeof rows)[number]): number | null => {
    switch (sizeBy) {
      case 'marketCap':
        return r.marketCap;
      case 'weight':
        return r.weightPct;
      case 'volume':
        return r.volume;
      case 'turnover':
        return r.turnover;
    }
  };

  const maxWeight = Math.max(...rows.map((r) => r.weightPct ?? 0), 0.0001);

  const items: TreeItem[] = useMemo(
    () =>
      rows
        .filter((r) => (sizeOf(r) ?? 0) > 0)
        .map((r) => {
          const color =
            colorBy === 'performance'
              ? performanceColor(theme, r.changePct)
              : colorBy === 'perf1m'
                ? performanceColor(theme, r.perf1m, 9)
                : magnitudeColor((r.weightPct ?? 0) / maxWeight);
          const valueLabel =
            colorBy === 'weight'
              ? fmt.pct(r.weightPct, { decimals: 2 })
              : colorBy === 'perf1m'
                ? fmt.pct(r.perf1m, { signed: true })
                : fmt.pct(r.changePct, { signed: true });
          return {
            key: r.symbol,
            label: r.symbol,
            size: sizeOf(r) as number,
            color,
            valueLabel,
            group: r.instrument.sectorId,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sizeBy, colorBy, theme, maxWeight],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TreeItem[]>();
    for (const it of items) {
      const key = it.group ?? 'other';
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()]
      .map(([id, list]) => ({
        id,
        name: sectors.find((s) => s.id === id)?.name ?? { ar: id, en: id },
        list,
        total: list.reduce((s, x) => s + x.size, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [items, sectors]);

  const marketSectors = sectors.filter((s) => s.market === market);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('hm.title')}
        sub={t('hm.sub')}
        right={
          <Seg
            value={market}
            onChange={(m) => {
              setMarket(m);
              setSectorFilter('all');
            }}
            options={[
              { value: 'SA', label: '🇸🇦 ' + t('nav.saudi') },
              { value: 'US', label: '🇺🇸 ' + t('nav.us') },
            ]}
          />
        }
      />

      <Card>
        <CardHead
          title={t('hm.title')}
          right={
            <>
              <Select
                value={sizeBy}
                onChange={setSizeBy}
                options={[
                  { value: 'marketCap', label: `${t('hm.sizeBy')}: ${t('g.marketCap')}` },
                  { value: 'weight', label: `${t('hm.sizeBy')}: ${t('weight.weight')}` },
                  { value: 'volume', label: `${t('hm.sizeBy')}: ${t('g.volume')}` },
                  { value: 'turnover', label: `${t('hm.sizeBy')}: ${t('stock.turnover')}` },
                ]}
              />
              <Select
                value={colorBy}
                onChange={setColorBy}
                options={[
                  { value: 'performance', label: `${t('hm.colorBy')}: ${t('g.changePct')}` },
                  { value: 'perf1m', label: `${t('hm.colorBy')}: ${t('scr.f.perf')}` },
                  { value: 'weight', label: `${t('hm.colorBy')}: ${t('weight.weight')}` },
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
              <Seg
                value={groupBySector}
                onChange={setGroupBySector}
                options={[
                  { value: 'off', label: t('g.all') },
                  { value: 'on', label: t('hm.groupBySector') },
                ]}
              />
            </>
          }
        />
        <div className="card-body">
          {groupBySector === 'off' ? (
            <Treemap items={items} height={600} onSelect={(sym) => navigate(`/app/stock/${sym}`)} />
          ) : (
            <div className="stack stack-4">
              {grouped.map((g) => (
                <div key={g.id} className="stack stack-2">
                  <div className="row row-between">
                    <span className="h-card">{L(g.name)}</span>
                    <span className="t-xs muted-3 num">{g.list.length}</span>
                  </div>
                  <Treemap
                    items={g.list}
                    height={Math.max(110, Math.min(260, g.list.length * 26))}
                    onSelect={(sym) => navigate(`/app/stock/${sym}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Notice tone="info">
        {colorBy === 'weight'
          ? t('weight.sub')
          : /* Direction is red↔green by market convention, which is a colour-vision
               hazard; every cell therefore also prints its signed value. */
            t('disc.data')}
      </Notice>

      <Disclaimers />
    </div>
  );
}
