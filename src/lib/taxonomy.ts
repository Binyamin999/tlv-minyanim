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
  // Unqualified. The source often says only `תימני`, and recording that is
  // reading it; choosing baladi or shami on a congregation's behalf is not.
  'teimani',
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

/**
 * The nusach worth showing a reader, or null.
 *
 * `general` is stored, never displayed. It is what the municipality writes when
 * a synagogue does not describe itself as any particular nusach, so printing it
 * as a tag says "unclassified" while looking exactly like `אשכנז` — a fact
 * about our data wearing the costume of a fact about the shul. A reader sees a
 * label where there is no claim.
 *
 * Suppressed rather than deleted. The value stays on the record and in the
 * database because it IS what the source says, and re-importing must not
 * silently start disagreeing with it; a shul that later tells us its real
 * nusach gets it filled in rather than corrected. This is a display rule, so
 * it lives here beside the enum and not in each component that renders one.
 *
 * The effect is the same as a null nusach — nothing is shown — which is right:
 * both mean we cannot name how this congregation davens. `משכן אחים` reaches
 * the same blank from the other direction, its `תימני` being real but
 * unresolvable between baladi and shami.
 */
export function displayNusach(nusach: Nusach | null): Nusach | null {
  return nusach === null || nusach === 'general' ? null : nusach;
}

/** Never inferred from nusach — hand-enriched only. See CLAUDE.md. */
export type Movement = 'chabad' | 'breslev';

export type SynagogueStatus = 'active' | 'holidays_only' | 'seasonal' | 'dormant' | 'closed';

/**
 * What kind of minyan this is, as its own notice board labels it.
 *
 * Lives on `minyanim`, not on `synagogues`: היכל חיים runs three Shacharit
 * minyanim and exactly one is נץ, so a column on the building has no true
 * value to hold. Migration 0010.
 *
 * A LABEL, NEVER AN ANCHOR. `netz` says this is a sunrise minyan; it does not
 * say the stored time is netz-relative, and nothing may read it that way. The
 * offset that makes the Amidah land at sunrise is not derivable from one
 * week's printing — תהילת אביב's 05:40 is netz − 34 today and something else
 * in December. Same distinction as "Mincha Gedola 14:00": the name on the
 * board is not the arithmetic.
 *
 * `hodu` marks a minyan that begins at הודו rather than at the start of
 * pesukei d'zimra, which is a real choice for someone who has davened the
 * earlier part already. `plag` marks an Arvit after plag hamincha.
 */
export type MinyanStyle = 'carlebach' | 'hashkama' | 'netz' | 'hodu' | 'plag';
