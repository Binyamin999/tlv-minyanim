# TLV Minyanim — Project Context

A bilingual (Hebrew/English) web app for finding minyanim in Tel Aviv-Yafo.

**The user:** anyone who is *not where they usually prays* — a visitor, a business
traveller, a student, someone saying kaddish in an unfamiliar city, a local at a
meeting across town. The person who already knows their neighbourhood shul is not
our user.

**The product is not the list of buildings — it is the times.** Anyone can scrape a
synagogue directory. Nobody in Tel Aviv can currently answer *"where can I daven in
the next 40 minutes?"* That is what we are building.

---

## Scope

| | |
|---|---|
| v0 | Ramat Aviv — 16 synagogues (TAU, Neot Avivim, Ramat Aviv Gimmel) |
| Next | Kfar Shalem (27) -> Yad Eliyahu (28) -> Kiryat Shalom (19) |
| Schema | Built for all **484** Tel Aviv-Yafo synagogues from commit one |
| Services | Shacharit, Mincha, Arvit, **and Shabbat** |
| Timeline | Open-ended. Ship publicly once ~20 shuls are verified |

---

## Stack

- **Next.js (App Router) + TypeScript** — server-rendered. Every shul page must be
  crawlable; SEO is the entire discovery strategy.
- **Postgres + PostGIS** — real geo queries (radius, walking distance).
- **Vercel** for hosting, **GitHub** for source, **GitHub Actions** for the nightly
  refresh job.
- Never a client-only SPA. Never WordPress.

---

## THE CORE INVARIANT — read this twice

### A minyan time is a structured value, never a string.

Every minyan time is **one of**:

1. `fixed` — a clock time (`13:30`)
2. `relative` — a signed offset from a named zman (`shkia - 20min`, `netz + 0min`)
3. `unknown` — we do not know the offset yet

```ts
type MinyanTime =
  | { kind: 'fixed';    time: string }                       // "13:30"
  | { kind: 'relative'; anchor: Zman; offsetMinutes: number } // shkia - 20
  | { kind: 'unknown';  rawText: string }                     // "בזמן"

type Zman = 'alot' | 'netz' | 'shema' | 'chatzot' | 'mincha_gedola'
          | 'mincha_ketana' | 'plag' | 'shkia' | 'tzeit' | 'candle_lighting'
```

**Why this is non-negotiable:** LA Jewish Times stores relative times as the literal
text `"~25 Min before Netz"`. Those minyanim therefore cannot be sorted into a
timeline at all — their "next minyan" feature cannot see them. That single mistake
breaks the only feature that matters. We do not repeat it.

**Corollary:** ~60% of the source data says only `בזמן` ("at the proper time") with no
offset. That is `kind: 'unknown'`. **Never guess an offset.** A hallucinated Mincha
time is far worse than a blank — blank is honest, wrong destroys trust permanently.

### The one thing that looks like a guess and is not

`מנחה 1:30` means **13:30**. Mincha at 01:30 does not exist, so the time is
stated and only the clock convention is open — and for a given service exactly
one convention is possible. Resolving that is *reading* the source, not guessing
past it. Each service has a window it can occupy (Mincha 12:00–20:00, Shacharit
03:00–12:00, Arvit 16:30–23:59); a time outside its window gets one chance at
+12h, and if that lands inside, it was a 12-hour clock face.

Every shift is recorded in `clockNormalisation` so it stays auditable —
`WHERE clock_normalisation IS NOT NULL` returns all of them to check against a
photograph of the sign. Where **neither** reading is possible the record is
flagged `implausible_for_service` and held back, never repaired by guesswork.

The distinction from `בזמן`: there no time was written at all, so supplying one
is fabrication. Here the number is on the sign and we are reading it correctly.
A time already inside its window is **never** shifted.

### Computation is deterministic code, not a model

An agent's job is to determine the *rule*. A zmanim library applies the rule.
Never ask a model to compute a halachic time — it must be exact, reproducible, and free.

---

## Real data shapes the parser must handle

All verbatim from the Tel Aviv municipality GIS layer:

