import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Btn, Card, CardHead, Empty, IconBtn, Notice } from '@/components/ui';
import {
  clearNotifications,
  dismissNotification,
  markAllRead,
  markRead,
  unreadCount,
  useNewsStore,
} from '@/store/news';
import type { MessageKey } from '@/i18n';

export function NotificationList() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const notifications = useNewsStore((s) => s.notifications);
  const unread = useNewsStore(unreadCount);

  return (
    <div className="stack stack-4">
      <Notice tone="info">{t('news.deliveryNote')}</Notice>

      <Card>
        <CardHead
          title={t('news.tab.alerts')}
          sub={unread > 0 ? `${fmt.int(unread)} ${t('news.unread')}` : undefined}
          icon="bell"
          right={
            notifications.length > 0 ? (
              <>
                <Btn size="sm" variant="ghost" onClick={markAllRead} disabled={unread === 0}>
                  {t('news.markAllRead')}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={clearNotifications}>
                  {t('news.clearAll')}
                </Btn>
              </>
            ) : null
          }
        />

        {notifications.length === 0 ? (
          <Empty
            icon="bell"
            title={t('news.noNotifications')}
            desc={t('news.noNotificationsHint')}
          />
        ) : (
          <div className="card-body stack stack-2">
            {notifications.map((n) => (
              <div key={n.id} className={`notif ${n.read ? '' : 'unread'}`}>
                {!n.read && <i className="notif-unreadDot" aria-hidden="true" />}

                <div className="notif-body">
                  <div className="row row-2 row-wrap">
                    <Link to={`/app/stock/${n.symbol}`} className="sym t-sm">
                      {n.symbol}
                    </Link>
                    {n.importance && (
                      <span className={`imp imp-${n.importance}`}>
                        {t(`news.imp.${n.importance}` as MessageKey)}
                      </span>
                    )}
                    <span className="spacer" />
                    <span className="t-xs muted-3 num">{fmt.relative(n.publishedAt)}</span>
                  </div>

                  <p className="notif-headline">
                    {lang === 'ar' ? n.headlineAr : n.headlineEn}
                  </p>
                </div>

                <div className="row row-2">
                  {!n.read && (
                    <IconBtn
                      icon="check"
                      title={t('news.markAllRead')}
                      onClick={() => markRead(n.id)}
                    />
                  )}
                  <IconBtn
                    icon="close"
                    title={t('g.remove')}
                    onClick={() => dismissNotification(n.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
