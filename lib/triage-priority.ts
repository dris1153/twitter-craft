import type { Triage, Tweet } from './types';

// ponytail: fixed velocity threshold; move to settings if it needs tuning per feed.
const HOT_LIKES_PER_MIN = 5;

export function freshness(ageMinutes: number): number {
  if (ageMinutes < 30) return 1;
  if (ageMinutes < 120) return 0.6;
  if (ageMinutes < 720) return 0.3;
  return 0;
}

// Computed at render time (not cached) so freshness keeps decaying while the cached Jev answers stay valid.
export function computePriority(triage: Triage, tweet: Pick<Tweet, 'createdAt' | 'metrics'>, now = Date.now()): number {
  const created = Date.parse(tweet.createdAt);
  const ageMin = Number.isFinite(created) ? Math.max(0, (now - created) / 60_000) : Infinity;
  const hot = ageMin > 0 && ageMin !== Infinity && tweet.metrics.likes / ageMin > HOT_LIKES_PER_MIN ? 0.1 : 0;
  const fresh = Math.min(1, freshness(ageMin) + hot);
  const score = 0.6 * triage.quality + 0.25 * triage.replyOpening + 0.15 * fresh;
  return Math.round(100 * Math.min(1, Math.max(0, score)));
}
