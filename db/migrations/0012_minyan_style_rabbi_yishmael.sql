-- A minyan that begins at רבי ישמעאל.
--
-- Same family as `hodu`, and added for the same reason: a real notice board
-- used the word. היכל חיים marks two of its three Shacharit minyanim
-- `רבי ישמעאל`, and the shul says it means what `hodu` means one step earlier
-- — the minyan starts at ברייתא דרבי ישמעאל in the korbanot rather than at
-- הודו, which is a real choice for someone who has davened the earlier part
-- already.
--
-- NOT mapped onto `hodu`. They name two different points in the service, and
-- flattening one onto the other would tell a reader the minyan starts later
-- than it does. This is the rule migration 0009 set for `minyan_location` and
-- CLAUDE.md states for both: the vocabulary grows only when a board demands a
-- word, and anything unmapped is held rather than approximated to the nearest
-- available one. It was held for exactly one reading before this.
--
-- Still a LABEL, never an anchor — see 0010. It says what kind of minyan this
-- is; the time beside it stays whatever it was stored as.

BEGIN;

ALTER TYPE minyan_style ADD VALUE IF NOT EXISTS 'rabbi_yishmael';

COMMIT;
