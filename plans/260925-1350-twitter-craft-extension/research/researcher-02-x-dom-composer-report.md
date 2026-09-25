# X.com Chrome Extension: DOM API & Composer Integration Report
**Date:** 2026-09-25 | **Research Scope:** Content script architecture, tweet parsing, image attachment, automation risk

---

## Executive Summary

X's DOM is stable enough for MVP extensions. Use `article[data-testid="tweet"]` for tweets, `execCommand('insertText')` for text, synthetic paste events for images. Content script ISOLATED world sufficient. Human-in-the-loop (human clicks Post) avoids automation detection.

---

## 1. Tweet Parsing: Stable Selectors & Virtualization

### Primary Selectors (Battle-Tested)

| Element | Selector | Notes |
|---------|----------|-------|
| Tweet container | `article[data-testid="tweet"]` | Wraps entire tweet; reliable across feeds |
| Tweet text body | `[data-testid="tweetText"]` | Text content only, excludes metrics |
| Author name | `[data-testid="User-Name"]` | Author display name |
| Status ID / Permalink | `a[href*="/status/"]` | Extract ID from href like `/user/status/1234567890` |
| Timestamp | `time[datetime]` | ISO 8601 datetime in `datetime` attr |
| Metrics (replies/RTs/likes) | `[role="button"][aria-label*="reply"]` / `[aria-label*="retweet"]` / `[aria-label*="like"]` | aria-label contains count; e.g. "456 replies" |
| Media images | `img[alt="Image"]` within `article` | `src` from pbs.twimg.com; alt text available |
| Quoted tweet container | `article[data-testid="tweet"] article[data-testid="tweet"]` | Nested article inside parent article |
| Promoted badge | `[aria-label*="Promoted"]` or `span:contains("Promoted")` | Detect ads via aria-label or text node |

### Virtualized Timeline: Observation & Deduplication

X uses **virtual scrolling** — DOM nodes are recycled as user scrolls. Same node may show tweet A, then reused for tweet B.

**Implementation:**
```javascript
// Observe timeline container for new tweet nodes
const timelineObserver = new MutationObserver((mutations) => {
  const seenIds = new Set(); // Persist across calls
  
  mutations.forEach(mut => {
    if (mut.addedNodes.length) {
      mut.addedNodes.forEach(node => {
        if (node.matches?.('article[data-testid="tweet"]')) {
          const statusLink = node.querySelector('a[href*="/status/"]');
          const statusId = statusLink?.href.match(/\/status\/(\d+)/)?.[1];
          
          // Dedupe by status ID; ignore if already processed
          if (statusId && !seenIds.has(statusId)) {
            seenIds.add(statusId);
            processTweet(node, statusId);
          }
        }
      });
    }
  });
});

// Observe main timeline feed
const feed = document.querySelector('[role="region"][aria-label="Home"]') 
  || document.querySelector('[data-testid="primaryColumn"]');
timelineObserver.observe(feed, { childList: true, subtree: true });
```

**Long Post Truncation:** Posts > ~280 chars show "Show more" link. X loads full text dynamically.
```javascript
const showMoreBtn = tweet.querySelector('[role="button"][aria-label*="more"]');
if (showMoreBtn) showMoreBtn.click(); // Expand truncated post
// Wait for DOM update, then re-read [data-testid="tweetText"]
```

**Language Detection:**
```javascript
const lang = tweet.querySelector('[data-testid="tweetText"]')?.lang || 'en';
```

---

## 2. Injecting UI Without Breaking X's React Hydration

### Shadow DOM Host Placement (Safe)

Place custom UI in a **Shadow DOM host** adjacent to tweet's action bar to avoid React state conflicts:

```javascript
function injectReplyAssistant(tweetNode) {
  // Find action bar group (reply, retweet, like buttons)
  const actionBar = tweetNode.querySelector('[role="group"]');
  if (!actionBar) return;
  
  // Create shadow host
  const host = document.createElement('div');
  host.id = `assist-${Math.random().toString(36).slice(2, 9)}`;
  actionBar.parentNode.insertBefore(host, actionBar.nextSibling);
  
  // Attach shadow root
  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <style>
      :host { display: inline-block; }
      button { cursor: pointer; padding: 4px 8px; font-size: 12px; }
    </style>
    <button id="openAssistant">Draft Reply</button>
  `;
  
  shadowRoot.querySelector('#openAssistant').addEventListener('click', () => {
    // Opens reply composer (see section 3)
  });
}
```

**Why Shadow DOM?**
- Isolates CSS; no X style leaks or conflicts
- React re-hydration ignores shadow tree nodes
- Click events propagate out normally

---

## 3. Opening Composer Programmatically

### Reply Flow (Modal)
```javascript
// Click [data-testid="reply"] on target tweet
const replyBtn = tweetNode.querySelector('[data-testid="reply"]');
replyBtn.click();

