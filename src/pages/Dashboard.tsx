import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { usePortfolioSummary } from '@/lib/portfolioMath';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Empty,
  Metric,
  Skeleton,
  StatusBadge,
  V,
} from '@/components/ui';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import { DASH } from '@/lib/format';
import type { IndexQuote, MarketId } from '@/types';

function IndexCard({
  index,
  market,
  extra,
}: {
  index: IndexQuote | undefined;
  market: MarketId;
  extra?: React.ReactNode;
}) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { statuses } = useMarket();
  if (!index) return <Skeleton h={220} radius={16} />;

  const dir = (index.changePct ?? 0) > 0 ? 'up' : (index.changePct ?? 0) < 0 ? 'down' : 'flat';

  return (
    <Card>
      <CardHead
        title={L(index.name)}
        sub={index.id}
        right={
          <>
            <MarketStatusPill status={statuses[market]} />
            <StatusBadge provenance={index.provenance} />
          </>
        }
      />
      <div className="card-body stack stack-4">
        <div className="row row-4 row-wrap" style={{ alignItems: 'flex-end' }}>
          <div className={`metric-value xl ${dir}`}>
            <V>{index.level == null ? DASH : fmt.num(index.level)}</V>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className={`num ${dir}`}>
              {index.change == null ? DASH : fmt.num(index.change, { signed: true })}
            </span>
            <Badge tone={dir}>
              {index.changePct == null ? DASH : fmt.pct(index.changePct, { signed: true })}
            </Badge>
          </div>
        </div>

        <div className="metric-grid">
          <Metric
            label={t('dash.advancers')}
            value={<span className="up">{fmt.int(index.advancers)}</span>}
            size="sm"
          />
          <Metric
            label={t('dash.decliners')}
            value={<span className="down">{fmt.int(index.decliners)}</span>}
            size="sm"
          />
          <Metric label={t('dash.unchanged')} value={fmt.int(index.unchanged)} size="sm" />
          <Metric label={t('dash.totalVolume')} value={fmt.compact(index.volume)} size="sm" />
          <Metric label={t('dash.totalValue')} value={fmt.compact(index.turnover)} size="sm" />
        </div>

        {extra}
      </div>
    </Card>
  );
}

function ContributorRow({ row, label }: { row: MarketRow | null; label: string }) {
  const fmt = useFmt();
  const { L } = useI18n();
  if (!row) return null;
  const pts = row.todayPoints;
  return (
    <div className="row row-between">
      <span className="t-xs muted-3">{label}</span>
      <Link to={`/app/stock/${row.symbol}`} className="row row-2">
        <span className="sym t-sm">{row.symbol}</span>
        <span className="t-sm truncate" style={{ maxWidth: 130 }}>
          {L(row.instrument.shortName)}
        </span>
        <span className={`num t-sm ${(pts ?? 0) >= 0 ? 'up' : 'down'}`}>
          {pts == null ? DASH : fmt.num(pts, { decimals: 1, signed: true })}
        </span>
      </Link>
    </div>
  );
}

