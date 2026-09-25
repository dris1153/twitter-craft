import type { InsertMode, InsertResult, PanelMessage } from './messages';
import { TweetSchema, type Tweet } from './types';

export type InsertOutcome = InsertResult | 'no_content_script';

export const INSERT_MESSAGES: Record<InsertOutcome, string> = {
  inserted: 'Inserted. Review it in X, then click Post yourself.',
  not_found: 'The tweet is no longer on screen. Draft copied: scroll back to it or paste manually.',
  dialog_open: 'Close the open X dialog first. Draft copied to your clipboard.',
  no_dialog: 'Could not open the reply box. Draft copied: paste it manually.',
  wrong_target: 'The reply box did not match this tweet, so nothing was typed. Draft copied.',
  insert_mismatch: 'X did not accept the text. Draft copied: clear the box (Ctrl+A, Delete), then paste with Ctrl+V.',
  no_content_script: 'Cannot reach the x.com tab (reload it). Draft copied.',
};

const send = <T>(tabId: number, msg: PanelMessage) => browser.tabs.sendMessage(tabId, msg) as Promise<T>;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

export async function expandInTab(tabId: number, statusId: string): Promise<Tweet | null> {
  try {
    const raw = await withTimeout(send<unknown>(tabId, { type: 'expand-tweet', statusId }), 2500, null);
    const parsed = TweetSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function insertIntoTab(tabId: number, statusId: string, mode: InsertMode, text: string): Promise<InsertOutcome> {
  await browser.tabs.update(tabId, { active: true }).catch(() => {});
  try {
    return (await send<InsertResult | undefined>(tabId, { type: 'insert-draft', statusId, mode, text })) ?? 'no_content_script';
  } catch {
    return 'no_content_script';
  }
}
