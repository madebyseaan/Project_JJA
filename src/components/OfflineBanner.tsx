type OfflineBannerProps = {
  online: boolean;
};

export function OfflineBanner({ online }: OfflineBannerProps) {
  if (online) {
    return null;
  }

  return (
    <output className="border-danger/30 bg-danger/10 text-danger block border-b px-4 py-2 text-center text-sm font-semibold">
      You are offline. Changes are disabled until the connection returns.
    </output>
  );
}
