# Photo reference — reset after "doesn't remind me of Tel Aviv"

All viewed on Wikimedia Commons, 2026-08-23, via the in-session browser. Chosen
because Commons licensing is unambiguous, so these could be used for real if the
product ever ships photography (see Photographic.dc.html, which hotlinks one of
these rather than reproducing it as an asset).

## 1. Blue hour skyline — the one actually used

**File:** `TelAviv zur blauen Stunde - panoramio.jpg`
**URL:** https://commons.wikimedia.org/wiki/File:TelAviv_zur_blauen_Stunde_-_panoramio.jpg
**Author:** Martin Furtschegger · **License:** CC BY 3.0
**Live thumb used in Photographic.dc.html:**
`https://commons.wikimedia.org/wiki/Special:FilePath/TelAviv_zur_blauen_Stunde_-_panoramio.jpg?width=750`
(Special:FilePath 302-redirects to the real upload.wikimedia.org file — confirmed
by navigating to it directly.)

**What it's evidence of:** this is the single most useful reference of the session.
The sky is a *saturated cobalt blue*, not a near-black — CLAUDE.md's `#173A5E`
undersells how much colour is still in the sky forty minutes after sunset. Clouds
catch a faint pink-orange from the vanished sun. The lit tower is warm white/amber
window-light against the blue, and the foreground pedestrian-bridge railings are lit
hot red-pink — an unplanned but very useful confirmation that a magenta/bougainvillea
accent reads as "city lighting," not just "flower," at night. Correction to
CLAUDE.md: night in Tel Aviv is not `#0C1116` uniformly — that's correct only for
the deepest zenith late at night; the working "after dark" sky is a rich blue
gradient, and it's the gradient that reads as luminous rather than dead-flat black.

## 2. Promenade in the late evening

**File:** `Promenade in the late evening (34641871006).jpg`
**URL:** https://commons.wikimedia.org/wiki/File:Promenade_in_the_late_evening_(34641871006).jpg
(Flickr import — reference only, not embedded anywhere.)

**What it's evidence of:** true near-black sky (later than photo #1), warm gold
building facades and streetlamps along the tayelet, black palm silhouettes, and —
notably — one tower lit in a deliberate magenta/purple pattern in the middle
distance. Confirms the amber-lamp + black-palm-silhouette + occasional saturated
pink/magenta architectural lighting as a real, recurring combination, not a
one-off in photo #1.

## 3. Tel Aviv Beach, 2019 (01) — night pergola

**File:** `Tel Aviv Beach, 2019 (01).jpg`
**URL:** https://commons.wikimedia.org/wiki/File:Tel_Aviv_Beach,_2019_(01).jpg
(reference only)

**What it's evidence of:** warm sodium-amber light on wood/concrete promenade
structures at night, near-black sky, black palm silhouettes — reinforces #2.

## 4. Aerial coastline — daylight sea colour

**Files:** `Israel Batch 1 (7).JPG` and `WikiAir IL-12-01 029.JPG`, both in
Category:Aerial views of the Mediterranean coast, Tel Aviv-Yafo (reference only)

**What it's evidence of:** in actual (slightly hazy) daylight the water reads as a
teal-grey-blue close to shore deepening to navy further out — less uniformly
"tropical postcard turquoise" than CLAUDE.md's `#2FA9BE` in overcast/hazy
conditions, but unmistakably teal/green-blue rather than the muted grey-teal
`#0E6B7D` of the rejected Bauhaus direction. Correction: keep `#2FA9BE`-family as
the *ideal/clear-sky* sea colour (it's real, just needs good light), but don't be
surprised production photography on a hazy day looks greyer — the design tokens
should target the vivid version since that is what makes the site feel alive, and
matches what beachgoers remember rather than what a hazy Tuesday actually looked
like in one aerial shot.

## Net correction to CLAUDE.md's sampled numbers

- Night sky: use a **gradient**, not a flat near-black — near-black at the zenith,
  saturated cobalt-indigo through the middle, and allow a faint warm horizon band.
  Flat `#0C1116` everywhere is what made earlier attempts feel dead rather than
  "after dark."
- Amber and magenta/bougainvillea both appear as *real architectural lighting* at
  night, not just as invented brand accents — that de-risks using bougainvillea
  pink as a night-mode accent color, sparingly, exactly as CLAUDE.md already
  intended for daytime "happening now" tags.
- Sea turquoise (`#2FA9BE`) is correct as the target/ideal, sampled from clear-sky
  imagery elsewhere; hazy aerial shots read greyer, which is a lighting-conditions
  fact, not a reason to mute the token.

## Second pass — day/night pair, candidates already on disk

Three photographs were provided pre-downloaded for this session at
`design/reference/candidates/cand1.jpg` / `cand2.jpg` / `cand3.jpg`, evaluated
for `PhotoDayDesktop.dc.html` / `PhotoNightDesktop.dc.html`. Not independently
re-sourced — evaluated as given.

**cand1.jpg** — golden-hour beach, Jaffa clocktower on the horizon, CC BY 2.0.
Beautiful, but it is sunset, not midday. Ruled out for the *day* file: using a
sunset photo to represent "day" would make the site look permanently ~19:15 and
directly undercuts the sunset-warming behaviour (see below). Not ruled out for
future use *as* the sunset/transition state, if the product ever wants a third
visual state between day and night.

**cand2.jpg** — ground-level promenade at midday, CC BY 2.0. The only genuinely
daylight option on hand, and disqualified anyway: a man is seated in close
foreground and a woman is mid-stride, both clearly identifiable, which is a
privacy problem the moment this ships, independent of the fact that the framing
is also cluttered street-level clutter rather than the horizontal, sea-facing
read this product wants.

**Conclusion for day mode: no photograph.** `PhotoDayDesktop.dc.html` uses
DaySea/DaySeaDesktop's painted sky-to-sea gradient (horizon line, sun glare)
as-is. This is not a placeholder pending a better photo — every daylight
candidate actually available had a disqualifying flaw, and a flat saturated
gradient reads as honest midday without inventing an hour or exposing a
bystander.

**cand3.jpg** — moonlit skyline seen from Jaffa, sea and coastline curve in
frame, CC BY-SA 3.0. Judged **better than `tlv-blue-hour.jpg`** (the image
currently live in the night header) on content: it actually has the sea and a
coastline curve, which blue-hour lacks entirely (blue-hour is an inland tower
and a pedestrian-bridge crossing, with two identifiable pedestrians and a
hot-red neon rail that fights this palette). Not yet swapped in, because a
gnarled tree fills roughly the right third of cand3's frame and climbs across
the top, and this header is a very wide, short letterbox — at that aspect ratio
`object-fit: cover` is width-bound, so the *entire* source width is forced into
view regardless of `object-position`; the tree cannot be cropped out by position
alone. Excluding it requires deliberately over-zooming the image past the
`cover` minimum and panning with explicit `width` + `inset-inline-end` +
`inset-block-start` (worked out in a comment inside `PhotoNightDesktop.dc.html`,
first-pass estimate: `width: 2100px` against an assumed ~3:2 source, cutting the
frame to its own left ~61%, panned to `inset-block-start: -840px` to land on the
building line and water rather than the sky/moon). Unverified — this session's
browser preview cannot load local images inside the canvas pipeline's `data:`
URL context, so the crop could not be confirmed against the actual pixels.
**Action for next session:** enable the basename `tlv-night-skyline.jpg` against
`cand3.jpg`, then nudge the two inset values while looking at the rendered
result — do not trust the numbers above past "first estimate."
