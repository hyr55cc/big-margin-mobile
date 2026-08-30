<div align="center">

# BIG MARGIN

**Understand the Market. Measure the Impact.**
**افهم السوق. قِس التأثير.**

A market intelligence and portfolio platform for the Saudi (TASI) and US markets —
index weights, index impact, Shariah screening, screening, portfolio tracking and a
full calculator suite, in one connected product.

</div>

---

## What this repository is

A complete, production-shaped **frontend application**: React 18 + TypeScript + Vite,
Arabic-first with full RTL, dark and light themes, route-level code splitting, and a
calculation engine covered by unit tests.

Every screen reads through one interface — `MarketDataProvider` — so the dataset behind
the product is a single swap. Two implementations ship:

| Provider | `VITE_DATA_PROVIDER` | Purpose |
|---|---|---|
| `DemoProvider` | `demo` *(default)* | Synthetic, deterministic development data |
| `HttpProvider` | `http` | Talks to the BIG MARGIN backend over REST |

### ⚠️ About the data in this build

The default build runs on a **clearly-labelled synthetic dataset**. This is deliberate
and it is enforced in three places:

1. `src/data/demo/generate.ts` produces every price, weight, ratio, dividend and
   classification from a seeded pseudo-random sequence. Nothing in it is an observation
   of any real market, company, index or screening body.
2. `ProviderInfo.production` is `false` for the demo provider, which drives a
   **permanent "Demo data" banner** across every page of the application.
3. Only **company identity** is real — exchange symbol, Arabic and English company name,
   and sector classification, in `src/data/demo/reference.ts`. That file contains no
   numbers at all.

Figures from this build must not be used for trading, valuation or Shariah decisions.
Connect a real provider (below) before the product is used for anything.

---

Deployment, including the SPA rewrite every host needs, is in **[DEPLOY.md](DEPLOY.md)**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview    # serve the build
npm test           # calculation engine test suite
npm run typecheck  # tsc --noEmit
```

Node 20+ is required.

---

## Connecting a real data source

The frontend never talks to a vendor API and never holds a vendor key. It talks to your
backend, which normalises each upstream feed into the shapes in `src/types`.

```bash
cp .env.example .env
```

```ini
VITE_DATA_PROVIDER=http
VITE_API_BASE_URL=https://api.your-domain.com/api/v1
```

`src/data/live/HttpProvider.ts` documents the full endpoint map it expects. The essential
contract your backend must honour:

**1. Never invent a value.** An unknown field is `null`, and the record's `provenance`
carries `status: 'unavailable'` with a `reason`. The UI renders `Data unavailable` — it
never substitutes a zero.

**2. Every record carries provenance.**

```ts
interface Provenance {
  source: string;        // who published it
  asOf: string;          // when the source produced it
  lastUpdated: string;   // when BIG MARGIN last refreshed it
  status: 'live' | 'delayed' | 'calculated' | 'estimated' | 'unavailable';
  delayMinutes?: number;
  reason?: string;
}
```

This is what renders the status chip next to every figure in the product.

**3. Sourced vs derived.** Index weights and Shariah classifications are *sourced* — the
frontend never computes them. Index impact *is* derived, and every derived figure is
labelled `Calculated` and exposes its formula in a tooltip.

To add a third source, implement `MarketDataProvider` and register it in
`src/data/registry.ts`. No page imports a dataset directly, so nothing else changes.

---

### Options data

Options are configured separately from equities (`VITE_OPTIONS_PROVIDER`), because they
price separately and most equity tiers exclude them. Setting it to `off` hides the section
entirely — the nav entry disappears and the profile tab is not rendered — which is the
correct choice when no chain is licensed. Shipping an empty ladder would read as a quiet
market rather than as absent data.

Listed equity options are a US product. Tadawul lists no retail single-stock options, so
`hasOptions` is false for every Saudi instrument and the tab never appears there.

## Index impact methodology

TASI is a free-float market-capitalisation weighted index:

```
Index Level = Σ (free-float shares × price) ÷ Divisor
```

Two figures follow, and both are computed in `src/lib/calc/indexImpact.ts`:

**Sensitivity** — a one-riyal move in constituent *i* moves the index by

```
Points per 1 SAR = free-float shares(i) ÷ Divisor
                 = Weight%(i) ÷ 100 × Index Level ÷ Price(i)
