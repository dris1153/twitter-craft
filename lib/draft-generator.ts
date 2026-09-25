import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';
import { assertSendable, getModel, MissingKeyError, NotAllowedError } from './ai-models';
import { buildInstructions, buildUserMessage, replyLanguage } from './draft-prompt';
import { DraftSchema, type Draft, type Triage, type Tweet } from './types';

const TIMEOUT_MS = 30_000;

export async function generateDraft(tweet: Tweet, triage: Triage | null, signal: AbortSignal): Promise<Draft> {
  assertSendable(tweet);
  const { model, settings } = await getModel('draft');
  const result = await generateText({
    model,
    instructions: buildInstructions(settings, replyLanguage(tweet, settings.readableLanguages)),
    messages: [buildUserMessage(tweet, triage)],
    output: Output.object({ schema: DraftSchema }),
    abortSignal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    // SDK retries sleep through Retry-After and then hit the timeout; the user can just click Regenerate.
    maxRetries: 0,
    providerOptions: { openai: { store: false } },
  });
  const draft = result.output;
  return {
    skipReason: draft.skipReason,
    replies: draft.replies.slice(0, 3).map((r) => ({ ...r, text: r.text.trim() })),
    quote: draft.quote?.trim() || null,
  };
}

// Shared by draft and idea generation.
export function draftErrorText(err: unknown, kind: 'draft' | 'idea' = 'draft'): string {
  const again = kind === 'draft' ? 'Regenerate' : 'Retry';
  if (err instanceof MissingKeyError || err instanceof NotAllowedError) return err.message;
  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
    return `The model returned no usable ${kind}. Try ${again}.`;
  }
  const e = err as { name?: string; message?: string; statusCode?: number; lastError?: { statusCode?: number } };
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return 'Timed out after 30s. Try again.';
  const status = e?.statusCode ?? e?.lastError?.statusCode; // RetryError wraps the API error
  if (status === 401) return 'OpenAI rejected the API key (401). Check Settings.';
  if (status === 404) return `Model not found (404). Check the ${kind} model id in Settings.`;
  if (status === 429) return 'OpenAI rate limit or quota reached (429). Try again shortly.';
  return e?.message || 'Draft failed.';
}
