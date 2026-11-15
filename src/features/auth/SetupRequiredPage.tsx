import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';

type SetupRequiredPageProps = {
  missing?: string[];
};

export function SetupRequiredPage({ missing }: SetupRequiredPageProps) {
  return (
    <main className="bg-paper flex min-h-screen items-center justify-center px-5 py-10">
      <section className="border-line bg-surface w-full max-w-md border p-6">
        <BrandMark className="size-12" title="J.J.A Motor Accessories and Motorcycle Repair" />
        <h1 className="font-display mt-6 text-3xl font-bold tracking-tight">Almost ready</h1>
        <p className="text-ink-soft mt-2 text-sm">
          The app needs its Supabase connection before it can sign anyone in.
        </p>

        <p className="mt-5 text-sm font-medium">Add these to `.env.local`:</p>
        <pre className="bg-ink text-paper mt-2 overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
          {'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...'}
        </pre>

        {missing && missing.length > 0 ? (
          <p className="text-danger mt-3 text-sm">Missing: {missing.join(', ')}</p>
        ) : null}

        <p className="text-steel mt-4 text-xs">Restart the dev server after saving the file.</p>
        <Button className="mt-6 w-full" size="touch" disabled>
          Waiting for configuration
        </Button>
      </section>
    </main>
  );
}
