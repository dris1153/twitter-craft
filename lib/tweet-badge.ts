import { getLang, t as translate } from './i18n';
import { isIdeaWorthy } from './triage-priority';
import { findQuote } from './tweet-parser';
import type { Triage, TriageError } from './types';
import { BADGE_ATTR, SEL } from './x-dom-selectors';

export type BadgeState =
  | { kind: 'loading' }
  | { kind: 'manual' } // a reply on a post's page: no score, Draft/Idea still available
  | { kind: 'ready'; priority: number; triage: Triage }
  | { kind: 'error'; error: TriageError };

export type BadgeHandlers = { onDraft: () => void; onIdea: () => void; onCopyHtml?: () => void };

// DESIGN.md chips: cream fill, charcoal border, hard offset shadow. Literal values (the side panel's
// CSS tokens don't reach this shadow root); timings mirror assets/motion.css.
const STYLE = `
:host { display: block; margin: 6px 0 2px;
  font: 500 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, "JetBrains Mono", monospace; letter-spacing: 0.02em; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; color: rgb(113, 118, 123); }
.pill, .chip, button { display: inline-flex; align-items: center; border: 1.5px solid #383838; border-radius: 2px;
  padding: 0 6px; font: inherit; line-height: 18px; color: #383838; background: #f4efea; box-shadow: -2px 2px 0 #383838; }
.pill { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hi { background: #6fc2ff; } .mid { background: #ffde00; } .err { background: #f38e84; }
.outline { background: transparent; color: inherit; border-color: currentColor; box-shadow: none; }
button { cursor: pointer; font-weight: 600;
  transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1); }
button:hover { background: #ebf9ff; }
button:active { transform: translate(-2px, 2px); box-shadow: none; }
button:focus-visible { outline: 2px solid #6fc2ff; outline-offset: 2px; }
.shimmer { position: relative; color: #818181; }
.shimmer::before { content: attr(data-text) / ""; position: absolute; inset: 0 6px; pointer-events: none;
  background: linear-gradient(90deg, transparent 40%, #383838 50%, transparent 60%) no-repeat;
  background-size: 400% 100%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; animation: shimmer 2000ms linear infinite; }
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }
.pop .d { display: inline-block; animation: pop 500ms cubic-bezier(0.34, 1.36, 0.64, 1) both; }
@keyframes pop { from { transform: translateY(8px); opacity: 0; filter: blur(2px); } }
@media (prefers-reduced-motion: reduce) {
  .shimmer::before, .pop .d { animation: none !important; }
  button { transition: none !important; }
}
`;

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

// Digits pop in once, staggered 40 ms, the first time a score lands on this tweet.
function score(priority: number, tier: string, title: string, pop: boolean): HTMLSpanElement {
  const pill = span('', `pill ${tier}${pop ? ' pop' : ''}`, title);
  [...String(priority)].forEach((digit, i) => {
    const d = span(digit, 'd');
    d.style.animationDelay = `${i * 40}ms`;
    pill.append(d);
  });
  return pill;
}

const actions = (h: BadgeHandlers) => [button(translate('badge.draft'), h.onDraft), button(translate('badge.idea'), h.onIdea)];

function content(state: BadgeState, handlers: BadgeHandlers, fresh: boolean): HTMLElement[] {
  if (state.kind === 'loading') {
    const s = span(translate('badge.scoring'), 'chip shimmer');
    s.dataset.text = s.textContent!;
    return [s];
  }
  if (state.kind === 'manual') {
    const why = translate('badge.notScoredWhy');
    return [span(translate('badge.notScored'), 'chip outline', why), ...actions(handlers)];
  }
  if (state.kind === 'error') return [span('⚠', 'pill err', translate(`badge.error.${state.error}`))];
  const { priority, triage: t } = state;
  const tier = priority >= 70 ? 'hi' : priority >= 40 ? 'mid' : 'lo';
  const scores = translate('badge.scores', { quality: t.quality.toFixed(2), reply: t.replyOpening.toFixed(2), build: t.buildIdea.toFixed(2) });
  const parts = [score(priority, tier, scores, fresh), span(translate(`action.${t.action}`)), span(t.topic)];
  if (isIdeaWorthy(t)) parts.push(span('💡', '', translate('badge.ideaWorthy', { build: t.buildIdea.toFixed(2) })));
  if (t.projectMatch !== 'none') parts.push(span(`↗ ${t.projectMatch}`));
  if (t.uncertain) parts.push(span('?', '', translate('badge.uncertain')));
  if (t.botInstructions > 0.5) parts.push(span(`⚠ ${translate('badge.bait')}`, '', translate('badge.baitWhy')));
  parts.push(...actions(handlers));
  return parts;
}

export function renderBadge(article: Element, state: BadgeState, handlers: BadgeHandlers): void {
  const root = host(article, true)?.shadowRoot;
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  const row = document.createElement('div');
  row.className = 'row';
  row.lang = getLang(); // X's page lang would make screen readers use the wrong voice
  row.append(...content(state, handlers, !root.querySelector('.pill:not(.err)')));
  if (handlers.onCopyHtml) row.append(button(translate('badge.copyHtml'), handlers.onCopyHtml));
  root.replaceChildren(style, row);
}

export function removeBadge(article: Element): void {
  host(article, false)?.remove();
}
