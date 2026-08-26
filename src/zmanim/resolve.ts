/**
 * Turning a stored rule into an instant.
 *
 * THE POINT OF THE RETURN TYPE: a caller must not be able to read a time off
 * an unknown. `ResolvedMinyanTime` is a discriminated union whose `unresolved`
 * arm has no `instant` and no `clock` — not `null`, not `undefined`, absent.
 * `result.instant` is a compile error until the caller has narrowed on `kind`.
 *
 * An optional `Date | null` would have been the obvious shape and is exactly
 * the trap: `null` formats as the epoch, sorts before everything, and reads as
 * midnight. CLAUDE.md's worst outcome — a plausible-looking fabricated time —
 * arrives through precisely that door.
 */
import type { Location } from '@hebcal/core';
import type { MinyanTime, Zman } from '../minyan-times/index.ts';
import { anchorInstant, zmanimFor, type DayZmanim } from './day.ts';
import { clockFaceOf, instantOfClockTime, type JerusalemDate } from './jerusalem-date.ts';

export type UnresolvedReason =
  /**
   * `kind: 'unknown'` — the source said `בזמן` and gave no offset. This never
   * becomes a time. Not on a busy day, not with a "probably", not ever.
   */
  | { code: 'unknown_offset'; rawText: string }
  /**
   * The rule names an anchor that does not occur on this date — in practice
   * `candle_lighting` on a day that is neither erev Shabbat nor erev Yom Tov.
   */
  | { code: 'anchor_not_on_this_date'; anchor: Zman }
  /**
   * The library could not compute the anchor. Cannot happen at 32°N; handled
   * because a NaN Date that reaches a sort is far worse than a blank row.
   */
  | { code: 'zman_not_computable'; anchor: Zman };

/** How a resolved instant was arrived at. Kept so the UI can still show the rule. */
export type ResolutionBasis =
  | { from: 'fixed' }
  | { from: 'anchor'; anchor: Zman; anchorInstant: Date; offsetMinutes: number };

export type ResolvedMinyanTime =
  | {
      kind: 'resolved';
      /** The start of the minyan, as an absolute moment. Minute-aligned. */
      instant: Date;
      /** The same moment as an Asia/Jerusalem wall clock, "HH:MM". */
      clock: string;
      basis: ResolutionBasis;
    }
  | { kind: 'unresolved'; reason: UnresolvedReason };

export function isResolved(
  value: ResolvedMinyanTime,
): value is Extract<ResolvedMinyanTime, { kind: 'resolved' }> {
  return value.kind === 'resolved';
}

/**
 * Resolve one rule against one calendar square in Asia/Jerusalem.
 *
 * `date` is a `JerusalemDate` and not a `Date` on purpose: "which day is it"
 * must not depend on the timezone of the process doing the asking.
 *
 * All arithmetic is done on absolute instants, so a DST transition cannot move
 * a minyan. A `fixed` 06:30 is 06:30 on the Jerusalem wall clock on both sides
 * of the change; a `relative` rule is anchored to a solar event, which has no
 * opinion about civil time at all.
 */
export function resolveMinyanTime(
  time: MinyanTime,
  date: JerusalemDate,
  location: Location,
): ResolvedMinyanTime {
  switch (time.kind) {
    case 'fixed': {
      const instant = instantOfClockTime(date, time.time);
      return { kind: 'resolved', instant, clock: clockFaceOf(instant), basis: { from: 'fixed' } };
    }

    case 'relative':
      return resolveAgainstDay(time.anchor, time.offsetMinutes, zmanimFor(location, date));

    case 'unknown':
      // The whole product depends on this line staying exactly this dull.
      return { kind: 'unresolved', reason: { code: 'unknown_offset', rawText: time.rawText } };
  }
}

/**
 * The same resolution when the day's zmanim are already in hand. The timeline
 * computes a day once and resolves many rules against it.
 */
export function resolveAgainstDay(
  anchor: Zman,
  offsetMinutes: number,
  day: DayZmanim,
): ResolvedMinyanTime {
  const base = anchorInstant(day, anchor);
  if (base === null) {
    return { kind: 'unresolved', reason: { code: 'anchor_not_on_this_date', anchor } };
  }
  if (Number.isNaN(base.getTime())) {
    return { kind: 'unresolved', reason: { code: 'zman_not_computable', anchor } };
  }

  // Negative = before. The sign lives in the stored value; nothing here
  // reinterprets it, because `לפי` was already resolved to a sign by the
  // parser and re-deciding it in two places is how the two drift apart.
  const instant = new Date(base.getTime() + offsetMinutes * 60_000);
  return {
    kind: 'resolved',
    instant,
    clock: clockFaceOf(instant),
    basis: { from: 'anchor', anchor, anchorInstant: base, offsetMinutes },
  };
}

/** Resolve with the day's zmanim, returning them too. Used by the shul page. */
export function resolveOnDate(
  time: MinyanTime,
  date: JerusalemDate,
  location: Location,
): { resolved: ResolvedMinyanTime; day: DayZmanim } {
  const day = zmanimFor(location, date);
  if (time.kind === 'relative') {
    return { resolved: resolveAgainstDay(time.anchor, time.offsetMinutes, day), day };
  }
  return { resolved: resolveMinyanTime(time, date, location), day };
}
