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
  /**
   * True when /me failed for a signed-in user (network/server trouble).
   * Distinguishes "couldn't load your account" from "genuinely no household"
   * so existing users aren't silently routed into onboarding.
   */
  meError: boolean;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [meError, setMeError] = useState(false);

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
      setMeError(false);
      setMeLoaded(true);
      return;
    }

    setMeLoaded(false);
    setMeError(false);
    api
      .getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        // A 401 here signs the user out via the api wrapper; other failures
        // leave me=null with meError set — onboarding shows a retry banner so
        // existing-household users don't mistake this for a fresh account.
        if (!cancelled) {
          setMe(null);
          setMeError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMeLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.getMe();
      setMe(data);
      setMeError(false);
    } catch (err) {
      setMeError(true);
      throw err;
    } finally {
      setMeLoaded(true);
    }
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
      meError,
      refreshMe,
      signOut,
    }),
    [session, me, sessionLoaded, meLoaded, meError, refreshMe, signOut]
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
