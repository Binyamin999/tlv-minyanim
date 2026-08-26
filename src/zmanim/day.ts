/**
 * One day's zmanim for Tel Aviv, from @hebcal/core (KosherJava-derived).
 *
 * Nothing in this file computes astronomy. Every value below is a call into
 * the library; this module's whole job is to pick a shita, name it out loud,
 * and hand back a plain record. CLAUDE.md: "An agent's job is to determine the
 * *rule*. A zmanim library applies the rule."
 *
 * ---------------------------------------------------------------------------
 * SHITOT USED — every one of these is a choice, so every one is written down
 * ---------------------------------------------------------------------------
 *
 *  alot           Zmanim.alotHaShachar()  — sun 16.1° below the horizon
 *  netz           Zmanim.sunrise()        — upper edge, 0.833°, sea level
 *  shema          Zmanim.sofZmanShma()    — GRA: netz + 3 shaot zmaniyot
 *  chatzot        Zmanim.chatzot()        — netz + 6 shaot zmaniyot
 *  mincha_gedola  Zmanim.minchaGedola()   — GRA: netz + 6.5
 *  mincha_ketana  Zmanim.minchaKetana()   — GRA: netz + 9.5
 *  plag           Zmanim.plagHaMincha()   — GRA: netz + 10.75
 *  shkia          Zmanim.sunset()         — upper edge, 0.833°, sea level
 *  tzeit          Zmanim.tzeit(8.5)       — three small stars (hebcal default)
 *  candle_lighting  HebrewCalendar candle-lighting event — 20 min before shkia
 *                   in Israel outside Jerusalem/Haifa. Taken from the library
 *                   rather than hard-coded, so the city table stays hebcal's.
 *
 * GRA throughout, not Magen Avraham. Reason: the times we are resolving are
 * *start times a shul posted on its door*, and the overwhelmingly common
 * Israeli luach convention is GRA. A shul that davens by MGA needs a per-shul
 * shita column, which is a schema change and a data-collection problem, not a
 * default to be picked here.
 *
 * ---------------------------------------------------------------------------
 * SECONDS ARE TRUNCATED, NOT ROUNDED
 * ---------------------------------------------------------------------------
 * Shkia at 19:12:41 becomes 19:12. Every anchor is floored to the minute the
 * moment it leaves the library, so that:
 *   - what we print and what we sort by are the same value, and
 *   - `shkia - 20min` reads 18:52 exactly as hebcal's own candle-lighting
 *     arithmetic does (it floors sunset and then applies a negative offset).
 * Flooring is also the safe direction for a start time. If a validated luach
 * turns out to round to the nearest minute instead, `floorToMinute` is the one
 * function to change.
 */
import { HDate, HebrewCalendar, CandleLightingEvent, Zmanim, flags, getHolidaysOnDate } from '@hebcal/core';
import type { Location } from '@hebcal/core';
import type { Zman } from '../minyan-times/index.ts';
import {
  asHostLocalNoon,
  isoDate,
  jerusalemDateOf,
  type JerusalemDate,
} from './jerusalem-date.ts';
import { TZEIT_DEGREES, USE_ELEVATION } from './location.ts';

/** See the header: floor, never round. */
function floorToMinute(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / 60_000) * 60_000);
}

export interface HebrewDay {
  /** 1-30. */
  day: number;
  /** hebcal's month number; 12 is Adar (or Adar I), 13 is Adar II. */
  monthNumber: number;
  /** 'Adar' in a common year, 'Adar I' / 'Adar II' in a leap year. */
  monthName: string;
  year: number;
  isLeapYear: boolean;
  renderHe: string;
  renderEn: string;
}

function toHebrewDay(hd: HDate): HebrewDay {
  return {
    day: hd.getDate(),
    monthNumber: hd.getMonth(),
    monthName: hd.getMonthName(),
    year: hd.getFullYear(),
    isLeapYear: hd.isLeapYear(),
    renderHe: hd.render('he'),
    renderEn: hd.render('en'),
  };
}

/**
 * Every anchor for one calendar square, plus the calendar facts about it.
 *
 * `candle_lighting` is `Date | null` in the type, not `Date`, because on a
 * Tuesday there is no candle lighting and a plausible-looking value would be
 * fabrication of exactly the kind CLAUDE.md forbids.
 */
