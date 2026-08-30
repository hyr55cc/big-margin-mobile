import { useI18n } from '@/i18n';
import { Btn, Check, Field, NumInput, Select, Seg } from '@/components/ui';
import { DEFAULT_CHAIN_FILTERS, type ChainFilters, type Moneyness } from '@/types/options';

/**
 * Filters sit behind a disclosure rather than above the ladder: a chain is
 * read by scanning strikes, and a permanent filter block would push the rows
 * that matter below the fold on a phone.
 */
export function ChainFiltersBar({
  filters,
  onChange,
  showExtendedGreeks,
  onToggleExtendedGreeks,
}: {
  filters: ChainFilters;
  onChange: (f: ChainFilters) => void;
  showExtendedGreeks: boolean;
  onToggleExtendedGreeks: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const set = <K extends keyof ChainFilters>(key: K, value: ChainFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const dirty = (Object.keys(DEFAULT_CHAIN_FILTERS) as Array<keyof ChainFilters>).some(
    (k) => filters[k] !== DEFAULT_CHAIN_FILTERS[k],
  );

  return (
    <div className="filter-grid">
      <Field label={t('opt.strikeWindow')}>
        <NumInput
          value={filters.strikeWindow}
          onChange={(v) => set('strikeWindow', v)}
          min={2}
          step={2}
          placeholder={t('g.all')}
        />
      </Field>

      <Field label={t('opt.moneyness')}>
        <Select<Moneyness | 'all'>
          value={filters.moneyness}
          onChange={(v) => set('moneyness', v)}
          options={[
            { value: 'all', label: t('g.all') },
            { value: 'ITM', label: t('opt.itm') },
            { value: 'ATM', label: t('opt.atm') },
            { value: 'OTM', label: t('opt.otm') },
          ]}
        />
      </Field>

      <Field label={t('opt.minVolume')}>
        <NumInput value={filters.minVolume} onChange={(v) => set('minVolume', v)} min={0} step={50} />
      </Field>

      <Field label={t('opt.minOi')}>
        <NumInput
          value={filters.minOpenInterest}
          onChange={(v) => set('minOpenInterest', v)}
          min={0}
          step={100}
        />
      </Field>

      <Field label={t('opt.maxSpread')}>
        <NumInput
          value={filters.maxSpreadPct}
          onChange={(v) => set('maxSpreadPct', v)}
          min={0}
          step={5}
          suffix="%"
        />
      </Field>

      <Field label={t('opt.deltaRange')}>
        <div className="row row-2">
          <NumInput value={filters.minDelta} onChange={(v) => set('minDelta', v)} step={0.05} />
          <NumInput value={filters.maxDelta} onChange={(v) => set('maxDelta', v)} step={0.05} />
        </div>
      </Field>

      <Field label={t('opt.ivRange')}>
        <div className="row row-2">
          <NumInput value={filters.minIvPct} onChange={(v) => set('minIvPct', v)} min={0} step={5} suffix="%" />
          <NumInput value={filters.maxIvPct} onChange={(v) => set('maxIvPct', v)} min={0} step={5} suffix="%" />
        </div>
      </Field>

      <Field label={t('opt.premiumRange')}>
        <div className="row row-2">
          <NumInput value={filters.minPremium} onChange={(v) => set('minPremium', v)} min={0} step={0.5} />
          <NumInput value={filters.maxPremium} onChange={(v) => set('maxPremium', v)} min={0} step={0.5} />
        </div>
      </Field>

      <div className="row row-3 row-wrap" style={{ gridColumn: '1 / -1' }}>
        <Check checked={showExtendedGreeks} onChange={onToggleExtendedGreeks}>
          {t('opt.greeks')}
        </Check>
        <Btn variant="ghost" size="sm" disabled={!dirty} onClick={() => onChange(DEFAULT_CHAIN_FILTERS)}>
          {t('opt.resetFilters')}
        </Btn>
      </div>
    </div>
  );
}

/** The calls / puts / both switch, kept separate so the chain header can host it. */
export function SideSwitch({
  value,
  onChange,
}: {
  value: 'call' | 'put' | 'both';
  onChange: (v: 'call' | 'put' | 'both') => void;
}) {
  const { t } = useI18n();
  return (
    <Seg
      value={value}
      onChange={onChange}
      options={[
        { value: 'call', label: t('opt.calls') },
        { value: 'both', label: t('opt.both') },
        { value: 'put', label: t('opt.puts') },
      ]}
    />
  );
}
