import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Card, CardHead, Empty, Seg, StatusBadge } from '@/components/ui';
import { BarChart, LineChart, seriesColor, useChartTheme } from '@/components/charts';
import { Define } from './glossary';
import type { ChainSummary, OptionChain } from '@/types/options';

type ChartKind = 'oi' | 'volume' | 'iv' | 'greek';
type GreekKind = 'delta' | 'gamma' | 'theta' | 'vega';

/**
 * The chain seen sideways: distribution across strikes rather than row by row.
 *
 * Open interest and volume are drawn on a signed axis with calls above zero
 * and puts below. That is the conventional reading of an options histogram —
 * one axis, two sides — and it avoids the dual-axis chart that comparing two
 * series would otherwise invite. Every bar keeps a signed numeric label, so
 * the call/put split never rests on colour alone.
 */
export function ChainCharts({
  chain,
  summary,
}: {
  chain: OptionChain;
  summary: ChainSummary | null;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const theme = useChartTheme();
  const [kind, setKind] = useState<ChartKind>('oi');
  const [greek, setGreek] = useState<GreekKind>('delta');

  const spot = chain.underlyingPrice;

  // Charting the whole ladder buries the readable part, so the window follows
  // the money the same way the chain's own default does.
  const rows = useMemo(() => {
    if (spot == null) return chain.rows;
    return [...chain.rows]
      .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
      .slice(0, 24)
      .sort((a, b) => a.strike - b.strike);
  }, [chain.rows, spot]);

  const signedItems = useMemo(() => {
    const pick = (side: 'call' | 'put') =>
      rows.map((r) => {
        const c = side === 'call' ? r.call : r.put;
        const raw = kind === 'oi' ? c?.openInterest : c?.volume;
        return raw ?? null;
      });

    const callValues = pick('call');
    const putValues = pick('put');

    return rows.flatMap((r, i) => {
      const call = callValues[i];
      const put = putValues[i];
      const out: Array<{ key: string; label: string; value: number | null; color?: string; sub?: string }> = [];
      if (call != null) {
        out.push({
          key: `c-${r.strike}`,
          label: `${fmt.num(r.strike, { decimals: 0 })} C`,
          value: call,
          color: theme.brand,
          sub: t('opt.calls'),
        });
      }
      if (put != null) {
        out.push({
          key: `p-${r.strike}`,
          label: `${fmt.num(r.strike, { decimals: 0 })} P`,
          value: -put,
          color: seriesColor(theme, 6),
          sub: t('opt.puts'),
        });
      }
      return out;
    });
  }, [rows, kind, fmt, theme, t]);

  const ivSeries = useMemo(() => {
    const call = rows
      .filter((r) => r.call?.impliedVolatilityPct != null)
      .map((r) => ({ t: String(r.strike), v: r.call!.impliedVolatilityPct as number }));
    const put = rows
      .filter((r) => r.put?.impliedVolatilityPct != null)
      .map((r) => ({ t: String(r.strike), v: r.put!.impliedVolatilityPct as number }));
    return [
      { key: 'call-iv', name: t('opt.calls'), points: call, color: theme.brand },
      { key: 'put-iv', name: t('opt.puts'), points: put, color: seriesColor(theme, 6) },
    ].filter((s) => s.points.length > 1);
  }, [rows, t, theme]);

  const greekSeries = useMemo(() => {
    const build = (side: 'call' | 'put') =>
      rows
        .map((r) => {
          const c = side === 'call' ? r.call : r.put;
          const v = c?.greeks[greek];
          return v == null ? null : { t: String(r.strike), v };
        })
        .filter((x): x is { t: string; v: number } => x != null);

    const call = build('call');
    const put = build('put');
    return [
      { key: 'call-g', name: t('opt.calls'), points: call, color: theme.brand },
      { key: 'put-g', name: t('opt.puts'), points: put, color: seriesColor(theme, 6) },
    ].filter((s) => s.points.length > 1);
  }, [rows, greek, t, theme]);

  const title =
    kind === 'oi'
      ? t('opt.chartOi')
      : kind === 'volume'
        ? t('opt.chartVolume')
        : kind === 'iv'
          ? t('opt.chartIv')
          : t('opt.chartGreek');

  return (
    <Card>
      <CardHead
        title={title}
        icon="activity"
        right={
          <>
            {kind === 'greek' && (
              <Seg
                value={greek}
                onChange={setGreek}
                options={(['delta', 'gamma', 'theta', 'vega'] as GreekKind[]).map((g) => ({
                  value: g,
                  label: t(`opt.${g}` as 'opt.delta'),
                }))}
              />
            )}
            <Seg
              value={kind}
              onChange={setKind}
              options={[
                { value: 'oi', label: t('opt.oi') },
                { value: 'volume', label: t('opt.volume') },
                { value: 'iv', label: t('opt.iv') },
                { value: 'greek', label: t('opt.greeks') },
              ]}
            />
            <StatusBadge provenance={chain.provenance} />
          </>
        }
      />
      <div className="card-body stack stack-4">
        {(kind === 'oi' || kind === 'volume') &&
          (signedItems.length === 0 ? (
            <Empty title={t('g.unavailable')} />
          ) : (
            <>
              <BarChart
                signed
                barHeight={13}
                items={signedItems}
                formatValue={(v) => fmt.compact(Math.abs(v))}
              />
              <div className="legend">
                <span className="k">
                  <i className="sw" style={{ background: theme.brand }} />
                  {t('opt.calls')}
                </span>
                <span className="k">
                  <i className="sw" style={{ background: seriesColor(theme, 6) }} />
                  {t('opt.puts')}
                </span>
              </div>
            </>
          ))}

        {kind === 'iv' &&
          (ivSeries.length === 0 ? (
            <Empty title={t('g.unavailable')} />
          ) : (
            <LineChart
              height={260}
              area={false}
              series={ivSeries}
              formatValue={(v) => fmt.pct(v, { decimals: 0 })}
              formatLabel={(x) => fmt.num(Number(x), { decimals: 0 })}
            />
          ))}

        {kind === 'greek' &&
          (greekSeries.length === 0 ? (
            <Empty title={t('g.unavailable')} />
          ) : (
            <LineChart
              height={260}
              area={false}
              series={greekSeries}
              formatValue={(v) => fmt.num(v, { decimals: 3 })}
              formatLabel={(x) => fmt.num(Number(x), { decimals: 0 })}
            />
          ))}

        {summary && (
          <div className="metric-grid" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s-4)' }}>
            <MetricLine label={t('opt.callVolume')} value={fmt.compact(summary.callVolume)} />
            <MetricLine label={t('opt.putVolume')} value={fmt.compact(summary.putVolume)} />
            <MetricLine label={t('opt.pcVolumeRatio')} value={summary.putCallVolumeRatio == null ? '—' : fmt.num(summary.putCallVolumeRatio, { decimals: 2 })} />
            <MetricLine label={t('opt.pcOiRatio')} value={summary.putCallOiRatio == null ? '—' : fmt.num(summary.putCallOiRatio, { decimals: 2 })} />
            <MetricLine label={t('opt.avgIv')} value={summary.averageIvPct == null ? '—' : fmt.pct(summary.averageIvPct)} />
            <MetricLine
              label={
                <span className="row row-2">
                  {t('opt.maxPain')}
                  <Define term="maxPain" />
                </span>
              }
              value={summary.maxPainStrike == null ? '—' : fmt.num(summary.maxPainStrike)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function MetricLine({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value sm">{value}</div>
    </div>
  );
}
