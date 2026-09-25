import { createOpenAI } from '@ai-sdk/openai';
import { getSettings } from './settings-store';
import type { Settings } from './types';

export class MissingKeyError extends Error {
  constructor() {
    super('OpenAI API key is missing. Add it in Settings.');
  }
}

// Swapping provider or model later only touches this file (and the model ids in settings).
export async function getModel(kind: 'draft' | 'idea') {
  const settings: Settings = await getSettings();
  if (!settings.openaiKey) throw new MissingKeyError();
  const openai = createOpenAI({ apiKey: settings.openaiKey });
  return { model: openai(kind === 'draft' ? settings.draftModel : settings.ideaModel), settings };
}
