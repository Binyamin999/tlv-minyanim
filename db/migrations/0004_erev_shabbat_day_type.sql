-- Erev Shabbat is its own day.
--
-- The Shabbat column in the GIS layer conflates two different days: the Mincha
-- and Kabbalat Shabbat davened on FRIDAY, and the Shacharit and Mincha davened
-- on SATURDAY. Where a source does not separate them, the timeline says so and
-- holds the row back as `erev_shabbat_time_unstated`, which is honest.
--
-- But a printed sheet DOES separate them — כלל ישראל's has `ליל שבת` and
-- `יום השבת` as distinct blocks — and until now there was no way to record the
-- distinction it makes. The timeline instead guessed the day from the ANCHOR:
-- a Shabbat-column Mincha counted as erev Shabbat only if it was
-- candle-lighting-anchored, and otherwise landed on Saturday.
--
-- That proxy failed the moment real evidence arrived. כלל ישראל's erev-Shabbat
-- Mincha is `shkia − 20`, confirmed against their own printed 18:50 — so
-- correcting the time from the municipality's wrong `candle_lighting − 10`
-- moved the minyan from Friday to Saturday, and the homepage offered it
-- "בעוד יום" when it was ninety minutes away.
--
-- An anchor cannot say which day a minyan is davened on. Only the source can,
-- and now it can be written down.

BEGIN;

ALTER TYPE day_type ADD VALUE IF NOT EXISTS 'erev_shabbat' BEFORE 'shabbat';

COMMIT;

BEGIN;

COMMENT ON COLUMN minyanim.day_type IS
  'weekday | erev_shabbat | shabbat. `erev_shabbat` is Friday afternoon and '
  'evening — the Mincha and Kabbalat Shabbat before sunset on Friday — and is '
  'set ONLY from a source that separates it, such as a printed sheet with a '
  'ליל שבת block. The parser never produces it: the GIS shabbat column does '
  'not distinguish the two days, and a row read from it stays `shabbat` and is '
  'held back rather than assigned to a day nobody stated.';

COMMIT;
