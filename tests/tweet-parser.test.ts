import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { isTopLevelTweet, parseTweet, quickStatusId } from '@/lib/tweet-parser';

function load(name: string): Element {
  document.body.innerHTML = readFileSync(join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8');
  return document.querySelector('article[data-testid="tweet"]')!;
}

describe('parseTweet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('parses a text-only tweet with emoji and Vietnamese-formatted counts', () => {
    const t = parseTweet(load('text-only'))!;
    expect(t).toMatchObject({
      id: '1839000000000000001',
      url: 'https://x.com/karpathy/status/1839000000000000001',
      authorHandle: 'karpathy',
      authorName: 'Andrej Karpathy',
      text: 'LLM agents need better evals 🔥 here is why',
      lang: 'en',
      createdAt: '2026-09-25T06:00:00.000Z',
      truncated: false,
      quoted: null,
      hasMedia: false,
      isAd: false,
      isProtected: false,
      isReply: false,
    });
    expect(t.metrics).toEqual({ replies: 12, reposts: 340, likes: 1200, views: 56000 });
  });

  it('keeps pbs.twimg.com media and drops generic alt text', () => {
    const t = parseTweet(load('with-image'))!;
    expect(t.mediaUrls).toHaveLength(2);
    expect(t.mediaUrls.every((u) => u.startsWith('https://pbs.twimg.com/'))).toBe(true);
    expect(t.mediaAlt).toEqual(['Biểu đồ so sánh latency']);
    expect(t.metrics).toMatchObject({ reposts: 1234, likes: 2_500_000 });
    expect(t.lang).toBe('vi');
  });

  it('separates the quoted post from the main post', () => {
    const t = parseTweet(load('quote-with-commentary'))!;
    expect(t.id).toBe('1839000000000000003');
    expect(t.text).toBe('This matches what we saw in prod');
    expect(t.createdAt).toBe('2026-09-25T05:00:00.000Z');
    expect(t.quoted).toEqual({ authorHandle: 'simonw', text: 'Prompt injection is still unsolved', isProtected: false });
    expect(t.mediaUrls).toEqual([]); // the image belongs to the quoted post
  });

  it('does not treat quoted text as the author text when there is no commentary', () => {
    const t = parseTweet(load('quote-without-commentary'))!;
    expect(t.authorHandle).toBe('bob');
    expect(t.text).toBe('');
    expect(t.quoted?.text).toBe("Carol's original post");
  });

  it('flags truncated long posts', () => {
    expect(parseTweet(load('truncated'))!.truncated).toBe(true);
  });

  it('flags ads labelled in Vietnamese', () => {
    expect(parseTweet(load('ad'))!.isAd).toBe(true);
  });

  it('flags protected authors and replies', () => {
    const t = parseTweet(load('protected-reply'))!;
    expect(t.isProtected).toBe(true);
    expect(t.isReply).toBe(true);
  });
});

describe('parseTweet on a real capture (Vietnamese UI, auto-translated quote tweet)', () => {
  it('keeps the author language behind X auto-translate and reads exact counts', () => {
    const t = parseTweet(load('translated-quote'))!;
    expect(t).toMatchObject({
      id: '2103140058434031831',
      authorHandle: 'BeamManP',
      authorName: 'ビームマンＰ ver40',
      lang: 'vi',
      originalLang: 'ja',
      createdAt: '2026-09-24T15:10:39.000Z',
      hasMedia: false, // the video belongs to the quoted post
      isAd: false,
      isProtected: false,
    });
    expect(t.text).toMatch(/^Nhưng cách diễn đạt/);
    expect(t.quoted?.text).toMatch(/^Vì noise của Carl/);
    expect(t.metrics).toEqual({ replies: 0, reposts: 11, likes: 161, views: 16989 });
  });

  it('uses the shown language when the post is not translated', () => {
    expect(parseTweet(load('text-only'))!.originalLang).toBe('en');
  });
});

describe('helpers', () => {
  it('quickStatusId ignores the quoted post', () => {
    expect(quickStatusId(load('quote-with-commentary'))).toBe('1839000000000000003');
  });

  it('isTopLevelTweet rejects nested articles', () => {
    document.body.innerHTML = '<article data-testid="tweet"><article data-testid="tweet"></article></article>';
    const [outer, inner] = document.querySelectorAll('article');
    expect(isTopLevelTweet(outer!)).toBe(true);
    expect(isTopLevelTweet(inner!)).toBe(false);
  });

  it('returns null without a status permalink', () => {
    document.body.innerHTML = '<article data-testid="tweet"><div data-testid="tweetText">x</div></article>';
    expect(parseTweet(document.querySelector('article')!)).toBeNull();
  });
});
