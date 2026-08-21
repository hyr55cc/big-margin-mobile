import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Empty,
  Notice,
  Seg,
  Skeleton,
  StatusBadge,
  TextInput,
} from '@/components/ui';
import type { MarketId } from '@/types';

export default function News() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { bySymbol, isDemo } = useMarket();
  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [q, setQ] = useState('');

  const state = useAsync(() => getProvider().listNews({ limit: 60 }), []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.data ?? [])
      .filter((n) => market === 'all' || n.market === market)
      .filter(
        (n) =>
          !needle ||
          n.headline.en.toLowerCase().includes(needle) ||
          n.headline.ar.includes(q.trim()) ||
          n.symbols.some((s) => s.toLowerCase().includes(needle)),
      );
  }, [state.data, market, q]);

  return (
    <div className="stack stack-5">
      <PageHead title={t('news.title')} sub={t('news.sub')} />

      <Notice tone="warn" icon="warning">
        {t('news.whyMovingNote')}
      </Notice>

      <Card>
        <CardHead
          title={t('news.title')}
          icon="news"
          right={
            <>
              <div style={{ width: 200 }}>
                <TextInput value={q} onChange={setQ} placeholder={t('g.searchShort')} />
              </div>
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
        <div className="card-body stack stack-3">
          {state.loading && <Skeleton h={220} />}

          {!state.loading && items.length === 0 && (
            <Empty
              icon="news"
              title={t('g.unavailable')}
              desc={
                isDemo
                  ? t('news.whyMovingNote')
                  : (state.error?.message ?? t('g.noResultsHint'))
              }
            />
          )}

          {items.map((n) => (
            <article
              key={n.id}
              className="stack stack-2"
              style={{
                borderBottom: '1px solid var(--border)',
                paddingBottom: 'var(--s-3)',
              }}
            >
              <div className="row row-3 row-wrap">
                {n.symbols.map((s) => {
                  const row = bySymbol.get(s);
                  return (
                    <Link key={s} to={`/app/stock/${s}`} className="row row-2">
                      <span className="sym t-sm">{s}</span>
                      {row?.changePct != null && (
                        <Badge tone={row.changePct >= 0 ? 'up' : 'down'}>
                          {fmt.pct(row.changePct, { signed: true })}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
                <span className="spacer" />
                <StatusBadge provenance={n.provenance} />
              </div>

              <h3 className="h-section" style={{ lineHeight: 1.45 }}>
                {L(n.headline)}
              </h3>

              {n.summary && (
                <p className="muted t-sm" style={{ lineHeight: 1.75, maxWidth: '85ch' }}>
                  {L(n.summary)}
                </p>
              )}

              <div className="row row-3 t-xs muted-3">
                <span>{n.sourceName}</span>
                <span>·</span>
                <span className="num">{fmt.dateTime(n.publishedAt)}</span>
                <span>·</span>
                <span>{fmt.relative(n.publishedAt)}</span>
                {n.url && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon="external"
                    onClick={() => window.open(n.url as string, '_blank', 'noopener')}
                  >
                    {t('news.readSource')}
                  </Btn>
                )}
              </div>
            </article>
          ))}
        </div>
      </Card>

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

      <Disclaimers />
    </div>
  );
}
