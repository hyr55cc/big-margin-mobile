/* =========================================================================
   BIG MARGIN — News importance

   How much a story matters is a judgement, and judgements are exactly where a
   financial product is most tempted to invent things. So the rule here is
   narrow on purpose:

   • Importance is computed ONLY from facts the feed states — what kind of
     event it is, and whether the company published it itself. Never from the
     wording of the headline, never from sentiment, never from a price move.
   • An unclassified item is UNAVAILABLE, not routine. "We don't know how much
     this matters" and "this doesn't matter" are different answers, and only
     one of them is honest when the feed said nothing.
   • Every point is attributable: the result carries the signals that produced
     it, so the UI can show its work (§73).
   • A provider's own rating always wins. A model does not overrule a source.

   Personal relevance is deliberately NOT part of importance. Whether you own
   the share changes how much *you* care, not how material the event is — so
   relevance is computed separately and used for ordering and alerting, never
   folded into the badge.
   ========================================================================= */

import type { DataStatus, Maybe, NewsCategory, NewsImportance, NewsItem } from '@/types';

export const IMPORTANCE_FORMULA = [
  'Score = category weight + official disclosure + scheduled-event corroboration',
  'critical ≥ 5 · important ≥ 3 · routine < 3',
  'Unclassified category ⇒ unavailable (never routine)',
].join('\n');

/**
 * What each kind of event is worth.
 *
 * The ordering is not a market view; it follows how directly the event changes
 * the terms of owning the share. Results, capital structure and ownership
 * change those terms outright. A rating note is somebody's opinion about them.
 */
export const CATEGORY_WEIGHT: Record<NewsCategory, number> = {
  earnings: 3,
  capital: 3,
  mna: 3,
  corporate_action: 2,
  dividend: 2,
  regulatory: 2,
  guidance: 2,
  management: 1,
  rating: 1,
  general: 0,
};

/** Above this many tagged symbols a story is sector or market news. */
const BREADTH_LIMIT = 4;

export interface ImportanceSignal {
  key: string;
  /** i18n key naming the signal. */
  labelKey: string;
  points: number;
  /** Optional value to interpolate into the label, e.g. the category. */
  detail?: string;
}

export interface ImportanceResult {
  level: Maybe<NewsImportance>;
  score: Maybe<number>;
  signals: ImportanceSignal[];
  /** Whether the level came from the feed or from these rules. */
  origin: 'source' | 'calculated' | 'unavailable';
  formula: string;
  computedAt: string;
  status: DataStatus;
}

export interface ImportanceContext {
  /**
   * Dates of scheduled events already known to the app for this symbol —
   * earnings dates and corporate action dates. A story landing beside one it
   * corroborates is more likely to be the substantive announcement rather
   * than commentary about it.
   */
  scheduledDates?: string[];
}

const DAY = 86_400_000;
/** Window either side of a scheduled event that counts as corroboration. */
const CORROBORATION_DAYS = 3;

function withinScheduledWindow(publishedAt: string, dates: string[]): boolean {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return false;
  return dates.some((d) => {
    const at = Date.parse(d);
    return Number.isFinite(at) && Math.abs(at - published) <= CORROBORATION_DAYS * DAY;
  });
}

/** Turns a score into a level. Exported so the tests can pin the boundaries. */
export function levelForScore(score: number): NewsImportance {
  if (score >= 5) return 'critical';
  if (score >= 3) return 'important';
  return 'routine';
}

/**
 * Rates one story. Pass the scheduled dates the app already holds for the
 * symbols involved to enable the corroboration signal; omit them and the rule
 * simply does not fire.
 */
