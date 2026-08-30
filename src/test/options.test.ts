/* =========================================================================
   BIG MARGIN — options engine tests

   Options figures are the easiest place in the app to be plausibly wrong, so
   every function is pinned against something independent of itself: published
   Black–Scholes reference values, put-call parity, closed-form payoffs, and
   the no-arbitrage bounds a solved implied volatility must respect.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RISK_FREE_RATE,
  breakEvenPrice,
  daysToExpiry,
  extrinsicValue,
  greeks,
  impliedVolatility,
  intrinsicValue,
  moneyness,
  normCdf,
  optionPrice,
  parityResidual,
  probabilityItm,
  yearsToExpiry,
} from '@/lib/calc/blackScholes';
import {
  analyseContract,
  enrichContract,
  ivPercentile,
  ivRank,
  maxPainStrike,
  midPrice,
  summariseChain,
} from '@/lib/calc/options';
import {
  breakEvens,
  buildTemplateLegs,
  evaluateStrategy,
  payoffAtExpiry,
  STRATEGY_TEMPLATES,
} from '@/lib/calc/optionStrategies';
import type { ChainRow, OptionChain, OptionContract, StrategyLeg } from '@/types/options';
import type { Provenance } from '@/types';

const PROV: Provenance = {
  source: 'test',
  asOf: '2026-08-30T00:00:00.000Z',
  lastUpdated: '2026-08-30T00:00:00.000Z',
  status: 'delayed',
};

function contract(over: Partial<OptionContract> = {}): OptionContract {
  return {
    contractSymbol: 'TEST260918C00100000',
    underlying: 'TEST',
    right: 'call',
    strike: 100,
    expiry: '2026-09-18',
    dte: 30,
    style: 'american',
    multiplier: 100,
    bid: 5.4,
    ask: 5.6,
    last: 5.5,
    volume: 500,
    openInterest: 1000,
    impliedVolatilityPct: 30,
    greeks: { delta: null, gamma: null, theta: null, vega: null, rho: null, status: 'unavailable' },
    provenance: PROV,
    ...over,
  } as OptionContract;
}

/* ============================ normal CDF ============================== */

describe('normCdf', () => {
  it('matches the standard normal table at the usual checkpoints', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1)).toBeCloseTo(0.8413447, 5);
    expect(normCdf(1.96)).toBeCloseTo(0.9750021, 5);
    expect(normCdf(-1.645)).toBeCloseTo(0.05, 4);
  });

  it('is symmetric about zero', () => {
    for (const x of [0.3, 1.1, 2.7]) {
      expect(normCdf(x) + normCdf(-x)).toBeCloseTo(1, 10);
    }
  });
});

/* ========================= Black–Scholes pricing ====================== */

describe('optionPrice', () => {
  // Hull, Options, Futures and Other Derivatives — the standard worked
  // example: S=42, K=40, r=10%, sigma=20%, T=0.5 gives c=4.76, p=0.81.
  const base = { spot: 42, strike: 40, timeYears: 0.5, volatility: 0.2, rate: 0.1 };

  it('reproduces the textbook call value', () => {
    expect(optionPrice({ ...base, right: 'call' })).toBeCloseTo(4.76, 2);
  });

  it('reproduces the textbook put value', () => {
    expect(optionPrice({ ...base, right: 'put' })).toBeCloseTo(0.81, 2);
  });

  it('satisfies put-call parity', () => {
    const call = optionPrice({ ...base, right: 'call' })!;
    const put = optionPrice({ ...base, right: 'put' })!;
    // c − p = S·e^(−qT) − K·e^(−rT)
    const rhs = base.spot - base.strike * Math.exp(-base.rate * base.timeYears);
    expect(call - put).toBeCloseTo(rhs, 6);
    expect(parityResidual({ callPrice: call, putPrice: put, ...base })).toBeCloseTo(0, 6);
  });

  it('collapses to intrinsic value at expiry', () => {
    expect(optionPrice({ spot: 110, strike: 100, timeYears: 0, volatility: 0.3, right: 'call' }))
      .toBe(10);
    expect(optionPrice({ spot: 110, strike: 100, timeYears: 0, volatility: 0.3, right: 'put' }))
      .toBe(0);
  });

  it('returns null rather than a number when an input is missing', () => {
    expect(optionPrice({ spot: 100, strike: 100, timeYears: 0.5, volatility: NaN, right: 'call' }))
      .toBeNull();
  });

  it('prices a dividend-paying underlying below its non-paying equivalent', () => {
    const without = optionPrice({ ...base, right: 'call' })!;
    const with3pct = optionPrice({ ...base, right: 'call', dividendYield: 0.03 })!;
    expect(with3pct).toBeLessThan(without);
  });
});

