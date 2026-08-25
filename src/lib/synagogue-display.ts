import type { Synagogue } from '@/db/queries';
import type { Locale } from '@/i18n/locales';

/**
 * Names and addresses across the language boundary.
 *
 * `name_en` and `address_en` are NULL until somebody translates them. On the
 * English page we therefore show the Hebrew — which is true — rather than a
 * transliteration nobody wrote. `foreign` tells the caller to mark that run of
 * text with its own `lang` and `dir`, which is what stops a Hebrew name from
 * being reordered by the surrounding LTR paragraph. Mixed Hebrew, English and
 * digits on one line is exactly where RTL breaks.
 */
export interface LocalisedText {
  text: string;
  /** True when the text is not in the page's language. */
  foreign: boolean;
}

export function localisedName(synagogue: Synagogue, locale: Locale): LocalisedText {
  if (locale === 'he') return { text: synagogue.nameHe, foreign: false };
  return synagogue.nameEn
    ? { text: synagogue.nameEn, foreign: false }
    : { text: synagogue.nameHe, foreign: true };
}

export function localisedAddress(synagogue: Synagogue, locale: Locale): LocalisedText | null {
  if (locale === 'he') {
    return synagogue.addressHe ? { text: synagogue.addressHe, foreign: false } : null;
  }
  if (synagogue.addressEn) return { text: synagogue.addressEn, foreign: false };
  return synagogue.addressHe ? { text: synagogue.addressHe, foreign: true } : null;
}

/** `lang`/`dir` for a run of foreign text, spread onto the element. */
export function foreignAttrs(value: LocalisedText): { lang?: 'he'; dir?: 'rtl' } {
  return value.foreign ? { lang: 'he', dir: 'rtl' } : {};
}
