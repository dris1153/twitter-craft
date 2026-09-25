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
