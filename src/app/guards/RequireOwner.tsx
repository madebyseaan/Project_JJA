import { Navigate, Outlet } from 'react-router';

import { FullPageLoading } from '@/components/FullPageLoading';
import { useAuth } from '@/features/auth/use-auth';

export function RequireOwner() {
  const { status, profile } = useAuth();

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'owner') {
    return <Navigate to="/bay" replace />;
  }

  return <Outlet />;
}
