import type { Project, Triage, Tweet } from './types';

export type DraftWarning = 'url' | 'handle' | 'bait' | 'too_long';

export const WARNING_TEXT: Record<DraftWarning, string> = {
  url: 'Contains a link that is not in the post or your projects',
  handle: 'Mentions an @handle that is not in the post',
  bait: 'The post looks like it tries to steer AI replies',
  too_long: 'Longer than your max reply length',
};

const SCHEME_OR_WWW = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const BARE_DOMAIN = /\b(?:[a-z0-9-]+\.)+([a-z]{2,24})\b(?:\/[^\s<>"')\]]*)?/gi;
// "package.json", "Next.js" etc. look like domains but are file names.
const FILE_EXTENSIONS = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'md', 'rs', 'go', 'rb', 'json', 'txt', 'yml', 'yaml', 'toml', 'lock', 'css', 'html', 'env', 'sql']);
const HANDLE = /@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/g;

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]!.replace(/[.,;:!?]+$/, '').toLowerCase();
}

export function hostsIn(text: string): string[] {
  const withScheme = [...text.matchAll(SCHEME_OR_WWW)].map((m) => m[0]);
  const bare = [...text.matchAll(BARE_DOMAIN)].filter((m) => !FILE_EXTENSIONS.has(m[1]!.toLowerCase())).map((m) => m[0]);
  return [...withScheme, ...bare].map(hostOf).filter(Boolean);
}

// Model output may carry links or mentions planted by the post (prompt injection); flag them for a human look.
export function checkDraft(
  text: string,
  ctx: { tweet: Tweet; triage: Triage | null; projects: Project[]; maxChars: number },
): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const source = `${ctx.tweet.text} ${ctx.tweet.quoted?.text ?? ''}`;
  const allowedHosts = new Set([...hostsIn(source), ...ctx.projects.flatMap((p) => hostsIn(p.url))]);
  if (hostsIn(text).some((h) => !allowedHosts.has(h))) warnings.push('url');

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