export function rateImportance(
  item: NewsItem,
  ctx: ImportanceContext = {},
): ImportanceResult {
  const computedAt = new Date().toISOString();

  // A rating from the source is a sourced fact, not a derived one, so it is
  // reported as-is and the rules are not consulted at all.
  if (item.sourceImportance != null) {
    return {
      level: item.sourceImportance,
      score: null,
      signals: [],
      origin: 'source',
      formula: IMPORTANCE_FORMULA,
      computedAt,
      // The rating is as good as the feed that carried it.
      status: item.provenance.status,
    };
  }

  // Nothing to reason from. This is the case that must not quietly become
  // "routine" — an unclassified story is one we cannot rate, not a dull one.
  if (item.category == null) {
    return {
      level: null,
      score: null,
      signals: [],
      origin: 'unavailable',
      formula: IMPORTANCE_FORMULA,
      computedAt,
      status: 'unavailable',
    };
  }

  const signals: ImportanceSignal[] = [];

  const categoryPoints = CATEGORY_WEIGHT[item.category];
  signals.push({
    key: 'category',
    labelKey: 'news.sig.category',
    points: categoryPoints,
    detail: item.category,
  });

  // A filing is the company speaking. Coverage is someone speaking about it.
  if (item.official === true) {
    signals.push({ key: 'official', labelKey: 'news.sig.official', points: 2 });
  }

  const scheduled = ctx.scheduledDates ?? [];
  if (scheduled.length > 0 && withinScheduledWindow(item.publishedAt, scheduled)) {
    signals.push({ key: 'scheduled', labelKey: 'news.sig.scheduled', points: 1 });
  }

  // Breadth cuts the other way: a story tagged to a dozen companies is a
  // sector piece, and calling it critical for each of them individually would
  // flood every follower's alerts with the same item.
  const broad = item.symbols.length > BREADTH_LIMIT;
  if (broad) {
    signals.push({ key: 'breadth', labelKey: 'news.sig.breadth', points: -1 });
  }

  const score = signals.reduce((sum, s) => sum + s.points, 0);

  return {
    level: levelForScore(score),
    score,
    signals,
    origin: 'calculated',
    formula: IMPORTANCE_FORMULA,
    computedAt,
    status: 'calculated',
  };
}

/* --------------------------- personal relevance ------------------------ */

export type Relevance = 'held' | 'followed' | 'none';

/**
 * How close a story is to this user — separate from how material it is.
 * Used to order the feed and to decide what is worth a notification.
 */
export function relevanceFor(
  item: NewsItem,
  held: ReadonlySet<string>,
  followed: ReadonlySet<string>,
): Relevance {
  if (item.symbols.some((s) => held.has(s))) return 'held';
  if (item.symbols.some((s) => followed.has(s))) return 'followed';
  return 'none';
}

const LEVEL_RANK: Record<NewsImportance, number> = {
  critical: 3,
  important: 2,
  routine: 1,
};
const RELEVANCE_RANK: Record<Relevance, number> = { held: 2, followed: 1, none: 0 };

/** True when `level` is at least as important as `minimum`. */
export function meetsLevel(
  level: Maybe<NewsImportance>,
  minimum: NewsImportance,
): boolean {
  if (level == null) return false;
  return LEVEL_RANK[level] >= LEVEL_RANK[minimum];
}

export interface RankedNews {
  item: NewsItem;
  importance: ImportanceResult;
  relevance: Relevance;
}

/**
 * Feed order: what matters to you, then what matters, then what is newest.
 *
 * Recency alone buries a results announcement under an hour of routine
 * filings, and importance alone freezes a stale story at the top of the feed;
 * ordering on all three keeps both from happening.
 */
export function sortRanked(rows: RankedNews[]): RankedNews[] {
  return [...rows].sort((a, b) => {
    const rel = RELEVANCE_RANK[b.relevance] - RELEVANCE_RANK[a.relevance];
    if (rel !== 0) return rel;
    const imp =
      (b.importance.level ? LEVEL_RANK[b.importance.level] : 0) -
      (a.importance.level ? LEVEL_RANK[a.importance.level] : 0);
    if (imp !== 0) return imp;
    return a.item.publishedAt < b.item.publishedAt ? 1 : -1;
  });
}