| Raw | Meaning |
|---|---|
| `מנחה 20 דק' לפי שקיעה` | `shkia - 20min` — an explicit offset |
| `מנחה - 10 דק' לפי כניסת שבת` | `candle_lighting - 10min` |
| `מנחה-בזמן` | offset **unknown** — do not guess |
| `שחרית-נץ-7:00` | **two** minyanim: netz-relative, and fixed 07:00 |
| `ח 12:30 ק 13:30` | winter 12:30 / summer 13:30 (`ח`=חורף, `ק`=קיץ) |
| `שחרית-6:30-7:30-9:00-10:00` | **four** separate Shacharit minyanim |
| `מנחה-13:30-13:55-בזמן` | two fixed + one unknown |
| `שחרית-7.30-8.30` | periods used instead of colons |
| `פתוח בחגים בלבד` | not a time — status is `holidays_only` |
| `גבאי: 054-… רב: 052-…` | two phone numbers in one field |

---

## Nusach taxonomy

Store `nusach` as an enum, plus separate optional `movement` and `style` tags.

```
nusach:   ashkenaz | sefard | edot_hamizrach | teimani | teimani_baladi | teimani_shami
          | moroccan | tunisian | iraqi | persian | salonikan | general
movement: chabad | breslev | null
style:    carlebach | hashkama | netz | null
```

**A synagogue serves a SET of rites, not one.** `synagogues.nusachim` is an
array; כלל ישראל serves `ashkenaz`, `edot_hamizrach` and `teimani`. An empty
array means we cannot name one, which is what `general` used to say — so
`general` no longer appears on a synagogue at all, and filtering to אשכנז now
finds a shul that serves it alongside two others rather than only shuls whose
single stated rite it happens to be.

**`general` is stored but never displayed.** It is what the municipality
writes when a shul does not describe itself as any particular nusach, so a
`כללי` tag says "unclassified" while looking exactly like `אשכנז` — a fact about
our data wearing the costume of a fact about the shul. Suppressed at the display
boundary in `displayNusach`, not deleted: the record keeps what the source said,
so a re-import never disagrees with the database and a shul that later tells us
its real nusach gets it filled in rather than corrected. It is also not offered
as a filter chip — `כל הנוסחים` still includes those shuls.

**`teimani` unqualified is a legitimate value.** The source usually says only
`תימני`, and recording that is reading it — choosing baladi or shami on a
congregation's behalf is the guess, and is still forbidden. Storing NULL instead
said "we do not know how they daven", which is less true than "Yemenite,
sub-rite unstated".

**Nusach also lives on `minyanim`, and NULL there means the house minyan.** One
building often runs several groups: כלל ישראל has `מניין אשכנזי-ספרדי` and
`מניין תימני` at different times, which is what the municipality's `כללי` meant
— not "unclassified" but "more than one". A minyan carries a nusach only when it
is a distinct group; the house minyan carries none. Never copy the synagogue's
nusach down onto its rows, or every ordinary minyan reads as a separate
congregation. `אשכנזי-ספרדי` is deliberately stored as the house minyan rather
than flattened to `ashkenaz`: two rites in one minyan has no single value, and
claiming nothing beats claiming the wrong thing.

**The source data has no Chabad or Breslev values** — it labels everything
`אשכנז / עדות המזרח / תימני / כללי / סלוניקאי`. In Ramat Aviv alone,
`תומכי תמימים - בית חב"ד` and `אוהל יוסף יצחק` are both Chabad houses tagged
`אשכנז`. Movement must be enriched by hand or from Chabad/Breslev directories.
**Never infer movement from the nusach field.**

---

## Data model notes

- **Address is not a unique key.** `היכל חיים` and `נוה קודש` are both at
  Oppenheimer 5 with different nusach — one building, two independent congregations.
- Every synagogue carries `last_verified_at` and `verified_by`, and the UI **displays
  it**. No competitor shows staleness. Honest decay is the whole trust model.
- `status`: `active | holidays_only | seasonal | dormant | closed`
- Gabbai phone numbers are personal data (Israeli privacy law). Consent before
  publishing; never commit them to a public repo.

---

