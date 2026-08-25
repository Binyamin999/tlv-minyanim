-- 0001_init.sql — synagogues and minyanim.
--
-- Sized for all 484 Tel Aviv-Yafo synagogues from commit one even though only
-- Ramat Aviv is populated: adding rows later is free, adding structure later is
-- a migration.
--
-- Deliberately absent: any gabbai or rabbi phone column. The GIS layer carries
-- 442 gabbai numbers and they are personal data under Israeli privacy law.
-- Storing them is a later decision that needs consent, and a public repo must
-- never carry the schema that invites it in casually.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

-- Nusach as the source labels it. Note what is NOT here: chabad and breslev.
-- The GIS layer tags both Ramat Aviv Chabad houses as `אשכנז`, so movement can
-- never be inferred from this column — it is a separate, hand-enriched field.
CREATE TYPE nusach AS ENUM (
  'ashkenaz',
  'sefard',
  'edot_hamizrach',
  'teimani_baladi',
  'teimani_shami',
  'moroccan',
  'tunisian',
  'iraqi',
  'persian',
  'salonikan',
  'general'
);

CREATE TYPE movement AS ENUM ('chabad', 'breslev');

CREATE TYPE minyan_style AS ENUM ('carlebach', 'hashkama', 'netz');

CREATE TYPE synagogue_status AS ENUM (
  'active',
  'holidays_only',
  'seasonal',
  'dormant',
  'closed'
);

CREATE TYPE service AS ENUM ('shacharit', 'mincha', 'arvit');

-- Which column of the source the time came from, never inferred from the text.
CREATE TYPE day_type AS ENUM ('weekday', 'shabbat');

-- `ח` = חורף / `ק` = קיץ. NULL means the source stated no season, i.e. the time
-- holds year round. It never means "we forgot to look".
CREATE TYPE season AS ENUM ('winter', 'summer');

-- THE CORE INVARIANT, in the database. There is no fourth kind.
CREATE TYPE minyan_time_kind AS ENUM ('fixed', 'relative', 'unknown');

-- Named halachic anchors, resolved by a zmanim library at render time.
CREATE TYPE zman AS ENUM (
  'alot',
  'netz',
  'shema',
  'chatzot',
  'mincha_gedola',
  'mincha_ketana',
  'plag',
  'shkia',
  'tzeit',
  'candle_lighting'
);

-- 'explicit'   — the source used לפני / אחרי.
-- 'convention' — the source used לפי, which is not literally directional;
--                CLAUDE.md fixes it as *before*. Publishable, worth re-checking.
CREATE TYPE sign_basis AS ENUM ('explicit', 'convention');

-- ---------------------------------------------------------------------------
-- synagogues
-- ---------------------------------------------------------------------------

