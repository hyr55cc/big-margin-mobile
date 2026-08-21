import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { usePortfolioSummary, type Position } from '@/lib/portfolioMath';
import { usePortfolio, removeTransaction } from '@/store/portfolio';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Check,
  DataTable,
  Empty,
  IconBtn,
  Metric,
  Notice,
  Seg,
  ShariahBadge,
  Skeleton,
  Tabs,
  V,
  type Column,
} from '@/components/ui';
import { SymbolCell } from '@/components/market/cells';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import {
  DonutChart,
  LineChart,
  Treemap,
  performanceColor,
  seriesColor,
  useChartTheme,
} from '@/components/charts';
import { DASH } from '@/lib/format';
import type { Timeframe, Transaction } from '@/types';

type Tab = 'positions' | 'transactions' | 'allocation' | 'performance' | 'shariah';
type AllocBy = 'stock' | 'sector' | 'market' | 'currency';

const TIMEFRAMES: Timeframe[] = ['1M', '3M', '6M', '1Y', '5Y'];

export default function Portfolio() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { bySymbol, indices } = useMarket();
  const pf = usePortfolioSummary();
  const transactions = usePortfolio((s) => s.transactions);
  const activeId = usePortfolio((s) => s.activeId);

  const [tab, setTab] = useState<Tab>('positions');
  const [allocBy, setAllocBy] = useState<AllocBy>('stock');
  const [tf, setTf] = useState<Timeframe>('1Y');
  const [compliantOnly, setCompliantOnly] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const ccy = pf.baseCurrency;
  const positions = compliantOnly
    ? pf.positions.filter((p) => p.shariahStatus === 'compliant')
    : pf.positions;

  const myTx = useMemo(
    () =>
      transactions
        .filter((x) => x.portfolioId === activeId)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, activeId],
  );

  /* ---- portfolio value over time, reconstructed from the ledger ---- */
  const perf = useAsync(async () => {
    if (pf.positions.length === 0) return null;
    const p = getProvider();
    const symbols = pf.positions.map((x) => x.symbol);
    const [seriesList, benchmark] = await Promise.all([
      Promise.all(symbols.map((s) => p.getSeries(s, tf))),
      p.getIndexSeries('TASI', tf),
    ]);

    const dates = new Set<string>();
    seriesList.forEach((s) => s?.candles.forEach((c) => dates.add(c.t.slice(0, 10))));
    const ordered = [...dates].sort();
    if (ordered.length === 0) return null;

    const priceAt = new Map<string, Map<string, number>>();
    seriesList.forEach((s, i) => {
      if (!s) return;
      const m = new Map<string, number>();
      s.candles.forEach((c) => m.set(c.t.slice(0, 10), c.c));
      priceAt.set(symbols[i], m);
    });

    const txBySymbol = new Map<string, Transaction[]>();
    for (const tx of myTx) {
      if (!tx.symbol) continue;
      txBySymbol.set(tx.symbol, [...(txBySymbol.get(tx.symbol) ?? []), tx]);
    }

    const values = ordered.map((d) => {
      let total = 0;
      for (const sym of symbols) {
        const list = txBySymbol.get(sym) ?? [];
        let shares = 0;
        for (const tx of list) {
          if (tx.date > d) continue;
          if (tx.kind === 'buy') shares += tx.quantity ?? 0;
          else if (tx.kind === 'sell') shares -= tx.quantity ?? 0;
        }
        if (shares <= 0) continue;
        const price = priceAt.get(sym)?.get(d);
        if (price != null) total += shares * price;
      }
      return { t: d, v: total };
    });

    const firstNonZero = values.find((v) => v.v > 0);
    if (!firstNonZero) return null;
    const base = firstNonZero.v;

    const bench = benchmark?.candles ?? [];
    const benchBase = bench[0]?.c ?? null;

    return {
      portfolio: values.map((v) => ({ t: v.t, v: v.v > 0 ? (v.v / base) * 100 : null })),
      benchmark:
        benchBase != null
          ? bench.map((c) => ({ t: c.t.slice(0, 10), v: (c.c / benchBase) * 100 }))
          : [],
    };
  }, [pf.positions.length, tf, myTx.length]);

  /* ------------------------------ columns --------------------------- */

  const positionColumns: Column<Position>[] = [
    {
      key: 'symbol',
      label: t('g.company'),
      value: (p) => p.symbol,
      render: (p) =>
        p.row ? <SymbolCell row={p.row} showFlag /> : <span className="sym">{p.symbol}</span>,
    },
    {
      key: 'shares',
      label: t('g.shares'),
      align: 'end',
      value: (p) => p.shares,
      render: (p) => <span className="num">{fmt.int(p.shares)}</span>,
    },
    {
      key: 'avg',
      label: t('pf.avgCost'),
      align: 'end',
      value: (p) => p.averageCost,
      render: (p) => <V>{fmt.num(p.averageCost, { decimals: 3 })}</V>,
    },
    {
      key: 'price',
      label: t('g.price'),
      align: 'end',
      value: (p) => p.price,
      render: (p) => <V>{fmt.num(p.price)}</V>,
    },
    {
      key: 'value',
      label: t('pf.marketValue'),
      align: 'end',
      value: (p) => p.marketValue,
      render: (p) => <V>{fmt.money(p.marketValue, p.currency, { symbol: false })}</V>,
    },
    {
      key: 'cost',
      label: t('pf.costBasis'),
      align: 'end',
      value: (p) => p.costBasis,
      render: (p) => <span className="num">{fmt.num(p.costBasis)}</span>,
      optional: true,
    },
    {
      key: 'unrealised',
      label: t('pf.unrealized'),
      align: 'end',
      value: (p) => p.unrealised,
      render: (p) => (
        <span className={`num ${(p.unrealised ?? 0) >= 0 ? 'up' : 'down'}`}>
          <V>{fmt.num(p.unrealised, { signed: true })}</V>
        </span>
      ),
    },
    {
      key: 'returnPct',
      label: t('pf.returnPct'),
      align: 'end',
      value: (p) => p.unrealisedPct,
      render: (p) => (
        <Badge tone={(p.unrealisedPct ?? 0) >= 0 ? 'up' : 'down'}>
          {p.unrealisedPct == null ? DASH : fmt.pct(p.unrealisedPct, { signed: true })}
        </Badge>
      ),
    },
    {
      key: 'today',
      label: t('pf.todayPnl'),
      align: 'end',
      value: (p) => p.todayPnl,
      render: (p) => (
        <span className={`num ${(p.todayPnl ?? 0) >= 0 ? 'up' : 'down'}`}>
          <V>{fmt.num(p.todayPnl, { signed: true })}</V>
        </span>
      ),
      optional: true,
    },
    {
      key: 'realised',
      label: t('pf.realized'),
      align: 'end',
      value: (p) => p.realisedProfit,
      render: (p) => (
        <span className={`num ${p.realisedProfit >= 0 ? 'up' : 'down'}`}>
          {fmt.num(p.realisedProfit, { signed: true })}
        </span>
      ),
      optional: true,
    },
    {
      key: 'dividends',
      label: t('pf.dividendIncome'),
      align: 'end',
      value: (p) => p.dividendIncome,
      render: (p) => <span className="num">{fmt.num(p.dividendIncome)}</span>,
      optional: true,
    },
    {
      key: 'breakeven',
      label: t('be.breakeven'),
      align: 'end',
      value: (p) => p.breakEvenPrice,
      render: (p) => <V>{fmt.num(p.breakEvenPrice, { decimals: 3 })}</V>,
      optional: true,
    },
    {
      key: 'weight',
      label: t('pf.weightInPortfolio'),
      align: 'end',
      value: (p) => p.weightInPortfolioPct,
      render: (p) => <V>{fmt.pct(p.weightInPortfolioPct)}</V>,
    },
    {
      key: 'indexWeight',
      label: t('weight.weight'),
      align: 'end',
      value: (p) => p.indexWeightPct,
      render: (p) => <V>{p.indexWeightPct == null ? DASH : fmt.pct(p.indexWeightPct, { decimals: 3 })}</V>,
      optional: true,
    },
    {
      key: 'shariah',
      label: t('sh.status'),
      value: (p) => p.shariahStatus,
      render: (p) => <ShariahBadge status={p.shariahStatus} />,
    },
  ];

  const txColumns: Column<Transaction>[] = [
    { key: 'date', label: t('g.date'), align: 'end', value: (x) => x.date, render: (x) => <span className="num">{fmt.date(x.date)}</span> },
    {
      key: 'kind',
      label: t('g.type'),
      value: (x) => x.kind,
      render: (x) => (
        <Badge tone={x.kind === 'buy' ? 'up' : x.kind === 'sell' ? 'down' : 'neutral'}>
          {t(`pf.kind.${x.kind}` as 'pf.kind.buy')}
        </Badge>
      ),
    },
    {
      key: 'symbol',
      label: t('g.symbol'),
      value: (x) => x.symbol,
      render: (x) => {
        if (!x.symbol) return <span className="unavailable">{DASH}</span>;
        const row = bySymbol.get(x.symbol);
        return (
          <span className="row row-2">
            <span className="sym">{x.symbol}</span>
            <span className="t-sm muted truncate">{row ? L(row.instrument.shortName) : ''}</span>
          </span>
        );
      },
    },
    { key: 'qty', label: t('g.quantity'), align: 'end', value: (x) => x.quantity, render: (x) => <V>{fmt.int(x.quantity)}</V> },
    { key: 'price', label: t('g.price'), align: 'end', value: (x) => x.price, render: (x) => <V>{fmt.num(x.price, { decimals: 3 })}</V> },
    {
      key: 'fees',
      label: t('pf.fees'),
      align: 'end',
      value: (x) => x.commission + x.fees + x.otherCosts,
      render: (x) => <span className="num">{fmt.num(x.commission + x.fees + x.otherCosts)}</span>,
    },
    {
      key: 'total',
      label: t('g.total'),
      align: 'end',
      value: (x) =>
        x.price != null && x.quantity != null ? x.price * x.quantity : x.price ?? null,
      render: (x) => (
        <V>
          {x.price != null && x.quantity != null
            ? fmt.num(x.price * x.quantity)
            : x.price != null
              ? fmt.num(x.price)
              : DASH}
        </V>
      ),
    },
    { key: 'note', label: t('pf.note'), value: (x) => x.note, optional: true, defaultHidden: true },
    {
      key: 'actions',
      label: t('g.actions'),
      align: 'end',
      sortable: false,
      render: (x) => (
        <span className="row row-2 row-end">
          <IconBtn icon="settings" title={t('g.edit')} onClick={() => { setEditing(x); setShowTx(true); }} />
          <IconBtn icon="trash" title={t('g.delete')} onClick={() => removeTransaction(x.id)} />
        </span>
      ),
    },
  ];

  /* ---------------------------- allocation -------------------------- */

  const allocation = useMemo(() => {
    const groups = new Map<string, number>();
    for (const p of positions) {
      if (p.marketValue == null) continue;
      let key: string;
      switch (allocBy) {
        case 'stock':
          key = p.symbol;
          break;
        case 'sector':
          key = p.row?.sector ? L(p.row.sector.name) : t('sh.unknown');
          break;
        case 'market':
          key = p.market ?? t('sh.unknown');
          break;
        case 'currency':
          key = p.currency;
          break;
      }
      groups.set(key, (groups.get(key) ?? 0) + p.marketValue);
    }
    const total = [...groups.values()].reduce((s, v) => s + v, 0) || 1;
    return [...groups.entries()]
      .map(([key, value]) => ({ key, label: key, value: (value / total) * 100, raw: value }))
      .sort((a, b) => b.value - a.value);
  }, [positions, allocBy, L, t]);

  const empty = pf.positions.length === 0;

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('pf.title')}
        sub={t('pf.sub')}
        right={
          <>
            <Btn icon="calculator" onClick={() => navigate('/app/calculators')}>
              {t('calc.title')}
            </Btn>
            <Btn
              variant="primary"
              icon="plus"
              onClick={() => {
                setEditing(null);
                setShowTx(true);
              }}
            >
              {t('pf.addTransaction')}
            </Btn>
          </>
        }
      />

      {pf.warnings.length > 0 && (
        <Notice tone="warn" icon="warning">
          {pf.warnings.join(' · ')}
        </Notice>
      )}

      {pf.mixedCurrency && (
        <Notice tone="info">{t('set.currencyNote')}</Notice>
      )}

      {empty ? (
        <Empty
          icon="wallet"
          title={t('pf.empty')}
          desc={t('pf.emptyHint')}
          action={
            <Btn variant="primary" icon="plus" onClick={() => setShowTx(true)}>
              {t('pf.addTransaction')}
            </Btn>
          }
        />
      ) : (
        <>
          <div className="grid grid-4">
            <Card className="card-pad">
              <Metric label={t('pf.totalValue')} value={fmt.money(pf.totalValue, ccy)} size="xl" />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('pf.todayPnl')}
                value={fmt.money(pf.todayPnl, ccy, { signed: true })}
                tone={pf.todayPnl >= 0 ? 'up' : 'down'}
                size="xl"
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('pf.totalReturn')}
                value={fmt.money(pf.totalReturn, ccy, { signed: true })}
                tone={pf.totalReturn >= 0 ? 'up' : 'down'}
                size="xl"
                sub={fmt.pct(pf.totalReturnPct, { signed: true })}
                status="calculated"
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('pf.indexExposure')}
                value={<V>{fmt.pct(pf.indexExposurePct, { decimals: 3 })}</V>}
                size="xl"
                tip={t('pf.indexExposureTip')}
                status="calculated"
              />
            </Card>
          </div>

          <Card>
            <div className="card-body">
              <div className="metric-grid">
                <Metric label={t('pf.invested')} value={fmt.money(pf.invested, ccy)} />
                <Metric label={t('pf.currentValue')} value={fmt.money(pf.currentValue, ccy)} />
                <Metric
                  label={t('pf.unrealized')}
                  value={fmt.money(pf.unrealised, ccy, { signed: true })}
                  tone={pf.unrealised >= 0 ? 'up' : 'down'}
                />
                <Metric
                  label={t('pf.realized')}
                  value={fmt.money(pf.realised, ccy, { signed: true })}
                  tone={pf.realised >= 0 ? 'up' : 'down'}
                />
                <Metric label={t('pf.dividendsReceived')} value={fmt.money(pf.dividends, ccy)} />
                <Metric label={t('pf.cash')} value={fmt.money(pf.cash, ccy)} />
                <Metric label={t('pf.positions')} value={fmt.int(pf.positions.length)} />
                <Metric
                  label={t('sh.compliant')}
                  value={fmt.pct(pf.shariahMix.compliant)}
                  tone="brand"
                />
              </div>
            </div>
          </Card>

          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'positions', label: t('pf.positions') },
              { value: 'transactions', label: t('pf.transactions') },
              { value: 'allocation', label: t('pf.allocation') },
              { value: 'performance', label: t('pf.performance') },
              { value: 'shariah', label: t('pf.shariahMix') },
            ]}
          />

          {tab === 'positions' && (
            <Card>
              <DataTable
                rows={positions}
                columns={positionColumns}
                rowKey={(p) => p.symbol}
                initialSort="value"
                onRowClick={(p) => navigate(`/app/stock/${p.symbol}`)}
                exportName="big-margin-positions"
                pageSize={30}
                toolbar={
                  <Check checked={compliantOnly} onChange={setCompliantOnly}>
                    <span className="t-sm">{t('pf.onlyCompliant')}</span>
                  </Check>
                }
              />
            </Card>
          )}

          {tab === 'transactions' && (
            <Card>
              <DataTable
                rows={myTx}
                columns={txColumns}
                rowKey={(x) => x.id}
                initialSort="date"
                exportName="big-margin-transactions"
                pageSize={30}
                toolbar={
                  <Btn size="sm" icon="plus" onClick={() => { setEditing(null); setShowTx(true); }}>
                    {t('pf.addTransaction')}
                  </Btn>
                }
              />
            </Card>
          )}

          {tab === 'allocation' && (
            <div className="stack stack-4">
              <Card>
                <CardHead
                  title={t('pf.allocation')}
                  right={
                    <Seg
                      value={allocBy}
                      onChange={setAllocBy}
                      options={[
                        { value: 'stock', label: t('pf.byStock') },
                        { value: 'sector', label: t('pf.bySector') },
                        { value: 'market', label: t('pf.byMarket') },
                        { value: 'currency', label: t('pf.byCurrency') },
                      ]}
                    />
                  }
                />
                <div className="card-body">
                  <DonutChart
                    size={240}
                    items={allocation.slice(0, 8)}
                    formatValue={(v) => fmt.pct(v, { decimals: 1 })}
                    center={
                      <div className="stack" style={{ gap: 0 }}>
                        <span className="eyebrow">{t('pf.currentValue')}</span>
                        <span className="metric-value">{fmt.compact(pf.currentValue)}</span>
                      </div>
                    }
                    onSelect={(k) => allocBy === 'stock' && navigate(`/app/stock/${k}`)}
                  />
                </div>
              </Card>

              <Card>
                <CardHead title={t('pf.byStock')} />
                <div className="card-body">
                  <Treemap
                    height={340}
                    items={positions
                      .filter((p) => p.marketValue != null)
                      .map((p) => ({
                        key: p.symbol,
                        label: p.symbol,
                        size: p.marketValue as number,
                        color: performanceColor(theme, p.unrealisedPct, 12),
                        valueLabel: fmt.pct(p.unrealisedPct, { signed: true }),
                      }))}
                    onSelect={(sym) => navigate(`/app/stock/${sym}`)}
                  />
                </div>
              </Card>
            </div>
          )}

          {tab === 'performance' && (
            <Card>
              <CardHead
                title={t('pf.performance')}
                sub={`${t('pf.vsBenchmark')} · TASI`}
                right={
                  <Seg
                    value={tf}
                    onChange={setTf}
                    options={TIMEFRAMES.map((x) => ({ value: x, label: x }))}
                  />
                }
              />
              <div className="card-body">
                {perf.loading && <Skeleton h={320} />}
                {perf.data ? (
                  <LineChart
                    height={340}
                    area={false}
                    baseline={{ value: 100 }}
                    series={[
                      {
                        key: 'portfolio',
                        name: t('pf.title'),
                        points: perf.data.portfolio,
                        color: theme.brand,
                      },
                      ...(perf.data.benchmark.length
                        ? [
                            {
                              key: 'tasi',
                              name: indices.find((i) => i.id === 'TASI')
                                ? L(indices.find((i) => i.id === 'TASI')!.name)
                                : 'TASI',
                              points: perf.data.benchmark,
                              color: seriesColor(theme, 6),
                              dashed: true,
                            },
                          ]
                        : []),
                    ]}
                    formatValue={(v) => fmt.num(v, { decimals: 0 })}
                    formatLabel={(x) => fmt.date(x)}
                  />
                ) : (
                  !perf.loading && <Empty title={t('g.noData')} desc={t('pf.emptyHint')} />
                )}
              </div>
              <div className="card-foot">
                {t('g.formula')}: portfolio value at each date = Σ (shares held on that date ×
                closing price). Indexed to 100 at the start of the window.
              </div>
            </Card>
          )}

          {tab === 'shariah' && (
            <div className="grid grid-2">
              <Card>
                <CardHead title={t('pf.shariahMix')} icon="crescent" />
                <div className="card-body">
                  <DonutChart
                    size={220}
                    items={[
                      { key: 'c', label: t('sh.compliant'), value: pf.shariahMix.compliant, color: theme.up },
                      { key: 'n', label: t('sh.nonCompliant'), value: pf.shariahMix.non_compliant, color: theme.down },
                      { key: 'u', label: t('sh.unknown'), value: pf.shariahMix.unknown, color: theme.flat },
                    ]}
                    formatValue={(v) => fmt.pct(v, { decimals: 1 })}
                  />
                </div>
                <div className="card-foot">{t('sh.disclaimer')}</div>
              </Card>

              <Card>
                <CardHead title={t('pf.positions')} />
                <div className="card-body stack stack-3">
                  {pf.positions.map((p) => (
                    <div key={p.symbol} className="row row-between">
                      <span className="row row-3">
                        <span className="sym">{p.symbol}</span>
                        <ShariahBadge status={p.shariahStatus} />
                      </span>
                      <span className="num t-sm">{fmt.pct(p.weightInPortfolioPct)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Disclaimers shariah />

      <TransactionModal
        open={showTx}
        onClose={() => {
          setShowTx(false);
          setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}