```

The second form is preferred because weight, level and price are the three fields a data
provider is most likely to supply. When the administrator's official divisor *is* on
file, the first form is used instead.

**Contribution** — the points constituent *i* added to today's move:

```
Contribution = Weight%(i) ÷ 100 × Change%(i) ÷ 100 × Previous Index Level
```

When no official divisor is published, BIG MARGIN derives an **implied divisor** from the
index level and the aggregate free-float cap of the constituents on file, and says so in
the interface. Scenario output is labelled a mathematical scenario, never a forecast.

---

## Position mathematics

In `src/lib/calc/position.ts`, with 51 unit tests in `src/test/calc.test.ts`.

| Figure | Rule |
|---|---|
| Average cost | `Total Cost ÷ Total Shares` — **never** a mean of prices |
| Total cost | `Σ(price × qty) + Σ(commission + fees + other)` |
| Break-even | `(Total Cost + Flat Sell Fees) ÷ (Shares × (1 − Sell Fee Rate))` |
| Gross profit | `(Sell − Buy) × Shares` |
| Net profit | `Gross − Buy Fees − Sell Fees` |
| Return % | `Net Profit ÷ Total Cost × 100` |
| Realised P&L | Weighted-average method; a sale removes shares at the running average |
| Total return | `Capital Gain + Dividend Income`, reported separately as well as combined |

Realised and unrealised results never contaminate each other, and money is handled
through integer-scaled arithmetic (`src/lib/decimal.ts`) so repeated addition of prices
and fees does not accumulate binary float error.

Every calculation returns a `Calculation<T>` envelope carrying its **inputs**, its
**formula** and a **computed-at timestamp** — which is what the interface displays under
each result.

---

## Shariah module

Three methodologies ship as reference material in `src/data/demo/methodologies.ts` —
AAOIFI, S&P Shariah and DJIM — each with its rules, thresholds, denominators, source name
and source URL. Per instrument the product shows:

- status under the selected methodology, with **every screening ratio expanded**
  (numerator, denominator, threshold, pass/fail);
- a **cross-methodology comparison**, because classification legitimately differs when
  thresholds and denominators differ;
- a **history** of recorded classification changes.

> **BIG MARGIN is an analytical and computational tool and is not a fatwa authority or
> religious advisory body. Shariah classifications must be verified against the relevant
> authoritative source and the latest published screening.**

This disclaimer is rendered on every Shariah surface in the product, not only here.

---

## Project layout

```
src/
  types/            Domain model — every record carries provenance
  data/
    provider.ts     The MarketDataProvider contract
    registry.ts     Which provider is active
    MarketContext   Joins market + index + Shariah + user data into MarketRow
    demo/           ⚠️ Synthetic generator + real company identity only
    live/           HTTP provider against the BIG MARGIN backend
  data/options/     Separate OptionsDataProvider + per-expiry chain hooks
  lib/
    decimal.ts      Integer-scaled money arithmetic
    format.ts       Formatting; missing values render "—", never 0
    calc/           position · indexImpact · income
                    blackScholes · options · optionStrategies
    portfolioMath   Ledger → positions → portfolio summary
  i18n/             ar (default, RTL) + en (LTR), fully keyed
  store/            Dependency-free selector store, localStorage-persisted
  components/
    ui/             Card, DataTable, Badge, Modal, Tooltip, forms, states
    charts/         Dependency-free SVG: line, bar, donut, treemap, payoff
    market/         Columns, cells, search, Shariah panels
    options/        Chain ladder, expiry rail, contract sheet, strategy builder
    portfolio/      Transaction and alert modals
    layout/         App shell, sidebar, topbar, mobile nav
  pages/            35 routes, lazily loaded
  test/             Calculation engine suite
