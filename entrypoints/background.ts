import { ContentMessageSchema, type ContentMessage, type TriageResponse } from '@/lib/messages';
import { pendingActionItem } from '@/lib/pending-action-store';
import { getSettings, toDisplayPrefs } from '@/lib/settings-store';
import { triage } from '@/lib/triage-queue';
import { SettingsSchema, type DisplayPrefs } from '@/lib/types';

export default defineBackground(() => {
  // API keys live in storage.local; keep it away from content scripts (they share x.com's renderer).
  void browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const tab = sender.tab;
    if (sender.id !== browser.runtime.id || tab?.id === undefined || !sender.url?.startsWith('https://x.com/')) {
      return;
    }
    const parsed = ContentMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const msg = parsed.data;

    if (msg.type === 'open-panel') {
      // Must run before any await: sidePanel.open() needs the user gesture carried by this message.
      browser.sidePanel.open({ tabId: tab.id }).catch((err) => console.warn('[twitter-craft] sidePanel.open', err));
      pendingActionItem
        .setValue({
          nonce: crypto.randomUUID(),
          windowId: tab.windowId,
          tabId: tab.id,
          kind: msg.kind,
          tweet: msg.tweet,
          triage: msg.triage,
        })
        .catch((err) => console.warn('[twitter-craft] pendingAction write', err));
      return;
    }
    handle(msg)
      .then(sendResponse)
      .catch((err) => {
        console.warn('[twitter-craft] message failed', msg.type, err);
        // Always answer, or the content script waits forever on an open port.
        sendResponse(msg.type === 'get-prefs' ? FALLBACK_PREFS : { ok: false, error: 'http', prefs: FALLBACK_PREFS });
      });
    return true;
  });
});

const FALLBACK_PREFS: DisplayPrefs = toDisplayPrefs(SettingsSchema.parse({}));

async function handle(msg: Exclude<ContentMessage, { type: 'open-panel' }>): Promise<TriageResponse | DisplayPrefs> {
  const prefs = toDisplayPrefs(await getSettings());
  if (msg.type === 'get-prefs') return prefs;
  const { tweet } = msg;
  // Defense in depth: content script already skips these; never send them to a vendor.
  if (tweet.isAd || tweet.isProtected || tweet.quoted?.isProtected) return { ok: false, error: 'invalid', prefs };
  return { ...(await triage(tweet)), prefs };
}
