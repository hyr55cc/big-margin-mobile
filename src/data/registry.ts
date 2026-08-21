/* =========================================================================
   BIG MARGIN — Provider registry
   The single place that decides which data source the application reads from.
   ========================================================================= */

import type { MarketDataProvider } from './provider';
import { DemoProvider } from './demo/DemoProvider';
import { HttpProvider } from './live/HttpProvider';

export type ProviderId = 'demo' | 'http';

const PROVIDERS: Record<ProviderId, MarketDataProvider> = {
  demo: DemoProvider,
  http: HttpProvider,
};

function configuredId(): ProviderId {
  const fromEnv = (import.meta.env.VITE_DATA_PROVIDER as string | undefined)?.trim();
  if (fromEnv === 'http') {
    // Falling back protects against a build that enables the API without a URL.
    if (!import.meta.env.VITE_API_BASE_URL) {
      console.warn(
        '[BIG MARGIN] VITE_DATA_PROVIDER=http but VITE_API_BASE_URL is unset — using the demo dataset.',
      );
      return 'demo';
    }
    return 'http';
  }
  return 'demo';
}

let active: MarketDataProvider = PROVIDERS[configuredId()];

export function getProvider(): MarketDataProvider {
  return active;
}

/** Swap the provider at runtime (used by tests and the admin surface). */
export function setProvider(id: ProviderId): void {
  active = PROVIDERS[id];
}

export function listProviders(): MarketDataProvider[] {
  return Object.values(PROVIDERS);
}

/** True when the active provider is not a production feed. */
export function isDemoData(): boolean {
  return !active.info.production;
}
