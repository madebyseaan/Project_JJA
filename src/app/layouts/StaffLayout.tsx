import { Outlet } from 'react-router';

import { BrandMark } from '@/components/BrandMark';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { usePinLock } from '@/features/auth/use-pin-lock';
import { useOnlineStatus } from '@/hooks/use-online-status';

import { AppNav } from '../AppNav';

export function StaffLayout() {
  const { profile, signOut } = useAuth();
  const { lock } = usePinLock();
  const online = useOnlineStatus();

  if (!profile) {
    return null;
  }

  return (
    <div className="bg-paper min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-line bg-surface hidden border-r md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="border-line flex items-center gap-3 border-b px-4 py-4">
          <BrandMark className="size-10" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-bold">J.J.A</p>
            <p className="text-steel truncate text-xs">Motor Accessories &amp; Repair</p>
          </div>
        </div>

        <AppNav role={profile.role} variant="rail" className="px-2 py-4" />

        <div className="border-line mt-auto border-t px-4 py-4">
          <p className="text-steel text-xs">Signed in as</p>
          <p className="mt-1 truncate font-semibold" title={profile.displayName}>
            {profile.displayName}
          </p>
          <p className="text-steel mt-0.5 font-mono text-xs">{profile.employeeId}</p>
          <ConnectionStatus online={online} className="mt-3" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="touch" className="w-full px-2" onClick={lock}>
              Lock
            </Button>
            <Button
              variant="outline"
              size="touch"
              className="w-full px-2"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col md:min-h-screen">
        <header className="border-line bg-surface sticky top-0 z-30 border-b md:hidden">
          <div className="flex items-center gap-3 px-4 py-2">
            <BrandMark className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-lg leading-tight font-bold">J.J.A</p>
              <p className="text-steel truncate text-xs" title={profile.displayName}>
                {profile.displayName}
              </p>
            </div>
            <ConnectionStatus online={online} className="shrink-0" />
            <Button variant="outline" size="touch" className="shrink-0" onClick={lock}>
              Lock
            </Button>
          </div>
        </header>

        <OfflineBanner online={online} />

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-8">
          <Outlet />
        </main>

        <AppNav role={profile.role} variant="tabs" className="md:hidden" />
      </div>
    </div>
  );
}
