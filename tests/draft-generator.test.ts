import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissingKeyError } from '@/lib/ai-models';
import { draftErrorText, generateDraft } from '@/lib/draft-generator';
import { settingsItem } from '@/lib/settings-store';
import { SettingsSchema, type Tweet } from '@/lib/types';

// Runs the real AI SDK + OpenAI provider; only the network is stubbed.
const tweet: Tweet = {
  id: '7', url: 'https://x.com/a/status/7', authorHandle: 'a', authorName: 'A', isProtected: false,
  text: 'Our agent eval suite caught 3 regressions this week', truncated: false, lang: 'en', originalLang: 'en',
  quoted: null, hasMedia: true, mediaUrls: ['https://pbs.twimg.com/media/X.jpg'], mediaAlt: [],
  createdAt: '2026-09-25T00:00:00Z', metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
};

const draftJson = {
  skipReason: null,
  replies: [
    { angle: 'reaction', text: '  Regressions cluster around tool schemas in my experience  ' },
    { angle: 'question', text: 'Do you gate merges on it?' },
    { angle: 'take', text: 'Pin the judge model version.' },
    { angle: 'reaction', text: 'extra one the model should not have sent' },
  ],
  quote: '',
};

const openaiResponse = (text: string) =>
  new Response(
    JSON.stringify({
      id: 'resp_1', created_at: 1, model: 'gpt-5.6-terra',
      output: [{ type: 'message', role: 'assistant', id: 'msg_1', content: [{ type: 'output_text', text, annotations: [] }] }],
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('generateDraft', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await settingsItem.setValue(SettingsSchema.parse({ openaiKey: 'sk-test' }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks for strict structured output with the images and trims the result', async () => {
    const fetch = vi.fn().mockResolvedValue(openaiResponse(JSON.stringify(draftJson)));
    vi.stubGlobal('fetch', fetch);

    const draft = await generateDraft(tweet, null, new AbortController().signal);

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-5.6-terra');
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(JSON.stringify(body.text.format.schema)).not.toMatch(/prefixItems/);
    expect(JSON.stringify(body.input)).toContain('https://pbs.twimg.com/media/X.jpg');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-test');
    expect(body.store).toBe(false);

    expect(draft.replies).toHaveLength(3);
    expect(draft.replies[0]!.text).toBe('Regressions cluster around tool schemas in my experience');
    expect(draft.quote).toBeNull();
  });

  it('never sends protected or promoted posts', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(generateDraft({ ...tweet, isProtected: true }, null, signal)).rejects.toThrow(/never sent/);
    await expect(generateDraft({ ...tweet, quoted: { authorHandle: 'p', text: 'x', isProtected: true } }, null, signal)).rejects.toThrow();
    await expect(generateDraft({ ...tweet, isAd: true }, null, signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails fast without a key', async () => {
    await settingsItem.setValue(SettingsSchema.parse({}));
    await expect(generateDraft(tweet, null, new AbortController().signal)).rejects.toBeInstanceOf(MissingKeyError);
  });
});

describe('draftErrorText', () => {
  it('explains common failures', () => {
    expect(draftErrorText(new MissingKeyError())).toMatch(/key is missing/);
    expect(draftErrorText({ statusCode: 401 })).toMatch(/401/);
    expect(draftErrorText({ lastError: { statusCode: 429 } })).toMatch(/429/);
    expect(draftErrorText(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toMatch(/Timed out/);
  });
});
