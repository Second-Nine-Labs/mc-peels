import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * False when the Supabase env vars are missing. The root layout gates the app
 * on this and shows a setup screen instead of attempting auth, so a missing
 * .env produces friendly guidance rather than a crash.
 */
export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

if (!isSupabaseConfigured) {
  console.warn(
    'MC Peels: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in.',
  );
}

// During static rendering for web there is no window/localStorage; skip
// persistence there so createClient does not touch browser storage.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Supabase is used for AUTH ONLY. All application data flows through the
 * MC Peels REST API (lib/api.ts) using the session's access token as bearer.
 *
 * When unconfigured we still construct a client with a syntactically valid
 * placeholder URL/key so createClient() does not throw "supabaseUrl is
 * required" at import time. It is never actually called — the app gates every
 * auth path behind isSupabaseConfigured.
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost:54321',
  isSupabaseConfigured ? supabaseAnonKey : 'anon-key-placeholder',
  {
    auth: {
      ...(isServer ? {} : { storage: AsyncStorage }),
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
    },
  },
);
