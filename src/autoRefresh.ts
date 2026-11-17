/**
 * Calls `refresh` every `intervalMs`, except on a tick where `isBusy()` says
 * the page holds something a refresh must not disturb. Returns a stop function.
 */
export function startAutoRefresh(refresh: () => void, intervalMs: number, isBusy: () => boolean): () => void {
  const timer = setInterval(() => {
    if (!isBusy()) refresh();
  }, intervalMs);
  return () => clearInterval(timer);
}
