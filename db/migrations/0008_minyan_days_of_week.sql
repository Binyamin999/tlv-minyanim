-- Not every weekday is the same weekday.
--
-- המרכז למורשת היהדות ע"ש צימבליסטה davens Shacharit at 07:15 on Sunday,
-- Tuesday and Wednesday, and at 07:10 on Monday and Thursday. That is not a
-- quirk: Monday and Thursday carry קריאת התורה, so the service is longer and
-- shuls across Israel start it earlier. At 484 synagogues this pattern will
-- appear hundreds of times.
--
-- Until now `day_type` was the whole story — weekday, erev shabbat, shabbat —
-- and there was no way to hold both rows. The two honest options without this
-- column were both bad: store 07:15 alone and send a reader five minutes late
-- twice a week, or hold both and show nothing for a time we actually know.
-- Listing a minyan late is the specific failure this project exists to refuse.
--
-- Empty means EVERY day of its day_type, which is the common case and the
-- default. It does not mean "unknown" — a minyan with no stated day restriction
-- genuinely runs on all of them.
--
-- Numbering is 0=Sunday .. 6=Saturday, matching JS getDay() and Postgres
-- EXTRACT(DOW), so the timeline can compare without a translation table. Note
-- that a value here is a civil weekday, NOT a Hebrew one: the Hebrew day rolls
-- at sunset, and a Friday-evening minyan belongs to day_type erev_shabbat
-- rather than to a weekday number.

BEGIN;

ALTER TABLE minyanim
  ADD COLUMN days_of_week smallint[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN minyanim.days_of_week IS
  'Civil weekdays this minyan runs on, 0=Sunday..6=Saturday. Empty = every day '
  'of its day_type, which is the normal case. Never means unknown.';

-- A day outside 0..6 is a bug in whatever wrote it, not data.
ALTER TABLE minyanim
  ADD CONSTRAINT minyan_days_of_week_valid
  CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

-- A restriction on a day the day_type cannot contain is a contradiction: a
-- weekday row limited to Saturday would never resolve, and would sit in the
-- table looking like a minyan.
ALTER TABLE minyanim
  ADD CONSTRAINT minyan_days_match_day_type
  CHECK (
    days_of_week = '{}'
    OR day_type IS NULL
    OR (day_type = 'weekday'      AND days_of_week <@ ARRAY[0,1,2,3,4]::smallint[])
    OR (day_type = 'erev_shabbat' AND days_of_week <@ ARRAY[5]::smallint[])
    OR (day_type = 'shabbat'      AND days_of_week <@ ARRAY[6]::smallint[])
  );

COMMIT;
