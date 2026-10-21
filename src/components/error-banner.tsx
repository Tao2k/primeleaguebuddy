export function ErrorBanner({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = searchParams.error;
  if (typeof error !== "string") return null;
  return <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>;
}
