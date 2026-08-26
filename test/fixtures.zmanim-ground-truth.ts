/**
 * Published zmanim for Tel Aviv, transcribed from `docs/zmanim-ground-truth.md`.
 *
 * These values do NOT come from `@hebcal/core`. They were sourced independently
 * — NOAA, sunrisesunset.io, MyZmanim, and the Tel Aviv-Yafo Religious Council's
 * own published 5786 poster — by an agent that never saw this code. That is the
 * entire point. A test asserting that the library returns what the library
 * returns proves only that it is self-consistent, which is worth nothing.
 *
 * ---------------------------------------------------------------------------
 * WHICH SHITA — these values are not shita-neutral
 * ---------------------------------------------------------------------------
 * The source document lists several opinions per anchor. Transcribed here are
 * the ones `src/zmanim/day.ts` actually implements. Change the engine's shita
 * and these numbers become wrong, which is intended: they are a fixed point, so
 * an unannounced change to `day.ts` fails loudly here.
 *
 *   alot           16.1°
 *   shema          GRA        (netz + 3 shaot zmaniyot)
 *   mincha_gedola  ½ zmanit   (chatzot + ½ shaa zmanit) — NOT lechumra.
 *                             The two differ by 4m53s at the winter solstice
 *                             and coincide in midsummer. See §9.3.
 *   mincha_ketana  GRA        (+9.5)
 *   plag           GRA        (+10.75)
 *   tzeit          8.5°       — the stringent, end-of-Shabbat value. A shul
 *                             saying Arvit is "at tzeit" usually means much
 *                             earlier; see CLAUDE.md and §9.1.
 *   candle_lighting shkia − 22 for Tel Aviv, NOT hebcal's built-in 20.
 *
 * ---------------------------------------------------------------------------
 * WHY ±1 MINUTE AND NOT EXACT
 * ---------------------------------------------------------------------------
 * We floor seconds; a value landing at :59.8 floors one way and its published
 * counterpart the other. The sources themselves disagree by a few seconds —
 * NOAA and sunrisesunset.io differ by up to 20s on netz, and the document flags
 * 2026-01-14 chatzot (11:49:58) as "genuinely on the boundary, assert ±1 min".
 * Demanding exact equality would encode a rounding artefact as halacha.
 *
 * `candle_lighting` is the exception and IS asserted exactly, in
 * `zmanim-day.test.ts` — it is a published number on a poster, not a derived
 * one, and the whole reason for choosing 22 minutes is that we reproduce that
 * printed minute.
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

/** True: the table below is transcribed from published luachot, not generated. */
export const GROUND_TRUTH_IS_VALIDATED = true;

/**
 * Tolerance in minutes for the derived anchors. See the header.
 */
export const GROUND_TRUTH_TOLERANCE_MINUTES = 1;

/**
 * The dates are chosen, not sampled. Each one is here to break something:
 *
 *   2026-01-14  Wed, midwinter baseline. chatzot sits on a second boundary.
 *   2026-01-16  Fri, deep winter. Council published כניסת שבת 16:37 —
 *               this is the date the 22-minute rule is anchored on.
 *   2026-03-26  Thu, LAST day of Israel Standard Time. Also the date where
 *               ½ shaa zmanit first exceeds 30 fixed minutes, so the two
 *               mincha gedola definitions cross over.
 *   2026-03-27  Fri, DST BEGINS, and erev Shabbat, and every anchor jumps an
 *               hour. The most valuable single date in the set.
 *   2026-07-15  Wed, midsummer. Corroborated to the second by MyZmanim.
 *   2026-07-17  Fri, midsummer erev Shabbat. Council published 19:25.
 *   2026-10-23  Fri, the erev Shabbat inside the DST-end weekend.
 *   2026-10-24  Sat, LAST day of Israel Daylight Time.
 *   2026-10-25  Sun, DST ENDS — the repeated 01:00 hour.
 *   2026-12-21  Mon, winter solstice. Shortest shaa zmanit of the year
 *               (00:50:14) and the widest gap between the two mincha gedola
 *               definitions.
 *
 * Israel's DST dates are its own — the Friday before the last Sunday in March,
 * and the last Sunday in October. They are not the EU's or the US's, and the
 * law has been amended more than once.
 */
export const GROUND_TRUTH: Readonly<Record<string, GroundTruthDay>> = {
  '2026-01-14': {
    alot: '05:25', netz: '06:42', shema: '09:16', chatzot: '11:49',
    mincha_gedola: '12:15', mincha_ketana: '14:49', plag: '15:53',
    shkia: '16:57', tzeit: '17:36', candle_lighting: null,
  },
  '2026-01-16': {
    alot: '05:25', netz: '06:41', shema: '09:16', chatzot: '11:50',
    mincha_gedola: '12:16', mincha_ketana: '14:50', plag: '15:55',
    shkia: '16:59', tzeit: '17:38', candle_lighting: '16:37',
  },
  '2026-03-26': {
    alot: '04:24', netz: '05:37', shema: '08:41', chatzot: '11:46',
    mincha_gedola: '12:17', mincha_ketana: '15:22', plag: '16:39',
    shkia: '17:56', tzeit: '18:32', candle_lighting: null,
  },
  '2026-03-27': {
    alot: '05:22', netz: '06:35', shema: '09:41', chatzot: '12:46',
    mincha_gedola: '13:17', mincha_ketana: '16:22', plag: '17:39',
    shkia: '18:57', tzeit: '19:33', candle_lighting: '18:35',
  },
  '2026-07-15': {
    alot: '04:19', netz: '05:45', shema: '09:16', chatzot: '12:46',
    mincha_gedola: '13:21', mincha_ketana: '16:52', plag: '18:20',
    shkia: '19:48', tzeit: '20:29', candle_lighting: null,
  },
  '2026-07-17': {
    alot: '04:21', netz: '05:46', shema: '09:16', chatzot: '12:46',
    mincha_gedola: '13:21', mincha_ketana: '16:52', plag: '18:19',
    shkia: '19:47', tzeit: '20:28', candle_lighting: '19:25',
  },
  '2026-10-23': {
    alot: '05:37', netz: '06:50', shema: '09:37', chatzot: '12:24',
    mincha_gedola: '12:52', mincha_ketana: '15:40', plag: '16:49',
    shkia: '17:59', tzeit: '18:36', candle_lighting: '17:37',
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
  '2026-12-21': {
    alot: '05:19', netz: '06:37', shema: '09:08', chatzot: '11:38',
    mincha_gedola: '12:03', mincha_ketana: '14:34', plag: '15:37',
    shkia: '16:40', tzeit: '17:20', candle_lighting: null,
  },
};

/**
 * The one-hour jumps, transcribed as deltas rather than recomputed. Any code
 * that caches yesterday's zmanim, works in "minutes since midnight" without a
 * timezone, or computes offsets in UTC and formats in local, breaks exactly
 * here and nowhere else.
 */
export const DST_JUMPS = {
  spring: { from: '2026-03-26', to: '2026-03-27', shkiaDeltaMinutes: 61 },
  autumn: { from: '2026-10-24', to: '2026-10-25', shkiaDeltaMinutes: -61 },
} as const;

/**
 * From the tz database rather than from memory — asserted against `Intl`
 * elsewhere rather than trusted as truth here.
 */
export const DST_STARTS = '2026-03-27';
export const DST_ENDS = '2026-10-25';
