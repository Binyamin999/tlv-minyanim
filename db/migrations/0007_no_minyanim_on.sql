-- "We do not know" and "there are none" are different statements.
--
-- בית חב"ד קניון רמת אביב is inside a shopping centre that closes for Shabbat,
-- so it holds no Shabbat services at all. The shul page rendered its Shabbat
-- and erev-Shabbat blocks as `אין שעות ידועות` — "no known times" — which
-- claims we are missing data about a minyan that exists. There is no minyan.
--
-- That is the same distinction this codebase draws everywhere else, one level
-- up: `בזמן` is an unknown time for a service that happens, and this is a
-- service that does not. Conflating them tells a reader to keep looking.
--
-- A weekday-only minyan inside a mall, an office block or a university is an
-- ordinary shape, so this is not a special case for one row.

BEGIN;

ALTER TABLE synagogues
  ADD COLUMN no_minyanim_on day_type[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN synagogues.no_minyanim_on IS
  'Day types on which this synagogue states it holds NO services. Empty means '
  'nothing was stated, which is not the same as "it holds services on every '
  'day" — absence of times for a day left out of this array still means we do '
  'not know. Only a source saying so may put a day in here.';

COMMIT;