/* ================================ Greeks ============================== */

describe('greeks', () => {
  const atm = { spot: 100, strike: 100, timeYears: 1, volatility: 0.2, rate: 0.05 };

  it('gives an at-the-money call a delta a little above one half', () => {
    const g = greeks({ ...atm, right: 'call' });
    expect(g.delta!).toBeGreaterThan(0.5);
    expect(g.delta!).toBeLessThan(0.7);
  });

  it('keeps call and put delta one apart, as parity requires', () => {
    const c = greeks({ ...atm, right: 'call' });
    const p = greeks({ ...atm, right: 'put' });
    expect(c.delta! - p.delta!).toBeCloseTo(1, 6);
  });

  it('shares gamma and vega between the two rights', () => {
    const c = greeks({ ...atm, right: 'call' });
    const p = greeks({ ...atm, right: 'put' });
    expect(c.gamma!).toBeCloseTo(p.gamma!, 10);
    expect(c.vega!).toBeCloseTo(p.vega!, 10);
  });

  it('reports theta per calendar day, not per year', () => {
    const g = greeks({ ...atm, right: 'call' });
    // A one-year 20% vol ATM call loses roughly 4 per year, so well under
    // 0.05 a day — a per-year figure would be two orders of magnitude larger.
    expect(g.theta!).toBeLessThan(0);
    expect(Math.abs(g.theta!)).toBeLessThan(0.05);
  });

  it('reports vega per percentage point, not per unit of volatility', () => {
    const g = greeks({ ...atm, right: 'call' });
    // Per-unit vega for this contract is near 37; per point it is near 0.37.
    expect(g.vega!).toBeGreaterThan(0.2);
    expect(g.vega!).toBeLessThan(0.6);
  });

  it('returns all-null Greeks rather than zeros when it cannot price', () => {
    const g = greeks({ spot: 100, strike: 100, timeYears: -1, volatility: 0.2, right: 'call' });
    expect(g).toEqual({
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      rho: null,
      status: 'unavailable',
    });
  });
});

/* ========================= Implied volatility ========================= */

describe('impliedVolatility', () => {
  it('recovers the volatility that produced a price', () => {
    const args = { spot: 100, strike: 105, timeYears: 0.25, right: 'call' as const, rate: 0.045 };
    const price = optionPrice({ ...args, volatility: 0.34 })!;
    const iv = impliedVolatility({ ...args, price });
    expect(iv!).toBeCloseTo(0.34, 4);
  });

  it('recovers it for a deep in-the-money put, where Newton–Raphson stalls', () => {
    const args = { spot: 50, strike: 90, timeYears: 0.1, right: 'put' as const };
    const price = optionPrice({ ...args, volatility: 0.6 })!;
    const iv = impliedVolatility({ ...args, price });
    expect(iv!).toBeCloseTo(0.6, 3);
  });

  it('returns null for a price below the no-arbitrage floor', () => {
    // A call cannot be worth less than S − K·e^(−rT).
    const iv = impliedVolatility({
      price: 0.01,
      spot: 150,
      strike: 100,
      timeYears: 1,
      right: 'call',
    });
    expect(iv).toBeNull();
  });

  it('returns null for a price above the underlying', () => {
    const iv = impliedVolatility({
      price: 120,
      spot: 100,
      strike: 100,
      timeYears: 1,
      right: 'call',
    });
    expect(iv).toBeNull();
  });

  it('returns null at or past expiry instead of guessing', () => {
    expect(
      impliedVolatility({ price: 5, spot: 100, strike: 100, timeYears: 0, right: 'call' }),
    ).toBeNull();
  });
});

/* ======================== Per-contract analysis ======================= */

