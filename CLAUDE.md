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
nusach:   ashkenaz | sefard | edot_hamizrach | teimani_baladi | teimani_shami
          | moroccan | tunisian | iraqi | persian | salonikan | general
movement: chabad | breslev | null
style:    carlebach | hashkama | netz | null
```

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

**Do not** default to warm editorial cream (`#F4F1EA`), Georgia/Playfair serif
display, or terracotta accents as a *ground*. That palette reads Lisbon or Tuscany.

---

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

## Never

- Never store a time as a display string
- Never invent an offset for `בזמן`
- Never compute zmanim with a model instead of a library
- Never use `left`/`right` in CSS — logical properties only
- Never commit gabbai phone numbers to a public repository
- Never claim a listing is verified without a source and a date
