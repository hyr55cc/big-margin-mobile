import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  BandBadge,
  Btn,
  Card,
  CardHead,
  Empty,
  IconBtn,
  Notice,
  Seg,
  ShariahBadge,
  V,
} from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { BarChart, LineChart, seriesColor, useChartTheme } from '@/components/charts';
import { DASH } from '@/lib/format';
import type { Timeframe } from '@/types';

const MAX = 5;
const TIMEFRAMES: Timeframe[] = ['1M', '3M', '6M', '1Y', '5Y'];

interface MetricRow {
  key: string;
  label: string;
  render: (r: MarketRow) => React.ReactNode;
  bar?: (r: MarketRow) => number | null;
}

export default function Compare() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { bySymbol } = useMarket();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [tf, setTf] = useState<Timeframe>('1Y');

  const rows = symbols
    .map((s) => bySymbol.get(s))
    .filter((r): r is MarketRow => r != null);

  const series = useAsync(async () => {
    const p = getProvider();
    const all = await Promise.all(
      symbols.map(async (s) => ({ symbol: s, series: await p.getSeries(s, tf) })),
    );
    return all;
  }, [symbols.join(','), tf]);

  /** Indexed to 100 at the start so instruments of different price levels
      share one axis — never a second y-axis. */
  const normalised = useMemo(() => {
    if (!series.data) return [];
    return series.data
      .filter((x) => x.series && x.series.candles.length > 1)
      .map((x, i) => {
        const candles = x.series!.candles;
        const base = candles[0].c;
        const row = bySymbol.get(x.symbol);
        return {
          key: x.symbol,
          name: `${x.symbol} ${row ? L(row.instrument.shortName) : ''}`,
          color: seriesColor(theme, i),
          points: candles.map((c) => ({ t: c.t, v: (c.c / base) * 100 })),
        };
      });
  }, [series.data, bySymbol, L, theme]);

  const metrics: MetricRow[] = [
    { key: 'price', label: t('g.price'), render: (r) => <V>{fmt.num(r.price)}</V> },
    {
      key: 'change',
      label: t('g.changePct'),
      render: (r) => (
        <Badge tone={(r.changePct ?? 0) >= 0 ? 'up' : 'down'}>
          {r.changePct == null ? DASH : fmt.pct(r.changePct, { signed: true })}
        </Badge>
      ),
      bar: (r) => r.changePct,
    },
    {
      key: 'perf1m',
      label: `${t('stock.performance')} 1M`,
      render: (r) => (
        <span className={`num ${(r.perf1m ?? 0) >= 0 ? 'up' : 'down'}`}>
          <V>{r.perf1m == null ? DASH : fmt.pct(r.perf1m, { signed: true })}</V>
        </span>
      ),
      bar: (r) => r.perf1m,
    },
    {
      key: 'perf1y',
      label: `${t('stock.performance')} 1Y`,
      render: (r) => (
        <span className={`num ${(r.perf1y ?? 0) >= 0 ? 'up' : 'down'}`}>
          <V>{r.perf1y == null ? DASH : fmt.pct(r.perf1y, { signed: true })}</V>
        </span>
      ),
    },
    { key: 'cap', label: t('g.marketCap'), render: (r) => <V>{fmt.compact(r.marketCap)}</V>, bar: (r) => r.marketCap },
    {
      key: 'weight',
      label: t('weight.weight'),
      render: (r) => <V>{r.weightPct == null ? DASH : fmt.pct(r.weightPct, { decimals: 3 })}</V>,
      bar: (r) => r.weightPct,
    },
    {
      key: 'points',
      label: t('weight.pointsPerSar'),
      render: (r) => (
        <V>{r.pointsPerUnit == null ? DASH : fmt.num(r.pointsPerUnit, { decimals: 4 })}</V>
      ),
    },
    { key: 'impact', label: t('stock.impact'), render: (r) => <BandBadge band={r.impactBand} /> },
    { key: 'volume', label: t('g.volume'), render: (r) => <V>{fmt.compact(r.volume)}</V>, bar: (r) => r.volume },
    {
      key: 'turnover',
      label: t('stock.turnover'),
      render: (r) => <V>{fmt.compact(r.turnover)}</V>,
    },
    {
      key: 'liquidity',
      label: t('stock.liquidity'),
      render: (r) => <BandBadge band={r.liquidityBand} />,
    },
    {
      key: 'yield',
      label: t('div.yield'),
      render: (r) => <V>{r.dividendYieldPct == null ? DASH : fmt.pct(r.dividendYieldPct)}</V>,
      bar: (r) => r.dividendYieldPct,
    },
    { key: 'pe', label: t('stock.pe'), render: (r) => <V>{fmt.num(r.peRatio)}</V> },
    {
      key: 'eps',
      label: t('stock.eps'),
      render: (r) => <V>{fmt.num(r.fundamentals?.eps ?? null, { decimals: 2 })}</V>,
    },
    { key: 'beta', label: t('stock.beta'), render: (r) => <V>{fmt.num(r.beta)}</V> },
    {
      key: 'shariah',
      label: t('sh.status'),
      render: (r) => <ShariahBadge status={r.shariahStatus} />,
    },
    {
      key: 'sector',
      label: t('g.sector'),
      render: (r) => <span className="t-sm">{r.sector ? L(r.sector.name) : DASH}</span>,
    },
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('cmp.title')} sub={t('cmp.sub')} />

      <Card>
        <CardHead
          title={t('cmp.addStock')}
          icon="compare"
          right={
            <>
              <Badge tone={symbols.length >= MAX ? 'gold' : 'neutral'}>
                {symbols.length} / {MAX}
              </Badge>
              {symbols.length > 0 && (
                <Btn size="sm" icon="refresh" onClick={() => setSymbols([])}>
                  {t('g.reset')}
                </Btn>
              )}
            </>
          }
        />
        <div className="card-body stack stack-3">
          {symbols.length < MAX ? (
            <InstrumentPicker
              onPick={(r) => setSymbols((prev) => [...new Set([...prev, r.symbol])].slice(0, MAX))}
              exclude={symbols}
              placeholder={t('cmp.addStock')}
            />
          ) : (
            <Notice tone="info">{t('cmp.max')}</Notice>
          )}

          {rows.length > 0 && (
            <div className="pill-list">
              {rows.map((r, i) => (
                <span
                  key={r.symbol}
                  className="badge badge-outline"
                  style={{ borderColor: seriesColor(theme, i), gap: 8 }}
                >
                  <i
                    className="sw"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 3,
                      background: seriesColor(theme, i),
                      display: 'inline-block',
                    }}
                  />
                  {r.symbol} · {L(r.instrument.shortName)}
                  <IconBtn
                    icon="close"
                    title={t('g.remove')}
                    onClick={() => setSymbols((prev) => prev.filter((s) => s !== r.symbol))}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Empty icon="compare" title={t('cmp.addStock')} desc={t('cmp.sub')} />
      ) : (
        <>
          <Card>
            <CardHead
              title={t('stock.performance')}
              sub="= 100"
              right={
                <Seg
                  value={tf}
                  onChange={setTf}
                  options={TIMEFRAMES.map((x) => ({ value: x, label: x }))}
                />
              }
            />
            <div className="card-body">
              {normalised.length > 0 ? (
                <LineChart
                  series={normalised}
                  height={300}
                  area={false}
                  baseline={{ value: 100 }}
                  formatValue={(v) => fmt.num(v, { decimals: 0 })}
                  formatLabel={(x) => fmt.date(x)}
                />
              ) : (
                <Empty title={t('g.loading')} />
              )}
            </div>
          </Card>

          <Card>
            <CardHead title={t('cmp.metric')} />
            <div className="table-wrap">
              <table className="dt">
                <thead>
                  <tr>
                    <th>{t('cmp.metric')}</th>
                    {rows.map((r, i) => (
                      <th key={r.symbol} className="num-col">
                        <span
                          className="row row-2 row-end clickable"
                          onClick={() => navigate(`/app/stock/${r.symbol}`)}
                        >
                          <i
                            className="sw"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 3,
                              background: seriesColor(theme, i),
                              display: 'inline-block',
                            }}
                          />
                          {r.symbol}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.key}>
                      <td className="muted">{m.label}</td>
                      {rows.map((r) => (
                        <td key={r.symbol} className="num-col">
                          {m.render(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-2">
            {metrics
              .filter((m) => m.bar)
              .slice(0, 4)
              .map((m) => (
                <Card key={m.key}>
                  <CardHead title={m.label} />
                  <div className="card-body">
                    <BarChart
                      signed={m.key === 'change' || m.key === 'perf1m'}
                      items={rows.map((r, i) => ({
                        key: r.symbol,
                        label: r.symbol,
                        value: m.bar!(r),
                        color:
                          m.key === 'change' || m.key === 'perf1m'
                            ? undefined
                            : seriesColor(theme, i),
                      }))}
                      formatValue={(v) =>
                        m.key === 'cap' || m.key === 'volume'
                          ? fmt.compact(v)
                          : fmt.pct(v, { signed: m.key !== 'yield' && m.key !== 'weight' })
                      }
                      onSelect={(sym) => navigate(`/app/stock/${sym}`)}
                    />
                  </div>
                </Card>
              ))}
          </div>
        </>
      )}

      <Disclaimers shariah />
    </div>
  );
}