describe('contract analysis', () => {
  it('takes the mid from bid and ask, and falls back to last only when a side is missing', () => {
    expect(midPrice(contract())).toBeCloseTo(5.5, 6);
    expect(midPrice(contract({ bid: null, ask: null, last: 3.1 }))).toBeCloseTo(3.1, 6);
    expect(midPrice(contract({ bid: null, ask: null, last: null }))).toBeNull();
  });

  it('splits the premium into intrinsic and extrinsic', () => {
    expect(intrinsicValue(110, 100, 'call')).toBe(10);
    expect(intrinsicValue(90, 100, 'call')).toBe(0);
    expect(intrinsicValue(90, 100, 'put')).toBe(10);
    expect(extrinsicValue(12.5, 110, 100, 'call')).toBeCloseTo(2.5, 6);
  });

  it('never lets extrinsic value go negative on a stale quote', () => {
    expect(extrinsicValue(8, 110, 100, 'call')).toBe(0);
  });

  it('computes break-even from the strike and the premium paid', () => {
    expect(breakEvenPrice(100, 2.5, 'call')).toBe(102.5);
    expect(breakEvenPrice(100, 2.5, 'put')).toBe(97.5);
    expect(breakEvenPrice(100, null, 'call')).toBeNull();
  });

  it('reads moneyness as a band around spot, not a point', () => {
    expect(moneyness(100, 100, 'call')).toBe('ATM');
    expect(moneyness(100, 100.4, 'call')).toBe('ATM');
    expect(moneyness(100, 95, 'call')).toBe('ITM');
    expect(moneyness(100, 105, 'call')).toBe('OTM');
    expect(moneyness(100, 105, 'put')).toBe('ITM');
    expect(moneyness(null, 105, 'put')).toBeNull();
  });

  it('reports every input and the formula alongside the numbers', () => {
    const a = analyseContract(contract(), 104);
    expect(a.moneyness).toBe('ITM');
    expect(a.intrinsicValue).toBeCloseTo(4, 6);
    expect(a.extrinsicValue).toBeCloseTo(1.5, 6);
    expect(a.breakEven).toBeCloseTo(105.5, 6);
    expect(a.formula.length).toBeGreaterThan(0);
  });

  it('leaves the analysis unavailable rather than assuming a spot price', () => {
    const a = analyseContract(contract(), null);
    expect(a.moneyness).toBeNull();
    expect(a.intrinsicValue).toBeNull();
    expect(a.extrinsicValue).toBeNull();
    expect(a.status).toBe('calculated');
  });

  it('keeps a risk/reward null for a contract with no quote', () => {
    const a = analyseContract(contract({ bid: null, ask: null, last: null }), 100);
    expect(a.mid).toBeNull();
    expect(a.breakEven).toBeNull();
  });
});

describe('enrichContract', () => {
  const spot = 104;

  it('prices the Greeks the feed omitted, and marks them calculated', () => {
    const out = enrichContract(contract(), spot);
    expect(out.greeks.delta).not.toBeNull();
    expect(out.greeks.vega).not.toBeNull();
    expect(out.greeks.status).toBe('calculated');
    // The quote itself is still whatever the feed said it was.
    expect(out.provenance.status).toBe('delayed');
  });

  it('never overwrites a Greek the feed did supply', () => {
    const vendor = contract({
      greeks: {
        delta: 0.123,
        gamma: null,
        theta: null,
        vega: null,
        rho: null,
        status: 'delayed' as const,
      },
    });
    const out = enrichContract(vendor, spot);
    expect(out.greeks.delta).toBe(0.123);
    expect(out.greeks.gamma).not.toBeNull();
  });

  it('solves implied volatility when the feed omits it', () => {
    const out = enrichContract(contract({ impliedVolatilityPct: null }), spot);
    expect(out.impliedVolatilityPct).not.toBeNull();
    expect(out.impliedVolatilityPct!).toBeGreaterThan(0);
  });

  it('leaves everything null when there is no quote to price from', () => {
    const out = enrichContract(
      contract({ bid: null, ask: null, last: null, impliedVolatilityPct: null }),
      spot,
    );
    expect(out.greeks.delta).toBeNull();
    expect(out.impliedVolatilityPct).toBeNull();
  });
});

/* ============================ Chain figures =========================== */

function row(strike: number, callOi: number, putOi: number): ChainRow {
  return {
    strike,
    call: contract({ strike, right: 'call', openInterest: callOi, volume: callOi }),
    put: contract({ strike, right: 'put', openInterest: putOi, volume: putOi }),
  };
}

