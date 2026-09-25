import { afterEach, describe, expect, it, vi } from 'vitest';
import { triageWithJev } from '@/lib/jev-triage';
import { SettingsSchema, type Tweet } from '@/lib/types';

// Exercises the real AI SDK + TypeSafe provider path with only the network stubbed.
const tweet: Tweet = {
  id: '42', url: 'https://x.com/a/status/42', authorHandle: 'a', authorName: 'A', isProtected: false,
  text: 'New eval harness for agents', truncated: false, lang: 'en', quoted: null, hasMedia: false,
  mediaUrls: [], mediaAlt: [], createdAt: '2026-09-25T00:00:00Z',
  metrics: { replies: 0, reposts: 0, likes: 0, views: 0 }, isReply: false, isAd: false,
};
const settings = SettingsSchema.parse({ jevKey: 'test-key', projects: [{ name: 'evalkit', description: 'agent evals', url: '' }] });

const choice = (options: string[], pick: string, confidence: number) => ({
  type: 'choice',
  choice: pick,
  probabilities: Object.fromEntries(options.map((o) => [o, o === pick ? 1 : 0])),
  confidence,
});

const apiResponse = {
  model: 'jev-1.13.0',
  answers: {
    quality: { type: 'score', score: 3, probabilities: { 0: 0, 1: 0, 2: 0.2, 3: 0.6, 4: 0.2 }, confidence: 0.8 },
    action: choice(['reply', 'quote', 'retweet', 'save_idea', 'skip'], 'reply', 0.9),
    topic: choice(['ai_ml', 'llm_agents', 'web_dev', 'devops_infra', 'languages', 'career', 'startup', 'off_topic'], 'llm_agents', 0.3),
    reply_opening: { type: 'noul', noul: 0.7 },
    project_match: choice(['none', 'project_0'], 'project_0', 0.4),
    build_idea: { type: 'noul', noul: 0.6 },
    bot_instructions: { type: 'noul', noul: 0.05 },
  },
  usage: { input_tokens: 900, output_tokens: 0 },
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('triageWithJev (real SDK path)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends noul questions to /v1/systemone and maps answers + confidence', async () => {
    const fetch = vi.fn().mockResolvedValue(json(apiResponse));
    vi.stubGlobal('fetch', fetch);

    const t = await triageWithJev(tweet, settings, AbortSignal.timeout(5000));

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('jev-latest');
    expect(body.questions.reply_opening.type).toBe('noul');
    expect(body.state.author).toBe('@a');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');

    expect(t).toMatchObject({ id: '42', quality: 0.75, action: 'reply', topic: 'llm_agents', projectMatch: 'evalkit', replyOpening: 0.7 });
    expect(t.uncertain).toBe(true); // project_match confidence 0.4; topic 0.3 is ignored
  });

  it('does not retry a 429 itself, so the queue can pause every slot', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ message: 'slow down' }, 429, { 'retry-after': '20' }));
    vi.stubGlobal('fetch', fetch);

    await expect(triageWithJev(tweet, settings, AbortSignal.timeout(5000))).rejects.toMatchObject({ statusCode: 429 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
