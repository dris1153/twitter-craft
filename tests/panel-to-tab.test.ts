import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expandInTab, insertIntoTab } from '@/lib/panel-to-tab';
import { TweetSchema, type Tweet } from '@/lib/types';

describe('insertIntoTab', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue('inserted' as any);
    vi.spyOn(browser.tabs, 'update').mockResolvedValue({} as any);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns InsertResult when sendMessage succeeds', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue('inserted' as any);

    const result = await insertIntoTab(1, '123', 'reply', 'hello');

    expect(result).toBe('inserted');
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'insert-draft',
      statusId: '123',
      mode: 'reply',
      text: 'hello',
    });
  });

  it('returns "no_content_script" when sendMessage rejects', async () => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(new Error('no receiver'));

    const result = await insertIntoTab(1, '123', 'reply', 'hello');

    expect(result).toBe('no_content_script');
  });

  it('returns "no_content_script" when sendMessage resolves undefined', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined as any);

    const result = await insertIntoTab(1, '123', 'reply', 'hello');

    expect(result).toBe('no_content_script');
  });

  it('activates the tab before sending message', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue('inserted' as any);

    await insertIntoTab(1, '123', 'quote', 'hello');

    expect(browser.tabs.update).toHaveBeenCalledWith(1, { active: true });
  });

  it('continues even if tab.update fails', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue('inserted' as any);
    vi.mocked(browser.tabs.update).mockRejectedValue(new Error('no such tab'));

    const result = await insertIntoTab(1, '123', 'reply', 'hello');

    expect(result).toBe('inserted');
  });
});

describe('expandInTab', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue({} as any);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed Tweet on valid payload', async () => {
    const mockTweet: Tweet = {
      id: '456',
      url: 'https://x.com/user/status/456',
      authorHandle: 'user',
      authorName: 'User',
      isProtected: false,
      text: 'full text',
      truncated: false,
      lang: 'en',
      originalLang: 'en',
      quoted: null,
      hasMedia: false,
      mediaUrls: [],
      mediaAlt: [],
      createdAt: '2026-09-25T00:00:00Z',
      metrics: { replies: 0, reposts: 0, likes: 0, views: 0 },
      isReply: false,
      isAd: false,
    };

    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(mockTweet as any);

    const result = await expandInTab(1, '456');

    expect(result).toEqual(mockTweet);
  });

  it('returns null on timeout (resolves null after 2.5s)', async () => {
    vi.mocked(browser.tabs.sendMessage).mockImplementation(() => new Promise(() => {}));

    const result = await expandInTab(1, '456');

    expect(result).toBeNull();
  });

  it('returns null on invalid payload (schema validation fails)', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue({ id: 123 } as any);

    const result = await expandInTab(1, '456');

    expect(result).toBeNull();
  });

  it('returns null when sendMessage throws', async () => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(new Error('content script error'));

    const result = await expandInTab(1, '456');

    expect(result).toBeNull();
  });

  it('sends expand-tweet message with correct statusId', async () => {
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(null as any);

    await expandInTab(1, '789');

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'expand-tweet',
      statusId: '789',
    });
  });
});
