/**
 * The synagogue enums, as types only.
 *
 * They live apart from `src/db/queries.ts` so that the dictionaries — which
 * must label every one of these values — can reference them without anything
 * in the i18n layer depending, even nominally, on the database module.
 *
 * These mirror `db/migrations/0001_init.sql` exactly. If you add a value
 * there, add it here: every `satisfies Record<Nusach, string>` in the
 * dictionaries then fails to compile until both locales can name it, which is
 * the point.
 */

/**
 * Canonical order, and the order the filter chips appear in. Ashkenaz and
 * Edot HaMizrach lead because between them they are most of the city; the
 * enum's own SQL order is alphabetical-by-accident and is not a ranking.
 */
export const NUSACHIM = [
  'ashkenaz',
  'sefard',
  'edot_hamizrach',
  'teimani_baladi',
  'teimani_shami',
  'moroccan',
  'tunisian',
  'iraqi',
  'persian',
  'salonikan',
  'general',
] as const;

export type Nusach = (typeof NUSACHIM)[number];

/** Never inferred from nusach — hand-enriched only. See CLAUDE.md. */
export type Movement = 'chabad' | 'breslev';

export type SynagogueStatus = 'active' | 'holidays_only' | 'seasonal' | 'dormant' | 'closed';
