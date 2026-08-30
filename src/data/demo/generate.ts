/* =========================================================================
   ⚠️  SYNTHETIC DATA GENERATOR — DEVELOPMENT ONLY  ⚠️

   Every number produced here is generated from a deterministic pseudo-random
   sequence seeded by the instrument symbol and the current date. Nothing in
   this file is an observation of any real market, company, index or screening
   body. The application labels all of it "Demo data" wherever it is displayed.

   Its purpose is to exercise the UI and the calculation engine with values of
   a plausible SHAPE (ordering, magnitude, sign) so that layout, sorting,
   formatting and edge cases can be reviewed before a production feed is
   connected. Replace `DemoProvider` with a real `MarketDataProvider` and this
   module is no longer loaded.
   ========================================================================= */

import { round } from '@/lib/decimal';
import type {
  Candle,
  CorporateAction,
  CorporateActionKind,
  Currency,
  Dividend,
  DividendFrequency,
  EarningsEvent,
  Fundamentals,
  Instrument,
  MarketId,
  NewsCategory,
  NewsItem,
  Provenance,
  Quote,
  ShariahHistoryEntry,
  ShariahRatio,
  ShariahScreening,
  ShariahStatus,
} from '@/types';
import { DEMO_INSTRUMENTS, type RefInstrument } from './reference';

export const DEMO_SOURCE = 'BIG MARGIN Demo Generator (synthetic)';

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random primitives                              */
/* ------------------------------------------------------------------ */

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Day index — the dataset re-rolls once per calendar day, then stays stable. */
export function dayIndex(): number {
  return Math.floor(Date.now() / 86400000);
}

function rngFor(symbol: string, salt = ''): () => number {
  return mulberry32(hashString(`${symbol}|${salt}|${dayIndex()}`));
}

/** Stable across days — used for structural facts like share counts. */
function staticRngFor(symbol: string, salt = ''): () => number {
  return mulberry32(hashString(`${symbol}|${salt}|static`));
}

function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

/** Standard-normal via Box–Muller. */
function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  const v = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------ */
/* Provenance helpers                                                  */
/* ------------------------------------------------------------------ */

const bootTime = new Date().toISOString();

export function demoProvenance(
  status: Provenance['status'] = 'delayed',
  delayMinutes = 15,
): Provenance {
  return {
    source: DEMO_SOURCE,
    asOf: bootTime,
    lastUpdated: bootTime,
    status,
    ...(status === 'delayed' ? { delayMinutes } : {}),
  };
}

export function unavailableProvenance(reason: string): Provenance {
  return {
    source: DEMO_SOURCE,
    asOf: bootTime,
    lastUpdated: bootTime,
    status: 'unavailable',
    reason,
  };
}

/* ------------------------------------------------------------------ */
/* Structural facts (stable): share counts, free float, base size      */
/* ------------------------------------------------------------------ */

interface Structure {
  listedShares: number;
  freeFloatFactor: number;
  freeFloatShares: number;
  /** Anchor price the daily walk oscillates around. */
  anchorPrice: number;
  marketCap: number;
  freeFloatMarketCap: number;
  currency: Currency;
}

/** Instruments whose free float is deliberately tiny, as with recent mega-IPOs. */
const TIGHT_FLOAT = new Set(['2222', '2082', '7203', '5110']);

const structureCache = new Map<string, Structure>();

