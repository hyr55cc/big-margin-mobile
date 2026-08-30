/* =========================================================================
   ⚠️  SYNTHETIC OPTIONS DATA — DEVELOPMENT ONLY  ⚠️

   Every quote, volume, open-interest and volatility figure below is produced
   by a deterministic pseudo-random generator seeded on the contract symbol.
   None of it is an observation of any real options market. `production` is
   false, which is what drives the "Demo data" banner across the product.

   The generator is shaped, not random: strikes carry a volatility SKEW (puts
   priced above calls, far strikes above the money), open interest clusters at
   round strikes, and volume decays away from the money — because a chain that
   looks nothing like a chain is useless for checking that the screen reads
   correctly.

   It also deliberately withholds Greeks on most contracts and implied
   volatility on some, so the application's own pricing model is exercised on
   every run. That is the realistic case: cheap feeds ship prices, not Greeks.
   ========================================================================= */

import { round } from '@/lib/decimal';
import { greeks as bsGreeks, optionPrice, yearsToExpiry } from '@/lib/calc/blackScholes';
import type { Provenance } from '@/types';
import type {
  ChainRow,
  FlowKind,
  FlowTrade,
  IvStats,
  OptionChain,
  OptionContract,
  OptionExpiry,
  OptionRight,
  UnusualActivity,
} from '@/types/options';
import { EMPTY_GREEKS } from '@/types/options';
import type { ContractCandle, OptionsDataProvider, OptionsProviderInfo } from './provider';
import { getProvider } from '../registry';

export const DEMO_OPTIONS_SOURCE = 'BIG MARGIN Demo Options Generator (synthetic)';

/* ------------------------------ randomness ----------------------------- */

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const day = () => Math.floor(Date.now() / 86400000);
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

const bootTime = new Date().toISOString();

function prov(status: Provenance['status'] = 'delayed', delayMinutes = 15): Provenance {
  return {
    source: DEMO_OPTIONS_SOURCE,
    asOf: bootTime,
    lastUpdated: bootTime,
    status,
    ...(status === 'delayed' ? { delayMinutes } : {}),
  };
}

