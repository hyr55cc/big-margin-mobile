/* =========================================================================
   BIG MARGIN — News importance tests

   Importance is a judgement the app publishes about someone else's reporting,
   so the tests care less about the exact scores than about the boundaries that
   keep the judgement honest: an unclassified story is never called routine, a
   provider's rating is never overruled, and nothing is inferred from wording.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import {
  CATEGORY_WEIGHT,
  levelForScore,
  meetsLevel,
  rateImportance,
  relevanceFor,
  sortRanked,
  type RankedNews,
} from '@/lib/calc/newsImportance';
import {
  pushNotifications,
  resolveFollowed,
  ruleFor,
  unreadCount,
  type NewsState,
} from '@/store/news';
import type { NewsCategory, NewsImportance, NewsItem, Provenance } from '@/types';

const PROV: Provenance = {
  source: 'test-wire',
  asOf: '2026-08-30T09:00:00.000Z',
  lastUpdated: '2026-08-30T09:00:00.000Z',
  status: 'delayed',
};

function news(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'n1',
    headline: { ar: 'عنوان', en: 'Headline' },
    summary: null,
    sourceName: 'test-wire',
    url: null,
    publishedAt: '2026-08-30T09:00:00.000Z',
    symbols: ['2222'],
    market: 'SA',
    category: 'general',
    official: false,
    sourceImportance: null,
    provenance: PROV,
    ...over,
  };
}

/* ============================ the score itself ========================= */

describe('levelForScore', () => {
  it('pins the two boundaries', () => {
    expect(levelForScore(5)).toBe('critical');
    expect(levelForScore(4.9)).toBe('important');
    expect(levelForScore(3)).toBe('important');
    expect(levelForScore(2.9)).toBe('routine');
    expect(levelForScore(-5)).toBe('routine');
  });
});

describe('category weights', () => {
  it('ranks events that change the terms of ownership above commentary', () => {
    expect(CATEGORY_WEIGHT.earnings).toBeGreaterThan(CATEGORY_WEIGHT.rating);
    expect(CATEGORY_WEIGHT.capital).toBeGreaterThan(CATEGORY_WEIGHT.management);
    expect(CATEGORY_WEIGHT.mna).toBeGreaterThan(CATEGORY_WEIGHT.general);
  });

  it('covers every category, so no event type falls through as undefined', () => {
    const all: NewsCategory[] = [
      'earnings', 'dividend', 'corporate_action', 'capital', 'mna',
      'regulatory', 'management', 'guidance', 'rating', 'general',
    ];
    for (const c of all) expect(typeof CATEGORY_WEIGHT[c]).toBe('number');
  });
});

/* ======================== the honesty guarantees ======================= */

describe('rateImportance — what it refuses to do', () => {
  it('reports an unclassified story as unavailable, never as routine', () => {
    const r = rateImportance(news({ category: null }));
    expect(r.level).toBeNull();
    expect(r.origin).toBe('unavailable');
    expect(r.status).toBe('unavailable');
    // The distinction that matters: unknown is not the same as unimportant.
    expect(r.level).not.toBe('routine');
  });

  it('never overrules a rating the provider supplied', () => {
    const r = rateImportance(
      // Rules alone would make this routine; the source says critical.
      news({ category: 'general', official: false, sourceImportance: 'critical' }),
    );
    expect(r.level).toBe('critical');
    expect(r.origin).toBe('source');
    expect(r.signals).toHaveLength(0);
  });

  it('rates two differently-worded stories about the same event identically', () => {
    const dry = rateImportance(
      news({ id: 'a', headline: { ar: 'إفصاح', en: 'Q2 results disclosed' }, category: 'earnings', official: true }),
    );
    const dramatic = rateImportance(
      news({ id: 'b', headline: { ar: 'انهيار', en: 'SHOCK COLLAPSE in profits!!!' }, category: 'earnings', official: true }),
    );
    expect(dramatic.level).toBe(dry.level);
    expect(dramatic.score).toBe(dry.score);
  });
});

