import { useI18n } from '@/i18n';
import { Tip } from '@/components/ui';
import type { MessageKey } from '@/i18n';

/**
 * Options carry more jargon per square centimetre than any other screen in
 * the product, so every term that has a definition gets one — in place,
 * without leaving the chain.
 */
export type Term =
  | 'strike'
  | 'premium'
  | 'expiry'
  | 'iv'
  | 'delta'
  | 'gamma'
  | 'theta'
  | 'vega'
  | 'rho'
  | 'oi'
  | 'volume'
  | 'itm'
  | 'atm'
  | 'otm'
  | 'breakEven'
  | 'intrinsic'
  | 'extrinsic'
  | 'probItm'
  | 'maxPain'
  | 'ivRank'
  | 'volOi'
  | 'multiplier';

export function Define({ term }: { term: Term }) {
  const { t } = useI18n();
  return <Tip>{t(`opt.def.${term}` as MessageKey)}</Tip>;
}

/** A label with its definition attached — the default way to title a figure. */
export function TermLabel({ term, label }: { term: Term; label?: string }) {
  const { t } = useI18n();
  return (
    <span className="row row-2" style={{ display: 'inline-flex' }}>
      {label ?? t(`opt.${term}` as MessageKey)}
      <Define term={term} />
    </span>
  );
}
