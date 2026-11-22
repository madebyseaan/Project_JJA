import { Download } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router';

import { AppNav } from '@/app/AppNav';
import { BrandMark } from '@/components/BrandMark';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { FullPageLoading } from '@/components/FullPageLoading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { usePinLock } from '@/features/auth/use-pin-lock';
import { InstallAppDialog } from '@/features/pwa/InstallAppDialog';
import { useInstallPrompt } from '@/features/pwa/use-install-prompt';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function StaffLayout() {
  const auth = useAuth();
  const { lock } = usePinLock();
  const online = useOnlineStatus();
  const install = useInstallPrompt();
  const [installOpen, setInstallOpen] = useState(false);

  // RequireStaff owns redirects; this is a defensive frame, never a blank screen.
  if (auth.status !== 'signed-in') {
    return <FullPageLoading />;
  }

  const { profile, signOut } = auth;

  return (
    <div className="bg-paper flex h-[100dvh] flex-col overflow-hidden md:grid md:h-auto md:min-h-[100dvh] md:grid-cols-[220px_minmax(0,1fr)] md:overflow-visible">
      <aside className="border-line bg-surface hidden border-r md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="border-line flex items-center gap-3 border-b px-4 py-4">
          <BrandMark className="size-10" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-bold">J.J.A</p>
            <p className="text-steel truncate text-xs">Motor Accessories &amp; Repair</p>
          </div>
        </div>

        <AppNav variant="rail" className="px-2 py-4" />

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
          {!install.installed ? (
            <Button
              variant="outline"
              size="touch"
              className="mt-2 w-full"
              onClick={() => setInstallOpen(true)}
            >
              <Download aria-hidden="true" />
              Install app
            </Button>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0">
          <header className="border-line bg-surface border-b pt-[env(safe-area-inset-top)] md:hidden">
            <div className="flex items-center gap-3 px-4 py-2">
              <BrandMark className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-lg leading-tight font-bold">J.J.A</p>
                <p className="text-steel truncate text-xs" title={profile.displayName}>
                  {profile.displayName}
                </p>
              </div>
              <ConnectionStatus online={online} className="shrink-0" />
              {!install.installed ? (
                <Button
                  variant="outline"
                  size="touch"
                  className="w-12 shrink-0 px-0"
                  aria-label="Install app"
                  onClick={() => setInstallOpen(true)}
                >
                  <Download className="size-5" aria-hidden="true" />
                </Button>
              ) : null}
              <Button variant="outline" size="touch" className="shrink-0" onClick={lock}>
                Lock
              </Button>
            </div>
          </header>

          <OfflineBanner online={online} />
        </div>

        <main className="mx-auto min-h-0 w-full max-w-[1280px] flex-1 overflow-y-auto px-4 pt-6 pb-4 md:overflow-visible md:px-8 md:pt-8 md:pb-8">
          <Outlet />
        </main>

        <AppNav variant="tabs" className="md:hidden" />
      </div>

      <InstallAppDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        canPrompt={install.canPrompt}
        installed={install.installed}
        isIos={install.isIos}
        isAndroid={install.isAndroid}
        onInstall={install.promptInstall}
      />
    </div>
  );
}
