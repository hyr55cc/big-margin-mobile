import { createStore, uid } from './createStore';
import type { OptionAlert, OptionAlertKind, WatchedContract } from '@/types/options';

/* =========================================================================
   BIG MARGIN — Options watchlist and alerts
   Kept apart from the equity watchlist: a contract expires, an equity does
   not, so the two lists need different housekeeping.
   ========================================================================= */

export interface OptionsState {
  watched: WatchedContract[];
  alerts: OptionAlert[];
}

export const useOptionsStore = createStore<OptionsState>(
  { watched: [], alerts: [] },
  { key: 'options', version: 1 },
);

export function toggleWatchContract(entry: Omit<WatchedContract, 'addedAt'>): void {
  useOptionsStore.set((s) => {
    const exists = s.watched.some((w) => w.contractSymbol === entry.contractSymbol);
    return {
      watched: exists
        ? s.watched.filter((w) => w.contractSymbol !== entry.contractSymbol)
        : [...s.watched, { ...entry, addedAt: new Date().toISOString() }],
    };
  });
}

export function isContractWatched(contractSymbol: string): boolean {
  return useOptionsStore.get().watched.some((w) => w.contractSymbol === contractSymbol);
}

/** Contracts whose expiry has passed — surfaced so the list can be tidied. */
export function expiredContracts(today = new Date().toISOString().slice(0, 10)): WatchedContract[] {
  return useOptionsStore.get().watched.filter((w) => w.expiry < today);
}

export function removeExpiredContracts(today = new Date().toISOString().slice(0, 10)): void {
  useOptionsStore.set((s) => ({ watched: s.watched.filter((w) => w.expiry >= today) }));
}

export function createOptionAlert(input: {
  contractSymbol: string;
  underlying: string;
  kind: OptionAlertKind;
  threshold: number | null;
  note?: string;
}): OptionAlert {
  const alert: OptionAlert = {
    id: uid('oal'),
    contractSymbol: input.contractSymbol,
    underlying: input.underlying,
    kind: input.kind,
    threshold: input.threshold,
    note: input.note ?? '',
    active: true,
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
  };
  useOptionsStore.set((s) => ({ alerts: [alert, ...s.alerts] }));
  return alert;
}

export function deleteOptionAlert(id: string): void {
  useOptionsStore.set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
}

export function updateOptionAlert(id: string, patch: Partial<OptionAlert>): void {
  useOptionsStore.set((s) => ({
    alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }));
}

/** Alert kinds that carry no numeric threshold. */
export const OPTION_THRESHOLDLESS: OptionAlertKind[] = ['expiry_approaching', 'break_even_reached'];
