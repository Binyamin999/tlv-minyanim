/**
 * Fixtures — every raw time string in `data/seed-ramat-aviv.json`.
 *
 * PRIVACY. `data/seed-ramat-aviv.json` is gitignored on purpose: it carries
 * rabbi and gabbai names and personal phone numbers, which are personal data
 * under Israeli privacy law. This file is tracked, so it contains ONLY the
 * synagogue name and the free-text time strings. No `rabbi_*`, no `gabbai_*`,
 * no `phone_*` value appears here, in any test, in any snapshot, or in any
 * console output. If you regenerate this file, keep it that way.
 *
 * These are the 16 Ramat Aviv shuls (v0 scope). The parser is built for all 484
 * Tel Aviv-Yafo synagogues, so this sample is a floor, not a ceiling.
 */

export interface SeedFixture {
  nameHe: string;
  /** `weekday_times_raw` — parsed with dayType 'weekday'. */
  weekday: string | null;
  /** `shabbat_times_raw` — parsed with dayType 'shabbat'. */
  shabbat: string | null;
  /** `daf_yomi_raw` — a class, not a minyan field. Must never yield a minyan. */
  dafYomi: string | null;
  /** `notes_he` — occasionally carries a status. */
  notes: string | null;
}

export const SEED_FIXTURES: readonly SeedFixture[] = [
  {
    nameHe: "אוהל יוסף יצחק",
    weekday: null,
    shabbat: "שחרית-5:45, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "אוניברסיטת ת\"א - צימבוליסטה",
    weekday: "שחרית-7:20, מנחה-13:30-13:55-בזמן",
    shabbat: null,
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "אור גבריאל - משמעות",
    weekday: "מנחה-בזמן",
    shabbat: "שחרית-8:15, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "היכל חיים",
    weekday: "שחרית-6:15-7:30, מנחה-בזמן",
    shabbat: "שחרית-7.30-8.30, מנחה-בזמן",
    dafYomi: "שיעור דף יומי, בימים א-ה בשעה 7:00",
    notes: null,
  },
  {
    nameHe: "המרכזי",
    weekday: "שחרית-6:30,",
    shabbat: "שחרית-8:15, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "המרכזי רמת אביב ג'",
    weekday: "שחרית-6:30-8:00, מנחה-14:00-בזמן",
    shabbat: "שחרית-9:00, מנחה- בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "הרמב\"ם",
    weekday: "שחרית-6:00, מנחה-בזמן",
    shabbat: "שחרית-7:00, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "לכלל ישראל",
    weekday: "שחרית - 6:25, מנחה 20 דק' לפי שקיעה",
    shabbat: "שחרית - 8:00, מנחה - 10 דק' לפי כניסת שבת",
    dafYomi: "בימים א'- ה' שיעור בין מנחה לערבית",
    notes: null,
  },
  {
    nameHe: "מנין צעירים בני עקיבא",
    weekday: null,
    shabbat: "שחרית-8:30",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "משכן אחים",
    weekday: null,
    shabbat: "שחרית-7:00",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "משען נאות אביבים",
    weekday: "פתוח בחגים בלבד",
    shabbat: null,
    dafYomi: null,
    notes: "פתוח בחגים ובמועדי ישראל",
  },
  {
    nameHe: "נוה קודש",
    weekday: "שחרית-6:45",
    shabbat: "שחרית-7:50, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "עולי בבל",
    weekday: "שחרית-7:30, מנחה-בזמן",
    shabbat: "שחרית-7:45, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "שפרן - ביה\"ס אלומות",
    weekday: null,
    shabbat: "שחרית-8:45, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
  {
    nameHe: "תהילת אביב",
    weekday: "שחרית-נץ-7:00, מנחה-13:00-בזמן",
    shabbat: "שחרית-נץ-7:45, ח 12:30 ק 13:30-בזמן",
    dafYomi: "שיעור דף יומי, בימים א-ה אחרי ערבית",
    notes: null,
  },
  {
    nameHe: "תומכי תמימים - בית חב\"ד",
    weekday: "שחרית-6:30-7:30-9:00-10:00, מנחה-14:05-15:15-בזמן, 21:00",
    shabbat: "שחרית-10:00, מנחה-בזמן",
    dafYomi: null,
    notes: null,
  },
];

/** Every raw time string in the seed, flattened, with its field of origin. */
export const ALL_RAW_STRINGS: ReadonlyArray<{
  nameHe: string;
  field: 'weekday' | 'shabbat' | 'dafYomi' | 'notes';
  raw: string;
}> = SEED_FIXTURES.flatMap((f) =>
  (['weekday', 'shabbat', 'dafYomi', 'notes'] as const)
    .filter((k) => f[k] !== null)
    .map((k) => ({ nameHe: f.nameHe, field: k, raw: f[k] as string })),
);