describe('chain summary', () => {
  const chain: OptionChain = {
    underlying: 'TEST',
    expiry: '2026-09-18',
    dte: 30,
    underlyingPrice: 100,
    rows: [row(95, 100, 400), row(100, 300, 300), row(105, 400, 100)],
    provenance: PROV,
  };

  it('finds the strike where option holders are owed least', () => {
    // Total exercise value is smallest at the middle strike here.
    expect(maxPainStrike(chain.rows)).toBe(100);
  });

  it('returns null max pain rather than a strike when there is no open interest', () => {
    const empty = [row(95, 0, 0), row(100, 0, 0)].map((r) => ({
      ...r,
      call: contract({ openInterest: null }),
      put: contract({ openInterest: null }),
    }));
    expect(maxPainStrike(empty)).toBeNull();
  });

  it('sums volume and open interest by side', () => {
    const s = summariseChain(chain);
    expect(s.callVolume).toBe(800);
    expect(s.putVolume).toBe(800);
    expect(s.putCallVolumeRatio).toBeCloseTo(1, 6);
  });
});

describe('IV rank and percentile', () => {
  it('places current IV inside its own 52-week range', () => {
    expect(ivRank(30, 20, 40)).toBeCloseTo(50, 6);
    expect(ivRank(20, 20, 40)).toBeCloseTo(0, 6);
    expect(ivRank(40, 20, 40)).toBeCloseTo(100, 6);
  });

  it('returns null when the range has collapsed or an input is missing', () => {
    expect(ivRank(30, 30, 30)).toBeNull();
    expect(ivRank(null, 20, 40)).toBeNull();
  });

  it('counts the share of sessions below today', () => {
    expect(ivPercentile(30, [10, 20, 40, 50])).toBeCloseTo(50, 6);
    expect(ivPercentile(30, [])).toBeNull();
  });
});

/* ============================= Strategies ============================= */

function leg(over: Partial<StrategyLeg>): StrategyLeg {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'option',
    quantity: 1,
    right: 'call',
    strike: 100,
    expiry: '2026-09-18',
    price: 3,
    multiplier: 100,
    contractSymbol: null,
    ...over,
  };
}

describe('payoffAtExpiry', () => {
  it('prices a long call against its closed form', () => {
    const legs = [leg({ right: 'call', strike: 100, price: 3, quantity: 1 })];
    // (max(0, S − K) − premium) × 100
    expect(payoffAtExpiry(legs, 90)).toBeCloseTo(-300, 6);
    expect(payoffAtExpiry(legs, 103)).toBeCloseTo(0, 6);
    expect(payoffAtExpiry(legs, 120)).toBeCloseTo(1700, 6);
  });

  it('mirrors it for a short call', () => {
    const legs = [leg({ quantity: -1, price: 3 })];
    expect(payoffAtExpiry(legs, 90)).toBeCloseTo(300, 6);
    expect(payoffAtExpiry(legs, 120)).toBeCloseTo(-1700, 6);
  });

  it('caps a vertical spread at the width less the debit', () => {
    const legs = [
      leg({ strike: 100, price: 5, quantity: 1 }),
      leg({ strike: 110, price: 2, quantity: -1 }),
    ];
    expect(payoffAtExpiry(legs, 90)).toBeCloseTo(-300, 6);
    expect(payoffAtExpiry(legs, 200)).toBeCloseTo(700, 6);
  });

  it('adds a stock leg linearly', () => {
    const legs = [leg({ kind: 'stock', right: null, strike: null, price: 100, quantity: 100, multiplier: 1 })];
    expect(payoffAtExpiry(legs, 110)).toBeCloseTo(1000, 6);
  });
});

describe('breakEvens', () => {
  it('finds the single crossing of a long call', () => {
    const be = breakEvens([leg({ strike: 100, price: 3 })]);
    expect(be).toHaveLength(1);
    expect(be[0]).toBeCloseTo(103, 4);
  });

  it('finds both crossings of a straddle', () => {
    const be = breakEvens([
      leg({ right: 'call', strike: 100, price: 4 }),
      leg({ right: 'put', strike: 100, price: 4 }),
    ]);
    expect(be).toHaveLength(2);
    expect(be[0]).toBeCloseTo(92, 3);
    expect(be[1]).toBeCloseTo(108, 3);
  });
});

