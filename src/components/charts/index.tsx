/* =========================================================================
   BIG MARGIN — Chart primitives (dependency-free SVG)

   Shared conventions, applied to every mark:
   • 2px strokes, ≥8px hover markers, 4px rounded data-ends on bars anchored to
     the baseline, a 2px surface gap between adjacent bars and segments.
   • Recessive grid and axes; axis labels in muted ink, never in a series colour.
   • Crosshair + tooltip on line/area, per-mark tooltip on bar/cell/segment.
   • A legend whenever two or more series are drawn; direct labels when ≤ 4.
   • Missing values are gaps in the line, never zeros.
   ========================================================================= */

import { useMemo, useState, type ReactNode } from 'react';
import { useElementWidth } from '@/lib/hooks';
import {
  preferLightText,
  seriesColor,
  useChartTheme,
  type ChartTheme,
} from './palette';

export * from './palette';

/* ------------------------------ helpers ------------------------------- */

export interface Point {
  t: string;
  v: number | null;
}

export interface Series {
  key: string;
  name: string;
  points: Point[];
  color?: string;
  dashed?: boolean;
}

function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - Math.abs(min || 1) * 0.05, max + Math.abs(max || 1) * 0.05];
  return [min, max];
}

/** Axis ticks on 1/2/5×10ⁿ steps. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function path(points: Array<[number, number] | null>): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    pen = true;
  }
  return d;
}

/* ------------------------------ Tooltip ------------------------------- */

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

function ChartTip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.6;
  return (
    <div
      className="chart-tip"
      style={{
        left: flip ? undefined : tip.x + 12,
        right: flip ? width - tip.x + 12 : undefined,
        top: Math.max(0, tip.y - 10),
      }}
    >
      {tip.content}
    </div>
  );
}

/* ----------------------------- Line chart ----------------------------- */

