import type { SupabaseClient } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/use-auth';
import type { Role } from '@/types/domain';

type ProfileRow = {
  id: string;
  employee_id: string;
  display_name: string;
  role: Role;
};

type MockOptions = {
  session?: { user: { id: string } } | null;
  profile?: ProfileRow | null;
  profileError?: { message: string } | null;
  signInError?: { message: string; status?: number } | null;
};

function createMockClient(options: MockOptions = {}) {
  const { session = null, profile = null, profileError = null, signInError = null } = options;

  const maybeSingle = vi.fn(async () => ({ data: profile, error: profileError }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  const unsubscribe = vi.fn();
  const signOut = vi.fn(async () => ({ error: null }));
  const signInWithPassword = vi.fn(async () => ({
    data: { user: null, session: null },
    error: signInError,
  }));
  const getSession = vi.fn(async () => ({ data: { session }, error: null }));
  const onAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe } },
  }));

  const client = {
    auth: { getSession, onAuthStateChange, signInWithPassword, signOut },
    from,
  } as unknown as SupabaseClient;

  return { client, signOut, signInWithPassword };
}

function wrapperFor(client: SupabaseClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider client={client}>{children}</AuthProvider>;
  };
}

test('loads the profile for an existing session', async () => {
  const { client } = createMockClient({
    session: { user: { id: 'user-1' } },
    profile: {
      id: 'user-1',
      employee_id: 'JJA-001',
      display_name: 'Dad',
      role: 'owner',
    },
  });

  const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });

  await waitFor(() => {
    expect(result.current.status).toBe('signed-in');
  });

  expect(result.current.profile).toEqual({
    id: 'user-1',
    employeeId: 'JJA-001',
    displayName: 'Dad',
    role: 'owner',
  });
});

test('becomes signed out without a session', async () => {
  const { client } = createMockClient();

  const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });

  await waitFor(() => {
    expect(result.current.status).toBe('signed-out');
  });
});

test('signs out when the auth user has no profile', async () => {
  const { client, signOut } = createMockClient({
    session: { user: { id: 'user-1' } },
    profile: null,
  });

  const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });

  await waitFor(() => {
    expect(result.current.status).toBe('signed-out');
  });

  expect(result.current.error).toMatch(/no staff profile/i);
  expect(signOut).toHaveBeenCalled();
});

test('maps invalid credentials to a clear error', async () => {
  const { client, signInWithPassword } = createMockClient({
    signInError: { message: 'Invalid login credentials', status: 400 },
  });

  const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });

  await waitFor(() => {
    expect(result.current.status).toBe('signed-out');
  });

  await act(async () => {
    await expect(result.current.signIn('JJA-001', 'wrong')).rejects.toMatchObject({
      code: 'AUTH_INVALID',
      message: 'The employee ID or password is incorrect.',
    });
  });

  expect(signInWithPassword).toHaveBeenCalledWith({
    email: 'jja-001@staff.jja.internal',
    password: 'wrong',
  });
});

test('clears the profile on sign out', async () => {
  const { client } = createMockClient({
    session: { user: { id: 'user-1' } },
    profile: {
      id: 'user-1',
      employee_id: 'JJA-001',
      display_name: 'Dad',
      role: 'owner',
    },
  });

  const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(client) });

  await waitFor(() => {
    expect(result.current.status).toBe('signed-in');
  });

  await act(async () => {
    await result.current.signOut();
  });

  expect(result.current.status).toBe('signed-out');
  expect(result.current.profile).toBeNull();
});
