/* =========================================================================
   BIG MARGIN — Data provider contract

   Every screen in the application reads through this interface. Swapping the
   demo dataset for a real feed means implementing MarketDataProvider once;
   no page imports a dataset directly.

   Contract rules:
   • A provider never invents a value. Unknown fields are null and the record's
     provenance carries status 'unavailable' with a reason.
   • Every record returned carries provenance (source, asOf, lastUpdated,
     status) so the UI can label each figure.
   • Index weights and Shariah classifications are sourced data, never derived
     by the frontend. Impact figures ARE derived, and are labelled 'calculated'.
   ========================================================================= */

import type {
  Alert,
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

export interface ProviderInfo {
  id: string;
  name: string;
  /** True only for a feed carrying production market data. */
  production: boolean;
  description: string;
  capabilities: {
    quotes: boolean;
    series: boolean;
    indexWeights: boolean;
    shariah: boolean;
    dividends: boolean;
    corporateActions: boolean;
    earnings: boolean;
    news: boolean;
  };
}

export interface SyncJobStatus {
  id: string;
  label: { ar: string; en: string };
  schedule: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  records: number | null;
  state: 'ok' | 'stale' | 'failed' | 'never_run';
  message?: string;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  entity: string;
  recordId: string;
  field: string;
  message: { ar: string; en: string };
  detectedAt: string;
}

export interface MarketDataProvider {
  readonly info: ProviderInfo;

  /* ---- reference ---- */
  listInstruments(market?: MarketId): Promise<Instrument[]>;
  getInstrument(symbol: string): Promise<Instrument | null>;
  listSectors(market?: MarketId): Promise<Sector[]>;
  searchInstruments(query: string, limit?: number): Promise<Instrument[]>;

  /* ---- market ---- */
  getMarketStatus(market: MarketId): Promise<MarketStatus>;
  listIndices(market?: MarketId): Promise<IndexQuote[]>;
  getIndex(indexId: string): Promise<IndexQuote | null>;
  getQuote(symbol: string): Promise<Quote | null>;
  listQuotes(market?: MarketId): Promise<Quote[]>;
  getSeries(symbol: string, timeframe: Timeframe): Promise<PriceSeries | null>;
  getIndexSeries(indexId: string, timeframe: Timeframe): Promise<PriceSeries | null>;
  getFundamentals(symbol: string): Promise<Fundamentals | null>;
  listFundamentals(market?: MarketId): Promise<Fundamentals[]>;

  /* ---- index composition ---- */
  listConstituents(indexId: string): Promise<IndexConstituent[]>;
  getConstituent(indexId: string, symbol: string): Promise<IndexConstituent | null>;
  /** Official divisor when published by the index administrator, else null. */
  getIndexDivisor(indexId: string): Promise<number | null>;

  /* ---- shariah ---- */
  listMethodologies(): Promise<ShariahMethodology[]>;
  getScreening(symbol: string, methodologyId: string): Promise<ShariahScreening | null>;
  listScreenings(methodologyId: string, market?: MarketId): Promise<ShariahScreening[]>;
  getScreeningHistory(symbol: string, methodologyId?: string): Promise<ShariahHistoryEntry[]>;

  /* ---- events ---- */
  listDividends(opts?: { market?: MarketId; symbol?: string }): Promise<Dividend[]>;
  listCorporateActions(opts?: { market?: MarketId; symbol?: string }): Promise<CorporateAction[]>;
  listEarnings(opts?: { market?: MarketId; symbol?: string }): Promise<EarningsEvent[]>;
  listNews(opts?: { market?: MarketId; symbol?: string; limit?: number }): Promise<NewsItem[]>;

  /* ---- operations ---- */
  getSyncStatus(): Promise<SyncJobStatus[]>;
  getValidationIssues(): Promise<ValidationIssue[]>;

  /* ---- optional user sync (null in guest-only builds) ---- */
  pushAlerts?(alerts: Alert[]): Promise<void>;
}

/** Thrown when a provider is asked for a capability it does not implement. */
export class CapabilityUnavailableError extends Error {
  constructor(capability: string, providerId: string) {
    super(`Provider "${providerId}" does not supply ${capability}.`);
    this.name = 'CapabilityUnavailableError';
  }
}
