/**
 * Times a person read off a synagogue's own notice board.
 *
 * The GIS layer is fourteen months stale and was never authoritative about
 * times to begin with. A photograph of the sign hanging in the building is the
 * best evidence this project can have, and until now there was nowhere to put
 * it: `curation.ts` holds names and movement, and times arrive through the
 * parser from the municipality. This file is where a human overrides the
 * municipality, and it is the only thing that can honestly set
 * `last_verified_at` — which every page displays and which is NULL on all
 * sixteen records today.
 *
 * Tracked in git. It contains times and nothing else: no gabbai names, no phone
 * numbers, nothing from `data/seed-ramat-aviv.json` beyond the synagogue's own
 * Hebrew name as a key.
 *
 * ---------------------------------------------------------------------------
 * A VERIFIED ENTRY REPLACES THE PARSED ONES WHOLESALE
 * ---------------------------------------------------------------------------
 * Not merged. If someone stood in front of the sign, the sign wins for that
 * synagogue — a half-replaced record would be a mixture of two sources with no
 * way to tell which line came from where. That means every time still believed
 * has to appear here, including ones the GIS layer already had and the sign
 * confirms.
 *
 * ---------------------------------------------------------------------------
 * `held` IS PART OF THE RECORD, NOT A COMMENT
 * ---------------------------------------------------------------------------
 * A sign usually carries more than we can honestly store. Writing down what was
 * seen and deliberately NOT stored — with the reason — is what stops the next
 * person reading this file from thinking the sign was simply shorter than it
 * was, and re-deriving the same dead end. It is the same instinct as
 * `parse_issues`: the failure is data.
 */
import type { DayType, MinyanTime, Service } from '../minyan-times/index.ts';

export interface VerifiedMinyan {
  service: Service;
  dayType: DayType;
  time: MinyanTime;
  /** Why this reading is safe, where that is not obvious from the time itself. */
  note?: string;
}

/** Seen on the sign, deliberately not stored. */
export interface HeldTime {
  what: string;
  why: string;
}

/**
 * How a listing was verified. A CODE, not prose.
 *
 * `verified_by` is displayed on every listing in both languages, so free text
 * here renders English inside the Hebrew page — which it did, until this was a
 * code. It also says HOW rather than WHO: this file is public, and naming the
 * person who read a sign puts an individual in a repository for no benefit.
 */
export type VerificationSource = 'notice_board' | 'gabbai' | 'phone' | 'shul_website';

export interface VerifiedSynagogue {
  /** ISO date the notice board was read. Becomes `last_verified_at`. */
  verifiedAt: string;
  /** Becomes `verified_by`. See VerificationSource. */
  verifiedBy: VerificationSource;
  minyanim: readonly VerifiedMinyan[];
  held: readonly HeldTime[];
}

/**
 * Keyed on the Hebrew name as the source writes it, like `curation.ts`.
 */
