/**
 * Kroger account linking, both platforms.
 *
 * Web: full-page navigation to Kroger's authorize URL; the API callback 302s
 * back to /cart/<id>?kroger=connected and the cart screen picks up the param.
 *
 * Native: expo-web-browser auth session; the API callback 302s to
 * mcpeels://cart/<id>?kroger=connected which resolves the session.
 *
 * MC Peels never sees the Kroger password — the whole exchange happens on
 * Kroger's page, and tokens live encrypted on the server only.
 */

import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from './api';

export type KrogerConnectOutcome =
  | { type: 'redirecting' } // web: the page is navigating away
  | { type: 'connected' }
  | { type: 'cancelled' }
  | { type: 'error'; reason: string };

export async function startKrogerConnect(cartId: string): Promise<KrogerConnectOutcome> {
  if (Platform.OS === 'web') {
    const returnTo = `${window.location.origin}/cart/${cartId}`;
    const { authorize_url } = await api.krogerConnectStart(returnTo);
    window.location.assign(authorize_url);
    return { type: 'redirecting' };
  }

  const returnTo = `mcpeels://cart/${cartId}`;
  const { authorize_url } = await api.krogerConnectStart(returnTo);
  const result = await WebBrowser.openAuthSessionAsync(authorize_url, returnTo);
  if (result.type === 'success') {
    if (result.url.includes('kroger=connected')) return { type: 'connected' };
    const reason = /reason=([^&]+)/.exec(result.url)?.[1] ?? 'unknown';
    return { type: 'error', reason: decodeURIComponent(reason) };
  }
  return { type: 'cancelled' };
}
