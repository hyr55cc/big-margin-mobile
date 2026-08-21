import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { en, type MessageKey } from './en';
import { ar } from './ar';
import type { Localized } from '@/types';
import { useSettings } from '@/store/settings';

export type Lang = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';

const DICTS = { ar, en } as const;

interface I18nValue {
  lang: Lang;
  dir: Dir;
  locale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Pick the correct side of a Localized record. */
  L: (v: Localized | null | undefined) => string;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr';
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
  }, [lang, dir]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang] ?? en;
      let out: string = dict[key] ?? en[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return out;
    },
    [lang],
  );

  const L = useCallback(
    (v: Localized | null | undefined) => {
      if (!v) return '';
      return (lang === 'ar' ? v.ar : v.en) || v.en || v.ar || '';
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, locale, t, L, setLang: setLanguage }),
    [lang, dir, locale, t, L, setLanguage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { MessageKey };
