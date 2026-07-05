import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development instead of producing confusing auth errors.
  console.warn(
    'MC Peels: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in.'
  );
}

// During static rendering for web there is no window/localStorage; skip
// persistence there so createClient does not touch browser storage.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Supabase is used for AUTH ONLY. All application data flows through the
 * MC Peels REST API (lib/api.ts) using the session's access token as bearer.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(isServer ? {} : { storage: AsyncStorage }),
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