describe('evaluateStrategy', () => {
  it('marks a long call unbounded above and capped below', () => {
    const r = evaluateStrategy([leg({ strike: 100, price: 3 })], { strategyId: 'long_call' });
    expect(r.maxProfitUnlimited).toBe(true);
    expect(r.maxLossUnlimited).toBe(false);
    expect(r.maxLoss).toBeCloseTo(-300, 6);
    expect(r.netPremium).toBeCloseTo(-300, 6);
    expect(r.status).toBe('calculated');
  });

  it('marks a naked short call unbounded below', () => {
    const r = evaluateStrategy([leg({ quantity: -1, price: 3 })]);
    expect(r.maxLossUnlimited).toBe(true);
    expect(r.maxProfit).toBeCloseTo(300, 6);
  });

  it('bounds a bull call spread on both sides', () => {
    const r = evaluateStrategy(
      [leg({ strike: 100, price: 5 }), leg({ strike: 110, price: 2, quantity: -1 })],
      { strategyId: 'bull_call_spread' },
    );
    expect(r.maxProfitUnlimited).toBe(false);
    expect(r.maxLossUnlimited).toBe(false);
    expect(r.maxProfit).toBeCloseTo(700, 6);
    expect(r.maxLoss).toBeCloseTo(-300, 6);
    expect(r.riskRewardRatio).toBeCloseTo(700 / 300, 3);
  });

  it('bounds an iron condor on both sides', () => {
    const r = evaluateStrategy(
      [
        leg({ right: 'put', strike: 90, price: 1, quantity: 1 }),
        leg({ right: 'put', strike: 95, price: 2, quantity: -1 }),
        leg({ right: 'call', strike: 105, price: 2, quantity: -1 }),
        leg({ right: 'call', strike: 110, price: 1, quantity: 1 }),
      ],
      { strategyId: 'iron_condor' },
    );
    expect(r.maxProfitUnlimited).toBe(false);
    expect(r.maxLossUnlimited).toBe(false);
    expect(r.maxProfit).toBeCloseTo(200, 6);
    expect(r.maxLoss).toBeCloseTo(-300, 6);
    expect(r.breakEvens).toHaveLength(2);
  });

  it('reports unavailable rather than zero when no leg is priced', () => {
    const r = evaluateStrategy([leg({ price: null })]);
    expect(r.netPremium).toBeNull();
    expect(r.status).toBe('unavailable');
  });

  it('returns an unavailable result for an empty position', () => {
    const r = evaluateStrategy([]);
    expect(r.status).toBe('unavailable');
    expect(r.maxProfit).toBeNull();
  });
});

describe('strategy templates', () => {
  it('offers the twelve named strategies', () => {
    expect(STRATEGY_TEMPLATES).toHaveLength(12);
  });

  it('builds legs for every template without inventing a premium', () => {
    for (const tpl of STRATEGY_TEMPLATES) {
      const legs = buildTemplateLegs(tpl.id, 100, '2026-09-18');
      expect(legs.length).toBeGreaterThan(0);
      for (const l of legs.filter((l) => l.kind === 'option')) {
        expect(l.price).toBeNull();
      }
      for (const l of legs.filter((l) => l.kind === 'stock')) {
        expect(l.price).toBe(100);
      }
    }
  });
});

/* ============================== Calendar ============================== */

describe('expiry arithmetic', () => {
  it('converts days to years on a 365-day basis', () => {
    expect(yearsToExpiry(365)).toBeCloseTo(1, 10);
    expect(yearsToExpiry(30)).toBeCloseTo(30 / 365, 10);
  });

  it('counts calendar days to an expiry date', () => {
    expect(daysToExpiry('2026-09-18', new Date('2026-08-30T00:00:00Z'))).toBe(19);
    expect(daysToExpiry('2026-08-30', new Date('2026-08-30T00:00:00Z'))).toBe(0);
  });
});

describe('probabilityItm', () => {
  it('is near one half for an at-the-money contract', () => {
    const p = probabilityItm({
      spot: 100,
      strike: 100,
      timeYears: 0.25,
      volatility: 0.3,
      right: 'call',
      rate: DEFAULT_RISK_FREE_RATE,
    })!;
    expect(p).toBeGreaterThan(40);
    expect(p).toBeLessThan(60);
  });

  it('falls as the strike moves further out of the money', () => {
    const base = { spot: 100, timeYears: 0.25, volatility: 0.3, right: 'call' as const };
    const near = probabilityItm({ ...base, strike: 105 })!;
    const far = probabilityItm({ ...base, strike: 130 })!;
    expect(far).toBeLessThan(near);
  });
});
