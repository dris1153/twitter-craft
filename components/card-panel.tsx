import { useEffect, useRef, useState } from 'react';
import { CardEditor } from '@/components/card-editor';
import { Chip, PanelCard, SectionTitle } from '@/components/panel-card';
import { ShareCard } from '@/components/share-card';
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
    update({ status: 'pending', card }); // any edit invalidates the previous image at once
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
  }, [card, handle]);

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
    <PanelCard accent="canary" className="space-y-3 pt-5">
      <div className="flex items-center gap-2">
        <SectionTitle>Card image</SectionTitle>
        <Chip>{card.kind}</Chip>
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</Button>
        <Button size="xs" variant="outline" disabled={!png} onClick={copyImage}>Copy image</Button>
      </div>
      {warnings.length > 0 && (
        <ul className="space-y-0.5 rounded-sm border-[1.5px] border-ink bg-canary px-2.5 py-1.5 text-[11px] text-[#383838]">
          {warnings.map((w) => <li key={w}>⚠ Card: {WARNING_TEXT[w]}</li>)}
        </ul>
      )}
      {/* Screenshot frame (DESIGN.md): ink border + large hard shadow around the real PNG. */}
      <div className="relative ml-1.5 min-h-40 overflow-hidden rounded-sm border-2 border-ink bg-paper shadow-brut-lg">
        {png && <img key={png.dataUrl.length} src={png.dataUrl} alt="Card preview" className="t-skeleton-reveal block w-full" />}
        {!png && state.status !== 'failed' && <div className="t-skeleton absolute inset-0 bg-subtle" />}
      </div>
      {state.status === 'pending' && <p className="t-shimmer font-mono text-[11px]" data-text="Rendering card…">Rendering card…</p>}
      {state.status === 'failed' && <p className="text-[11px] text-danger">Could not render the card image.</p>}
      <label className="flex items-center gap-2 font-mono text-xs">
        <span className="relative inline-grid size-4 shrink-0">
          <input
            type="checkbox"
            className="t-check size-4 appearance-none rounded-sm border-2 border-ink bg-surface checked:bg-sky"
            checked={attach}
            onChange={(e) => onAttach(e.target.checked)}
          />
          <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute inset-0 fill-none stroke-[#383838] stroke-[2.5]">
            <path d="M4 8.5L7 11.5L12 5" />
          </svg>
        </span>
        Attach to the reply / quote
      </label>
      {editing && <CardEditor card={card} onChange={onChange} />}
      {/* Off-screen, full size: html-to-image captures this node. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <ShareCard ref={node} card={card} handle={handle} />
      </div>
    </PanelCard>
  );
}
