/* =========================================================================
   BIG MARGIN — Presentation formatting
   Missing values are never substituted with 0 or a placeholder number.
   ========================================================================= */

import type { Currency } from '@/types';

export const DASH = '—';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicIndic(s: string): string {
  return s.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

export interface FmtOpts {
  locale?: string;
  /** Convert Western digits to Arabic-Indic. */
  arabicNumerals?: boolean;
  decimals?: number;
  minDecimals?: number;
  /** Prefix positive values with an explicit "+". */
  signed?: boolean;
}

function post(s: string, o?: FmtOpts): string {
  return o?.arabicNumerals ? toArabicIndic(s) : s;
}

function nf(locale: string, min: number, max: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'ar-SA' ? 'ar-SA-u-nu-latn' : locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

/** General number. Returns "—" for null/undefined/NaN. */
export function fmtNum(
  v: number | null | undefined,
  o: FmtOpts = {},
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const max = o.decimals ?? 2;
  const min = o.minDecimals ?? Math.min(max, 2);
  const s = nf(o.locale ?? 'en-US', min, max).format(v);
  return post(o.signed && v > 0 ? `+${s}` : s, o);
}

/** Integer with grouping (shares, volume, counts). */
export function fmtInt(v: number | null | undefined, o: FmtOpts = {}): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return post(nf(o.locale ?? 'en-US', 0, 0).format(Math.round(v)), o);
}

/** Percentage with a trailing % sign. */
export function fmtPct(
  v: number | null | undefined,
  o: FmtOpts = {},
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const dp = o.decimals ?? 2;
  const s = nf(o.locale ?? 'en-US', dp, dp).format(v);
  const withSign = o.signed && v > 0 ? `+${s}` : s;
  return post(`${withSign}%`, o);
}

const CURRENCY_SYMBOL: Record<Currency, { ar: string; en: string }> = {
  SAR: { ar: 'ر.س', en: 'SAR' },
  USD: { ar: '$', en: '$' },
};

export function currencySymbol(c: Currency, lang: 'ar' | 'en'): string {
  return CURRENCY_SYMBOL[c][lang];
}

/** Money with the instrument's own currency label. */
export function fmtMoney(
  v: number | null | undefined,
  currency: Currency,
  o: FmtOpts & { lang?: 'ar' | 'en'; symbol?: boolean } = {},
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const dp = o.decimals ?? 2;
  const s = nf(o.locale ?? 'en-US', o.minDecimals ?? dp, dp).format(v);
  const signed = o.signed && v > 0 ? `+${s}` : s;
  if (o.symbol === false) return post(signed, o);
  // Non-breaking space keeps the amount and its currency on one line.
  return post(`${signed}\u00A0${currencySymbol(currency, o.lang ?? 'en')}`, o);
}

interface CompactUnit {
  v: number;
  ar: string;
  en: string;
}

const COMPACT: CompactUnit[] = [
  { v: 1e12, ar: 'ت', en: 'T' },
  { v: 1e9, ar: 'مليار', en: 'B' },
  { v: 1e6, ar: 'مليون', en: 'M' },
  { v: 1e3, ar: 'ألف', en: 'K' },
];

/** Compact magnitude: 1.24B / 1.24 مليار. Used for caps, volume, turnover. */
export function fmtCompact(
  v: number | null | undefined,
  o: FmtOpts & { lang?: 'ar' | 'en' } = {},
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const lang = o.lang ?? 'en';
  const abs = Math.abs(v);
  const unit = COMPACT.find((u) => abs >= u.v);
  if (!unit) {
    return fmtNum(v, { ...o, decimals: o.decimals ?? 0 });
  }
  const scaled = v / unit.v;
  const dp = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  const s = nf(o.locale ?? 'en-US', dp, dp).format(scaled);
  const signed = o.signed && v > 0 ? `+${s}` : s;
  return post(`${signed}${lang === 'ar' ? ' ' + unit.ar : unit.en}`, o);
}

/** Compact money, e.g. "1.85T SAR". */
export function fmtCompactMoney(
  v: number | null | undefined,
  currency: Currency,
  o: FmtOpts & { lang?: 'ar' | 'en' } = {},
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const lang = o.lang ?? 'en';
  return `${fmtCompact(v, o)}\u00A0${currencySymbol(currency, lang)}`;
}

/* ------------------------------- Dates -------------------------------- */

export function fmtDate(
  iso: string | null | undefined,
  o: FmtOpts = {},
): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const s = new Intl.DateTimeFormat(
    o.locale === 'ar-SA' ? 'ar-SA-u-nu-latn-ca-gregory' : o.locale ?? 'en-US',
    { year: 'numeric', month: 'short', day: '2-digit' },
  ).format(d);
  return post(s, o);
}

export function fmtDateTime(
  iso: string | null | undefined,
  o: FmtOpts = {},
): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const s = new Intl.DateTimeFormat(
    o.locale === 'ar-SA' ? 'ar-SA-u-nu-latn-ca-gregory' : o.locale ?? 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  ).format(d);
  return post(s, o);
}

export function fmtTime(
  iso: string | Date | null | undefined,
  o: FmtOpts & { seconds?: boolean } = {},
): string {
  if (!iso) return DASH;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return DASH;
  const s = new Intl.DateTimeFormat(
    o.locale === 'ar-SA' ? 'ar-SA-u-nu-latn' : o.locale ?? 'en-US',
    {
      hour: '2-digit',
      minute: '2-digit',
      ...(o.seconds ? { second: '2-digit' } : {}),
      hour12: false,
    },
  ).format(d);
  return post(s, o);
}

/** "3 min ago" / "منذ ٣ دقائق" using Intl.RelativeTimeFormat. */
export function fmtRelative(
  iso: string | null | undefined,
  o: FmtOpts = {},
): string {
  if (!iso) return DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return DASH;
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(
    o.locale === 'ar-SA' ? 'ar' : o.locale ?? 'en-US',
    { numeric: 'auto' },
  );
  let s: string;
  if (abs < 60) s = rtf.format(diffSec, 'second');
  else if (abs < 3600) s = rtf.format(Math.round(diffSec / 60), 'minute');
  else if (abs < 86400) s = rtf.format(Math.round(diffSec / 3600), 'hour');
  else if (abs < 2592000) s = rtf.format(Math.round(diffSec / 86400), 'day');
  else if (abs < 31536000) s = rtf.format(Math.round(diffSec / 2592000), 'month');
  else s = rtf.format(Math.round(diffSec / 31536000), 'year');
  return post(s, o);
}

/** ISO date (YYYY-MM-DD) for <input type="date">. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / 86400000);
}

/* ------------------------------- Misc --------------------------------- */

/** CSS class for a directional value. */
export function dirClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return 'flat';
  return v > 0 ? 'up' : 'down';
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          if (cell == null) return '';
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM keeps Arabic column headers readable when opened in Excel.
  const blob = new Blob(['﻿' + csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
