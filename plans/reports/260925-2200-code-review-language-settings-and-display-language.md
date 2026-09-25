# Code review: language settings + display language (EN/VI)

Scope: uncommitted diff (24 modified files) + new `lib/i18n/*`, `lib/languages.ts`, `hooks/use-i18n.tsx`, `components/language-chips.tsx`, `tests/i18n-and-languages.test.ts`.
Verified locally: `pnpm compile` clean, `pnpm test` 251/251.

## Verdict
No blockers. All template-literal keys resolve (checked against TRIAGE_ACTIONS, TriageError, InsertResult, GifResult, IDEA_STATUSES, CARD_KINDS, REPLY_ANGLES + 'quote'). Pending action / draft session are unaffected by the provider's null render. The same-panel uiLanguage save cannot be overwritten by form Save. A few real defects below.

## Medium
1. **Page language never follows uiLanguage (a11y, WCAG 3.1.1)**: `entrypoints/sidepanel/index.html:2` hard-codes `<html lang="en">`; `hooks/use-i18n.tsx:14` never updates it. Screen readers read Vietnamese UI with an English voice. Badge host on X inherits X's `lang` too (`lib/tweet-badge.ts` host()).
   Fix: in `apply()` add `document.documentElement.lang = l;`; in `renderBadge` set `root.host.lang` (or row `lang`) to the current language (export a `getLang()` from `lib/i18n`).
2. **Select/chips hide saved codes outside LANGUAGES**: `components/settings-view.tsx:98`. A legacy free-text `ideaLanguage` (e.g. `th`, `vn`, `id`) matches no option, so React selects the first option: the UI shows "English" while `th` stays saved. Picking "English" does not fire `change` (already selected), so the user must pick another language first. `LanguageChips` keeps unknown `readableLanguages` codes active but invisible and unremovable.
   Fix: render an extra `<option value={v}>{v}</option>` when `!LANGUAGES.some(l => l.code === v)`; render unknown chip codes as removable chips (or drop them on load).

## Low
3. **Stale uiLanguage from another window**: `settings-view.tsx:90,77`. If window A changes the language, window B's provider re-renders in the new language, but B's select still shows `form.uiLanguage` (old). B's Save writes the old value back. Fix: drive the select from the provider's language (expose `useLang()`) and save with `{ ...fromForm(form), uiLanguage: lang }`. Do NOT drop uiLanguage from the form without doing this: `fromForm` parses with `SettingsSchema`, and a missing uiLanguage defaults to the browser language.
4. **setUiLanguage read-modify-write**: `lib/settings-store.ts:35`. If Save lands between its `getSettings()` and `saveSettings()`, it rewrites the pre-Save snapshot. The window is a few ms, so hard to hit by hand. It is the same pattern as `addVoiceSample`. Fix (optional): serialize settings writes through one promise chain.
5. **Badges drawn before `get-prefs` resolves use the browser language**: `entrypoints/x-timeline.content/index.ts:29-35,54-56,106-109`. Manual ("not scored") badges on post pages never get a triage response, so they keep the browser language until X re-renders them. This only affects users whose chosen language differs from the browser's, and is most likely with a cold SW. Fix: start `scan()` after `get-prefs` settles (`.finally(scan)`), or re-render manual entries in `applyPrefs` when the language changes.
6. **Untranslated visible text**: `components/card-panel.tsx:67` `<Chip>{card.kind}</Chip>` (insight/code/compare). `lib/tweet-badge.ts:105` shows the raw topic enum (`ai_ml`, `off_topic`); the plan chose this, but these are identifiers, not model prose.
7. **`t()` has no runtime fallback**: `lib/i18n/index.ts:18`. An unknown key (the `as MessageKey` cast, or an unexpected outcome string from the tab) returns `undefined`. With `vars`, `undefined.replace` throws. Fix: `DICTIONARIES[current][key] ?? en[key] ?? key`.
8. **`useT()` returns a stable `t` identity**: `hooks/use-i18n.tsx:27`. Any future `useMemo/useCallback(..., [t])` would freeze strings in the old language. Related: `App` now passes a fresh `options` array on every render (`app.tsx:37`), so SegmentedTabs' layout effect forces a reflow on every App render, including draft keystrokes. Fix: return a per-language function (`useMemo(() => (k, v) => t(k, v), [lang])`) so the identity changes with the language, and memo the options on it.
9. **Translated strings stored in state don't switch language**: `s.error`, `s.note`, toasts, `capture.error`, the IdeaRow error. They stay in the old language until the next action. Acceptable, just noting it.
10. **Vietnamese copy** (`lib/i18n/vi.ts`):
    - L100 `status.dropped: 'bỏ'` reads as the imperative "drop" in the status select and filter. Use `'đã bỏ'`.
    - L171 `badge.error.invalid: 'Bỏ qua'` reads as "Skip!". Use `'Đã bỏ qua'`; L172 should likewise start with `'Đã bỏ qua…'`.
    - L157-158 `'đang chấm'` / `'không chấm'` are ambiguous ("chấm" also means dot). Use `'đang chấm điểm'` / `'không chấm điểm'`, and update the badge test at `tests/i18n-and-languages.test.ts:39`.
    - L40 `angle.reaction: 'cảm xúc'` means "emotion". Use `'phản ứng'`.
    - L61 `gif.gif_disabled: 'X chỉ cho ảnh hoặc GIF.'` loses the "not both" meaning. Use `'X chỉ cho đính kèm ảnh hoặc GIF, không được cả hai.'`
    - L150 `'Quá 30 giây.'`: use `'Quá thời gian chờ (30 giây).'`
11. **Minor a11y**: `Field id="readableLanguages"` emits `<label for="readableLanguages">` with no target. Hints are not wired with `aria-describedby`. Options and chips with native names (日本語, 한국어…) lack `lang`.
12. **Plan/docs completeness**: `docs/system-architecture.md:194` still lists DisplayPrefs as 3 fields. The changelog and codebase-summary are not updated (Phase 3 requirement). The plan phases are still `pending`. The removed `readableLanguages` form assertion has no array replacement test.

## Checked, no issue
- `DisplayPrefsSchema` is exported but unused: no message path parses prefs, so adding `uiLanguage` breaks nothing. Background `FALLBACK_PREFS` includes it.
- WXT `watch` passes `newValue ?? fallback` (raw stored object). `asUiLanguage` guards bad or missing values.
- `I18nProvider` null render: `usePendingAction` reads on mount and watches, the action persists in storage (60 s max age), so nothing is missed. `useDraftSession` has no mount-time dependency.
- Same-panel race: `set('uiLanguage')` updates the form, so a later Save writes the same value.
- `vi` is `Record<MessageKey,string>`, so missing or extra keys fail compile. The placeholder-parity test covers `{vars}`.
- Vietnamese font subsets are loaded for JetBrains Mono and Inter.

**Status:** DONE_WITH_CONCERNS
**Summary:** No blockers. 2 medium defects: html/badge `lang` is never updated, and the select/chips mis-display saved codes outside the list. Several low items: stale cross-window form, badges drawn before prefs arrive, missing `t()` fallback, VI copy nits.
