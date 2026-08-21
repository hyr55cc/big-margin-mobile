import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { useSettings } from '@/store/settings';
import { Badge, Btn, Card, Icon, IconBtn, type IconName } from '@/components/ui';
import { BrandMark } from '@/components/ui/Icon';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import { Sparkline } from '@/components/charts';
import type { MessageKey } from '@/i18n';

const FEATURES: Array<{ icon: IconName; label: MessageKey; desc: MessageKey; to: string }> = [
  { icon: 'zap', label: 'nav.tasiImpact', desc: 'impact.sub', to: '/app/tasi/impact' },
  { icon: 'crescent', label: 'nav.shariah', desc: 'sh.sub', to: '/app/shariah' },
  { icon: 'wallet', label: 'nav.portfolio', desc: 'pf.sub', to: '/app/portfolio' },
  { icon: 'calculator', label: 'calc.avgCost', desc: 'ac.sub', to: '/app/calculators/average-cost' },
  { icon: 'activity', label: 'calc.pnl', desc: 'calc.pnlDesc', to: '/app/calculators/profit-loss' },
  { icon: 'filter', label: 'scr.title', desc: 'scr.sub', to: '/app/screener' },
  { icon: 'scale', label: 'nav.tasiWeight', desc: 'weight.sub', to: '/app/tasi/weight' },
  { icon: 'grid', label: 'hm.title', desc: 'hm.sub', to: '/app/heatmap' },
];

const FLOW: MessageKey[] = [
  'g.searchShort',
  'stock.overview',
  'sh.status',
  'weight.weight',
  'impact.title',
  'stock.addWatchlist',
  'calc.avgCost',
  'pf.title',
  'calc.pnl',
  'div.income',
  'stock.setAlert',
];

export default function Landing() {
  const { t, L, lang, setLang } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const { indices, rowsFor, statuses } = useMarket();

  const tasi = indices.find((i) => i.id === 'TASI');
  const spx = indices.find((i) => i.id === 'SPX');
  const movers = rowsFor('SA')
    .filter((r) => r.changePct != null)
    .sort((a, b) => Math.abs(b.changePct as number) - Math.abs(a.changePct as number))
    .slice(0, 5);

  return (
    <div className="lp">
      <nav className="lp-nav">
        <span className="row row-3">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span className="brand-word">BIG MARGIN</span>
        </span>
        <span className="row row-2">
          <IconBtn
            icon="languages"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title={lang === 'ar' ? 'English' : 'العربية'}
          />
          <IconBtn
            icon={theme === 'light' ? 'sun' : 'moon'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={t('set.theme')}
          />
          <Btn variant="primary" onClick={() => navigate('/app')}>
            {t('lp.exploreMarket')}
          </Btn>
        </span>
      </nav>

      <header className="lp-hero">
        <Badge tone="brand" dot pulse>
          {t('brand.tagline')}
        </Badge>
        <h1 className="lp-h1" style={{ marginTop: 'var(--s-5)' }}>
          BIG MARGIN
        </h1>
        <h2 className="lp-h2">
          {t('brand.tagline1')}
          <br />
          {t('brand.tagline2')}
        </h2>
        <p className="lp-sub">{t('brand.subtitle')}</p>

        <div className="lp-cta">
          <Btn variant="primary" size="lg" icon="candles" onClick={() => navigate('/app')}>
            {t('lp.exploreMarket')}
          </Btn>
          <Btn size="lg" icon="filter" onClick={() => navigate('/app/screener')}>
            {t('lp.openScreener')}
          </Btn>
        </div>
      </header>

      {/* live market strip */}
      <section className="lp-section">
        <div className="grid grid-2">
          {[
            { ix: tasi, market: 'SA' as const },
            { ix: spx, market: 'US' as const },
          ].map(({ ix, market }) =>
            ix ? (
              <Card key={ix.id} className="card-pad">
                <div className="row row-between row-wrap">
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="eyebrow">{L(ix.name)}</span>
                    <span
                      className={`metric-value xl ${(ix.changePct ?? 0) >= 0 ? 'up' : 'down'}`}
                    >
                      {fmt.num(ix.level)}
                    </span>
                  </div>
                  <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                    <MarketStatusPill status={statuses[market]} />
                    <Badge tone={(ix.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                      {fmt.pct(ix.changePct, { signed: true })}
                    </Badge>
                  </div>
                </div>
              </Card>
            ) : null,
          )}
        </div>

        {movers.length > 0 && (
          <Card className="card-pad" style={{ marginTop: 'var(--s-4)' }}>
            <div className="row row-4 row-wrap">
              {movers.map((r) => (
                <span
                  key={r.symbol}
                  className="row row-2 clickable"
                  onClick={() => navigate(`/app/stock/${r.symbol}`)}
                >
                  <span className="sym">{r.symbol}</span>
                  <Sparkline values={[1, 1.02, 0.99, 1.04, 1 + (r.changePct ?? 0) / 100]} />
                  <Badge tone={(r.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                    {fmt.pct(r.changePct, { signed: true })}
                  </Badge>
                </span>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* features */}
      <section className="lp-section">
        <h2 className="h-page" style={{ marginBottom: 'var(--s-5)' }}>
          {t('lp.whatItDoes')}
        </h2>
        <div className="grid grid-4">
          {FEATURES.map((f) => (
            <div key={f.to} className="lp-feature clickable" onClick={() => navigate(f.to)}>
              <span className="ic">
                <Icon name={f.icon} />
              </span>
              <div className="stack" style={{ gap: 4 }}>
                <span className="h-card">{t(f.label)}</span>
                <span className="t-sm muted-3" style={{ lineHeight: 1.6 }}>
                  {t(f.desc)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* connected workflow */}
      <section className="lp-section">
        <Card className="card-pad">
          <div className="stack stack-4">
            <div className="stack stack-2">
              <span className="eyebrow">{t('lp.whatItDoes')}</span>
              <p className="muted" style={{ maxWidth: '70ch', lineHeight: 1.8 }}>
                {t('lp.flowNote')}
              </p>
            </div>
            <div className="row row-2 row-wrap">
              {FLOW.map((step, i) => (
                <span key={step + i} className="row row-2">
                  <span className="badge badge-outline">{t(step)}</span>
                  {i < FLOW.length - 1 && <span className="muted-3">→</span>}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <footer className="lp-foot">
        <div style={{ maxWidth: 1240, marginInline: 'auto' }} className="stack stack-3">
          <span className="brand-word">BIG MARGIN</span>
          <div className="stack stack-2" style={{ maxWidth: '90ch' }}>
            <span>{t('disc.investment')}</span>
            <span>{t('disc.shariah')}</span>
            <span>{t('disc.data')}</span>
          </div>
          <div className="row row-4 row-wrap">
            <span className="clickable" onClick={() => navigate('/app')}>
              {t('nav.dashboard')}
            </span>
            <span className="clickable" onClick={() => navigate('/app/screener')}>
              {t('nav.screener')}
            </span>
            <span className="clickable" onClick={() => navigate('/app/shariah')}>
              {t('nav.shariah')}
            </span>
            <span className="clickable" onClick={() => navigate('/tv')}>
              {t('tv.title')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
