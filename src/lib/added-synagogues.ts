/**
 * Synagogues that are not in the municipal export.
 *
 * The GIS layer has 484 rows and is fourteen months stale, so it is a floor
 * rather than a census: a minyan that started last year, or one inside a
 * building the municipality catalogues as a shopping centre, is simply absent.
 * `בית חב"ד קניון רמת אביב` is the first of those — a Chabad house on level −1
 * of Ramat Aviv Mall, which no query of layer 568 returns.
 *
 * Everything here is hand-entered, so it carries the same burden as
 * `verified-times.ts`: a person vouched for it, and the record says who by way
 * of `verifiedBy` on the times. It is tracked in git and contains no personal
 * data.
 *
 * These rows have no `gis_source_id`. That column is the natural key the
 * importer uses to find a municipal row again, so an added synagogue is keyed
 * on its slug instead — which is why the slug here is authored rather than
 * derived, and must never change once published.
 */
import type { Movement, Nusach, SynagogueStatus } from './taxonomy.ts';

export interface AddedSynagogue {
  /** URL identity. Authored, permanent, and the natural key for re-import. */
  slug: string;
  nameHe: string;
  /** Transliterated, never translated — see curation.ts. */
  nameEn: string;
  addressHe: string;
  /**
   * WGS84, and required.
   *
   * The walking link is built from these, so an approximate point sends a
   * reader to the wrong entrance of a building they have never been to. There
   * is no sensible default and no geocoding here: a synagogue without
   * coordinates is skipped by the importer and reported, rather than inserted
   * at a guess.
   */
  lat: number | null;
  lng: number | null;
  /** Every rite it serves. Empty = we cannot name one. Never inferred. */
  nusachim: readonly Nusach[];
  /** Hand-enriched only, exactly as in curation.ts. */
  movement?: Movement;
  status: SynagogueStatus;
  /** Anything true about the place that the schema has no column for. */
  note?: string;
}

export const ADDED: readonly AddedSynagogue[] = [
  {
    slug: 'chabad-ramat-aviv-mall',
    nameHe: 'בית חב"ד קניון רמת אביב',
    nameEn: 'Chabad Ramat Aviv Mall',
    addressHe: 'קניון רמת אביב, איינשטיין 40, קומה -1',
    /*
     * The mall, from Wikipedia in both languages — 32°06′44″N 34°47′45″E,
     * decimal 32.11222 / 34.79583, at Einstein Street 40. Looked up rather
     * than recalled, and checked before being believed: a competing figure
     * from an aggregator (32.1073 / 34.7908) sits 1,028 m from the centre of
     * the sixteen Ramat Aviv synagogues while this one sits 311 m from it,
     * which is where a mall in the middle of the neighbourhood belongs.
     *
     * Arcsecond precision is about 30 m, which is the building rather than
     * its door. That is the honest limit here: this is the MALL's point, and
     * the minyan is on level −1 of it. Walking directions will get a reader
     * to the right building and no further, which for a shopping centre is
     * what any coordinate could do.
     */
    lat: 32.11222,
    lng: 34.79583,
    // Chabad daven nusach Ari. That is NOT recorded here, because inferring
    // nusach from movement is the same forbidden step as inferring movement
    // from nusach, only in the other direction. Empty until somebody says.
    nusachim: [],
    movement: 'chabad',
    status: 'active',
    note: 'level −1 of the shopping centre; the schema has no field for a floor',
  },
];

/** The added synagogue with this slug, or null. */
export function addedBySlug(slug: string): AddedSynagogue | null {
  return ADDED.find((s) => s.slug === slug) ?? null;
}

/** Ready to import: everything the schema requires is present. */
export function isLocatable(
  synagogue: AddedSynagogue,
): synagogue is AddedSynagogue & { lat: number; lng: number } {
  return typeof synagogue.lat === 'number' && typeof synagogue.lng === 'number';
}
