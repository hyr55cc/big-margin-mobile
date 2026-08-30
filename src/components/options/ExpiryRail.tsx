import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Seg, Skeleton, Empty } from '@/components/ui';
import type { ExpiryKind, OptionExpiry } from '@/types/options';

type KindFilter = ExpiryKind | 'all';

const KIND_ORDER: ExpiryKind[] = ['weekly', 'monthly', 'quarterly', 'leaps'];

/**
 * The expiry ladder. Loading a chain is expensive, so this is deliberately
 * the only control that triggers one — nothing else on the screen fetches.
 */
export function ExpiryRail({
  expiries,
  selected,
  onSelect,
  loading,
}: {
  expiries: OptionExpiry[];
  selected: string | null;
  onSelect: (date: string) => void;
  loading?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [kind, setKind] = useState<KindFilter>('all');

  const available = useMemo(() => {
    const present = new Set(expiries.map((e) => e.kind));
    return KIND_ORDER.filter((k) => present.has(k));
  }, [expiries]);

  const shown = useMemo(
    () => (kind === 'all' ? expiries : expiries.filter((e) => e.kind === kind)),
    [expiries, kind],
  );

  if (loading) {
    return (
      <div className="row row-2" style={{ padding: '4px 0 12px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={62} w={92} radius={12} />
        ))}
      </div>
    );
  }

  if (expiries.length === 0) {
    return <Empty icon="calendar" title={t('opt.noOptions')} desc={t('opt.noOptionsHint')} />;
  }

  return (
    <div className="stack stack-2">
      {available.length > 1 && (
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all' as KindFilter, label: t('g.all') },
            ...available.map((k) => ({
              value: k as KindFilter,
              label: t(`opt.${k}` as 'opt.weekly'),
            })),
          ]}
        />
      )}

      <div className="exp-rail" role="tablist" aria-label={t('opt.expiries')}>
        {shown.map((e) => (
          <button
            key={e.date}
            type="button"
            role="tab"
            aria-selected={e.date === selected}
            className={`exp-chip ${e.date === selected ? 'on' : ''}`}
            onClick={() => onSelect(e.date)}
          >
            <span className="d">{fmt.date(e.date)}</span>
            <span className="dte">
              <span className="num">{e.dte}</span> {t('opt.dte')}
            </span>
            <span className="kind">{t(`opt.${e.kind}` as 'opt.weekly')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
