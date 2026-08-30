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
import type { Nusach } from './taxonomy.ts';

export interface VerifiedMinyan {
  service: Service;
  dayType: DayType;
  time: MinyanTime;
  /**
   * Set ONLY when this minyan is a distinct group with its own nusach.
   *
   * Omitted means the house minyan — it follows the synagogue's own nusach —
   * and never means unknown. Copying the synagogue's nusach down onto every
   * row would make every ordinary minyan look like a separate congregation.
   */
  nusach?: Nusach;
  /**
   * How long the source vouched for this time.
   *
   * Set BOTH for a clock face off a board that is reprinted — כלל ישראל's
   * weekday times change every week, and outside their week they are not
   * merely stale but wrong: an 18:45 Mincha is shkia + 65 in December.
   *
   * Leave both unset for a rule, or for a clock face that genuinely holds all
   * year. `shkia − 20` never expires because sunset moves with it, and a 14:00
   * Mincha is after mincha gedola and before shkia on all 365 days.
   */
  validFrom?: string;
  validUntil?: string;
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
   * TWO MINYANIM: `מניין אשכנזי-ספרדי` and `מניין תימני`, at different times.
   * That is what the municipality's `כללי` meant — not "unclassified" but "more
   * than one". Migration 0003 put a nusach on the minyan so both fit: the
   * Teimani group carries `teimani`, and the main one carries nothing, because
   * `אשכנזי-ספרדי` is two rites in one minyan and the house-minyan null claims
   * nothing rather than claiming the wrong thing.
   *
   * What is still held is held for a DIFFERENT reason now — not "cannot say
   * which minyan" but "cannot say whether it is a rule".
   */
  /**
   * היכל חיים, אופנהיימר 5. Read from the weekday board for the week of
   * 2026-08-30.
   *
   * The whole weekday block is this week's printing and carries its window.
   * That the reading is right is corroborated by the times themselves: Mincha
   * at 17:40 falls BEFORE plag (17:47 that day) and Arvit at 18:05 falls after
   * it, which is the arrangement an early Arvit requires. Times that hang
   * together that way were almost certainly transcribed correctly.
   *
   * WHAT THIS REPLACES, AND WHY WHOLESALE IS RIGHT HERE. The GIS layer claims
   * weekday Shacharit at 06:15 and 07:30. The board says 05:50, 06:50 and
   * 07:25 — not one of them matches. A source demonstrably wrong about this
   * shul's weekdays has not earned belief about its Shabbat either, so its
   * Shabbat rows go too rather than being kept as though they were a different
   * kind of fact. They are recorded below instead.
   */
  'היכל חיים': {
    verifiedAt: '2026-08-30',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '05:50' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        // The board marks this one נץ. Stored as the clock face it prints, not
        // as `netz − 24`: a netz minyan's offset is what makes the Amidah land
        // at sunrise, and one week's arithmetic is not evidence of the rule.
        // The window is what keeps it honest until somebody reads the next board.
        note: 'first minyan, marked נץ, in the synagogue',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:50' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second minyan, בסוכה — see held: there is nowhere to display that',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:25' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third minyan',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '17:40' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        // shkia − 87 this week and shkia + 60 in December. The window is not
        // optional on this one.
        note: 'the board marks it למנצח; before plag, which the early Arvit requires',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:05' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'follows Mincha; after plag, which is what makes an early Arvit valid',
      },
    ],
    held: [
      {
        what: 'that the 06:50 minyan meets בסוכה',
        why:
          'True, useful to a visitor, and unstorable: there is no field for ' +
          'where within a building a minyan meets. Kept in the row\'s note so it ' +
          'is not lost, but nothing displays it. A `location_note` on minyanim ' +
          'would fix it and is not worth a migration for one row yet.',
      },
      {
        what: 'the GIS layer\'s Shabbat Shacharit, 07:30 and 08:30',
        why:
          'Dropped with the rest of the municipal record for this shul. It had ' +
          'the weekdays wrong in every particular — 06:15 and 07:30 against an ' +
          'actual 05:50, 06:50 and 07:25 — so its Shabbat times are not a ' +
          'better class of evidence, they are the same evidence. Recorded here ' +
          'so the loss is deliberate and recoverable, and so the next person ' +
          'knows to read the Shabbat sheet rather than assume we never had one.',
      },
      {
        what: 'whether any of this is a rule',
        why:
          'One board cannot say. The נץ minyan plainly tracks sunrise in ' +
          'spirit; whether the shul recomputes it or reprints a season at a ' +
          'time is unknown. Three consecutive weeks would settle it.',
      },
    ],
  },

  'לכלל ישראל': {
    verifiedAt: '2026-08-28',
    verifiedBy: 'notice_board',
    minyanim: [
      /* ------------------------------------------------------------------
         THIS WEEK'S WEEKDAY BOARD — 2026-08-30 to 2026-09-04.

         The whole weekday block is reprinted weekly and every line of it
         moved: Shacharit 6:15 -> 6:20, evening Mincha 18:55 -> 18:45, and an
         Arvit appeared that the previous reading did not have. So all four
         carry a window and expire with it.

         Not a rule in disguise: the evening Mincha was shkia − 17 one week and
         shkia − 22 the next, so there is no offset to extract. Outside the
         window these rows stop resolving and the shul reads as honestly
         unknown, which is what it will be until the next board is read.
         ------------------------------------------------------------------ */
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:20' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first minyan',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '08:00' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second minyan',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '14:00' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        // Would survive without a window — 14:00 is after mincha gedola and
        // before shkia on all 365 days — but it is printed on the same weekly
        // board as the rest and is vouched for exactly as long. Claiming more
        // for it than the source does would be inventing durability.
        note: 'first Mincha; the board calls it Mincha Gedola, which is a label',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:45' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second Mincha; the board calls it Mincha Ketana, which is a label',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:25' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        // The first weekday Arvit anywhere in the data. Until this the only
        // Arvit we held was a Kabbalat Shabbat, so `?service=arvit` on a
        // Sunday answered "in 5 days".
        note: 'follows the second Mincha',
      },

      /* --- Shabbat and erev Shabbat: no window, these are rules or hold --- */
      {
        service: 'shacharit',
        dayType: 'shabbat',
        time: { kind: 'fixed', time: '08:00' },
        note: 'the אשכנזי-ספרדי minyan — the house minyan',
      },
      {
        service: 'shacharit',
        dayType: 'shabbat',
        time: { kind: 'fixed', time: '07:30' },
        nusach: 'teimani',
        note: 'the תימני minyan, half an hour before the house minyan',
      },
      {
        service: 'mincha',
        dayType: 'erev_shabbat',
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
        // A RULE, so no window: sunset moves and the time moves with it. This
        // is the difference the validity columns exist to record.
        note: 'erev Shabbat; corrects the GIS reading of candle_lighting − 10',
      },
      {
        service: 'arvit',
        dayType: 'erev_shabbat',
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: 0 },
        note: 'Kabbalat Shabbat, at shkia',
      },
    ],
    held: [
      {
        what: 'a weekday time that outlives its week',
        why:
          'RESOLVED, and worth keeping as the record of how. The evening Mincha ' +
          'read 18:55 on 2026-08-26 and 18:45 on 2026-08-30 — shkia − 17 then ' +
          'shkia − 22 — so there is no offset to extract, and the user confirmed ' +
          'the board is reprinted weekly. The times are stored with a validity ' +
          'window instead of being held or being claimed year-round.',
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
