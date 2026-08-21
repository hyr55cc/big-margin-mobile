import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt, useDebounced, useDismiss } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { DASH } from '@/lib/format';
import { Badge, Icon } from '@/components/ui';
import { MarketFlag } from './MarketStatusPill';

/** Symbol + localized company name, linking to the stock profile. */
export function SymbolCell({
  row,
  showFlag,
  short = true,
}: {
  row: MarketRow;
  showFlag?: boolean;
  short?: boolean;
}) {
  const { L } = useI18n();
  return (
    <Link to={`/app/stock/${encodeURIComponent(row.symbol)}`} className="row row-3">
      {showFlag && <MarketFlag market={row.market} />}
      <span className="sym" style={{ minWidth: 50 }}>
        {row.symbol}
      </span>
      <span className="co-name">
        <span className="n1">
          {L(short ? row.instrument.shortName : row.instrument.name)}
        </span>
        {row.sector && <span className="n2">{L(row.sector.name)}</span>}
      </span>
    </Link>
  );
}

/** Price plus the day's change, the pairing used in every list. */
export function PriceCell({ row }: { row: MarketRow }) {
  const fmt = useFmt();
  if (row.price == null) return <span className="unavailable">{DASH}</span>;
  return (
    <span className="row row-2 row-end">
      <span className="num">{fmt.num(row.price)}</span>
      <Badge tone={(row.changePct ?? 0) > 0 ? 'up' : (row.changePct ?? 0) < 0 ? 'down' : 'flat'}>
        {row.changePct == null ? DASH : fmt.pct(row.changePct, { signed: true })}
      </Badge>
    </span>
  );
}

/** Index weight with an inline magnitude bar. */
export function WeightCell({ value, max = 12 }: { value: number | null; max?: number }) {
  const fmt = useFmt();
  if (value == null) return <span className="unavailable">{DASH}</span>;
  return (
    <span className="row row-2 row-end">
      <span className="num">{fmt.pct(value, { decimals: 3 })}</span>
      <span className="wbar" style={{ width: 54 }}>
        <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
    </span>
  );
}

/* --------------------------- Instrument picker ------------------------ */

/**
 * Typeahead used by the calculators, comparison and watchlist screens.
 * Selecting a row hands back the full MarketRow so callers get price, weight
 * and Shariah status together rather than only a symbol.
 */
export function InstrumentPicker({
  onPick,
  placeholder,
  exclude = [],
  marketFilter,
}: {
  onPick: (row: MarketRow) => void;
  placeholder?: string;
  exclude?: string[];
  marketFilter?: 'SA' | 'US';
}) {
  const { t, L } = useI18n();
  const { rows } = useMarket();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 140);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  const results = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    if (!needle) return [];
    const skip = new Set(exclude);
    return rows
      .filter((r) => !skip.has(r.symbol) && (!marketFilter || r.market === marketFilter))
      .filter(
        (r) =>
          r.symbol.toLowerCase().includes(needle) ||
          r.instrument.name.en.toLowerCase().includes(needle) ||
          r.instrument.shortName.en.toLowerCase().includes(needle) ||
          r.instrument.name.ar.includes(debounced.trim()) ||
          r.instrument.shortName.ar.includes(debounced.trim()),
      )
      .slice(0, 8);
  }, [debounced, rows, exclude, marketFilter]);

  return (
    <div className="search-wrap" ref={ref} style={{ maxWidth: 'none' }}>
      <Icon name="search" className="search-icon" />
      <input
        className="search-field"
        value={q}
        placeholder={placeholder ?? t('g.search')}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div
              key={r.symbol}
              className="search-item"
              onClick={() => {
                onPick(r);
                setQ('');
                setOpen(false);
              }}
            >
              <MarketFlag market={r.market} />
              <span className="sym" style={{ minWidth: 52 }}>
                {r.symbol}
              </span>
              <span className="truncate" style={{ flex: 1 }}>
                {L(r.instrument.shortName)}
              </span>
              {r.weightPct != null && (
                <span className="t-xs muted-3 num">{r.weightPct.toFixed(2)}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
