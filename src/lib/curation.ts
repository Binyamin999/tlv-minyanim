/**
 * Hand-curated facts the source does not carry.
 *
 * The GIS layer is the only importable source we have, and it is missing two
 * things it will never supply. CLAUDE.md says both must be enriched by hand —
 * but until now there was nowhere for a hand to put them, so the importer
 * wrote NULL and the knowledge stayed in a document nobody queries. This file
 * is that place. It is tracked in git, unlike `data/seed-ramat-aviv.json`.
 *
 * Keyed on the Hebrew name exactly as the source writes it, after whitespace
 * folding — the same key `slug.ts` uses. Slugs live there rather than here on
 * purpose: a slug is a permanent URL identity and must never be edited once
 * published, while everything in this file is expected to grow and be
 * corrected.
 *
 * ---------------------------------------------------------------------------
 * ENGLISH NAMES ARE TRANSLITERATED, NEVER TRANSLATED
 * ---------------------------------------------------------------------------
 * `היכל חיים` becomes "Heichal Chaim", not "Palace of Life". The first is the
 * same name written in Latin letters — what a visitor says out loud to ask
 * directions, and what lets them match a Hebrew sign they cannot read. The
 * second is a name the congregation does not use and nobody would recognise.
 *
 * Two narrow exceptions, both of which are reading the source rather than
 * inventing past it:
 *
 *   - An institution with an established English name keeps it. The
 *     Cymbalista Synagogue at Tel Aviv University and Bnei Akiva both print
 *     their own names in Latin script; using a naive transliteration instead
 *     would be less accurate, not more honest.
 *   - A generic noun attached to a name is rendered as the noun.
 *     `בית חב"ד` is "Chabad House" and `ביה"ס אלומות` is "Alumot School" —
 *     these describe what the building is, and leaving them as "Beit Chabad"
 *     tells an English reader nothing.
 *
 * Everything else is a straight transliteration and every line is checkable
 * against the Hebrew beside it. Where a name is genuinely ambiguous, prefer
 * the reading a Tel Aviv Anglo would recognise.
 *
 * ---------------------------------------------------------------------------
 * MOVEMENT IS NEVER INFERRED FROM NUSACH
 * ---------------------------------------------------------------------------
 * CLAUDE.md is explicit: the source has no Chabad or Breslev values and labels
 * everything `אשכנז / עדות המזרח / תימני / כללי / סלוניקאי`. Two of the
 * sixteen Ramat Aviv shuls are Chabad houses tagged `אשכנז`, and no amount of
 * reading the nusach field would reveal it — `תומכי תמימים` is the name of the
 * Chabad yeshiva network and `אוהל יוסף יצחק` is named for the sixth Rebbe.
 * Both say so in their own names, which is evidence; the nusach column is not.
 *
 * A shul absent from `MOVEMENT` has no movement, not an unknown one — this is
 * a curated list, so silence here means "looked at, nothing to record".
 */
import type { Movement } from './taxonomy.ts';

/** Hebrew name as the source writes it -> the name in Latin script. */
export const NAME_EN: Record<string, string> = {
  'אוהל יוסף יצחק': 'Ohel Yosef Yitzchak',
  'אוניברסיטת ת"א - צימבוליסטה': 'Tel Aviv University — Cymbalista',
  'אור גבריאל - משמעות': 'Or Gavriel — Mashmaut',
  'היכל חיים': 'Heichal Chaim',
  המרכזי: 'HaMerkazi',
  "המרכזי רמת אביב ג'": 'HaMerkazi Ramat Aviv Gimel',
  'הרמב"ם': 'HaRambam',
  'לכלל ישראל': 'Lichlal Yisrael',
  'מנין צעירים בני עקיבא': "Minyan Tze'irim Bnei Akiva",
  'משכן אחים': 'Mishkan Achim',
  'משען נאות אביבים': 'Mishan Neot Avivim',
  'נוה קודש': 'Neve Kodesh',
  'עולי בבל': 'Olei Bavel',
  'שפרן - ביה"ס אלומות': 'Shafran — Alumot School',
  'תהילת אביב': 'Tehilat Aviv',
  'תומכי תמימים - בית חב"ד': 'Tomchei Tmimim — Chabad House',
};

/**
 * Hebrew name -> movement, for the shuls that have one.
 *
 * Both entries are Chabad houses the GIS layer tags `אשכנז`. Named in
 * CLAUDE.md as the worked example of why this column cannot be derived.
 */
export const MOVEMENT: Record<string, Movement> = {
  'אוהל יוסף יצחק': 'chabad',
  'תומכי תמימים - בית חב"ד': 'chabad',
};

/** Fold whitespace the way `slug.ts` does, so one key works for both files. */
function key(nameHe: string): string {
  return nameHe.replace(/\s+/g, ' ').trim();
}

/** The Latin-script name, or null when this shul has not been curated yet. */
export function curatedNameEn(nameHe: string): string | null {
  return NAME_EN[key(nameHe)] ?? null;
}

/**
 * The curated movement, or null.
 *
 * Null means no movement — not "unknown". Never fall back to guessing from
 * nusach; that is the mistake this file exists to prevent.
 */
export function curatedMovement(nameHe: string): Movement | null {
  return MOVEMENT[key(nameHe)] ?? null;
}