function MiniList({
  title,
  rows,
  metric,
  icon,
  to,
}: {
  title: string;
  rows: MarketRow[];
  metric: (r: MarketRow) => React.ReactNode;
  icon: 'zap' | 'arrowUp' | 'arrowDown' | 'activity';
  to?: string;
}) {
  const { t, L } = useI18n();
  const navigate = useNavigate();
  return (
    <Card>
      <CardHead
        title={title}
        icon={icon}
        right={
          to && (
            <Btn size="sm" variant="ghost" onClick={() => navigate(to)}>
              {t('g.viewAll')}
            </Btn>
          )
        }
      />
      <div className="card-body tight stack stack-1">
        {rows.length === 0 ? (
          <Empty title={t('g.noData')} />
        ) : (
          rows.map((r) => (
            <Link
              key={r.symbol}
              to={`/app/stock/${r.symbol}`}
              className="row row-3"
              style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}
            >
              <span className="sym" style={{ minWidth: 52 }}>
                {r.symbol}
              </span>
              <span className="truncate" style={{ flex: 1 }}>
                {L(r.instrument.shortName)}
              </span>
              {metric(r)}
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { indices, rowsFor, loading, rows } = useMarket();
  const pf = usePortfolioSummary();

  const tasi = indices.find((i) => i.id === 'TASI');
  const spx = indices.find((i) => i.id === 'SPX');
  const ndx = indices.find((i) => i.id === 'NDX');
  const dji = indices.find((i) => i.id === 'DJI');

  const sa = rowsFor('SA');

  const { topImpact, gainers, losers, active, bestContrib, worstContrib } = useMemo(() => {
    const withPoints = sa.filter((r) => r.todayPoints != null);
    const priced = sa.filter((r) => r.changePct != null);
    return {
      topImpact: [...sa]
        .filter((r) => r.weightPct != null)
        .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))
        .slice(0, 6),
      gainers: [...priced].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 6),
      losers: [...priced].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 6),
      active: [...sa]
        .filter((r) => r.turnover != null)
        .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
        .slice(0, 6),
      bestContrib:
        [...withPoints].sort((a, b) => (b.todayPoints ?? 0) - (a.todayPoints ?? 0))[0] ?? null,
      worstContrib:
        [...withPoints].sort((a, b) => (a.todayPoints ?? 0) - (b.todayPoints ?? 0))[0] ?? null,
    };
  }, [sa]);

  const news = useAsync(() => getProvider().listNews({ limit: 6 }), []);

  const events = useAsync(async () => {
    const p = getProvider();
    const [ca, earn] = await Promise.all([
      p.listCorporateActions({ market: 'SA' }),
      p.listEarnings({ market: 'SA' }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const upcomingCa = ca
      .filter((x) => (x.effectiveDate ?? '') >= today)
      .sort((a, b) => ((a.effectiveDate ?? '') < (b.effectiveDate ?? '') ? -1 : 1))
      .slice(0, 4);
    const upcomingEarn = earn
      .filter((x) => (x.date ?? '') >= today)
      .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1))
      .slice(0, 4);
    return { upcomingCa, upcomingEarn };
  }, []);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('dash.title')}
        sub={t('dash.sub')}
        right={
          <>
            <Btn icon="filter" onClick={() => navigate('/app/screener')}>
              {t('nav.screener')}
            </Btn>
            <Btn variant="primary" icon="zap" onClick={() => navigate('/app/tasi/impact')}>
              {t('nav.tasiImpact')}
            </Btn>
          </>
        }
      />

      <div className="grid grid-2">
        <IndexCard
          index={tasi}
          market="SA"
          extra={
            <div className="stack stack-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s-3)' }}>
              <ContributorRow row={bestContrib} label={t('dash.topPositive')} />
              <ContributorRow row={worstContrib} label={t('dash.topNegative')} />
            </div>
          }
        />
        <IndexCard
          index={spx}
          market="US"
          extra={
            <div className="row row-4 row-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s-3)' }}>
              {[ndx, dji].filter(Boolean).map((ix) => (
                <Metric
                  key={ix!.id}
                  label={L(ix!.name)}
                  value={fmt.num(ix!.level)}
                  size="sm"
                  sub={
                    <span className={(ix!.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                      {fmt.pct(ix!.changePct, { signed: true })}
                    </span>
                  }
                />
              ))}
            </div>
          }
        />
      </div>

      {/* Portfolio summary — the user layer sits alongside the market layer */}
      <Card>
        <CardHead
          title={t('dash.yourPortfolio')}
          icon="wallet"
          right={
            <Btn size="sm" onClick={() => navigate('/app/portfolio')}>
              {t('g.viewAll')}
            </Btn>
          }
        />
        {pf.positions.length === 0 ? (
          <Empty
            icon="wallet"
            title={t('dash.emptyPortfolio')}
            desc={t('dash.emptyPortfolioHint')}
            action={
              <Btn variant="primary" icon="plus" onClick={() => navigate('/app/portfolio')}>
                {t('dash.addPosition')}
              </Btn>
            }
          />
        ) : (
          <div className="card-body">
            <div className="metric-grid">
              <Metric
                label={t('pf.totalValue')}
                value={fmt.money(pf.totalValue, pf.baseCurrency)}
                size="xl"
              />
              <Metric
                label={t('pf.todayPnl')}
                value={fmt.money(pf.todayPnl, pf.baseCurrency, { signed: true })}
                tone={pf.todayPnl >= 0 ? 'up' : 'down'}
              />
              <Metric
                label={t('pf.unrealized')}
                value={fmt.money(pf.unrealised, pf.baseCurrency, { signed: true })}
                tone={pf.unrealised >= 0 ? 'up' : 'down'}
              />
              <Metric
                label={t('pf.realized')}
                value={fmt.money(pf.realised, pf.baseCurrency, { signed: true })}
                tone={pf.realised >= 0 ? 'up' : 'down'}
              />
              <Metric
                label={t('pf.totalReturn')}
                value={fmt.pct(pf.totalReturnPct, { signed: true })}
                tone={(pf.totalReturnPct ?? 0) >= 0 ? 'up' : 'down'}
              />
              <Metric
                label={t('sh.compliant')}
                value={fmt.pct(pf.shariahMix.compliant)}
                sub={`${t('sh.nonCompliant')} ${fmt.pct(pf.shariahMix.non_compliant)}`}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-2">
        <MiniList
          title={t('dash.topImpact')}
          icon="zap"
          to="/app/tasi/impact"
          rows={topImpact}
          metric={(r) => (
            <span className="row row-3">
              <span className="num t-sm muted">{fmt.pct(r.weightPct, { decimals: 2 })}</span>
              <span className={`num t-sm ${(r.todayPoints ?? 0) >= 0 ? 'up' : 'down'}`}>
                {r.todayPoints == null ? DASH : fmt.num(r.todayPoints, { decimals: 1, signed: true })}
              </span>
            </span>
          )}
        />
        <MiniList
          title={t('dash.mostActive')}
          icon="activity"
          to="/app/rankings"
          rows={active}
          metric={(r) => <span className="num t-sm">{fmt.compact(r.turnover)}</span>}
        />
        <MiniList
          title={t('dash.gainers')}
          icon="arrowUp"
          to="/app/rankings"
          rows={gainers}
          metric={(r) => (
            <Badge tone="up">{fmt.pct(r.changePct, { signed: true })}</Badge>
          )}
        />
        <MiniList
          title={t('dash.losers')}
          icon="arrowDown"
          to="/app/rankings"
          rows={losers}
          metric={(r) => (
            <Badge tone="down">{fmt.pct(r.changePct, { signed: true })}</Badge>
          )}
        />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title={t('dash.upcomingEvents')}
            icon="calendar"
            right={
              <Btn size="sm" variant="ghost" onClick={() => navigate('/app/earnings')}>
                {t('g.viewAll')}
              </Btn>
            }
          />
          <div className="card-body tight stack stack-2">
            {events.loading && <Skeleton h={90} />}
            {events.data &&
              [
                ...events.data.upcomingEarn.map((e) => ({
                  id: e.id,
                  date: e.date,
                  symbol: e.symbol,
                  label: `${t('earn.title')} · ${e.period}`,
                })),
                ...events.data.upcomingCa.map((c) => ({
                  id: c.id,
                  date: c.effectiveDate,
                  symbol: c.symbol,
                  label: t(`ca.${c.kind}` as 'ca.split'),
                })),
              ]
                .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1))
                .slice(0, 6)
                .map((e) => (
                  <div key={e.id} className="row row-3" style={{ padding: '5px 0' }}>
                    <span className="num t-xs muted-3" style={{ minWidth: 84 }}>
                      {fmt.date(e.date)}
                    </span>
                    <Link to={`/app/stock/${e.symbol}`} className="sym t-sm">
                      {e.symbol}
                    </Link>
                    <span className="t-sm muted truncate">{e.label}</span>
                  </div>
                ))}
            {events.data &&
              events.data.upcomingCa.length === 0 &&
              events.data.upcomingEarn.length === 0 && <Empty title={t('g.noData')} />}
          </div>
        </Card>

        <Card>
          <CardHead
            title={t('dash.latestNews')}
            icon="news"
            right={
              <Btn size="sm" variant="ghost" onClick={() => navigate('/app/news')}>
                {t('g.viewAll')}
              </Btn>
            }
          />
          <div className="card-body tight stack stack-2">
            {news.loading && <Skeleton h={90} />}
            {news.data?.length === 0 && <Empty title={t('g.noData')} />}
            {news.data?.map((n) => (
              <div key={n.id} className="stack" style={{ gap: 2, padding: '6px 0' }}>
                <span className="t-sm truncate">{L(n.headline)}</span>
                <span className="row row-2 t-xs muted-3">
                  <span>{n.sourceName}</span>
                  <span>·</span>
                  <span>{fmt.relative(n.publishedAt)}</span>
                  <StatusBadge provenance={n.provenance} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {loading && rows.length === 0 && <Skeleton h={200} radius={16} />}

      <Disclaimers shariah />
    </div>
  );
}
