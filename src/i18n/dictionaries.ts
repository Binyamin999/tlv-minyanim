import type { Locale } from './locales';
import type { Service, Zman } from '@/minyan-times';

/**
 * A plain object per locale. No i18n library: at this size a library buys
 * nothing but a build-time dependency and a runtime that has to be shipped to
 * the client. Server components read the dictionary directly.
 *
 * Hebrew is authored first and is the reference; English follows it.
 */

const he = {
  siteName: 'מניינים תל אביב',
  tagline: 'איפה אפשר להתפלל עכשיו',
  languageName: 'עברית',
  otherLanguageName: 'English',
  services: {
    shacharit: 'שחרית',
    mincha: 'מנחה',
    arvit: 'ערבית',
  } satisfies Record<Service, string>,
  zmanim: {
    alot: 'עלות השחר',
    netz: 'נץ',
    shema: 'סוף זמן קריאת שמע',
    chatzot: 'חצות',
    mincha_gedola: 'מנחה גדולה',
    mincha_ketana: 'מנחה קטנה',
    plag: 'פלג המנחה',
    shkia: 'שקיעה',
    tzeit: 'צאת הכוכבים',
    candle_lighting: 'כניסת שבת',
  } satisfies Record<Zman, string>,
  /** Before a zman, e.g. "20 דק' לפני שקיעה". */
  minutesBefore: (minutes: number, zman: string) => `${minutes} דק' לפני ${zman}`,
  minutesAfter: (minutes: number, zman: string) => `${minutes} דק' אחרי ${zman}`,
  atZman: (zman: string) => zman,
  /** The honest-unknown state. Quiet on purpose — see CLAUDE.md. */
  unknownTime: 'בזמן — השעה המדויקת אינה ידועה',
  unknownTimeShort: 'לא ידוע',
  lastVerified: (date: string) => `עודכן לאחרונה ${date}`,
  neverVerified: 'טרם אומת',
  verifiedBy: (source: string) => `מקור: ${source}`,
};

/** English must answer every key Hebrew asks. The compiler enforces it. */
const en: typeof he = {
  siteName: 'TLV Minyanim',
  tagline: 'Where you can daven right now',
  languageName: 'English',
  otherLanguageName: 'עברית',
  services: {
    shacharit: 'Shacharit',
    mincha: 'Mincha',
    arvit: 'Arvit',
  },
  zmanim: {
    alot: 'alot hashachar',
    netz: 'netz',
    shema: 'sof zman kriat shema',
    chatzot: 'chatzot',
    mincha_gedola: 'mincha gedola',
    mincha_ketana: 'mincha ketana',
    plag: 'plag hamincha',
    shkia: 'shkia',
    tzeit: 'tzeit hakochavim',
    candle_lighting: 'candle lighting',
  },
  minutesBefore: (minutes: number, zman: string) => `${minutes} min before ${zman}`,
  minutesAfter: (minutes: number, zman: string) => `${minutes} min after ${zman}`,
  atZman: (zman: string) => `at ${zman}`,
  unknownTime: 'At the proper time — exact time not known',
  unknownTimeShort: 'Not known',
  lastVerified: (date: string) => `Last verified ${date}`,
  neverVerified: 'Not yet verified',
  verifiedBy: (source: string) => `Source: ${source}`,
};

export type Dictionary = typeof he;

const DICTIONARIES: Record<Locale, Dictionary> = { he, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
