import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePendingAction } from '@/hooks/use-pending-action';
import { pendingActionItem } from '@/lib/pending-action-store';
import type { PendingAction } from '@/lib/messages';

const makePendingAction = (overrides: Partial<PendingAction> = {}): PendingAction => ({
  nonce: 'nonce-1',
  at: Date.now(),
  windowId: 100,
  tabId: 1,
  kind: 'draft',
  tweet: {
    id: '1',
    url: 'https://x.com/a/status/1',
    authorHandle: 'a',
    authorName: 'A',
    isProtected: false,
    text: 'test',
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
  },
  triage: null,
  ...overrides,
});

describe('usePendingAction', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(browser.windows, 'getCurrent').mockResolvedValue({ id: 100 } as any);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onAction with pending action on mount if storage has one', async () => {
    const action = makePendingAction();
    const callback = vi.fn();

    await pendingActionItem.setValue(action);

    renderHook(() => usePendingAction(callback));

    await waitFor(() => expect(callback).toHaveBeenCalledWith(action));
    expect(await pendingActionItem.getValue()).toBeNull();
  });

  it('ignores action from different windowId', async () => {
    const action = makePendingAction({ windowId: 200 });
    const callback = vi.fn();

    await pendingActionItem.setValue(action);

    renderHook(() => usePendingAction(callback));

    await new Promise((r) => setTimeout(r, 100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores action older than 60 seconds', async () => {
    const action = makePendingAction({ at: Date.now() - 61_000 });
    const callback = vi.fn();

    await pendingActionItem.setValue(action);

    renderHook(() => usePendingAction(callback));

    await new Promise((r) => setTimeout(r, 100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('calls onAction when storage updates via watch', async () => {
    const callback = vi.fn();

    const { unmount } = renderHook(() => usePendingAction(callback));

    const action = makePendingAction();
    await pendingActionItem.setValue(action);

    await waitFor(() => expect(callback).toHaveBeenCalledWith(action));
    unmount();
  });

  it('handles each nonce only once', async () => {
    const callback = vi.fn();
    const action = makePendingAction({ nonce: 'nonce-1' });

    const { unmount } = renderHook(() => usePendingAction(callback));

    await pendingActionItem.setValue(action);
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    await pendingActionItem.setValue(action);
    await new Promise((r) => setTimeout(r, 100));
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('clears storage after handling', async () => {
    const callback = vi.fn();
    const action = makePendingAction();

    renderHook(() => usePendingAction(callback));

    await pendingActionItem.setValue(action);
    await waitFor(() => expect(callback).toHaveBeenCalled());
    expect(await pendingActionItem.getValue()).toBeNull();
  });

  it('does not fire callback after unmount', async () => {
    const callback = vi.fn();

    const { unmount } = renderHook(() => usePendingAction(callback));
    unmount();

    const action = makePendingAction();
    await pendingActionItem.setValue(action);

    await new Promise((r) => setTimeout(r, 100));
    expect(callback).not.toHaveBeenCalled();
  });

  it('handles action just under 60s old', async () => {
    const callback = vi.fn();
    const action = makePendingAction({ at: Date.now() - 59_500 });

    renderHook(() => usePendingAction(callback));

    await pendingActionItem.setValue(action);
    await waitFor(() => expect(callback).toHaveBeenCalled());
  });
});