## Structural decisions — undoing these reintroduces a bug

**Shiurim live in their own table, not behind a flag on `minyanim`.** A 7:00 daf
yomi is not a 7:00 Shacharit. A boolean column means one forgotten `WHERE`
clause turns a class into a minyan; a separate table makes it impossible. Five
of the sixteen shuls have one.

**Parse failures are stored, not dropped.** `parse_issues` exists so that text
the parser could not read is visible instead of silently vanishing — which is
the exact failure the parser was built to shout about. Zero rows today; that
will change at 484.

**The three-way time is a CHECK constraint, not just a TypeScript type.** A
`fixed` row cannot carry an anchor, an `unknown` row cannot carry a time. Verified
by trying to insert all three malformed shapes. An import script must not be able
to write in SQL what the types forbid in the app — if the importer trips it, the
importer is wrong.

**Hebrew sorts with `COLLATE "C"`.** The cluster default is `en_US.UTF-8`, which
orders Hebrew into nonsense — it put `המרכזי` before `אוהל`. Hebrew codepoints are
already alphabetical, and `"C"` exists everywhere, unlike `he-IL-x-icu`. This bug
is invisible to anyone not reading Hebrew.

**`is_publishable` is a generated column.** Computed, not a flag someone
remembers to set. A record with a non-empty `needs_review` cannot present as
confirmed.

## Internationalisation

- **Hebrew is primary, English is the wedge.** Routes: `/he/...` and `/en/...` from
  commit one. Retrofitting bilingual routing means losing every ranking.
- **RTL:** CSS logical properties only — `margin-inline-start`, never `margin-left`.
  Test mixed Hebrew + English + digits on one line; that is where RTL breaks.
- **All times in `Asia/Jerusalem`.** The Hebrew date rolls at **sunset**, not midnight.
- Tabular numerals everywhere times appear — columns must align.

---

## Design language — UNDER REVISION

> ⚠️ **The Bauhaus premise below failed its first contact with the user.** It was
> asserted here in the project's first draft and never chosen; five directions were
> then built on it, and the verdict on all five was *"doesn't remind me of Tel
> Aviv."* Shown against real photographs of the city, the diagnosis was clear: the
> palette is desaturated and the pages read as pale flat paper, while the actual
> city is high-contrast and luminous — vivid turquoise sea, deep indigo dusk, warm
> amber light, golden sand. Treat everything below as a hypothesis that lost, not
> as settled tokens. A replacement direction is being explored from photographic
> evidence rather than from architectural theory.

The one part that survives review: **the failure mode is a generic "Jewish
community site"** — Jerusalem stone, gold, navy, parchment, a Star of David as
ornament. Tel Aviv is the opposite city, and that still holds.

### Observed palette, sampled from photographs of the city

```css
--tlv-sea:     #2FA9BE;  /* Mediterranean shallows — saturated, not greyed */
--tlv-deep:    #1E8CAE;  /* the water further out */
--tlv-night:   #173A5E;  /* dusk sky over the promenade */
--tlv-ink:     #0C1116;  /* the city at night, near-black */
--tlv-amber:   #F0B45C;  /* lit windows and street lamps after dark */
--tlv-sand:    #E0CFB4;  /* the beach */
--tlv-terra:   #C0603A;  /* roof tiles */
```

### Two cyans, split by job — not by taste

The photographed cyan is a *sea* colour, and the sea is bright. Sampled straight
from the photo it is too light to carry text on a pale ground. So the palette
carries two, and which one you reach for depends on what the colour is *doing*:

```css
--tlv-sea:      #0E93AE;  /* DECORATION only — gradients, map glow, bare strokes */
--tlv-sea-ink:  #0A6C82;  /* anything where cyan is doing the job of text */
--tlv-terra-ink:#AD5634;  /* the darker terracotta — status tags, not the unknown row */
```

Non-text needs only 3:1, so `--tlv-sea` is correct in a gradient and wrong on a
label. Never darken `--tlv-sea` itself to make a label pass — that flattens the
sea and solves the wrong problem.

