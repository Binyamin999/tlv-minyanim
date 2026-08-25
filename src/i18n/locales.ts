/**
 * Locale routing. Hebrew is primary, English is the wedge — both exist from the
 * first commit because retrofitting bilingual URLs means losing every ranking.
 */

export const LOCALES = ['he', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** The locale a bare `/` resolves to. */
export const DEFAULT_LOCALE: Locale = 'he';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Writing direction. Drives `dir` on <html>; CSS uses logical properties only. */
export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/**
 * BCP-47 tag for `lang` and for `hreflang`. Region-qualified on purpose: this
 * is a Tel Aviv site, and `en-IL` tells a crawler which English it is.
 */
export const HTML_LANG: Record<Locale, string> = {
  he: 'he-IL',
  en: 'en-IL',
};

/** The one place in the app that knows times are Israeli. */
export const TIME_ZONE = 'Asia/Jerusalem';
