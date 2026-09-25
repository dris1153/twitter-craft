import type { ContentMessage, TriageResponse } from '@/lib/messages';
import { removeBadge, renderBadge, type BadgeHandlers } from '@/lib/tweet-badge';
import { isTopLevelTweet, parseTweet, quickStatusId } from '@/lib/tweet-parser';
import { computePriority, isIdeaWorthy } from '@/lib/triage-priority';
import type { DisplayPrefs, Triage, Tweet } from '@/lib/types';
import { createVisibilityGate } from '@/lib/visibility-gate';
import { expandTweet, insertDraft, isPanelMessage } from '@/lib/x-composer';
import { openGifPicker } from '@/lib/x-composer-media';
import { BADGE_ATTR, SEL } from '@/lib/x-dom-selectors';
import { isOverlayRoute, isTriageRoute, routeKey, triageMode } from '@/lib/x-routes';

// route: the post page this was evaluated on ('' elsewhere); manual: a reply shown without a score.
type Entry = { id: string; tweet: Tweet | null; triage: Triage | null; route: string; manual?: boolean };

const RETRY_MS = 15_000;

export default defineContentScript({
  matches: ['https://x.com/*'],
  main(ctx) {
    const setDim = (article: Element, dim: boolean) => {
      (article as HTMLElement).style.opacity = dim ? '0.45' : '';
    };
    // Leftovers from a previous (reloaded) instance of the extension.
    document.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll(SEL.tweet).forEach((a) => setDim(a, false));

    let prefs: DisplayPrefs = { minQuality: 40, dimLowScore: true, debug: false };
    const entries = new WeakMap<Element, Entry>();
    const observed = new WeakSet<Element>();
    const send = <T>(msg: ContentMessage) => browser.runtime.sendMessage(msg) as Promise<T>;

    // Requests from our side panel (tabs.sendMessage). Page scripts cannot reach this listener.
    browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || sender.tab || !isPanelMessage(raw)) return;
      const work: Promise<unknown> =
        raw.type === 'expand-tweet'
          ? expandTweet(raw.statusId)
          : raw.type === 'open-gif-picker'
            ? openGifPicker(raw.query)
            : insertDraft(raw.statusId, raw.mode, raw.text, raw.imageDataUrl);
      const fallback = { 'expand-tweet': null, 'open-gif-picker': 'no_gif_button', 'insert-draft': 'not_found' }[raw.type];
      work.then(sendResponse, () => sendResponse(fallback));
      return true;
    });

    void send<DisplayPrefs>({ type: 'get-prefs' })
      .then((p) => (prefs = p))
      .catch(() => {});

    // The page under any modal. Opening the reply composer or the media viewer changes the URL, but
    // the page (and its badges) stays; only a real navigation should re-evaluate badges.
    let pagePath = location.pathname;
    const currentPage = () => {
      if (!isOverlayRoute(location.pathname)) pagePath = location.pathname;
      return pagePath;
    };

    const reset = (article: Element) => {
      entries.delete(article);
      removeBadge(article);
      setDim(article, false);
    };

    const handlersFor = (article: Element): BadgeHandlers => {
      const open = (kind: 'draft' | 'idea') => {
        // Re-read at click time: the node may now show a different tweet than when the badge was drawn.
        const tweet = parseTweet(article);
        const entry = entries.get(article);
        if (!tweet || tweet.id !== entry?.id) return;
        void send({ type: 'open-panel', kind, tweet, triage: entry.triage }).catch(() => {});
      };
      return {
        onDraft: () => open('draft'),
        onIdea: () => open('idea'),
        onCopyHtml: prefs.debug ? () => void navigator.clipboard.writeText(article.outerHTML).catch(() => {}) : undefined,
      };
    };

    const renderReady = (article: Element, tweet: Tweet, triage: Triage) => {
      const priority = computePriority(triage, tweet);
      renderBadge(article, { kind: 'ready', priority, triage }, handlersFor(article));
      setDim(article, prefs.dimLowScore && priority < prefs.minQuality && !isIdeaWorthy(triage));
    };

    async function evaluate(article: Element): Promise<void> {
      const page = currentPage();
      if (ctx.isInvalid || isOverlayRoute(location.pathname) || !isTriageRoute(page)) return;
      const tweet = parseTweet(article);
      const route = routeKey(page);
      const known = entries.get(article);
      if (!tweet || (known?.id === tweet.id && known.route === route)) return;
      const mode = triageMode(tweet, page);
      entries.set(article, { id: tweet.id, tweet, triage: null, route, manual: mode === 'manual' });
      if (mode === 'skip') {
        removeBadge(article);
        return;
      }
      if (mode === 'manual') {
        setDim(article, false);
        renderBadge(article, { kind: 'manual' }, handlersFor(article));
        return;
      }
      renderBadge(article, { kind: 'loading' }, handlersFor(article));

      let res: TriageResponse;
      try {
        res = await send<TriageResponse>({ type: 'triage', tweet });
      } catch {
        const cur = entries.get(article);
        if (!ctx.isInvalid && cur?.id === tweet.id && cur.route === route) reset(article);
        return;
      }
      const cur = entries.get(article);
      if (cur?.id !== tweet.id || cur.route !== route) return; // node recycled or page changed while waiting
      prefs = res.prefs;
      if (res.ok) {
        entries.set(article, { id: tweet.id, tweet, triage: res.triage, route });
        renderReady(article, tweet, res.triage);
        return;
      }
      renderBadge(article, { kind: 'error', error: res.error }, handlersFor(article));
      if (res.error === 'invalid') return;
      entries.delete(article);
      // Retry while the user keeps looking at it; the gate re-checks visibility.
      ctx.setTimeout(() => {
        if (article.isConnected && !entries.has(article)) gate.recheck(article);
      }, RETRY_MS);
    }

    const gate = createVisibilityGate((el) => void evaluate(el));

    const scan = () => {
      const route = routeKey(currentPage());
      for (const article of document.querySelectorAll(SEL.tweet)) {
        if (!isTopLevelTweet(article)) continue;
        if (!observed.has(article)) {
          observed.add(article);
          gate.observe(article);
          continue;
        }
        const entry = entries.get(article);
        if (!entry) continue;
        if (quickStatusId(article) !== entry.id || entry.route !== route) {
          reset(article);
          gate.recheck(article);
        } else if (!article.querySelector(`[${BADGE_ATTR}]`)) {
          // X re-rendered the action bar (e.g. after "Show more") and took our badge with it.
          if (entry.tweet && entry.triage) renderReady(article, entry.tweet, entry.triage);
          else if (entry.manual) renderBadge(article, { kind: 'manual' }, handlersFor(article));
        }
      }
    };

    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    ctx.onInvalidated(() => {
      mo.disconnect();
      gate.disconnect();
      document.querySelectorAll(SEL.tweet).forEach((a) => setDim(a, false));
      document.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
    });
  },
});
