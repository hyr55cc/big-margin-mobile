import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
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
  Slider,
  Tabs,
  V,
} from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { PayoffChart, useChartTheme } from '@/components/charts';
import { ScenarioBuilder } from './TasiImpact';
import { CALCULATORS } from './Calculators';
import {
  averageCost,
  breakEven,
  profitLoss,
  simulateAveraging,
  targetPrice,
  targetReturn,
  totalReturn,
  type BuyLot,
} from '@/lib/calc/position';
import { allocateCapital, dividendIncome, PERIODS_PER_YEAR } from '@/lib/calc/income';
import { DASH } from '@/lib/format';
import type { Currency } from '@/types';

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function FormulaFoot({ formula, computedAt }: { formula: string; computedAt?: string }) {
  const { t } = useI18n();
  const fmt = useFmt();
  return (
    <div className="card-foot">
      <div className="stack stack-2">
        <code
          className="mono t-xs"
          style={{ whiteSpace: 'pre-wrap', color: 'var(--text-2)', lineHeight: 1.7 }}
        >
          {formula}
        </code>
        {computedAt && (
          <span className="t-xs muted-3">
            {t('g.computedAt')}: <span className="num">{fmt.dateTime(computedAt)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Optional link to a real instrument so calculators inherit live figures. */
function SymbolLinker({
  row,
  onPick,
  onClear,
}: {
  row: MarketRow | null;
  onPick: (r: MarketRow) => void;
  onClear: () => void;
}) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  if (row) {
    return (
      <div className="row row-3 row-wrap">
        <span className="sym">{row.symbol}</span>
        <span className="truncate" style={{ flex: 1 }}>
          {L(row.instrument.shortName)}
        </span>
        <span className="num">{fmt.num(row.price)}</span>
        <Badge tone={(row.changePct ?? 0) >= 0 ? 'up' : 'down'}>
          {fmt.pct(row.changePct, { signed: true })}
        </Badge>
        <IconBtn icon="close" title={t('g.clear')} onClick={onClear} />
      </div>
    );
  }
  return <InstrumentPicker onPick={onPick} placeholder={t('g.search')} />;
}

/* ------------------------------------------------------------------ */
/* Average cost                                                        */
/* ------------------------------------------------------------------ */

interface LotRow extends BuyLot {
  id: string;
}

function AverageCostTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [lots, setLots] = useState<LotRow[]>([
    { id: 'l1', price: 0, quantity: 0, commission: 0, fees: 0, otherCosts: 0 },
  ]);

  const result = useMemo(() => averageCost(lots), [lots]);

  const patch = (id: string, next: Partial<LotRow>) =>
    setLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead
          title={t('ac.transactions')}
          icon="calculator"
          right={
            <Btn
              size="sm"
              icon="plus"
              onClick={() =>
                setLots((prev) => [
                  ...prev,
                  {
                    id: `l${Date.now()}`,
                    price: 0,
                    quantity: 0,
                    commission: 0,
                    fees: 0,
                    otherCosts: 0,
                  },
                ])
              }
            >
              {t('ac.addRow')}
            </Btn>
          }
        />
        <div className="card-body stack stack-3">
          {lots.map((l, i) => (
            <div key={l.id} className="row row-3 row-wrap">
              <span className="rank-cell num">{i + 1}</span>
              <div style={{ minWidth: 120, flex: 1 }}>
                <Field label={t('ac.buyPrice')}>
                  <NumInput value={l.price} onChange={(v) => patch(l.id, { price: v ?? 0 })} step={0.05} min={0} />
                </Field>
              </div>
              <div style={{ minWidth: 110, flex: 1 }}>
                <Field label={t('g.quantity')}>
                  <NumInput value={l.quantity} onChange={(v) => patch(l.id, { quantity: v ?? 0 })} min={0} />
                </Field>
              </div>
              <div style={{ minWidth: 100 }}>
                <Field label={t('pf.commission')}>
                  <NumInput value={l.commission ?? 0} onChange={(v) => patch(l.id, { commission: v ?? 0 })} min={0} />
                </Field>
              </div>
              <div style={{ minWidth: 100 }}>
                <Field label={t('pf.fees')}>
                  <NumInput value={l.fees ?? 0} onChange={(v) => patch(l.id, { fees: v ?? 0 })} min={0} />
                </Field>
              </div>
              <div style={{ minWidth: 100 }}>
                <Field label={t('pf.otherCosts')}>
                  <NumInput value={l.otherCosts ?? 0} onChange={(v) => patch(l.id, { otherCosts: v ?? 0 })} min={0} />
                </Field>
              </div>
              <IconBtn
                icon="trash"
                title={t('g.remove')}
                onClick={() => setLots((prev) => prev.filter((x) => x.id !== l.id))}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title={t('ac.title')} right={<Badge tone="violet">{t('status.calculated')}</Badge>} />
        <div className="card-body">
          <div className="metric-grid">
            <Metric label={t('ac.totalShares')} value={fmt.int(result.value.totalShares)} size="xl" />
            <Metric label={t('ac.grossCost')} value={fmt.money(result.value.grossCost, currency)} />
            <Metric label={t('ac.totalFees')} value={fmt.money(result.value.totalFees, currency)} />
            <Metric label={t('ac.totalCost')} value={fmt.money(result.value.totalCost, currency)} size="xl" />
            <Metric
              label={t('ac.weightedAvg')}
              value={<V>{fmt.num(result.value.weightedAveragePrice, { decimals: 4 })}</V>}
            />
            <Metric
              label={t('ac.trueAvg')}
              value={<V>{fmt.num(result.value.trueAverageCost, { decimals: 4 })}</V>}
              size="xl"
              tone="brand"
              tip={t('ac.trueAvgTip')}
              status="calculated"
            />
          </div>
        </div>
        <FormulaFoot formula={result.formula} computedAt={result.computedAt} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profit / loss (+ scenarios, payoff chart, total return)             */
/* ------------------------------------------------------------------ */

function ProfitLossTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();
  const theme = useChartTheme();

  const [symbol, setSymbol] = useState<string | null>(null);
  const [buyPrice, setBuyPrice] = useState<number | null>(50);
  const [sellPrice, setSellPrice] = useState<number | null>(60);
  const [shares, setShares] = useState<number | null>(500);
  const [buyFees, setBuyFees] = useState<number | null>(30);
  const [sellFees, setSellFees] = useState<number | null>(30);
  const [dividends, setDividends] = useState<number | null>(0);
  const [scenarios, setScenarios] = useState<number[]>([]);
  const [newScenario, setNewScenario] = useState<number | null>(null);

  const row = symbol ? bySymbol.get(symbol) ?? null : null;

  const pnl = profitLoss({
    buyPrice: buyPrice ?? 0,
    sellPrice: sellPrice ?? 0,
    shares: shares ?? 0,
    buyFees: buyFees ?? 0,
    sellFees: sellFees ?? 0,
  });

  const be = breakEven({
    totalCost: (buyPrice ?? 0) * (shares ?? 0) + (buyFees ?? 0),
    shares: shares ?? 0,
    currentPrice: row?.price ?? sellPrice,
    sellFeesFlat: sellFees ?? 0,
  });

  const tr = totalReturn({
    costBasis: (buyPrice ?? 0) * (shares ?? 0) + (buyFees ?? 0),
    currentValue: (sellPrice ?? 0) * (shares ?? 0) - (sellFees ?? 0),
    dividendIncome: dividends ?? 0,
  });

  const profitAt = (price: number) =>
    (price - (buyPrice ?? 0)) * (shares ?? 0) - (buyFees ?? 0) - (sellFees ?? 0);

  const anchor = buyPrice ?? 1;
  const chartMin = Math.max(0, anchor * 0.5);
  const chartMax = anchor * 1.6;

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead title={t('pnl.title')} icon="activity" />
        <div className="card-body stack stack-4">
          <SymbolLinker
            row={row}
            onPick={(r) => {
              setSymbol(r.symbol);
              if (r.price != null) setSellPrice(r.price);
            }}
            onClear={() => setSymbol(null)}
          />

          <div className="grid grid-3">
            <Field label={t('ac.buyPrice')}>
              <NumInput value={buyPrice} onChange={setBuyPrice} step={0.05} min={0} />
            </Field>
            <Field label={t('pnl.sellPrice')}>
              <NumInput value={sellPrice} onChange={setSellPrice} step={0.05} min={0} />
            </Field>
            <Field label={t('g.shares')}>
              <NumInput value={shares} onChange={setShares} min={0} />
            </Field>
            <Field label={t('pnl.buyFees')}>
              <NumInput value={buyFees} onChange={setBuyFees} min={0} />
            </Field>
            <Field label={t('pnl.sellFees')}>
              <NumInput value={sellFees} onChange={setSellFees} min={0} />
            </Field>
            <Field label={t('pnl.dividendIncome')}>
              <NumInput value={dividends} onChange={setDividends} min={0} />
            </Field>
          </div>

          <div className="metric-grid">
            <Metric
              label={t('pnl.gross')}
              value={<V>{fmt.money(pnl.value.grossProfit, currency, { signed: true })}</V>}
              tone={(pnl.value.grossProfit ?? 0) >= 0 ? 'up' : 'down'}
            />
            <Metric
              label={t('pnl.net')}
              value={<V>{fmt.money(pnl.value.netProfit, currency, { signed: true })}</V>}
              size="xl"
              tone={(pnl.value.netProfit ?? 0) >= 0 ? 'up' : 'down'}
              status="calculated"
            />
            <Metric
              label={t('pnl.returnPct')}
              value={<V>{fmt.pct(pnl.value.returnPct, { signed: true })}</V>}
              size="xl"
              tone={(pnl.value.returnPct ?? 0) >= 0 ? 'up' : 'down'}
            />
            <Metric label={t('ac.totalCost')} value={<V>{fmt.money(pnl.value.totalCost, currency)}</V>} />
            <Metric label={t('ac.totalFees')} value={fmt.money(pnl.value.totalFees, currency)} />
            <Metric
              label={t('be.breakeven')}
              value={<V>{fmt.num(be.value.breakEvenPrice, { decimals: 4 })}</V>}
              status="calculated"
            />
          </div>
        </div>
        <FormulaFoot formula={pnl.formula} computedAt={pnl.computedAt} />
      </Card>

      <Card>
        <CardHead title={t('pnl.payoff')} icon="activity" />
        <div className="card-body">
          <PayoffChart
            minPrice={chartMin}
            maxPrice={chartMax}
            profitAt={profitAt}
            breakEven={be.value.breakEvenPrice}
            currentPrice={row?.price ?? null}
            targetPrice={sellPrice}
            formatMoney={(v) => fmt.compact(v)}
            formatPrice={(v) => fmt.num(v)}
          />
          <div className="legend" style={{ marginTop: 'var(--s-3)' }}>
            <span className="k">
              <i className="sw" style={{ background: theme.up, opacity: 0.35 }} /> {t('pnl.profitZone')}
            </span>
            <span className="k">
              <i className="sw" style={{ background: theme.down, opacity: 0.35 }} /> {t('pnl.lossZone')}
            </span>
            <span className="k">BE — {t('be.breakeven')}</span>
            <span className="k">● {t('be.current')}</span>
            <span className="k">◆ {t('tp.requiredPrice')}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title={t('pnl.scenarios')}
          right={
            <div className="row row-2">
              <div style={{ width: 120 }}>
                <NumInput value={newScenario} onChange={setNewScenario} step={0.5} />
              </div>
              <Btn
                size="sm"
                icon="plus"
                disabled={newScenario == null}
                onClick={() => {
                  if (newScenario == null) return;
                  setScenarios((prev) => [...new Set([...prev, newScenario])].sort((a, b) => a - b));
                  setNewScenario(null);
                }}
              >
                {t('pnl.addScenario')}
              </Btn>
            </div>
          }
        />
        {scenarios.length === 0 ? (
          <Empty icon="target" title={t('pnl.scenarios')} desc={t('pnl.addScenario')} />
        ) : (
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>{t('pnl.sellPrice')}</th>
                  <th className="num-col">{t('pnl.positionValue')}</th>
                  <th className="num-col">{t('pnl.net')}</th>
                  <th className="num-col">{t('pnl.returnPct')}</th>
                  <th className="num-col">{t('g.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((price) => {
                  const s = profitLoss({
                    buyPrice: buyPrice ?? 0,
                    sellPrice: price,
                    shares: shares ?? 0,
                    buyFees: buyFees ?? 0,
                    sellFees: sellFees ?? 0,
                  });
                  return (
                    <tr key={price}>
                      <td className="num">{fmt.num(price)}</td>
                      <td className="num-col num">{fmt.money(price * (shares ?? 0), currency)}</td>
                      <td className={`num-col num ${(s.value.netProfit ?? 0) >= 0 ? 'up' : 'down'}`}>
                        <V>{fmt.money(s.value.netProfit, currency, { signed: true })}</V>
                      </td>
                      <td className="num-col">
                        <Badge tone={(s.value.returnPct ?? 0) >= 0 ? 'up' : 'down'}>
                          {s.value.returnPct == null ? DASH : fmt.pct(s.value.returnPct, { signed: true })}
                        </Badge>
                      </td>
                      <td className="num-col">
                        <IconBtn
                          icon="trash"
                          title={t('g.remove')}
                          onClick={() => setScenarios((prev) => prev.filter((x) => x !== price))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title={t('pnl.totalReturn')} icon="coins" />
        <div className="card-body">
          <div className="metric-grid">
            <Metric
              label={t('pnl.capitalGain')}
              value={<V>{fmt.money(tr.value.capitalGain, currency, { signed: true })}</V>}
              tone={(tr.value.capitalGain ?? 0) >= 0 ? 'up' : 'down'}
              size="xl"
            />
            <Metric
              label={t('pnl.dividendIncome')}
              value={fmt.money(tr.value.dividendIncome, currency)}
              size="xl"
            />
            <Metric
              label={t('pnl.totalReturn')}
              value={<V>{fmt.money(tr.value.totalReturn, currency, { signed: true })}</V>}
              size="xl"
              tone={(tr.value.totalReturn ?? 0) >= 0 ? 'up' : 'down'}
              status="calculated"
            />
            <Metric
              label={`${t('pnl.totalReturn')} %`}
              value={<V>{fmt.pct(tr.value.totalReturnPct, { signed: true })}</V>}
              size="xl"
              tone={(tr.value.totalReturnPct ?? 0) >= 0 ? 'up' : 'down'}
            />
          </div>
        </div>
        <FormulaFoot formula={tr.formula} computedAt={tr.computedAt} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Break-even                                                          */
/* ------------------------------------------------------------------ */

function BreakEvenTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();

  const [symbol, setSymbol] = useState<string | null>(null);
  const [shares, setShares] = useState<number | null>(500);
  const [avgCost, setAvgCost] = useState<number | null>(50);
  const [buyFees, setBuyFees] = useState<number | null>(30);
  const [sellFees, setSellFees] = useState<number | null>(30);
  const [current, setCurrent] = useState<number | null>(46);

  const row = symbol ? bySymbol.get(symbol) ?? null : null;
  const price = row?.price ?? current;

  const result = breakEven({
    totalCost: (avgCost ?? 0) * (shares ?? 0) + (buyFees ?? 0),
    shares: shares ?? 0,
    currentPrice: price,
    sellFeesFlat: sellFees ?? 0,
  });

  const above = result.value.above;

  return (
    <Card>
      <CardHead title={t('be.title')} icon="target" />
      <div className="card-body stack stack-4">
        <SymbolLinker
          row={row}
          onPick={(r) => {
            setSymbol(r.symbol);
            setCurrent(r.price);
          }}
          onClear={() => setSymbol(null)}
        />

        <div className="grid grid-3">
          <Field label={t('g.shares')}>
            <NumInput value={shares} onChange={setShares} min={0} />
          </Field>
          <Field label={t('pf.avgCost')}>
            <NumInput value={avgCost} onChange={setAvgCost} step={0.05} min={0} />
          </Field>
          <Field label={t('be.current')}>
            <NumInput value={current} onChange={setCurrent} step={0.05} min={0} disabled={row != null} />
          </Field>
          <Field label={t('pnl.buyFees')}>
            <NumInput value={buyFees} onChange={setBuyFees} min={0} />
          </Field>
          <Field label={t('pnl.sellFees')}>
            <NumInput value={sellFees} onChange={setSellFees} min={0} />
          </Field>
        </div>

        <div className="metric-grid">
          <Metric
            label={t('be.breakeven')}
            value={<V>{fmt.num(result.value.breakEvenPrice, { decimals: 4 })}</V>}
            size="xl"
            tone="brand"
            status="calculated"
          />
          <Metric label={t('be.current')} value={<V>{fmt.num(price)}</V>} size="xl" />
          <Metric
            label={t('be.difference')}
            value={<V>{fmt.money(result.value.difference, currency, { signed: true })}</V>}
            tone={(result.value.difference ?? 0) >= 0 ? 'up' : 'down'}
          />
          <Metric
            label={t('be.requiredRecovery')}
            value={<V>{fmt.pct(result.value.requiredRecoveryPct, { signed: true })}</V>}
            tone={(result.value.requiredRecoveryPct ?? 0) <= 0 ? 'up' : 'down'}
            status="calculated"
          />
          <Metric
            label={t('g.status')}
            value={
              above == null ? (
                <span className="unavailable">{DASH}</span>
              ) : (
                <Badge tone={above ? 'up' : 'down'}>{above ? t('be.above') : t('be.below')}</Badge>
              )
            }
          />
        </div>
      </div>
      <FormulaFoot formula={result.formula} computedAt={result.computedAt} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Target price / target return                                        */
/* ------------------------------------------------------------------ */

function TargetTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [mode, setMode] = useState<'profit' | 'return'>('profit');

  const [avgCost, setAvgCost] = useState<number | null>(50);
  const [shares, setShares] = useState<number | null>(500);
  const [profitGoal, setProfitGoal] = useState<number | null>(10000);
  const [sellFees, setSellFees] = useState<number | null>(30);

  const [investment, setInvestment] = useState<number | null>(25000);
  const [returnShares, setReturnShares] = useState<number | null>(500);
  const [returnPct, setReturnPct] = useState<number | null>(20);

  const tp = targetPrice({
    averageCost: avgCost ?? 0,
    shares: shares ?? 0,
    targetProfit: profitGoal ?? 0,
    sellFees: sellFees ?? 0,
  });

  const tr = targetReturn({
    investment: investment ?? 0,
    shares: returnShares ?? 0,
    targetReturnPct: returnPct ?? 0,
  });

  return (
    <div className="stack stack-4">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { value: 'profit', label: t('tp.title') },
          { value: 'return', label: t('tp.targetReturn') },
        ]}
      />

      {mode === 'profit' ? (
        <Card>
          <CardHead title={t('tp.title')} icon="trophy" />
          <div className="card-body stack stack-4">
            <div className="grid grid-4">
              <Field label={t('pf.avgCost')}>
                <NumInput value={avgCost} onChange={setAvgCost} step={0.05} min={0} />
              </Field>
              <Field label={t('g.shares')}>
                <NumInput value={shares} onChange={setShares} min={0} />
              </Field>
              <Field label={t('tp.targetProfit')}>
                <NumInput value={profitGoal} onChange={setProfitGoal} step={500} />
              </Field>
              <Field label={t('pnl.sellFees')}>
                <NumInput value={sellFees} onChange={setSellFees} min={0} />
              </Field>
            </div>

            <div className="metric-grid">
              <Metric
                label={t('tp.requiredPrice')}
                value={<V>{fmt.num(tp.value.requiredPrice, { decimals: 4 })}</V>}
                size="xl"
                tone="brand"
                status="calculated"
              />
              <Metric label={t('tp.targetValue')} value={<V>{fmt.money(tp.value.targetValue, currency)}</V>} />
              <Metric
                label={t('tp.profitPerShare')}
                value={<V>{fmt.num(tp.value.profitPerShare, { decimals: 4 })}</V>}
              />
              <Metric
                label={t('pnl.returnPct')}
                value={<V>{fmt.pct(tp.value.returnPct, { signed: true })}</V>}
                tone={(tp.value.returnPct ?? 0) >= 0 ? 'up' : 'down'}
              />
            </div>
          </div>
          <FormulaFoot formula={tp.formula} computedAt={tp.computedAt} />
        </Card>
      ) : (
        <Card>
          <CardHead title={t('tp.targetReturn')} icon="target" />
          <div className="card-body stack stack-4">
            <div className="grid grid-3">
              <Field label={t('tp.investment')}>
                <NumInput value={investment} onChange={setInvestment} step={1000} min={0} />
              </Field>
              <Field label={t('g.shares')}>
                <NumInput value={returnShares} onChange={setReturnShares} min={0} />
              </Field>
              <Field label={t('tp.targetReturnPct')}>
                <NumInput value={returnPct} onChange={setReturnPct} step={5} suffix="%" />
              </Field>
            </div>

            <div className="metric-grid">
              <Metric
                label={t('tp.targetProfit')}
                value={<V>{fmt.money(tr.value.targetProfit, currency, { signed: true })}</V>}
                size="xl"
                tone={(tr.value.targetProfit ?? 0) >= 0 ? 'up' : 'down'}
              />
              <Metric label={t('tp.targetValue')} value={<V>{fmt.money(tr.value.targetValue, currency)}</V>} size="xl" />
              <Metric
                label={t('tp.requiredPrice')}
                value={<V>{fmt.num(tr.value.requiredPrice, { decimals: 4 })}</V>}
                size="xl"
                tone="brand"
                status="calculated"
              />
            </div>
          </div>
          <FormulaFoot formula={tr.formula} computedAt={tr.computedAt} />
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Averaging simulator                                                 */
/* ------------------------------------------------------------------ */

const WHAT_IF_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

function AveragingTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();

  const [symbol, setSymbol] = useState<string | null>(null);
  const [currentShares, setCurrentShares] = useState<number | null>(500);
  const [currentAvg, setCurrentAvg] = useState<number | null>(55);
  const [addPrice, setAddPrice] = useState<number | null>(45);
  const [addShares, setAddShares] = useState<number | null>(300);
  const [addFees, setAddFees] = useState<number | null>(30);
  const [sliderAmount, setSliderAmount] = useState(20000);

  const row = symbol ? bySymbol.get(symbol) ?? null : null;

  const result = simulateAveraging(
    currentShares ?? 0,
    currentAvg ?? 0,
    addPrice ?? 0,
    addShares ?? 0,
    addFees ?? 0,
  );

  const be = breakEven({
    totalCost: result.value.newCostBasis,
    shares: result.value.newShares,
    currentPrice: addPrice,
  });

  const scenarios = useMemo(() => {
    const price = addPrice ?? 0;
    if (price <= 0) return [];
    return WHAT_IF_AMOUNTS.map((amount) => {
      const extraShares = Math.floor(amount / price);
      const sim = simulateAveraging(
        currentShares ?? 0,
        currentAvg ?? 0,
        price,
        extraShares,
        addFees ?? 0,
      );
      const b = breakEven({
        totalCost: sim.value.newCostBasis,
        shares: sim.value.newShares,
        currentPrice: price,
      });
      return { amount, extraShares, sim, b };
    });
  }, [addPrice, currentShares, currentAvg, addFees]);

  const sliderShares = addPrice && addPrice > 0 ? Math.floor(sliderAmount / addPrice) : 0;
  const sliderSim = simulateAveraging(
    currentShares ?? 0,
    currentAvg ?? 0,
    addPrice ?? 0,
    sliderShares,
    addFees ?? 0,
  );

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead title={t('avg.title')} icon="layers" />
        <div className="card-body stack stack-4">
          <SymbolLinker
            row={row}
            onPick={(r) => {
              setSymbol(r.symbol);
              if (r.price != null) setAddPrice(r.price);
            }}
            onClear={() => setSymbol(null)}
          />

          <div className="grid grid-4">
            <Field label={t('avg.currentShares')}>
              <NumInput value={currentShares} onChange={setCurrentShares} min={0} />
            </Field>
            <Field label={t('avg.currentAvg')}>
              <NumInput value={currentAvg} onChange={setCurrentAvg} step={0.05} min={0} />
            </Field>
            <Field label={t('avg.addPrice')}>
              <NumInput value={addPrice} onChange={setAddPrice} step={0.05} min={0} />
            </Field>
            <Field label={t('avg.addShares')}>
              <NumInput value={addShares} onChange={setAddShares} min={0} />
            </Field>
            <Field label={t('pf.fees')}>
              <NumInput value={addFees} onChange={setAddFees} min={0} />
            </Field>
          </div>

          <div className="metric-grid">
            <Metric label={t('avg.newShares')} value={fmt.int(result.value.newShares)} size="xl" />
            <Metric
              label={t('avg.newAvg')}
              value={<V>{fmt.num(result.value.newAverage, { decimals: 4 })}</V>}
              size="xl"
              tone="brand"
              status="calculated"
            />
            <Metric
              label={t('avg.avgChange')}
              value={<V>{fmt.num(result.value.averageChange, { decimals: 4, signed: true })}</V>}
              tone={(result.value.averageChange ?? 0) <= 0 ? 'up' : 'down'}
              sub={fmt.pct(result.value.averageChangePct, { signed: true })}
            />
            <Metric label={t('avg.newCostBasis')} value={fmt.money(result.value.newCostBasis, currency)} />
            <Metric
              label={t('avg.newBreakeven')}
              value={<V>{fmt.num(be.value.breakEvenPrice, { decimals: 4 })}</V>}
              status="calculated"
            />
            <Metric
              label={t('avg.requiredRecovery')}
              value={<V>{fmt.pct(be.value.requiredRecoveryPct, { signed: true })}</V>}
              tone={(be.value.requiredRecoveryPct ?? 0) <= 0 ? 'up' : 'down'}
            />
          </div>
        </div>
        <FormulaFoot formula={result.formula} computedAt={result.computedAt} />
      </Card>

      <Card>
        <CardHead title={t('avg.whatIf')} icon="sliders" />
        <div className="card-body stack stack-4">
          <div className="row row-3">
            <span className="num t-sm muted-3" style={{ minWidth: 70 }}>
              {fmt.compact(1000)}
            </span>
            <div style={{ flex: 1 }}>
              <Slider value={sliderAmount} min={1000} max={200000} step={1000} onChange={setSliderAmount} />
            </div>
            <span className="num t-sm muted-3" style={{ minWidth: 70, textAlign: 'end' }}>
              {fmt.compact(200000)}
            </span>
          </div>

          <div className="metric-grid">
            <Metric label={t('avg.addAmount')} value={fmt.money(sliderAmount, currency)} size="xl" />
            <Metric label={t('avg.addShares')} value={fmt.int(sliderShares)} />
            <Metric
              label={t('avg.newAvg')}
              value={<V>{fmt.num(sliderSim.value.newAverage, { decimals: 4 })}</V>}
              tone="brand"
              status="calculated"
            />
            <Metric
              label={t('avg.avgChange')}
              value={<V>{fmt.num(sliderSim.value.averageChange, { decimals: 4, signed: true })}</V>}
              tone={(sliderSim.value.averageChange ?? 0) <= 0 ? 'up' : 'down'}
            />
          </div>

          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>{t('avg.addAmount')}</th>
                  <th className="num-col">{t('avg.addShares')}</th>
                  <th className="num-col">{t('avg.newShares')}</th>
                  <th className="num-col">{t('avg.newAvg')}</th>
                  <th className="num-col">{t('avg.newBreakeven')}</th>
                  <th className="num-col">{t('avg.requiredRecovery')}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.amount}>
                    <td className="num">{fmt.money(s.amount, currency)}</td>
                    <td className="num-col num">{fmt.int(s.extraShares)}</td>
                    <td className="num-col num">{fmt.int(s.sim.value.newShares)}</td>
                    <td className="num-col num">
                      <V>{fmt.num(s.sim.value.newAverage, { decimals: 4 })}</V>
                    </td>
                    <td className="num-col num">
                      <V>{fmt.num(s.b.value.breakEvenPrice, { decimals: 4 })}</V>
                    </td>
                    <td
                      className={`num-col num ${(s.b.value.requiredRecoveryPct ?? 0) <= 0 ? 'up' : 'down'}`}
                    >
                      <V>{fmt.pct(s.b.value.requiredRecoveryPct, { signed: true })}</V>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dividend                                                            */
/* ------------------------------------------------------------------ */

function DividendTool({ currency }: { currency: Currency }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();

  const [symbol, setSymbol] = useState<string | null>(null);
  const [shares, setShares] = useState<number | null>(1000);
  const [dps, setDps] = useState<number | null>(1.5);
  const [price, setPrice] = useState<number | null>(40);
  const [avgCost, setAvgCost] = useState<number | null>(35);
  const [frequency, setFrequency] = useState<keyof typeof PERIODS_PER_YEAR>('quarterly');
  const [withholding, setWithholding] = useState<number | null>(0);

  const row = symbol ? bySymbol.get(symbol) ?? null : null;

  const result = dividendIncome({
    shares: shares ?? 0,
    dps: dps ?? 0,
    sharePrice: row?.price ?? price,
    averageCost: avgCost,
    frequency,
    withholdingRate: (withholding ?? 0) / 100,
  });

  return (
    <Card>
      <CardHead title={t('div.calculator')} icon="coins" />
      <div className="card-body stack stack-4">
        <SymbolLinker
          row={row}
          onPick={(r) => {
            setSymbol(r.symbol);
            setPrice(r.price);
          }}
          onClear={() => setSymbol(null)}
        />

        <div className="grid grid-3">
          <Field label={t('g.shares')}>
            <NumInput value={shares} onChange={setShares} min={0} />
          </Field>
          <Field label={t('div.dps')}>
            <NumInput value={dps} onChange={setDps} step={0.05} min={0} />
          </Field>
          <Field label={t('g.price')}>
            <NumInput value={price} onChange={setPrice} step={0.05} min={0} disabled={row != null} />
          </Field>
          <Field label={t('pf.avgCost')}>
            <NumInput value={avgCost} onChange={setAvgCost} step={0.05} min={0} />
          </Field>
          <Field label={t('div.frequency')}>
            <Select
              value={frequency}
              onChange={setFrequency}
              options={(['annual', 'semi_annual', 'quarterly', 'monthly'] as const).map((f) => ({
                value: f,
                label: t(`freq.${f}` as 'freq.annual'),
              }))}
            />
          </Field>
          <Field label="Withholding %">
            <NumInput value={withholding} onChange={setWithholding} min={0} suffix="%" />
          </Field>
        </div>

        <div className="metric-grid">
          <Metric
            label={t('div.income')}
            value={<V>{fmt.money(result.value.incomePerPeriod, currency)}</V>}
            size="xl"
            status="calculated"
          />
          <Metric
            label={t('div.annualIncome')}
            value={<V>{fmt.money(result.value.annualIncome, currency)}</V>}
            size="xl"
          />
          <Metric
            label={t('div.monthlyEquivalent')}
            value={<V>{fmt.money(result.value.monthlyEquivalent, currency)}</V>}
          />
          <Metric label={t('div.yield')} value={<V>{fmt.pct(result.value.yieldPct)}</V>} />
          <Metric
            label={`${t('div.yield')} (${t('pf.avgCost')})`}
            value={<V>{fmt.pct(result.value.yieldOnCostPct)}</V>}
          />
          <Metric label={t('pnl.positionValue')} value={<V>{fmt.money(result.value.positionValue, currency)}</V>} />
        </div>

        <Notice tone="info">{t('div.projectedNote')}</Notice>
      </div>
      <FormulaFoot formula={result.formula} computedAt={result.computedAt} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Investment allocation                                               */
/* ------------------------------------------------------------------ */

interface AllocRow {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  allocationPct: number;
}

function InvestmentTool({ currency }: { currency: Currency }) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const [capital, setCapital] = useState<number | null>(100000);
  const [legs, setLegs] = useState<AllocRow[]>([]);

  const result = allocateCapital(
    capital ?? 0,
    legs.map((l) => ({ symbol: l.symbol, price: l.price, allocationPct: l.allocationPct })),
  );

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead title={t('inv.title')} icon="wallet" />
        <div className="card-body stack stack-4">
          <div className="grid grid-3">
            <Field label={t('inv.capital')}>
              <NumInput value={capital} onChange={setCapital} step={1000} min={0} />
            </Field>
          </div>

          <InstrumentPicker
            placeholder={t('impact.addStock')}
            exclude={legs.map((l) => l.symbol)}
            onPick={(r) =>
              setLegs((prev) => [
                ...prev,
                {
                  id: r.symbol,
                  symbol: r.symbol,
                  name: L(r.instrument.shortName),
                  price: r.price,
                  allocationPct: Math.max(
                    0,
                    Math.round((100 - prev.reduce((s, x) => s + x.allocationPct, 0)) / 1),
                  ),
                },
              ])
            }
          />

          {legs.length === 0 ? (
            <Empty icon="wallet" title={t('inv.title')} desc={t('calc.investmentDesc')} />
          ) : (
            <div className="stack stack-3">
              {result.value.legs.map((leg, i) => (
                <div key={leg.symbol} className="row row-3 row-wrap">
                  <span className="sym" style={{ minWidth: 52 }}>
                    {leg.symbol}
                  </span>
                  <span className="truncate" style={{ flex: 1, minWidth: 90 }}>
                    {legs[i]?.name}
                  </span>
                  <span className="num t-sm muted">{fmt.num(leg.price)}</span>
                  <div style={{ width: 120 }}>
                    <NumInput
                      value={leg.allocationPct}
                      onChange={(v) =>
                        setLegs((prev) =>
                          prev.map((x) =>
                            x.symbol === leg.symbol ? { ...x, allocationPct: v ?? 0 } : x,
                          ),
                        )
                      }
                      step={5}
                      min={0}
                      suffix="%"
                    />
                  </div>
                  <span className="num t-sm" style={{ minWidth: 90, textAlign: 'end' }}>
                    {fmt.int(leg.shares)} {t('g.shares')}
                  </span>
                  <span className="num t-sm" style={{ minWidth: 100, textAlign: 'end' }}>
                    {fmt.money(leg.actualSpend, currency)}
                  </span>
                  <IconBtn
                    icon="trash"
                    title={t('g.remove')}
                    onClick={() => setLegs((prev) => prev.filter((x) => x.symbol !== leg.symbol))}
                  />
                </div>
              ))}
            </div>
          )}

          {result.value.overAllocated && (
            <Notice tone="warn" icon="warning">
              {t('inv.overAllocated')}
            </Notice>
          )}

          <div className="metric-grid">
            <Metric label={t('inv.capital')} value={fmt.money(result.value.capital, currency)} size="xl" />
            <Metric label={t('inv.allocated')} value={fmt.money(result.value.totalSpent, currency)} size="xl" status="calculated" />
            <Metric label={t('inv.remainingCash')} value={fmt.money(result.value.remainingCash, currency)} size="xl" />
            <Metric
              label={t('inv.allocationPct')}
              value={fmt.pct(result.value.totalRequested)}
              tone={result.value.overAllocated ? 'down' : 'brand'}
            />
          </div>
        </div>
        <FormulaFoot formula={result.formula} computedAt={result.computedAt} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function CalculatorPage() {
  const { tool = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>('SAR');

  const def = CALCULATORS.find((c) => c.slug === tool);

  const body = (() => {
    switch (tool) {
      case 'average-cost':
        return <AverageCostTool currency={currency} />;
      case 'profit-loss':
        return <ProfitLossTool currency={currency} />;
      case 'break-even':
        return <BreakEvenTool currency={currency} />;
      case 'target-price':
        return <TargetTool currency={currency} />;
      case 'averaging':
        return <AveragingTool currency={currency} />;
      case 'dividend':
        return <DividendTool currency={currency} />;
      case 'investment':
        return <InvestmentTool currency={currency} />;
      case 'what-if':
        return <ScenarioBuilder mode="whatif" />;
      default:
        return (
          <Empty
            icon="calculator"
            title={t('g.noData')}
            desc={t('calc.sub')}
            action={<Btn onClick={() => navigate('/app/calculators')}>{t('calc.title')}</Btn>}
          />
        );
    }
  })();

  return (
    <div className="stack stack-5">
      <PageHead
        title={def ? t(def.label) : t('calc.title')}
        sub={def ? t(def.desc) : undefined}
        right={
          <>
            <Seg
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'SAR', label: 'SAR' },
                { value: 'USD', label: 'USD' },
              ]}
            />
            <Btn icon="chevronLeft" onClick={() => navigate('/app/calculators')}>
              {t('calc.title')}
            </Btn>
          </>
        }
      />

      <Tabs
        value={tool}
        onChange={(v) => navigate(`/app/calculators/${v}`)}
        options={CALCULATORS.map((c) => ({ value: c.slug, label: t(c.label) }))}
      />

      {body}

      <Disclaimers />
    </div>
  );
}
