import { useState } from 'react';
import { CardPanel } from '@/components/card-panel';
import { DraftVariantEditor } from '@/components/draft-variant-editor';
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
    return <p className="p-4 text-muted-foreground">Click "Draft" on a tweet badge to get reply drafts here.</p>;
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
    <div className="space-y-4 p-4 pb-16">
      {queued && (
        <div className="space-y-2 rounded-lg border border-primary/40 p-3 text-xs">
          <p>New tweet selected (@{queued.tweet.authorHandle}). Discard your edited drafts?</p>
          <div className="flex gap-2">
            <Button size="xs" onClick={acceptQueued}>Switch</Button>
            <Button size="xs" variant="outline" onClick={dismissQueued}>Keep editing</Button>
          </div>
        </div>
      )}

      <section className="space-y-1 rounded-lg bg-muted/50 p-3">
        <a href={s.tweet.url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline">
          {s.tweet.authorName} @{s.tweet.authorHandle}
        </a>
        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{s.tweet.text || s.tweet.quoted?.text}</p>
        {s.note && <p className="text-xs text-muted-foreground italic">{s.note}</p>}
      </section>

      {s.status === 'loading' && <p className="text-muted-foreground">Drafting…</p>}
      {s.status === 'error' && <p className="text-destructive">{s.error}</p>}
      {s.status === 'ready' && s.skipReason && s.variants.length === 0 && (
        <p className="text-muted-foreground">Nothing worth adding: {s.skipReason}</p>
      )}

      {s.variants.map((_, i) => editor(i))}
      {s.quote && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold">Suggested quote post</h3>
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
      {/* X takes one image or one GIF: no GIF button while the card is attached. */}
      {s.gifQuery && !(s.attachCard && s.card) && (
        <Button size="sm" variant="outline" disabled={inserting} onClick={() => addGif(s.gifQuery!)} title="Opens X's GIF picker in the open reply box">
          Add GIF: {s.gifQuery}
        </Button>
      )}

      {s.status !== 'loading' && (
        <Button variant={confirmRegen ? 'destructive' : 'outline'} size="sm" onClick={regenerateClicked}>
          {confirmRegen ? 'Discard edits and regenerate' : 'Regenerate'}
        </Button>
      )}

      {toast && (
        <p role="status" className="fixed inset-x-0 bottom-0 border-t bg-background p-3 text-xs">
          {toast}
        </p>
      )}
    </div>
  );
}
