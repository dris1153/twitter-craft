import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCard } from '@/lib/draft-generator';
import { isPanelMessage } from '@/lib/x-composer';
import { dataUrlToFile, openGifPicker, pasteImage } from '@/lib/x-composer-media';
import type { Card } from '@/lib/types';

const card = (over: Partial<Card>): Card => ({
  kind: 'insight', title: ' T ', bullets: [], lang: '', code: '', columns: { a: '', b: '' }, rows: [], ...over,
});
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizeCard', () => {
  it('trims to the prompt limits', () => {
    expect(normalizeCard(card({ bullets: ['a', ' ', 'b', 'c', 'd', 'e'] }))!.bullets).toEqual(['a', 'b', 'c', 'd']);
    const code = normalizeCard(card({ kind: 'code', code: Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n') }))!;
    expect(code.code.split('\n')).toHaveLength(12);
    const rows = Array.from({ length: 8 }, (_, i) => ({ label: `r${i}`, a: 'x', b: 'y' }));
    expect(normalizeCard(card({ kind: 'compare', rows }))!.rows).toHaveLength(5);
    expect(normalizeCard(card({ bullets: ['x'] }))!.title).toBe('T');
  });

  it('drops cards with nothing to show for their kind', () => {
    expect(normalizeCard(card({ bullets: [] }))).toBeNull();
    expect(normalizeCard(card({ kind: 'code', code: '  \n' }))).toBeNull();
    expect(normalizeCard(card({ kind: 'compare', rows: [{ label: ' ', a: '', b: '' }] }))).toBeNull();
    expect(normalizeCard(null)).toBeNull();
  });
});

describe('media in the composer dialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('decodes the PNG data URL into a file without fetch', async () => {
    const file = dataUrlToFile(PNG);
    expect(file.type).toBe('image/png');
    expect([...new Uint8Array(await file.arrayBuffer())].slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('reports success only when X shows a new media preview', async () => {
    document.body.innerHTML = '<div role="dialog"><div id="c" data-testid="tweetTextarea_0" contenteditable="true"></div></div>';
    const dialog = document.querySelector('[role="dialog"]')!;
    const composer = document.getElementById('c')!;
    composer.addEventListener('paste', (e) => {
      if ((e as ClipboardEvent).clipboardData?.files[0]?.type === 'image/png') {
        dialog.insertAdjacentHTML('beforeend', '<div data-testid="attachments"><img src="blob:x"></div>');
      }
    });
    expect(await pasteImage(dialog, composer, PNG)).toBe(true);
  });

  it('opens the GIF picker inside the open composer dialog and types the query', async () => {
    document.body.innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0"></div><button data-testid="gifSearchButton"></button></div>';
    document.querySelector('[data-testid="gifSearchButton"]')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><input data-testid="gifSearchSearchInput" type="text"></div>');
    });
    const typed = vi.fn();
    document.addEventListener('input', typed);
    expect(await openGifPicker('ship it')).toBe('gif_opened');
    expect(document.querySelector<HTMLInputElement>('[data-testid="gifSearchSearchInput"]')!.value).toBe('ship it');
    expect(typed).toHaveBeenCalled();
  });

  it('explains when X disabled GIFs because an image is attached', async () => {
    document.body.innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0"></div><button data-testid="gifSearchButton" disabled></button></div>';
    expect(await openGifPicker('x')).toBe('gif_disabled');
  });

  it('reports a malformed image as not attached instead of throwing', async () => {
    document.body.innerHTML = '<div role="dialog"><div id="c" data-testid="tweetTextarea_0" contenteditable="true"></div></div>';
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(await pasteImage(dialog, document.getElementById('c')!, 'data:image/png;base64,@@@')).toBe(false);
  });

  it('degrades when there is no dialog or no GIF button', async () => {
    expect(await openGifPicker('x')).toBe('no_dialog');
    document.body.innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0"></div></div>';
    expect(await openGifPicker('x')).toBe('no_gif_button');
  });
});

describe('panel message validation', () => {
  it('accepts PNG data URLs and GIF queries, rejects anything else', () => {
    const insert = { type: 'insert-draft', statusId: '1', mode: 'reply', text: 'hi' };
    expect(isPanelMessage({ ...insert, imageDataUrl: PNG })).toBe(true);
    expect(isPanelMessage({ ...insert, imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBe(false);
    expect(isPanelMessage({ ...insert, imageDataUrl: 'https://evil.io/x.png' })).toBe(false);
    expect(isPanelMessage({ type: 'open-gif-picker', query: 'ship it' })).toBe(true);
    expect(isPanelMessage({ type: 'open-gif-picker', query: 'x'.repeat(61) })).toBe(false);
  });
});
