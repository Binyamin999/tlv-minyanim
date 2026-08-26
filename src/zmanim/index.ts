/**
 * The zmanim engine: stored rules in, instants out.
 *
 * Nothing in here computes astronomy — @hebcal/core (KosherJava-derived) does,
 * and `day.ts` names every shita it selected. Nothing in here talks to the
 * database either, so the whole engine is testable at midwinter, at midsummer
 * and on both DST mornings without a clock or a Postgres.
 */
export type { JerusalemDate } from './jerusalem-date.ts';
export {
  addDays,
  clockFaceOf,
  dayOfWeek,
  instantOfClockTime,
  isoDate,
  jerusalemDateOf,
  jerusalemInstant,
  sameJerusalemDate,
  seasonAt,
  startOfJerusalemDay,
  zoneOffsetMs,
  TIME_ZONE,
} from './jerusalem-date.ts';

export { TEL_AVIV, TZEIT_DEGREES, USE_ELEVATION } from './location.ts';

export type { Parsha } from './parsha.ts';
export { parshaAt, parshaOn } from './parsha.ts';

export type { DayZmanim, HebrewDay } from './day.ts';
export { anchorInstant, clearZmanimCache, hebrewDayAt, isDaylight, zmanimFor } from './day.ts';

export type { ResolutionBasis, ResolvedMinyanTime, UnresolvedReason } from './resolve.ts';
export { isResolved, resolveAgainstDay, resolveMinyanTime, resolveOnDate } from './resolve.ts';

export type { DayPhase, DayWindow } from './windows.ts';
export { isShabbatNow, windowAt, windowsBetween, windowsOnDate } from './windows.ts';

export type {
  NextMinyanimOptions,
  Timeline,
  TimelineMinyan,
  TimelineSynagogue,
  UnconfirmedMinyan,
  UnconfirmedReason,
  UpcomingMinyan,
} from './timeline.ts';
export { nextMinyanim } from './timeline.ts';
