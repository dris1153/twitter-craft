import { describe, expect, it } from 'vitest';
import { fromForm, toForm } from '@/lib/settings-form';
import { SettingsSchema } from '@/lib/types';

describe('settings form', () => {
  it('round-trips settings', () => {
    const settings = SettingsSchema.parse({
      handle: 'me',
      voiceSamples: ['first sample', 'second\nmulti-line sample'],
      projects: [{ name: 'twitter-craft', description: 'X assistant', url: 'https://github.com/me/tc' }],
    });
    expect(fromForm(toForm(settings))).toEqual(settings);
  });

  it('normalizes user input', () => {
    const form = toForm(SettingsSchema.parse({}));
    const s = fromForm({ ...form, handle: '@me', projects: 'solo | desc' });
    expect(s.handle).toBe('me');
    expect(s.projects).toEqual([{ name: 'solo', description: 'desc', url: '' }]);
  });

  it('rejects out-of-range and blank numbers', () => {
    const form = toForm(SettingsSchema.parse({}));
    expect(() => fromForm({ ...form, maxReplyChars: '10' })).toThrow();
    expect(() => fromForm({ ...form, minQuality: '  ' })).toThrow();
  });

  it('keeps "|" inside project descriptions', () => {
    const project = { name: 'p', description: 'CLI | MCP server', url: 'https://example.com' };
    const settings = SettingsSchema.parse({ projects: [project] });
    expect(fromForm(toForm(settings)).projects).toEqual([project]);
  });
});
