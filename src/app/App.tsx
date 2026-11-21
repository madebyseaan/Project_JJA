import { RouterProvider } from 'react-router';

import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { SetupRequiredPage } from '@/features/auth/SetupRequiredPage';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
import { isSupabaseConfigured } from '@/lib/supabase';

import { AppProviders } from './providers';
import { router } from './router';

function missingVariables(): string[] {
  const missing: string[] = [];

  if (!import.meta.env.VITE_SUPABASE_URL) {
    missing.push('VITE_SUPABASE_URL');
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }

  return missing;
}

export function App() {
  if (!isSupabaseConfigured) {
    return <SetupRequiredPage missing={missingVariables()} />;
  }

  return (
    <AppProviders>
      <AuthProvider>
        <RouterProvider router={router} />
        <UpdatePrompt />
        <Toaster />
      </AuthProvider>
    </AppProviders>
  );
}
