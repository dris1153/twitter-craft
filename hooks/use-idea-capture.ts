import { useCallback, useEffect, useRef, useState } from 'react';
import { draftErrorText } from '@/lib/draft-generator';
import { expandIdea } from '@/lib/idea-expander';
import { addIdea, findBySource, ideasItem, listIdeas } from '@/lib/ideas-store';
import { expandInTab } from '@/lib/panel-to-tab';
import type { Idea, IdeaDraft, Tweet } from '@/lib/types';

type Source = { tweet: Tweet; tabId: number };

// Edits live here, not in the card, so they survive tab switches and are never mixed up between captures.
export type Capture = Source & {
  seq: number;
  status: 'loading' | 'ready' | 'error' | 'duplicate';
  draft: IdeaDraft | null;
  edited: boolean;
  error: string | null;
  existingId: string | null;
};

export function useIdeas(): Idea[] {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  useEffect(() => {
    void listIdeas().then(setIdeas);
    return ideasItem.watch((v) => setIdeas(v ?? []));
  }, []);
  return ideas;
}

function sourceText(t: Tweet): string {
  return t.quoted ? `${t.text}\n\nQuoting @${t.quoted.authorHandle}: ${t.quoted.text}` : t.text;
}

export function useIdeaCapture() {
  const [capture, setCapture] = useState<Capture | null>(null);
  const [queued, setQueued] = useState<Source | null>(null);
  const current = useRef<{ seq: number; ctrl: AbortController } | null>(null);
  const latest = useRef(capture);
  latest.current = capture;

  const start = useCallback(async (source: Source) => {
    current.current?.ctrl.abort();
    const me = { seq: (current.current?.seq ?? 0) + 1, ctrl: new AbortController() };
    current.current = me;
    const stale = () => current.current !== me;
    const base = { ...source, seq: me.seq, draft: null, edited: false, error: null, existingId: null };
    try {
      const existing = await findBySource(source.tweet.id);
      if (stale()) return;
      if (existing) return setCapture({ ...base, status: 'duplicate', existingId: existing.id });
      setCapture({ ...base, status: 'loading' });
      let tweet = source.tweet;
      if (tweet.truncated) {
        const expanded = await expandInTab(source.tabId, tweet.id);
        if (expanded?.id === tweet.id) tweet = expanded;
      }
      const draft = await expandIdea(tweet, me.ctrl.signal);
      if (!stale()) setCapture({ ...base, tweet, status: 'ready', draft });
    } catch (err) {
      if (!stale()) setCapture({ ...base, status: 'error', error: draftErrorText(err, 'idea') });
    }
  }, []);

  const receive = useCallback(
    (source: Source) => {
      const c = latest.current;
      if (c && c.tweet.id === source.tweet.id && c.status !== 'error') return; // already on it
      if (c?.edited) setQueued(source); // never silently drop an edited idea
      else void start(source);
    },
    [start],
  );

  const edit = (draft: IdeaDraft) =>
    setCapture((c) => (c && c.status === 'ready' ? { ...c, draft, edited: true, error: null } : c));

  const save = async () => {
    const c = latest.current;
    if (!c?.draft) return;
    const t = c.tweet;
    try {
      await addIdea({
        ...c.draft, id: crypto.randomUUID(), sourceStatusId: t.id, sourceUrl: t.url, sourceAuthor: t.authorHandle,
        sourceText: sourceText(t), status: 'new', notes: '', createdAt: new Date().toISOString(),
      });
      setCapture((cur) => (cur?.seq === c.seq ? null : cur)); // a newer capture may have started meanwhile
    } catch (err) {
      const message = `Could not save: ${err instanceof Error ? err.message : String(err)}`;
      setCapture((cur) => (cur?.seq === c.seq ? { ...cur, error: message } : cur));
    }
  };

  const discard = () => {
    current.current?.ctrl.abort();
    current.current = null;
    setCapture(null);
  };

  const acceptQueued = () => {
    if (!queued) return;
    setQueued(null);
    void start(queued);
  };

  const retry = () => capture && void start(capture);

  return { capture, queued, receive, edit, save, discard, retry, acceptQueued, dismissQueued: () => setQueued(null) };
}
