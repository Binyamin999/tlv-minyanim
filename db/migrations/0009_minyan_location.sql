-- Where inside the building a minyan meets.
--
-- Two boards have now said something we could not store. תהילת אביב runs its
-- second Arvit למעלה and its third למטה — same building, same night, two
-- rooms, and without this the page shows 19:35 and 20:00 with nothing to tell
-- a stranger which staircase. היכל חיים's 06:50 Shacharit meets בסוכה.
--
-- (A third case turned out not to be one: the mall shul's קומה -1 is part of
-- its street address and already displays there. Worth saying, because it was
-- counted as evidence for this column and it is not.)
--
-- A CODE, NOT PROSE. This is the same decision `verified_by` already made and
-- for the same reason: every page renders in Hebrew and in English, so free
-- text here would print one language's sentence inside the other's layout.
-- That shipped once, for one commit, and is not repeated.
--
-- Only the values boards have actually used. An enum with a speculative
-- vocabulary would be inventing distinctions no synagogue has asked for, and
-- ALTER TYPE ... ADD VALUE is cheap when a real board demands one. Anything
-- unmapped stays in `held` — the same answer this project gives everywhere
-- else: silence beats a value nobody wrote down.

BEGIN;

CREATE TYPE minyan_location AS ENUM ('upstairs', 'downstairs', 'sukkah');

ALTER TABLE minyanim
  ADD COLUMN location minyan_location;

COMMENT ON COLUMN minyanim.location IS
  'Where in the building this minyan meets, as a localisable code. NULL means '
  'nothing was stated — which for most shuls means the only room there is, not '
  'that we failed to record one.';

COMMIT;
