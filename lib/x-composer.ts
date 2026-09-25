import type { InsertMode, InsertResult, PanelMessage } from './messages';
import { findQuote, isTopLevelTweet, parseTweet, quickStatusId } from './tweet-parser';
import type { Tweet } from './types';
import { SEL } from './x-dom-selectors';
import { KEYWORDS } from './x-locale-keywords';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(find: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() >= end) return null;
    await sleep(100);
  }
}

export function isPanelMessage(raw: unknown): raw is PanelMessage {
  const m = raw as { type?: string; statusId?: unknown; mode?: unknown; text?: unknown } | null;
  if (!m || typeof m.statusId !== 'string' || !/^\d{1,25}$/.test(m.statusId)) return false;
  if (m.type === 'expand-tweet') return true;
  return m.type === 'insert-draft' && (m.mode === 'reply' || m.mode === 'quote') && typeof m.text === 'string' && m.text.length > 0;
}

// Exact id on a top-level article; a substring href match would also hit tweets that quote this one.
export function findArticleById(statusId: string): Element | null {
  return [...document.querySelectorAll(SEL.tweet)].find((a) => isTopLevelTweet(a) && quickStatusId(a) === statusId) ?? null;
}

function mainElement(article: Element, selector: string): HTMLElement | null {
  const quote = findQuote(article);
  return ([...article.querySelectorAll<HTMLElement>(selector)].find((el) => !quote?.contains(el)) ?? null);
}

const composerDialog = () => [...document.querySelectorAll(SEL.dialog)].find((d) => d.querySelector(SEL.composer)) ?? null;

function quoteMenuItem(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(SEL.quoteMenuItem) ??
    // Exact label: a substring match would also hit items like "View Quotes".
    [...document.querySelectorAll<HTMLElement>(SEL.menuItem)].find((el) =>
      (KEYWORDS.quoteMenu as readonly string[]).includes(el.textContent?.trim() ?? ''),
    ) ??
    null
  );
}

// Locale-agnostic: the reply/quote dialog shows the target's permalink or its @handle.
function targetsTweet(dialog: Element, statusId: string, handle: string): boolean {
  if (dialog.querySelector(`a[href$="/status/${statusId}"]`)) return true;
  // Boundary so @bob does not match @bobby.
  return !!handle && new RegExp(`@${handle}(?![A-Za-z0-9_])`, 'i').test(dialog.textContent ?? '');
}

const normalize = (s: string) => s.replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

// execCommand acts on whatever has focus; typing (or select-all + delete) anywhere else could hit
// the status page's inline reply box, i.e. another tweet, or wipe text the user was writing there.
const focused = (composer: HTMLElement) => composer.contains(document.activeElement);

async function typeInto(composer: HTMLElement, text: string): Promise<boolean> {
  composer.focus();
  if (!(await waitFor(() => focused(composer), 300))) return false;
  document.execCommand('insertText', false, text);
  await sleep(50);
  if (normalize(composer.innerText) === normalize(text)) return true;
  if (!focused(composer)) return false;
  // Draft.js can drop newlines on insertText; a plain-text paste keeps them.
  document.execCommand('selectAll');
  document.execCommand('delete');
  const data = new DataTransfer();
  data.setData('text/plain', text);
  composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  await sleep(50);
  return normalize(composer.innerText) === normalize(text);
}

const postEnabled = (dialog: Element) => {
  const b = dialog.querySelector<HTMLButtonElement>(SEL.postButton);
  return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null;
};

let busy = false;

// Opens X's own reply/quote dialog and types the draft. Never clicks Post.
// One at a time: two concurrent inserts would both wait for, and type into, the same dialog.
export async function insertDraft(statusId: string, mode: InsertMode, text: string): Promise<InsertResult> {
  if (busy || composerDialog()) return 'dialog_open';
  busy = true;
  try {
    return await openAndType(statusId, mode, text);
  } finally {
    busy = false;
  }
}

async function openAndType(statusId: string, mode: InsertMode, text: string): Promise<InsertResult> {
  const article = findArticleById(statusId);
  if (!article) return 'not_found';
  const handle = parseTweet(article)?.authorHandle ?? '';

  if (mode === 'reply') {
    mainElement(article, SEL.reply)?.click();
  } else {
    mainElement(article, SEL.repost)?.click();
    const item = await waitFor(quoteMenuItem, 2000);
    if (!item) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // close the repost menu
      return 'no_dialog';
    }
    item.click();
  }

  const dialog = await waitFor(composerDialog, 5000);
  if (!dialog) return 'no_dialog';
  if (!targetsTweet(dialog, statusId, handle)) return 'wrong_target';
  const composer = dialog.querySelector<HTMLElement>(SEL.composer);
  if (!composer || !(await typeInto(composer, text))) return 'insert_mismatch';
  return (await waitFor(() => postEnabled(dialog), 1000)) ? 'inserted' : 'insert_mismatch';
}

// Clicks X's inline "Show more" button (never a link, which would navigate), then re-parses.
export async function expandTweet(statusId: string): Promise<Tweet | null> {
  const article = findArticleById(statusId);
  if (!article) return null;
  const button = mainElement(article, SEL.showMore);
  if (button) {
    button.click();
    await waitFor(() => (mainElement(article, SEL.showMore) ? null : true), 1500);
  }
  return parseTweet(article);
}