export interface DayZmanim {
  date: JerusalemDate;
  alot: Date;
  netz: Date;
  shema: Date;
  chatzot: Date;
  mincha_gedola: Date;
  mincha_ketana: Date;
  plag: Date;
  shkia: Date;
  tzeit: Date;
  /** null unless this date is erev Shabbat or erev Yom Tov. */
  candle_lighting: Date | null;
  /**
   * Chatzot of the night that FOLLOWS this date — roughly half past midnight
   * the next morning. hebcal's `chatzotNight()` is the night *before* the
   * given date, which is not the bound anyone wants for an Arvit.
   */
  chatzot_night_after: Date;
  /** The Hebrew date of this square's daylight. Sunset rollover: `hebrewDayAt`. */
  hebrewDate: HebrewDay;
  /**
   * The name of a Yom Tov that is assur bemlacha, or null. Chol HaMoed is not
   * counted: it is a weekday for melacha, and our weekday times are the least
   * wrong thing we have for it.
   */
  yomTov: string | null;
  /** Saturday, by the civil calendar. The halachic window is in `windows.ts`. */
  isSaturday: boolean;
}

/**
 * Per-process cache. Zmanim for a date never change, and a timeline query
 * touches at most a handful of dates — but a shul page resolving 8 rules
 * against the same day would otherwise run the NOAA solver 8 times.
 */
const CACHE = new Map<string, DayZmanim>();
const CACHE_LIMIT = 512;

function cacheKey(location: Location, date: JerusalemDate): string {
  return `${location.getLatitude()},${location.getLongitude()}@${isoDate(date)}`;
}

/**
 * Minutes before shkia that candles are lit in Tel Aviv-Yafo.
 *
 * NOT hebcal's default. `@hebcal/core` ships 20 for the Tel Aviv geoname, and
 * Hebcal's own web pages and Kipa both print 20 — but the **Tel Aviv-Yafo
 * Religious Council**, the local halachic authority for exactly the 484 shuls
 * in this database, publishes 22, and MyZmanim labels the same figure
 * explicitly as `22 דקות קודם השקיעה`. Its poster is what hangs in the shul
 * lobbies we are listing.
 *
 * This is a real disagreement between published authorities, not a rounding
 * artefact: checked against all 34 published Fridays of 5786 falling in 2026,
 * the implied offset ranges 21.98-23.02 minutes and `floor(shkia - 22)`
 * reproduces the Council's printed minute on 32 of 34, the two misses being
 * one-minute rounding where their shkia differs from ours by seconds. No date
 * fits 20, 21 or 23. See `docs/zmanim-ground-truth.md` §7.
 *
 * Where authorities split we take the earlier one. Lighting two minutes early
 * costs nothing; two minutes late is chillul Shabbat d'Oraita. The same two
 * minutes move `לכלל ישראל`'s `candle_lighting - 10min` Shabbat Mincha
 * earlier, which errs toward people arriving in time rather than missing it.
 *
 * Tel Aviv only. Jerusalem is 40 and Haifa 30; whoever extends this past
 * Tel Aviv-Yafo must verify per city rather than reusing this constant.
 */
export const CANDLE_LIGHTING_MINUTES_TLV = 22;

function candleLightingOn(location: Location, date: JerusalemDate): Date | null {
  const noon = asHostLocalNoon(date);
  const events = HebrewCalendar.calendar({
    start: noon,
    end: noon,
    candlelighting: true,
    candleLightingMins: CANDLE_LIGHTING_MINUTES_TLV,
    location,
    il: location.getIsrael(),
    sedrot: false,
    omer: false,
  });
  for (const event of events) {
    if (!(event instanceof CandleLightingEvent)) continue;
    // LIGHT_CANDLES is כניסת שבת / erev yom tov. LIGHT_CANDLES_TZEIS (second
    // night of yom tov, lit after nightfall) is deliberately not `כניסת שבת`
    // and must not answer to that anchor.
    if ((event.getFlags() & flags.LIGHT_CANDLES) === 0) continue;
    const time = event.eventTime;
    if (time && !Number.isNaN(time.getTime())) return floorToMinute(time);
  }
  return null;
}