/* ------------------------------- expiries ------------------------------ */

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Third Friday of a month — the standard monthly expiration. */
function thirdFriday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  let fridays = 0;
  while (true) {
    if (d.getUTCDay() === 5) {
      fridays += 1;
      if (fridays === 3) break;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return new Date(d);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function dteOf(dateIso: string): number {
  const end = new Date(`${dateIso}T21:00:00Z`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

function buildExpiries(symbol: string): OptionExpiry[] {
  const r = rng(`${symbol}|expiries|${day()}`);
  const today = new Date();
  const seen = new Set<string>();
  const out: OptionExpiry[] = [];

  const add = (date: Date, kind: OptionExpiry['kind']) => {
    const key = iso(date);
    if (seen.has(key)) return;
    const dte = dteOf(key);
    if (dte <= 0) return;
    seen.add(key);
    out.push({
      date: key,
      kind,
      dte,
      contractCount: Math.round(between(r, 30, 120)) * 2,
    });
  };

  // Eight weeklies.
  let cursor = nextWeekday(today, 5);
  for (let i = 0; i < 8; i++) {
    add(new Date(cursor), 'weekly');
    cursor.setDate(cursor.getDate() + 7);
  }

  // Six monthlies.
  for (let m = 0; m < 7; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    add(thirdFriday(d.getFullYear(), d.getMonth()), 'monthly');
  }

  // Quarterlies through next year, then two LEAPS Januaries.
  for (const month of [2, 5, 8, 11]) {
    add(thirdFriday(today.getFullYear() + 1, month), 'quarterly');
  }
  add(thirdFriday(today.getFullYear() + 1, 0), 'leaps');
  add(thirdFriday(today.getFullYear() + 2, 0), 'leaps');

  return out.sort((a, b) => a.dte - b.dte);
}

/* -------------------------------- strikes ------------------------------ */

function strikeStep(spot: number): number {
  if (spot >= 500) return 10;
  if (spot >= 200) return 5;
  if (spot >= 100) return 2.5;
  if (spot >= 25) return 1;
  return 0.5;
}

function buildStrikes(spot: number, count = 41): number[] {
  const step = strikeStep(spot);
  const centre = Math.round(spot / step) * step;
  const half = Math.floor(count / 2);
  const out: number[] = [];
  for (let i = -half; i <= half; i++) {
    const k = round(centre + i * step, 2);
    if (k > 0) out.push(k);
  }
  return out;
}

/**
 * Volatility smile: implied vol rises away from the money, and put-side
 * strikes carry more than call-side — the equity skew every chain shows.
 */
function smileIv(baseIvPct: number, spot: number, strike: number, dte: number): number {
  const m = Math.log(strike / spot);
  const skew = -0.55 * m; // downside strikes bid up
  const curve = 1.9 * m * m; // both wings lift
  // Short-dated contracts show a steeper smile than long-dated ones.
  const termDamp = Math.min(1.6, Math.max(0.55, 45 / Math.max(dte, 5)));
  const iv = baseIvPct * (1 + (skew + curve) * termDamp);
  return round(Math.min(400, Math.max(4, iv)), 2);
}

/* ------------------------------- contracts ----------------------------- */

/** OCC-style: root + YYMMDD + C/P + strike × 1000, zero-padded to 8. */
export function occSymbol(
  underlying: string,
  expiry: string,
  right: OptionRight,
  strike: number,
): string {
  const [y, m, d] = expiry.split('-');
  const k = String(Math.round(strike * 1000)).padStart(8, '0');
  return `${underlying}${y.slice(2)}${m}${d}${right === 'call' ? 'C' : 'P'}${k}`;
}

/** Symbols on which the demo feed withholds Greeks, to exercise the model. */
function withholdGreeks(sym: string): boolean {
  return hash(sym) % 10 !== 0; // 90% arrive without Greeks
}
function withholdIv(sym: string): boolean {
  return hash(sym) % 7 === 0; // ~14% arrive without IV either
}
/** A few contracts quote nothing at all — the empty-state path. */
function noQuote(sym: string): boolean {
  return hash(sym) % 53 === 0;
}

function buildContract(
  underlying: string,
  spot: number,
  expiry: string,
  dte: number,
  strike: number,
  right: OptionRight,
  baseIvPct: number,
): OptionContract {
  const contractSymbol = occSymbol(underlying, expiry, right, strike);
  const r = rng(`${contractSymbol}|${day()}`);
  const timeYears = yearsToExpiry(dte);
  const ivPct = smileIv(baseIvPct, spot, strike, dte);

  if (noQuote(contractSymbol)) {
    return {
      contractSymbol,
      underlying,
      right,
      strike,
      expiry,
      dte,
      currency: 'USD',
      bid: null,
      ask: null,
      last: null,
      change: null,
      changePct: null,
      volume: null,
      openInterest: null,
      impliedVolatilityPct: null,
      greeks: { ...EMPTY_GREEKS },
      multiplier: 100,
      style: 'american',
      provenance: {
        source: DEMO_OPTIONS_SOURCE,
        asOf: bootTime,
        lastUpdated: bootTime,
        status: 'unavailable',
        reason: 'No quote is published for this contract in the demo dataset.',
      },
    };
  }

  const theo =
    optionPrice({
      spot,
      strike,
      timeYears,
      volatility: ivPct / 100,
      right,
    }) ?? 0;

  // Spread widens away from the money and on thin, long-dated series.
  const moneynessGap = Math.abs(Math.log(strike / spot));
  const spreadPct = Math.min(0.5, 0.02 + moneynessGap * 0.45 + between(r, 0, 0.04));
  const half = Math.max(0.01, theo * spreadPct * 0.5);

  const mid = Math.max(0.01, round(theo * between(r, 0.97, 1.03), 2));
  const bid = round(Math.max(0, mid - half), 2);
  const ask = round(mid + half, 2);
  const last = round(Math.max(0.01, mid * between(r, 0.96, 1.04)), 2);

  const prevMid = Math.max(0.01, mid * between(r, 0.82, 1.2));
  const change = round(last - prevMid, 2);
  const changePct = prevMid > 0 ? round((change / prevMid) * 100, 2) : null;

  // Activity concentrates near the money and on round strikes.
  const atmness = Math.exp(-Math.pow(moneynessGap * 7, 2));
  const roundBonus = strike % (strikeStep(spot) * 4) === 0 ? 1.8 : 1;
  const openInterest = Math.round(
    between(r, 20, 9000) * atmness * roundBonus + between(r, 0, 140),
  );
  const volume = Math.round(openInterest * between(r, 0.02, 1.4) * atmness + between(r, 0, 60));

  const supplyIv = !withholdIv(contractSymbol);
  const supplyGreeks = !withholdGreeks(contractSymbol);

  return {
    contractSymbol,
    underlying,
    right,
    strike,
    expiry,
    dte,
    currency: 'USD',
    bid,
    ask,
    last,
    change,
    changePct,
    volume,
    openInterest,
    impliedVolatilityPct: supplyIv ? ivPct : null,
    greeks: supplyGreeks
      ? {
          ...bsGreeks({
            spot,
            strike,
            timeYears,
            volatility: ivPct / 100,
            right,
          }),
          status: 'delayed',
        }
      : { ...EMPTY_GREEKS },
    multiplier: 100,
    style: 'american',
    provenance: prov('delayed', 15),
  };
}

/* -------------------------------- helpers ------------------------------ */

async function spotOf(symbol: string): Promise<number | null> {
  const quote = await getProvider().getQuote(symbol);
  return quote?.price ?? null;
}

function baseIvFor(symbol: string): number {
  const r = rng(`${symbol}|baseiv|${day()}`);
  return round(between(r, 18, 62), 2);
}

const chainCache = new Map<string, OptionChain>();

/* -------------------------------- provider ----------------------------- */

const info: OptionsProviderInfo = {
  id: 'demo-options',
  name: 'BIG MARGIN Demo Options',
  production: false,
  description:
    'Synthetic, deterministic options chains generated in the browser. Strike ladders, expiry calendars and the volatility skew are realistically shaped, but every quote, volume, open-interest and volatility figure is generated and must not be used for any decision.',
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
  delayMinutes: 15,
};

export const DemoOptionsProvider: OptionsDataProvider = {
  info,

  async hasOptions(symbol) {
    const inst = await getProvider().getInstrument(symbol);
    // Listed equity options exist on US names only; Tadawul has no retail
    // single-stock options, so the tab must not appear on Saudi instruments.
    return inst?.market === 'US';
  },

  async listExpiries(symbol) {
    if (!(await this.hasOptions(symbol))) return [];
    return buildExpiries(symbol);
  },

  async getChain(symbol, expiry) {
    const key = `${symbol}|${expiry}|${day()}`;
    const cached = chainCache.get(key);
    if (cached) return cached;

    if (!(await this.hasOptions(symbol))) return null;
    const spot = await spotOf(symbol);
    if (spot == null) return null;

    const dte = dteOf(expiry);
    const baseIv = baseIvFor(symbol);
    const strikes = buildStrikes(spot);

    const rows: ChainRow[] = strikes.map((strike) => ({
      strike,
      call: buildContract(symbol, spot, expiry, dte, strike, 'call', baseIv),
      put: buildContract(symbol, spot, expiry, dte, strike, 'put', baseIv),
    }));

    const chain: OptionChain = {
      underlying: symbol,
      expiry,
      dte,
      underlyingPrice: spot,
      rows,
      provenance: prov('delayed', 15),
    };

    chainCache.set(key, chain);
    return chain;
  },

  async getContract(contractSymbol) {
    const parsed = parseOccSymbol(contractSymbol);
    if (!parsed) return null;
    const chain = await this.getChain(parsed.underlying, parsed.expiry);
    if (!chain) return null;
    const row = chain.rows.find((x) => Math.abs(x.strike - parsed.strike) < 1e-6);
    const contract = parsed.right === 'call' ? row?.call : row?.put;
    return contract ?? null;
  },

  async getContractHistory(contractSymbol, days = 60) {
    const contract = await this.getContract(contractSymbol);
    if (!contract) return [];
    const end = contract.last ?? contract.bid ?? 1;
    const r = rng(`${contractSymbol}|history|${day()}`);
    const out: ContractCandle[] = [];

    // Walk backwards from the current price so the series ends where the
    // quote is, rather than drifting away from it.
    const closes: number[] = new Array(days);
    closes[days - 1] = end;
    for (let i = days - 2; i >= 0; i--) {
      const step = between(r, -0.09, 0.09);
      closes[i] = Math.max(0.01, closes[i + 1] / (1 + step));
    }

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const c = round(closes[i], 2);
      const o = round(i === 0 ? c : closes[i - 1], 2);
      out.push({
        t: iso(d),
        o,
        h: round(Math.max(o, c) * between(r, 1.0, 1.09), 2),
        l: round(Math.min(o, c) * between(r, 0.91, 1.0), 2),
        c,
        v: Math.round(between(r, 10, 4000)),
        openInterest: Math.round(between(r, 100, 9000)),
      });
    }
    return out;
  },

  async listFlow(opts = {}) {
    const { symbol, limit = 40, minPremium = 0 } = opts;
    if (!symbol) return [];
    const expiries = await this.listExpiries(symbol);
    if (expiries.length === 0) return [];

    const r = rng(`${symbol}|flow|${day()}`);
    const kinds: FlowKind[] = ['sweep', 'block', 'split', 'standard'];
    const out: FlowTrade[] = [];

    for (let i = 0; i < limit; i++) {
      const expiry = expiries[Math.floor(r() * Math.min(expiries.length, 6))];
      const chain = await this.getChain(symbol, expiry.date);
      if (!chain) continue;
      const row = chain.rows[Math.floor(r() * chain.rows.length)];
      const right: OptionRight = r() > 0.48 ? 'call' : 'put';
      const contract = right === 'call' ? row.call : row.put;
      if (!contract || contract.bid == null || contract.ask == null) continue;

      const size = Math.round(between(r, 20, 2500));
      const atAsk = r() > 0.5;
      const price = round(atAsk ? contract.ask : contract.bid, 2);
      const premium = round(price * size * contract.multiplier, 0);
      if (premium < minPremium) continue;

      out.push({
        id: `demo-flow-${symbol}-${i}`,
        contractSymbol: contract.contractSymbol,
        underlying: symbol,
        right,
        strike: contract.strike,
        expiry: contract.expiry,
        dte: contract.dte,
        price,
        size,
        premium,
        kind: kinds[Math.floor(r() * kinds.length)],
        side: atAsk ? 'at_ask' : 'at_bid',
        // Sentiment reflects only where the print hit relative to the quote.
        // It is a description of the tape, never a forecast.
        sentiment:
          right === 'call'
            ? atAsk
              ? 'bullish'
              : 'bearish'
            : atAsk
              ? 'bearish'
              : 'bullish',
        impliedVolatilityPct: contract.impliedVolatilityPct,
        openInterest: contract.openInterest,
        volume: contract.volume,
        timestamp: new Date(Date.now() - Math.round(between(r, 1, 380)) * 60000).toISOString(),
        provenance: prov('delayed', 15),
      });
    }

    return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  },

  async listUnusualActivity(opts = {}) {
    const { symbol, limit = 20 } = opts;
    if (!symbol) return [];
    const expiries = await this.listExpiries(symbol);
    const out: UnusualActivity[] = [];

    for (const expiry of expiries.slice(0, 4)) {
      const chain = await this.getChain(symbol, expiry.date);
      if (!chain) continue;
      for (const row of chain.rows) {
        for (const c of [row.call, row.put]) {
          if (!c || c.volume == null || c.openInterest == null || c.openInterest <= 0) continue;
          const ratio = c.volume / c.openInterest;
          if (ratio < 1) continue;
          const mid = c.bid != null && c.ask != null ? (c.bid + c.ask) / 2 : c.last;
          out.push({
            contract: c,
            volumeOiRatio: round(ratio, 3),
            volumeVsAverage: null,
            premium: mid == null ? null : round(mid * c.volume * c.multiplier, 0),
          });
        }
      }
    }

    return out.sort((a, b) => b.volumeOiRatio - a.volumeOiRatio).slice(0, limit);
  },

  async getIvStats(symbol): Promise<IvStats | null> {
    if (!(await this.hasOptions(symbol))) return null;
    const r = rng(`${symbol}|ivstats|${day()}`);
    const current = baseIvFor(symbol);
    const low = round(current * between(r, 0.45, 0.8), 2);
    const high = round(current * between(r, 1.25, 2.3), 2);
    return {
      underlying: symbol,
      currentIvPct: current,
      iv52wHighPct: high,
      iv52wLowPct: low,
      ivRank: round(((current - low) / (high - low)) * 100, 2),
      ivPercentile: round(between(r, 5, 95), 2),
      historicalVolatilityPct: round(current * between(r, 0.7, 1.25), 2),
      provenance: prov('calculated'),
    };
  },
};

/* -------------------------------- parsing ------------------------------ */

export function parseOccSymbol(sym: string): {
  underlying: string;
  expiry: string;
  right: OptionRight;
  strike: number;
} | null {
  // Root is variable length; the fixed 15-character tail is YYMMDD + C/P + 8 digits.
  const m = /^([A-Z.]{1,6})(\d{6})([CP])(\d{8})$/.exec(sym.trim().toUpperCase());
  if (!m) return null;
  const [, underlying, ymd, cp, strikeRaw] = m;
  const yy = Number(ymd.slice(0, 2));
  const expiry = `${2000 + yy}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`;
  return {
    underlying,
    expiry,
    right: cp === 'C' ? 'call' : 'put',
    strike: Number(strikeRaw) / 1000,
  };
}
