import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Check,
  Empty,
  Field,
  IconBtn,
  Notice,
  Select,
} from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { useMarket } from '@/data/MarketContext';
import { useHeldSymbols, useWatchedSymbols } from '@/lib/newsFeed';
import {
  clearRule,
  followMany,
  ruleFor,
  setDefaultRule,
  setRule,
  setSources,
  toggleFollow,
  toggleMute,
  useNewsStore,
  type NewsRule,
} from '@/store/news';

const RULES: NewsRule[] = ['critical', 'important', 'all', 'off'];

/**
 * Who reaches you, and how loudly.
 *
 * The follow set is assembled from three places, so the screen shows all three
 * rather than a single opaque list: what you added by hand, what flows in from
 * your holdings and watchlists, and what you have silenced. Otherwise a
 * company appearing in your feed has no visible explanation.
 */
export function FollowManager() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();

  const state = useNewsStore((s) => s);
  const held = useHeldSymbols();
  const watched = useWatchedSymbols();

  const rows = useMemo(() => {
    const set = new Set<string>(state.followed);
    if (state.includePortfolio) for (const s of held) set.add(s);
    if (state.includeWatchlists) for (const s of watched) set.add(s);
    return [...set]
      .filter((s) => !state.muted.includes(s))
      .map((symbol) => ({
        symbol,
        explicit: state.followed.includes(symbol),
        fromPortfolio: held.has(symbol),
        fromWatchlist: watched.has(symbol),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [state, held, watched]);

  const sourceLabel = (r: (typeof rows)[number]) => {
    const parts: string[] = [];
    if (r.explicit) parts.push(t('news.follow'));
    if (r.fromPortfolio && state.includePortfolio) parts.push(t('news.srcPortfolio'));
    if (r.fromWatchlist && state.includeWatchlists) parts.push(t('news.srcWatchlist'));
    return parts.join(' · ');
  };

  return (
    <div className="stack stack-4">
      <Notice tone="info">{t('news.deliveryNote')}</Notice>

      <Card>
        <CardHead title={t('news.sources')} sub={t('news.srcNote')} icon="sliders" />
        <div className="card-body stack stack-3">
          <Check
            checked={state.includePortfolio}
            onChange={(v) => setSources({ includePortfolio: v })}
          >
            {t('news.srcPortfolio')}
          </Check>
          <Check
            checked={state.includeWatchlists}
            onChange={(v) => setSources({ includeWatchlists: v })}
          >
            {t('news.srcWatchlist')}
          </Check>

          <div style={{ maxWidth: 320, marginTop: 'var(--s-2)' }}>
            <Field label={t('news.defaultRule')}>
              <Select<NewsRule>
                value={state.defaultRule}
                onChange={setDefaultRule}
                options={RULES.map((r) => ({
                  value: r,
                  label: t(`news.rule.${r}` as 'news.rule.all'),
                }))}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title={t('news.followed')}
          sub={`${fmt.int(rows.length)} ${t('news.followCount')}`}
          icon="bell"
          right={
            <>
              <Btn size="sm" variant="ghost" onClick={() => followMany([...held])}>
                {t('news.addPortfolio')}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => followMany([...watched])}>
                {t('news.addWatchlist')}
              </Btn>
            </>
          }
        />

        <div className="card-body stack stack-3">
          <InstrumentPicker
            placeholder={t('g.search')}
            exclude={rows.map((r) => r.symbol)}
            onPick={(r) => toggleFollow(r.symbol)}
          />

          {rows.length === 0 ? (
            <Empty icon="bell" title={t('news.noFollows')} desc={t('news.noFollowsHint')} />
          ) : (
            <div>
              {rows.map((r) => {
                const stock = bySymbol.get(r.symbol);
                const rule = ruleFor(state, r.symbol);
                const overridden = state.rules[r.symbol] != null;
                return (
                  <div key={r.symbol} className="follow-row">
                    <Link to={`/app/stock/${r.symbol}`} className="row row-2">
                      <span className="sym">{r.symbol}</span>
                      {stock && (
                        <span className="t-sm muted">{L(stock.instrument.shortName)}</span>
                      )}
                    </Link>

                    <span className="src-note">{sourceLabel(r)}</span>

                    <span className="spacer" />

                    <div style={{ minWidth: 190 }}>
                      <Select<NewsRule>
                        value={rule}
                        onChange={(v) => setRule(r.symbol, v)}
                        options={RULES.map((x) => ({
                          value: x,
                          label: t(`news.rule.${x}` as 'news.rule.all'),
                        }))}
                      />
                    </div>

                    {overridden ? (
                      <IconBtn
                        icon="refresh"
                        title={t('news.usingDefault')}
                        onClick={() => clearRule(r.symbol)}
                      />
                    ) : (
                      <span className="src-note">{t('news.usingDefault')}</span>
                    )}

                    <IconBtn
                      icon="close"
                      title={t('news.mute')}
                      onClick={() =>
                        r.explicit ? toggleFollow(r.symbol) : toggleMute(r.symbol)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {state.muted.length > 0 && (
        <Card>
          <CardHead title={t('news.muted')} icon="eye" />
          <div className="card-body row row-2 row-wrap">
            {state.muted.map((s) => (
              <Btn key={s} size="sm" variant="ghost" onClick={() => toggleMute(s)}>
                <Badge tone="neutral">{s}</Badge>
                {t('g.remove')}
              </Btn>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
