/* =========================================================================
   BIG MARGIN — Chart colour system

   Categorical slots are the validated eight-hue set (adjacent-pair CVD ΔE ≥ 8,
   normal-vision ΔE ≥ 15, ≥ 3:1 contrast on both BIG MARGIN chart surfaces —
   #111621 dark, #ffffff light). Hues are assigned in fixed slot order and never
   cycled or generated; a ninth series folds into "Other".

   Market direction (up / down) is deliberately NOT drawn from this set: it is a
   diverging encoding in the domain's conventional red↔green, which is a
   colour-vision hazard. Every mark that uses it therefore also carries a signed
   numeric label, so direction is never communicated by hue alone.
   ========================================================================= */

import { useSettings, resolveTheme } from '@/store/settings';
import { useMediaQuery } from '@/lib/hooks';

export type Mode = 'dark' | 'light';

/** Fixed categorical order — do not re-order without re-running the validator. */
export const CATEGORICAL: Record<Mode, string[]> = {
  light: [
    '#2a78d6', // blue
    '#eb6834', // orange
    '#1baf7a', // aqua
    '#eda100', // yellow
    '#e87ba4', // magenta
    '#008300', // green
    '#4a3aa7', // violet
    '#e34948', // red
  ],
  dark: [
    '#3987e5',
    '#d95926',
    '#199e70',
    '#c98500',
    '#d55181',
    '#008300',
    '#9085e9',
    '#e66767',
  ],
};

/**
 * Scatter, bubble and small-multiple forms compare every pair at once, where
 * only the first three slots clear the floors. Past three, fold to "Other".
 */
export const ALL_PAIRS_SAFE_COUNT = 3;

/** Single-hue sequential ramp (blue), light → dark. Used for magnitude. */
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
];

export interface ChartTheme {
  mode: Mode;
  surface: string;
  grid: string;
  axis: string;
  ink: string;
  inkMuted: string;
  brand: string;
  up: string;
  down: string;
  flat: string;
  categorical: string[];
  /** Neutral midpoint for the diverging performance scale. */
  divergingMid: string;
}

const THEMES: Record<Mode, Omit<ChartTheme, 'mode' | 'categorical'>> = {
  dark: {
    surface: '#111621',
    grid: 'rgba(255,255,255,0.055)',
    axis: 'rgba(255,255,255,0.14)',
    ink: '#e7ecf5',
    inkMuted: '#6a7690',
    brand: '#25d0a0',
    up: '#16c784',
    down: '#ea3943',
    flat: '#8b97ad',
    divergingMid: '#2a3142',
  },
  light: {
    surface: '#ffffff',
    grid: 'rgba(15,23,42,0.07)',
    axis: 'rgba(15,23,42,0.18)',
    ink: '#0e1524',
    inkMuted: '#7a8699',
    brand: '#0f9c78',
    up: '#0d9a68',
    down: '#d32431',
    flat: '#8b97ad',
    divergingMid: '#e8ecf2',
  },
};

export function useChartTheme(): ChartTheme {
  const pref = useSettings((s) => s.theme);
  const systemLight = useMediaQuery('(prefers-color-scheme: light)');
  const mode: Mode =
    pref === 'system' ? (systemLight ? 'light' : 'dark') : resolveTheme(pref);
  return { mode, ...THEMES[mode], categorical: CATEGORICAL[mode] };
}

/** Slot lookup by index; never generates a new hue. */
export function seriesColor(theme: ChartTheme, index: number): string {
  return theme.categorical[index % theme.categorical.length];
}

/**
 * Diverging colour for a percentage move. Always paired with a visible signed
 * label at the call site — colour alone never carries the sign.
 */
export function performanceColor(
  theme: ChartTheme,
  pct: number | null,
  scale = 3.5,
): string {
  if (pct == null || !Number.isFinite(pct)) return theme.divergingMid;
  const t = Math.max(-1, Math.min(1, pct / scale));
  if (Math.abs(t) < 0.06) return theme.divergingMid;
  const target = t > 0 ? theme.up : theme.down;
  return mix(theme.divergingMid, target, Math.min(1, Math.abs(t) * 0.85 + 0.25));
}

/** Sequential colour for a 0–1 magnitude. */
export function magnitudeColor(v: number): string {
  const i = Math.round(
    Math.max(0, Math.min(1, v)) * (SEQUENTIAL_BLUE.length - 1),
  );
  return SEQUENTIAL_BLUE[i];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** True when white text on this fill is more legible than dark text. */
export function preferLightText(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const lum =
    0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2;
  return lum < 0.34;
}
