/* =========================================================================
   BIG MARGIN — Options data hooks

   Where the performance rules for a chain screen live:

   • One expiry is fetched at a time. A full options surface is tens of
     thousands of contracts; loading it up front is the classic mistake.
   • Chains are memoised per (symbol, expiry) for the session, so flicking
     between expiries costs nothing after the first visit.
   • Enrichment — solving implied volatility and pricing Greeks the vendor
     omitted — runs once when the chain arrives, not on every render.
   ========================================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOptionsProvider, isDemoOptions, optionsEnabled } from './registry';
import { enrichChain, summariseChain, type ModelParams, DEFAULT_MODEL } from '@/lib/calc/options';
import type {
  ChainSummary,
  FlowTrade,
  IvStats,
  OptionChain,
  OptionContract,
  OptionExpiry,
  UnusualActivity,
} from '@/types/options';
import type { ContractCandle } from './provider';

/* --------------------------- session caches --------------------------- */

const chainCache = new Map<string, OptionChain>();
const expiryCache = new Map<string, OptionExpiry[]>();
const availabilityCache = new Map<string, boolean>();

/** Clears every options cache — used by the settings reset and on refresh. */
export function clearOptionsCache(): void {
  chainCache.clear();
  expiryCache.clear();
  availabilityCache.clear();
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

const IDLE: AsyncState<never> = { data: null, loading: false, error: null };

function useAsyncValue<T>(
  run: (() => Promise<T>) | null,
  deps: unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>(
    run ? { data: null, loading: true, error: null } : (IDLE as AsyncState<T>),
  );
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const fn = runRef.current;
    if (!fn) {
      setState(IDLE as AsyncState<T>);
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
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

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/* ----------------------------- availability --------------------------- */

/** Whether this underlying has listed options at all. */
export function useOptionsAvailable(symbol: string | undefined): {
  available: boolean;
  loading: boolean;
} {
  const enabled = optionsEnabled() && !!symbol;

  const state = useAsyncValue(
    enabled
      ? async () => {
          const cached = availabilityCache.get(symbol as string);
          if (cached !== undefined) return cached;
          const provider = getOptionsProvider();
          if (!provider) return false;
          const ok = await provider.hasOptions(symbol as string);
          availabilityCache.set(symbol as string, ok);
          return ok;
        }
      : null,
    [symbol, enabled],
  );

  return { available: state.data === true, loading: state.loading };
}

/* ------------------------------- expiries ----------------------------- */

export function useExpiries(symbol: string | undefined) {
  const enabled = optionsEnabled() && !!symbol;
  return useAsyncValue(
    enabled
      ? async () => {
          const cached = expiryCache.get(symbol as string);
          if (cached) return cached;
          const provider = getOptionsProvider();
          if (!provider) return [];
          const list = await provider.listExpiries(symbol as string);
          expiryCache.set(symbol as string, list);
          return list;
        }
      : null,
    [symbol, enabled],
  );
}

/* -------------------------------- chain ------------------------------- */

export interface ChainState {
  chain: OptionChain | null;
  summary: ChainSummary | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * One expiry's chain, enriched and summarised. Passing a null expiry keeps
 * the hook idle, which is how the screen avoids fetching before the user has
 * chosen a date.
 */
export function useChain(
  symbol: string | undefined,
  expiry: string | null,
  model: ModelParams = DEFAULT_MODEL,
): ChainState {
  const enabled = optionsEnabled() && !!symbol && !!expiry;

  const state = useAsyncValue(
    enabled
      ? async () => {
          const key = `${symbol}|${expiry}`;
          const cached = chainCache.get(key);
          if (cached) return cached;
          const provider = getOptionsProvider();
          if (!provider) return null;
          const raw = await provider.getChain(symbol as string, expiry as string);
          if (!raw) return null;
          const enriched = enrichChain(raw, model);
          chainCache.set(key, enriched);
          return enriched;
        }
      : null,
    [symbol, expiry, enabled],
  );

  const summary = useMemo(
    () => (state.data ? summariseChain(state.data) : null),
    [state.data],
  );

  return {
    chain: state.data,
    summary,
    loading: state.loading,
    error: state.error,
    reload: () => {
      if (symbol && expiry) chainCache.delete(`${symbol}|${expiry}`);
      state.reload();
    },
  };
}

/* ------------------------------ contract ------------------------------ */

export function useContract(contractSymbol: string | null) {
  const enabled = optionsEnabled() && !!contractSymbol;
  return useAsyncValue<OptionContract | null>(
    enabled
      ? async () => {
          const provider = getOptionsProvider();
          if (!provider) return null;
          return provider.getContract(contractSymbol as string);
        }
      : null,
    [contractSymbol, enabled],
  );
}

export function useContractHistory(contractSymbol: string | null, days = 60) {
  const enabled = optionsEnabled() && !!contractSymbol;
  return useAsyncValue<ContractCandle[]>(
    enabled
      ? async () => {
          const provider = getOptionsProvider();
          if (!provider) return [];
          return provider.getContractHistory(contractSymbol as string, days);
        }
      : null,
    [contractSymbol, days, enabled],
  );
}

/* --------------------- optional vendor capabilities ------------------- */

export function useOptionsFlow(symbol: string | undefined, limit = 40) {
  const provider = getOptionsProvider();
  const enabled = optionsEnabled() && !!symbol && !!provider?.listFlow;
  return useAsyncValue<FlowTrade[]>(
    enabled ? async () => provider!.listFlow!({ symbol, limit }) : null,
    [symbol, limit, enabled],
  );
}

export function useUnusualActivity(symbol: string | undefined, limit = 20) {
  const provider = getOptionsProvider();
  const enabled = optionsEnabled() && !!symbol && !!provider?.listUnusualActivity;
  return useAsyncValue<UnusualActivity[]>(
    enabled ? async () => provider!.listUnusualActivity!({ symbol, limit }) : null,
    [symbol, limit, enabled],
  );
}

export function useIvStats(symbol: string | undefined) {
  const provider = getOptionsProvider();
  const enabled = optionsEnabled() && !!symbol && !!provider?.getIvStats;
  return useAsyncValue<IvStats | null>(
    enabled ? async () => provider!.getIvStats!(symbol as string) : null,
    [symbol, enabled],
  );
}

/* ------------------------------- meta --------------------------------- */

export function useOptionsMeta() {
  const provider = getOptionsProvider();
  return {
    enabled: optionsEnabled(),
    isDemo: isDemoOptions(),
    providerName: provider?.info.name ?? null,
    capabilities: provider?.info.capabilities ?? null,
    delayMinutes: provider?.info.delayMinutes ?? null,
  };
}
