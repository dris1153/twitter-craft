import { storage } from 'wxt/utils/storage';
import { triageWithJev } from './jev-triage';
import { getSettings, triageSettingsHash } from './settings-store';
import type { Settings, Triage, TriageError, Tweet } from './types';

export type TriageOutcome = { ok: true; triage: Triage } | { ok: false; error: TriageError };
type Job = { tweet: Tweet; key: CacheKey; settings: Settings; resolve: (o: TriageOutcome) => void };
type CacheKey = `session:${string}`;

const MAX_CONCURRENT = 4;
const MAX_QUEUED = 20;
const RATE_LIMIT_PAUSE_MS = 30_000;
const BAD_KEY_PAUSE_MS = 60_000;

// The SW can be stopped mid-pause; persist the pause so a restart doesn't hammer Jev again.
const pausedUntilItem = storage.defineItem<number>('session:triagePausedUntil', { fallback: 0 });

// ponytail: queue lives in SW memory; if the SW stops, content scripts retry on the next view.
const stack: Job[] = [];
const inflight = new Map<CacheKey, Promise<TriageOutcome>>();
let active = 0;
let pausedUntil = 0;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;
const restored = pausedUntilItem.getValue().then((v) => (pausedUntil = Math.max(pausedUntil, v)));

export async function triage(tweet: Tweet): Promise<TriageOutcome> {
  await restored;
  const settings = await getSettings();
  if (!settings.jevKey) return { ok: false, error: 'no_key' };
  const key: CacheKey = `session:triage:${triageSettingsHash(settings)}:${tweet.id}`;
  const cached = await storage.getItem<Triage>(key);
  if (cached) return { ok: true, triage: cached };
  const existing = inflight.get(key);
  if (existing) return existing;

  const outcome = new Promise<TriageOutcome>((resolve) => {
    stack.push({ tweet, key, settings, resolve });
    // LIFO with a cap: fast scrolling keeps only the tweets the user is looking at now.
    while (stack.length > MAX_QUEUED) stack.shift()!.resolve({ ok: false, error: 'dropped' });
    pump();
  }).finally(() => inflight.delete(key));
  inflight.set(key, outcome);
  return outcome;
}

function pump(): void {
  const wait = pausedUntil - Date.now();
  if (wait > 0) {
    pauseTimer ??= setTimeout(() => {
      pauseTimer = undefined;
      pump();
    }, wait);
    return;
  }
  while (active < MAX_CONCURRENT && stack.length > 0) {
    const job = stack.pop()!;
    active++;
    void run(job).finally(() => {
      active--;
      pump();
    });
  }
}

function pause(ms: number): void {
  pausedUntil = Math.max(pausedUntil, Date.now() + ms);
  void pausedUntilItem.setValue(pausedUntil).catch(() => {});
}

async function run(job: Job): Promise<void> {
  let result: Triage;
  try {
    result = await triageWithJev(job.tweet, job.settings, AbortSignal.timeout(15_000));
  } catch (err) {
    // Errors are never cached, so the tweet is retried the next time it is in view.
    const api = apiErrorOf(err);
    if (api?.statusCode === 429 || api?.statusCode === 529) {
      pause(retryAfterMs(api.responseHeaders));
      job.resolve({ ok: false, error: 'rate_limited' });
    } else if (api?.statusCode === 401 || api?.statusCode === 403) {
      pause(BAD_KEY_PAUSE_MS);
      job.resolve({ ok: false, error: 'no_key' });
    } else {
      console.warn('[twitter-craft] triage failed', job.tweet.id, err);
      job.resolve({ ok: false, error: 'http' });
    }
    return;
  }
  if (job.settings.debug) console.log('[twitter-craft] triage', job.tweet.url, job.tweet.text.slice(0, 80), result);
  job.resolve({ ok: true, triage: result });
  // A failed cache write (e.g. session quota) must not throw away an answer we already paid for.
  await storage.setItem(job.key, result).catch((err) => console.warn('[twitter-craft] cache write failed', err));
}

type ApiErrorLike = { statusCode?: number; responseHeaders?: Record<string, string> };

function apiErrorOf(err: unknown): ApiErrorLike | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if ('statusCode' in err) return err as ApiErrorLike;
  return 'lastError' in err ? apiErrorOf((err as { lastError: unknown }).lastError) : undefined;
}

function retryAfterMs(headers: Record<string, string> | undefined): number {
  const ms = Number(headers?.['retry-after-ms']);
  const seconds = Number(headers?.['retry-after']);
  const value = ms > 0 ? ms : seconds > 0 ? seconds * 1000 : RATE_LIMIT_PAUSE_MS;
  return Math.min(value, 300_000);
}
