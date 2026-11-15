import { createContext } from 'react';

import type { AuthState } from '@/types/domain';

export type AuthContextValue = AuthState & {
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
