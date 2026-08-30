-- A synagogue serves a SET of rites, not one.
--
-- כלל ישראל serves three: אשכנז and עדות המזרח share a minyan, and תימני has
-- its own. `synagogues.nusach` held one value, so the only honest thing it
-- could say was `general` — and `general` is suppressed at the display
-- boundary, being a statement about our classification rather than about the
-- congregation. The result was a shul that serves three rites showing none.
--
-- That is not a special case. A building with an early Ashkenazi minyan and a
-- later Sefardi one is ordinary in Tel Aviv, and at 484 synagogues the single
-- column would keep forcing the same false choice: name one rite and drop the
-- others, or say `general` and show nothing.
--
-- So the column becomes a set. A shul with one rite has an array of one; a
-- shul we cannot classify has an empty array, which means the same as the old
-- `general` and needs no separate value to say it.
--
-- `minyanim.nusach` from 0003 stays and keeps its own meaning: which of the
-- building's groups a particular minyan belongs to, NULL being the house
-- minyan. The synagogue-level set is who the building serves; the minyan-level
-- value is who a given time is for. They answer different questions.

BEGIN;

ALTER TABLE synagogues
  ADD COLUMN nusachim nusach[] NOT NULL DEFAULT '{}';

-- Carry the existing single values across. `general` becomes the empty set,
-- because that is what it always meant — not a rite, but the absence of a
-- stated one.
UPDATE synagogues
   SET nusachim = ARRAY[nusach]
 WHERE nusach IS NOT NULL AND nusach <> 'general';

COMMENT ON COLUMN synagogues.nusachim IS
  'The rites this synagogue serves. Empty means we cannot name one — the old '
  '`general`, which was a fact about our classification rather than about the '
  'congregation and is never displayed. Order is meaningful: the first is the '
  'one the building is most readily identified with.';

ALTER TABLE synagogues DROP COLUMN nusach;

CREATE INDEX synagogues_nusachim_idx ON synagogues USING gin (nusachim);

COMMIT;
