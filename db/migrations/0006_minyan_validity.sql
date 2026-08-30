-- A clock time can be true for a week and false afterwards.
--
-- כלל ישראל reprints its weekday board every week. Its evening Mincha was
-- 18:55 on 2026-08-26 and 18:45 on 2026-08-30 — shkia − 17 and shkia − 22, so
-- not a stable offset either — and 18:45 in December would be shkia + 65, a
-- Mincha over an hour after sunset.
--
-- Until now this codebase had two ways to hold such a time and both were
-- wrong. Store it as `fixed` and the site confidently shows an impossible time
-- from November. Hold it back and the site shows nothing while the shul has a
-- perfectly well-known minyan tonight.
--
-- The missing idea is that the CLAIM has a lifetime. `valid_from` and
-- `valid_until` say how long the source vouched for this time, which is
-- exactly what a weekly printed board vouches for. Outside that window the row
-- does not resolve: the reader gets the honest unknown rather than a stale
-- number, and the row stays in the table as the record of what was true then.
--
-- NULL on both means no stated end — a rule, or a clock time that genuinely
-- holds year round. `shkia − 20` never expires because sunset moves with it.
-- That is the difference the two columns exist to record.

BEGIN;

ALTER TABLE minyanim
  ADD COLUMN valid_from date,
  ADD COLUMN valid_until date;

COMMENT ON COLUMN minyanim.valid_from IS
  'First date this time is vouched for. NULL = no stated start.';

COMMENT ON COLUMN minyanim.valid_until IS
  'Last date this time is vouched for, inclusive. NULL = no stated end, which '
  'is the normal case for a rule (shkia - 20 never expires) and for a clock '
  'face that holds year round. A weekly printed board sets both.';

-- A window that ends before it starts is a typo, not a schedule.
ALTER TABLE minyanim
  ADD CONSTRAINT minyan_validity_ordered
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until);

-- The timeline asks "what is valid on this date" every time it runs.
CREATE INDEX minyanim_validity_idx ON minyanim (valid_until)
  WHERE valid_until IS NOT NULL;

COMMIT;
