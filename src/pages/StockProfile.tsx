import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket, PRIMARY_INDEX } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { usePortfolioSummary } from '@/lib/portfolioMath';
import { useWatchlists, toggleWatch } from '@/store/watchlist';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  BandBadge,
  Btn,
  Card,
  CardHead,
  Empty,
  FormulaTip,
  Metric,
  Notice,
  Seg,
  ShariahBadge,
  Skeleton,
  StatusBadge,
  Tabs,
  V,
} from '@/components/ui';
import { ShariahPanel } from '@/components/market/ShariahPanel';
const OptionsPanel = lazy(() =>
  import('@/components/options/OptionsPanel').then((m) => ({ default: m.OptionsPanel })),
);
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { AlertModal } from '@/components/portfolio/AlertModal';
import { LineChart, RangeMeter, seriesColor, useChartTheme } from '@/components/charts';
import { CONTRIBUTION_FORMULA, POINTS_PER_UNIT_FORMULA } from '@/lib/calc/indexImpact';
import { DASH } from '@/lib/format';
import type { Timeframe } from '@/types';

type Tab =
  | 'overview'
  | 'tasi'
  | 'shariah'
  | 'financials'
  | 'dividends'
  | 'chart'
  | 'impact'
  | 'actions'
  | 'earnings'
  | 'news'
  | 'options'
  | 'stats';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'];

