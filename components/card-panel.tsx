import { useEffect, useRef, useState } from 'react';
import { CardEditor } from '@/components/card-editor';
import { ShareCard, type CardTheme } from '@/components/share-card';
import { Button } from '@/components/ui/button';
import type { CardRenderState } from '@/lib/card-attach';
import { renderCardPng } from '@/lib/card-to-png';
import { WARNING_TEXT, type DraftWarning } from '@/lib/draft-safety-checks';
import type { Card } from '@/lib/types';


type Props = {
  card: Card;
  attach: boolean;
  handle: string;
  warnings: DraftWarning[];
  onChange: (card: Card) => void;
  onAttach: (attach: boolean) => void;
  onRenderState: (state: CardRenderState) => void;
  onToast: (message: string) => void;
};

// The preview IS the rendered PNG, so what you see is exactly what gets attached.
export function CardPanel({ card, attach, handle, warnings, onChange, onAttach, onRenderState, onToast }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<CardTheme>('dark');
  const [state, setState] = useState<CardRenderState>({ status: 'pending', card });
  const [editing, setEditing] = useState(false);
  const report = useRef(onRenderState);
  report.current = onRenderState;

  useEffect(() => {
    let cancelled = false;
    const update = (next: CardRenderState) => {
      if (cancelled) return;
      setState(next);
      report.current(next);
    };
    update({ status: 'pending', card }); // any edit or theme change invalidates the previous image at once
    const timer = setTimeout(() => {
      if (!node.current) return update({ status: 'failed', card });
      renderCardPng(node.current, card.kind).then(
        (png) => update({ status: 'ready', card, png }),
        () => update({ status: 'failed', card }),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [card, theme, handle]);

  const png = state.status === 'ready' ? state.png : null;
  const copyImage = () => {
    if (!png) return;
    // Its own click: a separate user gesture that doesn't overwrite the text copied on Insert.
    navigator.clipboard.write([new ClipboardItem({ 'image/png': png.blob })]).then(
      () => onToast('Card image copied. Paste it into the X reply box with Ctrl+V.'),
      () => onToast('Clipboard blocked the image. Right-click the preview and copy it.'),
    );
  };

  return (
    <section className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={attach} onChange={(e) => onAttach(e.target.checked)} />
          Attach card to reply/quote
        </label>
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit card'}</Button>
        <Button size="xs" variant="outline" disabled={!png} onClick={copyImage}>Copy image</Button>
      </div>
      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-xs text-destructive">
          {warnings.map((w) => <li key={w}>⚠ Card: {WARNING_TEXT[w]}</li>)}
        </ul>
      )}
      {png && <img src={png.dataUrl} alt="Card preview" className="w-full rounded-md" />}
      {state.status === 'pending' && <p className="text-xs text-muted-foreground">Rendering card…</p>}
      {state.status === 'failed' && <p className="text-xs text-destructive">Could not render the card image.</p>}
      {editing && <CardEditor card={card} onChange={onChange} />}
      {/* Off-screen, full size: html-to-image captures this node. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <ShareCard ref={node} card={card} theme={theme} handle={handle} />
      </div>
    </section>
  );
}
