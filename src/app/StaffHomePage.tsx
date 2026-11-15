import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { usePinLock } from '@/features/auth/use-pin-lock';

export function StaffHomePage() {
  const { profile, signOut } = useAuth();
  const { lock } = usePinLock();

  if (!profile) {
    return null;
  }

  const roleLabel = profile.role === 'owner' ? 'Owner' : 'Mechanic';

  return (
    <main className="bg-paper min-h-screen">
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="size-10" />
            <div className="min-w-0">
              <p className="font-display truncate text-lg leading-tight font-bold">J.J.A</p>
              <p className="text-steel truncate text-xs">Motor Accessories &amp; Repair</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="touch" onClick={lock}>
              Lock
            </Button>
            <Button variant="outline" size="touch" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-steel text-sm">Signed in as</p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight">
          {profile.displayName}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="border-line bg-soft inline-flex border px-2.5 py-1 text-xs font-semibold">
            {roleLabel}
          </span>
          <span className="text-steel font-mono text-xs">{profile.employeeId}</span>
        </div>
        <p className="text-ink-soft mt-6 max-w-md">
          The bay, inventory, and receipts arrive in the next steps. This screen proves the login
          and role.
        </p>
      </section>
    </main>
  );
}
