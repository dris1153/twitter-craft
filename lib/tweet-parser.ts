import type { Tweet } from './types';
import { SEL } from './x-dom-selectors';
import { KEYWORDS, parseCount, translatedFromLang } from './x-locale-keywords';

const STATUS_HREF = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})(?:\/|$|\?)/;

export function isTopLevelTweet(el: Element): boolean {
  return el.matches(SEL.tweet) && !el.parentElement?.closest(SEL.tweet);
}

export function findQuote(article: Element): Element | null {
  for (const el of article.querySelectorAll(SEL.quoteCandidate)) {
    if (el.querySelector(SEL.userName)) return el;
  }
  return null;
}

function outside(article: Element, quote: Element | null, selector: string): Element[] {
  return [...article.querySelectorAll(selector)].filter((el) => !quote?.contains(el));
}

// textContent drops emoji, which X renders as <img alt="…">.
export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
    else if (node instanceof HTMLImageElement) out += node.alt;
    else node.childNodes.forEach(walk);
  };
  walk(el);
  return out.trim();
}

function hasKeyword(values: readonly string[], text: string | null | undefined): boolean {
  return !!text && values.includes(text.trim());
}

function isProtected(scope: Element): boolean {
  const name = scope.querySelector(SEL.userName);
  if (!name) return false;
  if (name.querySelector(SEL.lockIcon)) return true;
  return [...name.querySelectorAll('[aria-label]')].some((el) =>
    hasKeyword(KEYWORDS.protectedLabel, el.getAttribute('aria-label')),
  );
}

function handleIn(scope: Element): string {
  const spans = scope.querySelector(SEL.userName)?.querySelectorAll('span') ?? [];
  const at = [...spans].map((s) => s.textContent?.trim() ?? '').find((t) => /^@\w{1,15}$/.test(t));
  return at ? at.slice(1) : '';
}

function permalink(article: Element, quote: Element | null) {
  for (const time of outside(article, quote, SEL.time)) {
    const href = time.closest('a')?.getAttribute('href') ?? '';
    const [, handle, id] = href.match(STATUS_HREF) ?? [];
    if (handle && id) return { handle, id, createdAt: time.getAttribute('datetime') ?? '' };
  }
  return null;
}

export function quickStatusId(article: Element): string | null {
  return permalink(article, findQuote(article))?.id ?? null;
}

function count(article: Element, quote: Element | null, selector: string): number {
  const el = outside(article, quote, selector)[0];
  // aria-label starts with the exact number ("16989 lượt xem…"); the visible text is rounded ("16 N").
  const exact = el?.getAttribute('aria-label')?.match(/^\s*(\d[\d.,]*)/)?.[1];
  return parseCount(exact ?? el?.querySelector(SEL.countText)?.textContent);
}

function originalLang(article: Element, quote: Element | null, shownLang: string): string {
  for (const span of outside(article, quote, 'span')) {
    const lang = translatedFromLang(span.textContent);
    if (lang) return lang;
  }
  return shownLang;
}

function isAd(article: Element): boolean {
  const text = article.querySelector(SEL.tweetText);
  return [...article.querySelectorAll('span')].some(
    (s) => !text?.contains(s) && hasKeyword(KEYWORDS.adLabel, s.textContent),
  );
}

function isReply(article: Element, quote: Element | null): boolean {
  return outside(article, quote, 'div').some((d) => {
    const first = d.firstChild;
    return first?.nodeType === Node.TEXT_NODE && KEYWORDS.replyingTo.some((k) => first.textContent?.trim().startsWith(k));
  });
}

export function parseTweet(article: Element): Tweet | null {
  const quote = findQuote(article);
  const link = permalink(article, quote);
  if (!link) return null;
  const textEl = outside(article, quote, SEL.tweetText)[0];
  const photos = outside(article, quote, SEL.photo) as HTMLImageElement[];
  const mediaUrls = photos.map((p) => p.src).filter((u) => u.startsWith('https://pbs.twimg.com/')).slice(0, 4);
  const mediaAlt = photos
    .map((p) => p.alt.trim())
    .filter((a) => a && !hasKeyword(KEYWORDS.genericImageAlt, a))
    .slice(0, 4);
  const lang = textEl?.getAttribute('lang') ?? 'und';

  return {
    id: link.id,
    url: `https://x.com/${link.handle}/status/${link.id}`,
    authorHandle: link.handle,
    authorName: textOf(article.querySelector(`${SEL.userName} a span`)),
    isProtected: isProtected(article),
    text: textOf(textEl),
    truncated: outside(article, quote, SEL.showMore).length > 0,
    lang,
    originalLang: originalLang(article, quote, lang),
    quoted: quote
      ? { authorHandle: handleIn(quote), text: textOf(quote.querySelector(SEL.tweetText)), isProtected: isProtected(quote) }
      : null,
    hasMedia: mediaUrls.length > 0 || outside(article, quote, SEL.video).length > 0,
    mediaUrls,
    mediaAlt,
    createdAt: link.createdAt,
    metrics: {
      replies: count(article, quote, SEL.reply),
      reposts: count(article, quote, SEL.repost),
      likes: count(article, quote, SEL.like),
      views: count(article, quote, SEL.viewsLink),
    },
    isReply: isReply(article, quote),
    isAd: isAd(article),
  };
}
