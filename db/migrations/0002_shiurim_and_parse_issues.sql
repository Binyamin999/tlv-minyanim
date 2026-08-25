-- 0002_shiurim_and_parse_issues.sql
--
-- Homes for the two parser outputs that 0001 had nowhere to put.
--
-- 1. SHIURIM. `parseMinyanTimes` returns `shiurim` separately from `minyanim`
--    precisely because a 7:00 daf yomi is NOT a 7:00 shacharit. Giving them a
--    table of their own — rather than a flag on `minyanim` — is what makes it
--    structurally impossible for one to leak into the next-minyan query. The
--    alternative was to drop them with a logged count; they are real, useful,
--    already parsed, and would have to be re-imported later, so they get a
--    table.
--
-- 2. PARSE ISSUES. The parser exists to shout when it does not understand
--    something. Dropping `issues` at import time would silence exactly the
--    signal it was built to emit. This is the review queue's raw feed and the
--    input to the nightly diff job.

BEGIN;

-- ---------------------------------------------------------------------------
-- shiurim
-- ---------------------------------------------------------------------------

CREATE TABLE shiurim (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  synagogue_id  bigint NOT NULL REFERENCES synagogues (id) ON DELETE CASCADE,

  -- Which source column this came from, e.g. 'daf_yomi_raw'. Never inferred.
  source_field  text NOT NULL,
  raw_field     text NOT NULL,   -- the whole original field, untouched
  raw_segment   text NOT NULL,   -- the slice this shiur was read from
  source_index  integer NOT NULL, -- position within the field, 0-based

  -- ShiurFinding.times — structured MinyanTime values, verbatim from the
  -- parser. jsonb rather than the typed columns `minyanim` uses because a
  -- shiur never enters the timeline: nothing sorts these, nothing resolves
  -- them against a zman. The CHECK below still refuses a display string, so
  -- the core invariant holds here too.
  --
  -- TODO(phase 3+): if shiurim ever need to be searchable by time, promote
  -- this to typed columns with the same three-way CHECK as `minyanim`.
  times         jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- A shiur field carries no day column, so day_type is genuinely unknown
  -- here. NULL means "the source did not say", never "we forgot to look".
  day_type      day_type,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Every element must be a MinyanTime: an object whose `kind` is one of the
  -- three. jsonpath rather than a subquery because CHECK forbids subqueries.
  CONSTRAINT shiur_times_are_structured CHECK (
    jsonb_typeof(times) = 'array'
    -- catches scalars, arrays and objects with no `kind` at all
    AND NOT jsonb_path_exists(times, '$[*] ? (!exists(@.kind))')
    -- catches a fourth kind
    AND NOT jsonb_path_exists(
      times,
      '$[*] ? (@.kind != "fixed" && @.kind != "relative" && @.kind != "unknown")'
    )
  )
);

-- Idempotent re-import: a shiur is "the nth finding in this field".
CREATE UNIQUE INDEX shiurim_source_identity_idx
  ON shiurim (synagogue_id, source_field, source_index);

COMMENT ON TABLE shiurim IS
  'Classes, not minyanim. Deliberately a separate table: a 7:00 daf yomi must never be sortable as a 7:00 shacharit.';

-- ---------------------------------------------------------------------------
-- parse_issues
-- ---------------------------------------------------------------------------

-- Mirrors ParseIssueCode. An enum on purpose: when the parser learns a new
-- code, the import fails loudly here instead of writing an unrecognised label.
CREATE TYPE parse_issue_code AS ENUM (
  'unrecognized_text',
  'invalid_time',
  'unknown_anchor',
  'empty_field',
  'no_content_recognised'
);

CREATE TABLE parse_issues (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  synagogue_id  bigint NOT NULL REFERENCES synagogues (id) ON DELETE CASCADE,

  source_field  text NOT NULL,
  code          parse_issue_code NOT NULL,
  -- The exact fragment that failed. Never elided — a low coverage number beats
  -- a wrong one.
  fragment      text NOT NULL,
  message       text NOT NULL,
  raw_field     text NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- No unique key: one field can legitimately fail twice the same way. The
-- importer replaces a synagogue's issues wholesale inside its transaction,
-- which is what makes re-import idempotent.
CREATE INDEX parse_issues_synagogue_idx ON parse_issues (synagogue_id);
CREATE INDEX parse_issues_code_idx ON parse_issues (code);

COMMENT ON TABLE parse_issues IS
  'Everything the parser could not account for. Never displayed to users; this is the review queue and the nightly diff feed.';

COMMIT;
