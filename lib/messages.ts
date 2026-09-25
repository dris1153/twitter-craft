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

// Side panel → content script (tabs.sendMessage). Only our own extension pages can send these.
export type PanelMessage =
  | { type: 'expand-tweet'; statusId: string }
  | { type: 'insert-draft'; statusId: string; mode: InsertMode; text: string };
export type InsertMode = 'reply' | 'quote';
export type InsertResult = 'inserted' | 'not_found' | 'dialog_open' | 'no_dialog' | 'wrong_target' | 'insert_mismatch';

export type PendingAction = {
  nonce: string;
  at: number; // ms epoch; stale actions (panel opened much later) are ignored
  windowId: number;
  tabId: number;
  kind: 'draft' | 'idea';
  tweet: z.infer<typeof TweetSchema>;
  triage: Triage | null;
};
