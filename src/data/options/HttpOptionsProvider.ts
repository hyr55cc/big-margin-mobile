/* =========================================================================
   BIG MARGIN — Options HTTP provider

   Talks to the BIG MARGIN backend, never to an options vendor directly.
   Options entitlements are the most tightly licensed data in the product, so
   the credential and the entitlement check belong on the server.

   Endpoint map (REST, versioned — mirrors the equity provider's shape):
     GET /options/:symbol/available            -> { hasOptions: boolean }
     GET /options/:symbol/expiries             -> OptionExpiry[]
     GET /options/:symbol/chain?expiry=…       -> OptionChain
     GET /options/contracts/:contractSymbol    -> OptionContract
     GET /options/contracts/:contractSymbol/history?days=60 -> ContractCandle[]
     GET /options/flow?symbol=…&limit=…&minPremium=…        -> FlowTrade[]
     GET /options/unusual?symbol=…&limit=…                  -> UnusualActivity[]
     GET /options/:symbol/iv-stats                          -> IvStats
   ========================================================================= */

import type {
  FlowTrade,
  IvStats,
  OptionChain,
  OptionContract,
  OptionExpiry,
  UnusualActivity,
} from '@/types/options';
import type { ContractCandle, OptionsDataProvider, OptionsProviderInfo } from './provider';

const BASE = (import.meta.env.VITE_OPTIONS_API_BASE_URL as string | undefined)
  ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? '';

export class OptionsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'OptionsApiError';
  }
}

async function get<T>(path: string): Promise<T> {
  if (!BASE) {
    throw new OptionsApiError(
      'No options API base URL is configured; set VITE_OPTIONS_API_BASE_URL.',
      0,
      path,
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new OptionsApiError(`Request failed (${res.status})`, res.status, path);
  }
  return (await res.json()) as T;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (e) {
    if (e instanceof OptionsApiError && e.status === 404) return null;
    throw e;
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

const info: OptionsProviderInfo = {
  id: 'http-options',
  name: 'BIG MARGIN Options API',
  production: true,
  description:
    'Options chains served by the BIG MARGIN backend. Vendor entitlements, credentials, caching and the Greeks the vendor supplies are handled server-side; anything the vendor omits is computed client-side and labelled Calculated.',
  markets: ['US'],
  capabilities: {
    chains: true,
    greeks: true,
    impliedVolatility: true,
    contractHistory: true,
    flow: true,
    unusualActivity: true,
    ivStatistics: true,
  },
  delayMinutes: null,
};

const enc = encodeURIComponent;

export const HttpOptionsProvider: OptionsDataProvider = {
  info,

  async hasOptions(symbol) {
    const r = await getOrNull<{ hasOptions: boolean }>(`/options/${enc(symbol)}/available`);
    return r?.hasOptions ?? false;
  },

  listExpiries: (symbol) => get<OptionExpiry[]>(`/options/${enc(symbol)}/expiries`),

  getChain: (symbol, expiry) =>
    getOrNull<OptionChain>(`/options/${enc(symbol)}/chain${qs({ expiry })}`),

  getContract: (contractSymbol) =>
    getOrNull<OptionContract>(`/options/contracts/${enc(contractSymbol)}`),

  getContractHistory: (contractSymbol, days = 60) =>
    get<ContractCandle[]>(`/options/contracts/${enc(contractSymbol)}/history${qs({ days })}`),

  listFlow: (opts = {}) =>
    get<FlowTrade[]>(
      `/options/flow${qs({ symbol: opts.symbol, limit: opts.limit, minPremium: opts.minPremium })}`,
    ),

  listUnusualActivity: (opts = {}) =>
    get<UnusualActivity[]>(`/options/unusual${qs({ symbol: opts.symbol, limit: opts.limit })}`),

  getIvStats: (symbol) => getOrNull<IvStats>(`/options/${enc(symbol)}/iv-stats`),
};
