import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDraftSession } from '@/hooks/use-draft-session';
import { settingsItem } from '@/lib/settings-store';
import { SettingsSchema, type Tweet, type Triage } from '@/lib/types';
import type { PendingAction } from '@/lib/messages';

vi.mock('@/lib/draft-generator');
vi.mock('@/lib/panel-to-tab');

import * as draftGeneratorModule from '@/lib/draft-generator';
import * as panelToTabModule from '@/lib/panel-to-tab';

const mockGenerateDraft = vi.mocked(draftGeneratorModule.generateDraft);
const mockExpandInTab = vi.mocked(panelToTabModule.expandInTab);

const tweet: Tweet = {
  id: '1', url: 'https://x.com/a/status/1', authorHandle: 'a', authorName: 'A', isProtected: false,
  text: 'test tweet', truncated: false, lang: 'en', originalLang: 'en', quoted: null, hasMedia: false,
  mediaUrls: [], mediaAlt: [], createdAt: '2026-09-25T00:00:00Z',
  metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
};

const triage: Triage = {
  id: '1', quality: 0.5, action: 'reply', topic: 'llm_agents', replyOpening: 0.5,
  projectMatch: 'none', buildIdea: 0, botInstructions: 0, uncertain: false,
};

const makePendingAction = (overrides: Partial<PendingAction> = {}): PendingAction => ({
  nonce: 'nonce-1',
  at: Date.now(),
  windowId: 1,
  tabId: 1,
  kind: 'draft',
  tweet,
  triage,
  ...overrides,
});

describe('useDraftSession', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.clearAllMocks();
    await settingsItem.setValue(SettingsSchema.parse({ openaiKey: 'test' }));
    mockGenerateDraft.mockResolvedValue({
      skipReason: null,
      replies: [{ angle: 'reaction', text: 'Nice point' }],
      quote: null,
    });
  });

  it('starts with null session and transitions loading→ready on receive', async () => {
    const { result } = renderHook(() => useDraftSession());
    expect(result.current.session).toBeNull();

    const action = makePendingAction({ tweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('ready'));
    expect(result.current.session?.variants).toHaveLength(1);
  });

  it('sets error status with message on generateDraft failure', async () => {
    mockGenerateDraft.mockRejectedValue(new Error('API error'));
    vi.mocked(draftGeneratorModule.draftErrorText).mockImplementation((err: any) => {
      if (err instanceof Error) return err.message;
      return String(err);
    });

    const { result } = renderHook(() => useDraftSession());
    const action = makePendingAction({ tweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('error'));
    expect(result.current.session?.error).toBe('API error');
  });

  it('receive queues action if session.edited is true', async () => {
    const { result } = renderHook(() => useDraftSession());

    const action1 = makePendingAction({ tweet, triage, tabId: 1 });
    result.current.receive(action1);
    await waitFor(() => expect(result.current.session?.status).toBe('ready'));

    result.current.update(0, { text: 'modified' });
    await waitFor(() => expect(result.current.session?.edited).toBe(true));

    const newTweet = { ...tweet, id: '2', text: 'different' };
    const action2 = makePendingAction({ tweet: newTweet, triage, tabId: 2 });
    result.current.receive(action2);

    await waitFor(() => expect(result.current.queued).not.toBeNull());
    expect(result.current.queued?.tweet.id).toBe('2');
  });

  it('receive runs immediately if session.edited is false', async () => {
    const { result } = renderHook(() => useDraftSession());

    const action1 = makePendingAction({ tweet, triage, tabId: 1 });
    result.current.receive(action1);
    await waitFor(() => expect(result.current.session?.status).toBe('ready'));

    const newTweet = { ...tweet, id: '2', text: 'different' };
    const action2 = makePendingAction({ tweet: newTweet, triage, tabId: 2 });
    result.current.receive(action2);

    await waitFor(() => expect(result.current.session?.tweet.id).toBe('2'));
    expect(result.current.queued).toBeNull();
  });

  it('acceptQueued runs the queued action', async () => {
    const { result } = renderHook(() => useDraftSession());

    const action1 = makePendingAction({ tweet, triage, tabId: 1 });
    result.current.receive(action1);
    await waitFor(() => expect(result.current.session?.status).toBe('ready'));

    result.current.update(0, { text: 'modified' });
    await waitFor(() => expect(result.current.session?.edited).toBe(true));

    const newTweet = { ...tweet, id: '2', text: 'different' };
    const action2 = makePendingAction({ tweet: newTweet, triage, tabId: 2 });
    result.current.receive(action2);

    await waitFor(() => expect(result.current.queued?.tweet.id).toBe('2'));

    result.current.acceptQueued();
    await waitFor(() => expect(result.current.session?.tweet.id).toBe('2'));
    expect(result.current.queued).toBeNull();
  });

  it('truncated tweet uses expanded tweet when ids match', async () => {
    const truncatedTweet = { ...tweet, id: '1', truncated: true };
    const expandedTweet = { ...tweet, id: '1', text: 'full text here' };

    mockExpandInTab.mockResolvedValue(expandedTweet);

    const { result } = renderHook(() => useDraftSession());
    const action = makePendingAction({ tweet: truncatedTweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('ready'));
    expect(result.current.session?.tweet.text).toBe('full text here');
    expect(result.current.session?.note).toBeNull();
  });

  it('sets note when expansion fails for truncated tweet', async () => {
    const truncatedTweet = { ...tweet, id: '1', truncated: true };
    mockExpandInTab.mockResolvedValue(null);

    const { result } = renderHook(() => useDraftSession());
    const action = makePendingAction({ tweet: truncatedTweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('ready'));
    expect(result.current.session?.note).toMatch(/Could not expand/);
  });

  it('uses original truncated tweet text if expanded id does not match', async () => {
    const truncatedTweet = { ...tweet, id: '1', text: 'truncated text', truncated: true };
    const expandedTweet = { ...tweet, id: '999', text: 'wrong id' };

    mockExpandInTab.mockResolvedValue(expandedTweet);

    const { result } = renderHook(() => useDraftSession());
    const action = makePendingAction({ tweet: truncatedTweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('ready'));
    expect(result.current.session?.tweet.text).toBe('truncated text');
    expect(result.current.session?.note).toMatch(/Could not expand/);
  });

  it('uses original if expansion returns still-truncated tweet', async () => {
    const truncatedTweet = { ...tweet, id: '1', text: 'still short', truncated: true };
    const stillTruncated = { ...tweet, id: '1', truncated: true };

    mockExpandInTab.mockResolvedValue(stillTruncated);

    const { result } = renderHook(() => useDraftSession());
    const action = makePendingAction({ tweet: truncatedTweet, triage, tabId: 1 });
    result.current.receive(action);

    await waitFor(() => expect(result.current.session?.status).toBe('ready'));
    expect(result.current.session?.tweet.text).toBe('still short');
    expect(result.current.session?.note).toMatch(/Could not expand/);
  });
});
