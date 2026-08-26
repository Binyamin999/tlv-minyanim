/**
 * The week, cut into the periods that different columns of the source govern.
 *
 * The database stores `day_type` as `weekday | shabbat` because that is what
 * the municipal source has: two columns. The week, however, has four periods
 * that behave differently, and the mapping between them is where every
 * "why is a Shabbat minyan showing on Tuesday" bug lives. So it is written
 * down once, here, and nowhere else.
 *
 * ---------------------------------------------------------------------------
 * FRIDAY — the deliberate decision
 * ---------------------------------------------------------------------------
 * Friday is not a weekday and it is not Shabbat. Its morning is a weekday
 * morning: the weekday Shacharit on the door is the Friday Shacharit, and
 * resolving it is honest. Its afternoon is not: Mincha and Arvit move to
 * candle lighting, and the weekday time on the door — 14:00, 13:30 — is simply
 * not when that shul davens on Friday.
 *
 * The cut is therefore **chatzot on Friday**:
 *
 *   Friday 00:00 -> chatzot     phase `weekday`,      weekday column applies
 *   Friday chatzot -> midnight  phase `erev_shabbat`, Shabbat column applies
 *   Saturday 00:00 -> tzeit     phase `shabbat`,      Shabbat column applies
 *   Saturday tzeit -> midnight  phase `motzaei_shabbat`, weekday column applies
 *   Sunday..Thursday            phase `weekday`,      weekday column applies
 *
 * Chatzot, not shkia and not candle lighting, because the window has to OPEN
 * BEFORE the erev-Shabbat minyanim it is supposed to contain. `כניסת שבת - 10`
 * is by definition earlier than candle lighting, and in winter a Friday Mincha
 * is at 16:00 while shkia is at 16:59. A window that opens at shkia would show
 * the Friday minyan only after it had finished.
 *
 * What this does NOT do is invent a Friday afternoon Mincha time. A shul whose
 * only Mincha is the weekday 14:00 still appears on Friday afternoon — as
 * "davens Mincha here, time unconfirmed". See `timeline.ts`.
 *
 * Saturday's cut is tzeit (8.5°, three small stars) because that is when
 * Shabbat ends and the weekday column starts being true again.
 *
 * The Hebrew date rolls at shkia and is reported separately (`hebrewDayAt`).
 * That is a different question from which column applies, and conflating the
 * two is how Friday night ends up labelled "Friday".
 */
import type { Location } from '@hebcal/core';
import type { DayType, Season } from '../minyan-times/index.ts';
import { zmanimFor, type DayZmanim } from './day.ts';
import {
  addDays,
  dayOfWeek,
  jerusalemDateOf,
  seasonAt,
  startOfJerusalemDay,
  type JerusalemDate,
} from './jerusalem-date.ts';

export type DayPhase = 'weekday' | 'erev_shabbat' | 'shabbat' | 'motzaei_shabbat';

export interface DayWindow {
  /** The calendar square whose zmanim resolve every rule inside this window. */
  date: JerusalemDate;
  phase: DayPhase;
  /** Which stored column governs this period. */
  dayType: DayType;
  /** Half-open: `from` inclusive, `to` exclusive. */
  from: Date;
  to: Date;
  /**
   * `ח` / `ק` for this date, taken at chatzot.
   *
   * Chatzot rather than the window edges because the two DST changeovers
   * happen at 02:00, inside a window, and a window must not be half winter and
   * half summer. Midday is never near a transition.
   */
  season: Season;
  zmanim: DayZmanim;
}

const FRIDAY = 5;
const SATURDAY = 6;

/** Every window belonging to one calendar square, in order. */
export function windowsOnDate(location: Location, date: JerusalemDate): DayWindow[] {
  const zmanim = zmanimFor(location, date);
  const season = seasonAt(zmanim.chatzot);
  const dayStart = startOfJerusalemDay(date);
  const nextDayStart = startOfJerusalemDay(addDays(date, 1));
  const dow = dayOfWeek(date);

  const base = { date, season, zmanim };

  if (dow === FRIDAY) {
    return [
      { ...base, phase: 'weekday', dayType: 'weekday', from: dayStart, to: zmanim.chatzot },
      { ...base, phase: 'erev_shabbat', dayType: 'shabbat', from: zmanim.chatzot, to: nextDayStart },
    ];
  }

  if (dow === SATURDAY) {
    return [
      { ...base, phase: 'shabbat', dayType: 'shabbat', from: dayStart, to: zmanim.tzeit },
      {
        ...base,
        phase: 'motzaei_shabbat',
        dayType: 'weekday',
        from: zmanim.tzeit,
        to: nextDayStart,
      },
    ];
  }

  return [{ ...base, phase: 'weekday', dayType: 'weekday', from: dayStart, to: nextDayStart }];
}

/**
 * Every window overlapping `[from, to]`, in chronological order.
 *
 * The day before `from` is included in the sweep because a window can begin on
 * one calendar square and still be running on the next — Saturday's Shabbat
 * window is entered on Friday, and a query at 01:00 on Saturday morning is
 * inside it.
 */
export function windowsBetween(location: Location, from: Date, to: Date): DayWindow[] {
  if (to.getTime() < from.getTime()) return [];

  const first = addDays(jerusalemDateOf(from), -1);
  const last = addDays(jerusalemDateOf(to), 1);

  const out: DayWindow[] = [];
  let cursor = first;
  // Bounded: `to` beyond a couple of weeks is not a question this product asks.
  for (let guard = 0; guard < 400; guard += 1) {
    for (const window of windowsOnDate(location, cursor)) {
      if (window.to.getTime() <= from.getTime()) continue;
      if (window.from.getTime() > to.getTime()) continue;
      out.push(window);
    }
    if (cursor.year === last.year && cursor.month === last.month && cursor.day === last.day) break;
    cursor = addDays(cursor, 1);
  }

  out.sort((a, b) => a.from.getTime() - b.from.getTime());
  return out;
}

/** The window an instant falls in. There is always exactly one. */
export function windowAt(location: Location, instant: Date): DayWindow {
  const date = jerusalemDateOf(instant);
  for (const candidate of [addDays(date, -1), date]) {
    for (const window of windowsOnDate(location, candidate)) {
      if (instant.getTime() >= window.from.getTime() && instant.getTime() < window.to.getTime()) {
        return window;
      }
    }
  }
  // Unreachable: the windows of a date tile it exactly.
  throw new Error(`no window covers ${instant.toISOString()}`);
}

/** True while melacha is forbidden — Friday shkia through Saturday tzeit. */
export function isShabbatNow(location: Location, instant: Date): boolean {
  const window = windowAt(location, instant);
  if (window.phase === 'shabbat') return true;
  if (window.phase === 'erev_shabbat') return instant.getTime() >= window.zmanim.shkia.getTime();
  return false;
}
