import { cloneElement, useMemo, type MouseEvent, type ReactElement } from 'react';
import { useI18n } from '@/i18n';
import { useFmt, useMediaQuery } from '@/lib/hooks';
import { Empty, Skeleton, StatusBadge } from '@/components/ui';
import { Define } from './glossary';
import { analyseContract, midPrice } from '@/lib/calc/options';
import { DASH } from '@/lib/format';
import type {
  ChainFilters,
  ChainRow,
  OptionChain,
  OptionContract,
  OptionRight,
} from '@/types/options';

export type SideMode = 'call' | 'put' | 'both';

/* ------------------------------- filtering ----------------------------- */

function passesFilters(
  c: OptionContract | null,
  spot: number | null,
  f: ChainFilters,
): boolean {
  if (!c) return false;
  const a = analyseContract(c, spot);

  if (f.moneyness !== 'all' && a.moneyness !== f.moneyness) return false;
  if (f.minVolume != null && (c.volume ?? -1) < f.minVolume) return false;
  if (f.minOpenInterest != null && (c.openInterest ?? -1) < f.minOpenInterest) return false;
  if (f.minIvPct != null && (c.impliedVolatilityPct ?? -1) < f.minIvPct) return false;
  if (f.maxIvPct != null && (c.impliedVolatilityPct ?? Infinity) > f.maxIvPct) return false;

  // Delta is compared on magnitude so one range covers both calls and puts.
  const absDelta = c.greeks.delta == null ? null : Math.abs(c.greeks.delta);
  if (f.minDelta != null && (absDelta ?? -1) < f.minDelta) return false;
  if (f.maxDelta != null && (absDelta ?? Infinity) > f.maxDelta) return false;

  const mid = a.mid;
  if (f.minPremium != null && (mid ?? -1) < f.minPremium) return false;
  if (f.maxPremium != null && (mid ?? Infinity) > f.maxPremium) return false;
  if (f.maxSpreadPct != null && (a.spreadPct ?? Infinity) > f.maxSpreadPct) return false;

  return true;
}

/** Applies strike bounds, the near-the-money window, and per-contract filters. */
export function filterRows(
  chain: OptionChain,
  filters: ChainFilters,
  side: SideMode,
): ChainRow[] {
  const spot = chain.underlyingPrice;
  let rows = chain.rows;

  if (filters.minStrike != null) rows = rows.filter((r) => r.strike >= filters.minStrike!);
  if (filters.maxStrike != null) rows = rows.filter((r) => r.strike <= filters.maxStrike!);

  // The window is the single most useful control on a long ladder: it keeps
  // the rows a trader actually reads and drops the tails.
  if (filters.strikeWindow != null && spot != null && rows.length > filters.strikeWindow) {
    const sorted = [...rows].sort(
      (a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot),
    );
    const keep = new Set(sorted.slice(0, filters.strikeWindow).map((r) => r.strike));
    rows = rows.filter((r) => keep.has(r.strike));
  }

  return rows.filter((r) => {
    const callOk = passesFilters(r.call, spot, filters);
    const putOk = passesFilters(r.put, spot, filters);
    if (side === 'call') return callOk;
    if (side === 'put') return putOk;
    return callOk || putOk;
  });
}

/* ------------------------------- rendering ----------------------------- */

interface CellProps {
  c: OptionContract | null;
  itm: boolean;
  onOpen: (c: OptionContract) => void;
  showExtendedGreeks: boolean;
  right: OptionRight;
  reverse: boolean;
}