export default function StockProfile() {
  const { symbol = '' } = useParams();
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { bySymbol, indexInfo, loading, methodologyId } = useMarket();
  const pf = usePortfolioSummary();
  const lists = useWatchlists((s) => s.lists);
  const activeList = useWatchlists((s) => s.activeId);

  const [tab, setTab] = useState<Tab>('overview');
  const [tf, setTf] = useState<Timeframe>('1M');
  const [showTx, setShowTx] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [compareIndex, setCompareIndex] = useState(true);

  const row = bySymbol.get(symbol) ?? null;
  const indexId = row ? PRIMARY_INDEX[row.market] : 'TASI';
  const info = indexInfo.get(indexId);

  const series = useAsync(
    async () => {
      if (!row) return null;
      const p = getProvider();
      const [stock, index] = await Promise.all([
        p.getSeries(symbol, tf),
        p.getIndexSeries(indexId, tf),
      ]);
      return { stock, index };
    },
    [symbol, tf, indexId, row != null],
  );

  const events = useAsync(
    async () => {
      if (!row) return null;
      const p = getProvider();
      const [dividends, actions, earnings, news] = await Promise.all([
        p.listDividends({ symbol }),
        p.listCorporateActions({ symbol }),
        p.listEarnings({ symbol }),
        p.listNews({ symbol }),
      ]);
      return { dividends, actions, earnings, news };
    },
    [symbol, row != null],
  );

  const position = pf.positions.find((p) => p.symbol === symbol) ?? null;
  const watched = lists.some((l) => l.entries.some((e) => e.symbol === symbol));

  const chartSeries = useMemo(() => {
    if (!series.data?.stock) return [];
    const stock = series.data.stock.candles;
    if (stock.length < 2) return [];
    const base = stock[0].c;
    const out = [
      {
        key: symbol,
        name: symbol,
        points: stock.map((c) => ({ t: c.t, v: c.c })),
        color: theme.brand,
      },
    ];
    if (compareIndex && series.data.index && series.data.index.candles.length > 1) {
      // Index rebased onto the stock's own scale so both share one y-axis.
      const idx = series.data.index.candles;
      const idxBase = idx[0].c;
      out.push({
        key: indexId,
        name: `${indexId} (${t('stock.vsIndex')})`,
        points: idx
          .slice(Math.max(0, idx.length - stock.length))
          .map((c, i) => ({ t: stock[i]?.t ?? c.t, v: (c.c / idxBase) * base })),
        color: seriesColor(theme, 6),
      });
    }
    return out;
  }, [series.data, compareIndex, symbol, indexId, theme, t]);

  if (loading && !row) {
    return (
      <div className="stack stack-4">
        <Skeleton h={90} radius={16} />
        <Skeleton h={280} radius={16} />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="stack stack-5">
        <PageHead title={t('stock.notFound')} sub={t('stock.notFoundHint')} />
        <Empty
          icon="search"
          title={symbol}
          desc={t('stock.notFoundHint')}
          action={<Btn onClick={() => navigate('/app')}>{t('nav.dashboard')}</Btn>}
        />
      </div>
    );
  }

  const q = row.quote;
  const f = row.fundamentals;
  const currency = row.instrument.currency;
  const dir = (row.changePct ?? 0) > 0 ? 'up' : (row.changePct ?? 0) < 0 ? 'down' : 'flat';

  const TABS: Array<{ value: Tab; label: string }> = [
    { value: 'overview', label: t('stock.overview') },
    ...(row.market === 'SA' ? [{ value: 'tasi' as Tab, label: t('stock.tasi') }] : []),
    { value: 'shariah', label: t('stock.shariah') },
    { value: 'chart', label: t('stock.chart') },
    { value: 'financials', label: t('stock.financials') },
    { value: 'dividends', label: t('stock.dividends') },
    { value: 'impact', label: t('stock.impact') },
    { value: 'actions', label: t('stock.corporateActions') },
    { value: 'earnings', label: t('stock.earnings') },
    { value: 'news', label: t('stock.news') },
    ...(row.market === 'US' ? [{ value: 'options' as Tab, label: t('opt.title') }] : []),
    { value: 'stats', label: t('stock.statistics') },
  ];

  return (
    <div className="stack stack-5">
      {/* ---------------------------- header ---------------------------- */}
      <Card>
        <div className="card-body stack stack-4">
          <div className="row row-4 row-wrap row-top">
            <div
              className="brand-mark"
              style={{
                width: 46,
                height: 46,
                background: 'var(--surface-3)',
                color: 'var(--text)',
                borderRadius: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {row.symbol.slice(0, 4)}
            </div>

            <div className="stack" style={{ gap: 3, minWidth: 200, flex: 1 }}>
              <div className="row row-3 row-wrap">
                <h1 className="h-page">{L(row.instrument.name)}</h1>
                <Badge tone="outline">{row.symbol}</Badge>
                <Badge tone="neutral">{row.market === 'SA' ? '🇸🇦 TASI' : '🇺🇸 US'}</Badge>
              </div>
              <div className="row row-3 row-wrap t-sm muted">
                {row.sector && <span>{L(row.sector.name)}</span>}
                {q && <StatusBadge provenance={q.provenance} />}
              </div>
            </div>

            <div className="stack" style={{ gap: 3, alignItems: 'flex-end' }}>
              <span className={`metric-value xl ${dir}`}>
                <V>{row.price == null ? DASH : fmt.num(row.price)}</V>
              </span>
              <div className="row row-2">
                <span className={`num ${dir}`}>
                  {q?.change == null ? DASH : fmt.num(q.change, { signed: true })}
                </span>
                <Badge tone={dir}>
                  {row.changePct == null ? DASH : fmt.pct(row.changePct, { signed: true })}
                </Badge>
                <span className="t-xs muted-3">{currency}</span>
              </div>
            </div>
          </div>

          <div className="row row-2 row-wrap">
            <Btn
              icon={watched ? 'check' : 'eye'}
              variant={watched ? 'default' : 'ghost'}
              onClick={() => toggleWatch(activeList, row.symbol, row.market)}
            >
              {watched ? t('stock.inWatchlist') : t('stock.addWatchlist')}
            </Btn>
            <Btn icon="plus" variant="primary" onClick={() => setShowTx(true)}>
              {t('stock.addPosition')}
            </Btn>
            <Btn icon="bell" onClick={() => setShowAlert(true)}>
              {t('stock.setAlert')}
            </Btn>
            <Btn icon="compare" onClick={() => navigate('/app/compare')}>
              {t('cmp.title')}
            </Btn>
            <Btn icon="calculator" onClick={() => navigate('/app/calculators/average-cost')}>
              {t('calc.avgCost')}
            </Btn>
          </div>
        </div>

        {/* -------------------------- quick view ------------------------- */}
        <div
          className="card-body"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <div className="row row-between" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="eyebrow">{t('stock.quickView')}</span>
            <span className="t-xs muted-3">{t('stock.summaryNote')}</span>
          </div>
          <div className="metric-grid">
            <Metric
              label={t('sh.status')}
              value={<ShariahBadge status={row.shariahStatus} />}
              size="sm"
            />
            <Metric
              label={t('weight.weight')}
              value={<V>{row.weightPct == null ? DASH : fmt.pct(row.weightPct, { decimals: 3 })}</V>}
              size="sm"
            />
            <Metric
              label={t('stock.impact')}
              value={<BandBadge band={row.impactBand} />}
              size="sm"
              status="calculated"
            />
            <Metric label={t('stock.liquidity')} value={<BandBadge band={row.liquidityBand} />} size="sm" />
            <Metric
              label={t('div.yield')}
              value={<V>{row.dividendYieldPct == null ? DASH : fmt.pct(row.dividendYieldPct)}</V>}
              size="sm"
            />
            <Metric
              label={`${t('stock.performance')} 1M`}
              value={
                <span className={(row.perf1m ?? 0) >= 0 ? 'up' : 'down'}>
                  <V>{row.perf1m == null ? DASH : fmt.pct(row.perf1m, { signed: true })}</V>
                </span>
              }
              size="sm"
            />
            <Metric label={t('g.marketCap')} value={<V>{fmt.compact(row.marketCap)}</V>} size="sm" />
            <Metric label={t('g.volume')} value={<V>{fmt.compact(row.volume)}</V>} size="sm" />
          </div>
        </div>

        {position && (
          <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="row row-between" style={{ marginBottom: 'var(--s-3)' }}>
              <span className="eyebrow">{t('pf.positions')}</span>
              <Link to="/app/portfolio" className="t-sm" style={{ color: 'var(--bm-brand)' }}>
                {t('pf.title')} →
              </Link>
            </div>
            <div className="metric-grid">
              <Metric label={t('g.shares')} value={fmt.int(position.shares)} size="sm" />
              <Metric
                label={t('pf.avgCost')}
                value={<V>{fmt.num(position.averageCost, { decimals: 3 })}</V>}
                size="sm"
                status="calculated"
              />
              <Metric
                label={t('pf.marketValue')}
                value={fmt.money(position.marketValue, currency)}
                size="sm"
              />
              <Metric
                label={t('pf.unrealized')}
                value={fmt.money(position.unrealised, currency, { signed: true })}
                tone={(position.unrealised ?? 0) >= 0 ? 'up' : 'down'}
                size="sm"
              />
              <Metric
                label={t('be.breakeven')}
                value={<V>{fmt.num(position.breakEvenPrice, { decimals: 3 })}</V>}
                size="sm"
                status="calculated"
              />
              <Metric
                label={t('pf.returnPct')}
                value={fmt.pct(position.unrealisedPct, { signed: true })}
                tone={(position.unrealisedPct ?? 0) >= 0 ? 'up' : 'down'}
                size="sm"
              />
            </div>
          </div>
        )}
      </Card>

      <Tabs value={tab} onChange={setTab} options={TABS} />

      {/* ---------------------------- overview -------------------------- */}
      {tab === 'overview' && (
        <div className="stack stack-4">
          <div className="grid grid-2">
            <Card>
              <CardHead
                title={t('stock.chart')}
                right={
                  <Seg
                    value={tf}
                    onChange={setTf}
                    options={TIMEFRAMES.map((x) => ({ value: x, label: x }))}
                  />
                }
              />
              <div className="card-body">
                {chartSeries.length > 0 ? (
                  <LineChart
                    series={chartSeries.slice(0, 1)}
                    height={250}
                    baseline={q?.previousClose != null ? { value: q.previousClose } : undefined}
                    formatValue={(v) => fmt.num(v)}
                    formatLabel={(x) => (tf === '1D' ? fmt.time(x) : fmt.date(x))}
                  />
                ) : (
                  <Skeleton h={250} />
                )}
              </div>
            </Card>

            <Card>
              <CardHead title={t('stock.overview')} />
              <div className="card-body stack stack-4">
                <div className="metric-grid">
                  <Metric label={t('stock.previousClose')} value={<V>{fmt.num(q?.previousClose ?? null)}</V>} size="sm" />
                  <Metric label={t('stock.open')} value={<V>{fmt.num(q?.open ?? null)}</V>} size="sm" />
                  <Metric label={t('stock.high')} value={<V>{fmt.num(q?.dayHigh ?? null)}</V>} size="sm" />
                  <Metric label={t('stock.low')} value={<V>{fmt.num(q?.dayLow ?? null)}</V>} size="sm" />
                  <Metric label={t('g.volume')} value={<V>{fmt.compact(q?.volume ?? null)}</V>} size="sm" />
                  <Metric label={t('g.avgVolume')} value={<V>{fmt.compact(q?.avgVolume30d ?? null)}</V>} size="sm" />
                  <Metric label={t('stock.turnover')} value={<V>{fmt.compact(q?.turnover ?? null)}</V>} size="sm" />
                  <Metric label={t('stock.trades')} value={<V>{fmt.int(q?.trades ?? null)}</V>} size="sm" />
                </div>
                <div className="stack stack-2">
                  <span className="eyebrow">{t('stock.week52Range')}</span>
                  <RangeMeter
                    low={q?.week52Low ?? null}
                    high={q?.week52High ?? null}
                    value={row.price}
                    formatValue={(v) => fmt.num(v)}
                  />
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHead title={t('stock.summary')} icon="info" />
            <div className="card-body stack stack-3">
              <div className="row row-4 row-wrap">
                <span className="row row-2">
                  <ShariahBadge status={row.shariahStatus} /> {t('sh.status')}
                </span>
                <span className="row row-2">
                  <Badge tone="brand">{fmt.pct(row.weightPct, { decimals: 2 })}</Badge>{' '}
                  {t('weight.weight')}
                </span>
                <span className="row row-2">
                  <BandBadge band={row.impactBand} /> {t('stock.impact')}
                </span>
                <span className="row row-2">
                  <BandBadge band={row.liquidityBand} /> {t('stock.liquidity')}
                </span>
                <span className="row row-2">
                  <Badge tone="gold">{fmt.pct(row.dividendYieldPct)}</Badge> {t('div.yield')}
                </span>
                <span className="row row-2">
                  <Badge tone={(row.perf1y ?? 0) >= 0 ? 'up' : 'down'}>
                    {fmt.pct(row.perf1y, { signed: true })}
                  </Badge>{' '}
                  {t('stock.performance')} 1Y
                </span>
              </div>
              <Notice tone="info">{t('stock.summaryNote')}</Notice>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------ TASI ---------------------------- */}
      {tab === 'tasi' && (
        <div className="grid grid-2">
          <Card>
            <CardHead title={t('weight.title')} icon="scale" />
            <div className="card-body">
              <div className="metric-grid">
                <Metric
                  label={t('weight.weight')}
                  value={<V>{row.weightPct == null ? DASH : fmt.pct(row.weightPct, { decimals: 4 })}</V>}
                  size="xl"
                />
                <Metric
                  label={t('weight.freeFloatCap')}
                  value={<V>{fmt.compact(row.constituent?.indexMarketCap ?? null)}</V>}
                />
                <Metric
                  label={t('stock.freeFloat')}
                  value={
                    <V>
                      {row.constituent?.freeFloatFactor == null
                        ? DASH
                        : fmt.pct(row.constituent.freeFloatFactor * 100)}
                    </V>
                  }
                />
                <Metric
                  label={t('stock.listedShares')}
                  value={<V>{fmt.compact(row.instrument.listedShares)}</V>}
                />
                <Metric label={t('g.marketCap')} value={<V>{fmt.compact(row.marketCap)}</V>} />
                <Metric
                  label={t('impact.divisor')}
                  value={
                    <V>
                      {info?.divisor != null
                        ? fmt.num(info.divisor, { decimals: 0 })
                        : fmt.num(info?.derivedDivisor ?? null, { decimals: 0 })}
                    </V>
                  }
                  status={info?.divisor != null ? 'delayed' : 'calculated'}
                  tip={t('impact.divisorNote')}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title={t('impact.title')}
              icon="zap"
              right={<StatusBadge status="calculated" />}
            />
            <div className="card-body">
              <div className="metric-grid">
                <Metric
                  label={t('impact.pointsPerUnit')}
                  value={<V>{row.pointsPerUnit == null ? DASH : fmt.num(row.pointsPerUnit, { decimals: 5 })}</V>}
                  size="xl"
                  status="calculated"
                  tip={
                    <span>
                      {t('impact.formulaBody')}
                      <code className="formula">{POINTS_PER_UNIT_FORMULA}</code>
                    </span>
                  }
                />
                <Metric
                  label={t('impact.todayContribution')}
                  value={
                    <span className={(row.todayPoints ?? 0) >= 0 ? 'up' : 'down'}>
                      <V>
                        {row.todayPoints == null
                          ? DASH
                          : fmt.num(row.todayPoints, { decimals: 2, signed: true })}
                      </V>
                    </span>
                  }
                  size="xl"
                  status="calculated"
                  tip={
                    <span>
                      {t('impact.formulaBody')}
                      <code className="formula">{CONTRIBUTION_FORMULA}</code>
                    </span>
                  }
                />
                <Metric
                  label={`${t('impact.potential')} (+1%)`}
                  value={
                    <V>
                      {row.weightPct == null || info?.quote.level == null
                        ? DASH
                        : fmt.num((row.weightPct / 100) * 0.01 * info.quote.level, {
                            decimals: 2,
                            signed: true,
                          })}
                    </V>
                  }
                  status="calculated"
                />
                <Metric
                  label={`${t('impact.potential')} (−1%)`}
                  value={
                    <V>
                      {row.weightPct == null || info?.quote.level == null
                        ? DASH
                        : fmt.num(-(row.weightPct / 100) * 0.01 * info.quote.level, {
                            decimals: 2,
                            signed: true,
                          })}
                    </V>
                  }
                  status="calculated"
                />
              </div>
              <div style={{ marginTop: 'var(--s-4)' }}>
                <Btn icon="zap" onClick={() => navigate('/app/tasi/impact')}>
                  {t('impact.calculator')}
                </Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------------------- shariah --------------------------- */}
      {tab === 'shariah' && (
        <div className="stack stack-4">
          <ShariahPanel symbol={symbol} />
          <Notice tone="warn" icon="warning">
            {t('sh.disclaimer')}
          </Notice>
        </div>
      )}

      {/* ----------------------------- chart ---------------------------- */}
      {tab === 'chart' && (
        <Card>
          <CardHead
            title={t('stock.chart')}
            right={
              <>
                <Seg
                  value={tf}
                  onChange={setTf}
                  options={TIMEFRAMES.map((x) => ({ value: x, label: x }))}
                />
                <Seg
                  value={compareIndex ? 'on' : 'off'}
                  onChange={(v) => setCompareIndex(v === 'on')}
                  options={[
                    { value: 'off', label: symbol },
                    { value: 'on', label: t('stock.compareTasi') },
                  ]}
                />
              </>
            }
          />
          <div className="card-body">
            {chartSeries.length > 0 ? (
              <LineChart
                series={chartSeries}
                height={380}
                area={chartSeries.length === 1}
                baseline={q?.previousClose != null ? { value: q.previousClose } : undefined}
                formatValue={(v) => fmt.num(v)}
                formatLabel={(x) => (tf === '1D' ? fmt.time(x) : fmt.date(x))}
              />
            ) : (
              <Skeleton h={380} />
            )}
          </div>
          <div className="card-foot">{t('disc.data')}</div>
        </Card>
      )}

      {/* --------------------------- financials ------------------------- */}
      {tab === 'financials' && (
        <Card>
          <CardHead
            title={t('stock.financials')}
            right={f && <StatusBadge provenance={f.provenance} />}
          />
          <div className="card-body">
            {f == null || f.provenance.status === 'unavailable' ? (
              <Empty icon="database" title={t('g.unavailable')} desc={f?.provenance.reason} />
            ) : (
              <div className="metric-grid">
                <Metric label={t('stock.pe')} value={<V>{fmt.num(f.peRatio)}</V>} />
                <Metric label={t('stock.eps')} value={<V>{fmt.num(f.eps, { decimals: 3 })}</V>} />
                <Metric label={t('stock.pb')} value={<V>{fmt.num(f.priceToBook)}</V>} />
                <Metric label={t('stock.beta')} value={<V>{fmt.num(f.beta)}</V>} />
                <Metric label={t('stock.roe')} value={<V>{fmt.pct(f.returnOnEquityPct)}</V>} />
                <Metric label={t('stock.netMargin')} value={<V>{fmt.pct(f.netMarginPct)}</V>} />
                <Metric label="Revenue TTM" value={<V>{fmt.compact(f.revenueTtm)}</V>} />
                <Metric label="Net income TTM" value={<V>{fmt.compact(f.netIncomeTtm)}</V>} />
                <Metric label="Total assets" value={<V>{fmt.compact(f.totalAssets)}</V>} />
                <Metric label="Total debt" value={<V>{fmt.compact(f.totalDebt)}</V>} />
                <Metric label={t('div.yield')} value={<V>{fmt.pct(f.dividendYieldPct)}</V>} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------- dividends ------------------------- */}
      {tab === 'dividends' && (
        <Card>
          <CardHead title={t('div.title')} icon="coins" />
          <div className="card-body">
            {events.loading && <Skeleton h={160} />}
            {events.data && events.data.dividends.length === 0 && (
              <Empty icon="coins" title={t('g.unavailable')} desc={t('div.projectedNote')} />
            )}
            {events.data && events.data.dividends.length > 0 && (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>{t('div.exDate')}</th>
                      <th className="num-col">{t('div.dps')}</th>
                      <th>{t('div.frequency')}</th>
                      <th className="num-col">{t('div.payDate')}</th>
                      <th className="num-col">{t('div.recordDate')}</th>
                      <th>{t('g.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...events.data.dividends]
                      .sort((a, b) => ((a.exDate ?? '') < (b.exDate ?? '') ? 1 : -1))
                      .map((d) => (
                        <tr key={d.id}>
                          <td className="num">{fmt.date(d.exDate)}</td>
                          <td className="num-col num">
                            <V>{fmt.money(d.amountPerShare, d.currency, { decimals: 3 })}</V>
                          </td>
                          <td>{t(`freq.${d.frequency}` as 'freq.annual')}</td>
                          <td className="num-col num">{fmt.date(d.payDate)}</td>
                          <td className="num-col num">{fmt.date(d.recordDate)}</td>
                          <td>
                            <span className="row row-2">
                              <Badge tone={d.announced ? 'up' : 'gold'}>
                                {d.announced ? t('div.announced') : t('div.projected')}
                              </Badge>
                              <StatusBadge provenance={d.provenance} compact />
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ----------------------------- impact --------------------------- */}
      {tab === 'impact' && (
        <Card>
          <CardHead
            title={t('impact.title')}
            right={
              <FormulaTip
                text={t('impact.formulaBody')}
                formula={`${POINTS_PER_UNIT_FORMULA}\n\n${CONTRIBUTION_FORMULA}`}
                computedAt={row.impact?.computedAt}
              />
            }
          />
          <div className="card-body stack stack-4">
            {row.impact?.status === 'unavailable' ? (
              <Empty icon="zap" title={t('g.unavailable')} desc={row.impact.note} />
            ) : (
              <>
                <div className="metric-grid">
                  <Metric
                    label={t('impact.pointsPerUnit')}
                    value={<V>{fmt.num(row.pointsPerUnit, { decimals: 5 })}</V>}
                    size="xl"
                    status="calculated"
                  />
                  <Metric
                    label={t('impact.todayContribution')}
                    value={
                      <span className={(row.todayPoints ?? 0) >= 0 ? 'up' : 'down'}>
                        <V>{fmt.num(row.todayPoints, { decimals: 2, signed: true })}</V>
                      </span>
                    }
                    size="xl"
                    status="calculated"
                  />
                  <Metric label={t('weight.weight')} value={<V>{fmt.pct(row.weightPct, { decimals: 4 })}</V>} />
                  <Metric label={t('g.price')} value={<V>{fmt.num(row.price)}</V>} />
                </div>

                <div className="table-wrap">
                  <table className="dt">
                    <thead>
                      <tr>
                        <th>{t('impact.expectedChangePct')}</th>
                        <th className="num-col">{t('impact.expectedPrice')}</th>
                        <th className="num-col">{t('impact.individual')}</th>
                        <th className="num-col">{t('impact.estimatedLevel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[-5, -3, -1, 1, 3, 5, 10].map((movePct) => {
                        const pts =
                          row.weightPct == null || info?.quote.level == null
                            ? null
                            : (row.weightPct / 100) * (movePct / 100) * info.quote.level;
                        return (
                          <tr key={movePct}>
                            <td>
                              <Badge tone={movePct >= 0 ? 'up' : 'down'}>
                                {fmt.pct(movePct, { signed: true, decimals: 0 })}
                              </Badge>
                            </td>
                            <td className="num-col num">
                              <V>
                                {row.price == null ? DASH : fmt.num(row.price * (1 + movePct / 100))}
                              </V>
                            </td>
                            <td className={`num-col num ${(pts ?? 0) >= 0 ? 'up' : 'down'}`}>
                              <V>{pts == null ? DASH : fmt.num(pts, { decimals: 2, signed: true })}</V>
                            </td>
                            <td className="num-col num">
                              <V>
                                {pts == null || info?.quote.level == null
                                  ? DASH
                                  : fmt.num(info.quote.level + pts)}
                              </V>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Notice tone="warn" icon="warning">
                  {t('impact.scenarioDisclaimer')}
                </Notice>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ------------------------ corporate actions --------------------- */}
      {tab === 'actions' && (
        <Card>
          <CardHead title={t('ca.title')} icon="briefcase" />
          <div className="card-body">
            {events.loading && <Skeleton h={140} />}
            {events.data && events.data.actions.length === 0 && (
              <Empty icon="briefcase" title={t('g.noData')} />
            )}
            {events.data && events.data.actions.length > 0 && (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>{t('ca.effectiveDate')}</th>
                      <th>{t('g.type')}</th>
                      <th>{t('ca.detail')}</th>
                      <th className="num-col">{t('ca.ratio')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.data.actions.map((c) => (
                      <tr key={c.id}>
                        <td className="num">{fmt.date(c.effectiveDate)}</td>
                        <td>
                          <Badge tone="outline">{t(`ca.${c.kind}` as 'ca.split')}</Badge>
                        </td>
                        <td className="muted" style={{ whiteSpace: 'normal', maxWidth: 420 }}>
                          {L(c.detail)}
                        </td>
                        <td className="num-col num">
                          <V>{c.ratio ?? DASH}</V>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------- earnings -------------------------- */}
      {tab === 'earnings' && (
        <Card>
          <CardHead title={t('earn.title')} icon="calendar" />
          <div className="card-body">
            {events.loading && <Skeleton h={140} />}
            {events.data && events.data.earnings.length === 0 && (
              <Empty icon="calendar" title={t('g.noData')} desc={t('earn.noEstimateNote')} />
            )}
            {events.data && events.data.earnings.length > 0 && (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>{t('earn.period')}</th>
                      <th className="num-col">{t('earn.reportDate')}</th>
                      <th className="num-col">{t('earn.epsEstimate')}</th>
                      <th className="num-col">{t('earn.epsActual')}</th>
                      <th className="num-col">{t('earn.netIncome')}</th>
                      <th className="num-col">{t('earn.priorNetIncome')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.data.earnings.map((e) => (
                      <tr key={e.id}>
                        <td>{e.period}</td>
                        <td className="num-col num">{fmt.date(e.date)}</td>
                        <td className="num-col num">
                          {e.epsEstimate == null ? (
                            <span className="unavailable">{t('earn.noEstimate')}</span>
                          ) : (
                            fmt.num(e.epsEstimate, { decimals: 3 })
                          )}
                        </td>
                        <td className="num-col num">
                          <V>{fmt.num(e.epsActual, { decimals: 3 })}</V>
                        </td>
                        <td className="num-col num">
                          <V>{fmt.compact(e.netIncome)}</V>
                        </td>
                        <td className="num-col num">
                          <V>{fmt.compact(e.priorPeriodNetIncome)}</V>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card-foot">{t('earn.noEstimateNote')}</div>
        </Card>
      )}

      {/* ------------------------------ news ---------------------------- */}
      {tab === 'news' && (
        <Card>
          <CardHead title={t('news.title')} icon="news" />
          <div className="card-body stack stack-3">
            {events.loading && <Skeleton h={140} />}
            {events.data && events.data.news.length === 0 && (
              <Empty icon="news" title={t('g.unavailable')} desc={t('news.whyMovingNote')} />
            )}
            {events.data?.news.map((n) => (
              <div
                key={n.id}
                className="stack stack-2"
                style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--s-3)' }}
              >
                <span className="t-lg" style={{ fontWeight: 550, lineHeight: 1.5 }}>
                  {L(n.headline)}
                </span>
                <span className="row row-3 t-xs muted-3">
                  <span>{n.sourceName}</span>
                  <span>·</span>
                  <span>{fmt.relative(n.publishedAt)}</span>
                  <StatusBadge provenance={n.provenance} />
                </span>
              </div>
            ))}
            <Notice tone="warn" icon="warning">
              {t('news.whyMovingNote')}
            </Notice>
          </div>
        </Card>
      )}

      {/* ---------------------------- options --------------------------- */}
      {tab === 'options' && (
        <Suspense fallback={<Skeleton h={420} radius={16} />}>
          <OptionsPanel
            symbol={symbol}
            spot={row.price}
            currency={row.instrument.currency}
            hasOptionsMarket={row.market === 'US'}
          />
        </Suspense>
      )}

      {/* --------------------------- statistics ------------------------- */}
      {tab === 'stats' && (
        <div className="grid grid-2">
          <Card>
            <CardHead title={t('stock.statistics')} />
            <div className="card-body">
              <div className="metric-grid">
                <Metric label={t('stock.week52High')} value={<V>{fmt.num(q?.week52High ?? null)}</V>} size="sm" />
                <Metric label={t('stock.week52Low')} value={<V>{fmt.num(q?.week52Low ?? null)}</V>} size="sm" />
                <Metric label={t('scr.f.range52')} value={<V>{fmt.pct(row.range52Pct, { decimals: 0 })}</V>} size="sm" />
                <Metric label={t('rank.volatile')} value={<V>{fmt.pct(row.volatilityPct)}</V>} size="sm" />
                <Metric label={`${t('stock.performance')} 1W`} value={<V>{fmt.pct(q?.perf1w ?? null, { signed: true })}</V>} size="sm" />
                <Metric label={`${t('stock.performance')} 1M`} value={<V>{fmt.pct(row.perf1m, { signed: true })}</V>} size="sm" />
                <Metric label={`${t('stock.performance')} 3M`} value={<V>{fmt.pct(q?.perf3m ?? null, { signed: true })}</V>} size="sm" />
                <Metric label={`${t('stock.performance')} 1Y`} value={<V>{fmt.pct(row.perf1y, { signed: true })}</V>} size="sm" />
                <Metric label={t('stock.listedShares')} value={<V>{fmt.compact(row.instrument.listedShares)}</V>} size="sm" />
                <Metric label={t('stock.freeFloat')} value={<V>{fmt.compact(row.instrument.freeFloatShares)}</V>} size="sm" />
              </div>
            </div>
          </Card>
          <Card>
            <CardHead title={t('g.dataStatus')} icon="database" />
            <div className="card-body stack stack-3">
              {[
                { label: t('g.price'), p: q?.provenance },
                { label: t('stock.financials'), p: f?.provenance },
                { label: t('weight.weight'), p: row.constituent?.provenance },
                { label: t('sh.status'), p: row.screening?.provenance },
              ].map((x, i) => (
                <div key={i} className="row row-between">
                  <span className="t-sm muted">{x.label}</span>
                  {x.p ? (
                    <span className="row row-3">
                      <StatusBadge provenance={x.p} />
                      <span className="t-xs muted-3 num">{fmt.dateTime(x.p.lastUpdated)}</span>
                    </span>
                  ) : (
                    <span className="unavailable">{DASH}</span>
                  )}
                </div>
              ))}
              <div className="row row-between">
                <span className="t-sm muted">{t('g.methodology')}</span>
                <span className="t-sm">{methodologyId.toUpperCase()}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Disclaimers shariah />

      <TransactionModal open={showTx} onClose={() => setShowTx(false)} presetSymbol={symbol} />
      <AlertModal open={showAlert} onClose={() => setShowAlert(false)} presetSymbol={symbol} />
    </div>
  );
}
