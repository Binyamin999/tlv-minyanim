import type { Locale } from './locales';
import type { DayType, ReviewReason, Season, Service, Zman } from '@/minyan-times';
import type { Movement, Nusach, SynagogueStatus } from '@/lib/taxonomy';

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

  /* --- listing and shul pages ------------------------------------- */
  synagogues: 'בתי כנסת',
  allSynagogues: 'כל בתי הכנסת',
  dayTypes: {
    weekday: 'ימי חול',
    shabbat: 'שבת',
  } satisfies Record<DayType, string>,
  seasons: {
    winter: 'חורף',
    summer: 'קיץ',
  } satisfies Record<Season, string>,
  nusachim: {
    ashkenaz: 'אשכנז',
    sefard: 'ספרד',
    edot_hamizrach: 'עדות המזרח',
    teimani_baladi: 'תימני בלאדי',
    teimani_shami: 'תימני שאמי',
    moroccan: 'מרוקאי',
    tunisian: 'תוניסאי',
    iraqi: 'עיראקי',
    persian: 'פרסי',
    salonikan: 'סלוניקאי',
    general: 'כללי',
  } satisfies Record<Nusach, string>,
  movements: {
    chabad: 'חב"ד',
    breslev: 'ברסלב',
  } satisfies Record<Movement, string>,
  statuses: {
    active: 'פעיל',
    holidays_only: 'פתוח בחגים בלבד',
    seasonal: 'עונתי',
    dormant: 'רדום',
    closed: 'סגור',
  } satisfies Record<SynagogueStatus, string>,
  /** No time at all for a day. Honest blank, not an empty table. */
  noKnownTimes: 'אין שעות ידועות',
  /** Rows with a pending review reason. Never shown as confirmed. */
  unconfirmedHeading: 'טעון בדיקה — לא מאושר',
  unconfirmedNote: 'המקור לא ברור, והשעות האלה לא אושרו. אל תסתמכו עליהן.',
  reviewReasons: {
    unattributed_service: 'המקור לא ציין לאיזו תפילה',
    unparsed_text: 'טקסט שלא פוענח',
    implausible_for_service: 'שעה לא סבירה לתפילה הזאת',
  } satisfies Record<ReviewReason['code'], string>,
  /** Walking, not driving. People walk to shul — see CLAUDE.md. */
  walkingDirections: 'מסלול הליכה',
  wazeDirections: 'ניווט ב־Waze',
  /** Screen-reader context for the two link labels above. */
  directionsTo: (name: string) => `אל ${name}`,
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

  synagogues: 'Synagogues',
  allSynagogues: 'All synagogues',
  dayTypes: {
    weekday: 'Weekdays',
    shabbat: 'Shabbat',
  },
  seasons: {
    winter: 'winter',
    summer: 'summer',
  },
  nusachim: {
    ashkenaz: 'Ashkenaz',
    sefard: 'Sefard',
    edot_hamizrach: 'Edot HaMizrach',
    teimani_baladi: 'Teimani Baladi',
    teimani_shami: 'Teimani Shami',
    moroccan: 'Moroccan',
    tunisian: 'Tunisian',
    iraqi: 'Iraqi',
    persian: 'Persian',
    salonikan: 'Salonikan',
    general: 'General',
  },
  movements: {
    chabad: 'Chabad',
    breslev: 'Breslev',
  },
  statuses: {
    active: 'Active',
    holidays_only: 'Open on festivals only',
    seasonal: 'Seasonal',
    dormant: 'Dormant',
    closed: 'Closed',
  },
  noKnownTimes: 'No times known',
  unconfirmedHeading: 'Needs checking — not confirmed',
  unconfirmedNote: 'The source is unclear and these have not been confirmed. Do not rely on them.',
  reviewReasons: {
    unattributed_service: 'The source did not say which service',
    unparsed_text: 'Text the parser could not read',
    implausible_for_service: 'Implausible time for this service',
  },
  walkingDirections: 'Walking directions',
  wazeDirections: 'Navigate with Waze',
  directionsTo: (name: string) => `to ${name}`,
};

export type Dictionary = typeof he;

const DICTIONARIES: Record<Locale, Dictionary> = { he, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
