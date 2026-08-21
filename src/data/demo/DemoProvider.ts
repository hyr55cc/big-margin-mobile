/* =========================================================================
   ⚠️  DEMO PROVIDER — DEVELOPMENT DATA SOURCE  ⚠️
   Implements MarketDataProvider on top of the synthetic generator.
   `info.production` is false, which is what drives the "Demo data" banner
   shown across the application.
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
import { DEMO_INDICES, DEMO_INSTRUMENTS, DEMO_SECTORS, type RefInstrument } from './reference';
import {
  DEMO_SOURCE,
  buildCorporateActions,
  buildDividends,
  buildEarnings,
  buildFundamentals,
  buildInstrument,
  buildNews,
  buildQuote,
  buildScreening,
  buildScreeningHistory,
  dailySeries,
  demoProvenance,
  indexLevelFor,
  intradaySeries,
  rankOf,
} from './generate';
import { METHODOLOGIES } from './methodologies';
import { round } from '@/lib/decimal';

const refBySymbol = new Map(DEMO_INSTRUMENTS.map((r) => [r.symbol, r]));

function ref(symbol: string): RefInstrument | null {
  return refBySymbol.get(symbol) ?? null;
}

/* ---------------------------- memo helpers ---------------------------- */

const memo = new Map<string, unknown>();
function once<T>(key: string, fn: () => T): T {
  if (memo.has(key)) return memo.get(key) as T;
  const v = fn();
  memo.set(key, v);
  return v;
}

const allInstruments = (): Instrument[] =>
  once('instruments', () =>
    DEMO_INSTRUMENTS.map((r) => buildInstrument(r, rankOf(r))),
  );

const allQuotes = (): Quote[] =>
  once('quotes', () => DEMO_INSTRUMENTS.map((r) => buildQuote(r, rankOf(r))));

const quoteMap = (): Map<string, Quote> =>
  once('quoteMap', () => new Map(allQuotes().map((q) => [q.symbol, q])));

const fundamentalsMap = (): Map<string, Fundamentals> =>
  once(
    'fundamentals',
    () =>
      new Map(
        DEMO_INSTRUMENTS.map((r) => [
          r.symbol,
          buildFundamentals(r, rankOf(r), quoteMap().get(r.symbol)!),
        ]),
      ),
  );

/* --------------------------- index composition ------------------------ */

function constituentsFor(indexId: string): IndexConstituent[] {
  return once(`constituents:${indexId}`, () => {
    const members = DEMO_INSTRUMENTS.filter((r) => r.indices.includes(indexId));
    const qs = quoteMap();

    const withCap = members.map((r) => {
      const q = qs.get(r.symbol);
      const inst = allInstruments().find((i) => i.symbol === r.symbol)!;
      const ffShares = inst.freeFloatShares ?? null;
      const ffCap =
        q?.price != null && ffShares != null ? q.price * ffShares : null;
      return { r, inst, ffCap, ffShares };
    });

    const total = withCap.reduce((s, x) => s + (x.ffCap ?? 0), 0);

    return withCap.map(({ r, inst, ffCap, ffShares }) => ({
      symbol: r.symbol,
      indexId,
      weightPct: ffCap == null || total === 0 ? null : round((ffCap / total) * 100, 4),
      indexMarketCap: ffCap == null ? null : round(ffCap, 0),
      freeFloatFactor:
        ffShares != null && inst.listedShares
          ? round(ffShares / inst.listedShares, 4)
          : null,
      cappingFactor: null,
      provenance: demoProvenance('delayed', 15),
    }));
  });
}

function aggregateFreeFloatCap(indexId: string): number {
  return constituentsFor(indexId).reduce(
    (s, c) => s + (c.indexMarketCap ?? 0),
    0,
  );
}

/* ---------------------------- market status --------------------------- */

function saudiStatus(): MarketStatus {
  // Tadawul: Sunday–Thursday, continuous trading 10:00–15:00 Arabia Standard Time.
  const now = new Date();
  const ast = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
  const dow = ast.getDay();
  const minutes = ast.getHours() * 60 + ast.getMinutes();
  const weekend = dow === 5 || dow === 6;

  let session: MarketStatus['session'];
  if (weekend) session = 'closed';
  else if (minutes < 9 * 60 + 30) session = 'closed';
  else if (minutes < 10 * 60) session = 'pre';
  else if (minutes < 15 * 60) session = 'open';
  else if (minutes < 15 * 60 + 10) session = 'auction';
  else session = 'closed';

  return {
    market: 'SA',
    session,
    localTime: ast.toISOString(),
    timezone: 'Asia/Riyadh (UTC+3)',
    nextChangeAt: null,
    provenance: demoProvenance('calculated'),
  };
}

