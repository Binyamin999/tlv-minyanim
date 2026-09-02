-- An absence can be narrower than a whole day.
--
-- נוה קודש davens Shacharit every weekday and holds NO Mincha and NO Arvit at
-- all. Migration 0007 gave us `synagogues.no_minyanim_on day_type[]`, which
-- can say "nothing happens on Shabbat" — true of the mall shul — but has no
-- way to say "weekdays, but only in the morning".
--
-- Without this the page shows a lone Shacharit row and a reader cannot tell
-- whether we are missing this shul's Mincha or whether there is none. That is
-- the same conflation 0007 existed to end, one level finer: `בזמן` is an
-- unknown time for a service that happens, a missing day is a service that
-- does not, and this is a service that does not happen ON a day that does.
--
-- A TABLE, not a wider array. The pair (day, service) with service optional is
-- a relation, and expressing it as two parallel columns or as jsonb would put
-- the enum types out of the database's reach — and this project's rule is that
-- the database enforces what the types promise, not merely agrees with them.
-- Same instinct that gave shiurim their own table rather than a flag.
--
-- service NULL means the whole day, which is exactly what 0007 could say, so
-- the old column's contents migrate into it without loss.

BEGIN;

CREATE TABLE synagogue_absences (
  synagogue_id integer NOT NULL REFERENCES synagogues(id) ON DELETE CASCADE,
  day_type     day_type NOT NULL,
  -- NULL = no services at all on this day. Not "unknown which service".
  service      service,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE synagogue_absences IS
  'Services a synagogue states it does NOT hold. A row here is a positive '
  'claim of absence and the UI says so; the absence of a row is the ordinary '
  'unknown. Only a person can state one — no parser may write here.';

COMMENT ON COLUMN synagogue_absences.service IS
  'NULL = nothing at all on this day. Otherwise this one service is not held, '
  'while others on the same day may be.';

-- NULLS NOT DISTINCT so a second "whole day" row for the same day collides
-- rather than accumulating. Postgres 15+.
CREATE UNIQUE INDEX synagogue_absences_unique
  ON synagogue_absences (synagogue_id, day_type, service) NULLS NOT DISTINCT;

-- Carry 0007's claims across before the column goes.
INSERT INTO synagogue_absences (synagogue_id, day_type, service)
SELECT id, unnest(no_minyanim_on), NULL FROM synagogues
WHERE cardinality(no_minyanim_on) > 0;

ALTER TABLE synagogues DROP COLUMN no_minyanim_on;

COMMIT;
