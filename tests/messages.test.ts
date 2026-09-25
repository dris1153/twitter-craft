import { describe, expect, it } from 'vitest';
import { ContentMessageSchema } from '@/lib/messages';

describe('ContentMessageSchema validation', () => {
  const validTweet = {
    id: '1234567890',
    url: 'https://x.com/user/status/1234567890',
    authorHandle: 'user',
    authorName: 'User Name',
    isProtected: false,
    text: 'Hello',
    truncated: false,
    lang: 'en',
    quoted: null,
    hasMedia: false,
    mediaUrls: [],
    mediaAlt: [],
    createdAt: '2026-09-25T12:00:00Z',
    metrics: { replies: 0, reposts: 0, likes: 0, views: 0 },
    isReply: false,
    isAd: false,
  };

  it('accepts valid triage message', () => {
    const msg = { type: 'triage', tweet: validTweet };
    expect(() => ContentMessageSchema.parse(msg)).not.toThrow();
  });

  it('accepts valid get-prefs message', () => {
    const msg = { type: 'get-prefs' };
    expect(() => ContentMessageSchema.parse(msg)).not.toThrow();
  });

  it('rejects message with bad status id (letters)', () => {
    const msg = { type: 'triage', tweet: { ...validTweet, id: 'abc' } };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('rejects message with oversized status id (>25 digits)', () => {
    const msg = { type: 'triage', tweet: { ...validTweet, id: '12345678901234567890123456' } };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('rejects non-pbs mediaUrls', () => {
    const msg = {
      type: 'triage',
      tweet: { ...validTweet, mediaUrls: ['https://example.com/image.jpg'] },
    };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('rejects >4 media', () => {
    const msg = {
      type: 'triage',
      tweet: {
        ...validTweet,
        mediaUrls: Array(5)
          .fill(0)
          .map((_, i) => `https://pbs.twimg.com/media/${i}`),
      },
    };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('rejects oversized text (>30k chars)', () => {
    const msg = {
      type: 'triage',
      tweet: { ...validTweet, text: 'x'.repeat(30001) },
    };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('rejects unknown message type', () => {
    const msg = { type: 'unknown', tweet: validTweet };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('accepts 4 media items', () => {
    const msg = {
      type: 'triage',
      tweet: {
        ...validTweet,
        mediaUrls: Array(4)
          .fill(0)
          .map((_, i) => `https://pbs.twimg.com/media/${i}`),
      },
    };
    expect(() => ContentMessageSchema.parse(msg)).not.toThrow();
  });

  it('rejects quoted tweet with oversized text', () => {
    const msg = {
      type: 'triage',
      tweet: {
        ...validTweet,
        quoted: { authorHandle: 'user', text: 'x'.repeat(30001), isProtected: false },
      },
    };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });

  it('accepts valid open-panel message', () => {
    const msg = {
      type: 'open-panel',
      kind: 'draft',
      tweet: validTweet,
      triage: null,
    };
    expect(() => ContentMessageSchema.parse(msg)).not.toThrow();
  });

  it('rejects open-panel with invalid kind', () => {
    const msg = {
      type: 'open-panel',
      kind: 'unknown',
      tweet: validTweet,
      triage: null,
    };
    expect(() => ContentMessageSchema.parse(msg)).toThrow();
  });
});
