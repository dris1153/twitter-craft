import { describe, beforeEach, expect, it } from 'vitest';
import { parseTweet } from '@/lib/tweet-parser';

describe('tweet-parser edge cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects hasMedia true for video tweets (without mediaUrls)', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@testuser</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet with video</div>
        <div data-testid="videoPlayer"></div>
        <a href="/testuser/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/testuser/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet).toBeTruthy();
    expect(tweet?.hasMedia).toBe(true);
    expect(tweet?.mediaUrls).toEqual([]); // No actual media URLs
  });

  it('detects hasMedia for both images and videos', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@testuser</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Mixed media</div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/photo.jpg" alt="A photo" /></div>
        <div data-testid="videoComponent"></div>
        <a href="/testuser/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/testuser/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.hasMedia).toBe(true);
    expect(tweet?.mediaUrls).toHaveLength(1);
  });

  it('handles handle with underscores', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@test_user_name</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet text</div>
        <a href="/test_user_name/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/test_user_name/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.authorHandle).toBe('test_user_name');
    expect(tweet?.url).toContain('test_user_name');
  });

  it('parses status URL with /photo/1 suffix', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@user</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet</div>
        <a href="/user/status/1234567890/photo/1"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/user/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.id).toBe('1234567890');
    expect(tweet?.authorHandle).toBe('user');
  });

  it('rejects handle that exceeds 15 characters', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@verylonghandlename</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet</div>
        <a href="/verylonghandlename/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/verylonghandlename/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    // Should return null if handle exceeds 15 chars in URL regex
    expect(tweet).toBeNull();
  });

  it('handles 15-character handle exactly', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@verylonghandle1</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet</div>
        <a href="/verylonghandle1/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/verylonghandle1/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.authorHandle).toBe('verylonghandle1');
  });

  it('filters out generic image alt text', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@user</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet with images</div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/1.jpg" alt="Image" /></div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/2.jpg" alt="Hình ảnh" /></div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/3.jpg" alt="Specific description" /></div>
        <a href="/user/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/user/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.mediaAlt).toEqual(['Specific description']);
  });

  it('caps mediaUrls at 4 even if more exist', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a><span>@user</span></a>
        </div>
        <div data-testid="tweetText" lang="en">Tweet</div>
        ${Array(6)
          .fill(0)
          .map((_, i) => `<div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/${i}.jpg" alt="photo ${i}" /></div>`)
          .join('')}
        <a href="/user/status/1234567890"><time datetime="2026-09-25T12:00:00Z"></time></a>
        <div data-testid="reply"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="retweet"><span data-testid="app-text-transition-container">0</span></div>
        <div data-testid="like"><span data-testid="app-text-transition-container">0</span></div>
        <a href="/user/status/1234567890/analytics"><span data-testid="app-text-transition-container">0</span></a>
      </article>
    `;

    const article = document.querySelector('article')!;
    const tweet = parseTweet(article);

    expect(tweet?.mediaUrls).toHaveLength(4);
  });
});
