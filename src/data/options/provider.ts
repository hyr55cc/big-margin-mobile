/* =========================================================================
   BIG MARGIN — Options data contract

   Deliberately separate from MarketDataProvider. Options are usually a
   different vendor on a different licence at a different price, and they
   refresh on a different cadence. Keeping the contracts apart means the
   equity screens cannot break when the options vendor changes, and an
   options subscription can be switched off entirely without touching them.

   Same rules as the equity contract: never invent a value, always carry
   provenance, and mark anything derived as 'calculated'.
   ========================================================================= */

import type { MarketId, Maybe } from '@/types';
import type {
  FlowTrade,
  IvStats,
  OptionChain,
  OptionContract,
  OptionExpiry,
  UnusualActivity,
} from '@/types/options';

export interface OptionsProviderInfo {
  id: string;
  name: string;
  /** True only for a feed carrying production options data. */
  production: boolean;
  description: string;
  /** Markets on which this provider lists options. */
  markets: MarketId[];
  capabilities: {
    chains: boolean;
    greeks: boolean;
    impliedVolatility: boolean;
    /** Historical price series for an individual contract. */
    contractHistory: boolean;
    flow: boolean;
    unusualActivity: boolean;
    ivStatistics: boolean;
  };
  /** Minutes of delay on quotes; 0 for real-time, null when unknown. */
  delayMinutes: Maybe<number>;
}

export interface ContractCandle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  openInterest: Maybe<number>;
}

export interface OptionsDataProvider {
  readonly info: OptionsProviderInfo;

  /** True when this underlying has listed options at all. */
  hasOptions(symbol: string): Promise<boolean>;

  /** Expiries only — cheap, and loaded before any chain. */
  listExpiries(symbol: string): Promise<OptionExpiry[]>;

  /**
   * One expiry at a time. Loading every expiry at once is the single biggest
   * performance mistake in an options screen, so the contract does not allow it.
   */
  getChain(symbol: string, expiry: string): Promise<OptionChain | null>;

  getContract(contractSymbol: string): Promise<OptionContract | null>;

  getContractHistory(
    contractSymbol: string,
    days?: number,
  ): Promise<ContractCandle[]>;

  /* ---- optional capabilities: absent means the UI hides the section ---- */
  listFlow?(opts?: {
    symbol?: string;
    limit?: number;
    minPremium?: number;
  }): Promise<FlowTrade[]>;

  listUnusualActivity?(opts?: {
    symbol?: string;
    limit?: number;
  }): Promise<UnusualActivity[]>;

  getIvStats?(symbol: string): Promise<IvStats | null>;
}

/** Thrown when a screen asks for a capability the active provider lacks. */
export class OptionsCapabilityError extends Error {
  constructor(capability: string, providerId: string) {
    super(`Options provider "${providerId}" does not supply ${capability}.`);
    this.name = 'OptionsCapabilityError';
  }
}
