import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Triage, Tweet } from '@/lib/types';
import { SettingsSchema } from '@/lib/types';

const triageWithJev = vi.fn();
vi.mock('@/lib/jev-triage', () => ({ triageWithJev: (...args: unknown[]) => triageWithJev(...args) }));

const tweet = (id: string): Tweet => ({
  id, url: `https://x.com/a/status/${id}`, authorHandle: 'a', authorName: 'A', isProtected: false,
  text: `tweet ${id}`, truncated: false, lang: 'en', originalLang: 'en', quoted: null, hasMedia: false, mediaUrls: [], mediaAlt: [],
  createdAt: '2026-09-25T00:00:00Z', metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
});
const result = (id: string): Triage => ({
  id, quality: 0.5, action: 'reply', topic: 'ai_ml', replyOpening: 0.5,
  projectMatch: 'none', buildIdea: 0, botInstructions: 0, uncertain: false,
});
const deferred = () => {
  let resolve!: (v: Triage) => void;
  const promise = new Promise<Triage>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

async function loadQueue(jevKey = 'k') {
  vi.resetModules(); // fresh module state (stack, pause) per test
  const { settingsItem } = await import('@/lib/settings-store');
  await settingsItem.setValue(SettingsSchema.parse({ jevKey }));
  return import('@/lib/triage-queue');
}

describe('triage queue', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    triageWithJev.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('returns no_key without calling Jev', async () => {
    const { triage } = await loadQueue('');
    expect(await triage(tweet('1'))).toEqual({ ok: false, error: 'no_key' });
    expect(triageWithJev).not.toHaveBeenCalled();
  });

  it('caches successes', async () => {
    const { triage } = await loadQueue();
    triageWithJev.mockImplementation(async (t: Tweet) => result(t.id));
    expect(await triage(tweet('1'))).toEqual({ ok: true, triage: result('1') });
    expect(await triage(tweet('1'))).toEqual({ ok: true, triage: result('1') });
    expect(triageWithJev).toHaveBeenCalledTimes(1);
  });

  it('never caches errors', async () => {
    const { triage } = await loadQueue();
    triageWithJev.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    triageWithJev.mockResolvedValueOnce(result('1'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await triage(tweet('1'))).toEqual({ ok: false, error: 'http' });
    expect(await triage(tweet('1'))).toEqual({ ok: true, triage: result('1') });
    expect(triageWithJev).toHaveBeenCalledTimes(2);
  });

  it('maps 401 wrapped in a RetryError to no_key', async () => {
    const { triage } = await loadQueue();
    triageWithJev.mockRejectedValueOnce({ lastError: { statusCode: 401 } });
    expect(await triage(tweet('1'))).toEqual({ ok: false, error: 'no_key' });
  });

  it('dedupes concurrent requests for the same tweet', async () => {
    const { triage } = await loadQueue();
    const d = deferred();
    triageWithJev.mockReturnValue(d.promise);
    const a = triage(tweet('1'));
    const b = triage(tweet('1'));
    await tick();
    d.resolve(result('1'));
    expect(await a).toEqual(await b);
    expect(triageWithJev).toHaveBeenCalledTimes(1);
  });

  it('pauses the whole queue on 429 and honors retry-after', async () => {
    const { triage } = await loadQueue();
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    triageWithJev.mockRejectedValueOnce({ statusCode: 429, responseHeaders: { 'retry-after': '10' } });
    const first = triage(tweet('1'));
    await vi.advanceTimersByTimeAsync(0);
    expect(await first).toEqual({ ok: false, error: 'rate_limited' });

    triageWithJev.mockResolvedValue(result('2'));
    const second = triage(tweet('2'));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(triageWithJev).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await second).toEqual({ ok: true, triage: result('2') });
  });

  it('prefers retry-after-ms and persists the pause across SW restarts', async () => {
    const { triage } = await loadQueue();
    triageWithJev.mockRejectedValueOnce({ statusCode: 429, responseHeaders: { 'retry-after-ms': '45000' } });
    expect(await triage(tweet('1'))).toEqual({ ok: false, error: 'rate_limited' });
    const { storage } = await import('wxt/utils/storage');
    const until = await storage.getItem<number>('session:triagePausedUntil');
    expect(until! - Date.now()).toBeGreaterThan(40_000);

    // Simulated SW restart: fresh module state, same session storage.
    vi.resetModules();
    const restarted = await import('@/lib/triage-queue');
    triageWithJev.mockResolvedValue(result('2'));
    void restarted.triage(tweet('2'));
    await tick();
    expect(triageWithJev).toHaveBeenCalledTimes(1);
  });

  it('pauses after an invalid key instead of failing every tweet', async () => {
    const { triage } = await loadQueue();
    triageWithJev.mockRejectedValueOnce({ statusCode: 401 });
    expect(await triage(tweet('1'))).toEqual({ ok: false, error: 'no_key' });
    void triage(tweet('2'));
    await tick();
    expect(triageWithJev).toHaveBeenCalledTimes(1);
  });

  it('keeps a paid answer when the cache write fails', async () => {
    const { triage } = await loadQueue();
    const { storage } = await import('wxt/utils/storage');
    vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    triageWithJev.mockResolvedValue(result('1'));
    expect(await triage(tweet('1'))).toEqual({ ok: true, triage: result('1') });
  });

  it('runs newest first and drops the oldest beyond the queue cap', async () => {
    const { triage } = await loadQueue();
    const pending = new Map<string, ReturnType<typeof deferred>>();
    triageWithJev.mockImplementation((t: Tweet) => {
      const d = deferred();
      pending.set(t.id, d);
      return d.promise;
    });
    const outcomes: Promise<unknown>[] = [];
    for (let i = 0; i < 25; i++) {
      outcomes.push(triage(tweet(String(i))));
      await tick(); // keep push order deterministic
    }
    // 4 running (0-3), 21 queued (4-24) with cap 20 → tweet 4 dropped.
    expect(triageWithJev).toHaveBeenCalledTimes(4);
    expect(await outcomes[4]).toEqual({ ok: false, error: 'dropped' });

    pending.get('0')!.resolve(result('0'));
    await tick();
    const lastCall = triageWithJev.mock.calls.at(-1)![0] as Tweet;
    expect(lastCall.id).toBe('24');
  });
});
