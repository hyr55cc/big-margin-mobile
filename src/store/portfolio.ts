import { createStore, uid } from './createStore';
import type { Currency, Portfolio, Transaction, TxKind } from '@/types';

export interface PortfolioState {
  portfolios: Portfolio[];
  activeId: string;
  transactions: Transaction[];
}

const DEFAULT_ID = 'pf_default';

export const usePortfolio = createStore<PortfolioState>(
  {
    portfolios: [
      {
        id: DEFAULT_ID,
        name: 'BIG MARGIN',
        baseCurrency: 'SAR',
        createdAt: new Date().toISOString(),
      },
    ],
    activeId: DEFAULT_ID,
    transactions: [],
  },
  { key: 'portfolio', version: 1 },
);

export function addTransaction(tx: Omit<Transaction, 'id'>): Transaction {
  const created: Transaction = { ...tx, id: uid('tx') };
  usePortfolio.set((s) => ({ transactions: [...s.transactions, created] }));
  return created;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  usePortfolio.set((s) => ({
    transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

export function removeTransaction(id: string): void {
  usePortfolio.set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
}

export function createPortfolio(name: string, baseCurrency: Currency = 'SAR'): string {
  const id = uid('pf');
  usePortfolio.set((s) => ({
    portfolios: [...s.portfolios, { id, name, baseCurrency, createdAt: new Date().toISOString() }],
    activeId: id,
  }));
  return id;
}

export function blankTransaction(
  portfolioId: string,
  kind: TxKind = 'buy',
  currency: Currency = 'SAR',
): Omit<Transaction, 'id'> {
  return {
    portfolioId,
    kind,
    symbol: null,
    market: null,
    date: new Date().toISOString().slice(0, 10),
    quantity: null,
    price: null,
    commission: 0,
    fees: 0,
    otherCosts: 0,
    currency,
    note: '',
  };
}
