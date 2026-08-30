import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import { MarketProvider } from '@/data/MarketContext';
import { resolveTheme, useSettings } from '@/store/settings';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui';

/* Route-level code splitting keeps the first paint small. */
const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const MarketPage = lazy(() => import('@/pages/MarketPage'));
const TasiWeight = lazy(() => import('@/pages/TasiWeight'));
const TasiImpact = lazy(() => import('@/pages/TasiImpact'));
const TasiDistribution = lazy(() => import('@/pages/TasiDistribution'));
const Sectors = lazy(() => import('@/pages/Sectors'));
const Shariah = lazy(() => import('@/pages/Shariah'));
const ShariahMethodology = lazy(() => import('@/pages/ShariahMethodology'));
const Screener = lazy(() => import('@/pages/Screener'));
const Rankings = lazy(() => import('@/pages/Rankings'));
const Dividends = lazy(() => import('@/pages/Dividends'));
const CorporateActions = lazy(() => import('@/pages/CorporateActions'));
const Earnings = lazy(() => import('@/pages/Earnings'));
const Compare = lazy(() => import('@/pages/Compare'));
const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const WatchlistPage = lazy(() => import('@/pages/Watchlist'));
const AlertsPage = lazy(() => import('@/pages/Alerts'));
const Calculators = lazy(() => import('@/pages/Calculators'));
const CalculatorPage = lazy(() => import('@/pages/CalculatorPage'));
const News = lazy(() => import('@/pages/News'));
const OptionsPage = lazy(() => import('@/pages/Options'));
const StockProfile = lazy(() => import('@/pages/StockProfile'));
const Settings = lazy(() => import('@/pages/Settings'));
const Account = lazy(() => import('@/pages/Account'));
const Admin = lazy(() => import('@/pages/Admin'));
const More = lazy(() => import('@/pages/More'));
const TvWall = lazy(() => import('@/pages/TvWall'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function ThemeEffect() {
  const pref = useSettings((s) => s.theme);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(pref);
    };
    apply();
    if (pref !== 'system' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [pref]);
  return null;
}

function PageFallback() {
  return (
    <div className="page stack stack-4">
      <Skeleton h={28} w={220} />
      <div className="grid grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} h={104} radius={16} />
        ))}
      </div>
      <Skeleton h={320} radius={16} />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeEffect />
      <MarketProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/tv" element={<TvWall />} />

              <Route path="/app" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="market/:market" element={<MarketPage />} />
                <Route path="tasi/weight" element={<TasiWeight />} />
                <Route path="tasi/impact" element={<TasiImpact />} />
                <Route path="tasi/distribution" element={<TasiDistribution />} />
                <Route path="sectors" element={<Sectors />} />
                <Route path="shariah" element={<Shariah />} />
                <Route path="shariah/methodology" element={<ShariahMethodology />} />
                <Route path="shariah/methodology/:id" element={<ShariahMethodology />} />
                <Route path="screener" element={<Screener />} />
                <Route path="rankings" element={<Rankings />} />
                <Route path="dividends" element={<Dividends />} />
                <Route path="corporate-actions" element={<CorporateActions />} />
                <Route path="earnings" element={<Earnings />} />
                <Route path="compare" element={<Compare />} />
                <Route path="heatmap" element={<Heatmap />} />
                <Route path="portfolio" element={<Portfolio />} />
                <Route path="watchlist" element={<WatchlistPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="calculators" element={<Calculators />} />
                <Route path="calculators/:tool" element={<CalculatorPage />} />
                <Route path="news" element={<News />} />
                <Route path="options" element={<OptionsPage />} />
                <Route path="stock/:symbol" element={<StockProfile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="account" element={<Account />} />
                <Route path="admin" element={<Admin />} />
                <Route path="more" element={<More />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MarketProvider>
    </I18nProvider>
  );
}