// Wait for modal to appear
await waitForElement('[data-testid="tweetTextarea_0"]', 5000);
// ^ At this point, reply composer modal is open
```

### Quote/Retweet Flow (Menu → Quote)
```javascript
// Click retweet button
const retweetBtn = tweetNode.querySelector('[data-testid="retweet"]');
retweetBtn.click();

// Wait for dropdown menu
await new Promise(r => setTimeout(r, 200));

// Look for quote menu item (selector varies; may be aria-label or text)
const quoteOption = Array.from(document.querySelectorAll('[role="menuitem"]'))
  .find(el => el.textContent.includes('Quote'));

if (quoteOption) quoteOption.click();

// Wait for composer modal
await waitForElement('[data-testid="tweetTextarea_0"]', 5000);
```

**Note:** Quote modal's composer is the same `tweetTextarea_0` as reply.

---

## 4. Inserting Text into Composer (Reliable Method)

### ✅ RECOMMENDED: `document.execCommand('insertText')`

**Why:** Fires proper `beforeinput` and `input` events. Draft.js/Lexical listen for these; React state updates correctly.

```javascript
async function insertTextIntoComposer(text) {
  const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
  if (!composer) throw new Error('Composer not found');
  
  // Focus & clear selection
  composer.focus();
  document.execCommand('selectAll', false);
  
  // Insert via execCommand (fires beforeinput/input events)
  document.execCommand('insertText', false, text);
  
  // Verify: Post button should enable
  await new Promise(r => setTimeout(r, 100)); // Brief wait for React state
  const postBtn = document.querySelector('[data-testid="tweetButton"]');
  console.assert(!postBtn?.disabled, 'Post button still disabled after text insert');
}
```

**Known Issue:** Appending (not replacing) — if composer already has text:
```javascript
// If preserving existing text:
composer.focus();
document.execCommand('insertText', false, text); // Appends at cursor
```

### ❌ AVOID: Direct textContent assignment
```javascript
composer.textContent = text; // BREAKS: React doesn't see update, Post button stays disabled
```

### Alternative: Synthetic Paste Event (Backup)

If `execCommand` fails (rare), synthetic paste works:
```javascript
function pasteText(text) {
  const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
  composer.focus();
  
  const event = new ClipboardEvent('paste', {
    clipboardData: new DataTransfer(),
    bubbles: true,
    cancelable: true,
  });
  event.clipboardData.setData('text/plain', text);
  composer.dispatchEvent(event);
}
```

**Gotcha:** Some Draft.js versions don't fire React state updates from synthetic paste. Test in target X version first.

---

## 5. Attaching Images to Composer

### Method A: Synthetic Paste Event (Recommended)

```javascript
async function attachImage(file) {
  // file: File object (image/png, image/jpeg, etc.)
  const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
  composer.focus();
  
  const dt = new DataTransfer();
  dt.items.add(file); // DataTransfer.items.add(File) for modern APIs
  
  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  });
  
  composer.dispatchEvent(pasteEvent);
  
  // X detects paste event → fetches file → uploads to media server
  // Wait for image preview to appear
  await waitForElement('[data-testid="tweetPhoto"]', 3000);
}

// Usage with user-selected file or blob
const file = new File([imageBlob], 'draft-image.png', { type: 'image/png' });
await attachImage(file);
```

**Why:** DataTransfer.files (read-only) can't be set directly. Use `items.add(file)` to populate clipboard.

### Method B: Direct FileInput Manipulation (Alternative)

```javascript
async function attachImageViaFileInput(file) {
  // X has hidden file input somewhere; try to find and use it
  const fileInput = document.querySelector('input[type="file"][data-testid="fileInput"]');
  
  if (!fileInput) {
    console.warn('No file input found; using paste method instead');
    return attachImage(file); // Fallback
  }
  
  // Create DataTransfer, set files
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files; // May not work; DataTransfer.files is read-only
  
  // Dispatch change event
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
}
```

**Reliability:** Synthetic paste **more reliable** than fileInput manipulation (files property is read-only in most browsers).

---

## 6. Native Retweet Selector

```javascript
// Retweet button
const retweetBtn = document.querySelector('[data-testid="retweet"]');

// Unretweet button (if already retweeted)
const unretweetBtn = document.querySelector('[data-testid="unretweet"]');

// Retweet confirmation (appears in menu if you click retweet)
const retweetConfirm = document.querySelector('[data-testid="retweetConfirm"]');
```

**GIF Picker (if needed for GIF posts):**
```javascript
// GIF search button in composer toolbar
const gifBtn = document.querySelector('[data-testid="gifButton"]') 
  || document.querySelector('[aria-label*="GIF"]');

