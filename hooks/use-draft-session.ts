import { useCallback, useRef, useState } from 'react';
import { checkCard } from '@/lib/draft-safety-checks';
import { draftErrorText, generateDraft } from '@/lib/draft-generator';
import type { PendingAction } from '@/lib/messages';
import { expandInTab } from '@/lib/panel-to-tab';
import { getSettings } from '@/lib/settings-store';
import type { Card, Project, Triage, Tweet } from '@/lib/types';

// `original` is the model's text: only user-edited text may become a voice sample (it feeds future instructions).
export type Variant = { angle: string; text: string; original: string; inserted: boolean };
export type VariantKey = number | 'quote';

export type DraftSession = {
  id: number; // per generation; lets child editors reset when a new draft arrives
  tweet: Tweet;
  triage: Triage | null;
  tabId: number;
  status: 'loading' | 'ready' | 'error';
  variants: Variant[];
  quote: Variant | null;
  card: Card | null;
  attachCard: boolean;
  gifQuery: string | null;
  skipReason: string | null;
  error: string | null;
  note: string | null;
  edited: boolean;
  maxChars: number;
  projects: Project[];
  handle: string;
};

export function useDraftSession() {
  const [session, setSession] = useState<DraftSession | null>(null);
  const [queued, setQueued] = useState<PendingAction | null>(null);
  // The newest request wins: results of an older (aborted or slower) request are dropped,
  // so tweet A's drafts can never appear under tweet B.
  const current = useRef<{ id: number; ctrl: AbortController } | null>(null);
  const latest = useRef(session);
  latest.current = session;

  const run = useCallback(async (tweet: Tweet, triage: Triage | null, tabId: number) => {
    current.current?.ctrl.abort();
    const me = { id: (current.current?.id ?? 0) + 1, ctrl: new AbortController() };
    current.current = me;
    const stale = () => current.current !== me;
    const base = {
      id: me.id, triage, tabId, maxChars: 280, projects: [] as Project[], handle: '',
      variants: [], quote: null, card: null, attachCard: false, gifQuery: null,
      skipReason: null, error: null, note: null, edited: false,
    };
    setSession({ ...base, tweet, status: 'loading' });

    let full = tweet;
    let note: string | null = null;
    try {
      const settings = await getSettings();
      if (stale()) return;
      base.maxChars = settings.maxReplyChars;
      base.projects = settings.projects;
      base.handle = settings.handle;
      if (tweet.truncated) {
        const expanded = await expandInTab(tabId, tweet.id);
        if (stale()) return;
        if (expanded?.id === tweet.id && !expanded.truncated) full = expanded;
        else note = 'Could not expand the long post; drafted from the visible part.';
      }
      const draft = await generateDraft(full, triage, me.ctrl.signal);
      if (stale()) return;
      const variant = (angle: string, text: string): Variant => ({ angle, text, original: text, inserted: false });
      setSession({
        ...base, tweet: full, note, status: 'ready', skipReason: draft.skipReason,
        variants: draft.replies.map((r) => variant(r.angle, r.text)),
        quote: draft.quote ? variant('quote', draft.quote) : null,
        // A card with an unknown link or @handle starts unattached; the user has to opt in.
        card: draft.card, gifQuery: draft.gifQuery,
        attachCard: draft.card !== null && checkCard(draft.card, { tweet: full, projects: base.projects }).length === 0,
      });
    } catch (err) {
      if (stale()) return;
      setSession({ ...base, tweet: full, note, status: 'error', error: draftErrorText(err) });
    }
  }, []);

  const receive = useCallback(
    (action: PendingAction) => {
      // Never silently throw away drafts the user has been editing.
      if (latest.current?.edited) setQueued(action);
      else void run(action.tweet, action.triage, action.tabId);
    },
    [run],
  );

  const acceptQueued = () => {
    if (!queued) return;
    setQueued(null);
    void run(queued.tweet, queued.triage, queued.tabId);
  };

  const regenerate = () => {
    const s = latest.current;
    if (s) void run(s.tweet, s.triage, s.tabId);
  };

  // forTweetId: results that arrive after the user switched tweets must not touch the new session.
  const update = (key: VariantKey, patch: Partial<Variant>, forTweetId?: string) =>
    setSession((s) => {
      if (!s || (forTweetId !== undefined && s.tweet.id !== forTweetId)) return s;
      const edited = s.edited || patch.text !== undefined;
      if (key === 'quote') return s.quote ? { ...s, edited, quote: { ...s.quote, ...patch } } : s;
      return { ...s, edited, variants: s.variants.map((v, i) => (i === key ? { ...v, ...patch } : v)) };
    });

  const setCard = (card: Card) => setSession((s) => (s ? { ...s, card, edited: true } : s));
  const setAttachCard = (attachCard: boolean) => setSession((s) => (s ? { ...s, attachCard } : s));

  return {
    session, queued, receive, acceptQueued, dismissQueued: () => setQueued(null), regenerate, update, setCard, setAttachCard,
  };
}
