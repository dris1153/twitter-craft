import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLang, t } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { vi } from '@/lib/i18n/vi';
import { languageName } from '@/lib/languages';
import { getSettings, saveSettings, setUiLanguage } from '@/lib/settings-store';
import { renderBadge } from '@/lib/tweet-badge';
import { SettingsSchema } from '@/lib/types';
import { BADGE_ATTR } from '@/lib/x-dom-selectors';

describe('t', () => {
  afterEach(() => setLang('en'));

  it('fills placeholders and keeps unknown ones', () => {
    expect(t('draft.queued', { handle: 'alice' })).toBe('New tweet selected (@alice). Discard your edited drafts?');
    expect(t('draft.queued')).toContain('{handle}');
  });

  it('switches language at runtime', () => {
    setLang('vi');
    expect(t('tab.settings')).toBe('Cài đặt');
    expect(t('status.dropped', {})).toBe('đã bỏ');
  });

  it('has a non-empty Vietnamese text for every key, with the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(vi[key], key).toBeTruthy();
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(vi[key]), key).toEqual(vars(en[key]));
    }
  });

  it('translates the badge on X', () => {
    setLang('vi');
    document.body.innerHTML = '<article data-testid="tweet"><div role="group"></div></article>';
    const article = document.querySelector('article')!;
    renderBadge(article, { kind: 'manual' }, { onDraft: () => {}, onIdea: () => {} });
    expect(article.querySelector(`[${BADGE_ATTR}]`)!.shadowRoot!.textContent).toContain('không chấm điểm');
  });
});

describe('languages', () => {
  it('names known codes for prompts and passes unknown ones through', () => {
    expect(languageName('ja')).toBe('Japanese');
    expect(languageName('xx')).toBe('xx');
  });
});

describe('setUiLanguage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('changes only the display language in stored settings', async () => {
    await saveSettings(SettingsSchema.parse({ jevKey: 'keep-me', uiLanguage: 'en' }));
    await setUiLanguage('vi');
    const s = await getSettings();
    expect(s.uiLanguage).toBe('vi');
    expect(s.jevKey).toBe('keep-me');
  });
});