describe('rateImportance — the signals', () => {
  it('scores an official results disclosure as critical', () => {
    // earnings 3 + official 2 = 5
    const r = rateImportance(news({ category: 'earnings', official: true }));
    expect(r.score).toBe(5);
    expect(r.level).toBe('critical');
    expect(r.origin).toBe('calculated');
  });

  it('drops the same event to important when a media outlet reports it', () => {
    const r = rateImportance(news({ category: 'earnings', official: false }));
    expect(r.score).toBe(3);
    expect(r.level).toBe('important');
  });

  it('treats a null disclosure flag as absent rather than as false or true', () => {
    const unknown = rateImportance(news({ category: 'earnings', official: null }));
    const media = rateImportance(news({ category: 'earnings', official: false }));
    expect(unknown.score).toBe(media.score);
    expect(unknown.signals.some((s) => s.key === 'official')).toBe(false);
  });

  it('adds a point when the story lands beside a scheduled event', () => {
    const without = rateImportance(news({ category: 'dividend', official: false }));
    const beside = rateImportance(news({ category: 'dividend', official: false }), {
      scheduledDates: ['2026-08-31T00:00:00.000Z'],
    });
    expect(beside.score).toBe((without.score as number) + 1);
    expect(beside.signals.some((s) => s.key === 'scheduled')).toBe(true);
  });

  it('ignores a scheduled event outside the corroboration window', () => {
    const r = rateImportance(news({ category: 'dividend' }), {
      scheduledDates: ['2026-10-01T00:00:00.000Z'],
    });
    expect(r.signals.some((s) => s.key === 'scheduled')).toBe(false);
  });

  it('discounts a story tagged to many companies, so one sector piece is not critical for each', () => {
    const focused = rateImportance(news({ category: 'earnings', official: true }));
    const broad = rateImportance(
      news({ category: 'earnings', official: true, symbols: ['1', '2', '3', '4', '5', '6'] }),
    );
    expect(broad.score).toBe((focused.score as number) - 1);
    expect(broad.level).toBe('important');
  });

  it('shows its working: every point is attributed to a named signal', () => {
    const r = rateImportance(news({ category: 'earnings', official: true }), {
      scheduledDates: ['2026-08-30T00:00:00.000Z'],
    });
    const summed = r.signals.reduce((s, x) => s + x.points, 0);
    expect(summed).toBe(r.score);
    expect(r.signals.every((s) => s.labelKey.length > 0)).toBe(true);
    expect(r.formula).toContain('critical');
  });
});

/* =========================== relevance vs importance =================== */

describe('relevance is separate from importance', () => {
  const held = new Set(['2222']);
  const followed = new Set(['1120']);

  it('marks a story about a holding as held', () => {
    expect(relevanceFor(news({ symbols: ['2222'] }), held, followed)).toBe('held');
  });

  it('marks a followed company as followed, and anything else as none', () => {
    expect(relevanceFor(news({ symbols: ['1120'] }), held, followed)).toBe('followed');
    expect(relevanceFor(news({ symbols: ['7010'] }), held, followed)).toBe('none');
  });

  it('does not let ownership change how material the event is', () => {
    const item = news({ category: 'rating', official: false, symbols: ['2222'] });
    const rated = rateImportance(item);
    // Owning the share makes it relevant to you; it does not make a rating
    // note into a critical event.
    expect(relevanceFor(item, held, followed)).toBe('held');
    expect(rated.level).toBe('routine');
  });
});

describe('sortRanked', () => {
  const rate = (over: Partial<NewsItem>) => {
    const item = news(over);
    return { item, importance: rateImportance(item) };
  };

  it('puts your holdings first, then importance, then recency', () => {
    const rows: RankedNews[] = [
      { ...rate({ id: 'far-critical', category: 'earnings', official: true }), relevance: 'none' },
      { ...rate({ id: 'held-routine', category: 'rating' }), relevance: 'held' },
      { ...rate({ id: 'followed-critical', category: 'earnings', official: true }), relevance: 'followed' },
    ];
    const out = sortRanked(rows).map((r) => r.item.id);
    expect(out).toEqual(['held-routine', 'followed-critical', 'far-critical']);
  });

  it('breaks an importance tie on recency, newest first', () => {
    const rows: RankedNews[] = [
      {
        ...rate({ id: 'older', category: 'dividend', publishedAt: '2026-08-29T09:00:00.000Z' }),
        relevance: 'none',
      },
      {
        ...rate({ id: 'newer', category: 'dividend', publishedAt: '2026-08-30T09:00:00.000Z' }),
        relevance: 'none',
      },
    ];
    expect(sortRanked(rows).map((r) => r.item.id)).toEqual(['newer', 'older']);
  });
});

