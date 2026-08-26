/**
 * The bridge between the pure zmanim engine and a rendered page.
 *
 * The shul page needs one thing the timeline does not directly give it: for a
 * single stored rule, the next moment that rule actually produces. Rather than
 * re-deriving the placement rules (which column governs Friday afternoon, when
 * Shabbat ends, what a Yom Tov does), it runs the timeline over one synagogue
 * for eight days and reads the answer off. One set of rules, one place.
 *
 * Eight days because a Shabbat-only minyan must be reachable from any day of
 * the week, plus a day of slack so Saturday night still finds next Shabbat.
 */
import { nextMinyanim, TEL_AVIV, type JerusalemDate, type TimelineSynagogue } from '@/zmanim';
import { TIME_ZONE, type Locale } from '@/i18n/locales';

const HORIZON_MINUTES = 8 * 24 * 60;

export interface NextOccurrence {
  instant: Date;
  /** Asia/Jerusalem wall clock, "HH:MM". Print this; never print a Date. */
  clock: string;
  date: JerusalemDate;
  isToday: boolean;
}

/**
 * The next moment each of this synagogue's rules produces, keyed by minyan id.
 *
 * A rule that never resolves — `בזמן`, or a candle-lighting anchor with no
 * candle lighting in range — is simply absent from the map. Absent means
 * "we have no time for this", and the caller renders the rule alone. There is
 * no entry carrying a null.
 */
export function nextOccurrences(
  synagogue: TimelineSynagogue,
  now: Date,
): Map<number, NextOccurrence> {
  const timeline = nextMinyanim({
    now,
    within: HORIZON_MINUTES,
    location: TEL_AVIV,
    synagogues: [synagogue],
  });

  const today = jerusalemDayKey(now);
  const out = new Map<number, NextOccurrence>();
  for (const row of timeline.upcoming) {
    // `upcoming` is sorted, so the first hit for an id is the earliest.
    if (out.has(row.minyan.id)) continue;
    out.set(row.minyan.id, {
      instant: row.instant,
      clock: row.clock,
      date: row.date,
      isToday: jerusalemDayKey(row.instant) === today,
    });
  }
  return out;
}

function jerusalemDayKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * "Saturday", "שבת" — the weekday an instant falls on, in Asia/Jerusalem.
 *
 * Used only to label a resolved time that is not today's. The Hebrew date is a
 * separate question and rolls at sunset; this one is the civil weekday, which
 * is what a reader glancing at "= 08:00" needs to know.
 */
export function weekdayName(instant: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(instant);
}
