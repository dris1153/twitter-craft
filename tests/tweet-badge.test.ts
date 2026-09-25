import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeBadge, renderBadge, type BadgeHandlers } from '@/lib/tweet-badge';
import type { Triage } from '@/lib/types';
import { BADGE_ATTR } from '@/lib/x-dom-selectors';

const triage: Triage = {
  id: '1', quality: 0.8, action: 'reply', topic: 'llm_agents', replyOpening: 0.7,
  projectMatch: 'none', buildIdea: 0.2, botInstructions: 0, uncertain: false,
};

function setup() {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <div role="link"><div data-testid="User-Name"></div><div role="group" id="quote-bar"></div></div>
      <div role="group" id="main-bar"></div>
    </article>`;
  return document.querySelector('article')!;
}

const handlers = () => ({ onDraft: vi.fn<() => void>(), onIdea: vi.fn<() => void>() }) satisfies BadgeHandlers;

const shadowOf = (article: Element) => article.querySelector(`[${BADGE_ATTR}]`)!.shadowRoot!;
const buttonNamed = (article: Element, label: string) =>
  [...shadowOf(article).querySelectorAll('button')].find((b) => b.textContent === label);

describe('renderBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('places the badge after the main action bar, not the quoted post bar', () => {
    const article = setup();
    renderBadge(article, { kind: 'ready', priority: 82, triage }, handlers());
    const host = article.querySelector(`[${BADGE_ATTR}]`)!;
    expect(host.previousElementSibling?.id).toBe('main-bar');
    expect(shadowOf(article).textContent).toContain('82');
    expect(shadowOf(article).textContent).toContain('reply');
  });

  it('re-renders into the same host', () => {
    const article = setup();
    renderBadge(article, { kind: 'loading' }, handlers());
    renderBadge(article, { kind: 'ready', priority: 10, triage }, handlers());
    expect(article.querySelectorAll(`[${BADGE_ATTR}]`)).toHaveLength(1);
    expect(shadowOf(article).textContent).not.toContain('…');
  });

  it('fires handlers without letting the click reach the article', () => {
    const article = setup();
    const h = handlers();
    const articleClick = vi.fn();
    article.addEventListener('click', articleClick);
    renderBadge(article, { kind: 'ready', priority: 50, triage }, h);

    buttonNamed(article, 'Draft')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    buttonNamed(article, 'Idea')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(h.onDraft).toHaveBeenCalledOnce();
    expect(h.onIdea).toHaveBeenCalledOnce();
    expect(articleClick).not.toHaveBeenCalled();
  });

  it('renders untrusted strings as text', () => {
    const article = setup();
    const evil = { ...triage, projectMatch: '<img src=x onerror="alert(1)">' };
    renderBadge(article, { kind: 'ready', priority: 50, triage: evil }, handlers());
    expect(shadowOf(article).querySelector('img')).toBeNull();
    expect(shadowOf(article).textContent).toContain('<img src=x');
  });

  it('shows Copy HTML only when a handler is given', () => {
    const article = setup();
    renderBadge(article, { kind: 'ready', priority: 50, triage }, handlers());
    expect(buttonNamed(article, 'Copy HTML')).toBeUndefined();
    renderBadge(article, { kind: 'ready', priority: 50, triage }, { ...handlers(), onCopyHtml: vi.fn() });
    expect(buttonNamed(article, 'Copy HTML')).toBeDefined();
  });

  it('shows an error marker with an explanation', () => {
    const article = setup();
    renderBadge(article, { kind: 'error', error: 'no_key' }, handlers());
    const warn = shadowOf(article).querySelector('.err') as HTMLElement;
    expect(warn.textContent).toBe('⚠');
    expect(warn.title).toMatch(/key/i);
  });

  it('marks idea-worthy posts, but not bait', () => {
    const article = setup();
    renderBadge(article, { kind: 'ready', priority: 30, triage: { ...triage, buildIdea: 0.8 } }, handlers());
    expect(shadowOf(article).textContent).toContain('💡');
    renderBadge(article, { kind: 'ready', priority: 30, triage: { ...triage, buildIdea: 0.8, botInstructions: 0.9 } }, handlers());
    expect(shadowOf(article).textContent).not.toContain('💡');
  });

  it('shows replies without a score but with working Draft/Idea buttons', () => {
    const article = setup();
    const h = handlers();
    renderBadge(article, { kind: 'manual' }, h);
    expect(shadowOf(article).querySelector('.pill')).toBeNull();
    expect(shadowOf(article).textContent).toContain('not scored');
    buttonNamed(article, 'Draft')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(h.onDraft).toHaveBeenCalledOnce();
  });

  it('flags bait and uncertainty', () => {
    const article = setup();
    renderBadge(article, { kind: 'ready', priority: 50, triage: { ...triage, uncertain: true, botInstructions: 0.9 } }, handlers());
    expect(shadowOf(article).textContent).toContain('?');
    expect(shadowOf(article).textContent).toContain('bait');
  });

  it('does nothing without an action bar, and removeBadge cleans up', () => {
    document.body.innerHTML = '<article data-testid="tweet"></article>';
    const bare = document.querySelector('article')!;
    renderBadge(bare, { kind: 'loading' }, handlers());
    expect(bare.querySelector(`[${BADGE_ATTR}]`)).toBeNull();

    const article = setup();
    renderBadge(article, { kind: 'loading' }, handlers());
    removeBadge(article);
    expect(article.querySelector(`[${BADGE_ATTR}]`)).toBeNull();
  });
});