export const VERIFIED: Record<string, VerifiedSynagogue> = {
  /**
   * כלל ישראל, אליהו חכים 5. Read from the weekday board and from the printed
   * sheet for שבת פרשת כי־תבוא (2026-08-29).
   *
   * That sheet independently confirmed two of this codebase's decisions, which
   * is worth recording because both were contested: it prints
   * `כניסת השבת 18:48`, which is exactly `shkia − 22` and not hebcal's 20, and
   * `צאת השבת 19:47`, which is exactly our 8.5° tzeit.
   *
   * It also corrected us. The GIS layer says Shabbat Mincha is
   * `10 דק' לפי כניסת שבת`, which resolves to 18:38; the sheet says 18:50,
   * which is `shkia − 20` — the same rule as their weekday Mincha. We would
   * have sent someone twelve minutes early.
   *
   * NOT REPRESENTABLE YET: this shul runs TWO minyanim, `מניין אשכנזי-ספרדי`
   * and `מניין תימני`, at different times. That is why the municipality tagged
   * it `כללי` — not "unclassified" but "more than one". Our schema has one
   * nusach per synagogue and none per minyan, so only the times the two
   * minyanim SHARE can be stored unambiguously. Everything that differs
   * between the columns is held below.
   */
  'לכלל ישראל': {
    verifiedAt: '2026-08-28',
    verifiedBy: 'notice_board',
    minyanim: [
      // Morning times do not track shkia, so a clock face is the rule.
      { service: 'shacharit', dayType: 'weekday', time: { kind: 'fixed', time: '06:15' } },
      { service: 'shacharit', dayType: 'weekday', time: { kind: 'fixed', time: '08:00' } },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '14:00' },
        // Labelled "Mincha Gedola" on the board, but that is descriptive — the
        // zman of that name is 13:15 in August and 12:04 in December, neither
        // of which is 14:00. Storing it as an anchor would have been wrong by
        // three quarters of an hour. Safe as a clock face because 14:00 falls
        // after mincha gedola and before shkia on every day of the year.
        note: 'early Mincha; the board\'s "Mincha Gedola" is a label, not the zman',
      },
      {
        service: 'shacharit',
        dayType: 'shabbat',
        time: { kind: 'fixed', time: '08:00' },
        note: 'the אשכנזי-ספרדי minyan; the תימני minyan at 07:30 is held below',
      },
      {
        service: 'mincha',
        dayType: 'shabbat',
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
        // Erev Shabbat Mincha, printed 18:50 against that week's shkia of
        // 19:10. Identical in both minyanim's columns, and the same offset the
        // weekday board uses, which is why this is read as the rule rather
        // than as one week's clock face. Supersedes the GIS layer's
        // `candle_lighting − 10min`, which resolved twelve minutes early.
        note: 'erev Shabbat; corrects the GIS reading of candle_lighting − 10',
      },
      {
        service: 'arvit',
        dayType: 'shabbat',
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: 0 },
        // קבלת שבת וערבית, printed 19:10 against a shkia of 19:10. Identical
        // in both columns.
        note: 'Kabbalat Shabbat, at shkia',
      },
    ],
    held: [
      {
        what: 'weekday Mincha 18:55 ("Mincha Ketana")',
        why:
          'Cannot be a year-round clock face: 18:55 is shkia − 17 in late August ' +
          'and shkia + 135 in December, and a Mincha two hours after sunset does ' +
          'not exist. So it follows a rule or changes seasonally, and the sign ' +
          'does not say which. Ask the gabbai, or compare three weekly sheets.',
      },
      {
        what: 'סליחות 00:40',
        why:
          'Elul only, so seasonal in a sense the schema does not model — `season` ' +
          'means the DST clock, not the Hebrew calendar. Selichot is also not ' +
          'shacharit, mincha or arvit, and 00:40 belongs to the Hebrew day that ' +
          'began at the previous sunset. Three separate gaps; none guessed.',
      },
      {
        what: 'Shabbat Shacharit 07:30 (תימני)',
        why: 'A second minyan. One nusach per synagogue, none per minyan — see above.',
      },
      {
        what: 'Shabbat Mincha 18:20 (אשכנזי-ספרדי) and 18:15 (תימני)',
        why:
          'Differs between the two minyanim, and neither is a round offset — ' +
          'shkia − 49 and shkia − 54 on the printed week. Both problems at once.',
      },
      {
        what: 'Motzei Shabbat Arvit 19:37',
        why:
          'Identical in both columns, but tzeit − 9 is not a round offset and one ' +
          'sheet cannot tell a rule from a printed clock face. Needs a second week.',
      },
      {
        what: 'The פלג המנחה minyan: שיר השירים 17:25, מנחה וקבלת שבת 17:40',
        why:
          'plag − 24 and plag − 9 on the printed week. Plainly plag-anchored in ' +
          'spirit, but not at a round offset, and an early Kabbalat Shabbat minyan ' +
          'is exactly where being wrong is least forgivable.',
      },
      {
        what: 'שיר השירים 18:35 / 18:30, קידוש ושיעור 10:30, לימוד 17:00 / 17:15',
        why: 'Not minyanim. A shiur is not a prayer service — see the shiurim table.',
      },
    ],
  },
};

/** The verified record for a synagogue, or null if nobody has read its board. */
export function verifiedFor(nameHe: string): VerifiedSynagogue | null {
  return VERIFIED[nameHe.replace(/\s+/g, ' ').trim()] ?? null;
}
