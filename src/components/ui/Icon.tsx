/* BIG MARGIN — inline icon set (stroke-based, 24×24 grid, currentColor) */

export type IconName =
  | 'dashboard'
  | 'candles'
  | 'globe'
  | 'scale'
  | 'zap'
  | 'crescent'
  | 'filter'
  | 'trophy'
  | 'coins'
  | 'calendar'
  | 'briefcase'
  | 'compare'
  | 'grid'
  | 'wallet'
  | 'eye'
  | 'bell'
  | 'calculator'
  | 'news'
  | 'settings'
  | 'user'
  | 'search'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'download'
  | 'refresh'
  | 'sun'
  | 'moon'
  | 'languages'
  | 'tv'
  | 'menu'
  | 'info'
  | 'warning'
  | 'check'
  | 'external'
  | 'star'
  | 'layers'
  | 'pie'
  | 'activity'
  | 'home'
  | 'more'
  | 'database'
  | 'shield'
  | 'target'
  | 'sliders'
  | 'copy'
  | 'arrowUp'
  | 'arrowDown'
  | 'inbox'
  | 'play'
  | 'pause'
  | 'expand';

const P: Record<IconName, string> = {
  dashboard: 'M3 3h7v8H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 15h7v6H3z',
  candles: 'M6 4v3m0 10v3M6 7h0a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1zM13 2v4m0 12v4M13 6h0a1 1 0 011 1v9a1 1 0 01-1 1h0a1 1 0 01-1-1V7a1 1 0 011-1zM20 8v2m0 8v2M20 10h0a1 1 0 011 1v6a1 1 0 01-1 1h0a1 1 0 01-1-1v-6a1 1 0 011-1z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 000 18M12 3a14 14 0 010 18',
  scale: 'M12 3v18M7 21h10M6 7l-3 7h6zM18 7l-3 7h6zM3 7h18',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  crescent: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 100 17 8.5 8.5 0 0010.5-6.5z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  trophy: 'M7 4h10v5a5 5 0 01-10 0zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3M9 20h6M12 14v6',
  coins: 'M8 13a5 3 0 100-6 5 3 0 000 6zM3 10v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4M11 16.5c.8.9 2.7 1.5 5 1.5 2.8 0 5-1.3 5-3v-4M16 12c-1 0-2-.1-2.8-.4M21 11c0-1.7-2.2-3-5-3-1 0-2 .1-2.8.4',
  calendar: 'M3 6a2 2 0 012-2h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M8 2v4M16 2v4',
  briefcase: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18',
  compare: 'M7 21V7M7 7L4 10M7 7l3 3M17 3v14M17 17l3-3M17 17l-3-3',
  grid: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  wallet: 'M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM16 11h5v4h-5a2 2 0 010-4z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  calculator: 'M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM7 7h10M7 11h2M11 11h2M15 11h2M7 15h2M11 15h2M15 15h2v4',
  news: 'M4 4h13a1 1 0 011 1v14a2 2 0 002 2H5a2 2 0 01-2-2V5a1 1 0 011-1zM8 8h6M8 12h6M8 16h4M18 9h3v10a2 2 0 01-2 2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 008 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1A1.6 1.6 0 004.6 8a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  refresh: 'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  languages: 'M2 5h10M7 3v2c0 4-2.2 7.5-5 9M4 12c1.6 1.9 4 3.3 6 4M13 20l5-11 5 11M15.5 16h6',
  tv: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM7 2l5 4 5-4',
  menu: 'M3 6h18M3 12h18M3 18h18',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-5M12 8h.01',
  warning: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  check: 'M20 6L9 17l-5-5',
  external: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z',
  layers: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  pie: 'M21.2 15.9A10 10 0 118.1 2.8M22 12A10 10 0 0012 2v10z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  home: 'M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  more: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
  database: 'M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3zM3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  copy: 'M9 9a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-9a2 2 0 01-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
}

export function Icon({
  name,
  size,
  className,
  strokeWidth = 1.7,
  fill = false,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(size ? { width: size, height: size } : {})}
      aria-hidden="true"
      focusable="false"
    >
      <path d={P[name]} />
    </svg>
  );
}

/** The BIG MARGIN mark: a rising margin line closing on a terminal point. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 17.5L9 11l4 2.6L20 5"
        stroke="#04120d"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="5" r="2.2" fill="#04120d" />
    </svg>
  );
}
