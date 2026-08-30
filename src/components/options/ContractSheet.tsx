import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import {
  Badge,
  Btn,
  Metric,
  Notice,
  NumInput,
  Seg,
  Skeleton,
  StatusBadge,
  Tabs,
  V,
} from '@/components/ui';
import { Define, TermLabel } from './glossary';
import { PayoffChart, LineChart, useChartTheme } from '@/components/charts';
import { analyseContract } from '@/lib/calc/options';
import { evaluateStrategy } from '@/lib/calc/optionStrategies';
import { useContractHistory } from '@/data/options/hooks';
import { isContractWatched, toggleWatchContract, useOptionsStore } from '@/store/options';
import { DASH } from '@/lib/format';
import type { Greeks, OptionContract } from '@/types/options';

type Tab = 'detail' | 'greeks' | 'analysis' | 'pnl' | 'chart';

/* ------------------------------- Greeks -------------------------------- */

export function GreeksPanel({ greeks }: { greeks: Greeks }) {
  const { t } = useI18n();
  const fmt = useFmt();

  const items: Array<{ term: 'delta' | 'gamma' | 'theta' | 'vega' | 'rho'; value: number | null; dp: number }> = [
    { term: 'delta', value: greeks.delta, dp: 4 },
    { term: 'gamma', value: greeks.gamma, dp: 5 },
    { term: 'theta', value: greeks.theta, dp: 4 },
    { term: 'vega', value: greeks.vega, dp: 4 },
    { term: 'rho', value: greeks.rho, dp: 4 },
  ];

  return (
    <div className="stack stack-3">
      <div className="row row-between">
        <span className="eyebrow">{t('opt.greeks')}</span>
        <StatusBadge status={greeks.status} />
      </div>

      <div className="greek-grid">
        {items.map((g) => (
          <div className="greek" key={g.term}>
            <span className="g-name">
              {t(`opt.${g.term}` as 'opt.delta')}
              <Define term={g.term} />
            </span>
            <span
              className={`g-val ${g.value == null ? '' : g.value >= 0 ? '' : 'down'}`}
            >
              <V>{g.value == null ? DASH : fmt.num(g.value, { decimals: g.dp })}</V>
            </span>
          </div>
        ))}
      </div>

      <span className="t-xs muted-3">
        {greeks.status === 'calculated' ? t('opt.fromModel') : t('opt.fromFeed')}
      </span>
    </div>
  );
}

/* ------------------------------- Sheet --------------------------------- */

