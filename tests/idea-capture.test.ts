import { act, renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdeaCapture } from '@/hooks/use-idea-capture';
import { buildIdeaInstructions, expandIdea } from '@/lib/idea-expander';
import { addIdea, listIdeas } from '@/lib/ideas-store';
import { settingsItem } from '@/lib/settings-store';
import { SettingsSchema, type IdeaDraft, type Tweet } from '@/lib/types';

const tweet: Tweet = {
  id: '42', url: 'https://x.com/fujin/status/42', authorHandle: 'fujin', authorName: 'Fujin', isProtected: false,
  text: 'This prompt one-shots a motion graphics video. Prompt below', truncated: false, lang: 'vi', originalLang: 'ja',
  quoted: { authorHandle: 'shneural', text: 'gave both models the same prompt', isProtected: false }, hasMedia: true,
  mediaUrls: ['https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg'], mediaAlt: [], createdAt: '2026-09-25T00:00:00Z',
  metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
};
const draft: IdeaDraft = {
  title: 'Prompt-to-motion kit', problem: 'Devs want quick promo videos', insight: 'One prompt drives a motion template',
  mvpScope: [' record prompt ', '', 'render with Remotion'], stack: ['Remotion'], promo: 'Post the before/after',
  tags: ['Motion', 'prompts'],
};
const openaiResponse = (body: unknown) =>
  new Response(
    JSON.stringify({
      id: 'r', created_at: 1, model: 'gpt-5.6-luna', usage: { input_tokens: 1, output_tokens: 1 },
      output: [{ type: 'message', role: 'assistant', id: 'm', content: [{ type: 'output_text', text: JSON.stringify(body), annotations: [] }] }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

beforeEach(async () => {
  fakeBrowser.reset();
  await settingsItem.setValue(SettingsSchema.parse({ openaiKey: 'sk-test' }));
});
afterEach(() => vi.unstubAllGlobals());

describe('expandIdea (real SDK path, stubbed network)', () => {
  it('uses the idea model, writes in the idea language, cleans lists', async () => {
    const fetch = vi.fn().mockResolvedValue(openaiResponse(draft));
    vi.stubGlobal('fetch', fetch);
    const idea = await expandIdea(tweet, new AbortController().signal);

    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.model).toBe('gpt-5.6-luna');
    expect(body.store).toBe(false);
    expect(JSON.stringify(body.input)).toContain('amplify_video_thumb'); // video poster reaches the vision model
    expect(idea.mvpScope).toEqual(['record prompt', 'render with Remotion']);
    expect(idea.tags).toEqual(['motion', 'prompts']);
  });

  it('keeps the post out of the instructions and uses the configured language', () => {
    const text = buildIdeaInstructions(SettingsSchema.parse({ ideaLanguage: 'vi' }));
    expect(text).toContain('Write in Vietnamese');
    expect(text).not.toContain(tweet.text);
  });

  it('refuses protected posts', async () => {
    await expect(expandIdea({ ...tweet, isProtected: true }, new AbortController().signal)).rejects.toThrow(/never sent/);
  });
});

describe('useIdeaCapture', () => {
  it('expands, then saves a new idea linked to the source post', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openaiResponse(draft)));
    const { result } = renderHook(() => useIdeaCapture());
    await act(() => result.current.receive({ tweet, tabId: 1 }));
    await waitFor(() => expect(result.current.capture?.status).toBe('ready'));

    act(() => result.current.edit({ ...result.current.capture!.draft!, title: 'Edited title' }));
    await act(() => result.current.save());

    const [saved] = await listIdeas();
    expect(saved).toMatchObject({ title: 'Edited title', sourceStatusId: '42', sourceUrl: tweet.url, status: 'new' });
    expect(saved!.sourceText).toContain('Quoting @shneural');
    expect(result.current.capture).toBeNull();
  });

  it('queues a new capture instead of dropping edits, and switches on accept', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => openaiResponse(draft)));
    const { result } = renderHook(() => useIdeaCapture());
    await act(() => result.current.receive({ tweet, tabId: 1 }));
    await waitFor(() => expect(result.current.capture?.status).toBe('ready'));
    act(() => result.current.edit({ ...result.current.capture!.draft!, title: 'my edit' }));

    const other = { ...tweet, id: '77', url: 'https://x.com/fujin/status/77' };
    act(() => result.current.receive({ tweet: other, tabId: 1 }));
    expect(result.current.queued?.tweet.id).toBe('77');
    expect(result.current.capture?.draft?.title).toBe('my edit');

    await act(async () => result.current.acceptQueued());
    await waitFor(() => expect(result.current.capture?.tweet.id).toBe('77'));
  });

  it('reports a duplicate instead of calling the model again', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await addIdea({
      ...draft, id: 'old', sourceStatusId: '42', sourceUrl: tweet.url, sourceAuthor: 'fujin', sourceText: '',
      status: 'new', notes: '', createdAt: '2026-09-25T00:00:00Z',
    });
    const { result } = renderHook(() => useIdeaCapture());
    await act(() => result.current.receive({ tweet, tabId: 1 }));
    expect(result.current.capture).toMatchObject({ status: 'duplicate', existingId: 'old' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
