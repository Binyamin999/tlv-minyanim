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
import type { Movement, Nusach } from './taxonomy.ts';

/**
 * Hebrew name as the source writes it -> what the synagogue actually calls
 * itself.
 *
 * The municipality writes `לכלל ישראל` — "to Klal Yisrael" — which is the
 * name with a preposition stuck to the front, almost certainly the tail of a
 * phrase like `בית הכנסת לכלל ישראל` that was captured whole. The shul is
 * `כלל ישראל`. The source key stays as the source writes it, because that is
 * how a re-import finds this row.
 */
export const NAME_HE: Record<string, string> = {
  'לכלל ישראל': 'כלל ישראל',
  // A third Chabad house the source does not mark as one. `המרכזי` — "the
  // central [synagogue]" — is what the municipality wrote for two different
  // buildings, and this one calls itself בית חב"ד רמת אביב ג'. Note what the
  // wrong name cost beyond the name: nothing about `המרכזי` suggests Chabad,
  // so this shul sat with no movement while the two known Chabad houses in
  // the same neighbourhood carried theirs. Correcting the name is what
  // surfaced it — which is precisely why MOVEMENT is hand-curated and never
  // read off a nusach field.
  "המרכזי רמת אביב ג'": 'בית חב"ד רמת אביב ג\'',
};

/** Hebrew name as the source writes it -> the name in Latin script. */
export const NAME_EN: Record<string, string> = {
  'אוהל יוסף יצחק': 'Ohel Yosef Yitzchak',
  'אוניברסיטת ת"א - צימבוליסטה': 'Tel Aviv University — Cymbalista',
  'אור גבריאל - משמעות': 'Or Gavriel — Mashmaut',
  'היכל חיים': 'Heichal Chaim',
  המרכזי: 'HaMerkazi',
  "המרכזי רמת אביב ג'": 'Chabad Ramat Aviv Gimmel',
  'הרמב"ם': 'HaRambam',
  'לכלל ישראל': 'Klal Yisrael',
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
 * Hebrew name -> every rite the synagogue serves, where the source could not
 * say.
 *
 * The municipality writes one nusach per building, so a shul serving several
 * comes through as `כללי` — which meant "more than one" and was read as
 * "unclassified". Where a sign or a person tells us which ones, they go here.
 *
 * Order matters: the first is the rite the building is most readily identified
 * with. This is not a ranking of the congregations.
 */
export const NUSACHIM_SERVED: Record<string, readonly Nusach[]> = {
  // The printed sheet heads its two columns `מניין אשכנזי-ספרדי` and
  // `מניין תימני`. In Israeli usage that first `ספרדי` is עדות המזרח rather
  // than the chassidic nusach sefard, so one minyan serves two rites and the
  // Teimani minyan is the third. Confirmed by the user, who davens there.
  'לכלל ישראל': ['ashkenaz', 'edot_hamizrach', 'teimani'],
};

/**
 * Hebrew name -> movement, for the shuls that have one.
 *
 * Both entries are Chabad houses the GIS layer tags `אשכנז`. Named in
 * CLAUDE.md as the worked example of why this column cannot be derived.
 */
export const MOVEMENT: Record<string, Movement> = {
  'אוהל יוסף יצחק': 'chabad',
  // Found by way of its real name, not by inspecting its nusach — see NAME_HE.
  "המרכזי רמת אביב ג'": 'chabad',
  'תומכי תמימים - בית חב"ד': 'chabad',
};

/**
 * Hebrew street name -> the same name in Latin script.
 *
 * Keyed on the STREET rather than the whole address, because the house number
 * needs no translation and a street carries many shuls: אופנהיימר 5 is two
 * separate congregations, and at 484 rows a per-address table would be mostly
 * duplicated. The number is re-attached by `curatedAddressEn`.
 *
 * Transliterated, never translated — exactly the rule NAME_EN follows, and for
 * the same reason. `רידינג` is Reading, the power station it is named after,
 * not "the reading street". A visitor matching a bilingual street sign or
 * saying the name aloud to a driver needs the sound, and a translation is a
 * street nobody in this city has heard of.
 *
 * Where the Hebrew is itself ambiguous we transliterate what is written and
 * resolve nothing: the source says `יהודה`, so this says Yehuda, and which
 * Yehuda the municipality meant is not a question a transliteration table gets
 * to answer.
 */
export const STREET_EN: Record<string, string> = {
  'אבא אחימאיר': 'Abba Ahimeir',
  אופנהיימר: 'Oppenheimer',
  'אליהו חכים': 'Eliyahu Hakim',
  'בשוויס זינגר': 'Bashevis Singer',
  ברודצקי: 'Brodetsky',
  'חיים לבנון': 'Haim Levanon',
  טאגור: 'Tagore',
  יהודה: 'Yehuda',
  נח: 'Noach',
  רידינג: 'Reading',
  'שרגא פרידמן': 'Shraga Friedman',
};

/**
 * Whole addresses that are not `<street> <number>`.
 *
 * The mall shul's address names a building, a street and a floor, so there is
 * no street to look up. Written out rather than forced through the splitter.
 */
export const ADDRESS_EN: Record<string, string> = {
  'קניון רמת אביב, איינשטיין 40, קומה -1':
    'Ramat Aviv Mall, Einstein 40, level -1',
};

/** `<street> <number>`, which is the shape the GIS layer writes. */
const STREET_AND_NUMBER = /^(.+?)\s+(\d+\S*)$/;

/**
 * The address in Latin script, or null when we cannot write one.
 *
 * Null is the honest answer for an uncurated street: `localisedAddress` then
 * shows the Hebrew on the English page, marked as a foreign run, which is true
 * and readable-to-somebody rather than a machine transliteration of unpointed
 * Hebrew — which reads as nonsense and would be worse than the Hebrew itself.
 */
export function curatedAddressEn(addressHe: string | null): string | null {
  if (!addressHe) return null;
  const folded = key(addressHe);

  const whole = ADDRESS_EN[folded];
  if (whole) return whole;

  const parts = STREET_AND_NUMBER.exec(folded);
  if (!parts) return null;
  const street = STREET_EN[parts[1]!];
  return street ? `${street} ${parts[2]}` : null;
}

/** Fold whitespace the way `slug.ts` does, so one key works for both files. */
function key(nameHe: string): string {
  return nameHe.replace(/\s+/g, ' ').trim();
}

/**
 * Every rite this synagogue serves.
 *
 * Falls back to the single value the source gave, as a one-element set —
 * except `general`, which becomes empty, because it never named a rite.
 */
export function curatedNusachim(nameHe: string, sourceNusach: Nusach | null): readonly Nusach[] {
  const curated = NUSACHIM_SERVED[key(nameHe)];
  if (curated) return curated;
  if (sourceNusach === null || sourceNusach === 'general') return [];
  return [sourceNusach];
}

/** The synagogue's own Hebrew name, correcting the source where it is wrong. */
export function curatedNameHe(nameHe: string): string {
  return NAME_HE[key(nameHe)] ?? nameHe;
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
