import { act, renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftSession } from '@/hooks/use-draft-session';
import * as generator from '@/lib/draft-generator';
import type { PendingAction } from '@/lib/messages';
import { settingsItem } from '@/lib/settings-store';
import { SettingsSchema, type Draft, type Tweet } from '@/lib/types';

vi.mock('@/lib/draft-generator', async (original) => ({
  ...(await original<typeof import('@/lib/draft-generator')>()),
  generateDraft: vi.fn(),
}));
vi.mock('@/lib/panel-to-tab');
const generateDraft = vi.mocked(generator.generateDraft);

const tweet = (id: string): Tweet => ({
  id, url: `https://x.com/a/status/${id}`, authorHandle: 'a', authorName: 'A', isProtected: false,
  text: `tweet ${id}`, truncated: false, lang: 'en', originalLang: 'en', quoted: null, hasMedia: false,
  mediaUrls: [], mediaAlt: [], createdAt: '2026-09-25T00:00:00Z',
  metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
});
const action = (id: string): PendingAction => ({
  nonce: id, at: Date.now(), windowId: 1, tabId: 1, kind: 'draft', tweet: tweet(id), triage: null,
});
const draft = (text: string): Draft => ({ skipReason: null, replies: [{ angle: 'reaction', text }], quote: null });

describe('useDraftSession ordering', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    generateDraft.mockReset();
    await settingsItem.setValue(SettingsSchema.parse({ openaiKey: 'k' }));
  });

  it("never shows tweet A's slower draft under tweet B, and aborts A", async () => {
    let resolveA!: (d: Draft) => void;
    generateDraft
      .mockImplementationOnce(() => new Promise<Draft>((r) => (resolveA = r)))
      .mockImplementationOnce(async () => draft('reply for B'));

    const { result } = renderHook(() => useDraftSession());
    act(() => result.current.receive(action('100')));
    await waitFor(() => expect(generateDraft).toHaveBeenCalledTimes(1));
    act(() => result.current.receive(action('200')));
    await waitFor(() => expect(result.current.session?.status).toBe('ready'));

    await act(async () => resolveA(draft('reply for A')));

    expect(result.current.session?.tweet.id).toBe('200');
    expect(result.current.session?.variants[0]?.text).toBe('reply for B');
    expect(generateDraft.mock.calls[0]![2].aborted).toBe(true);
  });

  it('ignores a failure from a superseded request', async () => {
    let rejectA!: (e: Error) => void;
    generateDraft
      .mockImplementationOnce(() => new Promise<Draft>((_, reject) => (rejectA = reject)))
      .mockImplementationOnce(async () => draft('reply for B'));

    const { result } = renderHook(() => useDraftSession());
    act(() => result.current.receive(action('100')));
    await waitFor(() => expect(generateDraft).toHaveBeenCalledTimes(1));
    act(() => result.current.receive(action('200')));
    await waitFor(() => expect(result.current.session?.status).toBe('ready'));

    await act(async () => rejectA(Object.assign(new Error('aborted'), { name: 'AbortError' })));

    expect(result.current.session?.status).toBe('ready');
    expect(result.current.session?.tweet.id).toBe('200');
  });
});