export function structureOf(ref: RefInstrument, rank: number): Structure {
  const cached = structureCache.get(ref.symbol);
  if (cached) return cached;

  const r = staticRngFor(ref.symbol, 'structure');
  const currency: Currency = ref.market === 'SA' ? 'SAR' : 'USD';

  // Size decays with rank so the constituent list has a realistic shape.
  const decay = Math.pow(rank + 1, -0.86);
  const jitter = between(r, 0.55, 1.7);
  const megaBoost = rank === 0 ? 7.5 : rank < 3 ? 1.9 : 1;
  const totalTarget = ref.market === 'SA' ? 9.2e12 : 4.6e13;
  const share = decay * jitter * megaBoost;

  const anchorPrice =
    ref.market === 'SA'
      ? round(between(r, 9, 260), 2)
      : round(between(r, 28, 640), 2);

  const marketCap = share * totalTarget * 0.045;

  const freeFloatFactor = TIGHT_FLOAT.has(ref.symbol)
    ? round(between(r, 0.015, 0.06), 4)
    : ref.market === 'SA'
      ? round(between(r, 0.18, 0.78), 4)
      : round(between(r, 0.62, 0.99), 4);

  const listedShares = Math.round(marketCap / anchorPrice);
  const freeFloatShares = Math.round(listedShares * freeFloatFactor);

  const s: Structure = {
    listedShares,
    freeFloatFactor,
    freeFloatShares,
    anchorPrice,
    marketCap: round(marketCap, 0),
    freeFloatMarketCap: round(marketCap * freeFloatFactor, 0),
    currency,
  };
  structureCache.set(ref.symbol, s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */

export function buildInstrument(ref: RefInstrument, rank: number): Instrument {
  const st = structureOf(ref, rank);
  return {
    symbol: ref.symbol,
    market: ref.market,
    currency: st.currency,
    name: { ar: ref.ar, en: ref.en },
    shortName: { ar: ref.shortAr, en: ref.shortEn },
    sectorId: ref.sectorId,
    isin: null,
    listedShares: st.listedShares,
    freeFloatShares: st.freeFloatShares,
    indices: ref.indices,
    logoUrl: null,
    website: null,
    description: null,
  };
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

/** Symbols deliberately left without a price, to exercise the empty state. */
const NO_QUOTE = new Set(['4110', '8012']);

export function buildQuote(ref: RefInstrument, rank: number): Quote {
  const st = structureOf(ref, rank);

  if (NO_QUOTE.has(ref.symbol)) {
    return {
      symbol: ref.symbol,
      market: ref.market,
      currency: st.currency,
      price: null,
      previousClose: null,
      open: null,
      dayHigh: null,
      dayLow: null,
      change: null,
      changePct: null,
      volume: null,
      avgVolume30d: null,
      turnover: null,
      trades: null,
      week52High: null,
      week52Low: null,
      marketCap: null,
      freeFloatMarketCap: null,
      perf1w: null,
      perf1m: null,
      perf3m: null,
      perf1y: null,
      volatilityPct: null,
      provenance: unavailableProvenance(
        'No quote is published for this instrument in the demo dataset.',
      ),
    };
  }

  const r = rngFor(ref.symbol, 'quote');

  // Drift the anchor a little day to day, then apply an intraday move.
  const drift = 1 + gauss(r) * 0.06;
  const previousClose = round(Math.max(0.5, st.anchorPrice * drift), 2);
  const changePct = round(gauss(r) * 1.55, 2);
  const price = round(Math.max(0.5, previousClose * (1 + changePct / 100)), 2);
  const change = round(price - previousClose, 2);

  const open = round(
    Math.max(0.5, previousClose * (1 + gauss(r) * 0.004)),
    2,
  );
  const spread = Math.abs(gauss(r)) * 0.012 + 0.002;
  const dayHigh = round(Math.max(price, open) * (1 + spread), 2);
  const dayLow = round(Math.min(price, open) * (1 - spread), 2);

  const turnoverBase = st.freeFloatMarketCap * between(r, 0.0004, 0.011);
  const volume = Math.round(turnoverBase / Math.max(price, 0.5));
  const avgVolume30d = Math.round(volume * between(r, 0.6, 1.55));
  const trades = Math.round(volume / between(r, 180, 900));

  const w52 = staticRngFor(ref.symbol, '52w');
  const week52High = round(price * between(w52, 1.04, 1.62), 2);
  const week52Low = round(price * between(w52, 0.52, 0.94), 2);

  const marketCap = round(price * st.listedShares, 0);
  const freeFloatMarketCap = round(price * st.freeFloatShares, 0);

  return {
    symbol: ref.symbol,
    market: ref.market,
    currency: st.currency,
    price,
    previousClose,
    open,
    dayHigh,
    dayLow,
    change,
    changePct,
    volume,
    avgVolume30d,
    turnover: round(price * volume, 0),
    trades,
    week52High,
    week52Low,
    marketCap,
    freeFloatMarketCap,
    perf1w: round(gauss(r) * 2.6, 2),
    perf1m: round(gauss(r) * 5.4, 2),
    perf3m: round(gauss(r) * 9.8, 2),
    perf1y: round(gauss(r) * 21, 2),
    volatilityPct: round(between(r, 11, 46), 2),
    provenance: demoProvenance('delayed', 15),
  };
}

/* ------------------------------------------------------------------ */
/* Fundamentals                                                        */
/* ------------------------------------------------------------------ */

/** Symbols with no fundamentals on file, to exercise partial-data rendering. */
const NO_FUNDAMENTALS = new Set(['4331', '1301', '4006']);

export function buildFundamentals(
  ref: RefInstrument,
  rank: number,
  quote: Quote,
): Fundamentals {
  if (NO_FUNDAMENTALS.has(ref.symbol) || quote.price == null) {
    return {
      symbol: ref.symbol,
      peRatio: null,
      eps: null,
      bookValuePerShare: null,
      priceToBook: null,
      beta: null,
      dividendYieldPct: null,
      returnOnEquityPct: null,
      netMarginPct: null,
      revenueTtm: null,
      netIncomeTtm: null,
      totalAssets: null,
      totalDebt: null,
      provenance: unavailableProvenance(
        'No fundamentals are published for this instrument in the demo dataset.',
      ),
    };
  }

  const r = staticRngFor(ref.symbol, 'fundamentals');
  const st = structureOf(ref, rank);

  const netMarginPct = round(between(r, 3, 34), 2);
  const revenueTtm = round(st.marketCap * between(r, 0.12, 0.95), 0);
  const netIncomeTtm = round((revenueTtm * netMarginPct) / 100, 0);
  const eps = round(netIncomeTtm / Math.max(st.listedShares, 1), 3);
  const peRatio = eps > 0 ? round((quote.price as number) / eps, 2) : null;
  const bookValuePerShare = round((quote.price as number) / between(r, 0.9, 5.4), 2);
  const priceToBook = round((quote.price as number) / bookValuePerShare, 2);
  const beta = round(between(r, 0.42, 1.72), 2);
  const roe = round(between(r, 3, 29), 2);
  const totalAssets = round(st.marketCap * between(r, 0.8, 4.2), 0);
  const totalDebt = round(totalAssets * between(r, 0.02, 0.42), 0);

  const paysDividend = r() > 0.28;
  const dividendYieldPct = paysDividend ? round(between(r, 0.6, 7.4), 2) : null;

  return {
    symbol: ref.symbol,
    peRatio,
    eps,
    bookValuePerShare,
    priceToBook,
    beta,
    dividendYieldPct,
    returnOnEquityPct: roe,
    netMarginPct,
    revenueTtm,
    netIncomeTtm,
    totalAssets,
    totalDebt,
    provenance: demoProvenance('delayed', 1440),
  };
}

/* ------------------------------------------------------------------ */
/* Price series                                                        */
/* ------------------------------------------------------------------ */

const seriesCache = new Map<string, Candle[]>();

/** 5 years of daily candles ending at the current demo price. */
export function dailySeries(symbol: string, endPrice: number): Candle[] {
  const key = `${symbol}:${dayIndex()}`;
  const cached = seriesCache.get(key);
  if (cached) return cached;

  const r = mulberry32(hashString(`${symbol}|series|${dayIndex()}`));
  const n = 1260;
  const vol = between(r, 0.011, 0.028);
  const drift = between(r, -0.0004, 0.0009);

  // Walk backwards from the current price so the series terminates on it.
  const closes: number[] = new Array(n);
  closes[n - 1] = endPrice;
  for (let i = n - 2; i >= 0; i--) {
    const step = drift + gauss(r) * vol;
    closes[i] = Math.max(0.4, closes[i + 1] / (1 + step));
  }

  const out: Candle[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  const dates: string[] = [];
  while (dates.length < n) {
    const dow = cursor.getDay();
    // Saudi week: Sunday–Thursday. US week: Monday–Friday.
    const isWeekend =
      symbol.match(/^\d/) ? dow === 5 || dow === 6 : dow === 0 || dow === 6;
    if (!isWeekend) dates.unshift(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() - 86400000);
  }

  for (let i = 0; i < n; i++) {
    const c = round(closes[i], 2);
    const o = round(i === 0 ? c : closes[i - 1] * (1 + gauss(r) * 0.003), 2);
    const hi = round(Math.max(o, c) * (1 + Math.abs(gauss(r)) * 0.008), 2);
    const lo = round(Math.min(o, c) * (1 - Math.abs(gauss(r)) * 0.008), 2);
    const v = Math.round(between(r, 3e5, 9e6));
    out.push({ t: dates[i], o, h: hi, l: lo, c, v });
  }

  seriesCache.set(key, out);
  return out;
}

/** Intraday minute candles for the 1D timeframe. */
export function intradaySeries(
  symbol: string,
  open: number,
  close: number,
): Candle[] {
  const r = mulberry32(hashString(`${symbol}|intraday|${dayIndex()}`));
  const points = 78;
  const out: Candle[] = [];
  const start = new Date();
  start.setHours(10, 0, 0, 0);
  let prev = open;
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Blend a random walk toward the known close so the line lands correctly.
    const target = open + (close - open) * progress;
    const noise = gauss(r) * open * 0.0022 * (1 - progress * 0.7);
    const c = round(Math.max(0.4, target + noise), 2);
    const hi = round(Math.max(prev, c) * (1 + Math.abs(gauss(r)) * 0.0016), 2);
    const lo = round(Math.min(prev, c) * (1 - Math.abs(gauss(r)) * 0.0016), 2);
    const t = new Date(start.getTime() + i * 5 * 60000).toISOString();
    out.push({ t, o: prev, h: hi, l: lo, c, v: Math.round(between(r, 8e3, 3e5)) });
    prev = c;
  }
  if (out.length) out[out.length - 1].c = round(close, 2);
  return out;
}

/* ------------------------------------------------------------------ */
/* Shariah screening                                                   */
/* ------------------------------------------------------------------ */

const CONVENTIONAL_FINANCIALS = new Set([
  '1180', '1010', '1060', '1050', '1080', '1030', '1182',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'BRK.B',
]);
const ISLAMIC_FINANCIALS = new Set(['1120', '1150', '1020', '8010', '8210']);
/** Symbols with no screening on file, to exercise the "Unknown" path. */
const NO_SCREENING = new Set(['4331', '4006', '1301', 'UNP', 'AMT']);

interface MethodologySpec {
  id: string;
  debtThreshold: number;
  liquidThreshold: number;
  receivablesThreshold: number | null;
  incomeThreshold: number;
  /** 'mcap' = trailing market cap; 'assets' = total assets. */
  denominator: 'mcap' | 'assets';
}

export const METHODOLOGY_SPECS: MethodologySpec[] = [
  { id: 'aaoifi', debtThreshold: 30, liquidThreshold: 30, receivablesThreshold: null, incomeThreshold: 5, denominator: 'mcap' },
  { id: 'sp', debtThreshold: 33, liquidThreshold: 33, receivablesThreshold: 49, incomeThreshold: 5, denominator: 'mcap' },
  { id: 'djim', debtThreshold: 33, liquidThreshold: 33, receivablesThreshold: 33, incomeThreshold: 5, denominator: 'mcap' },
];

function ratio(
  key: string,
  ar: string,
  en: string,
  numerator: number | null,
  denominator: number | null,
  threshold: number | null,
  formula: string,
): ShariahRatio {
  const valuePct =
    numerator == null || denominator == null || denominator === 0
      ? null
      : round((numerator / denominator) * 100, 2);
  return {
    key,
    label: { ar, en },
    valuePct,
    thresholdPct: threshold,
    passes: valuePct == null || threshold == null ? null : valuePct < threshold,
    numerator,
    denominator,
    formula,
  };
}

export function buildScreening(
  ref: RefInstrument,
  rank: number,
  methodologyId: string,
  quote: Quote,
): ShariahScreening | null {
  const spec = METHODOLOGY_SPECS.find((m) => m.id === methodologyId);
  if (!spec) return null;

  if (NO_SCREENING.has(ref.symbol)) {
    return {
      symbol: ref.symbol,
      methodologyId,
      status: 'unknown',
      ratios: [],
      nonCompliantIncomePct: null,
      purificationPerShare: null,
      screeningDate: null,
      provenance: unavailableProvenance(
        'No screening for this instrument is present in the demo dataset.',
      ),
      note: {
        ar: 'لم يُنشر فحص لهذا السهم في مجموعة البيانات التجريبية.',
        en: 'No screening published for this instrument in the demo dataset.',
      },
    };
  }

  const r = staticRngFor(ref.symbol, `shariah:${methodologyId}`);
  const st = structureOf(ref, rank);
  const mcap = quote.marketCap ?? st.marketCap;
  const denom = spec.denominator === 'mcap' ? mcap : st.marketCap * 2.2;

  const conventional = CONVENTIONAL_FINANCIALS.has(ref.symbol);
  const islamic = ISLAMIC_FINANCIALS.has(ref.symbol);

  // Conventional financials carry interest-bearing balance sheets by design.
  const debtPctTarget = conventional
    ? between(r, 46, 88)
    : islamic
      ? between(r, 2, 14)
      : between(r, 3, 41);
  const liquidPctTarget = conventional
    ? between(r, 38, 72)
    : between(r, 2, 34);
  const receivablesPctTarget = conventional
    ? between(r, 40, 78)
    : between(r, 5, 44);
  const incomePct = conventional
    ? between(r, 22, 68)
    : islamic
      ? between(r, 0, 1.6)
      : between(r, 0, 7.2);

  const debt = round((debtPctTarget / 100) * denom, 0);
  const liquid = round((liquidPctTarget / 100) * denom, 0);
  const receivables = round((receivablesPctTarget / 100) * denom, 0);
  const revenue = round(st.marketCap * between(r, 0.15, 0.9), 0);
  const nonCompliantIncome = round((incomePct / 100) * revenue, 0);

  const ratios: ShariahRatio[] = [
    ratio(
      'debt',
      'الديون بفائدة ÷ القيمة السوقية',
      'Interest-bearing debt ÷ market cap',
      debt,
      denom,
      spec.debtThreshold,
      'Interest-bearing Debt ÷ Market Capitalisation × 100',
    ),
    ratio(
      'liquid',
      'النقد والأوراق ذات الفائدة ÷ القيمة السوقية',
      'Cash + interest-bearing securities ÷ market cap',
      liquid,
      denom,
      spec.liquidThreshold,
      '(Cash + Interest-bearing Securities) ÷ Market Capitalisation × 100',
    ),
  ];

  if (spec.receivablesThreshold != null) {
    ratios.push(
      ratio(
        'receivables',
        'الذمم المدينة ÷ القيمة السوقية',
        'Accounts receivable ÷ market cap',
        receivables,
        denom,
        spec.receivablesThreshold,
        'Accounts Receivable ÷ Market Capitalisation × 100',
      ),
    );
  }

  ratios.push(
    ratio(
      'income',
      'الإيراد غير المتوافق ÷ إجمالي الإيرادات',
      'Non-permissible income ÷ total revenue',
      nonCompliantIncome,
      revenue,
      spec.incomeThreshold,
      'Non-permissible Income ÷ Total Revenue × 100',
    ),
  );

  const anyFail = ratios.some((x) => x.passes === false);
  const status: ShariahStatus = anyFail ? 'non_compliant' : 'compliant';

  const purificationPerShare =
    status === 'compliant' && st.listedShares > 0
      ? round(nonCompliantIncome / st.listedShares, 4)
      : null;

  const screeningDate = new Date(
    Date.now() - Math.floor(between(r, 10, 120)) * 86400000,
  )
    .toISOString()
    .slice(0, 10);

  return {
    symbol: ref.symbol,
    methodologyId,
    status,
    ratios,
    nonCompliantIncomePct: round((nonCompliantIncome / revenue) * 100, 2),
    purificationPerShare,
    screeningDate,
    provenance: {
      source: DEMO_SOURCE,
      asOf: `${screeningDate}T00:00:00.000Z`,
      lastUpdated: bootTime,
      status: 'delayed',
      delayMinutes: 0,
    },
    note: null,
  };
}

export function buildScreeningHistory(
  ref: RefInstrument,
  methodologyId: string,
  current: ShariahStatus,
): ShariahHistoryEntry[] {
  if (current === 'unknown') return [];
  const r = staticRngFor(ref.symbol, `history:${methodologyId}`);
  const entries: ShariahHistoryEntry[] = [];
  let status = current;
  const quarters = 6;
  for (let i = 0; i < quarters; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i * 3);
    entries.push({
      symbol: ref.symbol,
      methodologyId,
      date: d.toISOString().slice(0, 10),
      status,
      reason:
        i > 0 && r() > 0.82
          ? {
              ar: 'تجاوز نسبة الديون بفائدة الحد المسموح في الفحص السابق.',
              en: 'Interest-bearing debt ratio exceeded the threshold at the prior screening.',
            }
          : null,
      source: DEMO_SOURCE,
    });
    // Occasionally flip the status going back in time.
    if (r() > 0.86) {
      status = status === 'compliant' ? 'non_compliant' : 'compliant';
    }
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* Dividends                                                           */
/* ------------------------------------------------------------------ */

const FREQUENCIES: DividendFrequency[] = [
  'annual',
  'semi_annual',
  'quarterly',
  'quarterly',
];

export function buildDividends(
  ref: RefInstrument,
  rank: number,
  quote: Quote,
  fundamentals: Fundamentals,
): Dividend[] {
  if (fundamentals.dividendYieldPct == null || quote.price == null) return [];
  const r = staticRngFor(ref.symbol, 'dividends');
  const st = structureOf(ref, rank);
  const frequency = pick(r, FREQUENCIES);
  const perYear =
    frequency === 'annual' ? 1 : frequency === 'semi_annual' ? 2 : 4;
  const annualDps = (fundamentals.dividendYieldPct / 100) * quote.price;
  const dps = round(annualDps / perYear, 3);

  const out: Dividend[] = [];
  // Four historical distributions plus one scheduled ahead.
  for (let i = 3; i >= -1; i--) {
    const ex = new Date();
    ex.setMonth(ex.getMonth() - Math.round((i * 12) / perYear));
    const isFuture = ex.getTime() > Date.now();
    const pay = new Date(ex.getTime() + 21 * 86400000);
    const declared = new Date(ex.getTime() - 25 * 86400000);
    out.push({
      id: `${ref.symbol}-div-${i}`,
      symbol: ref.symbol,
      market: ref.market,
      kind: 'cash',
      amountPerShare: dps,
      currency: st.currency,
      frequency,
      declaredDate: isFuture ? null : declared.toISOString().slice(0, 10),
      exDate: ex.toISOString().slice(0, 10),
      recordDate: new Date(ex.getTime() + 2 * 86400000).toISOString().slice(0, 10),
      payDate: pay.toISOString().slice(0, 10),
      announced: !isFuture,
      provenance: demoProvenance(isFuture ? 'estimated' : 'delayed', 0),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Corporate actions                                                   */
/* ------------------------------------------------------------------ */

const CA_KINDS: CorporateActionKind[] = [
  'cash_dividend',
  'stock_dividend',
  'rights_issue',
  'capital_increase',
  'capital_reduction',
  'split',
  'reverse_split',
  'share_grant',
  'general_meeting',
];

const CA_TEXT: Record<CorporateActionKind, { ar: string; en: string }> = {
  cash_dividend: { ar: 'توزيع أرباح نقدية على المساهمين', en: 'Cash dividend distribution to shareholders' },
  stock_dividend: { ar: 'توزيع أسهم منحة على المساهمين', en: 'Bonus share distribution to shareholders' },
  rights_issue: { ar: 'طرح أسهم حقوق أولوية', en: 'Rights issue offering' },
  capital_increase: { ar: 'زيادة رأس المال عبر رسملة الأرباح المبقاة', en: 'Capital increase via capitalisation of retained earnings' },
  capital_reduction: { ar: 'تخفيض رأس المال لإطفاء الخسائر المتراكمة', en: 'Capital reduction to absorb accumulated losses' },
  split: { ar: 'تجزئة القيمة الاسمية للسهم', en: 'Split of the share nominal value' },
  reverse_split: { ar: 'تجميع القيمة الاسمية للسهم', en: 'Reverse split of the share nominal value' },
  share_grant: { ar: 'منح أسهم لموظفي الشركة', en: 'Share grant to company employees' },
  general_meeting: { ar: 'دعوة لاجتماع الجمعية العامة', en: 'Notice of general assembly meeting' },
};

export function buildCorporateActions(ref: RefInstrument): CorporateAction[] {
  const r = staticRngFor(ref.symbol, 'ca');
  const count = Math.floor(between(r, 0, 3.4));
  const out: CorporateAction[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pick(r, CA_KINDS);
    const offset = Math.round(between(r, -70, 45));
    const eff = new Date(Date.now() + offset * 86400000);
    out.push({
      id: `${ref.symbol}-ca-${i}`,
      symbol: ref.symbol,
      market: ref.market,
      kind,
      effectiveDate: eff.toISOString().slice(0, 10),
      announcedDate: new Date(eff.getTime() - 20 * 86400000)
        .toISOString()
        .slice(0, 10),
      detail: CA_TEXT[kind],
      ratio:
        kind === 'split'
          ? '1:4'
          : kind === 'reverse_split'
            ? '4:1'
            : kind === 'stock_dividend'
              ? `1:${Math.round(between(r, 4, 12))}`
              : null,
      provenance: demoProvenance('delayed', 0),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Earnings                                                            */
/* ------------------------------------------------------------------ */

/** Symbols with no estimate on file — estimates are never manufactured. */
const NO_ESTIMATE = new Set(['4110', '4006', '1301', '4331', '2360', '6070']);

export function buildEarnings(
  ref: RefInstrument,
  rank: number,
  fundamentals: Fundamentals,
): EarningsEvent[] {
  const r = staticRngFor(ref.symbol, 'earnings');
  const st = structureOf(ref, rank);
  const out: EarningsEvent[] = [];

  for (let i = 1; i >= -1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * Math.round(between(r, 55, 95)) + Math.round(between(r, -12, 26)));
    const future = d.getTime() > Date.now();
    const quarter = `Q${((d.getMonth() / 3) | 0) + 1} ${d.getFullYear()}`;
    const baseEps = fundamentals.eps == null ? null : round(fundamentals.eps / 4, 3);
    const hasEstimate = !NO_ESTIMATE.has(ref.symbol) && baseEps != null;

    out.push({
      id: `${ref.symbol}-earn-${i}`,
      symbol: ref.symbol,
      market: ref.market,
      period: quarter,
      date: d.toISOString().slice(0, 10),
      dateConfirmed: !future || r() > 0.5,
      timing: ref.market === 'US' ? (r() > 0.5 ? 'amc' : 'bmo') : 'unspecified',
      epsEstimate: hasEstimate ? round((baseEps as number) * between(r, 0.9, 1.1), 3) : null,
      epsActual: future || baseEps == null ? null : round(baseEps * between(r, 0.82, 1.24), 3),
      revenueEstimate:
        hasEstimate && fundamentals.revenueTtm != null
          ? round((fundamentals.revenueTtm / 4) * between(r, 0.93, 1.07), 0)
          : null,
      revenueActual:
        future || fundamentals.revenueTtm == null
          ? null
          : round((fundamentals.revenueTtm / 4) * between(r, 0.86, 1.18), 0),
      priorPeriodNetIncome:
        fundamentals.netIncomeTtm == null
          ? null
          : round((fundamentals.netIncomeTtm / 4) * between(r, 0.7, 1.2), 0),
      netIncome:
        future || fundamentals.netIncomeTtm == null
          ? null
          : round((fundamentals.netIncomeTtm / 4) * between(r, 0.8, 1.25), 0),
      provenance: demoProvenance(future ? 'estimated' : 'delayed', 0),
    });
  }
  void st;
  return out;
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

/**
 * Demo headlines are deliberately generic and prefixed so that no item can be
 * mistaken for a real published story. A production provider supplies real
 * headlines with real source names and URLs; BIG MARGIN never composes one.
 */
interface NewsTemplate {
  ar: string;
  en: string;
  category: NewsCategory;
  official: boolean;
}

/**
 * Each template carries the category and disclosure flag a real feed would
 * supply, so the importance rules are exercised across every branch — and one
 * template deliberately leaves the category null (see buildNews) so the
 * "unclassified ⇒ unavailable" path is visible in the demo too.
 */
const NEWS_TEMPLATES: NewsTemplate[] = [
  { ar: 'إفصاح دوري عن النتائج المالية للفترة', en: 'Periodic disclosure of financial results for the period', category: 'earnings', official: true },
  { ar: 'إعلان عن توصية مجلس الإدارة بتوزيع أرباح', en: 'Board recommendation on a dividend distribution announced', category: 'dividend', official: true },
  { ar: 'الإعلان عن توقيع عقد تشغيلي جديد', en: 'New operating contract signed and disclosed', category: 'general', official: true },
  { ar: 'تحديث بشأن الجمعية العامة غير العادية', en: 'Update regarding the extraordinary general assembly', category: 'corporate_action', official: true },
  { ar: 'إفصاح عن تطورات جوهرية في أعمال الشركة', en: 'Disclosure of material developments in company operations', category: 'regulatory', official: true },
  { ar: 'إعلان عن نتائج التخصيص لطرح الأسهم', en: 'Announcement of allocation results for the share offering', category: 'capital', official: true },
  { ar: 'تقرير صحفي عن تغييرات في الإدارة التنفيذية', en: 'Press report on executive management changes', category: 'management', official: false },
  { ar: 'مراجعة تصنيف ائتماني من وكالة تصنيف', en: 'Credit rating review published by a rating agency', category: 'rating', official: false },
];

export function buildNews(refs: RefInstrument[], limit = 40): NewsItem[] {
  const out: NewsItem[] = [];
  const r = mulberry32(hashString(`news|${dayIndex()}`));
  for (let i = 0; i < limit; i++) {
    const ref = pick(r, refs);
    const tpl = pick(r, NEWS_TEMPLATES);
    const published = new Date(
      Date.now() - Math.round(between(r, 5, 4300)) * 60000,
    ).toISOString();
    out.push({
      id: `demo-news-${i}`,
      headline: {
        ar: `[بيانات تجريبية] ${ref.shortAr}: ${tpl.ar}`,
        en: `[DEMO DATA] ${ref.shortEn}: ${tpl.en}`,
      },
      summary: {
        ar: 'هذا عنوان تجريبي مولّد داخل التطبيق لأغراض العرض فقط، ولا يمثل خبرًا منشورًا.',
        en: 'This is an in-app generated placeholder headline for layout purposes only. It is not a published story.',
      },
      sourceName: DEMO_SOURCE,
      url: null,
      publishedAt: published,
      symbols: [ref.symbol],
      market: ref.market,
      // Every seventh item withholds its category, so the screen has to render
      // the "importance unavailable" state rather than only the happy path.
      category: i % 7 === 6 ? null : tpl.category,
      official: i % 7 === 6 ? null : tpl.official,
      sourceImportance: null,
      provenance: unavailableProvenance(
        'No news provider is connected. Placeholder items shown for layout only.',
      ),
    });
  }
  return out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Index levels                                                        */
/* ------------------------------------------------------------------ */

export const INDEX_BASE_LEVEL: Record<string, number> = {
  TASI: 11_240,
  SPX: 5_480,
  NDX: 19_120,
  DJI: 40_650,
};

export function indexLevelFor(indexId: string): {
  level: number;
  change: number;
  changePct: number;
} {
  const base = INDEX_BASE_LEVEL[indexId] ?? 1000;
  const r = mulberry32(hashString(`${indexId}|level|${dayIndex()}`));
  const drift = 1 + gauss(r) * 0.02;
  const previous = round(base * drift, 2);
  const changePct = round(gauss(r) * 0.62, 2);
  const level = round(previous * (1 + changePct / 100), 2);
  return { level, change: round(level - previous, 2), changePct };
}

export const REFS_BY_MARKET: Record<MarketId, RefInstrument[]> = {
  SA: DEMO_INSTRUMENTS.filter((i) => i.market === 'SA'),
  US: DEMO_INSTRUMENTS.filter((i) => i.market === 'US'),
};

export function rankOf(ref: RefInstrument): number {
  return REFS_BY_MARKET[ref.market].findIndex((x) => x.symbol === ref.symbol);
}
