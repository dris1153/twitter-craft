export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polls instead of MutationObserver: X re-renders constantly and we only wait a few seconds at most.
export async function waitFor<T>(find: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() >= end) return null;
    await sleep(100);
  }
}
