import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { usePortfolio } from '@/store/portfolio';
import { useWatchlists, useAlerts } from '@/store/watchlist';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Badge, Btn, Card, CardHead, Icon, Metric, Notice } from '@/components/ui';

export default function Account() {
  const { t } = useI18n();
  const fmt = useFmt();
  const transactions = usePortfolio((s) => s.transactions);
  const portfolios = usePortfolio((s) => s.portfolios);
  const lists = useWatchlists((s) => s.lists);
  const alerts = useAlerts((s) => s.alerts);

  const SYNCS = [
    { icon: 'wallet' as const, label: t('nav.portfolio'), count: portfolios.length },
    { icon: 'eye' as const, label: t('nav.watchlist'), count: lists.length },
    { icon: 'bell' as const, label: t('nav.alerts'), count: alerts.length },
    { icon: 'calculator' as const, label: t('calc.title'), count: null },
    { icon: 'settings' as const, label: t('set.title'), count: null },
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('acc.title')} />

      <Card>
        <CardHead
          title={t('acc.guest')}
          icon="user"
          right={<Badge tone="gold">{t('acc.guest')}</Badge>}
        />
        <div className="card-body stack stack-4">
          <p className="muted" style={{ lineHeight: 1.8, maxWidth: '75ch' }}>
            {t('acc.guestBody')}
          </p>

          <div className="metric-grid">
            <Metric label={t('pf.transactions')} value={fmt.int(transactions.length)} size="xl" />
            <Metric label={t('nav.watchlist')} value={fmt.int(lists.length)} size="xl" />
            <Metric label={t('nav.alerts')} value={fmt.int(alerts.length)} size="xl" />
            <Metric label={t('nav.portfolio')} value={fmt.int(portfolios.length)} size="xl" />
          </div>

          <div className="row row-3">
            <Btn variant="primary" icon="user" disabled>
              {t('acc.signIn')}
            </Btn>
            <Btn icon="plus" disabled>
              {t('acc.createAccount')}
            </Btn>
          </div>

          <Notice tone="info">{t('acc.notConnected')}</Notice>
        </div>
      </Card>

      <Card>
        <CardHead title={t('acc.syncs')} icon="database" />
        <div className="card-body stack stack-3">
          {SYNCS.map((x) => (
            <div key={x.label} className="row row-between">
              <span className="row row-3">
                <span className="muted-3">
                  <Icon name={x.icon} size={16} />
                </span>
                {x.label}
              </span>
              {x.count != null ? (
                <span className="num muted">{fmt.int(x.count)}</span>
              ) : (
                <span className="muted-3">—</span>
              )}
            </div>
          ))}
        </div>
        <div className="card-foot">{t('set.resetHint')}</div>
      </Card>

      <Disclaimers />
    </div>
  );
}