```

### Charts

Built from scratch in SVG — no charting dependency. The categorical palette is the
validated eight-hue set (adjacent-pair CVD ΔE ≥ 8, normal-vision ΔE ≥ 15, ≥ 3:1 contrast
on both chart surfaces), assigned in fixed slot order and never cycled.

Market direction uses the domain's conventional red↔green, which is a colour-vision
hazard — so **every mark that uses it also carries a signed numeric label**, and direction
is never communicated by hue alone. There are no dual-axis charts anywhere: comparisons
are indexed to a common base instead.

### State

A ~120-line selector store built on `useSyncExternalStore` (`src/store/createStore.ts`),
persisted to `localStorage` with versioning and migration. Portfolio, watchlists, alerts
and preferences are local to the browser in this build; the account surface documents
what would sync once an auth backend is configured.

---

## What is implemented

**Markets** — dashboard for both markets, Saudi and US market pages with index charts and
breadth, heatmap (size and colour by chosen metric, optionally grouped by sector).

**Index intelligence** — TASI Weight (all constituents, points/SAR, daily impact,
searchable, sortable, column picker, CSV export), TASI Impact (Top 10/20/50 by weight,
daily impact or points per SAR), multi-stock impact calculator, What-If simulator with
sliders, TASI Distribution (treemap / bar / donut, by stock or by sector), Sectors with
drill-down.

**Research** — Shariah screening with full ratio transparency and methodology pages, Smart
Screener (17 filters, 8 presets), Rankings (10 boards), Compare (up to 5, indexed to 100),
News.

**Events** — dividends with calculator, corporate actions, earnings calendar.

**Your desk** — portfolio (positions, transactions, allocation, performance vs TASI,
Shariah composition, index exposure), multiple watchlists, alert rules, and the calculator
centre: average cost, profit/loss with payoff chart and scenario table, break-even, target
price, target return, averaging simulator with what-if amounts, dividend, investment
allocation.

**Options** — a US-only section, reached from an Options tab on a US stock profile or
from the standalone options desk at `/app/options`. Per expiry: the chain ladder (calls
and puts mirrored around a centred strike column, ITM shading, spot marker row), an expiry
rail split by weekly / monthly / quarterly / LEAPS with days to expiration, a contract
inspector with the five Greeks, moneyness, the intrinsic/extrinsic split, break-even and
probability ITM, chain charts (open interest, volume, IV and each Greek by strike, with
max pain and put/call ratios), options flow and unusual activity where the feed supplies
them, a strategy builder covering twelve named strategies plus custom leg combinations
with an exact piecewise-linear payoff, and a contract watchlist.

Two rules shape the whole section. **Greeks and implied volatility the feed omits are
priced by BIG MARGIN** with Black–Scholes–Merton from the mid quote and labelled
`calculated`; a vendor value is never overwritten, field by field. And **a missing premium
is never treated as zero** — a position with an unquoted leg reports as unavailable rather
than drawing a payoff line that flatters it. Implied volatility is solved by bisection
rather than Newton–Raphson, because vega collapses for deep ITM and OTM contracts and
Newton stalls exactly where the chain is widest.

**Surfaces** — premium landing page, BIG MARGIN WALL (TV mode with auto-rotation and
ticker), settings, account, admin (provider status, sync jobs, validation errors).

## What is not implemented

The **backend**. This repository is the frontend and its data contract. A production
deployment needs a Node + TypeScript + PostgreSQL service that:

- normalises vendor feeds into `src/types` shapes, with provenance on every record;
- runs the scheduled synchronisation jobs the admin surface already displays;
- enforces the validation rules the admin surface already reports;
- provides auth, rate limiting and caching;
- holds every vendor credential — none belong in this bundle.

Also pending: push delivery for alerts, and packaging for Android TV / webOS (the wall
mode is already resolution-independent).

**No service worker, deliberately.** The web app manifest, icons and iOS metadata are in
place, so the app installs to a home screen and runs standalone. What it does not do is
cache market data for offline reading. A stale quote served from a cache has no honest
provenance — it is neither live, delayed, nor calculated, and the whole product rests on
every figure knowing what it is. An app-shell-only service worker could be added without
touching that, but caching responses could not.

---

## Disclaimers

**Investment** — BIG MARGIN provides analytical and informational tools only. Nothing on
the platform constitutes financial, investment, legal, tax, or trading advice.

**Shariah** — BIG MARGIN is an analytical and computational tool and is not a fatwa
authority. Shariah classifications should be verified against the relevant authoritative
source and the latest published screening.

**Data** — Market data may be delayed, estimated, or calculated depending on the source.
Every figure displays its own status and timestamp.
