import { z } from 'zod';
import { TriageSchema, TweetSchema, type DisplayPrefs, type Triage, type TriageError } from './types';

// Content-script messages are attacker-controllable (they run in x.com's renderer); validate everything.
export const ContentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('triage'), tweet: TweetSchema }),
  z.object({ type: z.literal('get-prefs') }),
  z.object({
    type: z.literal('open-panel'),
    kind: z.enum(['draft', 'idea']),
    tweet: TweetSchema,
    triage: TriageSchema.nullable(),
  }),
]);
export type ContentMessage = z.infer<typeof ContentMessageSchema>;

export type TriageResponse =
  | { ok: true; triage: Triage; prefs: DisplayPrefs }
  | { ok: false; error: TriageError; prefs: DisplayPrefs };

export type PendingAction = {
  nonce: string;
  windowId: number;
  tabId: number;
  kind: 'draft' | 'idea';
  tweet: z.infer<typeof TweetSchema>;
  triage: Triage | null;
};
