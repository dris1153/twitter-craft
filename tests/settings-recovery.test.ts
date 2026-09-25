import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings } from '@/lib/settings-store';

describe('getSettings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns defaults when nothing is stored', async () => {
    expect((await getSettings()).draftModel).toBe('gpt-5.6-terra');
  });

  it('keeps valid fields (like API keys) when another stored field is invalid', async () => {
    await fakeBrowser.storage.local.set({
      settings: { jevKey: 'keep-me', openaiKey: 'sk-keep', maxReplyChars: 'not a number', minQuality: 500 },
    });
    const s = await getSettings();
    expect(s.jevKey).toBe('keep-me');
    expect(s.openaiKey).toBe('sk-keep');
    expect(s.maxReplyChars).toBe(280);
    expect(s.minQuality).toBe(40);
  });
});
