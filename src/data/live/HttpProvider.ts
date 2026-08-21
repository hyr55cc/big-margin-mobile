/* =========================================================================
   BIG MARGIN — HTTP provider

   Talks to the BIG MARGIN backend, never to a vendor API directly: vendor
   credentials belong on the server, never in a browser bundle. The backend is
   responsible for normalising each upstream feed into the shapes in
   `src/types`, including the provenance envelope on every record.

   Endpoint map (REST, versioned):
     GET /instruments?market=SA
     GET /instruments/:symbol
     GET /sectors?market=SA
     GET /search?q=...&limit=12
     GET /markets/:market/status
     GET /indices?market=SA
     GET /indices/:indexId
     GET /indices/:indexId/constituents
     GET /indices/:indexId/divisor
     GET /indices/:indexId/series?timeframe=1Y
     GET /quotes?market=SA
     GET /quotes/:symbol
     GET /quotes/:symbol/series?timeframe=1Y
     GET /fundamentals?market=SA
     GET /fundamentals/:symbol
     GET /shariah/methodologies
     GET /shariah/screenings?methodology=aaoifi&market=SA
     GET /shariah/screenings/:symbol?methodology=aaoifi
     GET /shariah/history/:symbol?methodology=aaoifi
     GET /dividends?market=SA&symbol=2222
     GET /corporate-actions?market=SA&symbol=2222
     GET /earnings?market=SA&symbol=2222
     GET /news?market=SA&symbol=2222&limit=40
     GET /ops/sync
     GET /ops/validation
   ========================================================================= */

import type {
  MarketDataProvider,
  ProviderInfo,
  SyncJobStatus,
  ValidationIssue,
} from '../provider';
import type {
  CorporateAction,
  Dividend,
  EarningsEvent,
  Fundamentals,
  IndexConstituent,
  IndexQuote,
  Instrument,
  MarketId,
  MarketStatus,
  NewsItem,
  PriceSeries,
  Quote,
  Sector,
  ShariahHistoryEntry,
  ShariahMethodology,
  ShariahScreening,
  Timeframe,
} from '@/types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new ApiError(
      'VITE_API_BASE_URL is not configured; the HTTP provider cannot reach a backend.',
      0,
      path,
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status, path);
  }
  return (await res.json()) as T;
}

/** Returns null on 404 instead of throwing, for single-record lookups. */
async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

const info: ProviderInfo = {
  id: 'http',
  name: 'BIG MARGIN API',
  production: true,
  description:
    'Live data served by the BIG MARGIN backend. Upstream vendors, credentials, caching and scheduled synchronisation are handled server-side.',
  capabilities: {
    quotes: true,
    series: true,
    indexWeights: true,
    shariah: true,
    dividends: true,
    corporateActions: true,
    earnings: true,
    news: true,
  },
};

export const HttpProvider: MarketDataProvider = {
  info,

  listInstruments: (market?: MarketId) =>
    get<Instrument[]>(`/instruments${qs({ market })}`),
  getInstrument: (symbol: string) =>
    getOrNull<Instrument>(`/instruments/${encodeURIComponent(symbol)}`),
  listSectors: (market?: MarketId) => get<Sector[]>(`/sectors${qs({ market })}`),
  searchInstruments: (query: string, limit = 12) =>
    get<Instrument[]>(`/search${qs({ q: query, limit })}`),

  getMarketStatus: (market: MarketId) =>
    get<MarketStatus>(`/markets/${market}/status`),
  listIndices: (market?: MarketId) => get<IndexQuote[]>(`/indices${qs({ market })}`),
  getIndex: (indexId: string) => getOrNull<IndexQuote>(`/indices/${indexId}`),
  getQuote: (symbol: string) =>
    getOrNull<Quote>(`/quotes/${encodeURIComponent(symbol)}`),
  listQuotes: (market?: MarketId) => get<Quote[]>(`/quotes${qs({ market })}`),
  getSeries: (symbol: string, timeframe: Timeframe) =>
    getOrNull<PriceSeries>(
      `/quotes/${encodeURIComponent(symbol)}/series${qs({ timeframe })}`,
    ),
  getIndexSeries: (indexId: string, timeframe: Timeframe) =>
    getOrNull<PriceSeries>(`/indices/${indexId}/series${qs({ timeframe })}`),
  getFundamentals: (symbol: string) =>
    getOrNull<Fundamentals>(`/fundamentals/${encodeURIComponent(symbol)}`),
  listFundamentals: (market?: MarketId) =>
    get<Fundamentals[]>(`/fundamentals${qs({ market })}`),

  listConstituents: (indexId: string) =>
    get<IndexConstituent[]>(`/indices/${indexId}/constituents`),
  getConstituent: (indexId: string, symbol: string) =>
    getOrNull<IndexConstituent>(
      `/indices/${indexId}/constituents/${encodeURIComponent(symbol)}`,
    ),
  getIndexDivisor: async (indexId: string) => {
    const r = await getOrNull<{ divisor: number | null }>(
      `/indices/${indexId}/divisor`,
    );
    return r?.divisor ?? null;
  },

  listMethodologies: () => get<ShariahMethodology[]>('/shariah/methodologies'),
  getScreening: (symbol: string, methodologyId: string) =>
    getOrNull<ShariahScreening>(
      `/shariah/screenings/${encodeURIComponent(symbol)}${qs({ methodology: methodologyId })}`,
    ),
  listScreenings: (methodologyId: string, market?: MarketId) =>
    get<ShariahScreening[]>(
      `/shariah/screenings${qs({ methodology: methodologyId, market })}`,
    ),
  getScreeningHistory: (symbol: string, methodologyId?: string) =>
    get<ShariahHistoryEntry[]>(
      `/shariah/history/${encodeURIComponent(symbol)}${qs({ methodology: methodologyId })}`,
    ),

  listDividends: (opts = {}) =>
    get<Dividend[]>(`/dividends${qs({ market: opts.market, symbol: opts.symbol })}`),
  listCorporateActions: (opts = {}) =>
    get<CorporateAction[]>(
      `/corporate-actions${qs({ market: opts.market, symbol: opts.symbol })}`,
    ),
  listEarnings: (opts = {}) =>
    get<EarningsEvent[]>(`/earnings${qs({ market: opts.market, symbol: opts.symbol })}`),
  listNews: (opts = {}) =>
    get<NewsItem[]>(
      `/news${qs({ market: opts.market, symbol: opts.symbol, limit: opts.limit })}`,
    ),

  getSyncStatus: () => get<SyncJobStatus[]>('/ops/sync'),
  getValidationIssues: () => get<ValidationIssue[]>('/ops/validation'),
};
