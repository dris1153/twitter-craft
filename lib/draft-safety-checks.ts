import type { Card, Project, Triage, Tweet } from './types';

export type DraftWarning = 'url' | 'handle' | 'bait' | 'too_long';

const SCHEME_OR_WWW = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const BARE_DOMAIN = /\b(?:[a-z0-9-]+\.)+([a-z]{2,24})\b(?:\/[^\s<>"')\]]*)?/gi;
// "package.json", "Next.js" etc. look like domains but are file names.
const FILE_EXTENSIONS = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'md', 'rs', 'go', 'rb', 'json', 'txt', 'yml', 'yaml', 'toml', 'lock', 'css', 'html', 'env', 'sql']);
const HANDLE = /@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/g;

export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]!.replace(/[.,;:!?]+$/, '').toLowerCase();
}

const LINK = new RegExp(`${SCHEME_OR_WWW.source}|${BARE_DOMAIN.source}`, 'gi');

// Link-like substrings in order (scheme/www links, or bare domains that are not file names).
export function linksIn(text: string): { url: string; index: number }[] {
  return [...text.matchAll(LINK)]
    .filter((m) => m[1] === undefined || !FILE_EXTENSIONS.has(m[1].toLowerCase()))
    .map((m) => ({ url: m[0], index: m.index! }));
}

export function hostsIn(text: string): string[] {
  return linksIn(text).map((l) => hostOf(l.url)).filter(Boolean);
}

const normalizeUrl = (u: string) => u.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();

// By URL prefix, not host: a project at github.com/me/proj must not vouch for github.com/evil/malware.
export function isProjectUrl(url: string, projectUrls: string[]): boolean {
  const u = normalizeUrl(url);
  return projectUrls
    .map((p) => normalizeUrl(p).replace(/\/+$/, ''))
    .filter(Boolean)
    .some((base) => u === base || u.startsWith(`${base}/`) || u.startsWith(`${base}?`) || u.startsWith(`${base}#`));
}

// Model output may carry links or mentions planted by the post (prompt injection); flag them for a human look.
export function checkDraft(
  text: string,
  ctx: { tweet: Tweet; triage: Triage | null; projects: Project[]; maxChars: number },
): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const source = `${ctx.tweet.text} ${ctx.tweet.quoted?.text ?? ''}`;
  const sourceHosts = new Set(hostsIn(source));
  const projectUrls = ctx.projects.map((p) => p.url);
  if (linksIn(text).some((l) => !sourceHosts.has(hostOf(l.url)) && !isProjectUrl(l.url, projectUrls))) {
    warnings.push('url');
  }

  const allowedHandles = new Set(
    [ctx.tweet.authorHandle, ctx.tweet.quoted?.authorHandle ?? '', ...[...source.matchAll(HANDLE)].map((m) => m[1]!)]
      .map((h) => h.toLowerCase()),
  );
  if ([...text.matchAll(HANDLE)].some((m) => !allowedHandles.has(m[1]!.toLowerCase()))) warnings.push('handle');

  if ((ctx.triage?.botInstructions ?? 0) > 0.5) warnings.push('bait');
  // ponytail: code-point count; X counts some chars (emoji, many Vietnamese letters) as 2. Fine with Premium limits.
  if ([...text].length > ctx.maxChars) warnings.push('too_long');
  return warnings;
}

// Card text is model output too, and it gets attached as an image: same planted-link/handle checks.
export function checkCard(card: Card, ctx: { tweet: Tweet; projects: Project[] }): DraftWarning[] {
  const text = [card.title, ...card.bullets, card.code, card.columns.a, card.columns.b, ...card.rows.flatMap((r) => [r.label, r.a, r.b])];
  return checkDraft(text.join('\n'), { ...ctx, triage: null, maxChars: Infinity }).filter((w) => w === 'url' || w === 'handle');
}
