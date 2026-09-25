import { describe, expect, it } from 'vitest';
import { triageSettingsHash, toDisplayPrefs } from '@/lib/settings-store';
import { SettingsSchema, type Settings } from '@/lib/types';

describe('settings-store functions', () => {
  describe('toDisplayPrefs', () => {
    it('extracts display preferences from full settings', () => {
      const settings = SettingsSchema.parse({
        handle: 'user',
        minQuality: 50,
        dimLowScore: false,
        debug: true,
        uiLanguage: 'vi',
      });

      const prefs = toDisplayPrefs(settings);

      expect(prefs).toEqual({
        minQuality: 50,
        dimLowScore: false,
        debug: true,
        uiLanguage: 'vi',
      });
    });

    it('omits non-display preferences', () => {
      const settings = SettingsSchema.parse({
        openaiKey: 'secret-key',
        jevKey: 'secret-jev',
        handle: 'user',
        persona: 'engineer',
        minQuality: 40,
        dimLowScore: true,
        debug: false,
      });

      const prefs = toDisplayPrefs(settings);

      expect(prefs).not.toHaveProperty('openaiKey');
      expect(prefs).not.toHaveProperty('jevKey');
      expect(prefs).not.toHaveProperty('handle');
      expect(prefs).not.toHaveProperty('persona');
      expect(prefs).toEqual({
        minQuality: 40,
        dimLowScore: true,
        debug: false,
        uiLanguage: settings.uiLanguage,
      });
    });

    it('uses defaults from SettingsSchema', () => {
      const settings = SettingsSchema.parse({});

      const prefs = toDisplayPrefs(settings);

      expect(prefs.minQuality).toBe(40);
      expect(prefs.dimLowScore).toBe(true);
      expect(prefs.debug).toBe(false);
    });
  });

  describe('triageSettingsHash', () => {
    it('changes when interests change', () => {
      const base = SettingsSchema.parse({ interests: ['AI'] });
      const modified = SettingsSchema.parse({ interests: ['AI', 'Web'] });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).not.toBe(hash2);
    });

    it('changes when projects change', () => {
      const base = SettingsSchema.parse({
        projects: [{ name: 'project-a', description: 'desc', url: '' }],
      });
      const modified = SettingsSchema.parse({
        projects: [
          { name: 'project-a', description: 'desc', url: '' },
          { name: 'project-b', description: 'desc', url: '' },
        ],
      });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).not.toBe(hash2);
    });

    it('does not change when non-triage settings change', () => {
      const base = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        handle: 'user1',
      });
      const modified = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        handle: 'user2', // Different handle, same triage settings
      });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).toBe(hash2);
    });

    it('does not change when API keys change', () => {
      const base = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        openaiKey: 'key1',
        jevKey: 'key1',
      });
      const modified = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        openaiKey: 'key2',
        jevKey: 'key2',
      });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).toBe(hash2);
    });

    it('does not change when persona or voiceSamples change', () => {
      const base = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        persona: 'engineer',
        voiceSamples: [],
      });
      const modified = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        persona: 'designer',
        voiceSamples: ['sample 1', 'sample 2'],
      });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).toBe(hash2);
    });

    it('does not change when display settings change', () => {
      const base = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        minQuality: 40,
        dimLowScore: true,
        debug: false,
      });
      const modified = SettingsSchema.parse({
        interests: ['AI'],
        projects: [],
        minQuality: 70,
        dimLowScore: false,
        debug: true,
      });

      const hash1 = triageSettingsHash(base);
      const hash2 = triageSettingsHash(modified);

      expect(hash1).toBe(hash2);
    });

    it('produces consistent hash for same settings', () => {
      const settings = SettingsSchema.parse({
        interests: ['AI', 'Web'],
        projects: [
          { name: 'proj1', description: 'desc', url: 'http://example.com' },
          { name: 'proj2', description: 'desc2', url: 'http://example2.com' },
        ],
      });

      const hash1 = triageSettingsHash(settings);
      const hash2 = triageSettingsHash(settings);

      expect(hash1).toBe(hash2);
    });

    it('handles empty interests and projects', () => {
      const settings = SettingsSchema.parse({
        interests: [],
        projects: [],
      });

      const hash = triageSettingsHash(settings);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });
  });
});