export function ContractSheet({
  contract,
  spot,
  onClose,
}: {
  contract: OptionContract | null;
  spot: number | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const theme = useChartTheme();
  const [tab, setTab] = useState<Tab>('detail');
  const [contracts, setContracts] = useState<number | null>(1);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  // Subscribing keeps the watch button in sync when the store changes.
  const watched = useOptionsStore((s) => s.watched);
  const history = useContractHistory(contract?.contractSymbol ?? null, 60);

  const analysis = useMemo(
    () => (contract ? analyseContract(contract, spot) : null),
    [contract, spot],
  );

  const strategy = useMemo(() => {
    if (!contract || analysis?.mid == null) return null;
    const qty = (contracts ?? 1) * (side === 'buy' ? 1 : -1);
    return evaluateStrategy(
      [
        {
          id: 'sheet-leg',
          kind: 'option',
          quantity: qty,
          right: contract.right,
          strike: contract.strike,
          expiry: contract.expiry,
          price: analysis.mid,
          multiplier: contract.multiplier,
          contractSymbol: contract.contractSymbol,
        },
      ],
      {
        strategyId: contract.right === 'call' ? 'long_call' : 'long_put',
        spot,
        ivPct: contract.impliedVolatilityPct,
      },
    );
  }, [contract, analysis, contracts, side, spot]);

  if (!contract) return null;

  const isWatched = watched.some((w) => w.contractSymbol === contract.contractSymbol);
  const intrinsic = analysis?.intrinsicValue ?? 0;
  const extrinsic = analysis?.extrinsicValue ?? 0;
  const totalValue = intrinsic + extrinsic;

  const anchor = spot ?? contract.strike;
  const chartMin = Math.max(0, anchor * 0.6);
  const chartMax = anchor * 1.45;

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="row row-3 row-wrap">
          <span className="sym">{contract.underlying}</span>
          <span className="num">{fmt.num(contract.strike)}</span>
          <Badge tone={contract.right === 'call' ? 'brand' : 'violet'}>
            {contract.right === 'call' ? t('opt.calls') : t('opt.puts')}
          </Badge>
          {analysis?.moneyness && (
            <Badge tone={analysis.moneyness === 'ITM' ? 'up' : analysis.moneyness === 'ATM' ? 'gold' : 'neutral'}>
              {t(`opt.${analysis.moneyness.toLowerCase()}` as 'opt.itm')}
            </Badge>
          )}
        </span>
      }
      subtitle={
        <span className="row row-2 row-wrap">
          <span className="mono">{contract.contractSymbol}</span>
          <span>·</span>
          <span>{fmt.date(contract.expiry)}</span>
          <span>·</span>
          <span className="num">
            {contract.dte} {t('opt.dte')}
          </span>
        </span>
      }
      footer={
        <>
          <Btn
            icon={isWatched ? 'check' : 'eye'}
            variant={isWatched ? 'default' : 'ghost'}
            onClick={() =>
              toggleWatchContract({
                contractSymbol: contract.contractSymbol,
                underlying: contract.underlying,
                right: contract.right,
                strike: contract.strike,
                expiry: contract.expiry,
              })
            }
          >
            {isWatched ? t('opt.inWatch') : t('opt.addWatch')}
          </Btn>
          <StatusBadge provenance={contract.provenance} />
        </>
      }
    >
      <div className="stack stack-4">
        {/* headline quote */}
        <div className="metric-grid">
          <Metric
            label={t('opt.mid')}
            value={<V>{analysis?.mid == null ? DASH : fmt.num(analysis.mid)}</V>}
            size="xl"
            status="calculated"
          />
          <Metric label={t('opt.bid')} value={<V>{fmt.num(contract.bid)}</V>} />
          <Metric label={t('opt.ask')} value={<V>{fmt.num(contract.ask)}</V>} />
          <Metric
            label={t('opt.last')}
            value={<V>{fmt.num(contract.last)}</V>}
            sub={
              contract.changePct == null ? undefined : (
                <span className={contract.changePct >= 0 ? 'up' : 'down'}>
                  {fmt.pct(contract.changePct, { signed: true })}
                </span>
              )
            }
          />
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'detail', label: t('opt.contract') },
            { value: 'greeks', label: t('opt.greeks') },
            { value: 'analysis', label: t('opt.analysis') },
            { value: 'pnl', label: t('opt.pnl') },
            { value: 'chart', label: t('opt.chartPrice') },
          ]}
        />

        {tab === 'detail' && (
          <div className="metric-grid">
            <Metric label={t('opt.contractSymbol')} value={<span className="mono t-sm">{contract.contractSymbol}</span>} size="sm" />
            <Metric label={t('opt.underlying')} value={contract.underlying} size="sm" />
            <Metric label={t('opt.right')} value={contract.right === 'call' ? t('opt.calls') : t('opt.puts')} size="sm" />
            <Metric label={<TermLabel term="strike" />} value={fmt.num(contract.strike)} size="sm" />
            <Metric label={t('opt.expiry')} value={fmt.date(contract.expiry)} size="sm" />
            <Metric label={t('opt.dteLong')} value={fmt.int(contract.dte)} size="sm" />
            <Metric label={t('opt.spread')} value={<V>{fmt.num(analysis?.spread ?? null)}</V>} size="sm" sub={analysis?.spreadPct == null ? undefined : fmt.pct(analysis.spreadPct)} />
            <Metric label={<TermLabel term="volume" />} value={<V>{fmt.int(contract.volume)}</V>} size="sm" />
            <Metric label={<TermLabel term="oi" />} value={<V>{fmt.int(contract.openInterest)}</V>} size="sm" />
            <Metric label={<TermLabel term="volOi" />} value={<V>{analysis?.volumeOiRatio == null ? DASH : fmt.num(analysis.volumeOiRatio, { decimals: 2 })}</V>} size="sm" status="calculated" />
            <Metric label={<TermLabel term="iv" />} value={<V>{contract.impliedVolatilityPct == null ? DASH : fmt.pct(contract.impliedVolatilityPct)}</V>} size="sm" />
            <Metric label={<TermLabel term="multiplier" />} value={fmt.int(contract.multiplier)} size="sm" />
            <Metric label={t('opt.contractSize')} value={`${fmt.int(contract.multiplier)} ${t('g.shares')}`} size="sm" />
            <Metric label={t('opt.style')} value={t(`opt.${contract.style}` as 'opt.american')} size="sm" />
            <Metric label={t('opt.premiumPerContract')} value={<V>{analysis?.premiumPerContract == null ? DASH : fmt.money(analysis.premiumPerContract, contract.currency)}</V>} size="sm" status="calculated" />
            <Metric label={t('opt.spot')} value={<V>{fmt.num(spot)}</V>} size="sm" />
          </div>
        )}

        {tab === 'greeks' && (
          <div className="stack stack-4">
            <GreeksPanel greeks={contract.greeks} />
            <Notice tone="info">{t('opt.modelNote')}</Notice>
          </div>
        )}

        {tab === 'analysis' && analysis && (
          <div className="stack stack-4">
            <div className="metric-grid">
              <Metric label={<TermLabel term="intrinsic" />} value={<V>{fmt.num(analysis.intrinsicValue)}</V>} status="calculated" />
              <Metric label={<TermLabel term="extrinsic" />} value={<V>{fmt.num(analysis.extrinsicValue)}</V>} status="calculated" />
              <Metric label={<TermLabel term="breakEven" />} value={<V>{fmt.num(analysis.breakEven)}</V>} status="calculated" />
              <Metric label={<TermLabel term="probItm" />} value={<V>{analysis.probabilityItm == null ? DASH : fmt.pct(analysis.probabilityItm, { decimals: 1 })}</V>} status="calculated" />
            </div>

            {totalValue > 0 && (
              <div className="stack stack-2">
                <span className="eyebrow">{t('opt.valueSplit')}</span>
                <div className="mny-bar">
                  {intrinsic > 0 && (
                    <div
                      className="mny-intrinsic"
                      style={{ flex: intrinsic }}
                      title={t('opt.intrinsic')}
                    >
                      {intrinsic / totalValue > 0.16 ? fmt.num(intrinsic) : ''}
                    </div>
                  )}
                  {extrinsic > 0 && (
                    <div
                      className="mny-extrinsic"
                      style={{ flex: extrinsic }}
                      title={t('opt.extrinsic')}
                    >
                      {extrinsic / totalValue > 0.16 ? fmt.num(extrinsic) : ''}
                    </div>
                  )}
                </div>
                <div className="legend">
                  <span className="k">
                    <i className="sw" style={{ background: 'var(--bm-brand-strong)' }} />
                    {t('opt.intrinsic')}
                  </span>
                  <span className="k">
                    <i className="sw" style={{ background: 'var(--bm-violet)' }} />
                    {t('opt.extrinsic')}
                  </span>
                </div>
              </div>
            )}

            <code className="mono t-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-3)', lineHeight: 1.8 }}>
              {analysis.formula}
            </code>
          </div>
        )}

        {tab === 'pnl' && strategy && (
          <div className="stack stack-4">
            <div className="row row-3 row-wrap">
              <Seg
                value={side}
                onChange={setSide}
                options={[
                  { value: 'buy', label: contract.right === 'call' ? t('opt.buyCall') : t('opt.buyPut') },
                  { value: 'sell', label: contract.right === 'call' ? t('opt.sellCall') : t('opt.sellPut') },
                ]}
              />
              <div style={{ width: 120 }}>
                <NumInput value={contracts} onChange={setContracts} min={1} step={1} suffix={t('opt.contracts')} />
              </div>
            </div>

            <div className="metric-grid">
              <Metric
                label={t('opt.maxProfit')}
                value={
                  strategy.maxProfitUnlimited ? (
                    <span className="up">{t('opt.unlimited')}</span>
                  ) : (
                    <span className="up">{fmt.money(strategy.maxProfit, contract.currency)}</span>
                  )
                }
                status="calculated"
              />
              <Metric
                label={t('opt.maxLoss')}
                value={
                  strategy.maxLossUnlimited ? (
                    <span className="down">{t('opt.unlimited')}</span>
                  ) : (
                    <span className="down">{fmt.money(strategy.maxLoss, contract.currency)}</span>
                  )
                }
                status="calculated"
              />
              <Metric
                label={t('opt.breakEven')}
                value={
                  strategy.breakEvens.length === 0 ? (
                    <span className="unavailable">{DASH}</span>
                  ) : (
                    strategy.breakEvens.map((b) => fmt.num(b)).join(' · ')
                  )
                }
                status="calculated"
              />
              <Metric
                label={t('opt.netPremium')}
                value={
                  <span className={(strategy.netPremium ?? 0) >= 0 ? 'up' : 'down'}>
                    {fmt.money(strategy.netPremium, contract.currency, { signed: true })}
                  </span>
                }
                sub={(strategy.netPremium ?? 0) >= 0 ? t('opt.credit') : t('opt.debit')}
              />
            </div>

            <PayoffChart
              minPrice={chartMin}
              maxPrice={chartMax}
              profitAt={(p) =>
                strategy.legs.reduce((sum, l) => {
                  if (l.strike == null || l.right == null) return sum;
                  const intr =
                    l.right === 'call' ? Math.max(0, p - l.strike) : Math.max(0, l.strike - p);
                  return sum + l.quantity * l.multiplier * (intr - (l.price ?? 0));
                }, 0)
              }
              breakEven={strategy.breakEvens[0] ?? null}
              currentPrice={spot}
              targetPrice={null}
              formatMoney={(v) => fmt.compact(v)}
              formatPrice={(v) => fmt.num(v)}
            />

            <div className="legend">
              <span className="k">
                <i className="sw" style={{ background: theme.up, opacity: 0.4 }} />
                {t('pnl.profitZone')}
              </span>
              <span className="k">
                <i className="sw" style={{ background: theme.down, opacity: 0.4 }} />
                {t('pnl.lossZone')}
              </span>
            </div>

            <Notice tone="warn" icon="warning">
              {t('opt.disclaimer')}
            </Notice>
          </div>
        )}

        {tab === 'chart' && (
          <div className="stack stack-3">
            {history.loading && <Skeleton h={220} />}
            {history.data && history.data.length > 1 ? (
              <LineChart
                height={240}
                series={[
                  {
                    key: contract.contractSymbol,
                    name: t('opt.chartPrice'),
                    points: history.data.map((c) => ({ t: c.t, v: c.c })),
                  },
                ]}
                formatValue={(v) => fmt.num(v)}
                formatLabel={(x) => fmt.date(x)}
              />
            ) : (
              !history.loading && <span className="unavailable">{t('g.unavailable')}</span>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export { isContractWatched };
