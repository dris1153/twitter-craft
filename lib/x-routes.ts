import type { Tweet } from './types';

// Top-level x.com paths that look like @handles but are app pages.
const RESERVED = new Set([
  'home', 'search', 'explore', 'notifications', 'messages', 'settings', 'compose', 'i', 'bookmarks',
  'jobs', 'communities', 'premium', 'account', 'login', 'logout', 'tos', 'privacy',
]);

// Triage only feeds the spec allows: home, lists, search, profiles, status pages.
export function isTriageRoute(pathname: string): boolean {
  if (/^\/(home|search)\/?$/.test(pathname) || /^\/i\/lists\/\d+\/?$/.test(pathname)) return true;
  const [, handle] = pathname.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(?:status\/\d+.*|with_replies|media|highlights))?\/?$/) ?? [];
  return !!handle && !RESERVED.has(handle.toLowerCase());
}

export type TriageMode = 'triage' | 'manual' | 'skip';
type ModeInput = Pick<Tweet, 'id' | 'authorHandle' | 'isAd' | 'isProtected' | 'quoted'>;

// Anchored: /status/{id}/quotes is a list of other people's posts and is scored like any feed.
const STATUS_PATH = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/;
const MEDIA_VIEWER = /\/status\/\d+\/(?:photo|video)\/\d+/;

// Modals change the URL while the page underneath stays mounted: the reply/quote composer
// (/compose/post) and the media viewer. Badges must not be re-evaluated for them.
export const isOverlayRoute = (pathname: string): boolean => !isTriageRoute(pathname) || MEDIA_VIEWER.test(pathname);

// Changes whenever the post being viewed changes, so badges get re-evaluated after SPA navigation.
export const routeKey = (pathname: string): string => pathname.match(STATUS_PATH)?.[2] ?? '';

// On a post's own page only the post and its author's thread are scored; other people's replies
// get Draft/Idea only (no Jev call). Everywhere else every post is scored.
export function triageMode(tweet: ModeInput, pathname: string): TriageMode {
  if (tweet.isAd || tweet.isProtected || tweet.quoted?.isProtected) return 'skip';
  const [, handle = '', statusId] = pathname.match(STATUS_PATH) ?? [];
  if (!statusId) return 'triage';
  return tweet.id === statusId || tweet.authorHandle.toLowerCase() === handle.toLowerCase() ? 'triage' : 'manual';
}