**Pick the darker value against the hardest background, not the easiest.** Cyan
text usually sits on a faintly cyan-tinted pill, not on white. `#0B7B93` passes
on white at 4.92 and fails on the tint at 4.28. `#0A6C82` clears both — 6.03 and
5.25.

**Current measured figures for the built homepage: 104 elements, zero failures,
worst 4.80 light / 5.12 dark**, and 4.59 / 5.12 swept across all eight warming
levels. Text over the photograph, which the DOM audit cannot see, measures 4.78
light / 5.89 dark by sampling the image.

An earlier note here claimed 5.05 / 6.34. Those came from a version of
`scripts/contrast-audit.js` with two real bugs, both since fixed: it read colours
with a regex, so `color-mix()`'s `oklab(...)` output parsed as near-black — and
81 elements on the homepage resolve to oklab — and its compositing assumed the
layer behind was opaque, so a tinted pill inside a translucent card inside the
page was measured against near-white. **Never hand-read a computed colour; paint
a pixel and read it back.**

**The honest-unknown row is quiet on purpose and passes anyway** (default ink at
75% = 7.9:1). If a contrast sweep ever seems to point at it, check what is
actually failing — most likely the *action* next to it. Do not "fix" the unknown
state by making it louder; its quietness is the design saying we don't know.

**And the action beside it is quiet too, now.** `יודעים את השעה? עדכנו` was bold
in the CTA colour next to a real walking link, so it read as tappable on most
rows of the default view — and it is not a link, because there is nowhere honest
to send anyone until the gabbai portal exists. It takes the same treatment as
the verified stamp it replaces in that slot: a note about what we know, not an
invitation. The wording is a statement for the same reason — it read
`יודעים את השעה? עדכנו`, telling a reader to do something no mechanism exists
for. It now says `לא אומת מול בית הכנסת`, which names what would change the
answer without asking the reader to be the one who changes it, and does not
repeat the unknown value directly above it.

Re-measure with `scripts/contrast-audit.js` in a browser, never by hand from the
source — real contrast depends on what is painted behind the label.

### Superseded — the original Bauhaus hypothesis

```css
--tlv-white:  #F7F6F2;  --tlv-ink:    #1A1D21;  --tlv-sea:    #0E6B7D;
--tlv-kurkar: #D9C7A7;  --tlv-bougie: #D2306B;  --tlv-shkia:  #E8743B;
```

**Type:** `Frank Ruhl Libre` for synagogue names (classic Hebrew serif, gravitas),
`Assistant` for UI (modern Israeli sans). Old and new together — that pairing *is*
the city. This part is not under revision; it held up under review and both faces
are already self-hosted in `public/fonts/`.

**Signature detail:** shkia here is over the Mediterranean. As real sunset
approaches, Mincha listings warm toward the sunset colour. Beautiful *and*
functional — the colour says your window is closing. Also not under revision; it
survives whatever palette replaces the above.

### Preview toggles are NOT features — do not build them

The design artboards carry toggle chips above them. Two of them are scaffolding
for choosing between options and **must never appear in the product**:

| Chip | What it is | Ships? |
|---|---|---|
| `sunset` | Previews the approaching-shkia state without waiting until 19:01 | **No** |
| `bleed` | Compares two header treatments while choosing between them | **No** |
| `אוטו׳ / sun / moon` | The light-dark override, drawn *inside* the page | **Yes** |

A static mockup cannot be 19:01, and cannot be two designs at once — hence the
first two. In the real site the sunset warming simply *happens*, computed from
that day's shkia by the zmanim library. Nobody switches it on. Shipping a
"sunset" button would be as wrong as shipping a button that makes it evening.

Light and dark follow the clock the same way — dark from real shkia, light from
real netz. The only genuine control is the override, for when the clock is right
and the room is not.

### Getting there

Every synagogue card carries a **walking**-directions control. The coordinates come
from the GIS layer, so the links are exact and need no geocoding:

```
https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=walking
```

**Walking, not driving — this is not a detail.** People walk to shul. Six minutes
to Oppenheimer 5, on foot, often on erev Shabbat. Driving directions are wrong for
nearly every journey this site serves.

