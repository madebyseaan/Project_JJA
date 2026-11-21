import { Navigate, Outlet } from 'react-router';

import { FullPageLoading } from '@/components/FullPageLoading';
import { useAuth } from '@/features/auth/use-auth';
import { usePinLock } from '@/features/auth/use-pin-lock';

export function RequireUnlocked() {
  const { status } = useAuth();
  const { unlocked } = usePinLock();

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />;
  }

  if (!unlocked) {
    return <Navigate to="/lock" replace />;
  }

  return <Outlet />;
}
