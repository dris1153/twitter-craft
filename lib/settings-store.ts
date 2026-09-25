import { storage } from 'wxt/utils/storage';
import type { UiLanguage } from './languages';
import { SettingsSchema, type DisplayPrefs, type Settings } from './types';

// Holds API keys: only readable from extension pages/SW (background sets TRUSTED_CONTEXTS access level).
export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: SettingsSchema.parse({}),
});

export async function getSettings(): Promise<Settings> {
  // Re-parse so settings saved by older versions pick up new defaults.
  const raw = ((await settingsItem.getValue()) ?? {}) as Record<string, unknown>;
  const full = SettingsSchema.safeParse(raw);
  if (full.success) return full.data;
  // Keep every field that still validates so one bad field never wipes the API keys.
  const shape = SettingsSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
  const valid = Object.fromEntries(Object.entries(raw).filter(([k, v]) => shape[k]?.safeParse(v).success));
  return SettingsSchema.parse(valid);
}

export function saveSettings(settings: Settings): Promise<void> {
  return settingsItem.setValue(SettingsSchema.parse(settings));
}

const MAX_VOICE_SAMPLES = 30;

// Replies the user edited and inserted become voice samples, so drafts drift toward their real style.
export async function addVoiceSample(text: string): Promise<void> {
  const s = await getSettings();
  const samples = [...s.voiceSamples.filter((v) => v !== text), text].slice(-MAX_VOICE_SAMPLES);
  await saveSettings({ ...s, voiceSamples: samples });
}

// Saved on its own (applies instantly), so it never writes the Settings form's unsaved edits.
export async function setUiLanguage(uiLanguage: UiLanguage): Promise<void> {
  await saveSettings({ ...(await getSettings()), uiLanguage });
}

export function toDisplayPrefs(s: Settings): DisplayPrefs {
  return { minQuality: s.minQuality, dimLowScore: s.dimLowScore, debug: s.debug, uiLanguage: s.uiLanguage };
}

// Triage cache key includes this, so editing interests/projects re-triages instead of serving stale answers.
export function triageSettingsHash(s: Settings): string {
  const input = JSON.stringify([s.interests, s.projects]);
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