**Waze sits beside walking everywhere, and never in front of it.** This
reverses an earlier decision that kept Waze on the synagogue page only; the
user asked for it on the cards and the hero too. What did not change is the
order — walking is always first, always carries the icon and the accent colour,
and Waze is the quiet second. Order is how the recommendation is made, now that
presence no longer carries it. It remains a driving app for the rarer
cross-town trip:

```
https://waze.com/ul?ll=<lat>,<lng>&navigate=yes
```

Note what this feature cannot do: on Shabbat many users will not touch a phone at
all. That is an argument for the printable Friday sheet, not against the button.

### Photography

Two fixed images site-wide: `tlv-day.jpg` in light mode, `tlv-night.jpg` in dark
mode, the same everywhere regardless of neighbourhood. They are the site's
identity, not evidence about a place — closer to a masthead than an illustration.
There is deliberately no per-neighbourhood photography and no fallback state.

**Never upscale a photograph past 1x.** Both current sources are small (679px and
416px), which is why the day header shows the photo sharp at partial width rather
than stretched across the band. The one exception is the dark-mode header, where
the image is deliberately blurred as ambient texture rather than shown as a
picture — softness there is the point, not a defect.

**Do not** default to warm editorial cream (`#F4F1EA`), Georgia/Playfair serif
display, or terracotta accents as a *ground*. That palette reads Lisbon or Tuscany.

---

## Zmanim — decisions that are already made

Ground truth lives in `docs/zmanim-ground-truth.md`, sourced from published
luachot rather than from the library we use. Never re-derive these by asking a
model; if a number here looks wrong, check it against that document and its
cited sources.

**Candle lighting in Tel Aviv is `shkia − 22min`, not 20.** `@hebcal/core`
ships 20 for the Tel Aviv geoname and Hebcal's own web pages print 20 — but the
Tel Aviv-Yafo Religious Council, the halachic authority for exactly the shuls
in this database, publishes 22, and MyZmanim labels it `22 דקות קודם השקיעה`.
Verified across all 34 published Fridays of 5786 in calendar 2026; no date fits
20, 21 or 23. Set explicitly in `CANDLE_LIGHTING_MINUTES_TLV`. Where published
authorities split, take the earlier: two minutes early costs nothing, two
minutes late is chillul Shabbat. **Tel Aviv only** — Jerusalem is 40, Haifa 30.

**`tzeit` means the stringent 8.5° value**, matching the Rabbanut. Be aware the
anchor is doing two jobs: `יציאת שבת` on a luach is 8.5° (≈ shkia + 39 here),
while a shul saying its Arvit is "at tzeit" usually means shkia + 13.5 to 25.
Resolving an Arvit minyan against 8.5° lists it **20+ minutes late** — the exact
failure this project exists to prevent.

**Any `tzeit`-anchored minyan is therefore flagged `ambiguous_tzeit` and held
back.** The anchor is kept, never published. This applies even when an offset
is stated: `20 דק' אחרי צאת הכוכבים` still does not say *which* nightfall it is
measured from. `shkia` and `netz` are unaffected — those anchors mean one thing
each. The guard has fired, and closing it took one question. בית חב"ד קניון רמת
אביב's board says Arvit at צאת הכוכבים; held rather than published, the shul
then said twenty minutes after shkia. Resolving its own word against the
luach's 8.5° would have listed it at 19:45 against a real 19:27 — eighteen
minutes late, on the first real minyan the guard ever saw.

**Never map a bare `בזמן` on an Arvit line onto any tzeit value** — that is
guessing an offset, and the flag above must not tempt anyone into treating
`בזמן` as "probably tzeit, flagged". If a shul's Arvit offset matters, ask the
gabbai.

**`candle_lighting` is undefined on most dates** and must resolve to *nothing*
on a Tuesday, never to `shkia − 32`. It is also undefined on the **second night
of a two-day Yom Tov**, when candles are lit after tzeit from a pre-existing
flame — that is not כניסת שבת and no minyan rule can mean it. hebcal marks that
event `LIGHT_CANDLES_TZEIS` *and* `LIGHT_CANDLES`, so a filter testing only the
latter admits it; reject by the tzeis flag first.

