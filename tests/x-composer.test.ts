import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findArticleById, insertDraft, isPanelMessage } from '@/lib/x-composer';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8');
const ID = '2103140058434031831'; // tests/fixtures/translated-quote.html (real capture)

// Home timeline: the inline "What's happening" composer shares data-testid="tweetTextarea_0" with the dialog.
const INLINE_COMPOSER = '<div id="inline" data-testid="tweetTextarea_0" contenteditable="true"></div>';

function openDialogOnReply(opts: { targetLink?: boolean } = {}) {
  const reply = document.querySelector<HTMLElement>('[data-testid="reply"]')!;
  reply.addEventListener('click', () => {
    const link = opts.targetLink === false ? '' : `<a href="/BeamManP/status/${ID}">17 giờ</a>`;
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog">${link}<div id="dialog-composer" data-testid="tweetTextarea_0" contenteditable="true"></div>
       <button data-testid="tweetButton" aria-disabled="true">Đăng</button></div>`,
    );
    // X enables Post once its editor state has text.
    document.getElementById('dialog-composer')!.addEventListener('input', () =>
      document.querySelector('[data-testid="tweetButton"]')!.setAttribute('aria-disabled', 'false'),
    );
  });
}

// Browser behavior of execCommand('insertText') on the focused contenteditable (happy-dom lacks it).
function stubExecCommand(works = true) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: (cmd: string, _ui: boolean, value?: string) => {
      const el = document.activeElement as HTMLElement | null;
      if (works && cmd === 'insertText' && el?.isContentEditable) {
        el.textContent += value ?? '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    },
  });
}

describe('insertDraft', () => {
  beforeEach(() => {
    document.body.innerHTML = INLINE_COMPOSER + fixture('translated-quote');
    stubExecCommand();
  });
  afterEach(() => vi.restoreAllMocks());

  it('types into the reply dialog, never the inline composer', async () => {
    openDialogOnReply();
    expect(await insertDraft(ID, 'reply', 'Hermite curves are underrated')).toBe('inserted');
    expect(document.getElementById('dialog-composer')!.textContent).toBe('Hermite curves are underrated');
    expect(document.getElementById('inline')!.textContent).toBe('');
  });

  it('refuses when a composer dialog is already open', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><div data-testid="tweetTextarea_0"></div></div>');
    expect(await insertDraft(ID, 'reply', 'x')).toBe('dialog_open');
  });

  it('refuses a dialog that does not point at the target tweet', async () => {
    openDialogOnReply({ targetLink: false });
    // Strip the handle too so neither check can match.
    document.querySelectorAll('span').forEach((s) => s.textContent?.includes('@BeamManP') && (s.textContent = ''));
    expect(await insertDraft(ID, 'reply', 'x')).toBe('wrong_target');
    expect(document.getElementById('dialog-composer')!.textContent).toBe('');
  });

  it('reports a tweet that scrolled away', async () => {
    expect(await insertDraft('999', 'reply', 'x')).toBe('not_found');
  });

  it('reports text X did not accept', async () => {
    stubExecCommand(false);
    openDialogOnReply();
    expect(await insertDraft(ID, 'reply', 'x')).toBe('insert_mismatch');
  });
});

describe('insertDraft: quote, concurrency, focus', () => {
  beforeEach(() => {
    document.body.innerHTML = INLINE_COMPOSER + fixture('translated-quote');
    stubExecCommand();
  });

  it('opens the quote composer through the repost menu', async () => {
    document.querySelector('[data-testid="retweet"]')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<div role="menu"><a href="/compose/post" role="menuitem">Trích dẫn</a></div>');
      document.querySelector('a[href="/compose/post"]')!.addEventListener('click', () => {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div role="dialog"><div id="q" data-testid="tweetTextarea_0" contenteditable="true"></div>
           <div>ビームマンＰ @BeamManP</div><button data-testid="tweetButton">Đăng</button></div>`,
        );
      });
    });
    expect(await insertDraft(ID, 'quote', 'Hermite for homing is a neat trick')).toBe('inserted');
    expect(document.getElementById('q')!.textContent).toBe('Hermite for homing is a neat trick');
  });

  it('types the text but reports image_failed when X shows no attached image', async () => {
    openDialogOnReply();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await insertDraft(ID, 'reply', 'with a card', png)).toBe('image_failed');
    expect(document.getElementById('dialog-composer')!.textContent).toBe('with a card');
  });

  it('runs one insert at a time', async () => {
    openDialogOnReply();
    const [first, second] = await Promise.all([insertDraft(ID, 'reply', 'one'), insertDraft(ID, 'quote', 'two')]);
    expect(first).toBe('inserted');
    expect(second).toBe('dialog_open');
    expect(document.getElementById('dialog-composer')!.textContent).toBe('one');
  });

  it('never types when focus did not land in the dialog composer', async () => {
    openDialogOnReply();
    // X moves focus elsewhere (e.g. the inline composer) right after the dialog opens.
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      document.getElementById('inline')!.setAttribute('tabindex', '0');
      HTMLElement.prototype.blur.call(this);
    });
    expect(await insertDraft(ID, 'reply', 'x')).toBe('insert_mismatch');
    expect(document.getElementById('inline')!.textContent).toBe('');
    vi.restoreAllMocks();
  });
});

describe('helpers', () => {
  it('finds the article by exact id, not by a quoting permalink', () => {
    document.body.innerHTML = fixture('translated-quote');
    expect(findArticleById(ID)).not.toBeNull();
    expect(findArticleById('210314005843403183')).toBeNull(); // prefix of the real id
  });

  it('validates panel messages', () => {
    expect(isPanelMessage({ type: 'insert-draft', statusId: '1', mode: 'reply', text: 'hi' })).toBe(true);
    expect(isPanelMessage({ type: 'expand-tweet', statusId: '1' })).toBe(true);
    expect(isPanelMessage({ type: 'insert-draft', statusId: '1', mode: 'post', text: 'hi' })).toBe(false);
    expect(isPanelMessage({ type: 'insert-draft', statusId: '../x', mode: 'reply', text: 'hi' })).toBe(false);
    expect(isPanelMessage(null)).toBe(false);
  });
});
