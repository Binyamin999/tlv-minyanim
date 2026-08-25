/**
 * Hebrew vocabulary for the minyan-time parser.
 *
 * Everything here is a *closed* list on purpose. A word that is not in these
 * tables produces a loud `unrecognized_text` issue rather than a shrug. Adding
 * a word is a deliberate act with a source behind it.
 */
import type { Service, SynagogueStatus, Zman } from './types.ts';

/**
 * Service labels. Matched only at the start of a segment — a service word in
 * the middle of a segment is not a label, it is prose.
 */
export const SERVICE_LABELS: ReadonlyArray<readonly [string, Service]> = [
  // Longest first. No entry may follow one it is a prefix of.
  ['ערבית ומעריב', 'arvit'],
  ['שחרית', 'shacharit'],
  ['מעריב', 'arvit'],
  ['ערבית', 'arvit'],
  ['מנחה', 'mincha'],
];

/**
 * Zman anchor phrases, longest first so that `שקיעת החמה` wins over `שקיעה`
 * and `מנחה גדולה` is never shredded into the service word `מנחה`.
 * A leading definite article `ה` is tolerated on each (`השקיעה`, `הנץ`).
 */
export const ANCHOR_PHRASES: ReadonlyArray<readonly [string, Zman]> = [
  ['סוף זמן קריאת שמע', 'shema'],
  ['זמן קריאת שמע', 'shema'],
  ['סוף זמן ק"ש', 'shema'],
  ['צאת הכוכבים', 'tzeit'],
  ['צאת השבת', 'tzeit'],
  ['הדלקת הנרות', 'candle_lighting'],
  ['הדלקת נרות', 'candle_lighting'],
  ['כניסת השבת', 'candle_lighting'],
  ['כניסת שבת', 'candle_lighting'],
  ['שקיעת החמה', 'shkia'],
  ['נץ החמה', 'netz'],
  ['מנחה גדולה', 'mincha_gedola'],
  ['מנחה קטנה', 'mincha_ketana'],
  ['פלג המנחה', 'plag'],
  ['עלות השחר', 'alot'],
  ['חצות היום', 'chatzot'],
  ['שקיעה', 'shkia'],
  ['זריחה', 'netz'],
  ['חצות', 'chatzot'],
  ['עלות', 'alot'],
  ['צאת', 'tzeit'],
  ['פלג', 'plag'],
  ['נץ', 'netz'],
];

/**
 * Directional prepositions.
 *
 * `לפני` / `קודם` mean *before*: unambiguous, sign is explicit.
 * `אחרי` / `לאחר` mean *after*:  unambiguous, sign is explicit.
 *
 * `לפי` literally means "according to" and carries no direction at all. It is
 * how the municipality actually writes it — `מנחה 20 דק' לפי שקיעה`. CLAUDE.md
 * fixes this as `shkia - 20min`, and that reading survives every check we can
 * make on it: Mincha must be davened before shkia, and on erev Shabbat "10 min
 * לפי כניסת שבת" lands Mincha ~30 min before shkia, ahead of Kabbalat Shabbat,
 * which is the ordinary order of the service. We therefore read `לפי` as
 * *before* — but mark the result `signBasis: 'convention'` so a human can find
 * every one of them again in one query. See docs in parseMinyanTimes.ts.
 */
export const PREPOSITIONS: ReadonlyArray<
  readonly [string, -1 | 1, 'explicit' | 'convention']
> = [
  ['לפני', -1, 'explicit'],
  ['קודם', -1, 'explicit'],
  ['לאחר', 1, 'explicit'],
  ['אחרי', 1, 'explicit'],
  ['לפי', -1, 'convention'],
];

/** `בזמן` = "at the proper time". ~60% of the corpus. Always `unknown`. */
export const UNKNOWN_MARKERS: readonly string[] = ['בזמנו', 'בזמנה', 'בזמן', 'כרגיל'];

/** `ח` = חורף (winter), `ק` = קיץ (summer). Standalone single letters only. */
export const SEASON_MARKERS: ReadonlyArray<readonly [string, 'winter' | 'summer']> = [
  ['ח', 'winter'],
  ['ק', 'summer'],
];

/** Minute words that may sit between the number and the preposition. */
export const MINUTE_WORDS: readonly string[] = ['דקות', 'דקה', "דק'", 'דק'];

/** Whole-segment status phrases. These are not times at all. */
export const STATUS_PATTERNS: ReadonlyArray<readonly [RegExp, SynagogueStatus]> = [
  [/פתוח\s+בחגים/, 'holidays_only'],
  [/בחגים\s+בלבד/, 'holidays_only'],
  [/במועדי\s+ישראל/, 'holidays_only'],
  [/^סגור(?![\u05D0-\u05EA])/, 'closed'],
];

/** Marks a segment as a class, not a minyan. */
export const SHIUR_MARKERS: readonly RegExp[] = [/שיעור/, /דף\s*יומי/];
