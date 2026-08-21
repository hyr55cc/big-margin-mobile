import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, Icon, type IconName } from '@/components/ui';
import { NAV_GROUPS } from '@/components/layout/AppShell';
import type { MessageKey } from '@/i18n';

const EXTRA: Array<{ to: string; icon: IconName; key: MessageKey }> = [
  { to: '/app/settings', icon: 'settings', key: 'nav.settings' },
  { to: '/app/account', icon: 'user', key: 'nav.account' },
  { to: '/app/admin', icon: 'database', key: 'nav.admin' },
  { to: '/tv', icon: 'tv', key: 'nav.tv' },
];

export default function More() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="stack stack-5">
      <PageHead title={t('nav.more')} />

      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="stack stack-3">
          <span className="eyebrow">{t(g.label)}</span>
          <div className="grid grid-3">
            {g.items.map((it) => (
              <Card key={it.to} className="card-pad" onClick={() => navigate(it.to)}>
                <span className="row row-3">
                  <span style={{ color: 'var(--bm-brand)' }}>
                    <Icon name={it.icon} size={17} />
                  </span>
                  <span className="h-card">{t(it.key)}</span>
                </span>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div className="stack stack-3">
        <span className="eyebrow">{t('nav.settings')}</span>
        <div className="grid grid-3">
          {EXTRA.map((it) => (
            <Card key={it.to} className="card-pad" onClick={() => navigate(it.to)}>
              <span className="row row-3">
                <span style={{ color: 'var(--bm-brand)' }}>
                  <Icon name={it.icon} size={17} />
                </span>
                <span className="h-card">{t(it.key)}</span>
              </span>
            </Card>
          ))}
        </div>
      </div>

      <Disclaimers shariah />
    </div>
  );
}
