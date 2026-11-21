import { Navigate, Outlet } from 'react-router';

import { FullPageLoading } from '@/components/FullPageLoading';
import { useAuth } from '@/features/auth/use-auth';

export function RequireStaff() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