**In Israel this affects Rosh Hashana and nothing else.** Sukkot I, Shmini
Atzeret and Pesach are one-day chagim here, so when they fall on Shabbat the day
simply ends with havdalah and there is no second lighting. Checked: of
2026-09-12 (Rosh Hashana II), 2026-09-26 (Sukkot I) and 2026-10-03 (Shmini
Atzeret), only the first carries a tzeis lighting. Do not copy a diaspora
two-day assumption into Israeli data.

**`ח` / `ק` in the source data means the clock, not the season** — שעון חורף /
שעון קיץ, i.e. standard time vs DST. It is a DST distinction wearing seasonal
words, and the switch dates are Israel's, which are not the EU's or the US's.

**All zmanim come from the library.** Never compute one with a model, never
hand-roll the astronomy, and never store a resolved time — resolution happens at
read time so the rule stays correct as sunset moves.

## Data sources

| Source | What it gives |
|---|---|
| TLV GIS layer 568 | 484 shuls, WGS84 coords, nusach, rabbi, **442 gabbai phones**. Stale: last import 2025-06-13 |
| TLV GIS layer 545 / 580 | mikvaot / hotels (hotels = tourist landing pages) |
| Religious Council (rabanut.co.il) | Official index, mikvaot, **eruv map**, Shabbat times |
| Hebcal / KosherJava-derived | Zmanim + Hebrew calendar. Use a library, never hand-roll |

Endpoint: `https://gisn.tel-aviv.gov.il/arcgis/rest/services/WM/IView2WM/MapServer/568/query`
(unauthenticated; `outSR=4326` for WGS84)

---

## Erev Shabbat is its own day

`DayType` is `weekday | erev_shabbat | shabbat`. The Mincha and Kabbalat Shabbat
davened on **Friday** are not the Shacharit and Mincha davened on **Saturday**;
they are hours apart on different dates, and a row in the wrong one is offered a
day late.

**The parser never produces `erev_shabbat`.** The GIS `shabbat_times_raw` column
holds both days without saying which, so a row read from it stays `shabbat` and
the timeline holds it back as `erev_shabbat_time_unstated`. Only a source that
separates them — a printed sheet with a `ליל שבת` block — can set it.

**Never infer the day from the anchor.** The timeline used to treat a
Shabbat-column Mincha as erev Shabbat only if it was candle-lighting-anchored,
and that proxy failed against real evidence the first time it met any: כלל
ישראל's erev-Shabbat Mincha is `shkia − 20`, so correcting it away from the
municipality's wrong `candle_lighting − 10` moved the minyan from Friday to
Saturday and the homepage offered it "בעוד יום" when it was ninety minutes away.
An anchor says what a time is measured from, never which day it falls on.

## Verified times outrank the source

`src/lib/verified-times.ts` holds times a person read off a synagogue's own
notice board. It is the only thing that can honestly set `last_verified_at`, and
it **replaces the parsed times for that shul wholesale** — never merged, because
a record half from the sign and half from the municipality cannot be reasoned
about.

`verified_by` is a **code**, not prose: it is displayed in both languages, and
free text renders one language's sentence inside the other's page. It says *how*
rather than *who* — the file is public.

**A clock time can be true for a week and false afterwards.** כלל ישראל
reprints its weekday board weekly — its evening Mincha read 18:55 one week and
18:45 the next, `shkia − 17` then `shkia − 22`, so there is no offset to
extract. `valid_from` / `valid_until` on `minyanim` record how long the source
vouched for a time. Outside the window the row stops resolving and the shul
reads as honestly unknown (`validity_expired`), because 18:45 in December is
`shkia + 65` and showing it would be worse than showing nothing.

**Null on both means no stated end — and that is what a rule is.** `shkia − 20`
never expires because sunset moves with it. Never give a window to a relative
time, and never omit one from a clock face that cannot hold all year: there is
a test for each direction.