function SideCells({ c, itm, showExtendedGreeks, reverse, onOpen }: CellProps) {
  const fmt = useFmt();
  const cls = itm ? (c?.right === 'put' ? 'itm-put' : 'itm') : '';
  const n = (v: number | null | undefined, dp = 2) =>
    v == null || !Number.isFinite(v) ? <span className="na">{DASH}</span> : fmt.num(v, { decimals: dp });
  const compact = (v: number | null | undefined) =>
    v == null ? <span className="na">{DASH}</span> : fmt.int(v);

  // Columns mirror around the strike ladder, which is the convention every
  // chain uses: the fields nearest the strike are the ones read first.
  const cells = [
    <td key="vol" className={cls}>{compact(c?.volume)}</td>,
    <td key="oi" className={cls}>{compact(c?.openInterest)}</td>,
    <td key="iv" className={cls}>
      {c?.impliedVolatilityPct == null ? (
        <span className="na">{DASH}</span>
      ) : (
        fmt.pct(c.impliedVolatilityPct, { decimals: 1 })
      )}
    </td>,
    ...(showExtendedGreeks
      ? [
          <td key="gamma" className={cls}>{n(c?.greeks.gamma, 4)}</td>,
          <td key="theta" className={cls}>{n(c?.greeks.theta, 3)}</td>,
          <td key="vega" className={cls}>{n(c?.greeks.vega, 3)}</td>,
        ]
      : []),
    <td key="delta" className={cls}>{n(c?.greeks.delta, 3)}</td>,
    <td key="chg" className={cls}>
      {c?.changePct == null ? (
        <span className="na">{DASH}</span>
      ) : (
        <span className={c.changePct >= 0 ? 'up' : 'down'}>
          {fmt.pct(c.changePct, { signed: true, decimals: 1 })}
        </span>
      )}
    </td>,
    <td key="bid" className={cls}>{n(c?.bid)}</td>,
    <td key="ask" className={cls}>{n(c?.ask)}</td>,
    <td key="last" className={`${cls} muted-cell`}>{n(c?.last)}</td>,
  ];

  // The side you click is the contract you get. Without this the row handler
  // would open the call no matter which half of a two-sided chain was clicked,
  // which is the wrong contract half the time.
  const ordered = reverse ? cells.slice().reverse() : cells;
  const open = c
    ? (e: MouseEvent) => {
        e.stopPropagation();
        onOpen(c);
      }
    : undefined;

  return (
    <>
      {ordered.map((cell) =>
        cloneElement(cell as ReactElement<{ onClick?: (e: MouseEvent) => void }>, { onClick: open }),
      )}
    </>
  );
}

function headerCells(
  labels: { vol: string; oi: string; iv: string; delta: string; chg: string; bid: string; ask: string; last: string; gamma: string; theta: string; vega: string },
  showExtendedGreeks: boolean,
  reverse: boolean,
) {
  const cells = [
    <th key="vol"><span className="row row-2">{labels.vol}<Define term="volume" /></span></th>,
    <th key="oi"><span className="row row-2">{labels.oi}<Define term="oi" /></span></th>,
    <th key="iv"><span className="row row-2">{labels.iv}<Define term="iv" /></span></th>,
    ...(showExtendedGreeks
      ? [
          <th key="gamma"><span className="row row-2">{labels.gamma}<Define term="gamma" /></span></th>,
          <th key="theta"><span className="row row-2">{labels.theta}<Define term="theta" /></span></th>,
          <th key="vega"><span className="row row-2">{labels.vega}<Define term="vega" /></span></th>,
        ]
      : []),
    <th key="delta"><span className="row row-2">{labels.delta}<Define term="delta" /></span></th>,
    <th key="chg">{labels.chg}</th>,
    <th key="bid">{labels.bid}</th>,
    <th key="ask">{labels.ask}</th>,
    <th key="last">{labels.last}</th>,
  ];
  return reverse ? cells.slice().reverse() : cells;
}

