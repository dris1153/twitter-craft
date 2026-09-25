import { useState } from 'react';
import { CardPanel } from '@/components/card-panel';
import { DraftVariantEditor } from '@/components/draft-variant-editor';
import { SectionTitle } from '@/components/panel-card';
import { TweetEmbed } from '@/components/tweet-embed';
import { Button } from '@/components/ui/button';
import type { useDraftSession, VariantKey } from '@/hooks/use-draft-session';
import { cardImageFor, type CardRenderState } from '@/lib/card-attach';
import { checkCard } from '@/lib/draft-safety-checks';
import type { InsertMode } from '@/lib/messages';
import { GIF_MESSAGES, INSERT_MESSAGES, insertIntoTab, openGifInTab } from '@/lib/panel-to-tab';
import { addVoiceSample } from '@/lib/settings-store';

type Props = ReturnType<typeof useDraftSession>;

export function DraftView(props: Props) {
  const { session, queued, acceptQueued, dismissQueued, regenerate, update, setCard, setAttachCard } = props;
  const [toast, setToast] = useState('');
  const [cardState, setCardState] = useState<CardRenderState | null>(null);
  const [inserting, setInserting] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  if (!session) {
    return (
      <div className="space-y-1 p-6 text-center">
        <p className="font-mono text-sm font-semibold">No draft yet</p>
        <p className="text-xs text-ink-muted">Click “Draft” on a tweet badge in your X feed.</p>
      </div>
    );
  }
  const s = session;
  const ctx = { tweet: s.tweet, triage: s.triage, projects: s.projects, maxChars: s.maxChars };
  const cardImage = cardImageFor(s, cardState);
  // While the card image renders, wait instead of inserting the reply without it.
  const insertBusy = inserting || cardImage.wait;
  const onCardState = (state: CardRenderState) => {
    setCardState(state);
    if (state.status === 'failed' && s.attachCard) {
      setAttachCard(false); // never leave Insert blocked on an image that won't come
      setToast('Card image failed to render, so it was unticked. Replies go in as text only.');
    }
  };

  const copy = (text: string, message = 'Copied.') => {
    navigator.clipboard.writeText(text).then(
      () => setToast(message),
      () => setToast('Clipboard blocked; select the text and copy it manually.'),
    );
  };

  const insert = (key: VariantKey, mode: InsertMode, text: string) => {
    // Copy first, while this click still counts as a user gesture: every failure path below relies on it.
    const copied = navigator.clipboard.writeText(text).then(() => true, () => false);
    const tweetId = s.tweet.id;
    setInserting(true);
    setToast('Inserting…');
    void Promise.all([insertIntoTab(s.tabId, tweetId, mode, text, cardImage.image), copied]).then(([outcome, ok]) => {
      setInserting(false);
      const fallback = ok ? '' : ' (Clipboard was blocked: use the Copy button.)';
      setToast(INSERT_MESSAGES[outcome] + (outcome === 'inserted' ? '' : fallback));
      if (outcome === 'inserted' || outcome === 'image_failed') update(key, { inserted: true }, tweetId);
    });
  };

  const addGif = (query: string) => {
    void navigator.clipboard.writeText(query).catch(() => {}); // fallback if the picker can't be driven
    void openGifInTab(s.tabId, query).then((r) => setToast(GIF_MESSAGES[r]));
  };

  const regenerateClicked = () => {
    // Regenerate replaces all variants; edits need a deliberate second click.
    if (s.edited && !confirmRegen) return setConfirmRegen(true);
    setConfirmRegen(false);
    regenerate();
  };

  const editor = (key: VariantKey) => {
    const v = key === 'quote' ? s.quote : s.variants[key];
    if (!v) return null;
    return (
      <DraftVariantEditor
        key={key}
        variant={v}
        ctx={ctx}
        busy={insertBusy}
        onChange={(text) => update(key, { text })}
        onInsert={(mode) => insert(key, mode, v.text)}
        onCopy={() => {
          copy(v.text);
          update(key, { inserted: true }, s.tweet.id);
        }}
        onSaveSample={() => void addVoiceSample(v.text.trim())}
      />
    );
  };

  return (
    <div className="space-y-5 p-4 pb-20">
      {queued && (
        <div className="space-y-2 rounded-sm border-2 border-ink bg-canary p-3 text-xs text-[#383838]">
          <p>New tweet selected (@{queued.tweet.authorHandle}). Discard your edited drafts?</p>
          <div className="flex gap-2">
            <Button size="xs" onClick={acceptQueued}>Switch</Button>
            <Button size="xs" variant="outline" onClick={dismissQueued}>Keep editing</Button>
          </div>
        </div>
      )}

      <TweetEmbed tweet={s.tweet} note={s.note} />

      {s.status === 'loading' && <p className="t-shimmer font-mono text-xs" data-text="Drafting replies…">Drafting replies…</p>}
      {s.status === 'error' && <p className="rounded-sm border-2 border-ink bg-coral/25 p-3 text-xs">{s.error}</p>}
      {s.status === 'ready' && s.skipReason && s.variants.length === 0 && (
        <p className="text-xs text-ink-muted">Nothing worth adding: {s.skipReason}</p>
      )}

      {s.variants.length > 0 && (
        <div className="space-y-3">
          <SectionTitle>Replies</SectionTitle>
          {s.variants.map((_, i) => editor(i))}
        </div>
      )}
      {s.quote && (
        <div className="space-y-3">
          <SectionTitle>Suggested quote post</SectionTitle>
          {editor('quote')}
        </div>
      )}

      {s.card && (
        <CardPanel
          key={s.id}
          card={s.card}
          attach={s.attachCard}
          handle={s.handle}
          warnings={checkCard(s.card, ctx)}
          onChange={setCard}
          onAttach={setAttachCard}
          onRenderState={onCardState}
          onToast={setToast}
        />
      )}

      {s.status !== 'loading' && (
        <div className="flex flex-wrap gap-3">
          {/* X takes one image or one GIF: no GIF button while the card is attached. */}
          {s.gifQuery && !(s.attachCard && s.card) && (
            <Button size="sm" variant="outline" disabled={inserting} onClick={() => addGif(s.gifQuery!)} title="Opens X's GIF picker in the open reply box">
              GIF · {s.gifQuery}
            </Button>
          )}
          <Button variant={confirmRegen ? 'destructive' : 'secondary'} size="sm" onClick={regenerateClicked}>
            <span key={String(confirmRegen)} className="t-text-swap">{confirmRegen ? 'Discard edits and regenerate' : 'Regenerate'}</span>
          </Button>
        </div>
      )}

      {/* Stable live region; the message remounts per change so the toast re-opens. */}
      <div role="status" className="fixed inset-x-3 bottom-3">
        {toast && (
          <p key={toast} className="t-toast rounded-sm border-2 border-ink bg-surface px-3 py-2 font-mono text-xs shadow-brut-sm">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