**"There are none" is not "we do not know".** `no_minyanim_on` is the only way
to state an absence, and a day listed there is a positive claim. בית חב"ד קניון
רמת אביב is inside a mall that closes for Shabbat and holds nothing on Friday
night or Saturday; its page said `אין שעות ידועות`, which tells a reader we are
missing data about a minyan that exists and sends them looking for it. Same
distinction as `בזמן` one level up: that is an unknown time for a service that
happens, this is a service that does not.

Absence can only ever be **stated, never parsed** — the GIS layer cannot say a
shul is closed on Shabbat, only fail to mention Shabbat, which is the unknown.
So the field lives on the verified record, defaults empty, and a day missing
from it stays unknown. היכל חיים has no Shabbat rows at all and claims nothing:
somebody still has to photograph that sheet. A test refuses a record that both
claims a day empty and lists a minyan on it.

**`held` is part of the record.** A sign carries more than we can store, and
writing down what was seen and deliberately not kept — with the reason — is what
stops the next reader thinking the sign was shorter than it was. Same instinct
as `parse_issues`: the failure is data.

**A clock face may only be stored as `fixed` if it is possible year-round.**
כלל ישראל's 14:00 Mincha qualifies — after mincha gedola and before shkia on all
365 days, and there is a test that sweeps them. Its 18:55 Mincha does not: that
is `shkia − 17` in August and `shkia + 135` in December, so it is held until
somebody supplies the rule. This is the check that catches a summer time
masquerading as a rule, and `implausible_for_service` does not do it — that
guard reads the clock face alone and 18:55 is a legal Mincha hour.

**One shul can run several minyanim.** כלל ישראל has `מניין אשכנזי-ספרדי` and
`מניין תימני` at different times, which is why the municipality tagged it
`כללי` — not "unclassified" but "more than one". The schema has one nusach per
synagogue and none per minyan, so only times the minyanim **share** are stored;
the rest is held. Fixing this properly means a nusach on `minyanim`.

## The refresh engine

Data rot is what kills every minyan directory. TLV10 is abandoned; the GIS layer is
14 months stale and does not admit it. Build these in order:

1. **Rule-based times** — a stored rule is correct forever as sunset moves (day one)
2. **Visible `last verified` date** on every listing (day one)
3. **Gabbai WhatsApp magic links** — 442 numbers, one round per season (week 2-3)
4. **Nightly diff job** — re-fetch sources, open a PR with proposed changes (week 3-4)
5. **User "was it there?" ✓/✗** — needs traffic; month 6, not before

---

## Definition of done

A change is done when:

- [ ] It renders correctly in **both** `/he/` and `/en/`, RTL and LTR
- [ ] It works at 375px wide on a slow connection
- [ ] No time is stored or displayed as an unparsed string
- [ ] Unknown offsets show as unknown — never as a guess
- [ ] `last_verified_at` is surfaced wherever a time is shown
- [ ] New shul pages emit `schema.org` `PlaceOfWorship` + `OpeningHoursSpecification`
- [ ] Tests pass, including the zmanim edge cases (DST, Adar I/II, sunset rollover)

## How we test time

**Never assert that a library returns what the library returns.** That proves
self-consistency and nothing else. Expected zmanim come from published luachot —
`docs/zmanim-ground-truth.md`, sourced independently of this code — and live in
`test/fixtures.zmanim-ground-truth.ts`. Regenerating them from `@hebcal/core`
would silently void every one of those tests.

**Check that a test can fail.** A green run on the first attempt is when to be
suspicious. Break the thing deliberately and confirm the failure: reverting
candle lighting to hebcal's 20 must fail six tests; switching tzeit from 8.5° to
7.083° must fail ten.

**Prefer a property over pinned dates** where one exists. "Candle lighting is
always before shkia, swept across 365 days" catches a class of bug; three
asserted dates catch three instances of it.

**Compare within a minute, except where a number is published.** Sources
disagree by seconds and we floor. Candle lighting is asserted exactly, because
reproducing the minute printed on the Council's poster is the point.

## Never

- Never store a time as a display string
- Never invent an offset for `בזמן`
- Never compute zmanim with a model instead of a library
- Never use `left`/`right` in CSS — logical properties only
- Never commit gabbai phone numbers to a public repository
- Never claim a listing is verified without a source and a date

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