export function OptionsChain({
  chain,
  filters,
  side,
  showExtendedGreeks = false,
  loading,
  onOpenContract,
}: {
  chain: OptionChain | null;
  filters: ChainFilters;
  side: SideMode;
  showExtendedGreeks?: boolean;
  loading?: boolean;
  onOpenContract: (c: OptionContract) => void;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  // A centre column cannot be frozen in a horizontally scrolling table, so a
  // narrow screen shows one side with the strike pinned at the leading edge.
  const narrow = useMediaQuery('(max-width: 900px)');
  const effectiveSide: SideMode = narrow && side === 'both' ? 'call' : side;

  const rows = useMemo(
    () => (chain ? filterRows(chain, filters, effectiveSide) : []),
    [chain, filters, effectiveSide],
  );

  const spot = chain?.underlyingPrice ?? null;

  const labels = {
    vol: t('opt.volume'),
    oi: t('opt.oi'),
    iv: t('opt.iv'),
    delta: t('opt.delta'),
    chg: t('g.changePct'),
    bid: t('opt.bid'),
    ask: t('opt.ask'),
    last: t('opt.last'),
    gamma: t('opt.gamma'),
    theta: t('opt.theta'),
    vega: t('opt.vega'),
  };

  if (loading) {
    return (
      <div className="stack stack-2" style={{ padding: 'var(--s-4)' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} h={22} />
        ))}
      </div>
    );
  }

  if (!chain) {
    return <Empty icon="calendar" title={t('opt.selectExpiry')} />;
  }

  if (rows.length === 0) {
    return <Empty title={t('g.noResults')} desc={t('g.noResultsHint')} />;
  }

  const both = effectiveSide === 'both';
  const perSideCols = 8 + (showExtendedGreeks ? 3 : 0);

  // The spot marker is inserted between the two strikes that straddle the
  // underlying price, so the chain reads with the market in the middle.
  let spotInserted = spot == null;

  return (
    <div className="chain-wrap">
      <table className={`chain ${both ? '' : 'single'}`}>
        <thead>
          {both && (
            <tr>
              <th className="side-head side-call" colSpan={perSideCols}>
                {t('opt.calls')}
              </th>
              <th className="strike side-head">{t('opt.strike')}</th>
              <th className="side-head side-put" colSpan={perSideCols}>
                {t('opt.puts')}
              </th>
            </tr>
          )}
          <tr>
            {both && headerCells(labels, showExtendedGreeks, true)}
            {!both && (
              <th className="strike">
                <span className="row row-2" style={{ justifyContent: 'center' }}>
                  {t('opt.strike')}
                  <Define term="strike" />
                </span>
              </th>
            )}
            {both && (
              <th className="strike">
                <span className="row row-2" style={{ justifyContent: 'center' }}>
                  <Define term="strike" />
                </span>
              </th>
            )}
            {!both && headerCells(labels, showExtendedGreeks, false)}
            {both && headerCells(labels, showExtendedGreeks, false)}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const callItm = spot != null && row.strike < spot;
            const putItm = spot != null && row.strike > spot;
            const isAtm =
              spot != null &&
              Math.abs(row.strike - spot) / spot <= 0.005;

            const marker =
              !spotInserted && spot != null && row.strike > spot ? (
                <tr className="spot-row" key={`spot-${row.strike}`}>
                  <td colSpan={both ? perSideCols * 2 + 1 : perSideCols + 1}>
                    {t('opt.spot')} · {fmt.num(spot)}
                  </td>
                </tr>
              ) : null;
            if (marker) spotInserted = true;

            const shown = effectiveSide === 'put' ? row.put : row.call;

            return (
              <>
                {marker}
                <tr
                  key={row.strike}
                  className={`clickable ${isAtm ? 'atm' : ''}`}
                  onClick={() => {
                    const target = both ? (row.call ?? row.put) : shown;
                    if (target) onOpenContract(target);
                  }}
                >
                  {both && (
                    <SideCells
                      c={row.call}
                      itm={callItm}
                      right="call"
                      reverse
                      showExtendedGreeks={showExtendedGreeks}
                      onOpen={onOpenContract}
                    />
                  )}

                  <td className="strike">{fmt.num(row.strike, { decimals: 2 })}</td>

                  {!both && (
                    <SideCells
                      c={shown ?? null}
                      itm={effectiveSide === 'put' ? putItm : callItm}
                      right={effectiveSide === 'put' ? 'put' : 'call'}
                      reverse={false}
                      showExtendedGreeks={showExtendedGreeks}
                      onOpen={onOpenContract}
                    />
                  )}

                  {both && (
                    <SideCells
                      c={row.put}
                      itm={putItm}
                      right="put"
                      reverse={false}
                      showExtendedGreeks={showExtendedGreeks}
                      onOpen={onOpenContract}
                    />
                  )}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>

      <div
        className="row row-3 row-wrap"
        style={{ padding: 'var(--s-3) var(--s-4)', borderTop: '1px solid var(--border)' }}
      >
        <StatusBadge provenance={chain.provenance} />
        <span className="t-xs muted-3">
          {rows.length} {t('opt.strike')} · {chain.dte} {t('opt.dte')}
        </span>
        {narrow && side === 'both' && (
          <span className="t-xs muted-3">{t('opt.calls')}</span>
        )}
      </div>
    </div>
  );
}

export { midPrice };
