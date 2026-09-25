import type { GifResult, InsertMode, InsertResult, PanelMessage } from './messages';
import { TweetSchema, type Tweet } from './types';

export type InsertOutcome = InsertResult | 'no_content_script';

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

export async function openGifInTab(tabId: number, query: string): Promise<GifResult | 'no_content_script'> {
  try {
    return (await send<GifResult | undefined>(tabId, { type: 'open-gif-picker', query })) ?? 'no_content_script';
  } catch {
    return 'no_content_script';
  }
}
