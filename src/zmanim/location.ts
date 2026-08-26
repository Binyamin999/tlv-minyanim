/**
 * Where "Tel Aviv" is, for the purpose of the sun.
 *
 * ONE location for the whole city, deliberately. Ramat Aviv and Florentin are
 * about 5 km apart, which is under 20 seconds of solar time — but rounding to
 * the minute would still make two shuls disagree about shkia on some days, and
 * two different sunsets on one page is a bug report, not a feature. It is also
 * what a printed Tel Aviv luach does: one set of times for the city.
 *
 * The coordinates are @hebcal/core's own canonical Tel Aviv rather than a pair
 * of numbers chosen here, so that our zmanim can be checked against any
 * published Hebcal table for Tel Aviv without an argument about the fencepost.
 *
 * `location` is nonetheless a parameter of every public function in this
 * module. When neighbourhood-level times are wanted, that is a caller change,
 * not a rewrite.
 */
import { Location } from '@hebcal/core';

/**
 * Elevation is NOT used (`useElevation: false` everywhere). Israeli luachs are
 * published at sea level, and Tel Aviv's 15 m would shift shkia by ~10 seconds
 * — below the resolution of anything we print, but enough to make us disagree
 * with the printed sheet on the boundary minutes. Matching the published sheet
 * matters more than the ten seconds.
 */
export const USE_ELEVATION = false;

/** 8.5° below the horizon — three small stars, @hebcal/core's default. */
export const TZEIT_DEGREES = 8.5;

function lookupTelAviv(): Location {
  const found = Location.lookup('Tel Aviv');
  if (!found) {
    // Unreachable with @hebcal/core's built-in city list; loud rather than a
    // silent fallback to some other city's sunset.
    throw new Error('@hebcal/core has no built-in location for Tel Aviv');
  }
  return found;
}

/** Tel Aviv-Yafo. `il: true` comes from the built-in record, so the Israeli
 *  holiday schedule (one day of yom tov) is used, which is the right one here. */
export const TEL_AVIV: Location = lookupTelAviv();
