import { createStore, uid } from './createStore';
import type { MarketId, NewsImportance } from '@/types';

/* =========================================================================
   BIG MARGIN — News following and notifications

   Kept apart from the equity watchlist on purpose. Watching a share for its
   price and following a company for its news are different intentions: people
   watch shares they are considering, and follow companies they are exposed to.
   Collapsing the two means you cannot follow a company you do not watch, and
   cannot silence one you do.

   The portfolio and the watchlists still feed the follow set by default —
   being unable to mute a holding is its own annoyance, so `muted` exists.
   ========================================================================= */

/** How much of a company's news is worth interrupting the user for. */
export type NewsRule = 'critical' | 'important' | 'all' | 'off';

export interface NewsNotification {
  id: string;
  newsId: string;
  symbol: string;
  market: MarketId | null;
  headlineAr: string;
  headlineEn: string;
  importance: NewsImportance | null;
  publishedAt: string;
  createdAt: string;
  read: boolean;
}

export interface NewsState {
  /** Companies followed explicitly, beyond the portfolio and watchlists. */
  followed: string[];
  /** Companies silenced even though they are held or watched. */
  muted: string[];
  includePortfolio: boolean;
  includeWatchlists: boolean;
  /** Per-company override of `defaultRule`. */
  rules: Record<string, NewsRule>;
  defaultRule: NewsRule;
  notifications: NewsNotification[];
  /** Newest story already turned into notifications, so none is raised twice. */
  lastCheckedAt: string | null;
}

/** Notifications are capped: a feed that never forgets becomes a landfill. */
const MAX_NOTIFICATIONS = 200;

export const useNewsStore = createStore<NewsState>(
  {
    followed: [],
    muted: [],
    includePortfolio: true,
    includeWatchlists: true,
    rules: {},
    defaultRule: 'important',
    notifications: [],
    lastCheckedAt: null,
  },
  { key: 'news', version: 1 },
);

/* ------------------------------ following ------------------------------ */

export function toggleFollow(symbol: string): void {
  useNewsStore.set((s) => {
    if (s.followed.includes(symbol)) {
      return { followed: s.followed.filter((x) => x !== symbol) };
    }
    // Following something explicitly clears any mute on it: the later, more
    // specific instruction wins.
    return {
      followed: [...s.followed, symbol],
      muted: s.muted.filter((x) => x !== symbol),
    };
  });
}

export function toggleMute(symbol: string): void {
  useNewsStore.set((s) => {
    if (s.muted.includes(symbol)) {
      return { muted: s.muted.filter((x) => x !== symbol) };
    }
    return {
      muted: [...s.muted, symbol],
      followed: s.followed.filter((x) => x !== symbol),
    };
  });
}

export function followMany(symbols: string[]): void {
  useNewsStore.set((s) => {
    const next = new Set(s.followed);
    for (const x of symbols) next.add(x);
    return { followed: [...next], muted: s.muted.filter((x) => !symbols.includes(x)) };
  });
}

export function setRule(symbol: string, rule: NewsRule): void {
  useNewsStore.set((s) => ({ rules: { ...s.rules, [symbol]: rule } }));
}

export function clearRule(symbol: string): void {
  useNewsStore.set((s) => {
    const next = { ...s.rules };
    delete next[symbol];
    return { rules: next };
  });
}

export function setDefaultRule(rule: NewsRule): void {
  useNewsStore.set({ defaultRule: rule });
}

export function setSources(patch: {
  includePortfolio?: boolean;
  includeWatchlists?: boolean;
}): void {
  useNewsStore.set(patch);
}

/**
 * The companies whose news the user actually sees.
 *
 * Explicit follows, plus holdings and watchlists when those sources are on,
 * minus anything muted. Mute is applied last so it overrides every source.
 */
export function resolveFollowed(
  state: NewsState,
  held: string[],
  watched: string[],
): Set<string> {
  const out = new Set(state.followed);
  if (state.includePortfolio) for (const s of held) out.add(s);
  if (state.includeWatchlists) for (const s of watched) out.add(s);
  for (const s of state.muted) out.delete(s);
  return out;
}

/** The rule in force for one company. */
export function ruleFor(state: NewsState, symbol: string): NewsRule {
  return state.rules[symbol] ?? state.defaultRule;
}

/* ---------------------------- notifications ---------------------------- */

export interface NotificationCandidate {
  newsId: string;
  symbol: string;
  market: MarketId | null;
  headlineAr: string;
  headlineEn: string;
  importance: NewsImportance | null;
  publishedAt: string;
}

/**
 * Records notifications for stories not seen before.
 *
 * Deduplicates on (news id, symbol) rather than news id alone: one filing
 * naming two companies you follow is two notifications, because you will want
 * to act on it twice. Returns how many were added.
 */
export function pushNotifications(candidates: NotificationCandidate[]): number {
  if (candidates.length === 0) return 0;
  let added = 0;
  useNewsStore.set((s) => {
    const seen = new Set(s.notifications.map((n) => `${n.newsId}|${n.symbol}`));
    const fresh: NewsNotification[] = [];
    for (const c of candidates) {
      const key = `${c.newsId}|${c.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({
        id: uid(),
        ...c,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    added = fresh.length;
    if (fresh.length === 0) return {};
    const newest = candidates.reduce(
      (max, c) => (c.publishedAt > max ? c.publishedAt : max),
      s.lastCheckedAt ?? '',
    );
    return {
      notifications: [...fresh, ...s.notifications].slice(0, MAX_NOTIFICATIONS),
      lastCheckedAt: newest || s.lastCheckedAt,
    };
  });
  return added;
}

export function markRead(id: string): void {
  useNewsStore.set((s) => ({
    notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
  }));
}

export function markAllRead(): void {
  useNewsStore.set((s) => ({
    notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })),
  }));
}

export function dismissNotification(id: string): void {
  useNewsStore.set((s) => ({
    notifications: s.notifications.filter((n) => n.id !== id),
  }));
}

export function clearNotifications(): void {
  useNewsStore.set({ notifications: [] });
}

export function unreadCount(state: NewsState): number {
  return state.notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);
}
