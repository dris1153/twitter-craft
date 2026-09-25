import type { Card } from './types';

export type RenderedCard = { blob: Blob; dataUrl: string };

// Tied to the exact card object (and theme at render time) it came from.
export type CardRenderState =
  | { status: 'pending'; card: Card }
  | { status: 'ready'; card: Card; png: RenderedCard }
  | { status: 'failed'; card: Card };

// Which image (if any) goes with an insert right now, and whether Insert must wait for a render.
// A stale image (card edited, theme switched, regenerated) is never returned.
export function cardImageFor(
  session: { card: Card | null; attachCard: boolean },
  state: CardRenderState | null,
): { image: string | undefined; wait: boolean } {
  if (!session.attachCard || !session.card) return { image: undefined, wait: false };
  if (!state || state.card !== session.card || state.status === 'pending') return { image: undefined, wait: true };
  return state.status === 'ready' ? { image: state.png.dataUrl, wait: false } : { image: undefined, wait: false };
}
