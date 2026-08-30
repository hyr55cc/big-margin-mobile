import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Empty,
  Metric,
  Notice,
  Skeleton,
  StatusBadge,
  Tabs,
  V,
} from '@/components/ui';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import { useMarket } from '@/data/MarketContext';
import {
  useChain,
  useExpiries,
  useIvStats,
  useOptionsAvailable,
  useOptionsFlow,
  useOptionsMeta,
  useUnusualActivity,
} from '@/data/options/hooks';
import {
  removeExpiredContracts,
  toggleWatchContract,
  useOptionsStore,
} from '@/store/options';
import { DASH } from '@/lib/format';
import { ExpiryRail } from './ExpiryRail';
import { OptionsChain } from './OptionsChain';
import { ContractSheet } from './ContractSheet';
import { ChainCharts } from './ChainCharts';
import { FlowPanel, UnusualPanel } from './FlowPanels';
import { StrategyBuilder } from './StrategyBuilder';
import { ChainFiltersBar, SideSwitch } from './ChainFiltersBar';
import { Define } from './glossary';
import { DEFAULT_CHAIN_FILTERS, type ChainFilters, type OptionContract } from '@/types/options';
import type { Currency } from '@/types';

type Sub = 'chain' | 'charts' | 'flow' | 'unusual' | 'strategies' | 'watch';

/**
 * The whole options feature for one underlying, composed from the pieces so
 * the stock profile's tab and the standalone page render the same thing.
 *
 * Nothing here fabricates a contract: when the provider is off, or the
 * underlying has no series, or an expiry returns nothing, the screen says so
 * rather than showing an empty ladder that reads like a real quiet market.
 */
