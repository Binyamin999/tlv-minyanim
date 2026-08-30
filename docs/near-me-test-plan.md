# Test plan — "Find a minyan near me"

What the feature promises, what was tested and how, what could not be
tested and why, and where the coverage lives. Written for the next person
touching `src/components/NearMe.tsx` or `src/lib/distance.ts`, not as a
transcript of this session.

## The contract, restated as testable claims

1. The board (hero + every card) is complete, server-rendered HTML with no
   distance text, on both locales, with JS disabled.
2. Nothing runs on page load. The permission prompt fires only on tap.
3. On a successful fix, every element with `data-lat`/`data-lng` gets a
   walking time + distance in `.near-slot`, and a `data-reach` verdict of
   `reachable` | `too_far` | `unknown`.
4. `.near-too-far` shows, and the row dims to 0.62 opacity, iff
   `data-reach="too_far"`.
5. `.cards` is re-sorted nearest-first among rows that have a time
   (`data-at`); rows with no time are never sorted in among them — they stay
   last, in their original order.
6. The hero is measured (gets a verdict, a distance, a dimming state) but is
   **never** moved — it is not a child of `.cards` and the sort never touches it.
7. Beyond 250 m of accuracy, or for any row with no time, the verdict is
   `unknown`, never a guess.
8. The position never leaves the device: no fetch, no query param, no
   `localStorage`/`sessionStorage`, no cookie.
9. Permission denial and fix failure both leave the board exactly as the
   server rendered it, with distinct, honest copy for each.

## What's automated, and where

| Level | What | Where |
|---|---|---|
| Unit | Pure arithmetic: haversine, walking-time floor, accuracy gate, metre/km formatting, all four never-optimistic invariants | `test/distance.test.ts` (pre-existing), `test/distance-boundaries.test.ts` (added — accuracy exactly at the 250 m limit, a negative countdown, exact-minute and exact-km boundaries) |
| E2E | The actual shipped client bundle, driven by Playwright against the running production build: reachable / too_far / unknown (no time) / unknown (vague accuracy), the sort invariant (synthetic *and* real `?service=mincha` unknown-time rows), the hero-never-resorts invariant, both refusal paths (denied / position-unavailable), repeated taps, no-network/no-storage, console cleanliness, SSR completeness, JS-disabled behaviour | `e2e/near-me.e2e.test.ts` |

Run the unit suite with the rest of the repo:

```
npm test
```

Run the E2E suite explicitly, against the already-running build (it is
**not** part of the `npm test` glob on purpose — see the file header for why):

```
node --test e2e/near-me.e2e.test.ts
```

It needs `http://127.0.0.1:3100` answering and a Chromium binary (both were
already present in this environment); if neither is available the suite
fails immediately in `before()` with a message telling you what's missing,
rather than hanging on `page.goto()`.

### Why E2E and not a component unit test

`NearMe.tsx` is a `'use client'` `.tsx` file. Node's type-stripping loader —
which every other test in this repo relies on via `node --test` — cannot
load a `.tsx` file at all, and cannot parse JSX inside a `.ts` one. There is
no dependency here that provides a DOM (no `jsdom`), so the only way to
exercise `decorate()` and the render logic together is a real browser.
Playwright was already a devDependency with Chromium already downloaded, so
the E2E suite drives the *actual compiled production bundle* rather than a
reimplementation — which matters, because a reimplementation could pass
while the shipped code regresses.

Where the task brief's tool limit ("you cannot override
`navigator.geolocation`, the pane will not grant a real position") applies
to the interactive browser pane specifically. Playwright launches its own,
separate Chromium and can set geolocation exactly — including `accuracy`,
which is the one input this feature treats as a hard gate and which no other
technique available here can produce. Mid-session the coordinating agent
lifted that limit explicitly and pointed at `scripts/browse.mjs`, a
Playwright-based manual-exploration script already committed to the repo;
its approach (grant permission + set a position at the context level, then
drive the real click) is exactly what `e2e/near-me.e2e.test.ts` automates.

Synthetic cards (`addSyntheticCard()` in the E2E file) are injected into the
real, live `.cards` container via `page.evaluate()` with the same markup
shape real cards have (`[data-lat][data-lng]`, `.near-slot`, `.near-too-far`).
This is test setup done at runtime in the browser — it never touches a file
on disk — and it exists so the sort/zero-distance regression tests are exact
and independent of whatever the 16 (soon 484) seeded shuls happen to look
like on the day the suite runs. One test additionally checks the real
`?service=mincha` unknown-time rows, so the synthetic tests aren't the only
evidence for the sort invariant.

## What was not automated, and why

