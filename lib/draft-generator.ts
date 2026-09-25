import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';
import { assertSendable, getModel, MissingKeyError, NotAllowedError } from './ai-models';
import { buildInstructions, buildUserMessage, replyLanguage } from './draft-prompt';
import { DraftSchema, DraftTextSchema, type Card, type Draft, type Triage, type Tweet } from './types';

const TIMEOUT_MS = 30_000;

const nonEmpty = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

// Limits live in the prompt (strict schemas can't express them); trim here, and drop cards with nothing to show.
export function normalizeCard(card: Card | null): Card | null {
  if (!card) return null;
  const c: Card = {
    ...card,
    title: card.title.trim(),
    bullets: nonEmpty(card.bullets).slice(0, 4),
    code: card.code.replace(/\s+$/, '').split('\n').slice(0, 12).join('\n'),
    rows: card.rows.filter((r) => r.label.trim() || r.a.trim() || r.b.trim()).slice(0, 5),
  };
  const empty = { insight: c.bullets.length === 0, code: !c.code.trim(), compare: c.rows.length === 0 }[c.kind];
  return empty ? null : c;
}

export async function generateDraft(tweet: Tweet, triage: Triage | null, signal: AbortSignal): Promise<Draft> {
  assertSendable(tweet);
  const { model, settings } = await getModel('draft');
  const request = {
    model,
    instructions: buildInstructions(settings, replyLanguage(tweet, settings.readableLanguages)),
    messages: [buildUserMessage(tweet, triage)],
    abortSignal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    // SDK retries sleep through Retry-After and then hit the timeout; the user can just click Regenerate.
    maxRetries: 0,
    providerOptions: { openai: { store: false } },
  };
  let draft: Draft;
  try {
    draft = (await generateText({ ...request, output: Output.object({ schema: DraftSchema }) })).output;
  } catch (err) {
    // A malformed card must never cost the text replies: retry once without the card field.
    if (!NoObjectGeneratedError.isInstance(err)) throw err;
    const text = (await generateText({ ...request, output: Output.object({ schema: DraftTextSchema }) })).output;
    draft = { ...text, card: null };
  }
  const replies = draft.replies.slice(0, 3).map((r) => ({ ...r, text: r.text.trim() }));
  const skipped = replies.length === 0;
  return {
    skipReason: draft.skipReason,
    replies,
    quote: draft.quote?.trim() || null,
    // Short enough for X's search box and the content script's 60-char limit.
    gifQuery: skipped ? null : draft.gifQuery?.trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 60) || null,
    card: skipped ? null : normalizeCard(draft.card),
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
