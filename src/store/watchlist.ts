import { createStore, uid } from './createStore';
import type { Alert, AlertKind, MarketId, Watchlist } from '@/types';

/* ------------------------------ Watchlists ---------------------------- */

export interface WatchlistState {
  lists: Watchlist[];
  activeId: string;
}

const DEFAULT_ID = 'wl_default';

export const useWatchlists = createStore<WatchlistState>(
  {
    lists: [
      { id: DEFAULT_ID, name: 'Watchlist', entries: [], createdAt: new Date().toISOString() },
    ],
    activeId: DEFAULT_ID,
  },
  { key: 'watchlists', version: 1 },
);

export function createList(name: string): string {
  const id = uid('wl');
  useWatchlists.set((s) => ({
    lists: [...s.lists, { id, name, entries: [], createdAt: new Date().toISOString() }],
    activeId: id,
  }));
  return id;
}

export function renameList(id: string, name: string): void {
  useWatchlists.set((s) => ({
    lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)),
  }));
}

export function deleteList(id: string): void {
  useWatchlists.set((s) => {
    const lists = s.lists.filter((l) => l.id !== id);
    const safe = lists.length
      ? lists
      : [{ id: DEFAULT_ID, name: 'Watchlist', entries: [], createdAt: new Date().toISOString() }];
    return { lists: safe, activeId: safe[0].id };
  });
}

export function toggleWatch(listId: string, symbol: string, market: MarketId): void {
  useWatchlists.set((s) => ({
    lists: s.lists.map((l) => {
      if (l.id !== listId) return l;
      const has = l.entries.some((e) => e.symbol === symbol);
      return {
        ...l,
        entries: has
          ? l.entries.filter((e) => e.symbol !== symbol)
          : [...l.entries, { symbol, market, addedAt: new Date().toISOString() }],
      };
    }),
  }));
}

export function isWatched(symbol: string): boolean {
  return useWatchlists
    .get()
    .lists.some((l) => l.entries.some((e) => e.symbol === symbol));
}

export function reorderList(listId: string, from: number, to: number): void {
  useWatchlists.set((s) => ({
    lists: s.lists.map((l) => {
      if (l.id !== listId) return l;
      const entries = [...l.entries];
      const [moved] = entries.splice(from, 1);
      entries.splice(to, 0, moved);
      return { ...l, entries };
    }),
  }));
}

/* -------------------------------- Alerts ------------------------------ */

export interface AlertState {
  alerts: Alert[];
}

export const useAlerts = createStore<AlertState>(
  { alerts: [] },
  { key: 'alerts', version: 1 },
);

export function createAlert(input: {
  symbol: string;
  market: MarketId;
  kind: AlertKind;
  threshold: number | null;
  note?: string;
}): Alert {
  const alert: Alert = {
    id: uid('al'),
    symbol: input.symbol,
    market: input.market,
    kind: input.kind,
    threshold: input.threshold,
    note: input.note ?? '',
    active: true,
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
  };
  useAlerts.set((s) => ({ alerts: [alert, ...s.alerts] }));
  return alert;
}

export function updateAlert(id: string, patch: Partial<Alert>): void {
  useAlerts.set((s) => ({
    alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }));
}

export function deleteAlert(id: string): void {
  useAlerts.set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
}

/** Alert kinds that need no numeric threshold. */
export const THRESHOLDLESS: AlertKind[] = [
  'shariah_change',
  'dividend_announced',
  'corporate_action',
  'earnings_upcoming',
];

/**
 * Evaluates a rule against the data on hand. Returns null when the inputs
 * needed are unavailable, so an alert never fires on missing data.
 */
export function evaluateAlert(
  alert: Alert,
  facts: {
    price: number | null;
    changePct: number | null;
    volume: number | null;
  },
): boolean | null {
  const { price, changePct, volume } = facts;
  switch (alert.kind) {
    case 'price_above':
      return price == null || alert.threshold == null ? null : price > alert.threshold;
    case 'price_below':
      return price == null || alert.threshold == null ? null : price < alert.threshold;
    case 'pct_move':
      return changePct == null || alert.threshold == null
        ? null
        : Math.abs(changePct) >= Math.abs(alert.threshold);
    case 'volume_above':
      return volume == null || alert.threshold == null ? null : volume > alert.threshold;
    default:
      // Event-driven rules are evaluated server-side against the event feeds.
      return null;
  }
}
