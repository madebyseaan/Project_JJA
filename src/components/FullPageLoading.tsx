import { BrandMark } from '@/components/BrandMark';
import { Skeleton } from '@/components/ui/skeleton';

export function FullPageLoading() {
  return (
    <main className="bg-paper flex min-h-screen items-center justify-center px-6">
      {/* <output> is for form results and cannot contain the skeleton blocks. */}
      <div className="flex flex-col items-center gap-6" role="status" aria-label="Loading">
        <BrandMark className="size-12" title="Motor Works" />
        <div className="w-full max-w-xs space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <span className="sr-only">Loading</span>
      </div>
    </main>
  );
}
