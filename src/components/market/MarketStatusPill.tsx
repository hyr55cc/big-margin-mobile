import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Badge } from '@/components/ui';
import type { MarketId, MarketStatus } from '@/types';

const TONE: Record<
  MarketStatus['session'],
  'up' | 'gold' | 'neutral' | 'violet' | 'outline'
> = {
  open: 'up',
  pre: 'gold',
  after: 'gold',
  auction: 'violet',
  closed: 'neutral',
  holiday: 'neutral',
};

const FLAG: Record<MarketId, string> = { SA: '🇸🇦', US: '🇺🇸' };

export function MarketStatusPill({
  status,
  showFlag = true,
  showTime = false,
}: {
  status: MarketStatus | null;
  showFlag?: boolean;
  showTime?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  if (!status) return null;
  return (
    <span className="row row-2">
      {showFlag && <span aria-hidden="true">{FLAG[status.market]}</span>}
      <Badge tone={TONE[status.session]} dot pulse={status.session === 'open'}>
        {t(`session.${status.session}` as 'session.open')}
      </Badge>
      {showTime && (
        <span className="t-xs muted-3 num">{fmt.time(status.localTime)}</span>
      )}
    </span>
  );
}

export function MarketFlag({ market }: { market: MarketId }) {
  return <span aria-hidden="true">{FLAG[market]}</span>;
}
