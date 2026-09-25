import type { Triage, Tweet } from './types';

// ponytail: fixed thresholds; move to settings if they need tuning per feed.
const HOT_LIKES_PER_MIN = 5;
const IDEA_MIN = 0.6;

// Priority ranks reply-worthiness; ideas for the TODO list are a separate signal and must never be dimmed away.
export function isIdeaWorthy(triage: Triage): boolean {
  return triage.buildIdea >= IDEA_MIN && triage.botInstructions <= 0.5;
}

// A bonus, never a penalty: "For you" is mostly hours old, and a good post stays worth reading.
export function freshnessBonus(ageMinutes: number): number {
  if (ageMinutes < 60) return 0.1;
  if (ageMinutes < 360) return 0.05;
  return 0;
}

// Computed at render time (not cached) so the bonus keeps decaying while the cached Jev answers stay valid.
export function computePriority(triage: Triage, tweet: Pick<Tweet, 'createdAt' | 'metrics'>, now = Date.now()): number {
  const created = Date.parse(tweet.createdAt);
  const ageMin = Number.isFinite(created) ? Math.max(0, (now - created) / 60_000) : Infinity;
  const hot = ageMin > 0 && ageMin !== Infinity && tweet.metrics.likes / ageMin > HOT_LIKES_PER_MIN ? 0.05 : 0;
  const score = 0.75 * triage.quality + 0.25 * triage.replyOpening + freshnessBonus(ageMin) + hot;
  return Math.round(100 * Math.min(1, Math.max(0, score)));
}
