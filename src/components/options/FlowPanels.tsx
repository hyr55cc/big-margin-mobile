import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import {
  Badge,
  Card,
  CardHead,
  DataTable,
  Empty,
  Notice,
  NumInput,
  Seg,
  Skeleton,
  StatusBadge,
  V,
  type Column,
} from '@/components/ui';
import { Define } from './glossary';
import { useChartTheme } from '@/components/charts';
import { DASH } from '@/lib/format';
import type { FlowTrade, OptionContract, UnusualActivity } from '@/types/options';

/* ------------------------------ Options flow --------------------------- */

const KIND_CLASS: Record<FlowTrade['kind'], string> = {
  sweep: 'flow-sweep',
  block: 'flow-block',
  split: 'flow-split',
  standard: 'flow-standard',
};

export function FlowPanel({
  trades,
  loading,
  onOpenContract,
}: {
  trades: FlowTrade[] | null;
  loading?: boolean;
  onOpenContract?: (contractSymbol: string) => void;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const theme = useChartTheme();

  const [right, setRight] = useState<'all' | 'call' | 'put'>('all');
  const [kind, setKind] = useState<'all' | FlowTrade['kind']>('all');
  const [minPremium, setMinPremium] = useState<number | null>(null);

  const rows = useMemo(() => {
    const list = trades ?? [];
    return list
      .filter((x) => right === 'all' || x.right === right)
      .filter((x) => kind === 'all' || x.kind === kind)
      .filter((x) => minPremium == null || (x.premium ?? 0) >= minPremium);
  }, [trades, right, kind, minPremium]);

  const maxPremium = useMemo(
    () => Math.max(1, ...rows.map((r) => r.premium ?? 0)),
    [rows],
  );

  const totals = useMemo(() => {
    const calls = rows.filter((r) => r.right === 'call');
    const puts = rows.filter((r) => r.right === 'put');
    const sum = (list: FlowTrade[]) => list.reduce((s, x) => s + (x.premium ?? 0), 0);
    return {
      callPremium: sum(calls),
      putPremium: sum(puts),
      callCount: calls.length,
      putCount: puts.length,
    };
  }, [rows]);

  const columns: Column<FlowTrade>[] = [
    {
      key: 'time',
      label: t('opt.time'),
      align: 'end',
      value: (x) => x.timestamp,
      render: (x) => <span className="num t-sm muted">{fmt.time(x.timestamp)}</span>,
      width: 84,
    },
    {
      key: 'contract',
      label: t('opt.contract'),
      value: (x) => x.contractSymbol,
      render: (x) => (
        <span
          className="row row-2 clickable"
          onClick={() => onOpenContract?.(x.contractSymbol)}
        >
          <span className="sym">{x.underlying}</span>
          <span className="num">{fmt.num(x.strike)}</span>
          <Badge tone={x.right === 'call' ? 'brand' : 'violet'}>
            {x.right === 'call' ? 'C' : 'P'}
          </Badge>
          <span className="t-xs muted-3 num">{fmt.date(x.expiry)}</span>
        </span>
      ),
    },
    {
      key: 'kind',
      label: t('opt.tradeKind'),
      value: (x) => x.kind,
      render: (x) => (
        <span className={`flow-kind ${KIND_CLASS[x.kind]}`}>{t(`opt.${x.kind}` as 'opt.sweep')}</span>
      ),
    },
    {
      key: 'size',
      label: t('opt.tradeSize'),
      align: 'end',
      value: (x) => x.size,
      render: (x) => <V>{fmt.int(x.size)}</V>,
    },
    {
      key: 'price',
      label: t('opt.last'),
      align: 'end',
      value: (x) => x.price,
      render: (x) => <V>{fmt.num(x.price)}</V>,
    },
    {
      key: 'premium',
      label: t('opt.premium'),
      align: 'end',
      value: (x) => x.premium,
      render: (x) => (
        <span className="row row-2 row-end">
          <span className="num">{fmt.compact(x.premium)}</span>
          <span className="prem-bar" style={{ width: 44 }}>
            <i
              style={{
                width: `${Math.min(100, ((x.premium ?? 0) / maxPremium) * 100)}%`,
                background: x.right === 'call' ? theme.brand : 'var(--bm-violet)',
              }}
            />
          </span>
        </span>
      ),
    },
    {
      key: 'side',
      label: t('opt.side'),
      value: (x) => x.side,
      render: (x) =>
        x.side == null || x.side === 'unknown' ? (
          <span className="unavailable">{DASH}</span>
        ) : (
          <Badge tone={x.side === 'at_ask' ? 'up' : x.side === 'at_bid' ? 'down' : 'neutral'}>
            {x.side === 'at_ask' ? t('opt.atAsk') : x.side === 'at_bid' ? t('opt.atBid') : t('opt.mid')}
          </Badge>
        ),
      optional: true,
    },
    {
      key: 'iv',
      label: t('opt.iv'),
      align: 'end',
      value: (x) => x.impliedVolatilityPct,
      render: (x) => <V>{x.impliedVolatilityPct == null ? DASH : fmt.pct(x.impliedVolatilityPct, { decimals: 1 })}</V>,
      optional: true,
    },
    {
      key: 'oi',
      label: t('opt.oi'),
      align: 'end',
      value: (x) => x.openInterest,
      render: (x) => <V>{fmt.int(x.openInterest)}</V>,
      optional: true,
      defaultHidden: true,
    },
  ];

  if (loading) return <Skeleton h={260} radius={16} />;

  return (
    <Card>
      <CardHead
        title={t('opt.flow')}
        sub={t('opt.flowSub')}
        icon="activity"
        right={trades && trades[0] ? <StatusBadge provenance={trades[0].provenance} /> : null}
      />

      {rows.length === 0 ? (
        <Empty icon="activity" title={t('g.unavailable')} desc={t('opt.flowSub')} />
      ) : (
        <>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-label">{t('opt.calls')} · {t('opt.premium')}</div>
                <div className="metric-value up">{fmt.compact(totals.callPremium)}</div>
                <div className="metric-sub">{fmt.int(totals.callCount)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t('opt.puts')} · {t('opt.premium')}</div>
                <div className="metric-value down">{fmt.compact(totals.putPremium)}</div>
                <div className="metric-sub">{fmt.int(totals.putCount)}</div>
              </div>
            </div>
          </div>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(x) => x.id}
            initialSort="time"
            pageSize={25}
            exportName="big-margin-options-flow"
            toolbar={
              <>
                <Seg
                  value={right}
                  onChange={setRight}
                  options={[
                    { value: 'all', label: t('g.all') },
                    { value: 'call', label: t('opt.calls') },
                    { value: 'put', label: t('opt.puts') },
                  ]}
                />
                <Seg
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'all', label: t('g.all') },
                    { value: 'sweep', label: t('opt.sweep') },
                    { value: 'block', label: t('opt.block') },
                  ]}
                />
                <div style={{ width: 150 }}>
                  <NumInput
                    value={minPremium}
                    onChange={setMinPremium}
                    step={10000}
                    min={0}
                    placeholder={t('opt.premium')}
                  />
                </div>
              </>
            }
          />
        </>
      )}

      <div className="card-foot">{t('opt.sentimentNote')}</div>
    </Card>
  );
}

