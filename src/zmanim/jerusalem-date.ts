/**
 * Civil dates and wall-clock arithmetic in Asia/Jerusalem.
 *
 * Everything in this product happens in one timezone, and none of it may
 * depend on the timezone of the machine doing the rendering. A Vercel function
 * runs in UTC; a laptop runs in whatever the laptop is set to. If "today" is
 * ever read off a host-local `Date`, the site shows yesterday's minyanim to
 * anyone loading it between midnight and 02:00 Israel time, and nobody notices
 * for months.
 *
 * So a date here is `{ year, month, day }` — a calendar square, not an instant
 * — and the only way to turn one into an instant is `jerusalemInstant`, which
 * asks the tz database for the offset in force at that moment rather than
 * assuming one. That is what keeps a 06:30 shacharit at 06:30 on the two
 * mornings a year when the clocks move.
 */

/** A calendar square in Asia/Jerusalem. `month` is 1-12. Never an instant. */
export interface JerusalemDate {
  year: number;
  month: number;
  day: number;
}

export const TIME_ZONE = 'Asia/Jerusalem';

/**
 * `hourCycle: 'h23'` and not `hour12: false`: the latter yields "24" for
 * midnight under some ICU builds, which silently rolls a date forward.
 */
const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallParts(instant: Date): WallParts {
  const found: Record<string, number> = {};
  for (const part of PARTS.formatToParts(instant)) {
    if (part.type !== 'literal') found[part.type] = Number(part.value);
  }
  return {
    year: found.year ?? 0,
    month: found.month ?? 0,
    day: found.day ?? 0,
    hour: found.hour ?? 0,
    minute: found.minute ?? 0,
    second: found.second ?? 0,
  };
}

/**
 * How far ahead of UTC Asia/Jerusalem is at `instant`, in milliseconds.
 * +2h on Israel Standard Time, +3h on Israel Daylight Time. Read from the tz
 * database via Intl — never a constant, never a guess about when DST moves.
 */
export function zoneOffsetMs(instant: Date): number {
  const w = wallParts(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // The instant itself may carry milliseconds the formatter dropped.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * `ק` (summer) / `ח` (winter), decided by the clock rather than by a calendar
 * of our own.
 *
 * A source that writes `ח 12:30 ק 13:30` is describing a one-hour shift, and
 * the one-hour shift Israel actually performs is שעון קיץ. So summer is
 * exactly "Asia/Jerusalem is on IDT (UTC+3)". This is deterministic, comes
 * from the tz database, and moves by itself when the Knesset moves the dates.
 */
export function seasonAt(instant: Date): 'winter' | 'summer' {
  return zoneOffsetMs(instant) === 3 * 3_600_000 ? 'summer' : 'winter';
}

/** The calendar square `instant` falls on, in Asia/Jerusalem. */
export function jerusalemDateOf(instant: Date): JerusalemDate {
  const w = wallParts(instant);
  return { year: w.year, month: w.month, day: w.day };
}

/**
 * The instant at which the Jerusalem wall clock reads `hour:minute` on `date`.
 *
 * Two passes: guess that Jerusalem is UTC, correct by the offset in force at
 * the guess, then correct again using the offset at the corrected instant. The
 * second pass is what makes the two DST mornings come out right — the first
 * guess can land on the wrong side of a transition, the second cannot, because
 * by then we are evaluating the offset within an hour of the real answer.
 *
 * Two wall times a year are pathological and this function does not pretend
 * otherwise:
 *  - Spring forward: 02:00-02:59 does not exist. The result lands after the
 *    transition (02:30 -> 03:30). No minyan is at 02:30.
 *  - Autumn back: 01:00-01:59 happens twice. The result is the first one.
 */
export function jerusalemInstant(date: JerusalemDate, hour: number, minute: number): Date {
  const asIfUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0, 0);
  const firstPass = asIfUtc - zoneOffsetMs(new Date(asIfUtc));
  const secondPass = asIfUtc - zoneOffsetMs(new Date(firstPass));
  return new Date(secondPass);
}

/** Midnight opening `date`, in Asia/Jerusalem. */
export function startOfJerusalemDay(date: JerusalemDate): Date {
  return jerusalemInstant(date, 0, 0);
}

/** "HH:MM" -> the instant it names on `date`. Throws on anything else. */
export function instantOfClockTime(date: JerusalemDate, clock: string): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) throw new Error(`not an HH:MM clock face: ${JSON.stringify(clock)}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`not a clock face: ${clock}`);
  return jerusalemInstant(date, hour, minute);
}

/** The Jerusalem wall clock at `instant`, as "HH:MM". Seconds are truncated. */
export function clockFaceOf(instant: Date): string {
  const w = wallParts(instant);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

/** `date` shifted by whole days. Normalised through UTC, so month ends are safe. */
export function addDays(date: JerusalemDate, days: number): JerusalemDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 0 = Sunday .. 6 = Saturday. Computed from the calendar square, not an instant. */
export function dayOfWeek(date: JerusalemDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function sameJerusalemDate(a: JerusalemDate, b: JerusalemDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** ISO `YYYY-MM-DD`. Used as a cache key and in `<time datetime>`. */
export function isoDate(date: JerusalemDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${date.year}-${mm}-${dd}`;
}

/**
 * A `Date` whose *host-local* Y/M/D equal this Jerusalem calendar square.
 *
 * This exists solely to feed @hebcal/core, whose `Zmanim` constructor reads
 * the year, month and day off a `Date` in the host's local timezone and
 * ignores the time of day. Noon is used rather than midnight because midnight
 * does not exist on spring-forward day in a handful of zones (and a
 * non-existent local midnight silently rolls the date).
 *
 * Nothing outside this module may use the result as an instant. It is a
 * calendar square wearing a `Date` costume because a library asked it to.
 */
export function asHostLocalNoon(date: JerusalemDate): Date {
  return new Date(date.year, date.month - 1, date.day, 12, 0, 0, 0);
}
