import { isProjectUrl } from './draft-safety-checks';
import { IDEA_STATUSES, X_STATUS_URL, type Idea } from './types';

// Idea text is partly written by strangers (source post) or shaped by them (model output). Opening the
// file in a Markdown viewer must not load remote content or show clickable stranger links, so every
// field is escaped and only x.com status links and the user's own project links stay clickable.

const MD_SPECIAL = /[\\`*_[\]|~#!]/g;
// Stricter than the draft check on purpose: any scheme, emails (mailto autolinks), and bare domains even
// when they look like file names (.md/.py/.rs are real TLDs that viewers like markdown-it linkify).
const LINKISH =
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>]+|\bwww\.[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[a-z]{2,}|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}\b(?:\/[^\s<>]*)?/gi;

function escapeText(s: string): string {
  return s.replace(MD_SPECIAL, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function codeSpan(s: string): string {
  const longest = Math.max(0, ...(s.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence} ${s} ${fence}`;
}

function inline(raw: string, projectUrls: string[]): string {
  // Any line break (\r too) could start a heading, list item or code block.
  const text = raw.replace(/\s+/g, ' ').trim();
  let out = '';
  let last = 0;
  for (const m of text.matchAll(LINKISH)) {
    const url = m[0];
    out += escapeText(text.slice(last, m.index));
    const clickable = /^https:\/\//i.test(url) && (isProjectUrl(url, projectUrls) || X_STATUS_URL.test(url));
    out += clickable ? `<${url}>` : codeSpan(url);
    last = m.index + url.length;
  }
  return out + escapeText(text.slice(last));
}

function fenced(s: string): string {
  const longest = Math.max(0, ...(s.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${s}\n${fence}`;
}

function ideaSection(idea: Idea, projectUrls: string[]): string {
  const t = (s: string) => inline(s, projectUrls);
  const source = X_STATUS_URL.test(idea.sourceUrl)
    ? `[${escapeText(`@${idea.sourceAuthor}`)}](${idea.sourceUrl})`
    : codeSpan(idea.sourceUrl);
  const lines = [
    `### ${t(idea.title) || 'Untitled idea'}`,
    `Status: ${idea.status} · Saved: ${idea.createdAt.slice(0, 10)} · Source: ${source}` +
      (idea.tags.length ? ` · Tags: ${idea.tags.map(t).join(', ')}` : ''),
    `**Problem:** ${t(idea.problem)}`,
    `**Insight:** ${t(idea.insight)}`,
    idea.stack.length ? `**Stack:** ${idea.stack.map(t).join(', ')}` : '',
    idea.promo ? `**Share it:** ${t(idea.promo)}` : '',
    idea.mvpScope.length ? `**MVP**\n\n${idea.mvpScope.map((step) => `- [ ] ${t(step)}`).join('\n')}` : '',
    idea.notes.trim() ? `**Notes:** ${t(idea.notes)}` : '',
    idea.sourceText.trim() ? `Source post:\n\n${fenced(idea.sourceText)}` : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

export function ideasToMarkdown(ideas: Idea[], projectUrls: string[], now = new Date()): string {
  const parts = [`# twitter-craft ideas`, `Exported ${now.toISOString().slice(0, 10)} · ${ideas.length} ideas`];
  for (const status of IDEA_STATUSES) {
    const group = ideas.filter((i) => i.status === status);
    if (group.length === 0) continue;
    parts.push(`## ${status[0]!.toUpperCase()}${status.slice(1)} (${group.length})`);
    parts.push(...group.map((i) => ideaSection(i, projectUrls)));
  }
  return `${parts.join('\n\n')}\n`;
}
