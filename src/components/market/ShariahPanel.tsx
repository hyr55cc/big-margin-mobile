import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { getProvider } from '@/data/registry';
import { useMarket } from '@/data/MarketContext';
import {
  Badge,
  Card,
  CardHead,
  Empty,
  Metric,
  ShariahBadge,
  Skeleton,
  StatusBadge,
  Tip,
  V,
} from '@/components/ui';
import { DASH } from '@/lib/format';
import type { ShariahScreening } from '@/types';

/** Screening ratios shown with numerator, denominator, threshold and outcome. */
export function ShariahRatios({ screening }: { screening: ShariahScreening }) {
  const { t, L } = useI18n();
  const fmt = useFmt();

  if (screening.ratios.length === 0) {
    return (
      <Empty
        icon="crescent"
        title={t('sh.unknown')}
        desc={screening.note ? L(screening.note) : screening.provenance.reason}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th>{t('sh.ratios')}</th>
            <th className="num-col">{t('sh.actual')}</th>
            <th className="num-col">{t('sh.threshold')}</th>
            <th className="num-col">{t('g.status')}</th>
          </tr>
        </thead>
        <tbody>
          {screening.ratios.map((r) => (
            <tr key={r.key}>
              <td>
                <span className="row row-2">
                  {L(r.label)}
                  <Tip>
                    <code className="formula">{r.formula}</code>
                    <span className="t-xs muted-3" style={{ display: 'block', marginTop: 6 }}>
                      {fmt.compact(r.numerator)} ÷ {fmt.compact(r.denominator)}
                    </span>
                  </Tip>
                </span>
              </td>
              <td className="num-col">
                <span
                  className={`num ${r.passes === false ? 'down' : r.passes === true ? 'up' : ''}`}
                >
                  <V>{r.valuePct == null ? DASH : fmt.pct(r.valuePct)}</V>
                </span>
              </td>
              <td className="num-col num muted">
                {r.thresholdPct == null ? DASH : `< ${fmt.pct(r.thresholdPct, { decimals: 0 })}`}
              </td>
              <td className="num-col">
                {r.passes == null ? (
                  <span className="unavailable">{DASH}</span>
                ) : (
                  <Badge tone={r.passes ? 'up' : 'down'}>
                    {r.passes ? t('sh.passes') : t('sh.fails')}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cross-methodology status table for one instrument. */
export function MethodologyComparison({ symbol }: { symbol: string }) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { methodologies } = useMarket();

  const state = useAsync(async () => {
    const p = getProvider();
    const results = await Promise.all(
      methodologies.map(async (m) => ({
        methodology: m,
        screening: await p.getScreening(symbol, m.id),
      })),
    );
    return results;
  }, [symbol, methodologies.length]);

  if (state.loading) return <Skeleton h={140} />;
  if (!state.data) return null;

  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th>{t('g.methodology')}</th>
            <th>{t('sh.status')}</th>
            <th className="num-col">{t('sh.nonCompliantIncome')}</th>
            <th className="num-col">{t('sh.screeningDate')}</th>
            <th className="num-col">{t('g.source')}</th>
          </tr>
        </thead>
        <tbody>
          {state.data.map(({ methodology, screening }) => (
            <tr key={methodology.id}>
              <td>
                <Link to={`/app/shariah/methodology/${methodology.id}`} className="co-name">
                  <span className="n1">{methodology.shortName}</span>
                  <span className="n2">{L(methodology.name)}</span>
                </Link>
              </td>
              <td>
                <ShariahBadge status={screening?.status ?? 'unknown'} />
              </td>
              <td className="num-col">
                <V>
                  {screening?.nonCompliantIncomePct == null
                    ? DASH
                    : fmt.pct(screening.nonCompliantIncomePct)}
                </V>
              </td>
              <td className="num-col num muted">
                <V>{fmt.date(screening?.screeningDate ?? null)}</V>
              </td>
              <td className="num-col">
                {screening && <StatusBadge provenance={screening.provenance} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Recorded classification changes over time. */
export function ShariahHistory({
  symbol,
  methodologyId,
}: {
  symbol: string;
  methodologyId: string;
}) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const state = useAsync(
    () => getProvider().getScreeningHistory(symbol, methodologyId),
    [symbol, methodologyId],
  );

  if (state.loading) return <Skeleton h={120} />;
  if (!state.data || state.data.length === 0) {
    return <Empty icon="crescent" title={t('sh.noHistory')} />;
  }

  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th>{t('g.date')}</th>
            <th>{t('sh.status')}</th>
            <th>{t('g.methodology')}</th>
            <th>{t('sh.reason')}</th>
            <th>{t('g.source')}</th>
          </tr>
        </thead>
        <tbody>
          {state.data.map((h, i) => {
            const prev = state.data![i + 1];
            const changed = prev && prev.status !== h.status;
            return (
              <tr key={`${h.date}-${i}`}>
                <td className="num muted">{fmt.date(h.date)}</td>
                <td>
                  <span className="row row-2">
                    <ShariahBadge status={h.status} />
                    {changed && <Badge tone="gold">{t('g.change')}</Badge>}
                  </span>
                </td>
                <td className="t-sm muted">{h.methodologyId.toUpperCase()}</td>
                <td className="t-sm muted" style={{ whiteSpace: 'normal', maxWidth: 340 }}>
                  {h.reason ? L(h.reason) : <span className="unavailable">—</span>}
                </td>
                <td className="t-xs muted-3">{h.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Full Shariah panel for one instrument — used on the stock profile. */
export function ShariahPanel({ symbol }: { symbol: string }) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { methodologyId, methodologies, bySymbol } = useMarket();
  const row = bySymbol.get(symbol);
  const screening = row?.screening ?? null;
  const methodology = methodologies.find((m) => m.id === methodologyId);

  return (
    <div className="stack stack-4">
      <Card>
        <CardHead
          title={t('sh.status')}
          icon="crescent"
          sub={methodology ? L(methodology.name) : methodologyId}
          right={screening && <StatusBadge provenance={screening.provenance} />}
        />
        <div className="card-body stack stack-4">
          <div className="metric-grid">
            <Metric
              label={t('sh.status')}
              value={<ShariahBadge status={screening?.status ?? 'unknown'} />}
            />
            <Metric
              label={t('sh.nonCompliantIncome')}
              value={
                <V>
                  {screening?.nonCompliantIncomePct == null
                    ? DASH
                    : fmt.pct(screening.nonCompliantIncomePct)}
                </V>
              }
            />
            <Metric
              label={t('sh.purification')}
              value={
                <V>
                  {screening?.purificationPerShare == null
                    ? DASH
                    : fmt.num(screening.purificationPerShare, { decimals: 4 })}
                </V>
              }
            />
            <Metric
              label={t('sh.screeningDate')}
              value={<V>{fmt.date(screening?.screeningDate ?? null)}</V>}
            />
          </div>
          {screening && <ShariahRatios screening={screening} />}
        </div>
      </Card>

      <Card>
        <CardHead title={t('sh.comparison')} sub={t('sh.comparisonSub')} icon="compare" />
        <MethodologyComparison symbol={symbol} />
      </Card>

      <Card>
        <CardHead title={t('sh.history')} sub={t('sh.historySub')} icon="calendar" />
        <ShariahHistory symbol={symbol} methodologyId={methodologyId} />
      </Card>
    </div>
  );
}
