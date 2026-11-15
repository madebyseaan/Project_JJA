import { BrandMark } from '@/components/BrandMark';

export function App() {
  return (
    <main className="bg-paper text-ink min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <BrandMark className="size-12" title="Motor Works" />
        <h1 className="font-display text-4xl font-bold tracking-tight">Motor Works POS</h1>
        <p className="text-ink-soft text-base">Shop operations, built for the bay.</p>
      </div>
    </main>
  );
}
