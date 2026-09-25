import { describe, expect, it } from 'vitest';
import { buildState } from '@/lib/jev-triage';
import type { Tweet } from '@/lib/types';

describe('jev-triage buildState', () => {
  it('builds state with all fields from tweet', () => {
    const tweet: Tweet = {
      id: '123',
      url: 'https://x.com/user/status/123',
      authorHandle: 'testuser',
      authorName: 'Test User',
      isProtected: false,
      text: 'Tweet text content',
      truncated: false,
      lang: 'en',
      quoted: { authorHandle: 'other', text: 'quoted text', isProtected: false },
      hasMedia: true,
      mediaUrls: ['https://pbs.twimg.com/media/1.jpg'],
      mediaAlt: ['A photo'],
      createdAt: '2026-09-25T12:00:00Z',
      metrics: { replies: 5, reposts: 10, likes: 100, views: 1000 },
      isReply: true,
      isAd: false,
    };

    const state = buildState(tweet);

    expect(state).toEqual({
      author: '@testuser',
      text: 'Tweet text content',
      quoted_text: 'quoted text',
      has_media: true,
      media_alt: ['A photo'],
      is_reply: true,
      lang: 'en',
    });
  });

  it('handles null quoted text', () => {
    const tweet: Tweet = {
      id: '123',
      url: 'https://x.com/user/status/123',
      authorHandle: 'testuser',
      authorName: 'Test User',
      isProtected: false,
      text: 'Tweet text',
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

    const state = buildState(tweet);

    expect(state.quoted_text).toBeNull();
  });

  it('prefixes @ to the author handle', () => {
    const tweet: Tweet = {
      id: '123',
      url: 'https://x.com/testuser/status/123',
      authorHandle: 'testuser',
      authorName: 'Test User',
      isProtected: false,
      text: 'Text',
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

    const state = buildState(tweet);

    expect(state.author).toBe('@testuser');
    expect(state.author.startsWith('@')).toBe(true);
  });
});