function usStatus(): MarketStatus {
  // US equities: Monday–Friday, 09:30–16:00 US Eastern.
  const now = new Date();
  const et = new Date(now.getTime() + (-4 * 60 + now.getTimezoneOffset()) * 60000);
  const dow = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();
  const weekend = dow === 0 || dow === 6;

  let session: MarketStatus['session'];
  if (weekend) session = 'closed';
  else if (minutes < 4 * 60) session = 'closed';
  else if (minutes < 9 * 60 + 30) session = 'pre';
  else if (minutes < 16 * 60) session = 'open';
  else if (minutes < 20 * 60) session = 'after';
  else session = 'closed';

  return {
    market: 'US',
    session,
    localTime: et.toISOString(),
    timezone: 'America/New_York',
    nextChangeAt: null,
    provenance: demoProvenance('calculated'),
  };
}

/* ------------------------------ provider ------------------------------ */

const info: ProviderInfo = {
  id: 'demo',
  name: 'BIG MARGIN Demo Dataset',
  production: false,
  description:
    'Synthetic, deterministic data generated in the browser. Company identity (symbol, name, sector) is real; every price, weight, ratio, dividend and classification is generated and must not be used for any decision.',
  capabilities: {
    quotes: true,
    series: true,
    indexWeights: true,
    shariah: true,
    dividends: true,
    corporateActions: true,
    earnings: true,
    news: false,
  },
};

function sliceSeries(candles: PriceSeries['candles'], tf: Timeframe) {
  const map: Record<Timeframe, number> = {
    '1D': 1,
    '1W': 5,
    '1M': 22,
    '3M': 66,
    '6M': 130,
    '1Y': 252,
    '5Y': 1260,
  };
  const n = map[tf] ?? 252;
  return candles.slice(Math.max(0, candles.length - n));
}

