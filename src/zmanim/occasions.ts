/**
 * What the day is called, and when candles are lit — the two facts a luach
 * puts at the top of the page and this ribbon did not have.
 *
 * The Hebrew date and the parsha were already there. What was missing is the
 * thing a visitor most needs on the week they are here: that Friday is ערב
 * ראש השנה rather than an ordinary erev Shabbat, and what time the day comes
 * in.
 *
 * ---------------------------------------------------------------------------
 * ONE LABEL, CHOSEN BY PRIORITY
 * ---------------------------------------------------------------------------
 * A single Hebrew date can carry several events at once — 2026-09-12 is Rosh
 * Hashana AND a Shabbat AND carries a candle-lighting row. A ribbon 375px wide
 * shows one, so the order below decides which, from the most consequential
 * down. It is a display decision and it lives here rather than in a component,
 * because it is about the calendar rather than about layout.
 *
 * The parsha is deliberately NOT in this list: it has its own line and its own
 * rule (`parsha.ts` prints nothing on a week whose Shabbat is a chag).
 *
 * ---------------------------------------------------------------------------
 * NO NIKUD
 * ---------------------------------------------------------------------------
 * hebcal's `he` locale renders `עֶרֶב רֹאשׁ הַשָּׁנָה`. Pointed text is right in a
 * siddur and wrong in a UI strip — no Israeli shul board prints it, and it
 * sits beside unpointed Hebrew everywhere else on this page. `he-x-nonikud`
 * is hebcal's own unpointed locale, so this is still the library's string and
 * not one stripped by hand.
 */
import { HDate, Zmanim, flags, getHolidaysOnDate } from '@hebcal/core';
import type { Event, Location } from '@hebcal/core';

import { zmanimFor } from './day.ts';
import { addDays, asHostLocalNoon, type JerusalemDate } from './jerusalem-date.ts';
import { USE_ELEVATION } from './location.ts';

export interface Occasion {
  he: string;
  en: string;
}

/**
 * Most consequential first. A day matching several is named by the first.
 *
 * `EREV` sits directly under `CHAG` because on the eve of a festival that is
 * the whole point of saying anything: the times change that afternoon.
 */
const PRIORITY: readonly number[] = [
  flags.CHAG,
  flags.EREV,
  flags.CHOL_HAMOED,
  flags.MAJOR_FAST,
  flags.MINOR_FAST,
  flags.SPECIAL_SHABBAT,
  flags.ROSH_CHODESH,
  flags.MINOR_HOLIDAY,
];

function render(event: Event): Occasion {
  return { he: event.render('he-x-nonikud'), en: event.render('en') };
}

/** The name of a Hebrew day, or null when it is an ordinary one. */
export function occasionOn(hd: HDate, il: boolean): Occasion | null {
  const events = getHolidaysOnDate(hd, il) ?? [];
  for (const flag of PRIORITY) {
    for (const event of events) {
      if (event.getFlags() & flag) return render(event);
    }
  }
  return null;
}

/**
 * The name of the day at a moment, rolling at sunset like everything else.
 *
 * Friday 19:30 is already Shabbat, and on the eve of a chag that distinction
 * is the entire content of the label.
 */
export function occasionAt(location: Location, instant: Date): Occasion | null {
  return occasionOn(
    Zmanim.makeSunsetAwareHDate(location, instant, USE_ELEVATION),
    location.getIsrael(),
  );
}

export interface UpcomingCandles {
  /** The civil day the candles are lit on. */
  date: JerusalemDate;
  /** shkia − 22 in Tel Aviv. Never hebcal's printed value — see day.ts. */
  instant: Date;
  /** 0 = today. Used to decide whether the weekday needs naming. */
  daysAhead: number;
  /** What the lighting is for, when the day carries a name. */
  occasion: Occasion | null;
}

/**
 * The next candle lighting, searching forward from `from`.
 *
 * WHY IT LOOKS AHEAD AT ALL. Candle lighting exists on about one day in seven,
 * so a ribbon that only ever showed today's would be blank almost always —
 * and the person this site is for is a visitor deciding on Wednesday where to
 * daven on Friday night. Printed luachot carry the coming Shabbat's times all
 * week for the same reason.
 *
 * What that must never do is read as "now", so `daysAhead` comes back with it
 * and the caller names the day whenever it is not today. Nothing here is
 * guessed: a day either has a candle lighting in `DayZmanim` or it does not,
 * and the second night of a two-day yom tov is already excluded there.
 */
export function nextCandleLighting(
  location: Location,
  from: JerusalemDate,
  withinDays = 7,
): UpcomingCandles | null {
  for (let daysAhead = 0; daysAhead <= withinDays; daysAhead += 1) {
    const date = addDays(from, daysAhead);
    const instant = zmanimFor(location, date).candle_lighting;
    if (!instant) continue;
    return {
      date,
      instant,
      daysAhead,
      occasion: occasionOn(new HDate(asHostLocalNoon(date)), location.getIsrael()),
    };
  }
  return null;
}