function yomTovOn(hd: HDate, il: boolean): string | null {
  for (const event of getHolidaysOnDate(hd, il) ?? []) {
    if (event.getFlags() & flags.CHAG) return event.getDesc();
  }
  return null;
}

/** All of one day's zmanim. Pure: same date in, same values out, forever. */
export function zmanimFor(location: Location, date: JerusalemDate): DayZmanim {
  const key = cacheKey(location, date);
  const cached = CACHE.get(key);
  if (cached) return cached;

  const noon = asHostLocalNoon(date);
  const z = new Zmanim(location, noon, USE_ELEVATION);
  const hd = new HDate(noon);

  // chatzot of the following night: hebcal's chatzotNight() is measured from
  // the PREVIOUS sunset, so ask tomorrow for it.
  const tomorrowNoon = new Date(noon.getTime() + 24 * 3_600_000);
  const zTomorrow = new Zmanim(location, tomorrowNoon, USE_ELEVATION);

  const day: DayZmanim = {
    date,
    alot: floorToMinute(z.alotHaShachar()),
    netz: floorToMinute(z.sunrise()),
    shema: floorToMinute(z.sofZmanShma()),
    chatzot: floorToMinute(z.chatzot()),
    mincha_gedola: floorToMinute(z.minchaGedola()),
    mincha_ketana: floorToMinute(z.minchaKetana()),
    plag: floorToMinute(z.plagHaMincha()),
    shkia: floorToMinute(z.sunset()),
    tzeit: floorToMinute(z.tzeit(TZEIT_DEGREES)),
    candle_lighting: candleLightingOn(location, date),
    chatzot_night_after: floorToMinute(zTomorrow.chatzotNight()),
    hebrewDate: toHebrewDay(hd),
    yomTov: yomTovOn(hd, location.getIsrael()),
    isSaturday: hd.getDay() === 6,
  };

  if (CACHE.size >= CACHE_LIMIT) CACHE.clear();
  CACHE.set(key, day);
  return day;
}

/**
 * The instant a named anchor falls on this day, or null if it does not fall on
 * this day at all. Only `candle_lighting` can be null, and only because most
 * days have no candle lighting.
 */
export function anchorInstant(day: DayZmanim, anchor: Zman): Date | null {
  switch (anchor) {
    case 'alot':
      return day.alot;
    case 'netz':
      return day.netz;
    case 'shema':
      return day.shema;
    case 'chatzot':
      return day.chatzot;
    case 'mincha_gedola':
      return day.mincha_gedola;
    case 'mincha_ketana':
      return day.mincha_ketana;
    case 'plag':
      return day.plag;
    case 'shkia':
      return day.shkia;
    case 'tzeit':
      return day.tzeit;
    case 'candle_lighting':
      return day.candle_lighting;
  }
}

/**
 * The Hebrew date at a moment, rolling at sunset rather than at midnight.
 *
 * This is the one place the Hebrew calendar and the civil calendar disagree by
 * design: Friday 19:30 in August is already Shabbat, and printing "Friday" on
 * it would be wrong in the way that matters most to this audience.
 */
export function hebrewDayAt(location: Location, instant: Date): HebrewDay {
  return toHebrewDay(Zmanim.makeSunsetAwareHDate(location, instant, USE_ELEVATION));
}

/**
 * Is the sun up over Tel Aviv at this moment?
 *
 * Daylight runs netz to shkia. This is what drives light and dark mode —
 * CLAUDE.md: "dark from real shkia, light from real netz" — and it lives here
 * rather than in the UI layer because it is a question about the sky, and
 * because a pure function can be tested without a browser.
 *
 * Note which day's zmanim are consulted: the calendar square the instant falls
 * on. At 02:00 the sun that set was yesterday's, but yesterday's shkia and
 * today's netz bracket the same night, and `instant < today's netz` is true
 * either way. There is no window in which both tests disagree.
 */
export function isDaylight(location: Location, instant: Date): boolean {
  const day = zmanimFor(location, jerusalemDateOf(instant));
  const at = instant.getTime();
  return at >= day.netz.getTime() && at < day.shkia.getTime();
}

/** Test seam. Nothing in the app should need this. */
export function clearZmanimCache(): void {
  CACHE.clear();
}
