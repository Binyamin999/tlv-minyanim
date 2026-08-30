-- נץ is a property of a MINYAN, not of a building.
--
-- The enum has been called `minyan_style` since the first migration and has
-- been sitting on `synagogues.style`, NULL on all seventeen. It could not be
-- anything else: היכל חיים runs three Shacharit minyanim and exactly one of
-- them is נץ, so a column on the building has no true value to hold. Same
-- shape as nusach in migration 0003, and the same fix.
--
-- WHAT A LABEL IS NOT. Marking a minyan `netz` says it is a sunrise minyan.
-- It does NOT store `netz − 34`, and must never be read as one: the offset
-- that makes the Amidah land at sunrise is not derivable from a single week's
-- printing, and תהילת אביב's 05:40 is netz − 34 today and something else in
-- December. The time keeps its clock face and its validity window; the label
-- only tells a reader what kind of minyan it is. This is the same distinction
-- as "Mincha Gedola 14:00" — the name on the board is not the arithmetic.
--
-- Two values added, and only because boards used them. `hodu` marks a minyan
-- that begins at הודו rather than at the start of pesukei d'zimra — a real
-- choice for someone who has already davened the earlier part. `plag` marks an
-- Arvit after plag hamincha. תהילת אביב's board writes all three.
--
-- `synagogues.style` is left in place and untouched. It is now the doubtful
-- one, but it is NULL everywhere and dropping a column is a separate decision
-- from adding the one that works.

BEGIN;

ALTER TYPE minyan_style ADD VALUE IF NOT EXISTS 'hodu';
ALTER TYPE minyan_style ADD VALUE IF NOT EXISTS 'plag';

COMMIT;

BEGIN;

ALTER TABLE minyanim
  ADD COLUMN style minyan_style;

COMMENT ON COLUMN minyanim.style IS
  'What kind of minyan this is, as the board labels it — netz, hodu, plag, '
  'carlebach, hashkama. NULL means the board said nothing, which is the normal '
  'case. NEVER an anchor: `netz` does not mean the time is netz-relative.';

COMMIT;