export function LineChart({
  series,
  height = 240,
  area = true,
  formatValue = (v) => v.toFixed(2),
  formatLabel = (t) => t,
  yTicks = 4,
  showLegend,
  baseline,
}: {
  series: Series[];
  height?: number;
  area?: boolean;
  formatValue?: (v: number) => string;
  formatLabel?: (t: string) => string;
  yTicks?: number;
  showLegend?: boolean;
  /** Draw a reference line, e.g. the previous close. */
  baseline?: { value: number; label?: string };
}) {
  const theme = useChartTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const w = Math.max(width, 260);
  const innerW = Math.max(10, w - padL - padR);
  const innerH = Math.max(10, height - padT - padB);

  const len = Math.max(...series.map((s) => s.points.length), 0);
  const allValues = series.flatMap((s) =>
    s.points.map((p) => p.v).filter((v): v is number => v != null),
  );
  if (baseline) allValues.push(baseline.value);
  const [min, max] = extent(allValues);
  const ticks = niceTicks(min, max, yTicks);
  const lo = Math.min(min, ticks[0] ?? min);
  const hi = Math.max(max, ticks[ticks.length - 1] ?? max);

  const x = (i: number) => padL + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  const colored = series.map((s, i) => ({
    ...s,
    color: s.color ?? (series.length === 1 ? theme.brand : seriesColor(theme, i)),
  }));

  const labels = series[0]?.points.map((p) => p.t) ?? [];
  const xTickIdx = useMemo(() => {
    const n = Math.min(5, Math.max(2, Math.floor(innerW / 110)));
    if (len <= 1) return [0];
    return Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * (len - 1)));
  }, [len, innerW]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - padL) / innerW) * (len - 1));
    if (i < 0 || i >= len || !Number.isFinite(i)) {
      setTip(null);
      setCursor(null);
      return;
    }
    setCursor(i);
    setTip({
      x: x(i),
      y: 8,
      content: (
        <div className="stack" style={{ gap: 3 }}>
          <div className="t-xs muted-3">{formatLabel(labels[i] ?? '')}</div>
          {colored.map((s) => {
            const v = s.points[i]?.v;
            return (
              <div key={s.key} className="row row-2" style={{ gap: 7 }}>
                <span
                  className="sw"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    background: s.color,
                    display: 'inline-block',
                  }}
                />
                <span className="t-xs muted">{s.name}</span>
                <span className="num t-sm" style={{ marginInlineStart: 'auto' }}>
                  {v == null ? '—' : formatValue(v)}
                </span>
              </div>
            );
          })}
        </div>
      ),
    });
  };

  return (
    <div className="chart-holder" ref={ref}>
      {(showLegend ?? series.length > 1) && (
        <div className="legend" style={{ marginBottom: 'var(--s-2)' }}>
          {colored.map((s) => (
            <span className="k" key={s.key}>
              <i className="sw" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg
        className="chart-svg"
        viewBox={`0 0 ${w} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setTip(null);
          setCursor(null);
        }}
        role="img"
      >
        <g className="chart-grid">
          {ticks.map((tv) => (
            <line key={tv} x1={padL} x2={w - padR} y1={y(tv)} y2={y(tv)} stroke={theme.grid} />
          ))}
        </g>

        <g className="chart-axis">
          {ticks.map((tv) => (
            <text
              key={tv}
              x={padL - 8}
              y={y(tv) + 3}
              textAnchor="end"
              fill={theme.inkMuted}
              fontSize={10}
            >
              {formatValue(tv)}
            </text>
          ))}
          {xTickIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === len - 1 ? 'end' : 'middle'}
              fill={theme.inkMuted}
              fontSize={10}
            >
              {formatLabel(labels[i] ?? '')}
            </text>
          ))}
        </g>

        {baseline && (
          <line
            x1={padL}
            x2={w - padR}
            y1={y(baseline.value)}
            y2={y(baseline.value)}
            stroke={theme.inkMuted}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {colored.map((s, si) => {
          const pts = s.points.map((p, i): [number, number] | null =>
            p.v == null ? null : [x(i), y(p.v)],
          );
          const d = path(pts);
          const first = pts.find(Boolean) as [number, number] | undefined;
          const last = [...pts].reverse().find(Boolean) as [number, number] | undefined;
          return (
            <g key={s.key}>
              {area && si === 0 && first && last && (
                <>
                  <defs>
                    <linearGradient id={`bm-area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${d}L${last[0]} ${padT + innerH}L${first[0]} ${padT + innerH}Z`}
                    fill={`url(#bm-area-${s.key})`}
                  />
                </>
              )}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '5 4' : undefined}
              />
            </g>
          );
        })}

        {cursor != null && (
          <g>
            <line
              x1={x(cursor)}
              x2={x(cursor)}
              y1={padT}
              y2={padT + innerH}
              stroke={theme.axis}
              strokeWidth={1}
            />
            {colored.map((s) => {
              const v = s.points[cursor]?.v;
              if (v == null) return null;
              return (
                <circle
                  key={s.key}
                  cx={x(cursor)}
                  cy={y(v)}
                  r={4.5}
                  fill={s.color}
                  stroke={theme.surface}
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}
      </svg>
      <ChartTip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------ Sparkline ----------------------------- */

export function Sparkline({
  values,
  width = 74,
  height = 22,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const theme = useChartTheme();
  if (values.length < 2) return <span className="unavailable">—</span>;
  const [min, max] = extent(values);
  const stroke =
    color ??
    (values[values.length - 1] >= values[0] ? theme.up : theme.down);
  const d = path(
    values.map((v, i): [number, number] => [
      (i / (values.length - 1)) * (width - 2) + 1,
      height - 2 - ((v - min) / (max - min || 1)) * (height - 4),
    ]),
  );
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------ Bar chart ----------------------------- */

export interface BarItem {
  key: string;
  label: string;
  value: number | null;
  color?: string;
  sub?: string;
}

export function BarChart({
  items,
  height,
  formatValue = (v) => v.toFixed(2),
  onSelect,
  signed,
  barHeight = 22,
}: {
  items: BarItem[];
  height?: number;
  formatValue?: (v: number) => string;
  onSelect?: (key: string) => void;
  /** Centre the axis at zero so negatives extend the other way. */
  signed?: boolean;
  barHeight?: number;
}) {
  const theme = useChartTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);

  const w = Math.max(width, 260);
  const labelW = Math.min(150, Math.max(84, w * 0.24));
  const valueW = 74;
  const gap = 6;
  const trackW = Math.max(20, w - labelW - valueW - 16);
  const rowH = barHeight + gap;
  const h = height ?? items.length * rowH + 6;

  const values = items.map((i) => i.value ?? 0);
  const maxAbs = Math.max(...values.map(Math.abs), 1e-9);
  const zeroX = signed ? labelW + trackW / 2 : labelW;
  const scale = (v: number) => (Math.abs(v) / maxAbs) * (signed ? trackW / 2 : trackW);

  return (
    <div className="chart-holder" ref={ref}>
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img">
        {signed && (
          <line x1={zeroX} x2={zeroX} y1={0} y2={h} stroke={theme.axis} strokeWidth={1} />
        )}
        {items.map((it, i) => {
          const yTop = i * rowH + 3;
          const v = it.value;
          const color =
            it.color ??
            (signed
              ? v == null || v === 0
                ? theme.flat
                : v > 0
                  ? theme.up
                  : theme.down
              : theme.brand);
          const len = v == null ? 0 : scale(v);
          const negative = signed && (v ?? 0) < 0;
          const barX = negative ? zeroX - len : zeroX;
          return (
            <g
              key={it.key}
              style={{ cursor: onSelect ? 'pointer' : undefined }}
              onClick={onSelect ? () => onSelect(it.key) : undefined}
              onMouseEnter={(e) =>
                setTip({
                  x: (e.nativeEvent.offsetX / (e.currentTarget.ownerSVGElement?.clientWidth || w)) * w,
                  y: yTop,
                  content: (
                    <span>
                      <strong>{it.label}</strong>
                      {'  '}
                      <span className="num">{v == null ? '—' : formatValue(v)}</span>
                      {it.sub && <span className="t-xs muted-3"> · {it.sub}</span>}
                    </span>
                  ),
                })
              }
              onMouseLeave={() => setTip(null)}
            >
              <text
                x={labelW - 10}
                y={yTop + barHeight / 2 + 4}
                textAnchor="end"
                fill={theme.ink}
                fontSize={11}
              >
                {it.label.length > 18 ? it.label.slice(0, 17) + '…' : it.label}
              </text>
              <rect
                x={labelW}
                y={yTop}
                width={trackW}
                height={barHeight}
                rx={4}
                fill={theme.grid}
              />
              {v != null && (
                <rect
                  x={barX}
                  y={yTop}
                  width={Math.max(2, len)}
                  height={barHeight}
                  rx={4}
                  fill={color}
                />
              )}
              <text
                x={w - 8}
                y={yTop + barHeight / 2 + 4}
                textAnchor="end"
                fill={theme.ink}
                fontSize={11}
                fontFamily="var(--font-mono)"
              >
                {v == null ? '—' : formatValue(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------ Donut --------------------------------- */

export interface SliceItem {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  items,
  size = 200,
  thickness = 26,
  center,
  formatValue = (v) => v.toFixed(1) + '%',
  onSelect,
}: {
  items: SliceItem[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  formatValue?: (v: number) => string;
  onSelect?: (key: string) => void;
}) {
  const theme = useChartTheme();
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const r = size / 2 - thickness / 2 - 2;
  const c = size / 2;
  // 2px surface gap between adjacent segments.
  const gapAngle = total > 0 ? (2 / (2 * Math.PI * r)) * 360 : 0;

  let angle = -90;
  const arcs = items.map((it, i) => {
    const frac = total > 0 ? Math.max(0, it.value) / total : 0;
    const sweep = frac * 360;
    const a0 = angle + gapAngle / 2;
    const a1 = angle + sweep - gapAngle / 2;
    angle += sweep;
    const color = it.color ?? seriesColor(theme, i);
    if (a1 <= a0) return { ...it, d: '', color, frac };
    const rad = (a: number) => (a * Math.PI) / 180;
    const x0 = c + r * Math.cos(rad(a0));
    const y0 = c + r * Math.sin(rad(a0));
    const x1 = c + r * Math.cos(rad(a1));
    const y1 = c + r * Math.sin(rad(a1));
    const large = a1 - a0 > 180 ? 1 : 0;
    return {
      ...it,
      d: `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      color,
      frac,
    };
  });

  return (
    <div className="row row-4 row-wrap" style={{ alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle cx={c} cy={c} r={r} fill="none" stroke={theme.grid} strokeWidth={thickness} />
        {arcs.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={hover === a.key ? thickness + 4 : thickness}
            strokeLinecap="butt"
            style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'stroke-width 120ms' }}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
            onClick={onSelect ? () => onSelect(a.key) : undefined}
          />
        ))}
        {center && (
          <foreignObject x={thickness + 4} y={thickness + 4} width={size - (thickness + 4) * 2} height={size - (thickness + 4) * 2}>
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              {center}
            </div>
          </foreignObject>
        )}
      </svg>
      <div className="stack stack-2" style={{ flex: 1, minWidth: 160 }}>
        {arcs.map((a) => (
          <div
            key={a.key}
            className="row row-2"
            style={{ opacity: hover && hover !== a.key ? 0.55 : 1, cursor: onSelect ? 'pointer' : undefined }}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
            onClick={onSelect ? () => onSelect(a.key) : undefined}
          >
            <i className="sw" style={{ background: a.color, width: 9, height: 9, borderRadius: 3 }} />
            <span className="t-sm truncate" style={{ flex: 1 }}>
              {a.label}
            </span>
            <span className="num t-sm">{formatValue(a.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Treemap ------------------------------- */

export interface TreeItem {
  key: string;
  label: string;
  /** Area driver — must be positive. */
  size: number;
  /** Colour driver, e.g. percentage change. */
  color: string;
  /** Text shown under the label, always present so colour is never alone. */
  valueLabel: string;
  group?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap layout (Bruls, Huizing & van Wijk). */
function squarify(items: TreeItem[], rect: Rect): Array<TreeItem & Rect> {
  const out: Array<TreeItem & Rect> = [];
  const total = items.reduce((s, i) => s + i.size, 0);
  if (total <= 0) return out;

  const scaled = items.map((i) => ({ item: i, area: (i.size / total) * rect.w * rect.h }));
  let free: Rect = { ...rect };
  let row: typeof scaled = [];

  const worst = (r: typeof scaled, side: number) => {
    const sum = r.reduce((s, x) => s + x.area, 0);
    if (sum === 0) return Infinity;
    const maxA = Math.max(...r.map((x) => x.area));
    const minA = Math.min(...r.map((x) => x.area));
    return Math.max((side * side * maxA) / (sum * sum), (sum * sum) / (side * side * minA));
  };

  const layoutRow = (r: typeof scaled) => {
    const sum = r.reduce((s, x) => s + x.area, 0);
    const horizontal = free.w >= free.h;
    const side = horizontal ? free.h : free.w;
    const thickness = sum / side;
    let offset = 0;
    for (const x of r) {
      const length = x.area / thickness;
      out.push(
        horizontal
          ? { ...x.item, x: free.x, y: free.y + offset, w: thickness, h: length }
          : { ...x.item, x: free.x + offset, y: free.y, w: length, h: thickness },
      );
      offset += length;
    }
    free = horizontal
      ? { x: free.x + thickness, y: free.y, w: free.w - thickness, h: free.h }
      : { x: free.x, y: free.y + thickness, w: free.w, h: free.h - thickness };
  };

  for (const s of scaled) {
    const side = Math.min(free.w, free.h);
    if (row.length === 0 || worst([...row, s], side) <= worst(row, side)) {
      row.push(s);
    } else {
      layoutRow(row);
      row = [s];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}

export function Treemap({
  items,
  height = 420,
  onSelect,
  gap = 2,
}: {
  items: TreeItem[];
  height?: number;
  onSelect?: (key: string) => void;
  gap?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const w = Math.max(width, 280);
  const laid = useMemo(
    () => squarify([...items].sort((a, b) => b.size - a.size), { x: 0, y: 0, w, h: height }),
    [items, w, height],
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height }}>
      {laid.map((cell) => {
        const light = preferLightText(cell.color);
        const showLabel = cell.w > 44 && cell.h > 26;
        const showValue = cell.w > 52 && cell.h > 40;
        return (
          <div
            key={cell.key}
            className="tm-cell"
            style={{
              left: cell.x + gap / 2,
              top: cell.y + gap / 2,
              width: Math.max(0, cell.w - gap),
              height: Math.max(0, cell.h - gap),
              background: cell.color,
            }}
            title={`${cell.label} · ${cell.valueLabel}`}
            onClick={onSelect ? () => onSelect(cell.key) : undefined}
          >
            {showLabel && (
              <div
                className="tm-sym"
                style={{
                  fontSize: Math.min(17, Math.max(9, cell.w / 6)),
                  color: light ? '#fff' : '#0b0f18',
                  textShadow: light ? undefined : 'none',
                }}
              >
                {cell.label}
              </div>
            )}
            {showValue && (
              <div
                className="tm-val"
                style={{
                  fontSize: Math.min(14, Math.max(9, cell.w / 8)),
                  color: light ? 'rgba(255,255,255,0.94)' : 'rgba(11,15,24,0.82)',
                  textShadow: light ? undefined : 'none',
                }}
              >
                {cell.valueLabel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- Payoff chart ----------------------------- */

/** Profit / loss against sale price, with break-even and zone shading. */
export function PayoffChart({
  minPrice,
  maxPrice,
  profitAt,
  breakEven,
  currentPrice,
  targetPrice,
  height = 260,
  formatMoney,
  formatPrice,
}: {
  minPrice: number;
  maxPrice: number;
  profitAt: (price: number) => number;
  breakEven: number | null;
  currentPrice?: number | null;
  targetPrice?: number | null;
  height?: number;
  formatMoney: (v: number) => string;
  formatPrice: (v: number) => string;
}) {
  const theme = useChartTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);

  const padL = 64;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const w = Math.max(width, 280);
  const innerW = Math.max(10, w - padL - padR);
  const innerH = Math.max(10, height - padT - padB);

  const steps = 90;
  const prices = Array.from(
    { length: steps + 1 },
    (_, i) => minPrice + ((maxPrice - minPrice) * i) / steps,
  );
  const profits = prices.map(profitAt);
  const [pMin, pMax] = extent([...profits, 0]);
  const ticks = niceTicks(pMin, pMax, 4);

  const x = (p: number) => padL + ((p - minPrice) / (maxPrice - minPrice || 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - pMin) / (pMax - pMin || 1)) * innerH;
  const zeroY = y(0);

  const d = path(prices.map((p, i): [number, number] => [x(p), y(profits[i])]));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const price = minPrice + ((px - padL) / innerW) * (maxPrice - minPrice);
    if (price < minPrice || price > maxPrice) {
      setTip(null);
      return;
    }
    const profit = profitAt(price);
    setTip({
      x: x(price),
      y: 6,
      content: (
        <span className="stack" style={{ gap: 2 }}>
          <span className="t-xs muted-3">{formatPrice(price)}</span>
          <span className={`num ${profit >= 0 ? 'up' : 'down'}`}>{formatMoney(profit)}</span>
        </span>
      ),
    });
  };

  return (
    <div className="chart-holder" ref={ref}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${w} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        role="img"
      >
        <defs>
          <clipPath id="bm-payoff-clip">
            <rect x={padL} y={padT} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={Math.max(0, zeroY - padT)}
          fill={theme.up}
          opacity={0.07}
        />
        <rect
          x={padL}
          y={zeroY}
          width={innerW}
          height={Math.max(0, padT + innerH - zeroY)}
          fill={theme.down}
          opacity={0.07}
        />

        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={padL} x2={w - padR} y1={y(tv)} y2={y(tv)} stroke={theme.grid} />
            <text x={padL - 8} y={y(tv) + 3} textAnchor="end" fill={theme.inkMuted} fontSize={10}>
              {formatMoney(tv)}
            </text>
          </g>
        ))}

        <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke={theme.axis} strokeWidth={1} />

        <path d={d} fill="none" stroke={theme.brand} strokeWidth={2} clipPath="url(#bm-payoff-clip)" />

        {[
          breakEven != null
            ? { p: breakEven, color: theme.inkMuted, label: 'BE' }
            : null,
          currentPrice != null ? { p: currentPrice, color: theme.ink, label: '●' } : null,
          targetPrice != null ? { p: targetPrice, color: theme.up, label: '◆' } : null,
        ]
          .filter(Boolean)
          .map((m, i) => {
            const mk = m as { p: number; color: string; label: string };
            if (mk.p < minPrice || mk.p > maxPrice) return null;
            return (
              <g key={i}>
                <line
                  x1={x(mk.p)}
                  x2={x(mk.p)}
                  y1={padT}
                  y2={padT + innerH}
                  stroke={mk.color}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text x={x(mk.p)} y={padT - 2} textAnchor="middle" fill={mk.color} fontSize={10}>
                  {mk.label}
                </text>
              </g>
            );
          })}

        <text x={padL} y={height - 8} fill={theme.inkMuted} fontSize={10}>
          {formatPrice(minPrice)}
        </text>
        <text x={w - padR} y={height - 8} textAnchor="end" fill={theme.inkMuted} fontSize={10}>
          {formatPrice(maxPrice)}
        </text>
      </svg>
      <ChartTip tip={tip} width={w} />
    </div>
  );
}

/* ---------------------------- Range meter ----------------------------- */

/** 52-week position, or any low→high band with a current marker. */
export function RangeMeter({
  low,
  high,
  value,
  formatValue,
}: {
  low: number | null;
  high: number | null;
  value: number | null;
  formatValue: (v: number) => string;
}) {
  const theme = useChartTheme();
  if (low == null || high == null || value == null || high <= low) {
    return <span className="unavailable">—</span>;
  }
  const pct = Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
  return (
    <div className="stack" style={{ gap: 4, minWidth: 150, direction: 'ltr' }}>
      <div
        style={{
          position: 'relative',
          height: 5,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${theme.down}, ${theme.flat}, ${theme.up})`,
          opacity: 0.55,
        }}
      >
        <span
          style={{
            position: 'absolute',
            insetInlineStart: `calc(${pct}% - 5px)`,
            top: -3,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: theme.ink,
            border: `2px solid ${theme.surface}`,
          }}
        />
      </div>
      <div className="row row-between t-xs muted-3">
        <span className="num">{formatValue(low)}</span>
        <span className="num">{formatValue(high)}</span>
      </div>
    </div>
  );
}

export type { ChartTheme };
