import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Tip } from '@/components/ui';
import { DASH } from '@/lib/format';
import type { ImportanceResult } from '@/lib/calc/newsImportance';
import type { MessageKey } from '@/i18n';

/**
 * The importance chip.
 *
 * It gets its own visual language rather than borrowing the badge tones,
 * because in this app red and green already mean price direction and gold
 * already means delayed data. Importance is a third axis and must not be read
 * as either of the other two. The level is always spelled out in words, so the
 * chip never depends on colour to be understood.
 */
export function ImportanceChip({
  result,
  showWhy = true,
}: {
  result: ImportanceResult;
  showWhy?: boolean;
}) {
  const { t } = useI18n();

  if (result.level == null) {
    return (
      <span className="imp imp-unknown">
        {t('news.imp.unknown')}
        {showWhy && (
          <Tip>
            <strong>{t('news.imp.unknown')}</strong>
            <span style={{ display: 'block', marginTop: 6 }}>{t('news.imp.unknownWhy')}</span>
          </Tip>
        )}
      </span>
    );
  }

  const label = t(`news.imp.${result.level}` as MessageKey);

  return (
    <span className={`imp imp-${result.level}`}>
      {result.level === 'critical' && <i className="imp-dot" aria-hidden="true" />}
      {label}
      {showWhy && <ImportanceWhy result={result} />}
    </span>
  );
}

/** Shows the working: which signal contributed what, and the rule applied. */
export function ImportanceWhy({ result }: { result: ImportanceResult }) {
  const { t } = useI18n();
  const fmt = useFmt();

  if (result.origin === 'source') {
    return (
      <Tip>
        <strong>{t('news.imp.fromSource')}</strong>
        <span style={{ display: 'block', marginTop: 6 }}>{t('news.imp.fromSourceNote')}</span>
      </Tip>
    );
  }

  return (
    <Tip>
      <strong>{t('news.imp.why')}</strong>
      <span className="imp-signals">
        {result.signals.map((s) => (
          <span key={s.key} className="imp-signal">
            <span>
              {t(s.labelKey as MessageKey)}
              {s.detail && (
                <>
                  {' · '}
                  <em>{t(`news.cat.${s.detail}` as MessageKey)}</em>
                </>
              )}
            </span>
            <span className={`num ${s.points >= 0 ? '' : 'muted-3'}`}>
              {s.points >= 0 ? '+' : ''}
              {fmt.num(s.points, { decimals: 0 })}
            </span>
          </span>
        ))}
        <span className="imp-signal imp-total">
          <span>{t('g.total')}</span>
          <span className="num">{result.score == null ? DASH : fmt.num(result.score, { decimals: 0 })}</span>
        </span>
      </span>
      <code className="formula">{result.formula}</code>
      <span className="t-xs muted-3" style={{ display: 'block', marginTop: 6 }}>
        {t('news.imp.calcNote')}
      </span>
    </Tip>
  );
}

/** The event type, shown plainly next to the chip. */
export function CategoryChip({ category }: { category: string | null }) {
  const { t } = useI18n();
  if (!category) return null;
  return <span className="cat-chip">{t(`news.cat.${category}` as MessageKey)}</span>;
}
