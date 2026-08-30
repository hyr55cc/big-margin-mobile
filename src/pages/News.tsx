import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Card,
  CardHead,
  Empty,
  Notice,
  Seg,
  Skeleton,
  Tabs,
  TextInput,
} from '@/components/ui';
import { NewsCard } from '@/components/news/NewsCard';
import { FollowManager } from '@/components/news/FollowManager';
import { NotificationList } from '@/components/news/NotificationList';
import {
  useFollowedSymbols,
  useNewsNotifications,
  useRankedNews,
} from '@/lib/newsFeed';
import { unreadCount, useNewsStore } from '@/store/news';
import { meetsLevel } from '@/lib/calc/newsImportance';
import type { MarketId, NewsImportance } from '@/types';

type Tab = 'mine' | 'all' | 'alerts' | 'following';

export default function News() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { isDemo } = useMarket();

  const [tab, setTab] = useState<Tab>('mine');
  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [minLevel, setMinLevel] = useState<NewsImportance | 'any'>('any');
  const [q, setQ] = useState('');

  const followed = useFollowedSymbols();
  const unread = useNewsStore(unreadCount);

  const news = useAsync(() => getProvider().listNews({ limit: 80 }), []);
  // The scheduled-event signal needs the app's own calendars; without them the
  // corroboration rule simply never fires rather than scoring a silent zero.
  const events = useAsync(async () => {
    const p = getProvider();
    const [earnings, actions] = await Promise.all([
      p.listEarnings({}),
      p.listCorporateActions({}),
    ]);
    return { earnings, actions };
  }, []);

  const ranked = useRankedNews(news.data, {
    earnings: events.data?.earnings ?? null,
    actions: events.data?.actions ?? null,
  });

  useNewsNotifications(ranked);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ranked
      .filter((r) => (tab === 'mine' ? r.relevance !== 'none' : true))
      .filter((r) => market === 'all' || r.item.market === market)
      .filter((r) => minLevel === 'any' || meetsLevel(r.importance.level, minLevel))
      .filter(
        (r) =>
          !needle ||
          r.item.headline.en.toLowerCase().includes(needle) ||
          r.item.headline.ar.includes(q.trim()) ||
          r.item.symbols.some((s) => s.toLowerCase().includes(needle)),
      );
  }, [ranked, tab, market, minLevel, q]);

  const TABS: Array<{ value: Tab; label: string }> = [
    { value: 'mine', label: t('news.tab.mine') },
    { value: 'all', label: t('news.tab.all') },
    {
      value: 'alerts',
      label: `${t('news.tab.alerts')}${unread > 0 ? ` (${fmt.int(unread)})` : ''}`,
    },
    { value: 'following', label: t('news.tab.following') },
  ];

  const isFeed = tab === 'mine' || tab === 'all';

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('news.title')}
        sub={
          tab === 'mine'
            ? t('news.mineSub')
            : tab === 'all'
              ? t('news.allSub')
              : tab === 'following'
                ? t('news.followingSub')
                : t('news.alertsSub')
        }
      />

      <Tabs value={tab} onChange={setTab} options={TABS} />

      {isFeed && (
        <>
          <Notice tone="warn" icon="warning">
            {t('news.whyMovingNote')}
          </Notice>

          <Card>
            <CardHead
              title={tab === 'mine' ? t('news.tab.mine') : t('news.tab.all')}
              sub={
                tab === 'mine'
                  ? `${fmt.int(followed.size)} ${t('news.followCount')}`
                  : undefined
              }
              icon="news"
              right={
                <>
                  <div style={{ width: 180 }}>
                    <TextInput value={q} onChange={setQ} placeholder={t('g.searchShort')} />
                  </div>
                  <Seg
                    value={minLevel}
                    onChange={setMinLevel}
                    options={[
                      { value: 'any', label: t('g.all') },
                      { value: 'important', label: t('news.imp.important') },
                      { value: 'critical', label: t('news.imp.critical') },
                    ]}
                  />
                  <Seg
                    value={market}
                    onChange={setMarket}
                    options={[
                      { value: 'all', label: t('g.all') },
                      { value: 'SA', label: '🇸🇦' },
                      { value: 'US', label: '🇺🇸' },
                    ]}
                  />
                </>
              }
            />

            <div className="card-body">
              {news.loading && <Skeleton h={260} />}

              {!news.loading && filtered.length === 0 && (
                <Empty
                  icon="news"
                  title={tab === 'mine' ? t('news.noNews') : t('g.unavailable')}
                  desc={
                    tab === 'mine' && followed.size === 0
                      ? t('news.noFollowsHint')
                      : isDemo
                        ? t('g.demoNote')
                        : (news.error?.message ?? t('news.noNewsHint'))
                  }
                />
              )}

              {filtered.map((row) => (
                <NewsCard key={`${row.item.id}`} row={row} />
              ))}
            </div>

            {filtered.length > 0 && (
              <div className="card-foot row row-3 row-wrap">
                <Badge tone="neutral">{fmt.int(filtered.length)}</Badge>
                <span>{t('g.results')}</span>
                <span className="spacer" />
                <span>{t('news.imp.calcNote')}</span>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'alerts' && <NotificationList />}
      {tab === 'following' && <FollowManager />}

      {isFeed && (
        <Card>
          <CardHead title={t('news.whyMoving')} icon="info" />
          <div className="card-body">
            <p className="muted" style={{ lineHeight: 1.8, maxWidth: '80ch' }}>
              {t('news.whyMovingNote')}
            </p>
            <p className="unavailable" style={{ marginTop: 'var(--s-3)' }}>
              {t('news.noExplanation')}
            </p>
          </div>
        </Card>
      )}

      <Disclaimers />
    </div>
  );
}
