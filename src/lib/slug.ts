/**
 * Slugs — the permanent part of a URL.
 *
 * A slug is the one field here that can never be corrected later without
 * throwing away the ranking that SEO is the whole discovery strategy for. So
 * it is generated once, deterministically, and then it is frozen: the importer
 * only ever assigns a slug to a synagogue that does not yet have one.
 *
 * Two rules the source data forces:
 *
 *  - Address is not a key. היכל חיים and נוה קודש are both at אופנהיימר 5.
 *    Slugs come from names, never from addresses.
 *  - Names are not unique either, across a whole city: `המרכזי` will recur.
 *    So the generator returns *candidates*, most specific last, and the caller
 *    walks them until one is free.
 *
 * This module has no imports so that both Next (bundler resolution) and the
 * import script (nodenext) can load it unchanged.
 */

/** The same shape the `synagogue_slug_is_url_safe` CHECK enforces in 0001. */
const URL_SAFE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isUrlSafeSlug(slug: string): boolean {
  return URL_SAFE.test(slug);
}

/**
 * Hand-written transliterations for the v0 congregations.
 *
 * Transliteration, NOT translation: `name_en` stays NULL for all of these,
 * because we have no English name from the source and inventing one would be
 * fabrication. A URL segment, by contrast, has to exist, and unpointed Hebrew
 * cannot be vowelled by machine — `נוה קודש` transliterates mechanically to
 * `nvh-kvdsh`, which is neither readable nor searchable. Sixteen hand-written
 * lines beat that, and every one of them is checkable against the Hebrew.
 *
 * Keyed on the name as the source writes it, after whitespace folding.
 *
 * TODO(phase 3): the remaining 468 shuls fall back to `transliterate` below.
 * Curate each neighbourhood's names as it is imported, BEFORE the URLs are
 * published — after publication a slug is permanent.
 */
const CURATED: Record<string, string> = {
  'אוהל יוסף יצחק': 'ohel-yosef-yitzchak',
  'אוניברסיטת ת"א - צימבוליסטה': 'universitat-tel-aviv-tzimbalista',
  'אור גבריאל - משמעות': 'or-gavriel-mashmaut',
  'היכל חיים': 'heichal-chaim',
  המרכזי: 'hamerkazi-ramat-aviv',
  // Keyed on the source's name, like every entry here, but slugged from the
  // one the shul uses. The URL is read by people and indexed by search
  // engines, so `hamerkazi` — the municipality's word, and its word for two
  // different buildings — is the wrong thing for it to say. Changed while
  // nothing is published; after launch this would cost every link to the page.
  "המרכזי רמת אביב ג'": 'chabad-ramat-aviv-gimmel',
  'הרמב"ם': 'harambam',
  'לכלל ישראל': 'klal-yisrael',
  'מנין צעירים בני עקיבא': 'minyan-tzeirim-bnei-akiva',
  'משכן אחים': 'mishkan-achim',
  'משען נאות אביבים': 'mishan-neot-avivim',
  'נוה קודש': 'neve-kodesh',
  'עולי בבל': 'olei-bavel',
  'שפרן - ביה"ס אלומות': 'shafran-beit-hasefer-alumot',
  'תהילת אביב': 'tehilat-aviv',
  'תומכי תמימים - בית חב"ד': 'tomchei-tmimim-beit-chabad',
};

/**
 * Consonantal transliteration. Hebrew as the GIS layer writes it has no
 * niqqud, so vowels are simply not present in the input — this produces a
 * stable, URL-safe, machine-readable segment, not a pretty one. That is why
 * CURATED exists.
 */
const LETTERS: Record<string, string> = {
  א: '',
  ב: 'b',
  ג: 'g',
  ד: 'd',
  ה: 'h',
  ו: 'v',
  ז: 'z',
  ח: 'ch',
  ט: 't',
  י: 'y',
  כ: 'k',
  ך: 'k',
  ל: 'l',
  מ: 'm',
  ם: 'm',
  נ: 'n',
  ן: 'n',
  ס: 's',
  ע: '',
  פ: 'p',
  ף: 'f',
  צ: 'tz',
  ץ: 'tz',
  ק: 'k',
  ר: 'r',
  ש: 'sh',
  ת: 't',
};

/** Geresh/gershayim and their ASCII lookalikes: punctuation, not letters. */
const MARKS = /['"׳״‘’“”]/g;
/** Hebrew niqqud and cantillation, if a source ever supplies them. */
const POINTS = /[֑-ׇ]/g;

export function foldName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function transliterate(name: string): string {
  let out = '';
  for (const char of name.replace(POINTS, '').replace(MARKS, '')) {
    out += LETTERS[char] ?? char;
  }
  return out;
}

/** Lowercase, strip anything not a-z0-9, collapse separators. */
export function slugify(text: string): string {
  return transliterate(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SlugSource {
  nameHe: string;
  /** Street only — never the house number, which is not part of an identity. */
  streetHe?: string | null;
  /** OBJECTID from the GIS layer, the last-resort discriminator. */
  gisSourceId?: number | null;
}

/**
 * Ordered slug candidates, least specific first. The caller takes the first
 * one not already held by a *different* synagogue, so the congregation
 * imported first keeps the short URL and later namesakes get a qualified one.
 * Existing slugs are never recomputed, so this order is stable over time.
 */
export function slugCandidates({ nameHe, streetHe, gisSourceId }: SlugSource): string[] {
  const folded = foldName(nameHe);
  const base = CURATED[folded] ?? slugify(folded);
  const candidates: string[] = [];

  if (base) candidates.push(base);

  const street = streetHe ? slugify(foldName(streetHe)) : '';
  if (base && street) candidates.push(`${base}-${street}`);

  if (gisSourceId != null) candidates.push(base ? `${base}-${gisSourceId}` : `shul-${gisSourceId}`);

  // A name of nothing but alef/ayin transliterates to the empty string. Rather
  // than invent a name, fall back to an opaque but valid segment.
  return candidates.filter(isUrlSafeSlug);
}
