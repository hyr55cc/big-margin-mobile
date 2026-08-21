/* =========================================================================
   BIG MARGIN — Decimal-safe arithmetic
   Money is handled through integer-scaled operations so that repeated
   addition of prices and fees does not accumulate binary float error.
   ========================================================================= */

/** Scale used internally for monetary maths: 8 decimal places. */
const SCALE = 8;
const FACTOR = 1e8;

function toInt(n: number): number {
  // Round-half-away-from-zero at the internal scale.
  return Math.round(n * FACTOR + (n >= 0 ? 1e-9 : -1e-9));
}

function fromInt(i: number): number {
  return i / FACTOR;
}

export function dAdd(...values: number[]): number {
  return fromInt(values.reduce((acc, v) => acc + toInt(v), 0));
}

export function dSub(a: number, b: number): number {
  return fromInt(toInt(a) - toInt(b));
}

export function dMul(a: number, b: number): number {
  // Multiply at scale then normalise once, keeping intermediate in float but
  // snapping the result to the internal scale.
  return round(a * b, SCALE);
}

export function dDiv(a: number, b: number): number | null {
  if (!isFiniteNumber(b) || b === 0) return null;
  return round(a / b, SCALE);
}

/** Round-half-away-from-zero to `dp` decimal places, immune to 1.005 errors. */
export function round(value: number, dp = 2): number {
  if (!isFiniteNumber(value)) return NaN;
  const f = Math.pow(10, dp);
  const scaled = value * f;
  // Nudge by an epsilon proportional to magnitude to defeat 2.675*100 = 267.49999
  const eps = Math.abs(scaled) * Number.EPSILON * 8 + Number.EPSILON;
  const nudged = scaled >= 0 ? scaled + eps : scaled - eps;
  return Math.round(nudged) / f;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Sum that ignores nulls/NaN; returns null when nothing summable is present. */
export function sumOrNull(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(isFiniteNumber);
  if (valid.length === 0) return null;
  return dAdd(...valid);
}

/** Safe percentage: (part / whole) * 100. */
export function pct(part: number | null, whole: number | null): number | null {
  if (!isFiniteNumber(part) || !isFiniteNumber(whole) || whole === 0) return null;
  return round((part / whole) * 100, 6);
}

/** Percentage change from a to b. */
export function pctChange(from: number | null, to: number | null): number | null {
  if (!isFiniteNumber(from) || !isFiniteNumber(to) || from === 0) return null;
  return round(((to - from) / Math.abs(from)) * 100, 6);
}

/** Clamp helper. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Parse a user-entered numeric string, tolerating Arabic-Indic digits. */
export function parseNum(input: string): number | null {
  if (input == null) return null;
  const normalised = String(input)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, '.')
    .replace(/[٬,\s_]/g, '')
    .trim();
  if (normalised === '' || normalised === '-' || normalised === '.') return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}
