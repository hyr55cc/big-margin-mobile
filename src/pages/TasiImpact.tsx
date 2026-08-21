import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Btn,
  Card,
  CardHead,
  DataTable,
  Empty,
  FormulaTip,
  IconBtn,
  Metric,
  Notice,
  NumInput,
  Seg,
  Slider,
  StatusBadge,
  Tabs,
  V,
} from '@/components/ui';
import { useStockColumns, withRank } from '@/components/market/columns';
import { InstrumentPicker } from '@/components/market/cells';
import { BarChart } from '@/components/charts';
import {
  CONTRIBUTION_FORMULA,
  POINTS_PER_UNIT_FORMULA,
  runScenario,
  type ScenarioLeg,
} from '@/lib/calc/indexImpact';
import { DASH } from '@/lib/format';

type Tab = 'top' | 'calculator' | 'whatif';
type RankBy = 'weight' | 'daily' | 'points';
type TopN = '10' | '20' | '50';

/* ------------------------------------------------------------------ */
/* Scenario builder — shared by the calculator and the what-if screen  */
/* ------------------------------------------------------------------ */

interface Leg extends ScenarioLeg {
  id: string;
  name: string;
}

function ScenarioBuilder({ mode }: { mode: 'calculator' | 'whatif' }) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { indexInfo } = useMarket();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [copied, setCopied] = useState(false);

  const level = indexInfo.get('TASI')?.quote.level ?? null;
  const result = useMemo(() => runScenario(legs, level), [legs, level]);

  const add = (row: MarketRow) => {
    if (legs.some((l) => l.symbol === row.symbol)) return;
    setLegs((prev) => [
      ...prev,
      {
        id: row.symbol,
        symbol: row.symbol,
        name: L(row.instrument.shortName),
        weightPct: row.weightPct,
        price: row.price,
        movePct: 1,
      },
    ]);
  };

  const patch = (id: string, next: Partial<Leg>) =>
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));

  const share = () => {
    const encoded = legs.map((l) => `${l.symbol}:${l.movePct}`).join(',');
    const url = `${window.location.origin}${window.location.pathname}?scenario=${encodeURIComponent(encoded)}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };

  const positives = result.legs.filter((l) => (l.points ?? 0) > 0);
  const negatives = result.legs.filter((l) => (l.points ?? 0) < 0);

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead
          title={mode === 'calculator' ? t('impact.calculator') : t('whatif.title')}
          sub={mode === 'calculator' ? t('impact.calcSub') : t('whatif.sub')}
          icon="zap"
          right={
            <>
              <Btn size="sm" icon="copy" onClick={share} disabled={legs.length === 0}>
                {copied ? t('g.copied') : t('impact.shareScenario')}
              </Btn>
              <Btn size="sm" icon="refresh" onClick={() => setLegs([])} disabled={legs.length === 0}>
                {t('g.reset')}
              </Btn>
            </>
          }
        />
        <div className="card-body stack stack-4">
          <InstrumentPicker
            onPick={add}
            marketFilter="SA"
            placeholder={t('impact.addStock')}
            exclude={legs.map((l) => l.symbol)}
          />

          {legs.length === 0 ? (
            <Empty
              icon="zap"
              title={t('impact.addStock')}
              desc={mode === 'calculator' ? t('impact.calcSub') : t('whatif.sub')}
            />
          ) : (
            <div className="stack stack-3">
              {result.legs.map((leg) => {
                const l = legs.find((x) => x.symbol === leg.symbol)!;
                return (
                  <div
                    key={leg.symbol}
                    className="stack stack-2"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      padding: 'var(--s-3)',
                    }}
                  >
                    <div className="row row-3 row-wrap">
                      <span className="sym">{leg.symbol}</span>
                      <span className="truncate" style={{ flex: 1, minWidth: 90 }}>
                        {leg.name}
                      </span>
                      <span className="t-xs muted-3">
                        {t('weight.weight')}{' '}
                        <span className="num">{fmt.pct(leg.weightPct, { decimals: 3 })}</span>
                      </span>
                      <span className="t-xs muted-3">
                        {t('g.price')} <span className="num">{fmt.num(leg.price)}</span>
                      </span>
                      <IconBtn
                        icon="trash"
                        title={t('g.remove')}
                        onClick={() => setLegs((prev) => prev.filter((x) => x.id !== leg.symbol))}
                      />
                    </div>

                    <div className="row row-4 row-wrap">
                      <div style={{ minWidth: 130 }}>
                        <label className="t-xs muted-3">{t('impact.expectedChangePct')}</label>
                        <NumInput
                          value={l.movePct}
                          onChange={(v) => patch(leg.symbol, { movePct: v ?? 0 })}
                          step={0.25}
                          suffix="%"
                        />
                      </div>
                      <div style={{ minWidth: 130 }}>
                        <label className="t-xs muted-3">{t('impact.expectedPrice')}</label>
                        <NumInput
                          value={leg.targetPrice}
                          onChange={(v) => {
                            if (v == null || leg.price == null || leg.price === 0) return;
                            patch(leg.symbol, {
                              movePct: Number((((v - leg.price) / leg.price) * 100).toFixed(4)),
                            });
                          }}
                          step={0.05}
                        />
                      </div>
                      <div style={{ minWidth: 120 }}>
                        <label className="t-xs muted-3">{t('impact.moveSar')}</label>
                        <NumInput
                          value={leg.priceDelta}
                          onChange={(v) => {
                            if (v == null || leg.price == null || leg.price === 0) return;
                            patch(leg.symbol, {
                              movePct: Number(((v / leg.price) * 100).toFixed(4)),
                            });
                          }}
                          step={0.05}
                        />
                      </div>
                      <div className="stack" style={{ gap: 2, minWidth: 130 }}>
                        <span className="t-xs muted-3">{t('impact.individual')}</span>
                        <span
                          className={`num ${(leg.points ?? 0) >= 0 ? 'up' : 'down'}`}
                          style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}
                        >
                          <V>
                            {leg.points == null
                              ? DASH
                              : fmt.num(leg.points, { decimals: 2, signed: true })}
                          </V>
                        </span>
                      </div>
                    </div>

                    {mode === 'whatif' && (
                      <div className="row row-3">
                        <span className="t-xs muted-3 num" style={{ minWidth: 44 }}>
                          -10%
                        </span>
                        <div style={{ flex: 1 }}>
                          <Slider
                            value={l.movePct}
                            min={-10}
                            max={10}
                            step={0.25}
                            onChange={(v) => patch(leg.symbol, { movePct: v })}
                          />
                        </div>
                        <span className="t-xs muted-3 num" style={{ minWidth: 44, textAlign: 'end' }}>
                          +10%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {legs.length > 0 && (
        <>
          <div className="grid grid-3">
            <Card className="card-pad">
              <Metric
                label={
                  mode === 'whatif' ? t('whatif.combined') : t('impact.totalImpact')
                }
                value={
                  <V>
                    {result.totalPoints == null
                      ? DASH
                      : fmt.num(result.totalPoints, { decimals: 2, signed: true })}
                  </V>
                }
                size="xl"
                tone={(result.totalPoints ?? 0) >= 0 ? 'up' : 'down'}
                status="calculated"
                sub={t('impact.pointsPerUnit')}
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={t('impact.estimatedLevel')}
                value={<V>{fmt.num(result.estimatedLevel)}</V>}
                size="xl"
                status="calculated"
                sub={
                  <span className={(result.estimatedChangePct ?? 0) >= 0 ? 'up' : 'down'}>
                    {fmt.pct(result.estimatedChangePct, { signed: true })}
                  </span>
                }
              />
            </Card>
            <Card className="card-pad">
              <Metric
                label={`${t('impact.positiveContrib')} / ${t('impact.negativeContrib')}`}
                value={
                  <span className="row row-3">
                    <span className="up">{fmt.num(result.positivePoints, { signed: true })}</span>
                    <span className="muted-3">/</span>
                    <span className="down">{fmt.num(result.negativePoints)}</span>
                  </span>
                }
                size="md"
                sub={`${positives.length} / ${negatives.length}`}
              />
            </Card>
          </div>

          <Card>
            <CardHead
              title={t('impact.individual')}
              right={<FormulaTip text={t('impact.formulaBody')} formula={result.formula} computedAt={result.computedAt} />}
            />
            <div className="card-body">
              <BarChart
                signed
                items={result.legs.map((l) => ({
                  key: l.symbol,
                  label: `${l.symbol} ${l.name ?? ''}`,
                  value: l.points,
                  sub: `${fmt.pct(l.movePct, { signed: true })}`,
                }))}
                formatValue={(v) => fmt.num(v, { decimals: 2, signed: true })}
              />
            </div>
          </Card>

          <Notice tone="warn" icon="warning">
            {t('impact.scenarioDisclaimer')}
          </Notice>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function TasiImpact() {
  const { t } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rowsFor, indexInfo, loading } = useMarket();
  const cols = useStockColumns();

  const [tab, setTab] = useState<Tab>('top');
  const [rankBy, setRankBy] = useState<RankBy>('weight');
  const [topN, setTopN] = useState<TopN>('20');

  const info = indexInfo.get('TASI');
  const all = rowsFor('SA');

  const ranked = useMemo(() => {
    const key =
      rankBy === 'weight'
        ? (r: MarketRow) => r.weightPct
        : rankBy === 'daily'
          ? (r: MarketRow) => (r.todayPoints == null ? null : Math.abs(r.todayPoints))
          : (r: MarketRow) => r.pointsPerUnit;
    return [...all]
      .filter((r) => key(r) != null)
      .sort((a, b) => (key(b) as number) - (key(a) as number))
      .slice(0, Number(topN));
  }, [all, rankBy, topN]);

  const impactColumns = [
    cols.symbol,
    cols.price,
    cols.changePct,
    cols.weight,
    cols.pointsPerUnit,
    cols.todayPoints,
    cols.impactBand,
    cols.shariah,
    cols.marketCap,
    cols.freeFloatCap,
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('impact.title')} sub={t('impact.sub')} status="calculated" />

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric
            label={t('impact.formulaTitle')}
            value={<span className="t-lg">{t('impact.pointsPerUnit')}</span>}
            size="sm"
            tip={t('impact.formulaBody')}
            status="calculated"
          />
        </Card>
        <Card className="card-pad">
          <Metric
            label="TASI"
            value={<V>{fmt.num(info?.quote.level)}</V>}
            size="xl"
            sub={
              <span className={(info?.quote.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                {fmt.pct(info?.quote.changePct ?? null, { signed: true })}
              </span>
            }
          />
        </Card>
        <Card className="card-pad">
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
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('weight.freeFloatCap')}
            value={<V>{fmt.compact(info?.aggregateFreeFloatCap ?? null)}</V>}
            sub="TASI"
          />
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'top', label: t('impact.topN') },
          { value: 'calculator', label: t('impact.calculator') },
          { value: 'whatif', label: t('whatif.title') },
        ]}
      />

      {tab === 'top' && (
        <div className="stack stack-4">
          <Card>
            <CardHead
              title={t('impact.topN')}
              right={
                <>
                  <Seg
                    value={rankBy}
                    onChange={setRankBy}
                    options={[
                      { value: 'weight', label: t('impact.byWeight') },
                      { value: 'daily', label: t('impact.byDaily') },
                      { value: 'points', label: t('impact.byPoints') },
                    ]}
                  />
                  <Seg
                    value={topN}
                    onChange={setTopN}
                    options={[
                      { value: '10', label: '10' },
                      { value: '20', label: '20' },
                      { value: '50', label: '50' },
                    ]}
                  />
                  <StatusBadge status="calculated" />
                </>
              }
            />
            <div className="card-body">
              <BarChart
                signed={rankBy === 'daily'}
                items={ranked.slice(0, 20).map((r) => ({
                  key: r.symbol,
                  label: r.symbol,
                  value:
                    rankBy === 'weight'
                      ? r.weightPct
                      : rankBy === 'daily'
                        ? r.todayPoints
                        : r.pointsPerUnit,
                }))}
                onSelect={(sym) => navigate(`/app/stock/${sym}`)}
                formatValue={(v) =>
                  rankBy === 'weight'
                    ? fmt.pct(v, { decimals: 2 })
                    : fmt.num(v, { decimals: rankBy === 'points' ? 4 : 2, signed: rankBy === 'daily' })
                }
              />
            </div>
          </Card>

          <Card>
            <CardHead
              title={t('impact.explain')}
              sub={
                <span className="row row-2">
                  {t('impact.formulaTitle')}
                  <FormulaTip
                    text={t('impact.formulaBody')}
                    formula={`${POINTS_PER_UNIT_FORMULA}\n\n${CONTRIBUTION_FORMULA}`}
                  />
                </span>
              }
            />
            <DataTable
              rows={ranked}
              columns={withRank(impactColumns, ranked)}
              rowKey={(r) => r.symbol}
              initialSort={rankBy === 'weight' ? 'weight' : rankBy === 'daily' ? 'todayPoints' : 'pointsPerUnit'}
              onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
              exportName="big-margin-tasi-impact"
              loading={loading}
              pageSize={50}
            />
          </Card>

          <Notice tone="info">{t('impact.divisorNote')}</Notice>
        </div>
      )}

      {tab === 'calculator' && <ScenarioBuilder mode="calculator" />}
      {tab === 'whatif' && <ScenarioBuilder mode="whatif" />}

      <Disclaimers />
    </div>
  );
}

export { ScenarioBuilder };