/* ============================== thresholds ============================= */

describe('meetsLevel', () => {
  it('lets through anything at or above the threshold', () => {
    expect(meetsLevel('critical', 'important')).toBe(true);
    expect(meetsLevel('important', 'important')).toBe(true);
    expect(meetsLevel('routine', 'important')).toBe(false);
    expect(meetsLevel('routine', 'routine')).toBe(true);
  });

  it('never notifies on an unrated story', () => {
    // An unknown level must not slip past a rule, in either direction: the
    // user asked for important news, not for everything we could not classify.
    for (const min of ['critical', 'important', 'routine'] as NewsImportance[]) {
      expect(meetsLevel(null, min)).toBe(false);
    }
  });
});

/* ========================== following resolution ======================= */

function state(over: Partial<NewsState> = {}): NewsState {
  return {
    followed: [],
    muted: [],
    includePortfolio: true,
    includeWatchlists: true,
    rules: {},
    defaultRule: 'important',
    notifications: [],
    lastCheckedAt: null,
    ...over,
  };
}

describe('resolveFollowed', () => {
  it('unions explicit follows with holdings and watchlists', () => {
    const out = resolveFollowed(state({ followed: ['7010'] }), ['2222'], ['1120']);
    expect([...out].sort()).toEqual(['1120', '2222', '7010']);
  });

  it('lets a mute silence a company you hold, without selling it', () => {
    const out = resolveFollowed(state({ muted: ['2222'] }), ['2222'], []);
    expect(out.has('2222')).toBe(false);
  });

  it('honours the source switches', () => {
    const out = resolveFollowed(
      state({ includePortfolio: false, includeWatchlists: false, followed: ['7010'] }),
      ['2222'],
      ['1120'],
    );
    expect([...out]).toEqual(['7010']);
  });

  it('applies a mute last, so it overrides an explicit follow too', () => {
    const out = resolveFollowed(state({ followed: ['2222'], muted: ['2222'] }), [], []);
    expect(out.size).toBe(0);
  });
});

describe('ruleFor', () => {
  it('falls back to the default when a company has no rule', () => {
    expect(ruleFor(state({ defaultRule: 'critical' }), '2222')).toBe('critical');
  });

  it('prefers a per-company rule', () => {
    expect(ruleFor(state({ defaultRule: 'critical', rules: { '2222': 'all' } }), '2222')).toBe('all');
  });
});

/* ============================ notifications ============================ */

describe('pushNotifications', () => {
  const candidate = (over: Partial<Parameters<typeof pushNotifications>[0][number]> = {}) => ({
    newsId: 'n1',
    symbol: '2222',
    market: 'SA' as const,
    headlineAr: 'عنوان',
    headlineEn: 'Headline',
    importance: 'critical' as NewsImportance,
    publishedAt: '2026-08-30T09:00:00.000Z',
    ...over,
  });

  it('raises one notification per new story', () => {
    expect(pushNotifications([candidate()])).toBe(1);
  });

  it('never raises the same story for the same company twice', () => {
    expect(pushNotifications([candidate()])).toBe(0);
    expect(pushNotifications([candidate(), candidate()])).toBe(0);
  });

  it('raises one filing naming two followed companies as two notifications', () => {
    const added = pushNotifications([
      candidate({ newsId: 'n2', symbol: '2222' }),
      candidate({ newsId: 'n2', symbol: '1120' }),
    ]);
    expect(added).toBe(2);
  });

  it('counts unread', () => {
    const s = state({
      notifications: [
        { id: 'a', newsId: 'x', symbol: '2222', market: 'SA', headlineAr: '', headlineEn: '', importance: 'critical', publishedAt: '', createdAt: '', read: false },
        { id: 'b', newsId: 'y', symbol: '2222', market: 'SA', headlineAr: '', headlineEn: '', importance: 'routine', publishedAt: '', createdAt: '', read: true },
      ],
    });
    expect(unreadCount(s)).toBe(1);
  });
});
