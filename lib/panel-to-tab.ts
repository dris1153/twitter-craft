import type { GifResult, InsertMode, InsertResult, PanelMessage } from './messages';
import { TweetSchema, type Tweet } from './types';

export type InsertOutcome = InsertResult | 'no_content_script';

export const INSERT_MESSAGES: Record<InsertOutcome, string> = {
  inserted: 'Inserted. Review it in X, then click Post yourself.',
  image_failed: 'Text inserted, but X did not take the card image. Click "Copy image" and paste it with Ctrl+V.',
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

export async function insertIntoTab(
  tabId: number, statusId: string, mode: InsertMode, text: string, imageDataUrl?: string,
): Promise<InsertOutcome> {
  await browser.tabs.update(tabId, { active: true }).catch(() => {});
  try {
    const msg: PanelMessage = { type: 'insert-draft', statusId, mode, text, ...(imageDataUrl ? { imageDataUrl } : {}) };
    return (await send<InsertResult | undefined>(tabId, msg)) ?? 'no_content_script';
  } catch {
    return 'no_content_script';
  }
}

export const GIF_MESSAGES: Record<GifResult | 'no_content_script', string> = {
  gif_opened: 'GIF picker opened with your search. Pick one, then click Post yourself.',
  no_dialog: 'Insert a reply or quote first, then add a GIF. Search copied.',
  no_gif_button: "Could not open X's GIF picker. Search copied: open it yourself and paste.",
  gif_disabled: 'X allows either an image or a GIF. Remove the card image from the reply first.',
  no_content_script: 'Cannot reach the x.com tab (reload it). Search copied.',
};

export async function openGifInTab(tabId: number, query: string): Promise<GifResult | 'no_content_script'> {
  try {
    return (await send<GifResult | undefined>(tabId, { type: 'open-gif-picker', query })) ?? 'no_content_script';
  } catch {
    return 'no_content_script';
  }
}
