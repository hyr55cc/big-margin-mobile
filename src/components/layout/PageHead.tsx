import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { Disclaimer, StatusBadge } from '@/components/ui';
import type { DataStatus } from '@/types';

export function PageHead({
  title,
  sub,
  right,
  status,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  status?: DataStatus;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { loadedAt } = useMarket();
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        <div className="row row-3">
          <h1 className="h-page">{title}</h1>
          {status && <StatusBadge status={status} />}
        </div>
        {sub && <p className="sub">{sub}</p>}
        {loadedAt && (
          <div className="t-xs muted-3" style={{ marginTop: 6 }}>
            {t('g.lastUpdated')}: <span className="num">{fmt.dateTime(loadedAt)}</span>
          </div>
        )}
      </div>
      {right && <div className="row row-2 row-wrap">{right}</div>}
    </div>
  );
}

/** The three standing disclaimers, shown at the foot of relevant pages. */
export function Disclaimers({
  investment = true,
  shariah = false,
  data = true,
}: {
  investment?: boolean;
  shariah?: boolean;
  data?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Disclaimer>
      <div className="stack stack-2">
        {investment && <div>{t('disc.investment')}</div>}
        {shariah && <div>{t('disc.shariah')}</div>}
        {data && <div>{t('disc.data')}</div>}
      </div>
    </Disclaimer>
  );
}