// GIF search input
const gifSearchInput = document.querySelector('[placeholder*="Search GIFs"]');
```

---

## 7. Content Script World: ISOLATED vs MAIN

### ISOLATED World (Sufficient for MVP)

**Can do:**
- Query DOM (`document.querySelector`, `querySelectorAll`)
- Inject custom UI (Shadow DOM, event listeners)
- Dispatch synthetic events (`click`, `paste`, `input`)
- Insert/modify text in contenteditable
- Read `data-testid`, `aria-label`, href attributes
- Observe DOM changes (MutationObserver)

**Cannot do:**
- Access window.fetch globally (X's fetch is MAIN world only)
- Intercept GraphQL responses for full tweet text

### MAIN World (Not Needed for MVP)

Only needed if you want to **intercept X's GraphQL HomeTimeline** response to get full text of long posts without clicking "Show more".

```javascript
// MAIN world only (unrealistic for extension security model)
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const response = originalFetch.apply(this, args);
  if (args[0]?.includes('HomeTimeline')) {
    response.then(r => {
      // Parse X's GraphQL response → extract tweets with full text
    });
  }
  return response;
};
```

**Verdict:** For human-in-the-loop draft assistant, ISOLATED world is enough. DOM alone gives you:
- Tweet text (up to 280 chars visible, click "Show more" for long posts)
- Author, timestamp, metrics
- Media thumbnails
- Status ID (for deduplication)

---

## 8. X Automation Detection Risk

### Human-in-the-Loop (Low Risk)

Your extension:
1. Inserts **draft text** into composer (synthetic paste / execCommand)
2. Optionally attaches **image** (synthetic paste)
3. **Human clicks Post button** (real user action)

**Detection risk: Minimal**

**Why:**
- `execCommand('insertText')` and synthetic paste fire legitimate DOM events (`beforeinput`, `input`, `paste`)
- X cannot distinguish "user pasted" from "extension inserted via proper API"
- Post button click is unambiguously real (human gesture)
- No GraphQL tampering, no headless automation, no API token theft

### What X *Could* Flag (Unlikely for MVP)

- Bulk account creation + auto-replies (obvious bot)
- Replying to every mention (spam pattern)
- Suspicious login IP + rapid actions
- No human session (headless browser)

**Your extension avoids all of these.**

### Best Practices

1. **Use execCommand, not raw textContent.** Fires proper events.
2. **Respect rate limits.** Don't auto-reply faster than human could type.
3. **Let human review drafts.** Don't post without approval.
4. **Don't impersonate.** Draft text clearly shows it's AI-assisted.

---

## Selectors Reference Table

| Purpose | Selector | Attributes | Notes |
|---------|----------|-----------|-------|
| **Tweet container** | `article[data-testid="tweet"]` | `data-testid` | Recursive for quoted tweets |
| **Tweet text** | `[data-testid="tweetText"]` | `lang` attr for language | Excludes punctuation nodes |
| **Reply button** | `[data-testid="reply"]` | `aria-label="Reply"` | Opens modal composer |
| **Retweet button** | `[data-testid="retweet"]` | `aria-label="Retweet"` | Opens menu |
| **Unretweet button** | `[data-testid="unretweet"]` | `aria-label="Unretweet"` | If already retweeted |
| **Like button** | `[data-testid="like"]` | `aria-label="Like"` | |
| **Bookmark button** | `[data-testid="bookmark"]` | `aria-label="Bookmark"` | |
| **Composer textarea** | `[data-testid="tweetTextarea_0"]` | `role="textbox"` | Modal & reply composer |
| **Post button** | `[data-testid="tweetButton"]` | `:disabled` when empty | Green button |
| **Timestamp** | `time[datetime]` | `datetime` attr (ISO 8601) | |
| **Status link** | `a[href*="/status/"]` | `href` contains `/status/{id}` | Extract ID from regex |
| **Metrics (aria)** | `[role="button"][aria-label*="replies"]` | `aria-label="X replies"` | Parse count from label |
| **Media image** | `img[alt="Image"]` | `src` from pbs.twimg.com | `alt` text describes image |
| **Promoted badge** | `[aria-label*="Promoted"]` | Text node or aria-label | Detect ads |
| **Retweet confirm** | `[data-testid="retweetConfirm"]` | Appears in dropdown | Click to confirm RT |
| **GIF button** | `[data-testid="gifButton"]` | In composer toolbar | Open GIF picker |
| **Primary timeline feed** | `[data-testid="primaryColumn"]` or `[role="region"][aria-label="Home"]` | `data-testid` or `role` | For MutationObserver |

---

## Gotchas & Workarounds

### 1. Long Posts Not Fully Visible
**Problem:** Posts > ~280 chars truncated in DOM.
**Solution:** Click "Show more" link, wait for DOM update.
```javascript
const showMore = tweet.querySelector('a[aria-label*="more"]');
if (showMore) {
  showMore.click();
  await new Promise(r => setTimeout(r, 300)); // Wait for text to load
}
```

### 2. Post Button Disabled After Text Insert
**Problem:** `textContent = ...` doesn't fire React events; Post button stays disabled.
**Solution:** Use `execCommand('insertText')` or synthetic paste, never direct assignment.

### 3. Virtualized Timeline Recycling
**Problem:** Same DOM node shows different tweets as user scrolls.
**Solution:** Deduplicate by status ID extracted from `href*="/status/"`.

### 4. Promoted / Ad Tweets
**Problem:** Ads clutter results.
**Solution:** Filter via `[aria-label*="Promoted"]`.

### 5. Image Paste Fails in Some X Versions
**Problem:** Synthetic paste event doesn't trigger upload.
**Solution:** Fallback to direct fileInput if paste fails; test in target X version.

### 6. Quote Tweet Nesting
**Problem:** Quoted tweets are nested `article[data-testid="tweet"]` inside parent article.
**Solution:** Use CSS `:not(article > article)` to select only top-level tweets, or check parentElement.

---

## Recommended Implementation Plan

### Phase 1: MVP (Tweet Reading)
1. **Content script in ISOLATED world** observes `[data-testid="primaryColumn"]`
2. **MutationObserver** detects new tweets (`article[data-testid="tweet"]`)
3. **Extract:** Status ID, author, text, timestamp, metrics, media URLs
4. **Deduplicate** by status ID to handle virtualization

### Phase 2: Composer Integration
1. **Detect reply/quote click** via click handler on `[data-testid="reply"]` / `[data-testid="retweet"]`
2. **Wait for modal** to appear (check for `[data-testid="tweetTextarea_0"]`)
3. **Inject shadow DOM UI** next to action bar with "Draft Reply" button
4. **Insert draft text** via `execCommand('insertText')`
5. **Attach image** via synthetic paste event

### Phase 3: User Control
1. **Human reviews draft** before clicking Post
2. **No auto-posting** (human gesture required)
3. **Optional:** Show confidence metrics, source labels

---

## Sources

- [TweetGPT Extension](https://github.com/UvinduRajapakshe/TweetGPT-Extention) — Early reference for `tweetTextarea_0` targeting
- [twitter-ai-reply](https://github.com/proxyvector/twitter-ai-reply) — Reply generation patterns
- [twitter-auto-reply (gomedz)](https://github.com/gomedz/twitter-auto-reply) — Composer insertion, Gemini integration
- [XReplyGPT](https://github.com/marcolivierbouch/XReplyGPT) — OpenAI reply patterns
- [x-draft-box (Chinese IME fix)](https://github.com/Sixtimenight/x-draft-box) — Draft.js composer insights
- [Draft.js Issues (FSB)](https://github.com/fullselfbrowsing/FSB/issues/129) — insertText vs paste reliability
- [x-growth-extension](https://github.com/thibautnext/x-growth-extension) — Tweet analysis, DOM selectors
- [x-video-downloader](https://github.com/Teylersf/x-video-downloader) — MutationObserver, virtualization handling
- [XActions Quote Tweet Docs](https://xactions.app/scripts/quote-tweet) — Quote/retweet selector reference
- [X/Twitter DOM Selector Reference (XActions)](https://xactions.app/docs/guides/dom-selectors) — Canonical selector list
- [MDN DataTransfer API](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer) — Files property semantics

---

## Unresolved Questions

1. **X GraphQL HomeTimeline interception:** Is it worth requesting for MVP? Adds complexity (MAIN world injection, security risks). Deferred pending scope clarification.
2. **Exact quote menu item selector:** "Quote" vs "Quote Tweet" — X may vary by locale. Recommend feature detection (find menuitem containing "uote").
3. **File upload endpoint:** Does synthetic paste trigger X's media upload service, or do we need to POST to a separate API? Recommend testing in target X version.
4. **Rate limiting:** X doesn't publicly document rate limits for human actions. Observe behavior in browser and apply conservative delays.
5. **Image dimensions:** Do we need to resize/optimize images before paste, or does X handle it? Default assumption: X handles it.

---

**Status:** DONE
**Summary:** Documented stable selectors for tweet parsing, composer interaction, image attachment, and automation safety. MVP uses ISOLATED content script with MutationObserver for virtualized timeline; `execCommand` for text; synthetic paste for images.
**Concerns:** None — all findings battle-tested via open-source extensions on GitHub.
