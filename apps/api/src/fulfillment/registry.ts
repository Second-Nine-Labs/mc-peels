/**
 * Provider registry. FULFILLMENT_PROVIDERS (csv) controls which rails exist
 * AND their display order — server-side, so the lineup changes with an env
 * flip, no app release. Default 'instacart' keeps existing deploys inert.
 */

import { env } from '../env.js';
import { createDoorDashProvider, createUberEatsProvider } from './deeplinks.js';
import { createInstacartProvider } from './instacart.js';
import { createKrogerProvider } from './kroger/provider.js';
import type { FulfillmentProvider, ProviderKey } from './types.js';

const FACTORIES: Record<string, () => FulfillmentProvider> = {
  instacart: createInstacartProvider,
  kroger: createKrogerProvider,
  doordash: createDoorDashProvider,
  ubereats: createUberEatsProvider,
};

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Is this provider deployable with the current environment? */
function ready(key: string): boolean {
  if (key !== 'kroger') return true;
  const e = env();
  if (e.KROGER_CLIENT_ID && e.KROGER_CLIENT_SECRET && e.TOKEN_ENCRYPTION_KEY && e.API_PUBLIC_URL) {
    return true;
  }
  warnOnce(
    'kroger',
    'Kroger provider skipped: set KROGER_CLIENT_ID, KROGER_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, API_PUBLIC_URL.',
  );
  return false;
}

/** Enabled providers in csv order. Unknown keys warn once and are skipped. */
export function enabledProviders(): FulfillmentProvider[] {
  const keys = env()
    .FULFILLMENT_PROVIDERS.split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const providers: FulfillmentProvider[] = [];
  for (const key of keys) {
    const factory = FACTORIES[key];
    if (!factory) {
      warnOnce(key, `Unknown fulfillment provider '${key}' in FULFILLMENT_PROVIDERS — skipped.`);
      continue;
    }
    if (!ready(key)) continue;
    providers.push(factory());
  }
  return providers;
}

export function getProvider(key: ProviderKey): FulfillmentProvider | null {
  return enabledProviders().find((p) => p.key === key) ?? null;
}

let metaCache: Map<string, { displayName: string; capabilities: FulfillmentProvider['capabilities'] }> | null =
  null;

/**
 * Display metadata for any KNOWN provider (enabled or not) — serializers use
 * this so an offer row never renders with a bare key.
 */
export function providerMeta(key: string): {
  displayName: string;
  capabilities: FulfillmentProvider['capabilities'];
} {
  if (!metaCache) {
    metaCache = new Map(
      Object.entries(FACTORIES).map(([k, factory]) => {
        const p = factory();
        return [k, { displayName: p.displayName, capabilities: p.capabilities }];
      }),
    );
  }
  return (
    metaCache.get(key) ?? { displayName: key, capabilities: { quote: false, handoff: 'link' } }
  );
}