CREATE TABLE synagogues (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- OBJECTID from TLV GIS layer 568. NULL for congregations added by hand or
  -- reported by a gabbai. UNIQUE tolerates many NULLs, which is what we want.
  gis_source_id     integer UNIQUE,

  -- URL segment, shared by /he/<slug> and /en/<slug> so the two locales are one
  -- page in two languages rather than two pages.
  slug              text NOT NULL UNIQUE,

  name_he           text NOT NULL,
  -- NULL = not translated yet. Better an empty English name than an invented one.
  name_en           text,
  address_he        text,
  address_en        text,

  -- geography, not two floats: distance here is metres on the sphere, and the
  -- question this product answers is "how far do I have to walk".
  location          geography(Point, 4326) NOT NULL,

  nusach            nusach,
  movement          movement,   -- NULL is the norm; never inferred from nusach
  style             minyan_style,

  status            synagogue_status NOT NULL DEFAULT 'active',

  -- Displayed in the UI on every listing. Honest decay is the trust model.
  last_verified_at  timestamptz,
  verified_by       text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- "Never claim a listing is verified without a source and a date."
  CONSTRAINT synagogue_verification_is_sourced
    CHECK ((last_verified_at IS NULL) = (verified_by IS NULL)),

  CONSTRAINT synagogue_slug_is_url_safe
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- NOTE: there is deliberately no unique constraint on any address column.
-- היכל חיים and נוה קודש are both at אופנהיימר 5 with different nusach — one
-- building, two independent congregations. Keying on address would silently
-- delete one of them at import time.

-- The radius query. GiST on geography makes ST_DWithin an index scan.
CREATE INDEX synagogues_location_idx ON synagogues USING GIST (location);
CREATE INDEX synagogues_status_idx ON synagogues (status);

COMMENT ON COLUMN synagogues.location IS
  'WGS84 point from the GIS layer (outSR=4326). Walking distance, via ST_DWithin on geography.';
COMMENT ON COLUMN synagogues.last_verified_at IS
  'Surfaced in the UI wherever a time is shown. NULL = never verified, and the UI says so.';

-- TODO(phase 3): neighbourhood. Ramat Aviv / Kfar Shalem / Yad Eliyahu want
-- their own landing pages, which most likely means a `neighbourhoods` table
-- with its own geometry rather than a text column here.

-- ---------------------------------------------------------------------------
-- minyanim
-- ---------------------------------------------------------------------------

CREATE TABLE minyanim (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  synagogue_id        bigint NOT NULL REFERENCES synagogues (id) ON DELETE CASCADE,

  -- NULL when the source gave a bare time with no service word. Never guessed;
  -- such a row always carries an `unattributed_service` review reason and so
  -- can never be published.
  service             service,
  day_type            day_type,
  season              season,

  -- --- the three-way time -------------------------------------------------
  kind                minyan_time_kind NOT NULL,

  -- kind = 'fixed'. `time` without a zone: every clock face in this product is
  -- Asia/Jerusalem, and storing a timestamptz would pin a recurring rule to a
  -- single date and a single DST offset.
  fixed_time          time,

  -- kind = 'relative'. Signed: negative = before the zman, positive = after.
  anchor              zman,
  offset_minutes      integer,
  -- NULL is legitimate on a relative row: a bare `נץ` is offset 0, and an
  -- offset of zero has no sign to have got wrong.
  sign_basis          sign_basis,

  -- kind = 'unknown'. The source text, verbatim — typically `בזמן`. Kept so the
  -- row is auditable, and never rendered as if it were a time.
  raw_text            text,

  -- --- provenance ---------------------------------------------------------
  raw_segment         text NOT NULL,   -- the slice this minyan was read from
  raw_field           text NOT NULL,   -- the whole original field, untouched
  source_index        integer NOT NULL, -- position within the field, 0-based

  -- {from, to, basis} when a 12-hour clock face was resolved to its only
  -- possible 24-hour reading. A conversion is a claim about the source, so it
  -- stays queryable: WHERE clock_normalisation IS NOT NULL returns every one.
  clock_normalisation jsonb,

  -- ReviewReason[] from the parser. Non-empty ⇒ never published.
  needs_review        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- The publication gate, computed rather than trusted to the writer. A row is
  -- publishable only when nothing is pending review AND we know what service
  -- and which day it is.
  is_publishable      boolean GENERATED ALWAYS AS (
                        jsonb_array_length(needs_review) = 0
                        AND service IS NOT NULL
                        AND day_type IS NOT NULL
                      ) STORED,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- THE INVARIANT, enforced here and not only in TypeScript: exactly the
  -- columns belonging to `kind` are populated, and no others.
  CONSTRAINT minyan_time_shape CHECK (
    CASE kind
      WHEN 'fixed' THEN
        fixed_time IS NOT NULL
        AND anchor IS NULL AND offset_minutes IS NULL AND sign_basis IS NULL
        AND raw_text IS NULL
      WHEN 'relative' THEN
        anchor IS NOT NULL AND offset_minutes IS NOT NULL
        AND fixed_time IS NULL AND raw_text IS NULL
      WHEN 'unknown' THEN
        raw_text IS NOT NULL
        AND fixed_time IS NULL AND anchor IS NULL AND offset_minutes IS NULL
        AND sign_basis IS NULL
    END
  ),

  -- A clock normalisation is a statement about a clock face, so it can only
  -- exist on a fixed time.
  CONSTRAINT minyan_clock_normalisation_is_fixed_only
    CHECK (clock_normalisation IS NULL OR kind = 'fixed'),

  CONSTRAINT minyan_clock_normalisation_shape CHECK (
    clock_normalisation IS NULL OR (
      jsonb_typeof(clock_normalisation) = 'object'
      AND clock_normalisation ? 'from'
      AND clock_normalisation ? 'to'
      AND clock_normalisation ? 'basis'
    )
  ),

  CONSTRAINT minyan_needs_review_is_array
    CHECK (jsonb_typeof(needs_review) = 'array'),

  -- A quarter of an hour is the coarsest offset anyone writes; two hours is
  -- already implausible. This catches a units bug (seconds, or hours) at write
  -- time rather than at the top of somebody's timeline.
  CONSTRAINT minyan_offset_is_plausible
    CHECK (offset_minutes IS NULL OR offset_minutes BETWEEN -180 AND 180)
);

-- Stable identity for the nightly diff: a minyan is "the nth time in this
-- synagogue's weekday/shabbat field". NULLS NOT DISTINCT so an unknown day_type
-- still collides with itself instead of duplicating on every re-import.
CREATE UNIQUE INDEX minyanim_source_identity_idx
  ON minyanim (synagogue_id, day_type, source_index) NULLS NOT DISTINCT;

CREATE INDEX minyanim_synagogue_idx ON minyanim (synagogue_id);

-- The next-minyan query reads only publishable rows, filtered by service and
-- day. Partial so the index stays the size of the data we can actually show.
CREATE INDEX minyanim_publishable_idx
  ON minyanim (day_type, service, kind)
  WHERE is_publishable;

-- The review queue.
CREATE INDEX minyanim_needs_review_idx
  ON minyanim (synagogue_id)
  WHERE NOT is_publishable;

COMMENT ON COLUMN minyanim.fixed_time IS
  'Clock face in Asia/Jerusalem. A rule, not an instant — never a timestamptz.';
COMMENT ON COLUMN minyanim.raw_text IS
  'Verbatim source text for kind = unknown (usually בזמן). Never displayed as a time.';
COMMENT ON COLUMN minyanim.is_publishable IS
  'Generated. Unreviewed or unattributed rows are stored, kept, and never shown.';

COMMIT;
