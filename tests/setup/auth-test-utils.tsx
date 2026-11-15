import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import type { Profile } from '@/types/domain';

export const ownerProfile: Profile = {
  id: 'user-owner',
  employeeId: 'JJA-001',
  displayName: 'Dad',
  role: 'owner',
};

export const mechanicProfile: Profile = {
  id: 'user-mechanic',
  employeeId: 'JJA-002',
  displayName: 'Uncle',
  role: 'mechanic',
};

export function signedInValue(profile: Profile = ownerProfile): AuthContextValue {
  return {
    status: 'signed-in',
    profile,
    error: null,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => {}),
  };
}

export function signedOutValue(): AuthContextValue {
  return {
    status: 'signed-out',
    profile: null,
    error: null,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => {}),
  };
}

export function loadingValue(): AuthContextValue {
  return {
    status: 'loading',
    profile: null,
    error: null,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => {}),
  };
}

type AuthTestProviderProps = {
  value: AuthContextValue;
  children: ReactNode;
};

export function AuthTestProvider({ value, children }: AuthTestProviderProps) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
