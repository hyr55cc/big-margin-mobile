import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Empty,
  Field,
  IconBtn,
  Metric,
  Notice,
  NumInput,
  Seg,
  Select,
  V,
} from '@/components/ui';
import { PayoffChart, useChartTheme } from '@/components/charts';
import {
  buildTemplateLegs,
  evaluateStrategy,
  makeLeg,
  payoffAtExpiry,
  STRATEGY_TEMPLATES,
} from '@/lib/calc/optionStrategies';
import { midPrice } from '@/lib/calc/options';
import { DASH } from '@/lib/format';
import type { Currency } from '@/types';
import type { OptionChain, StrategyId, StrategyLeg } from '@/types/options';

type Outlook = 'all' | 'bullish' | 'bearish' | 'neutral' | 'volatile';

/**
 * Legs in, risk out. The same evaluator prices every template and any custom
 * combination, so a hand-built position is analysed exactly as rigorously as
 * a named one.
 */
export function StrategyBuilder({
  chain,
  spot,
  currency = 'USD',
  ivPct,
}: {
  chain: OptionChain | null;
  spot: number | null;
  currency?: Currency;
  ivPct?: number | null;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const theme = useChartTheme();

  const [strategyId, setStrategyId] = useState<StrategyId>('long_call');
  const [outlook, setOutlook] = useState<Outlook>('all');
  const [legs, setLegs] = useState<StrategyLeg[]>([]);

  const expiry = chain?.expiry ?? null;

  /**
   * Premiums are quotes, never guesses: a leg's price comes from the chain's
   * mid for that exact strike, and stays empty when the chain has no quote.
   */
  const priceFromChain = useMemo(
    () => (right: 'call' | 'put', strike: number): number | null => {
      if (!chain) return null;
      const row = chain.rows.find((r) => Math.abs(r.strike - strike) < 1e-6);
      const contract = right === 'call' ? row?.call : row?.put;
      return contract ? midPrice(contract) : null;
    },
    [chain],
  );

  const applyTemplate = useMemo(
    () => (id: StrategyId) => {
      if (spot == null || !expiry) {
        setLegs([]);
        return;
      }
      const built = buildTemplateLegs(id, spot, expiry).map((l) =>
        l.kind === 'option' && l.right && l.strike != null
          ? { ...l, price: priceFromChain(l.right, l.strike) }
          : l,
      );
      setLegs(built);
    },
    [spot, expiry, priceFromChain],
  );

  useEffect(() => {
    applyTemplate(strategyId);
  }, [strategyId, applyTemplate]);

  const result = useMemo(
    () => evaluateStrategy(legs, { strategyId, spot, ivPct: ivPct ?? null }),
    [legs, strategyId, spot, ivPct],
  );

  const patch = (id: string, next: Partial<StrategyLeg>) =>
    setLegs((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...next };
        // Re-quote the leg whenever its strike or right changes.
        if (
          merged.kind === 'option' &&
          merged.right &&
          merged.strike != null &&
          (next.strike !== undefined || next.right !== undefined)
        ) {
          merged.price = priceFromChain(merged.right, merged.strike);
        }
        return merged;
      }),
    );

  const templates = STRATEGY_TEMPLATES.filter(
    (s) => outlook === 'all' || s.outlook === outlook,
  );

  const anchor = spot ?? 100;
  const strikes = legs.map((l) => l.strike).filter((k): k is number => k != null);
  const lo = Math.max(0, Math.min(anchor * 0.6, ...(strikes.length ? strikes : [anchor])) * 0.9);
  const hi = Math.max(anchor * 1.4, ...(strikes.length ? strikes : [anchor])) * 1.15;

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead
          title={t('opt.strategies')}
          sub={t('opt.strategiesSub')}
          icon="layers"
          right={
            <Seg
              value={outlook}
              onChange={setOutlook}
              options={[
                { value: 'all', label: t('g.all') },
                { value: 'bullish', label: t('opt.outlookBullish') },
                { value: 'bearish', label: t('opt.outlookBearish') },
                { value: 'neutral', label: t('opt.outlookNeutral') },
                { value: 'volatile', label: t('opt.outlookVolatile') },
              ]}
            />
          }
        />
        <div className="card-body">
          <div className="grid grid-4">
            {templates.map((s) => (
              <Card
                key={s.id}
                className="card-pad"
                onClick={() => setStrategyId(s.id)}
                style={
                  strategyId === s.id
                    ? { borderColor: 'var(--bm-brand)', background: 'var(--bm-brand-soft)' }
                    : undefined
                }
              >
                <div className="stack" style={{ gap: 5 }}>
                  <span className="h-card">{t(`opt.s.${s.id}` as 'opt.s.long_call')}</span>
                  <span className="row row-2">
                    <Badge tone={s.credit ? 'up' : 'neutral'}>
                      {s.credit ? t('opt.credit') : t('opt.debit')}
                    </Badge>
                    <span className="t-xs muted-3">
                      {s.legCount} {t('opt.legs')}
                    </span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title={t('opt.legs')}
          right={
            <>
              <Btn
                size="sm"
                icon="plus"
                onClick={() =>
                  setLegs((prev) => [
                    ...prev,
                    makeLeg({
                      right: 'call',
                      strike: spot != null ? Math.round(spot) : null,
                      expiry,
                      quantity: 1,
                    }),
                  ])
                }
              >
                {t('opt.addLeg')}
              </Btn>
              <Btn size="sm" icon="refresh" onClick={() => applyTemplate(strategyId)}>
                {t('g.reset')}
              </Btn>
            </>
          }
        />
        <div className="card-body stack stack-3">
          {legs.length === 0 ? (
            <Empty icon="layers" title={t('opt.selectExpiry')} desc={t('opt.strategiesSub')} />
          ) : (
            legs.map((l) => (
              <div key={l.id} className="leg-row">
                <span className={`leg-badge ${l.quantity >= 0 ? 'leg-long' : 'leg-short'}`}>
                  {l.quantity >= 0 ? t('opt.long') : t('opt.short')}
                </span>

                <div style={{ width: 92 }}>
                  <Field label={t('opt.quantity')}>
                    <NumInput
                      value={l.quantity}
                      onChange={(v) => patch(l.id, { quantity: v ?? 0 })}
                      step={1}
                    />
                  </Field>
                </div>

                {l.kind === 'option' ? (
                  <>
                    <div style={{ width: 118 }}>
                      <Field label={t('opt.right')}>
                        <Select
                          value={l.right ?? 'call'}
                          onChange={(v) => patch(l.id, { right: v })}
                          options={[
                            { value: 'call' as const, label: t('opt.calls') },
                            { value: 'put' as const, label: t('opt.puts') },
                          ]}
                        />
                      </Field>
                    </div>
                    <div style={{ width: 110 }}>
                      <Field label={t('opt.strike')}>
                        <NumInput
                          value={l.strike}
                          onChange={(v) => patch(l.id, { strike: v })}
                          step={1}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <span className="badge badge-neutral">{t('opt.stockLeg')}</span>
                )}

                <div style={{ width: 110 }}>
                  <Field label={t('opt.premium')}>
                    <NumInput
                      value={l.price}
                      onChange={(v) => patch(l.id, { price: v })}
                      step={0.05}
                    />
                  </Field>
                </div>

                <IconBtn
                  icon="trash"
                  title={t('g.remove')}
                  onClick={() => setLegs((prev) => prev.filter((x) => x.id !== l.id))}
                />
              </div>
            ))
          )}

          {legs.some((l) => l.kind === 'option' && l.price == null) && (
            <Notice tone="warn" icon="warning">
              {t('opt.needPremiums')}
            </Notice>
          )}
        </div>
      </Card>

      {result.status === 'calculated' && (
        <>
          <div className="grid grid-4">
            <Card className="card-pad">
              <Metric
                label={t('opt.maxProfit')}
                value={
                  result.maxProfitUnlimited ? (
                    <span className="up">{t('opt.unlimited')}</span>
                  ) : (
                    <span className="up">{fmt.money(result.maxProfit, currency)}</span>
                  )
                }
                size="xl"
                status="calculated"
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('opt.maxLoss')}
                value={
                  result.maxLossUnlimited ? (
                    <span className="down">{t('opt.unlimited')}</span>
                  ) : (
                    <span className="down">{fmt.money(result.maxLoss, currency)}</span>
                  )
                }
                size="xl"
                status="calculated"
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('opt.breakEven')}
                value={
                  result.breakEvens.length === 0 ? (
                    <span className="unavailable">{DASH}</span>
                  ) : (
                    <span className="num">
                      {result.breakEvens.map((b) => fmt.num(b)).join(' · ')}
                    </span>
                  )
                }
                size="md"
                status="calculated"
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('opt.requiredCapital')}
                value={<V>{fmt.money(result.requiredCapital, currency)}</V>}
                size="xl"
                sub={
                  result.riskRewardRatio == null
                    ? undefined
                    : `${t('opt.riskReward')} ${fmt.num(result.riskRewardRatio, { decimals: 2 })}`
                }
                status="calculated"
              />
            </Card>
          </div>

          <Card>
            <CardHead
              title={t('opt.payoff')}
              right={
                <span className="row row-3">
                  <span className="t-xs muted-3">
                    {t('opt.netPremium')}{' '}
                    {result.netPremium == null ? (
                      <span className="unavailable">{DASH}</span>
                    ) : (
                      <span className={`num ${result.netPremium >= 0 ? 'up' : 'down'}`}>
                        {fmt.money(result.netPremium, currency, { signed: true })}
                      </span>
                    )}
                  </span>
                  {result.netPremium != null && (
                    <Badge tone={result.netPremium >= 0 ? 'up' : 'neutral'}>
                      {result.netPremium >= 0 ? t('opt.credit') : t('opt.debit')}
                    </Badge>
                  )}
                </span>
              }
            />
            <div className="card-body stack stack-3">
              <PayoffChart
                minPrice={lo}
                maxPrice={hi}
                profitAt={(p) => payoffAtExpiry(legs, p)}
                breakEven={result.breakEvens[0] ?? null}
                currentPrice={spot}
                targetPrice={result.breakEvens[1] ?? null}
                formatMoney={(v) => fmt.compact(v)}
                formatPrice={(v) => fmt.num(v)}
                height={300}
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
                <span className="k">BE — {t('opt.breakEven')}</span>
                <span className="k">● {t('opt.spot')}</span>
              </div>

              {(result.netDelta != null || result.netTheta != null) && (
                <div className="metric-grid" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s-3)' }}>
                  <Metric label={t('opt.netDelta')} value={<V>{fmt.num(result.netDelta, { decimals: 2 })}</V>} size="sm" status="calculated" />
                  <Metric label={t('opt.netTheta')} value={<V>{fmt.num(result.netTheta, { decimals: 2 })}</V>} size="sm" status="calculated" />
                  <Metric label={t('opt.netVega')} value={<V>{fmt.num(result.netVega, { decimals: 2 })}</V>} size="sm" status="calculated" />
                </div>
              )}
            </div>
            <div className="card-foot">
              <code className="mono t-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-3)', lineHeight: 1.8 }}>
                {result.formula}
              </code>
            </div>
          </Card>

          <Notice tone="warn" icon="warning">
            {t('opt.disclaimer')}
          </Notice>
        </>
      )}
    </div>
  );
}
