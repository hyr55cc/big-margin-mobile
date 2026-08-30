import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { Badge, Btn, StatusBadge } from '@/components/ui';
import { useMarket } from '@/data/MarketContext';
import { CategoryChip, ImportanceChip } from './importance';
import { toggleFollow, useNewsStore } from '@/store/news';
import type { RankedNews } from '@/lib/calc/newsImportance';

/**
 * One story.
 *
 * The headline is never rewritten, summarised, or re-headlined by the app —
 * it is shown as the source published it, with a link back. Everything BIG
 * MARGIN adds around it (importance, category, your exposure) is visibly
 * separate from the story itself.
 */
export function NewsCard({ row }: { row: RankedNews }) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();
  const followed = useNewsStore((s) => s.followed);

  const { item, importance, relevance } = row;

  return (
    <article className={`news-item ${relevance === 'held' ? 'is-held' : ''}`}>
      <div className="news-head">
        <ImportanceChip result={importance} />
        <CategoryChip category={item.category} />

        {item.official != null && (
          <span className="cat-chip">
            {item.official ? t('news.official') : t('news.media')}
          </span>
        )}

        {relevance === 'held' && <Badge tone="brand">{t('news.held')}</Badge>}
        {relevance === 'followed' && <Badge tone="outline">{t('news.following')}</Badge>}

        <span className="spacer" />
        <StatusBadge provenance={item.provenance} />
      </div>

      <h3 className="news-title">{L(item.headline)}</h3>

      {item.summary && (
        <p className="muted t-sm" style={{ lineHeight: 1.75, maxWidth: '85ch', margin: '0 0 var(--s-3)' }}>
          {L(item.summary)}
        </p>
      )}

      <div className="news-meta">
        {item.symbols.map((s) => {
          const stock = bySymbol.get(s);
          return (
            <Link key={s} to={`/app/stock/${s}`} className="row row-2">
              <span className="sym t-sm">{s}</span>
              {stock?.changePct != null && (
                <Badge tone={stock.changePct >= 0 ? 'up' : 'down'}>
                  {fmt.pct(stock.changePct, { signed: true })}
                </Badge>
              )}
            </Link>
          );
        })}

        <span>·</span>
        <span>{item.sourceName}</span>
        <span>·</span>
        <span className="num">{fmt.relative(item.publishedAt)}</span>

        <span className="spacer" />

        {item.symbols[0] && (
          <Btn
            size="sm"
            variant="ghost"
            icon="bell"
            active={followed.includes(item.symbols[0])}
            onClick={() => toggleFollow(item.symbols[0])}
          >
            {followed.includes(item.symbols[0]) ? t('news.unfollow') : t('news.follow')}
          </Btn>
        )}

        {item.url && (
          <Btn
            size="sm"
            variant="ghost"
            icon="external"
            onClick={() => window.open(item.url as string, '_blank', 'noopener')}
          >
            {t('news.readSource')}
          </Btn>
        )}
      </div>
    </article>
  );
}
