import { isIdeaWorthy } from './triage-priority';
import { findQuote } from './tweet-parser';
import type { Triage, TriageError } from './types';
import { BADGE_ATTR, SEL } from './x-dom-selectors';

export type BadgeState =
  | { kind: 'loading' }
  | { kind: 'ready'; priority: number; triage: Triage }
  | { kind: 'error'; error: TriageError };

export type BadgeHandlers = { onDraft: () => void; onIdea: () => void; onCopyHtml?: () => void };

const STYLE = `
:host { display: block; margin: 6px 0 2px; font: 12px/1.4 system-ui, sans-serif; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; color: rgb(113, 118, 123); }
.pill { font-weight: 700; padding: 1px 8px; border-radius: 9999px; color: #fff; }
.hi { background: #16a34a; } .mid { background: #ca8a04; } .lo { background: #6b7280; } .err { background: #dc2626; }
button { cursor: pointer; border: 1px solid rgba(113, 118, 123, 0.5); background: transparent; color: inherit;
  border-radius: 9999px; padding: 1px 10px; font: inherit; }
button:hover { background: rgba(29, 155, 240, 0.1); color: rgb(29, 155, 240); }
`;

const ERROR_TEXT: Record<TriageError, string> = {
  no_key: 'Jev key missing or invalid (open side panel settings)',
  rate_limited: 'Jev rate limited, will retry',
  http: 'Jev request failed, will retry',
  invalid: 'Skipped',
  dropped: 'Skipped while scrolling fast, will retry',
};

function host(article: Element, create: boolean): HTMLElement | null {
  const existing = article.querySelector<HTMLElement>(`[${BADGE_ATTR}]`);
  if (existing || !create) return existing;
  const quote = findQuote(article);
  const bar = [...article.querySelectorAll(SEL.actionBar)].filter((g) => !quote?.contains(g)).pop();
  if (!bar) return null;
  const el = document.createElement('div');
  el.setAttribute(BADGE_ATTR, '');
  // X opens the tweet on clicks inside the article; keep our clicks from reaching it.
  for (const type of ['click', 'pointerdown', 'mousedown', 'mouseup', 'keydown']) {
    el.addEventListener(type, (e) => e.stopPropagation());
  }
  el.attachShadow({ mode: 'open' });
  bar.after(el);
  return el;
}

function span(text: string, className = '', title = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.textContent = text;
  if (className) s.className = className;
  if (title) s.title = title;
  return s;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function content(state: BadgeState, handlers: BadgeHandlers): HTMLElement[] {
  if (state.kind === 'loading') return [span('…')];
  if (state.kind === 'error') return [span('⚠', 'pill err', ERROR_TEXT[state.error])];
  const { priority, triage: t } = state;
  const tier = priority >= 70 ? 'hi' : priority >= 40 ? 'mid' : 'lo';
  const scores = `quality ${t.quality.toFixed(2)} · reply opening ${t.replyOpening.toFixed(2)} · build idea ${t.buildIdea.toFixed(2)}`;
  const parts = [span(String(priority), `pill ${tier}`, scores), span(t.action), span(t.topic)];
  if (isIdeaWorthy(t)) parts.push(span('💡', '', `Worth saving as an idea (build idea ${t.buildIdea.toFixed(2)})`));
  if (t.projectMatch !== 'none') parts.push(span(`↗ ${t.projectMatch}`));
  if (t.uncertain) parts.push(span('?', '', 'Jev is not confident about this one'));
  if (t.botInstructions > 0.5) parts.push(span('⚠ bait', '', 'Post contains instructions aimed at bots/AI'));
  parts.push(button('Draft', handlers.onDraft), button('Idea', handlers.onIdea));
  return parts;
}

export function renderBadge(article: Element, state: BadgeState, handlers: BadgeHandlers): void {
  const root = host(article, true)?.shadowRoot;
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  const row = document.createElement('div');
  row.className = 'row';
  row.append(...content(state, handlers));
  if (handlers.onCopyHtml) row.append(button('Copy HTML', handlers.onCopyHtml));
  root.replaceChildren(style, row);
}

export function removeBadge(article: Element): void {
  host(article, false)?.remove();
}
