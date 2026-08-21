import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import {
  fmtCompact,
  fmtCompactMoney,
  fmtDate,
  fmtDateTime,
  fmtInt,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtRelative,
  fmtTime,
  type FmtOpts,
} from './format';
import type { Currency } from '@/types';

/**
 * Formatting bound to the active locale and numeral preference, so pages
 * never have to thread locale options through by hand.
 */
export function useFmt() {
  const { locale, lang } = useI18n();
  const arabicNumerals = useSettings((s) => s.arabicNumerals);

  return useMemo(() => {
    const base: FmtOpts = { locale, arabicNumerals };
    return {
      num: (v: number | null | undefined, o: FmtOpts = {}) =>
        fmtNum(v, { ...base, ...o }),
      int: (v: number | null | undefined, o: FmtOpts = {}) =>
        fmtInt(v, { ...base, ...o }),
      pct: (v: number | null | undefined, o: FmtOpts = {}) =>
        fmtPct(v, { ...base, ...o }),
      money: (
        v: number | null | undefined,
        c: Currency,
        o: FmtOpts & { symbol?: boolean } = {},
      ) => fmtMoney(v, c, { ...base, lang, ...o }),
      compact: (v: number | null | undefined, o: FmtOpts = {}) =>
        fmtCompact(v, { ...base, lang, ...o }),
      compactMoney: (
        v: number | null | undefined,
        c: Currency,
        o: FmtOpts = {},
      ) => fmtCompactMoney(v, c, { ...base, lang, ...o }),
      date: (v: string | null | undefined, o: FmtOpts = {}) =>
        fmtDate(v, { ...base, ...o }),
      dateTime: (v: string | null | undefined, o: FmtOpts = {}) =>
        fmtDateTime(v, { ...base, ...o }),
      time: (
        v: string | Date | null | undefined,
        o: FmtOpts & { seconds?: boolean } = {},
      ) => fmtTime(v, { ...base, ...o }),
      relative: (v: string | null | undefined, o: FmtOpts = {}) =>
        fmtRelative(v, { ...base, ...o }),
      lang,
      locale,
    };
  }, [locale, lang, arabicNumerals]);
}

export type Fmt = ReturnType<typeof useFmt>;

/** Debounce a rapidly-changing value (search boxes, slider-driven filters). */
export function useDebounced<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Re-render on an interval, e.g. for wall-clock displays. */
export function useTick(ms = 1000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (ms <= 0) return;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Close on outside click / Escape — used by menus, popovers and modals. */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

/** Element width, for charts that must fill their container. */
export function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T>,
  number,
] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Async data loading with the loading / error / value triple every page needs.
 * Re-runs when any dependency changes; stale responses are discarded.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (alive) setState({ data: null, loading: false, error });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** Sortable / paginated table state. */
export function useTableState<K extends string>(
  initialSort: K,
  initialDir: 'asc' | 'desc' = 'desc',
  pageSize = 25,
) {
  const [sortKey, setSortKey] = useState<K>(initialSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);

  const toggleSort = useCallback(
    (key: K) => {
      setPage(0);
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          return prev;
        }
        setSortDir('desc');
        return key;
      });
    },
    [],
  );

  return {
    sortKey,
    sortDir,
    page,
    size,
    setPage,
    setSize,
    toggleSort,
    resetPage: () => setPage(0),
  };
}

/** Generic comparator that pushes null/undefined to the bottom either way. */
export function compareValues(
  a: unknown,
  b: unknown,
  dir: 'asc' | 'desc',
): number {
  const aNull = a == null || (typeof a === 'number' && !Number.isFinite(a));
  const bNull = b == null || (typeof b === 'number' && !Number.isFinite(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  let cmp: number;
  if (typeof a === 'number' && typeof b === 'number') cmp = a - b;
  else cmp = String(a).localeCompare(String(b), undefined, { numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}
