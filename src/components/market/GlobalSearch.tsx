import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useDebounced, useDismiss, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { Icon, Badge, ShariahBadge } from '@/components/ui';
import { MarketFlag } from './MarketStatusPill';
import { DASH } from '@/lib/format';

/**
 * Global instrument search. Matches symbol, Arabic name, English name and
 * sector, and is debounced so a fast typist does not re-rank on every keypress.
 */
export function GlobalSearch() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { rows, sectors } = useMarket();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const debounced = useDebounced(q, 160);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    if (!needle) return [];
    const sectorHits = new Set(
      sectors
        .filter(
          (s) =>
            s.name.en.toLowerCase().includes(needle) || s.name.ar.includes(debounced.trim()),
        )
        .map((s) => s.id),
    );
    return rows
      .map((r) => {
        const sym = r.symbol.toLowerCase();
        const en = r.instrument.name.en.toLowerCase();
        const enShort = r.instrument.shortName.en.toLowerCase();
        const ar = r.instrument.name.ar;
        const arShort = r.instrument.shortName.ar;
        let score = 0;
        if (sym === needle) score = 100;
        else if (sym.startsWith(needle)) score = 92;
        else if (enShort.startsWith(needle) || arShort.startsWith(debounced.trim())) score = 84;
        else if (en.startsWith(needle) || ar.startsWith(debounced.trim())) score = 76;
        else if (
          en.includes(needle) ||
          ar.includes(debounced.trim()) ||
          enShort.includes(needle) ||
          arShort.includes(debounced.trim())
        )
          score = 55;
        else if (sym.includes(needle)) score = 40;
        else if (sectorHits.has(r.instrument.sectorId)) score = 20;
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.r.marketCap ?? 0) - (a.r.marketCap ?? 0))
      .slice(0, 10)
      .map((x) => x.r);
  }, [debounced, rows, sectors, q]);

  useEffect(() => setCursor(0), [debounced]);

  const go = (symbol: string) => {
    setOpen(false);
    setQ('');
    navigate(`/app/stock/${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <Icon name="search" className="search-icon" />
      <input
        ref={inputRef}
        className="search-field"
        value={q}
        placeholder={t('g.search')}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === 'Enter' && results[cursor]) {
            go(results[cursor].symbol);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        aria-label={t('g.search')}
        role="combobox"
        aria-expanded={open}
        aria-controls="bm-search-results"
      />
      {open && q.trim() !== '' && (
        <div className="search-results" id="bm-search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">{t('g.noResults')}</div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.symbol}
                role="option"
                aria-selected={i === cursor}
                className={`search-item ${i === cursor ? 'cursor' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r.symbol)}
              >
                <MarketFlag market={r.market} />
                <span className="sym" style={{ minWidth: 54 }}>
                  {r.symbol}
                </span>
                <span className="truncate" style={{ flex: 1 }}>
                  {L(r.instrument.shortName)}
                </span>
                <ShariahBadge status={r.shariahStatus} size="sm" />
                <span className="num t-sm" style={{ minWidth: 62, textAlign: 'end' }}>
                  {r.price == null ? DASH : fmt.num(r.price)}
                </span>
                <Badge tone={(r.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                  {r.changePct == null ? DASH : fmt.pct(r.changePct, { signed: true })}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
