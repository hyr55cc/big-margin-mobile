import { createStore } from './createStore';
import type { Currency, MarketId } from '@/types';

export type ThemePref = 'dark' | 'light' | 'system';
export type Lang = 'ar' | 'en';

export interface SettingsState {
  language: Lang;
  theme: ThemePref;
  displayCurrency: Currency;
  defaultMarket: MarketId;
  defaultRoute: string;
  arabicNumerals: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  /** Auto refresh interval in seconds; 0 disables. */
  refreshSeconds: number;
  sidebarCollapsed: boolean;
  setLanguage: (l: Lang) => void;
  setTheme: (t: ThemePref) => void;
}

export const useSettings = createStore<SettingsState>(
  {
    language: 'ar',
    theme: 'dark',
    displayCurrency: 'SAR',
    defaultMarket: 'SA',
    defaultRoute: '/app',
    arabicNumerals: false,
    notifyInApp: true,
    notifyEmail: false,
    refreshSeconds: 60,
    sidebarCollapsed: false,
    setLanguage: (l) => useSettings.set({ language: l }),
    setTheme: (t) => useSettings.set({ theme: t }),
  },
  {
    key: 'settings',
    version: 1,
    pick: [
      'language',
      'theme',
      'displayCurrency',
      'defaultMarket',
      'defaultRoute',
      'arabicNumerals',
      'notifyInApp',
      'notifyEmail',
      'refreshSeconds',
      'sidebarCollapsed',
    ],
  },
);

/** Resolve the effective theme, honouring the OS preference. */
export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}
