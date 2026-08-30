/* =========================================================================
   BIG MARGIN — Options provider registry
   The single place that decides where options data comes from, and whether
   the options module is enabled at all.
   ========================================================================= */

import type { OptionsDataProvider } from './provider';
import { DemoOptionsProvider } from './DemoOptionsProvider';
import { HttpOptionsProvider } from './HttpOptionsProvider';

export type OptionsProviderId = 'demo' | 'http' | 'off';

const PROVIDERS: Record<Exclude<OptionsProviderId, 'off'>, OptionsDataProvider> = {
  demo: DemoOptionsProvider,
  http: HttpOptionsProvider,
};

function configuredId(): OptionsProviderId {
  const raw = (import.meta.env.VITE_OPTIONS_PROVIDER as string | undefined)?.trim();
  if (raw === 'off') return 'off';
  if (raw === 'http') {
    const base =
      import.meta.env.VITE_OPTIONS_API_BASE_URL || import.meta.env.VITE_API_BASE_URL;
    if (!base) {
      console.warn(
        '[BIG MARGIN] VITE_OPTIONS_PROVIDER=http but no options API base URL is set — using the demo options dataset.',
      );
      return 'demo';
    }
    return 'http';
  }
  return 'demo';
}

let activeId: OptionsProviderId = configuredId();

/** Null when options are switched off for this deployment. */
export function getOptionsProvider(): OptionsDataProvider | null {
  return activeId === 'off' ? null : PROVIDERS[activeId];
}

export function setOptionsProvider(id: OptionsProviderId): void {
  activeId = id;
}

export function optionsEnabled(): boolean {
  return activeId !== 'off';
}

/** True when the active options feed is not production data. */
export function isDemoOptions(): boolean {
  const p = getOptionsProvider();
  return p != null && !p.info.production;
}

export function listOptionsProviders(): OptionsDataProvider[] {
  return Object.values(PROVIDERS);
}