export const DemoProvider: MarketDataProvider = {
  info,

  async listInstruments(market) {
    const all = allInstruments();
    return market ? all.filter((i) => i.market === market) : all;
  },

  async getInstrument(symbol) {
    return allInstruments().find((i) => i.symbol === symbol) ?? null;
  },

  async listSectors(market): Promise<Sector[]> {
    return DEMO_SECTORS.filter((s) => !market || s.market === market).map((s) => ({
      id: s.id,
      market: s.market,
      name: { ar: s.ar, en: s.en },
    }));
  },

  async searchInstruments(query, limit = 12) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = allInstruments()
      .map((i) => {
        const sym = i.symbol.toLowerCase();
        const en = i.name.en.toLowerCase();
        const enShort = i.shortName.en.toLowerCase();
        const ar = i.name.ar;
        const arShort = i.shortName.ar;
        let score = 0;
        if (sym === q) score = 100;
        else if (sym.startsWith(q)) score = 90;
        else if (enShort.startsWith(q) || arShort.startsWith(q)) score = 80;
        else if (en.startsWith(q) || ar.startsWith(q)) score = 70;
        else if (en.includes(q) || ar.includes(q) || enShort.includes(q) || arShort.includes(q))
          score = 50;
        else if (sym.includes(q)) score = 40;
        return { i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((x) => x.i);
  },

  async getMarketStatus(market) {
    return market === 'SA' ? saudiStatus() : usStatus();
  },

  async listIndices(market) {
    return DEMO_INDICES.filter((x) => !market || x.market === market).map((x) =>
      buildIndexQuote(x.id, x.market, x.ar, x.en),
    );
  },

  async getIndex(indexId) {
    const meta = DEMO_INDICES.find((x) => x.id === indexId);
    if (!meta) return null;
    return buildIndexQuote(meta.id, meta.market, meta.ar, meta.en);
  },

  async getQuote(symbol) {
    return quoteMap().get(symbol) ?? null;
  },

  async listQuotes(market) {
    const all = allQuotes();
    return market ? all.filter((q) => q.market === market) : all;
  },

  async getSeries(symbol, timeframe) {
    const q = quoteMap().get(symbol);
    if (!q || q.price == null) return null;
    if (timeframe === '1D') {
      return {
        symbol,
        timeframe,
        candles: intradaySeries(symbol, q.open ?? q.price, q.price),
        provenance: demoProvenance('delayed', 15),
      };
    }
    const daily = dailySeries(symbol, q.price);
    return {
      symbol,
      timeframe,
      candles: sliceSeries(daily, timeframe),
      provenance: demoProvenance('delayed', 15),
    };
  },

  async getIndexSeries(indexId, timeframe) {
    const { level } = indexLevelFor(indexId);
    const daily = dailySeries(`IDX:${indexId}`, level);
    return {
      symbol: indexId,
      timeframe,
      candles: timeframe === '1D' ? sliceSeries(daily, '1M') : sliceSeries(daily, timeframe),
      provenance: demoProvenance('delayed', 15),
    };
  },

  async getFundamentals(symbol) {
    return fundamentalsMap().get(symbol) ?? null;
  },

  async listFundamentals(market) {
    const all = [...fundamentalsMap().values()];
    if (!market) return all;
    const symbols = new Set(
      DEMO_INSTRUMENTS.filter((r) => r.market === market).map((r) => r.symbol),
    );
    return all.filter((f) => symbols.has(f.symbol));
  },

  async listConstituents(indexId) {
    return constituentsFor(indexId);
  },

  async getConstituent(indexId, symbol) {
    return constituentsFor(indexId).find((c) => c.symbol === symbol) ?? null;
  },

  async getIndexDivisor() {
    // The demo dataset deliberately publishes no official divisor, which
    // exercises the implied-divisor path and its "Calculated" labelling.
    return null;
  },

  async listMethodologies(): Promise<ShariahMethodology[]> {
    return METHODOLOGIES;
  },

  async getScreening(symbol, methodologyId) {
    const r = ref(symbol);
    if (!r) return null;
    const q = quoteMap().get(symbol);
    if (!q) return null;
    return buildScreening(r, rankOf(r), methodologyId, q);
  },

  async listScreenings(methodologyId, market) {
    const refs = DEMO_INSTRUMENTS.filter((r) => !market || r.market === market);
    const qs = quoteMap();
    return refs
      .map((r) => buildScreening(r, rankOf(r), methodologyId, qs.get(r.symbol)!))
      .filter((x): x is ShariahScreening => x != null);
  },

  async getScreeningHistory(symbol, methodologyId = 'aaoifi') {
    const r = ref(symbol);
    if (!r) return [];
    const q = quoteMap().get(symbol);
    if (!q) return [];
    const current = buildScreening(r, rankOf(r), methodologyId, q);
    if (!current) return [];
    return buildScreeningHistory(r, methodologyId, current.status) as ShariahHistoryEntry[];
  },

  async listDividends(opts = {}) {
    const refs = DEMO_INSTRUMENTS.filter(
      (r) =>
        (!opts.market || r.market === opts.market) &&
        (!opts.symbol || r.symbol === opts.symbol),
    );
    const qs = quoteMap();
    const fs = fundamentalsMap();
    const out: Dividend[] = [];
    for (const r of refs) {
      out.push(
        ...buildDividends(r, rankOf(r), qs.get(r.symbol)!, fs.get(r.symbol)!),
      );
    }
    return out;
  },

  async listCorporateActions(opts = {}) {
    const refs = DEMO_INSTRUMENTS.filter(
      (r) =>
        (!opts.market || r.market === opts.market) &&
        (!opts.symbol || r.symbol === opts.symbol),
    );
    const out: CorporateAction[] = [];
    for (const r of refs) out.push(...buildCorporateActions(r));
    return out.sort((a, b) =>
      (a.effectiveDate ?? '') < (b.effectiveDate ?? '') ? 1 : -1,
    );
  },

  async listEarnings(opts = {}) {
    const refs = DEMO_INSTRUMENTS.filter(
      (r) =>
        (!opts.market || r.market === opts.market) &&
        (!opts.symbol || r.symbol === opts.symbol),
    );
    const fs = fundamentalsMap();
    const out: EarningsEvent[] = [];
    for (const r of refs) out.push(...buildEarnings(r, rankOf(r), fs.get(r.symbol)!));
    return out.sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1));
  },

  async listNews(opts = {}): Promise<NewsItem[]> {
    const refs = DEMO_INSTRUMENTS.filter(
      (r) =>
        (!opts.market || r.market === opts.market) &&
        (!opts.symbol || r.symbol === opts.symbol),
    );
    if (refs.length === 0) return [];
    const items = buildNews(refs, opts.symbol ? 4 : (opts.limit ?? 40));
    return items;
  },

  async getSyncStatus(): Promise<SyncJobStatus[]> {
    const mk = (
      id: string,
      ar: string,
      en: string,
      schedule: string,
      records: number,
      state: SyncJobStatus['state'] = 'ok',
      minutesAgo = 12,
    ): SyncJobStatus => ({
      id,
      label: { ar, en },
      schedule,
      lastRunAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      nextRunAt: new Date(Date.now() + 15 * 60000).toISOString(),
      records,
      state,
      ...(state === 'ok'
        ? {}
        : { message: 'Demo provider generates data in-process; no remote sync runs.' }),
    });

    const saCount = DEMO_INSTRUMENTS.filter((r) => r.market === 'SA').length;
    const usCount = DEMO_INSTRUMENTS.filter((r) => r.market === 'US').length;

    return [
      mk('quotes-sa', 'أسعار السوق السعودي', 'Saudi market quotes', '*/1 * * * *', saCount),
      mk('quotes-us', 'أسعار السوق الأمريكي', 'US market quotes', '*/1 * * * *', usCount),
      mk('tasi-weights', 'أوزان مؤشر تاسي', 'TASI constituent weights', '0 18 * * 0-4', saCount),
      mk('shariah', 'الفحص الشرعي', 'Shariah screenings', '0 3 * * 1', saCount + usCount),
      mk('dividends', 'التوزيعات', 'Dividends', '0 4 * * *', 180),
      mk('corp-actions', 'إجراءات الشركات', 'Corporate actions', '0 5 * * *', 96),
      mk('earnings', 'رزنامة النتائج', 'Earnings calendar', '0 6 * * *', 210),
      mk('news', 'الأخبار', 'News feed', '*/5 * * * *', 0, 'never_run', 0),
    ];
  },

  async getValidationIssues(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const qs = allQuotes();
    const now = new Date().toISOString();

    for (const q of qs) {
      if (q.provenance.status === 'unavailable') {
        issues.push({
          id: `missing-quote-${q.symbol}`,
          severity: 'warning',
          entity: 'Quote',
          recordId: q.symbol,
          field: 'price',
          message: {
            ar: 'لا يوجد سعر متاح لهذا الرمز من المزوّد الحالي.',
            en: 'No price available for this symbol from the active provider.',
          },
          detectedAt: now,
        });
      }
      if (q.price != null && q.price <= 0) {
        issues.push({
          id: `neg-price-${q.symbol}`,
          severity: 'error',
          entity: 'Quote',
          recordId: q.symbol,
          field: 'price',
          message: {
            ar: 'سعر غير صالح: القيمة صفر أو سالبة.',
            en: 'Invalid price: value is zero or negative.',
          },
          detectedAt: now,
        });
      }
      if (
        q.week52High != null &&
        q.week52Low != null &&
        q.week52High < q.week52Low
      ) {
        issues.push({
          id: `range-${q.symbol}`,
          severity: 'error',
          entity: 'Quote',
          recordId: q.symbol,
          field: 'week52High',
          message: {
            ar: 'أعلى سعر خلال ٥٢ أسبوعًا أقل من الأدنى.',
            en: '52-week high is below the 52-week low.',
          },
          detectedAt: now,
        });
      }
    }

    const weights = constituentsFor('TASI');
    const sum = weights.reduce((s, c) => s + (c.weightPct ?? 0), 0);
    if (Math.abs(sum - 100) > 0.5) {
      issues.push({
        id: 'tasi-weight-sum',
        severity: 'error',
        entity: 'IndexConstituent',
        recordId: 'TASI',
        field: 'weightPct',
        message: {
          ar: `مجموع أوزان مكونات تاسي ${sum.toFixed(2)}٪ بدل ١٠٠٪.`,
          en: `TASI constituent weights sum to ${sum.toFixed(2)}% instead of 100%.`,
        },
        detectedAt: now,
      });
    }

    issues.push({
      id: 'provider-not-production',
      severity: 'warning',
      entity: 'Provider',
      recordId: 'demo',
      field: 'info.production',
      message: {
        ar: 'المزوّد النشط ليس مزوّد إنتاج. جميع الأرقام مولّدة اصطناعيًا.',
        en: 'The active provider is not a production feed. All figures are synthetic.',
      },
      detectedAt: now,
    });

    return issues;
  },
};

function buildIndexQuote(
  id: string,
  market: MarketId,
  ar: string,
  en: string,
): IndexQuote {
  const { level, change, changePct } = indexLevelFor(id);
  const members = allQuotes().filter((q) => {
    const r = ref(q.symbol);
    return r?.indices.includes(id);
  });
  const priced = members.filter((q) => q.changePct != null);
  const advancers = priced.filter((q) => (q.changePct as number) > 0).length;
  const decliners = priced.filter((q) => (q.changePct as number) < 0).length;
  const unchanged = priced.length - advancers - decliners;
  const volume = priced.reduce((s, q) => s + (q.volume ?? 0), 0);
  const turnover = priced.reduce((s, q) => s + (q.turnover ?? 0), 0);

  return {
    id,
    name: { ar, en },
    market,
    level,
    change,
    changePct,
    advancers,
    decliners,
    unchanged,
    volume,
    turnover,
    provenance: demoProvenance('delayed', 15),
  };
}

/** Aggregate free-float cap on file, used to derive an implied index divisor. */
export function demoAggregateFreeFloatCap(indexId: string): number {
  return aggregateFreeFloatCap(indexId);
}

export { DEMO_SOURCE };
