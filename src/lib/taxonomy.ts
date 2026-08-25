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

export type Nusach =
  | 'ashkenaz'
  | 'sefard'
  | 'edot_hamizrach'
  | 'teimani_baladi'
  | 'teimani_shami'
  | 'moroccan'
  | 'tunisian'
  | 'iraqi'
  | 'persian'
  | 'salonikan'
  | 'general';

/** Never inferred from nusach — hand-enriched only. See CLAUDE.md. */
export type Movement = 'chabad' | 'breslev';

export type SynagogueStatus = 'active' | 'holidays_only' | 'seasonal' | 'dormant' | 'closed';
