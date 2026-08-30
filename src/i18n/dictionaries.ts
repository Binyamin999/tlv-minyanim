import type { Locale } from './locales';
import type { DayType, ReviewReason, Season, Service, Zman } from '@/minyan-times';
import type { DayPhase, UnconfirmedReason } from '@/zmanim';
import type { Movement, Nusach, SynagogueStatus } from '@/lib/taxonomy';
import type { ModePreference } from '@/lib/theme';

/**
 * A plain object per locale. No i18n library: at this size a library buys
 * nothing but a build-time dependency and a runtime that has to be shipped to
 * the client. Server components read the dictionary directly.
 *
 * Hebrew is authored first and is the reference; English follows it.
 */

type UnconfirmedReasonCode = UnconfirmedReason['code'];

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
  /** How a listing was checked. Keyed by VerificationSource — never free text,
   *  which would render one language's prose inside the other's page. */
  verificationSources: {
    notice_board: 'לוח המודעות בבית הכנסת',
    gabbai: 'מהגבאי',
    phone: 'בטלפון',
    shul_website: 'מאתר בית הכנסת',
  } as Record<string, string>,

  /* --- listing and shul pages ------------------------------------- */
  synagogues: 'בתי כנסת',
  allSynagogues: 'כל בתי הכנסת',
  dayTypes: {
    weekday: 'ימי חול',
    erev_shabbat: 'ערב שבת',
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
    teimani: 'תימני',
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
  // Hebrew names its weekdays by letter — יום א׳ .. יום ו׳ — and a schedule
  // board writes just the letter. Saturday is שבת, never ז׳.
  weekdaysShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'] as [string, string, string, string, string, string, string],
  onDays: (days: string) => `ימים ${days}`,
  // The board's own words. A room is a code precisely so each language can
  // print its own — see the minyan_location enum.
  locations: { upstairs: 'למעלה', downstairs: 'למטה', sukkah: 'בסוכה' },
  // The board's own shorthand, which is what a Hebrew reader is looking for.
  styles: {
    netz: 'נץ',
    hodu: 'הודו',
    plag: 'פלג',
    carlebach: 'קרליבך',
    hashkama: 'השכמה',
  },
  // Not the same sentence as the one above, and deliberately so: that one says
  // we are missing data, this one says the synagogue told us there is nothing.
  noServicesHeld: 'לא מתקיימות תפילות',
  /** Rows with a pending review reason. Never shown as confirmed. */
  unconfirmedHeading: 'טעון בדיקה — לא מאושר',
  unconfirmedNote: 'המקור לא ברור, והשעות האלה לא אושרו. אל תסתמכו עליהן.',
  reviewReasons: {
    unattributed_service: 'המקור לא ציין לאיזו תפילה',
    unparsed_text: 'טקסט שלא פוענח',
    implausible_for_service: 'שעה לא סבירה לתפילה הזאת',
    // Deliberately says which tzeit is in question rather than just "unclear".
    // A reader who davens here knows their own shul's minhag and can tell us.
    ambiguous_tzeit: 'לפי צאת הכוכבים — לא ידוע לפי איזו שיטה',
  } satisfies Record<ReviewReason['code'], string>,

  /* --- the timeline (phase 3) -------------------------------------- */
  nextMinyanim: 'המניין הבא',
  nextMinyanimLink: 'איפה אפשר להתפלל עכשיו',
  /** The horizon the page is answering for. */
  withinMinutes: (minutes: number) => `ב-${minutes} הדקות הקרובות`,
  /**
   * The countdown beside the clock. Minutes under an hour, hours above it.
   *
   * "בעוד 463 דק׳" is arithmetically right and useless — nobody counts in
   * eight hours' worth of minutes. The exact clock time sits next to this, so
   * the countdown only has to answer "roughly how far", and at that distance
   * hours answer it better.
   *
   * Floored, not rounded to nearest: seven hours and forty-three minutes reads
   * as seven, so the number is never larger than the time actually remaining.
   * The same reasoning as taking the earlier candle-lighting minhag — erring
   * early costs nothing, erring late means missing the minyan.
   *
   * Hebrew has a dual, so two hours is שעתיים and never "2 שעות".
   */
  inMinutes: (minutes: number) => {
    if (minutes <= 0) return 'עכשיו';
    if (minutes < 60) {
      if (minutes === 1) return 'בעוד דקה';
      if (minutes === 2) return 'בעוד שתי דקות';
      return `בעוד ${minutes} דק'`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      if (hours === 1) return 'בעוד שעה';
      if (hours === 2) return 'בעוד שעתיים';
      return `בעוד ${hours} שעות`;
    }
    // The horizon is eight days, so without this rung a Shabbat-only minyan
    // reads "בעוד 192 שעות" — the same complaint as 463 minutes, one scale up.
    const days = Math.floor(hours / 24);
    if (days === 1) return 'בעוד יום';
    if (days === 2) return 'בעוד יומיים';
    return `בעוד ${days} ימים`;
  },
  noneUpcoming: 'אין מניין עם שעה ידועה בטווח הזה',
  /** The honest-unknown list. Quiet on purpose — see CLAUDE.md. */
  unconfirmedTimesHeading: 'מתפללים כאן, השעה לא ידועה',
  unconfirmedTimesNote:
    'בבתי הכנסת האלה יש את התפילה הזאת, אבל המקור לא מסר את השעה. לא נמציא שעה.',
  /** The halachic span for the service — עובדה על היום, לא על בית הכנסת. */
  betweenTimes: (from: string, to: string) => `בין ${from} ל-${to}`,
  unconfirmedReasons: {
    unknown_offset: 'המקור כתב "בזמן" בלבד',
    erev_shabbat_time_unstated: 'ערב שבת — התפילה זזה לכניסת שבת, והמקור לא ציין לאיזו שעה',
    // The board this came from is reprinted every week, and its week has ended.
    validity_expired: 'הלוח שהשעה נלקחה ממנו התחלף — צריך לקרוא אותו מחדש',
    erev_yom_tov_time_unstated: 'ערב חג — התפילה זזה, והמקור לא ציין לאיזו שעה',
    yom_tov_schedule_unknown: 'חג — לוח הזמנים של החג אינו ידוע לנו',
    anchor_not_on_this_date: 'הזמן שהכלל נשען עליו לא קיים ביום הזה',
    zman_not_computable: 'לא ניתן לחשב את הזמן ליום הזה',
  } satisfies Record<UnconfirmedReasonCode, string>,
  phases: {
    weekday: 'יום חול',
    erev_shabbat: 'ערב שבת',
    shabbat: 'שבת',
    motzaei_shabbat: 'מוצאי שבת',
  } satisfies Record<DayPhase, string>,

  /* --- resolved times and zmanim ------------------------------------ */
  /** The clock time a rule works out to. The rule stays on screen beside it. */
  resolvesTo: (clock: string) => `= ${clock}`,
  today: 'היום',
  /** Beside a board row whose time is not today's. See relativeDayLabel. */
  tomorrow: 'מחר',
  zmanimToday: 'זמני היום בתל אביב',
  /** Every resolved time is computed, not quoted. Say so once, plainly. */
  zmanimSource: 'הזמנים מחושבים לתל אביב-יפו לפי הגר"א, בשעון ישראל',

  /* --- the homepage (phase 4) --------------------------------------- */
  /** The masthead wordmark. Frank Ruhl, and the only place the city is named. */
  wordmark: 'מניינים · תל אביב',
  /** Above the hero card. */
  nextNearYou: 'המניין הבא לידך',
  /** The neighbourhood the data covers today. */
  neighbourhood: 'רמת אביב',
  /** The count line above the cards. */
  synagogueCount: (count: number) =>
    `${count === 1 ? 'בית כנסת אחד' : `${count} בתי כנסת`} · לפי המניין הבא`,
  /**
   * The column headers of the desktop לוח. Drawn only above the breakpoint,
   * where the cards become one dense table across the full measure — a phone
   * has one card per shul and nothing to head.
   *
   * `aria-hidden` in the markup: these label a visual grid, not a <table>, and
   * each row already says its own name, time and nusach out loud. A header
   * row not tied to real table semantics is noise to a screen reader.
   */
  columns: {
    time: 'שעה',
    service: 'תפילה',
    synagogue: 'בית הכנסת',
    nusach: 'נוסח',
    verified: 'עודכן',
  },
  /** The service filter chips. `shabbat` is a day, not a service — see the page. */
  filterShabbat: 'שבת',
  filterAllNusachim: 'כל הנוסחים',
  /** Screen-reader names for the two chip rows. */
  filterServicesLabel: 'סינון לפי תפילה',
  filterNusachLabel: 'סינון לפי נוסח',
  /** The card's honest-unknown line. Quiet on purpose — see CLAUDE.md. */
  unknownTimeCard: 'בזמן — שעה טרם פורסמה',
  /** Beside it. Not a link: there is nowhere honest to send anyone yet. */
  /**
   * The footer of an honest-unknown card, where a known card carries its
   * verified stamp.
   *
   * A STATEMENT, not an imperative. It read "יודעים את השעה? עדכנו" — telling
   * the reader to do something they cannot do, since there is no gabbai portal
   * to do it through. Quieting the styling reduced the misread; the wording
   * still commanded.
   *
   * It also must not repeat `unknownTimeCard` directly above it, which already
   * says the time was never published. So it says the other true thing: nobody
   * has asked the synagogue. That names what would change the answer without
   * asking the reader to be the one who changes it.
   */
  timeNotCheckedWithShul: 'לא אומת מול בית הכנסת',
  /** The compact staleness stamp on a card footer. */
  verifiedShort: (date: string) => `נבדק ${date}`,
  /** The two footer lines. */
  footerComputed: 'כל הזמנים מחושבים לפי מיקום בית הכנסת, ומתעדכנים מדי יום עם השקיעה.',
  footerNeverGuess: 'זמן לא ידוע מוצג כלא ידוע — לעולם לא ננחש.',
  /** The light/dark override. The ONLY toggle that ships. */
  modeControlLabel: 'מצב תצוגה',
  modeAuto: 'אוטו׳',
  modeNames: {
    auto: 'אוטומטי — לפי השקיעה בתל אביב',
    light: 'בהיר',
    dark: 'כהה',
  } satisfies Record<ModePreference, string>,
  /** The language switch, as two short chips rather than a sentence. */
  localeChips: { he: 'עב', en: 'EN' } satisfies Record<Locale, string>,
  languageSwitchLabel: 'שפה',

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
  verificationSources: {
    notice_board: "the synagogue's notice board",
    gabbai: 'the gabbai',
    phone: 'by telephone',
    shul_website: "the synagogue's website",
  } as Record<string, string>,

  synagogues: 'Synagogues',
  allSynagogues: 'All synagogues',
  dayTypes: {
    weekday: 'Weekdays',
    erev_shabbat: 'Erev Shabbat',
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
    teimani: 'Teimani',
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
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  onDays: (days: string) => days,
  locations: { upstairs: 'upstairs', downstairs: 'downstairs', sukkah: 'in the sukkah' },
  // Spelled out, because a visitor who cannot read the board cannot be
  // expected to know the shorthand either. The Hebrew term is kept alongside
  // so it can be matched against a sign.
  styles: {
    netz: 'sunrise (netz)',
    hodu: 'from Hodu',
    plag: 'after plag',
    carlebach: 'Carlebach',
    hashkama: 'hashkama',
  },
  noServicesHeld: 'No services held',
  unconfirmedHeading: 'Needs checking — not confirmed',
  unconfirmedNote: 'The source is unclear and these have not been confirmed. Do not rely on them.',
  reviewReasons: {
    unattributed_service: 'The source did not say which service',
    unparsed_text: 'Text the parser could not read',
    implausible_for_service: 'Implausible time for this service',
    ambiguous_tzeit: 'At tzeit — but the source does not say which tzeit',
  },

  nextMinyanim: 'Next minyan',
  nextMinyanimLink: 'Where you can daven right now',
  withinMinutes: (minutes: number) => `in the next ${minutes} minutes`,
  /** Minutes under an hour, hours above it. Floored — see the Hebrew note. */
  inMinutes: (minutes: number) => {
    if (minutes <= 0) return 'now';
    if (minutes < 60) return minutes === 1 ? 'in 1 min' : `in ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'in 1 day' : `in ${days} days`;
  },
  noneUpcoming: 'No minyan with a known time in this window',
  unconfirmedTimesHeading: 'Davening here, time not known',
  unconfirmedTimesNote:
    'These synagogues hold this service, but the source never gave a time. We will not invent one.',
  betweenTimes: (from: string, to: string) => `between ${from} and ${to}`,
  unconfirmedReasons: {
    unknown_offset: 'The source said only "at the proper time"',
    erev_shabbat_time_unstated:
      'Erev Shabbat — the service moves to candle lighting, and the source never said to when',
    validity_expired: 'The board this came from has been replaced — it needs reading again',
    erev_yom_tov_time_unstated:
      'Erev Yom Tov — the service moves, and the source never said to when',
    yom_tov_schedule_unknown: 'Yom Tov — we do not have the festival schedule',
    anchor_not_on_this_date: 'The zman this rule depends on does not occur on this date',
    zman_not_computable: 'The zman could not be computed for this date',
  },
  phases: {
    weekday: 'Weekday',
    erev_shabbat: 'Erev Shabbat',
    shabbat: 'Shabbat',
    motzaei_shabbat: 'Motzaei Shabbat',
  },

  resolvesTo: (clock: string) => `= ${clock}`,
  today: 'today',
  tomorrow: 'tomorrow',
  zmanimToday: "Today's zmanim in Tel Aviv",
  zmanimSource: 'Computed for Tel Aviv-Yafo, GRA, Israel time',

  wordmark: 'Minyanim · Tel Aviv',
  nextNearYou: 'The next minyan near you',
  neighbourhood: 'Ramat Aviv',
  synagogueCount: (count: number) =>
    `${count === 1 ? '1 synagogue' : `${count} synagogues`} · by next minyan`,
  columns: {
    time: 'Time',
    service: 'Service',
    synagogue: 'Synagogue',
    nusach: 'Nusach',
    verified: 'Updated',
  },
  filterShabbat: 'Shabbat',
  filterAllNusachim: 'All nusachim',
  filterServicesLabel: 'Filter by service',
  filterNusachLabel: 'Filter by nusach',
  unknownTimeCard: 'At the proper time — not yet published',
  timeNotCheckedWithShul: 'Not checked with the synagogue',
  verifiedShort: (date: string) => `Checked ${date}`,
  footerComputed:
    'Every time is computed for the synagogue\u2019s own location and moves with the sunset each day.',
  footerNeverGuess: 'A time we do not know is shown as unknown — we never guess.',
  modeControlLabel: 'Display mode',
  modeAuto: 'Auto',
  modeNames: {
    auto: 'Automatic — follows sunset in Tel Aviv',
    light: 'Light',
    dark: 'Dark',
  },
  localeChips: { he: 'עב', en: 'EN' },
  languageSwitchLabel: 'Language',

  walkingDirections: 'Walking directions',
  wazeDirections: 'Navigate with Waze',
  directionsTo: (name: string) => `to ${name}`,
};

export type Dictionary = typeof he;

const DICTIONARIES: Record<Locale, Dictionary> = { he, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
