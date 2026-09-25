import type { UiLanguage } from './languages';
import { SettingsSchema, type Settings } from './types';

export type SettingsForm = {
  openaiKey: string;
  jevKey: string;
  draftModel: string;
  ideaModel: string;
  handle: string;
  persona: string;
  voiceSamples: string;
  interests: string;
  projects: string;
  bannedPhrases: string;
  maxReplyChars: string;
  readableLanguages: string[];
  ideaLanguage: string;
  uiLanguage: UiLanguage;
  minQuality: string;
  dimLowScore: boolean;
  debug: boolean;
};

const SAMPLE_SEPARATOR = '\n---\n';
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
// Blank must fail validation instead of silently becoming 0.
const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s));

export function toForm(s: Settings): SettingsForm {
  return {
    ...s,
    voiceSamples: s.voiceSamples.join(SAMPLE_SEPARATOR),
    interests: s.interests.join('\n'),
    projects: s.projects.map((p) => [p.name, p.description, p.url].join(' | ')).join('\n'),
    bannedPhrases: s.bannedPhrases.join('\n'),
    maxReplyChars: String(s.maxReplyChars),
    minQuality: String(s.minQuality),
  };
}

// Throws ZodError with field paths when the form is invalid.
export function fromForm(f: SettingsForm): Settings {
  return SettingsSchema.parse({
    ...f,
    handle: f.handle.trim().replace(/^@/, ''),
    voiceSamples: f.voiceSamples.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean),
    interests: lines(f.interests),
    projects: lines(f.projects).map((line) => {
      // name | description (may itself contain "|") | url
      const parts = line.split('|').map((p) => p.trim());
      const hasUrl = parts.length >= 3;
      return {
        name: parts[0] ?? '',
        description: parts.slice(1, hasUrl ? -1 : undefined).join(' | '),
        url: hasUrl ? (parts.at(-1) ?? '') : '',
      };
    }),
    bannedPhrases: lines(f.bannedPhrases),
    maxReplyChars: num(f.maxReplyChars),
    ideaLanguage: f.ideaLanguage.trim().toLowerCase() || 'vi',
    minQuality: num(f.minQuality),
  });
}
