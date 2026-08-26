import type { MinyanTime } from '@/minyan-times';
import type { Dictionary } from '@/i18n/dictionaries';
import { TIME_ZONE, type Locale } from '@/i18n/locales';

/**
 * Turning a structured MinyanTime into words. This is the ONLY place that is
 * allowed to produce a display string, and it is a one-way door: nothing reads
 * these strings back. The structured value stays the source of truth.
 *
 * `known: false` is not a failure to render — it is the render. An unknown
 * offset shows as unknown, never as a plausible-looking time.
 */
export interface DisplayTime {
  /** True when the value is a real clock time we can print with digits. */
  known: boolean;
  /** What the user reads. */
  text: string;
  /** True for `fixed` only: safe to typeset as tabular numerals in a column. */
  numeric: boolean;
}

export function displayMinyanTime(time: MinyanTime, t: Dictionary): DisplayTime {
  switch (time.kind) {
    case 'fixed':
      // Already normalised to HH:MM, Asia/Jerusalem, by the parser.
      return { known: true, text: time.time, numeric: true };

    case 'relative': {
      const zman = t.zmanim[time.anchor];
      // TODO(phase 3): once the zmanim library is wired in, a relative time
      // also resolves to a clock time for a given date. Until then we state
      // the rule, which is the thing that stays correct as sunset moves.
      if (time.offsetMinutes === 0) return { known: true, text: t.atZman(zman), numeric: false };
      const magnitude = Math.abs(time.offsetMinutes);
      const text =
        time.offsetMinutes < 0 ? t.minutesBefore(magnitude, zman) : t.minutesAfter(magnitude, zman);
      return { known: true, text, numeric: false };
    }

    case 'unknown':
      // `time.rawText` is kept in the record and is deliberately NOT shown as
      // if it were a time. We say we do not know.
      return { known: false, text: t.unknownTime, numeric: false };
  }
}

/**
 * The verification date, in Asia/Jerusalem — the only timezone this product
 * has. Rendered as a civil date, so no sunset rollover question arises here;
 * that concern belongs to the Hebrew calendar, not to this stamp.
 */
export function formatVerifiedDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * The same date, short enough for a card footer — `12.8.26`.
 *
 * The card design gives the staleness stamp ten pixels and one line, which is
 * a size, not a demotion: CLAUDE.md requires `last_verified_at` wherever a
 * time is shown, and a stamp that does not fit gets dropped by whoever builds
 * the next card. Numeric so it fits, tabular where it is used so a column of
 * them lines up.
 */
export function formatVerifiedDateShort(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(date);
}
