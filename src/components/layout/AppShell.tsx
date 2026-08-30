import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useMarket } from '@/data/MarketContext';
import { Icon, IconBtn, type IconName } from '@/components/ui';
import { BrandMark } from '@/components/ui/Icon';
import { GlobalSearch } from '@/components/market/GlobalSearch';
import { MarketStatusPill } from '@/components/market/MarketStatusPill';
import type { MessageKey } from '@/i18n';

interface NavEntry {
  to: string;
  icon: IconName;
  key: MessageKey;
  end?: boolean;
}

const NAV_GROUPS: Array<{ label: MessageKey; items: NavEntry[] }> = [
  {
    label: 'nav.group.markets',
    items: [
      { to: '/app', icon: 'dashboard', key: 'nav.dashboard', end: true },
      { to: '/app/market/sa', icon: 'candles', key: 'nav.saudi' },
      { to: '/app/market/us', icon: 'globe', key: 'nav.us' },
      { to: '/app/heatmap', icon: 'grid', key: 'nav.heatmap' },
    ],
  },
  {
    label: 'nav.group.index',
    items: [
      { to: '/app/tasi/weight', icon: 'scale', key: 'nav.tasiWeight' },
      { to: '/app/tasi/impact', icon: 'zap', key: 'nav.tasiImpact' },
      { to: '/app/tasi/distribution', icon: 'pie', key: 'nav.distribution' },
      { to: '/app/sectors', icon: 'layers', key: 'nav.sectors' },
    ],
  },
  {
    label: 'nav.group.research',
    items: [
      { to: '/app/shariah', icon: 'crescent', key: 'nav.shariah' },
      { to: '/app/screener', icon: 'filter', key: 'nav.screener' },
      { to: '/app/rankings', icon: 'trophy', key: 'nav.rankings' },
      { to: '/app/compare', icon: 'compare', key: 'nav.compare' },
      { to: '/app/news', icon: 'news', key: 'nav.news' },
      // Read straight from the env rather than the options registry, so the
      // shell does not pull an options provider into the main bundle.
      ...(import.meta.env.VITE_OPTIONS_PROVIDER === 'off'
        ? []
        : [{ to: '/app/options', icon: 'target', key: 'nav.options' } as NavEntry]),
    ],
  },
  {
    label: 'nav.group.events',
    items: [
      { to: '/app/dividends', icon: 'coins', key: 'nav.dividends' },
      { to: '/app/corporate-actions', icon: 'briefcase', key: 'nav.corporateActions' },
      { to: '/app/earnings', icon: 'calendar', key: 'nav.earnings' },
    ],
  },
  {
    label: 'nav.group.you',
    items: [
      { to: '/app/portfolio', icon: 'wallet', key: 'nav.portfolio' },
      { to: '/app/watchlist', icon: 'eye', key: 'nav.watchlist' },
      { to: '/app/alerts', icon: 'bell', key: 'nav.alerts' },
      { to: '/app/calculators', icon: 'calculator', key: 'nav.calculators' },
    ],
  },
];

const MOBILE_NAV: NavEntry[] = [
  { to: '/app', icon: 'home', key: 'nav.home', end: true },
  { to: '/app/market/sa', icon: 'candles', key: 'nav.markets' },
  { to: '/app/screener', icon: 'filter', key: 'nav.screener' },
  { to: '/app/portfolio', icon: 'wallet', key: 'nav.portfolio' },
  { to: '/app/more', icon: 'more', key: 'nav.more' },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="brand-word">BIG MARGIN</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="nav-group-label">{t(g.label)}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={t(it.key)}
              >
                <Icon name={it.icon} className="nav-icon" />
                <span className="nav-label">{t(it.key)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="settings" className="nav-icon" />
          <span className="nav-label">{t('nav.settings')}</span>
        </NavLink>
        <NavLink to="/app/account" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="user" className="nav-icon" />
          <span className="nav-label">{t('nav.account')}</span>
        </NavLink>
      </div>
    </aside>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 340, alignSelf: 'stretch', maxHeight: '100vh', borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="row row-3">
            <span className="brand-mark">
              <BrandMark />
            </span>
            <span className="brand-word">BIG MARGIN</span>
          </span>
          <IconBtn icon="close" onClick={onClose} title={t('g.close')} />
        </div>
        <div className="modal-body" style={{ padding: 'var(--s-2)' }}>
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="nav-group-label">{t(g.label)}</div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={onClose}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon name={it.icon} className="nav-icon" />
                  <span className="nav-label">{t(it.key)}</span>
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group-label">{t('nav.settings')}</div>
          {(
            [
              { to: '/app/settings', icon: 'settings', key: 'nav.settings' },
              { to: '/app/account', icon: 'user', key: 'nav.account' },
              { to: '/app/admin', icon: 'database', key: 'nav.admin' },
              { to: '/tv', icon: 'tv', key: 'nav.tv' },
            ] as NavEntry[]
          ).map((it) => (
            <NavLink key={it.to} to={it.to} onClick={onClose} className="nav-item">
              <Icon name={it.icon} className="nav-icon" />
              <span className="nav-label">{t(it.key)}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoBanner() {
  const { t } = useI18n();
  const { isDemo, providerName } = useMarket();
  if (!isDemo) return null;
  return (
    <div className="demo-banner">
      <Icon name="warning" size={13} />
      <strong>{t('g.demo')}</strong>
      <span className="truncate">
        {t('g.demoNote')} · {providerName}
      </span>
    </div>
  );
}

function Topbar({ onMenu, onToggleSidebar }: { onMenu: () => void; onToggleSidebar: () => void }) {
  const { t, lang, setLang } = useI18n();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const { statuses, refresh, loading } = useMarket();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <span className="only-mobile">
        <IconBtn icon="menu" onClick={onMenu} title={t('nav.more')} />
      </span>
      <span className="hide-mobile">
        <IconBtn icon="menu" onClick={onToggleSidebar} title="Toggle sidebar" />
      </span>

      <GlobalSearch />

      <div className="spacer" />

      <span className="hide-mobile row row-3">
        <MarketStatusPill status={statuses.SA} showTime />
        <MarketStatusPill status={statuses.US} />
      </span>

      <IconBtn icon="refresh" onClick={refresh} title={t('g.lastUpdated')} active={loading} />
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
      <span className="hide-mobile">
        <IconBtn icon="tv" onClick={() => navigate('/tv')} title={t('tv.enter')} />
      </span>
    </header>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} />
      <div className="app-main">
        <Topbar
          onMenu={() => setDrawer(true)}
          onToggleSidebar={() => useSettings.set({ sidebarCollapsed: !collapsed })}
        />
        <DemoBanner />
        <main className="page">{children ?? <Outlet />}</main>
        <MobileNav />
      </div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}

function MobileNav() {
  const { t } = useI18n();
  return (
    <nav className="mobile-nav" aria-label="Primary">
      <ul>
        {MOBILE_NAV.map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={it.icon} />
              <span>{t(it.key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { NAV_GROUPS };
