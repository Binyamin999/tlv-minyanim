/**
 * ===========================================================================
 * TODO: REPLACE WITH VALIDATED VALUES
 * ===========================================================================
 *
 * Every clock face in this file is currently a PLACEHOLDER produced by
 * @hebcal/core itself. Asserting them proves only that the library agrees with
 * the library — which is worth exactly nothing.
 *
 * They are here anyway, and in this one file only, so that:
 *   - the tests that DO prove something (ordering, offsets, DST, the sunset
 *     rollover, the seasonal swing) can run today, and
 *   - when `docs/zmanim-ground-truth.md` lands from the `zmanim-validator`
 *     agent, replacing this table is a single edit against a published Tel
 *     Aviv luach, with no test to rewrite.
 *
 * The `zmanim-validator` agent owns those values. Nothing in this repository
 * may research or derive them. When the table is replaced, set
 * `GROUND_TRUTH_IS_VALIDATED = true` and `zmanim-ground-truth.test.ts` stops
 * skipping the absolute-value comparisons.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE VALIDATOR NEEDS TO CONFIRM, not just the numbers
 * ---------------------------------------------------------------------------
 *  1. Shita. `src/zmanim/day.ts` uses GRA throughout (sof zman shma = netz + 3
 *     shaot zmaniyot, mincha gedola = +6.5, ketana = +9.5, plag = +10.75),
 *     alot at 16.1°, tzeit at 8.5°. If the published luach differs, the
 *     numbers below will differ and only `day.ts` should change.
 *  2. Rounding. We FLOOR seconds; shkia 19:12:41 prints 19:12. If the luach
 *     rounds to nearest, `floorToMinute` in `day.ts` is the one edit.
 *  3. Elevation. We compute at sea level and ignore Tel Aviv's 15 m.
 *  4. Candle lighting. We take 20 minutes before shkia from @hebcal/core's
 *     Israel city table. Tel Aviv is neither Jerusalem (40) nor Haifa (30).
 *
 * All values are Asia/Jerusalem wall clocks, "HH:MM", 24-hour.
 */

export interface GroundTruthDay {
  alot: string;
  netz: string;
  shema: string;
  chatzot: string;
  mincha_gedola: string;
  mincha_ketana: string;
  plag: string;
  shkia: string;
  tzeit: string;
  /** null on any date that is neither erev Shabbat nor erev Yom Tov. */
  candle_lighting: string | null;
}

/** Flip to `true` only when the table below comes from a published luach. */
export const GROUND_TRUTH_IS_VALIDATED = false;

/**
 * The dates are chosen, not sampled:
 *   2026-01-16  Friday, deep winter — the shortest afternoon we serve
 *   2026-03-26  Thursday, last day of Israel Standard Time
 *   2026-03-27  Friday, clocks go FORWARD at 02:00
 *   2026-06-19  Friday, near the solstice — the longest afternoon
 *   2026-08-26  Wednesday, an ordinary day with no candle lighting
 *   2026-10-24  Saturday, last day of Israel Daylight Time
 *   2026-10-25  Sunday, clocks go BACK at 02:00
 *   2027-03-12  Friday in Adar II 5787, a leap year
 */
export const GROUND_TRUTH: Readonly<Record<string, GroundTruthDay>> = {
  '2026-01-16': {
    alot: '05:25', netz: '06:41', shema: '09:16', chatzot: '11:50',
    mincha_gedola: '12:16', mincha_ketana: '14:50', plag: '15:55',
    shkia: '16:59', tzeit: '17:38', candle_lighting: '16:39',
  },
  '2026-03-26': {
    alot: '04:24', netz: '05:37', shema: '08:41', chatzot: '11:46',
    mincha_gedola: '12:17', mincha_ketana: '15:22', plag: '16:39',
    shkia: '17:56', tzeit: '18:32', candle_lighting: null,
  },
  '2026-03-27': {
    alot: '05:23', netz: '06:35', shema: '09:41', chatzot: '12:46',
    mincha_gedola: '13:17', mincha_ketana: '16:22', plag: '17:39',
    shkia: '18:57', tzeit: '19:33', candle_lighting: '18:37',
  },
  '2026-06-19': {
    alot: '04:06', netz: '05:34', shema: '09:08', chatzot: '12:42',
    mincha_gedola: '13:17', mincha_ketana: '16:51', plag: '18:20',
    shkia: '19:49', tzeit: '20:32', candle_lighting: '19:29',
  },
  '2026-08-26': {
    alot: '04:56', netz: '06:12', shema: '09:27', chatzot: '12:42',
    mincha_gedola: '13:15', mincha_ketana: '16:30', plag: '17:51',
    shkia: '19:12', tzeit: '19:50', candle_lighting: null,
  },
  '2026-10-24': {
    alot: '05:37', netz: '06:50', shema: '09:37', chatzot: '12:24',
    mincha_gedola: '12:52', mincha_ketana: '15:39', plag: '16:49',
    shkia: '17:58', tzeit: '18:35', candle_lighting: null,
  },
  '2026-10-25': {
    alot: '04:38', netz: '05:51', shema: '08:38', chatzot: '11:24',
    mincha_gedola: '11:52', mincha_ketana: '14:38', plag: '15:48',
    shkia: '16:57', tzeit: '17:34', candle_lighting: null,
  },
  '2027-03-12': {
    alot: '04:43', netz: '05:55', shema: '08:53', chatzot: '11:50',
    mincha_gedola: '12:20', mincha_ketana: '15:18', plag: '16:32',
    shkia: '17:46', tzeit: '18:22', candle_lighting: '17:26',
  },
};

/**
 * The two DST changeovers, from the tz database rather than from memory.
 * Israel moves on the Friday before the last Sunday of March and back on the
 * last Sunday of October — but the law has been amended more than once, so
 * these are asserted against `Intl`, not hard-coded as truth.
 */
export const DST_STARTS = '2026-03-27';
export const DST_ENDS = '2026-10-25';
