/* =========================================================================
   BIG MARGIN — UI primitives
   ========================================================================= */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { useI18n } from '@/i18n';
import { useFmt, useDismiss, useTableState, compareValues } from '@/lib/hooks';
import { DASH, downloadCsv, toCsv } from '@/lib/format';
import type { DataStatus, Provenance, ShariahStatus } from '@/types';
import type { Band } from '@/lib/calc/indexImpact';

/* ------------------------------- Card --------------------------------- */

export function Card({
  children,
  className = '',
  style,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      className={`card ${onClick ? 'card-link clickable' : ''} ${className}`}
      style={style}
      {...(onClick ? { onClick, role: 'button', tabIndex: 0 } : {})}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  right,
  icon,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="card-head">
      <div className="row row-3" style={{ minWidth: 0 }}>
        {icon && (
          <span className="muted-3">
            <Icon name={icon} size={16} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="h-card">{title}</div>
          {sub && <div className="t-xs muted-3">{sub}</div>}
        </div>
      </div>
      {right && <div className="row row-2">{right}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="row row-between" style={{ marginBottom: 'var(--s-3)' }}>
      <h2 className="h-section">{children}</h2>
      {right}
    </div>
  );
}

/* ------------------------------ Badges -------------------------------- */

/**
 * A run like "+0.30%" is a sequence of neutral characters around digits, so in
 * an RTL paragraph the bidi algorithm moves the sign and the percent sign to
 * the wrong end. Wrapping numeric content in `.num` (direction: ltr,
 * unicode-bidi: isolate) keeps it readable in both directions.
 */
const NUMERIC_RUN = /^[\s\u00A0+\-–—0-9.,%٠-٩KMBT/×x:()]+$/;

export function isolateNumbers(children: ReactNode): ReactNode {
  if (typeof children === 'string' && /[0-9٠-٩]/.test(children) && NUMERIC_RUN.test(children)) {
    return <span className="num">{children}</span>;
  }
  return children;
}

export function Badge({
  children,
  tone = 'neutral',
  dot,
  pulse,
  title,
}: {
  children: ReactNode;
  tone?: 'up' | 'down' | 'flat' | 'brand' | 'gold' | 'violet' | 'neutral' | 'outline';
  dot?: boolean;
  pulse?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {dot && <i className={`dot ${pulse ? 'pulse' : ''}`} />}
      {isolateNumbers(children)}
    </span>
  );
}

const STATUS_TONE: Record<DataStatus, 'up' | 'gold' | 'violet' | 'neutral'> = {
  live: 'up',
  delayed: 'gold',
  calculated: 'violet',
  estimated: 'gold',
  unavailable: 'neutral',
};

/** Every figure in BIG MARGIN can show where it came from. */
export function StatusBadge({
  status,
  provenance,
  compact,
}: {
  status?: DataStatus;
  provenance?: Provenance;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const s = status ?? provenance?.status ?? 'unavailable';
  const label =
    s === 'delayed' && provenance?.delayMinutes
      ? t('status.delayedBy', { n: provenance.delayMinutes })
      : t(`status.${s}` as 'status.live');
  const title = provenance
    ? `${t('g.source')}: ${provenance.source}\n${t('g.lastUpdated')}: ${fmt.dateTime(provenance.lastUpdated)}`
    : undefined;
  return (
    <Badge tone={STATUS_TONE[s]} dot pulse={s === 'live'} title={title}>
      {compact ? null : label}
    </Badge>
  );
}

export function ShariahBadge({
  status,
  size = 'md',
}: {
  status: ShariahStatus;
  size?: 'sm' | 'md';
}) {
  const { t } = useI18n();
  const tone =
    status === 'compliant' ? 'up' : status === 'non_compliant' ? 'down' : 'neutral';
  const label =
    status === 'compliant'
      ? t('sh.compliant')
      : status === 'non_compliant'
        ? t('sh.nonCompliant')
        : t('sh.unknown');
  return (
    <span className={`badge badge-${tone}`} style={size === 'sm' ? { fontSize: 10 } : undefined}>
      <i className="dot" />
      {label}
    </span>
  );
}

export function BandBadge({ band }: { band: Band | null }) {
  const { t } = useI18n();
  if (!band) return <span className="unavailable">{DASH}</span>;
  const tone =
    band === 'veryHigh' || band === 'high'
      ? 'brand'
      : band === 'medium'
        ? 'neutral'
        : 'outline';
  return <Badge tone={tone}>{t(`band.${band}` as 'band.high')}</Badge>;
}

/** Signed change with directional colour; renders "—" when unavailable. */
export function Change({
  value,
  pct,
  decimals = 2,
  showSign = true,
  className = '',
}: {
  value: number | null | undefined;
  pct?: boolean;
  decimals?: number;
  showSign?: boolean;
  className?: string;
}) {
  const fmt = useFmt();
  if (value == null || !Number.isFinite(value)) {
    return <span className="unavailable">{DASH}</span>;
  }
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const text = pct
    ? fmt.pct(value, { decimals, signed: showSign })
    : fmt.num(value, { decimals, signed: showSign });
  return <span className={`num ${cls} ${className}`}>{text}</span>;
}

/* ------------------------------ Metric -------------------------------- */

export function Metric({
  label,
  value,
  sub,
  tone,
  size = 'md',
  tip,
  status,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'up' | 'down' | 'flat' | 'brand';
  size?: 'sm' | 'md' | 'xl';
  tip?: ReactNode;
  status?: DataStatus;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {tip && <Tip>{tip}</Tip>}
        {status && <StatusBadge status={status} compact />}
      </div>
      <div className={`metric-value ${size === 'xl' ? 'xl' : size === 'sm' ? 'sm' : ''} ${tone ?? ''}`}>
        {value}
      </div>
      {sub && <div className="metric-sub">{isolateNumbers(sub)}</div>}
    </div>
  );
}

/** Renders a value or the standard unavailable marker. */
export function V({ children }: { children: ReactNode }) {
  const empty =
    children == null ||
    children === '' ||
    children === DASH ||
    (typeof children === 'number' && !Number.isFinite(children));
  if (empty) return <span className="unavailable">{DASH}</span>;
  return <>{isolateNumbers(children)}</>;
}

/* ------------------------------ Buttons ------------------------------- */

export function Btn({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  icon,
  disabled,
  type = 'button',
  block,
  title,
  active,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  type?: 'button' | 'submit';
  block?: boolean;
  title?: string;
  active?: boolean;
}) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    active ? 'on' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconBtn({
  icon,
  onClick,
  title,
  active,
}: {
  icon: IconName;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'on' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  brand,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  brand?: boolean;
}) {
  return (
    <div className={`seg ${brand ? 'brand' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Forms -------------------------------- */

export function Field({
  label,
  hint,
  error,
  tip,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  tip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
          {tip && <Tip>{tip}</Tip>}
        </label>
      )}
      {children}
      {error ? (
        <div className="field-error">{error}</div>
      ) : hint ? (
        <div className="field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      className={`input ${invalid ? 'invalid' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * Numeric input that keeps the raw string while typing, so a partially typed
 * value like "12." is not destroyed by premature parsing.
 */
export function NumInput({
  value,
  onChange,
  placeholder,
  min,
  step,
  disabled,
  invalid,
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  disabled?: boolean;
  invalid?: boolean;
  suffix?: ReactNode;
}) {
  const [raw, setRaw] = useState<string>(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = raw === '' ? null : Number(raw);
    if (parsed !== value && !(Number.isNaN(parsed as number) && value == null)) {
      setRaw(value == null ? '' : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const input = (
    <input
      className={`input num-input ${invalid ? 'invalid' : ''}`}
      type="number"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder}
      min={min}
      step={step ?? 'any'}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        if (next === '') onChange(null);
        else {
          const n = Number(next);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
    />
  );

  if (!suffix) return input;
  return (
    <div className="row row-2" style={{ width: '100%' }}>
      {input}
      <span className="t-xs muted-3 nowrap">{suffix}</span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {typeof o.label === 'string' ? o.label : o.value}
        </option>
      ))}
    </select>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      className="slider"
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* ------------------------------ Tooltip ------------------------------- */

export function Tip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="tip-trigger" tabIndex={0} role="button" aria-label="info">
        i
      </span>
      {open && <span className="tip-body">{children}</span>}
    </span>
  );
}

/** Tooltip content for a calculated figure: prose plus the formula used. */
export function FormulaTip({
  text,
  formula,
  computedAt,
}: {
  text: ReactNode;
  formula: string;
  computedAt?: string;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  return (
    <Tip>
      {text}
      <code className="formula">{formula}</code>
      {computedAt && (
        <span className="t-xs muted-3" style={{ display: 'block', marginTop: 6 }}>
          {t('g.computedAt')}: {fmt.dateTime(computedAt)}
        </span>
      )}
    </Tip>
  );
}

/* ------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useDismiss<HTMLDivElement>(open, onClose);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="modal-scrim">
      <div className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="h-section">{title}</div>
          <IconBtn icon="close" onClick={onClose} title="Close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------- States ------------------------------- */

export function Skeleton({
  h = 16,
  w = '100%',
  radius,
}: {
  h?: number | string;
  w?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="skeleton"
      style={{ height: h, width: w, borderRadius: radius ?? undefined }}
    />
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="stack stack-2" style={{ padding: 'var(--s-4)' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="row row-3" key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} h={13} w={c === 0 ? 80 : `${60 + ((r + c) % 3) * 20}px`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Empty({
  icon = 'inbox',
  title,
  desc,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <div className="title">{title}</div>
      {desc && <div className="desc">{desc}</div>}
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = 'default',
  icon = 'info',
}: {
  children: ReactNode;
  tone?: 'default' | 'warn' | 'info';
  icon?: IconName;
}) {
  return (
    <div className={`notice ${tone === 'default' ? '' : tone}`}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <div className="disclaimer">{children}</div>;
}

/* ----------------------------- Data table ----------------------------- */

export interface Column<T> {
  key: string;
  label: ReactNode;
  /** Value used for sorting and CSV export. */
  value?: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  align?: 'start' | 'end';
  sortable?: boolean;
  /** Column can be hidden through the column picker. */
  optional?: boolean;
  defaultHidden?: boolean;
  width?: number | string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  initialSort,
  initialDir = 'desc',
  pageSize = 25,
  emptyTitle,
  emptyDesc,
  exportName,
  loading,
  toolbar,
  dense,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: string;
  initialDir?: 'asc' | 'desc';
  pageSize?: number;
  emptyTitle?: ReactNode;
  emptyDesc?: ReactNode;
  exportName?: string;
  loading?: boolean;
  toolbar?: ReactNode;
  dense?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const table = useTableState(initialSort ?? columns[0].key, initialDir, pageSize);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useDismiss<HTMLDivElement>(pickerOpen, () => setPickerOpen(false));

  const visible = columns.filter((c) => !hidden.has(c.key));

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === table.sortKey);
    if (!col?.value) return rows;
    return [...rows].sort((a, b) =>
      compareValues(col.value!(a), col.value!(b), table.sortDir),
    );
  }, [rows, columns, table.sortKey, table.sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / table.size));
  const page = Math.min(table.page, pageCount - 1);
  const slice = sorted.slice(page * table.size, page * table.size + table.size);

  const exportCsv = () => {
    const header = visible.map((c) =>
      typeof c.label === 'string' ? c.label : c.key,
    );
    const body = sorted.map((r) =>
      visible.map((c) => (c.value ? c.value(r) : '')),
    );
    downloadCsv(
      `${exportName ?? 'big-margin'}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...body]),
    );
  };

  if (loading) return <TableSkeleton cols={Math.min(visible.length, 7)} />;

  return (
    <div>
      {(toolbar || exportName || columns.some((c) => c.optional)) && (
        <div
          className="row row-between row-wrap"
          style={{
            gap: 'var(--s-3)',
            padding: 'var(--s-3) var(--s-4)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="row row-3 row-wrap">{toolbar}</div>
          <div className="row row-2">
            {columns.some((c) => c.optional) && (
              <div style={{ position: 'relative' }} ref={pickerRef}>
                <Btn size="sm" icon="sliders" onClick={() => setPickerOpen((o) => !o)}>
                  {t('g.columns')}
                </Btn>
                {pickerOpen && (
                  <div
                    className="search-results"
                    style={{ padding: 'var(--s-3)', minWidth: 210, insetInlineStart: 'auto', insetInlineEnd: 0 }}
                  >
                    <div className="stack stack-2">
                      {columns
                        .filter((c) => c.optional)
                        .map((c) => (
                          <Check
                            key={c.key}
                            checked={!hidden.has(c.key)}
                            onChange={(on) =>
                              setHidden((prev) => {
                                const next = new Set(prev);
                                if (on) next.delete(c.key);
                                else next.add(c.key);
                                return next;
                              })
                            }
                          >
                            {c.label}
                          </Check>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {exportName && (
              <Btn size="sm" icon="download" onClick={exportCsv}>
                {t('g.exportCsv')}
              </Btn>
            )}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <Empty title={emptyTitle ?? t('g.noResults')} desc={emptyDesc ?? t('g.noResultsHint')} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="dt" style={dense ? { fontSize: 'var(--fs-sm)' } : undefined}>
              <thead>
                <tr>
                  {visible.map((c) => (
                    <th
                      key={c.key}
                      className={`${c.align === 'end' ? 'num-col' : ''} ${c.sortable !== false && c.value ? 'sortable' : ''}`}
                      style={c.width ? { width: c.width } : undefined}
                      onClick={() =>
                        c.sortable !== false && c.value && table.toggleSort(c.key)
                      }
                    >
                      {c.label}
                      {c.sortable !== false && c.value && (
                        <span className={`sort-caret ${table.sortKey === c.key ? 'on' : ''}`}>
                          {table.sortKey === c.key ? (table.sortDir === 'asc' ? '▲' : '▼') : '▼'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr
                    key={rowKey(r)}
                    className={onRowClick ? 'clickable' : ''}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
                    {visible.map((c) => (
                      <td key={c.key} className={c.align === 'end' ? 'num-col' : ''}>
                        {c.render ? c.render(r) : <V>{c.value?.(r)}</V>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length > table.size && (
            <div className="row row-between" style={{ padding: 'var(--s-3) var(--s-4)' }}>
              <span className="t-sm muted-3">
                {t('g.showing')} {fmt.int(page * table.size + 1)}–
                {fmt.int(Math.min((page + 1) * table.size, sorted.length))} {t('g.of')}{' '}
                {fmt.int(sorted.length)}
              </span>
              <div className="row row-2">
                <Btn
                  size="sm"
                  icon="chevronLeft"
                  disabled={page === 0}
                  onClick={() => table.setPage(page - 1)}
                >
                  {t('g.prev')}
                </Btn>
                <span className="t-sm muted num">
                  {page + 1} / {pageCount}
                </span>
                <Btn
                  size="sm"
                  icon="chevronRight"
                  disabled={page >= pageCount - 1}
                  onClick={() => table.setPage(page + 1)}
                >
                  {t('g.next')}
                </Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { Icon };
export type { IconName };
