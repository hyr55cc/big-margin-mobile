import { useEffect, useMemo, useRef } from 'react';
import { useMarket } from '@/data/MarketContext';
import { usePortfolioSummary } from '@/lib/portfolioMath';
import { useWatchlists } from '@/store/watchlist';
import {
  pushNotifications,
  resolveFollowed,
  ruleFor,
  useNewsStore,
  type NewsRule,
  type NotificationCandidate,
} from '@/store/news';
import {
  meetsLevel,
  rateImportance,
  relevanceFor,
  sortRanked,
  type RankedNews,
} from '@/lib/calc/newsImportance';
import type { CorporateAction, EarningsEvent, NewsItem, NewsImportance } from '@/types';

/** The minimum level a rule lets through, or null when the rule is "off". */
function thresholdFor(rule: NewsRule): NewsImportance | null {
  if (rule === 'off') return null;
  if (rule === 'all') return 'routine';
  return rule; // 'critical' | 'important'
}

/** Symbols the user holds, from the portfolio ledger. */
export function useHeldSymbols(): Set<string> {
  const pf = usePortfolioSummary();
  return useMemo(
    () => new Set(pf.positions.filter((p) => p.shares > 0).map((p) => p.symbol)),
    [pf.positions],
  );
}

/** Symbols on any watchlist. */
export function useWatchedSymbols(): Set<string> {
  const lists = useWatchlists((s) => s.lists);
  return useMemo(
    () => new Set(lists.flatMap((l) => l.entries.map((e) => e.symbol))),
    [lists],
  );
}

/** The resolved follow set: explicit follows + chosen sources − mutes. */
export function useFollowedSymbols(): Set<string> {
  const state = useNewsStore((s) => s);
  const held = useHeldSymbols();
  const watched = useWatchedSymbols();
  return useMemo(
    () => resolveFollowed(state, [...held], [...watched]),
    [state, held, watched],
  );
}

/**
 * Rates a list of stories and orders them.
 *
 * Scheduled dates are passed through so the corroboration signal can fire —
 * without them that rule simply never contributes, which is the correct
 * behaviour rather than a silent zero.
 */
export function useRankedNews(
  items: NewsItem[] | null,
  opts: {
    earnings?: EarningsEvent[] | null;
    actions?: CorporateAction[] | null;
  } = {},
): RankedNews[] {
  const held = useHeldSymbols();
  const followed = useFollowedSymbols();

  const scheduledBySymbol = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (symbol: string, date: string | null) => {
      if (!date) return;
      const list = map.get(symbol);
      if (list) list.push(date);
      else map.set(symbol, [date]);
    };
    for (const e of opts.earnings ?? []) add(e.symbol, e.date);
    for (const a of opts.actions ?? []) {
      add(a.symbol, a.effectiveDate);
      add(a.symbol, a.announcedDate);
    }
    return map;
  }, [opts.earnings, opts.actions]);

  return useMemo(() => {
    const rows = (items ?? []).map((item) => {
      const scheduledDates = item.symbols.flatMap((s) => scheduledBySymbol.get(s) ?? []);
      return {
        item,
        importance: rateImportance(item, { scheduledDates }),
        relevance: relevanceFor(item, held, followed),
      };
    });
    return sortRanked(rows);
  }, [items, scheduledBySymbol, held, followed]);
}

/**
 * Raises notifications for stories that clear a followed company's rule.
 *
 * Runs when the ranked feed changes. Deduplication lives in the store, so a
 * re-render or a refetch of the same stories adds nothing; only genuinely new
 * items produce a notification.
 *
 * Nothing here polls in the background: the app has no service worker and no
 * server, so notifications appear when the app is open and the feed is
 * refreshed. Saying otherwise would promise delivery the build cannot make.
 */
export function useNewsNotifications(ranked: RankedNews[]): void {
  const rules = useNewsStore((s) => s.rules);
  const defaultRule = useNewsStore((s) => s.defaultRule);
  const followed = useFollowedSymbols();
  // Ratings are recomputed on every render; only the story identities matter
  // for deciding whether there is new work to do.
  const signature = ranked.map((r) => r.item.id).join('|');
  const lastSignature = useRef('');

  useEffect(() => {
    if (ranked.length === 0) return;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    const state = useNewsStore.get();
    const candidates: NotificationCandidate[] = [];

    for (const { item, importance } of ranked) {
      for (const symbol of item.symbols) {
        if (!followed.has(symbol)) continue;
        const threshold = thresholdFor(ruleFor(state, symbol));
        if (threshold == null) continue;
        if (!meetsLevel(importance.level, threshold)) continue;
        candidates.push({
          newsId: item.id,
          symbol,
          market: item.market ?? null,
          headlineAr: item.headline.ar,
          headlineEn: item.headline.en,
          importance: importance.level,
          publishedAt: item.publishedAt,
        });
      }
    }

    pushNotifications(candidates);
    // `rules` and `defaultRule` participate so that tightening a rule takes
    // effect on the next feed change rather than needing a reload.
  }, [signature, ranked, followed, rules, defaultRule]);
}

/** Companies the app knows about, for the follow picker. */
export function useFollowCandidates() {
  const { rows } = useMarket();
  return rows;
}
