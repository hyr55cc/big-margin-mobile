import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt, useTick } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import { IconBtn, Badge } from '@/components/ui';
import { BrandMark } from '@/components/ui/Icon';
import { Treemap, performanceColor, useChartTheme } from '@/components/charts';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import { DASH } from '@/lib/format';

/**
 * BIG MARGIN WALL — a full-screen board for TV and large displays.
 * Large type, high contrast, no small controls, automatic rotation.
 * The layout is resolution-independent so the same build drives a browser in
 * kiosk mode, Android TV / Google TV, or an LG webOS web app.
 */

type Screen = 'indices' | 'impact' | 'movers' | 'volume' | 'shariah' | 'heatmap';

const SCREENS: Screen[] = ['indices', 'impact', 'movers', 'volume', 'shariah', 'heatmap'];
const ROTATE_MS = 15000;

export default function TvWall() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const theme = useChartTheme();
  const { indices, rowsFor, statuses, isDemo } = useMarket();

  const [screenIndex, setScreenIndex] = useState(0);
  const [rotating, setRotating] = useState(true);
  useTick(1000);

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(
      () => setScreenIndex((i) => (i + 1) % SCREENS.length),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [rotating]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/app');
      if (e.key === 'ArrowRight') setScreenIndex((i) => (i + 1) % SCREENS.length);
      if (e.key === 'ArrowLeft')
        setScreenIndex((i) => (i - 1 + SCREENS.length) % SCREENS.length);
      if (e.key === ' ') setRotating((r) => !r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const sa = rowsFor('SA');
  const us = rowsFor('US');

  const lists = useMemo(() => {
    const priced = sa.filter((r) => r.changePct != null);
    return {
      impact: [...sa]
        .filter((r) => r.todayPoints != null)
        .sort((a, b) => Math.abs(b.todayPoints as number) - Math.abs(a.todayPoints as number))
        .slice(0, 8),
      gainers: [...priced].sort((a, b) => (b.changePct as number) - (a.changePct as number)).slice(0, 8),
      losers: [...priced].sort((a, b) => (a.changePct as number) - (b.changePct as number)).slice(0, 8),
      volume: [...sa]
        .filter((r) => r.turnover != null)
        .sort((a, b) => (b.turnover as number) - (a.turnover as number))
        .slice(0, 8),
      shariah: [...sa]
        .filter((r) => r.shariahStatus === 'compliant' && r.marketCap != null)
        .sort((a, b) => (b.marketCap as number) - (a.marketCap as number))
        .slice(0, 8),
    };
  }, [sa]);

  const ticker = useMemo(
    () =>
      [...sa.slice(0, 18), ...us.slice(0, 12)].filter((r) => r.changePct != null),
    [sa, us],
  );

  const screen = SCREENS[screenIndex];

  const Row = ({ r, value }: { r: MarketRow; value: React.ReactNode }) => (
    <div className="tv-row">
      <span className="s">{r.symbol}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-2)',
        }}
      >
        {L(r.instrument.shortName)}
      </span>
      {value}
    </div>
  );

  return (
    <div className="tv-root">
      <div className="tv-head">
        <span className="row row-4">
          <span className="brand-mark" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <BrandMark />
          </span>
          <span className="tv-title">BIG MARGIN WALL</span>
          {isDemo && <Badge tone="gold">{t('g.demo')}</Badge>}
        </span>

        <span className="row row-4">
          <MarketStatusPill status={statuses.SA} showTime />
          <span className="tv-clock">{fmt.time(new Date(), { seconds: true })}</span>
          <span className="tv-dots">
            {SCREENS.map((s, i) => (
              <i key={s} className={i === screenIndex ? 'on' : ''} />
            ))}
          </span>
          <IconBtn
            icon={rotating ? 'pause' : 'play'}
            title={t('tv.autoRotate')}
            onClick={() => setRotating((r) => !r)}
          />
          <IconBtn icon="close" title={t('tv.exit')} onClick={() => navigate('/app')} />
        </span>
      </div>

      <div className="tv-body">
        {screen === 'indices' && (
          <div className="tv-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {indices.map((ix) => (
              <div key={ix.id} className="tv-card">
                <h3>{L(ix.name)}</h3>
                <div className={`tv-big ${(ix.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>
                  {ix.level == null ? DASH : fmt.num(ix.level)}
                </div>
                <div className="row row-4">
                  <span className={`tv-sub ${(ix.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {fmt.num(ix.change, { signed: true })}
                  </span>
                  <span className={`tv-sub ${(ix.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {fmt.pct(ix.changePct, { signed: true })}
                  </span>
                </div>
                <div className="row row-4" style={{ marginTop: 'auto' }}>
                  <span className="tv-sub up">▲ {fmt.int(ix.advancers)}</span>
                  <span className="tv-sub down">▼ {fmt.int(ix.decliners)}</span>
                  <span className="tv-sub muted">■ {fmt.int(ix.unchanged)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === 'impact' && (
          <div className="tv-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tv-card">
              <h3>{t('dash.topImpact')}</h3>
              {lists.impact.map((r) => (
                <Row
                  key={r.symbol}
                  r={r}
                  value={
                    <span className="row row-4">
                      <span className="s" style={{ color: 'var(--text-2)' }}>
                        {fmt.pct(r.weightPct, { decimals: 2 })}
                      </span>
                      <span className={`s ${(r.todayPoints ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {fmt.num(r.todayPoints, { decimals: 1, signed: true })}
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'movers' && (
          <div className="tv-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="tv-card">
              <h3>{t('dash.gainers')}</h3>
              {lists.gainers.map((r) => (
                <Row
                  key={r.symbol}
                  r={r}
                  value={<span className="s up">{fmt.pct(r.changePct, { signed: true })}</span>}
                />
              ))}
            </div>
            <div className="tv-card">
              <h3>{t('dash.losers')}</h3>
              {lists.losers.map((r) => (
                <Row
                  key={r.symbol}
                  r={r}
                  value={<span className="s down">{fmt.pct(r.changePct, { signed: true })}</span>}
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'volume' && (
          <div className="tv-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tv-card">
              <h3>{t('dash.mostActive')}</h3>
              {lists.volume.map((r) => (
                <Row
                  key={r.symbol}
                  r={r}
                  value={
                    <span className="row row-4">
                      <span className="s" style={{ color: 'var(--text-2)' }}>
                        {fmt.compact(r.turnover)}
                      </span>
                      <span className={`s ${(r.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {fmt.pct(r.changePct, { signed: true })}
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'shariah' && (
          <div className="tv-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tv-card">
              <h3>{t('sh.leaders')}</h3>
              {lists.shariah.map((r) => (
                <Row
                  key={r.symbol}
                  r={r}
                  value={
                    <span className="row row-4">
                      <span className="s" style={{ color: 'var(--text-2)' }}>
                        {fmt.compact(r.marketCap)}
                      </span>
                      <span className={`s ${(r.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {fmt.pct(r.changePct, { signed: true })}
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'heatmap' && (
          <div className="tv-card" style={{ height: '100%' }}>
            <h3>{t('hm.title')}</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Treemap
                height={520}
                gap={3}
                items={sa
                  .filter((r) => (r.marketCap ?? 0) > 0)
                  .slice(0, 45)
                  .map((r) => ({
                    key: r.symbol,
                    label: r.symbol,
                    size: r.marketCap as number,
                    color: performanceColor(theme, r.changePct),
                    valueLabel: fmt.pct(r.changePct, { signed: true }),
                  }))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="ticker">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((r, i) => (
            <span className="ticker-item" key={`${r.symbol}-${i}`}>
              <span>{r.symbol}</span>
              <span className={(r.changePct ?? 0) >= 0 ? 'up' : 'down'}>
                {fmt.pct(r.changePct, { signed: true })}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