- **Real device GPS behaviour** (cold fix latency, indoor accuracy
  degradation, permission UI on iOS Safari vs. Android Chrome). Nothing short
  of a physical device does this honestly; Playwright's geolocation mock is a
  faithful stand-in for the *application's* handling of a position, not for
  what a real GPS radio reports.
- **3G throughput** for this feature specifically. The button and its
  decoration are a few hundred bytes of already-shipped JS; the interesting
  3G question for this feature is "does the permission prompt block first
  paint" (answered here: no — nothing runs until tap, verified above) rather
  than a payload-size measurement, which belongs with the site's general
  performance testing, not this feature's.
- **Full WCAG contrast sweep** of `.near-me-note` / `.near-too-far` against
  every background they can sit on. The project already has
  `scripts/contrast-audit.js` for exactly this, run against the whole
  homepage; re-running it was out of scope for a single feature's test pass,
  but see the accessibility finding below — it's a gap in *feedback*, not
  contrast.
- **Visual regression** (pixel-diffing the dimmed/too-far state, the sort
  animation-free reflow) — no baseline images exist for this site yet; a
  handful of manual screenshots were taken instead (see below) and matched
  the design intent.

## Manual / exploratory testing performed

Using `scripts/browse.mjs` (already in the repo) and the interactive browser
pane, for everything that does not need to *drive* a live position through
the pane (which the original tool limit correctly ruled out):

- Standing exactly on כלל ישראל / בית חב"ד רמת אביב ג' (same address): all
  real cards sort ascending by distance, hero unaffected, no console errors,
  no storage written.
- 4 km away (Dizengoff Center, "outside coverage" on purpose) with the hero's
  own countdown forced to 5 minutes: hero shows `too_far`, the warning text,
  and 0.62 opacity — confirming the hero *is* decorated even though it's
  never resorted.
- `accuracy: 600` at כלל ישראל: every row (hero included) reads `unknown`
  despite being right next to several of them; the vague-position note shows.
  Distance text is still printed — only the verdict is withheld.
- `--deny`: nothing is decorated anywhere on the board; the denial note shows
  the correct, non-alarmist copy; zero console errors.
- Dark mode and English locale at 375 px: no horizontal overflow in either;
  screenshots visually match the design's quiet, non-clickable-looking
  refusal/vague copy and the `.near-too-far` warning colour.
- RTL structural check: `.near-me` sits inside `.place`, immediately after
  the neighbourhood name and before the filter chips, in both the accessibility
  tree and the rendered layout, matching the spec.

## Defects found

See the chat response for the numbered, most-severe-first list with concrete
inputs and outputs. Summary for anyone reading only this file:

1. **[Fixed during this session, regression-guarded]** A hydration mismatch
   (React error #418) fired on *every* homepage load in a real browser,
   because the pre-fix capability check
   (`typeof navigator !== 'undefined' && 'geolocation' in navigator`) ran
   during render and evaluated differently on the server (Node has a
   `navigator` global with no `.geolocation`) than in any real browser. Fixed
   by moving the check into the click handler; the button now always
   renders identically on both sides. Guarded by
   `near-me: console cleanliness (guards the hydration-mismatch fix)` in the
   E2E suite, which fails loudly if this pattern returns here or appears
   elsewhere (a repo-wide grep for `typeof window`/`typeof navigator`/
   `typeof document` found no other instance at the time of writing).
2. **Accessibility gap, not fixed.** None of the button's state changes
   (`locating…`, denied, failed, vague, or a successful fix) are announced
   to assistive technology — there is no `aria-live`/`role="status"` region
   anywhere in `NearMe.tsx`. A screen reader user who taps the button gets no
   spoken confirmation that anything happened at all beyond re-reading the
   board from the top.
3. **Minor / dead-comment mismatch.** `decorate()`'s doc comment says its
   return value lets "the button say nothing happened if the answer is
   none," but no code path reads `state.count === 0` — there is no
   zero-results branch in the render at all. Likely unreachable today (every
   shul has coordinates, per the data-integrity invariant), but the comment
   promises behaviour the component doesn't have.

## A note on verifying claims about server-rendered HTML

An earlier draft of the E2E SSR check did `fetch(url).text()` and grepped
for markers of "was this rendered." That is unsound: the response also
contains the RSC payload — a `<script>` block serialising every component's
props verbatim — so a label passed as a prop (e.g. `nearMe.walk`, "דק׳
הליכה") matches even when no distance was ever computed. The fix
(`withoutScripts()` in `e2e/near-me.e2e.test.ts`) strips every
`<script>…</script>` block before asserting anything about "what was
rendered," and the test asserts on the *shape* of a computed distance
(`\d+ ... ·`) rather than a bare label substring, so it cannot be satisfied
by the dictionary alone. Any future check on this codebase that greps raw
HTML for a string that also appears in `src/i18n/dictionaries.ts` should be
treated as suspect for the same reason.