export function OptionsPanel({
  symbol,
  spot,
  currency = 'USD',
  hasOptionsMarket,
}: {
  symbol: string;
  spot: number | null;
  currency?: Currency;
  /** False for instruments whose market lists no retail options (e.g. Tadawul). */
  hasOptionsMarket: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { statuses } = useMarket();
  const meta = useOptionsMeta();

  const enabled = meta.enabled && hasOptionsMarket;
  const availability = useOptionsAvailable(enabled ? symbol : undefined);
  const expiries = useExpiries(enabled && availability.available ? symbol : undefined);

  const [expiry, setExpiry] = useState<string | null>(null);
  const [side, setSide] = useState<'call' | 'put' | 'both'>('both');
  const [filters, setFilters] = useState<ChainFilters>(DEFAULT_CHAIN_FILTERS);
  const [extendedGreeks, setExtendedGreeks] = useState(false);
  const [sub, setSub] = useState<Sub>('chain');
  const [open, setOpen] = useState<OptionContract | null>(null);

  // The nearest listed expiry is what a chain screen opens on; anything else
  // makes the user choose before they can see a single quote.
  useEffect(() => {
    setExpiry(null);
  }, [symbol]);
  useEffect(() => {
    if (expiry == null && expiries.data && expiries.data.length > 0) {
      setExpiry(expiries.data[0].date);
    }
  }, [expiries.data, expiry]);

  const { chain, summary, loading: chainLoading, error: chainError, reload } = useChain(
    enabled ? symbol : undefined,
    expiry,
  );
  const flow = useOptionsFlow(enabled && sub === 'flow' ? symbol : undefined);
  const unusual = useUnusualActivity(enabled && sub === 'unusual' ? symbol : undefined);
  const ivStats = useIvStats(enabled ? symbol : undefined);

  const watched = useOptionsStore((s) => s.watched);
  const mine = useMemo(
    () => watched.filter((w) => w.underlying === symbol),
    [watched, symbol],
  );
  const expired = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return watched.filter((w) => w.expiry < today);
  }, [watched]);

  const underlyingSpot = chain?.underlyingPrice ?? spot;

  /* --------------------------- unavailable paths -------------------------- */

  if (!hasOptionsMarket) {
    return (
      <Card>
        <CardHead title={t('opt.title')} icon="layers" />
        <Empty icon="layers" title={t('opt.noOptions')} desc={t('opt.usOnly')} />
      </Card>
    );
  }

  if (!meta.enabled) {
    return (
      <Card>
        <CardHead title={t('opt.title')} icon="layers" />
        <Empty icon="layers" title={t('opt.providerOff')} desc={t('opt.providerOffHint')} />
      </Card>
    );
  }

  if (availability.loading || (expiries.loading && !expiries.data)) {
    return (
      <div className="stack stack-4">
        <Skeleton h={72} radius={16} />
        <Skeleton h={420} radius={16} />
      </div>
    );
  }

  if (!availability.available) {
    return (
      <Card>
        <CardHead title={t('opt.title')} icon="layers" />
        <Empty icon="layers" title={t('opt.noOptions')} desc={t('opt.noOptionsHint')} />
      </Card>
    );
  }

  const usStatus = statuses.US;
  const marketClosed = usStatus != null && usStatus.session !== 'open';

  const SUBS: Array<{ value: Sub; label: string }> = [
    { value: 'chain', label: t('opt.chain') },
    { value: 'charts', label: t('opt.charts') },
    ...(meta.capabilities?.flow ? [{ value: 'flow' as Sub, label: t('opt.flow') }] : []),
    ...(meta.capabilities?.unusualActivity
      ? [{ value: 'unusual' as Sub, label: t('opt.unusual') }]
      : []),
    { value: 'strategies', label: t('opt.strategies') },
    { value: 'watch', label: `${t('opt.watchlist')}${mine.length ? ` (${mine.length})` : ''}` },
  ];

  return (
    <div className="stack stack-4">
      {meta.isDemo && <Notice tone="warn">{t('opt.demoNotice')}</Notice>}

      {/* ------------------------- underlying strip ------------------------ */}
      <Card>
        <div className="card-body opt-head">
          <div className="stack" style={{ gap: 2 }}>
            <div className="t-xs muted-3">{t('opt.underlyingPrice')}</div>
            <div className="row row-2">
              <V>{underlyingSpot == null ? DASH : fmt.money(underlyingSpot, currency)}</V>
              <span className="sym">{symbol}</span>
            </div>
          </div>

          <MarketStatusPill status={usStatus} />

          {ivStats.data && (
            <>
              <Metric
                label={
                  <span className="row row-2">
                    {t('opt.ivRank')}
                    <Define term="ivRank" />
                  </span>
                }
                value={ivStats.data.ivRank == null ? DASH : fmt.num(ivStats.data.ivRank, { decimals: 0 })}
                sub={
                  ivStats.data.currentIvPct == null
                    ? undefined
                    : `${t('opt.iv')} ${fmt.pct(ivStats.data.currentIvPct, { decimals: 1 })}`
                }
              />
              <Metric
                label={t('opt.ivPercentile')}
                value={
                  ivStats.data.ivPercentile == null
                    ? DASH
                    : fmt.num(ivStats.data.ivPercentile, { decimals: 0 })
                }
                sub={
                  ivStats.data.historicalVolatilityPct == null
                    ? undefined
                    : `${t('opt.hv')} ${fmt.pct(ivStats.data.historicalVolatilityPct, { decimals: 1 })}`
                }
              />
            </>
          )}

          <span className="spacer" />
          {chain && <StatusBadge provenance={chain.provenance} />}
        </div>
      </Card>

      {marketClosed && <Notice tone="info">{t('opt.marketClosedNote')}</Notice>}

      {/* --------------------------- expiry rail -------------------------- */}
      <ExpiryRail
        expiries={expiries.data ?? []}
        selected={expiry}
        onSelect={setExpiry}
        loading={expiries.loading}
      />

      <Tabs value={sub} onChange={setSub} options={SUBS} />

      {chainError && sub !== 'watch' && (
        <Notice tone="warn">
          <div className="row row-3 row-wrap">
            <span>{t('g.unavailable')}</span>
            <Btn size="sm" variant="ghost" onClick={reload}>
              {t('g.reset')}
            </Btn>
          </div>
        </Notice>
      )}

      {/* ------------------------------ chain ----------------------------- */}
      {sub === 'chain' && (
        <Card>
          <CardHead
            title={t('opt.chain')}
            sub={
              expiry
                ? `${fmt.date(expiry)}${chain ? ` · ${chain.dte} ${t('opt.dte')}` : ''}`
                : t('opt.selectExpiry')
            }
            icon="layers"
            right={<SideSwitch value={side} onChange={setSide} />}
          />
          <OptionsChain
            chain={chain}
            filters={filters}
            side={side}
            showExtendedGreeks={extendedGreeks}
            loading={chainLoading}
            onOpenContract={setOpen}
          />
          <details className="opt-disclosure">
            <summary>{t('opt.filters')}</summary>
            <ChainFiltersBar
              filters={filters}
              onChange={setFilters}
              showExtendedGreeks={extendedGreeks}
              onToggleExtendedGreeks={setExtendedGreeks}
            />
          </details>
          <div className="card-foot">{t('opt.modelNote')}</div>
        </Card>
      )}

      {/* ------------------------------ charts ---------------------------- */}
      {sub === 'charts' &&
        (chainLoading ? (
          <Skeleton h={380} radius={16} />
        ) : chain ? (
          <ChainCharts chain={chain} summary={summary} />
        ) : (
          <Card>
            <Empty icon="activity" title={t('g.unavailable')} desc={t('opt.selectExpiry')} />
          </Card>
        ))}

      {sub === 'flow' && (
        <FlowPanel trades={flow.data} loading={flow.loading} />
      )}

      {sub === 'unusual' && (
        <UnusualPanel items={unusual.data} loading={unusual.loading} onOpenContract={setOpen} />
      )}

      {sub === 'strategies' && (
        <StrategyBuilder
          chain={chain}
          spot={underlyingSpot}
          currency={currency}
          ivPct={ivStats.data?.currentIvPct ?? null}
        />
      )}

      {/* ---------------------------- watchlist --------------------------- */}
      {sub === 'watch' && (
        <Card>
          <CardHead
            title={t('opt.watchlist')}
            icon="star"
            right={
              expired.length > 0 ? (
                <Btn size="sm" variant="ghost" onClick={() => removeExpiredContracts()}>
                  {t('opt.clearExpired')}
                </Btn>
              ) : null
            }
          />
          {expired.length > 0 && (
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <Notice tone="warn">
                {fmt.int(expired.length)} {t('opt.expiredWatched')}
              </Notice>
            </div>
          )}
          {watched.length === 0 ? (
            <Empty icon="star" title={t('opt.watchEmpty')} desc={t('opt.watchEmptyHint')} />
          ) : (
            <div className="card-body stack stack-2">
              {watched.map((w) => (
                <div key={w.contractSymbol} className="row row-3 leg-row">
                  <span className="sym">{w.underlying}</span>
                  <span className="num">{fmt.num(w.strike)}</span>
                  <Badge tone={w.right === 'call' ? 'brand' : 'violet'}>
                    {w.right === 'call' ? t('opt.calls') : t('opt.puts')}
                  </Badge>
                  <span className="num t-sm muted">{fmt.date(w.expiry)}</span>
                  <span className="spacer" />
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon="close"
                    onClick={() => toggleWatchContract(w)}
                    title={t('g.remove')}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <ContractSheet contract={open} spot={underlyingSpot} onClose={() => setOpen(null)} />

      <Notice tone="info">{t('opt.shariahNote')}</Notice>
      <Notice tone="warn">{t('opt.disclaimer')}</Notice>
    </div>
  );
}
