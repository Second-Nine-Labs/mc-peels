import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from './api';
import { supabase } from './supabase';
import type { Membership, MeResponse } from './types';

interface SessionContextValue {
  session: Session | null;
  me: MeResponse | null;
  /** The active household membership (first membership; PRD defaults to one). */
  membership: Membership | null;
  /** True once both the auth session and /me have settled. */
  ready: boolean;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setMe(null);
      setMeLoaded(true);
      return;
    }

    setMeLoaded(false);
    api
      .getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        // A 401 here signs the user out via the api wrapper; other failures
        // leave me=null and the gate sends the user to onboarding, which can
        // still create/join a household or surface errors.
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setMeLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshMe = useCallback(async () => {
    const data = await api.getMe();
    setMe(data);
    setMeLoaded(true);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      me,
      membership: me?.memberships[0] ?? null,
      ready: sessionLoaded && meLoaded,
      refreshMe,
      signOut,
    }),
    [session, me, sessionLoaded, meLoaded, refreshMe, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
