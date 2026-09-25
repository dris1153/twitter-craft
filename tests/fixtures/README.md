# Tweet fixtures

`translated-quote.html` is a real capture (Vietnamese UI, auto-translated quote tweet; SVG path data stripped).
The others are hand-written from X's DOM structure (Vietnamese UI).
Replace each with a real capture: enable Debug in settings, click "Copy HTML" on a tweet badge,
paste into the matching file, and keep the test expectations in sync.

`ad.html` stays hand-written: the account is Premium and rarely sees ads. Low risk either way, since ads
are public and usually have no timestamp permalink, so `parseTweet` returns null and they are skipped.
`protected-reply.html` also stays hand-written: the user rarely sees protected tweets. Detection checks both
`[data-testid="icon-lock"]` and the lock's aria-label; if a 🔒 tweet ever shows a badge, capture it
(with names and text replaced by placeholders) and fix `x-dom-selectors.ts` / `x-locale-keywords.ts`.
