import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppError } from '@/lib/errors';
import { employeeIdToEmail } from '@/lib/staff-identity';
import { getSupabaseClient } from '@/lib/supabase';
import type { AuthState, Profile, Role } from '@/types/domain';

import { AuthContext, type AuthContextValue } from './auth-context';

type ProfileRow = {
  id: string;
  employee_id: string;
  display_name: string;
  role: Role;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    employeeId: row.employee_id,
    displayName: row.display_name,
    role: row.role,
  };
}

type AuthProviderProps = {
  children: ReactNode;
  client?: SupabaseClient;
};

export function AuthProvider({ children, client }: AuthProviderProps) {
  const supabase = useMemo(() => client ?? getSupabaseClient(), [client]);
  const [state, setState] = useState<AuthState>({ status: 'loading', profile: null });
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, employee_id, display_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (profileError) {
        setError('Could not load your staff profile. Try again.');
        setState({ status: 'signed-out', profile: null });
        await supabase.auth.signOut();
        return;
      }

      const row = data as ProfileRow | null;

      if (!row) {
        setError('Your account has no staff profile. Ask the owner to check your access.');
        setState({ status: 'signed-out', profile: null });
        await supabase.auth.signOut();
        return;
      }

      setError(null);
      setState({ status: 'signed-in', profile: toProfile(row) });
    },
    [supabase],
  );

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setState({ status: 'signed-out', profile: null });
        return;
      }

      await loadProfile(session.user.id);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (!active) return;
        setState({ status: 'signed-out', profile: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(() => {
          if (active) void loadProfile(session.user.id);
        }, 0);
      }
    });

    return () => {
      active = false;
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signIn = useCallback(
    async (employeeId: string, password: string) => {
      setError(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: employeeIdToEmail(employeeId),
        password,
      });

      if (!signInError) return;

      const message = signInError.message.toLowerCase();

      if (message.includes('invalid login') || message.includes('invalid credentials')) {
        throw new AppError('AUTH_INVALID', 'The employee ID or password is incorrect.');
      }

      if (signInError.status === 429 || message.includes('rate limit')) {
        throw new AppError('AUTH_RATE_LIMIT', 'Too many attempts. Wait a minute and try again.');
      }

      throw new AppError(
        'AUTH_NETWORK',
        'Could not reach the server. Check the connection and try again.',
      );
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setError(null);
    setState({ status: 'signed-out', profile: null });
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await loadProfile(session.user.id);
    }
  }, [supabase, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const methods = { error, signIn, signOut, refreshProfile };

    if (state.status === 'signed-in') {
      return { ...methods, status: 'signed-in', profile: state.profile };
    }

    if (state.status === 'signed-out') {
      return { ...methods, status: 'signed-out', profile: null };
    }

    return { ...methods, status: 'loading', profile: null };
  }, [state, error, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
