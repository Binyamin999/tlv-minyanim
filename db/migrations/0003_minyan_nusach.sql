-- Nusach belongs on the minyan, not only on the synagogue.
--
-- כלל ישראל runs two minyanim under one roof — `מניין אשכנזי-ספרדי` and
-- `מניין תימני` — at different times, which is what the municipality's `כללי`
-- actually meant: not "unclassified" but "more than one". With one nusach per
-- synagogue and none per minyan, the only times storable for that shul were the
-- ones both minyanim shared. Everything that differed had to be held.
--
-- This is not a special case. A building with an early Ashkenazi minyan and a
-- later Sefardi one is ordinary in Tel Aviv, and at 484 synagogues it will be
-- common. The column is nullable and the null means something specific: see
-- below.

BEGIN;

-- ---------------------------------------------------------------------------
-- `teimani`, unqualified
-- ---------------------------------------------------------------------------
-- The enum has had `teimani_baladi` and `teimani_shami` since 0001, and the
-- source says only `תימני`. That left two records unrepresentable — משכן אחים's
-- whole nusach, and כלל ישראל's second minyan — and both were stored as NULL,
-- which says "we do not know how they daven". That is less true than "Yemenite,
-- sub-rite unstated".
--
-- Recording `teimani` is reading the source, not guessing past it: the sign
-- says Yemenite and we write down Yemenite. Choosing baladi or shami on its
-- behalf would be the guess, and remains forbidden. The finer values stay for
-- shuls that state one.
ALTER TYPE nusach ADD VALUE IF NOT EXISTS 'teimani' BEFORE 'teimani_baladi';

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- minyanim.nusach
-- ---------------------------------------------------------------------------
-- NULL means "the house minyan" — this minyan follows the synagogue's own
-- nusach and is not a distinct group. It does NOT mean unknown.
--
-- That distinction is what lets כלל ישראל be stored honestly without inventing
-- a value for `אשכנזי-ספרדי`, which is two rites in one minyan and has no
-- single enum value. Its main minyan is simply the house minyan (NULL); the
-- Teimani one carries `teimani`. Nothing is claimed that the sign does not say.
ALTER TABLE minyanim
  ADD COLUMN nusach nusach;

COMMENT ON COLUMN minyanim.nusach IS
  'The nusach of THIS minyan when it differs from the synagogue''s. NULL means '
  'the house minyan, not unknown. Set only from a stated source — never '
  'inferred, and never copied down from synagogues.nusach, which would make '
  'every row look like a distinct group.';

-- Finding the shuls that run more than one group, which is the query this
-- column exists to make possible.
CREATE INDEX minyanim_nusach_idx ON minyanim (synagogue_id, nusach)
  WHERE nusach IS NOT NULL;

COMMIT;