/* --------------------------- Unusual activity -------------------------- */

export function UnusualPanel({
  items,
  loading,
  onOpenContract,
}: {
  items: UnusualActivity[] | null;
  loading?: boolean;
  onOpenContract?: (c: OptionContract) => void;
}) {
  const { t } = useI18n();
  const fmt = useFmt();

  const columns: Column<UnusualActivity>[] = [
    {
      key: 'contract',
      label: t('opt.contract'),
      value: (x) => x.contract.contractSymbol,
      render: (x) => (
        <span className="row row-2 clickable" onClick={() => onOpenContract?.(x.contract)}>
          <span className="sym">{x.contract.underlying}</span>
          <span className="num">{fmt.num(x.contract.strike)}</span>
          <Badge tone={x.contract.right === 'call' ? 'brand' : 'violet'}>
            {x.contract.right === 'call' ? 'C' : 'P'}
          </Badge>
        </span>
      ),
    },
    {
      key: 'expiry',
      label: t('opt.expiry'),
      align: 'end',
      value: (x) => x.contract.expiry,
      render: (x) => (
        <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
          <span className="num t-sm">{fmt.date(x.contract.expiry)}</span>
          <span className="num t-xs muted-3">
            {x.contract.dte} {t('opt.dte')}
          </span>
        </span>
      ),
    },
    {
      key: 'volume',
      label: t('opt.volume'),
      align: 'end',
      value: (x) => x.contract.volume,
      render: (x) => <V>{fmt.int(x.contract.volume)}</V>,
    },
    {
      key: 'oi',
      label: t('opt.oi'),
      align: 'end',
      value: (x) => x.contract.openInterest,
      render: (x) => <V>{fmt.int(x.contract.openInterest)}</V>,
    },
    {
      key: 'ratio',
      label: (
        <span className="row row-2">
          {t('opt.volOi')}
          <Define term="volOi" />
        </span>
      ) as unknown as string,
      align: 'end',
      value: (x) => x.volumeOiRatio,
      render: (x) => (
        // The ratio is the whole point of the table, so it carries the emphasis.
        <Badge tone={x.volumeOiRatio >= 3 ? 'gold' : x.volumeOiRatio >= 1.5 ? 'brand' : 'neutral'}>
          {fmt.num(x.volumeOiRatio, { decimals: 2 })}×
        </Badge>
      ),
    },
    {
      key: 'premium',
      label: t('opt.premium'),
      align: 'end',
      value: (x) => x.premium,
      render: (x) => <V>{fmt.compact(x.premium)}</V>,
    },
    {
      key: 'iv',
      label: t('opt.iv'),
      align: 'end',
      value: (x) => x.contract.impliedVolatilityPct,
      render: (x) => (
        <V>
          {x.contract.impliedVolatilityPct == null
            ? DASH
            : fmt.pct(x.contract.impliedVolatilityPct, { decimals: 1 })}
        </V>
      ),
      optional: true,
    },
    {
      key: 'last',
      label: t('opt.last'),
      align: 'end',
      value: (x) => x.contract.last,
      render: (x) => <V>{fmt.num(x.contract.last)}</V>,
      optional: true,
    },
  ];

  if (loading) return <Skeleton h={240} radius={16} />;

  return (
    <Card>
      <CardHead title={t('opt.unusual')} sub={t('opt.unusualSub')} icon="zap" />
      {!items || items.length === 0 ? (
        <Empty icon="zap" title={t('g.noData')} desc={t('opt.unusualSub')} />
      ) : (
        <DataTable
          rows={items}
          columns={columns}
          rowKey={(x) => x.contract.contractSymbol}
          initialSort="ratio"
          pageSize={20}
          exportName="big-margin-unusual-options"
        />
      )}
      <div className="card-foot">
        <Notice tone="info">{t('opt.unusualNote')}</Notice>
      </div>
    </Card>
  );
}
