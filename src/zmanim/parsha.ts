/**
 * The parsha of the week, for the header ribbon.
 *
 * From @hebcal/core, like every other calendar fact here — nothing in this
 * file works out which sedra it is, it only asks and then decides what is
 * honest to print.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 *
 * 1. It does not print a parsha on a week whose Shabbat is a chag. hebcal's
 *    `Sedra.lookup` answers `{ parsha: ['Sukkot'], chag: true }` there, and
 *    rendering that as `פרשת סוכות` states something the luach does not: on
 *    Sukkot the Torah reading is the festival reading, not a weekly sedra.
 *    A null ribbon line is the truthful answer, and the ribbon simply shows
 *    the Hebrew date alone.
 *
 * 2. It does not roll at midnight. The Hebrew date rolls at sunset, so the
 *    instant is converted with the same sunset-aware call the rest of the
 *    engine uses. Friday 19:30 already belongs to Shabbat, and printing last
 *    week's parsha on it would be wrong in the way this audience notices.
 */
import { HDate, ParshaEvent, Sedra, Zmanim } from '@hebcal/core';
import type { Location } from '@hebcal/core';
import { USE_ELEVATION } from './location.ts';

export interface Parsha {
  he: string;
  en: string;
}

/** Per-year sedra tables. Cheap to build, pointless to rebuild 62 times. */
const SEDRA_CACHE = new Map<string, Sedra>();

function sedraFor(year: number, il: boolean): Sedra {
  const key = `${year}/${il ? 'il' : 'chul'}`;
  const cached = SEDRA_CACHE.get(key);
  if (cached) return cached;
  const sedra = new Sedra(year, il);
  SEDRA_CACHE.set(key, sedra);
  return sedra;
}

/** The sedra covering a Hebrew date, or null when that Shabbat is a chag. */
export function parshaOn(hd: HDate, il: boolean): Parsha | null {
  const result = sedraFor(hd.getFullYear(), il).lookup(hd);
  if (result.chag) return null;
  const event = new ParshaEvent(result);
  return { he: event.render('he'), en: event.render('en') };
}

/**
 * The sedra at a moment over a location, rolling at that location's sunset.
 * `il` follows the location, so the one place that would ever need the
 * diaspora schedule gets it without a second code path.
 */
export function parshaAt(location: Location, instant: Date): Parsha | null {
  return parshaOn(
    Zmanim.makeSunsetAwareHDate(location, instant, USE_ELEVATION),
    location.getIsrael(),
  );
}
