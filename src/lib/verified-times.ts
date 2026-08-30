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
import { TORAH_READING_DAYS } from '../minyan-times/index.ts';
import type { DayType, MinyanTime, Service, Weekday } from '../minyan-times/index.ts';
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
  /**
   * The weekdays this minyan runs on, when it does not run on all of them.
   *
   * Omitted means every day of its `dayType`, which is the common case — and
   * means it, rather than meaning unknown. Set it where a board states two
   * different times for one service: צימבליסטה davens Shacharit at 07:15 on
   * Sunday, Tuesday and Wednesday and at 07:10 on Monday and Thursday, because
   * Monday and Thursday carry קריאת התורה and the service runs longer.
   *
   * Without this the two honest options were both wrong — store 07:15 alone and
   * send a reader five minutes late twice a week, or hold both and show nothing
   * for a time we know.
   */
  daysOfWeek?: readonly Weekday[];
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
  /**
   * Days on which this synagogue holds NO services at all.
   *
   * "We do not know" and "there are none" are different statements, and until
   * this field existed the site could only make the first. בית חב"ד קניון רמת
   * אביב is inside a shopping centre that closes for Shabbat and holds nothing
   * on Friday night or Saturday; its page said `אין שעות ידועות` — "no known
   * times" — which tells a reader we are missing data about a minyan that
   * exists, and sends them looking for it.
   *
   * This is the same distinction the whole codebase turns on, one level up:
   * `בזמן` is an unknown time for a service that happens, and this is a
   * service that does not happen. Conflating them is the honest-unknown rule
   * used dishonestly.
   *
   * It lives HERE rather than on the synagogue record because absence can only
   * ever be stated, never parsed. A missing row in the GIS layer means the
   * municipality did not write one down; only a person who read the board — or
   * asked — can say that Friday night is empty. Anything not listed here stays
   * unknown, which is why the default is the empty array and not "every day
   * except the ones with rows".
   */
  noMinyanimOn: readonly DayType[];
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
  /**
   * בית חב"ד קניון רמת אביב — level −1 of the mall. Not in the municipal
   * export at all; see `added-synagogues.ts`.
   *
   * The Shacharit changes mid-week, which is what the validity columns were
   * built for: 10:30 through Monday, 10:00 from Tuesday. Two rows with
   * adjacent windows rather than one row that is wrong half the time.
   *
   * `Mincha 3:30` is stored as 15:30. Mincha at 03:30 does not exist, so only
   * one clock convention is possible and reading it is not guessing — the
   * shift is recorded in clockNormalisation either way.
   *
   * Arvit was held at צאת הכוכבים and is now a rule: shkia + 20, stated by
   * the shul. That is the ambiguity closing exactly the way it was meant to.
   * The anchor named two different times — the luach's stringent 8.5° value,
   * about 19:45 tonight, and the nightfall a shul actually davens at — and
   * publishing the first would have listed this minyan eighteen minutes late.
   * Asking cost one question; guessing would have cost the reader a minyan.
   *
   * No window on it. A rule does not expire, because sunset moves with it.
   *
   * NOTHING ON SHABBAT. The mall closes, so there is no Friday night and no
   * Saturday minyan here at all — stated, not inferred from having no rows.
   * See `noMinyanimOn`.
   */
  'בית חב"ד קניון רמת אביב': {
    verifiedAt: '2026-08-30',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '10:30' },
        validFrom: '2026-08-30',
        validUntil: '2026-08-31',
        note: 'Sunday and Monday; from Tuesday it is 10:00',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '10:00' },
        validFrom: '2026-09-01',
        validUntil: '2026-09-04',
        note: 'from Tuesday',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '15:30' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'the board writes 3:30; Mincha at 03:30 does not exist',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        // Stated by the shul as twenty minutes after shkia, which is what the
        // board's צאת הכוכבים meant — the davening nightfall, not the luach's
        // 8.5°. No window: a rule is correct in December as well as August,
        // which is the whole reason a rule outranks a clock face.
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: 20 },
        note: 'stated as 20 minutes after shkia, resolving the board\'s צאת הכוכבים',
      },
    ],
    // The mall closes for Shabbat, so there is no erev-Shabbat and no Shabbat
    // minyan here — stated by the shul, not inferred from an absence of rows.
    noMinyanimOn: ['erev_shabbat', 'shabbat'],
    held: [
      {
        what: 'that the minyan is on level −1 of the mall',
        why:
          'Recorded on the synagogue in added-synagogues.ts, but nothing ' +
          'displays it — the schema has no field for where inside a building a ' +
          'minyan meets. Second time this has come up; היכל חיים has a minyan ' +
          'בסוכה with the same problem. Two rows is closer to worth a column.',
      },
    ],
  },

  /**
   * תהילת אביב, שרגא פרידמן 1. Weekday board for the week of 2026-08-30.
   * Shabbat is not here yet — the user is supplying it separately, so those
   * days stay unknown rather than being claimed empty.
   *
   * NINE weekday minyanim, three of each service, which is the densest board
   * in the database.
   *
   * WHY THE WHOLE BLOCK CARRIES A WINDOW. Five of the nine cannot hold all
   * year, and the 365-day sweep is what found them rather than an eye:
   *   mincha 13:15 is two minutes BEFORE mincha gedola on 2026-03-27
   *   mincha 17:45 and 18:50 are after shkia from November
   *   arvit  18:10 is before shkia on 2026-03-27
   *   arvit  19:35 is before shkia on 2026-05-21
   * 05:40 is marked נץ and is netz − 34 today, so it moves with sunrise across
   * an hour of the year. Only 20:00 and the two morning times would survive
   * unwindowed, and they are printed on the same board as the rest — claiming
   * more durability for them than the source does would be inventing it. Same
   * reasoning as כלל ישראל's 14:00.
   *
   * The parentheses on the board are labels, not anchors, and none is stored
   * as one. נץ says which minyan; הודו is a point inside the service; פלג is
   * plag + 23 today, which is not a round offset and so not evidence of a rule.
   * Storing any of them as an anchor would be the "Mincha Gedola 14:00"
   * mistake — reading a name as arithmetic.
   */
  'תהילת אביב': {
    verifiedAt: '2026-08-30',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '05:40' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first minyan, marked נץ — netz − 34 this week, not stored as a rule',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:13' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second minyan, marked הודו',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '08:15' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third minyan, marked הודו',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:15' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first Mincha; before mincha gedola on 2026-03-27, so never year-round',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '17:45' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second Mincha',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:50' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third Mincha; shkia − 17 this week and after sunset from November',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:10' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first Arvit, marked פלג — plag + 23 this week, not a round offset',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:35' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second Arvit, marked למעלה (upstairs)',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '20:00' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third Arvit, marked למטה (downstairs)',
      },
    ],
    noMinyanimOn: [],
    held: [
      {
        what: 'למעלה / למטה — which room each Arvit meets in',
        why:
          'Both are stored as minyanim and neither says where. The schema has no ' +
          'field for a room, which is now the third time it has come up: the mall ' +
          "shul's level −1 and היכל חיים's minyan בסוכה are the others. Three rows " +
          'is past the point where a column would have been cheaper.',
      },
      {
        what: 'נץ / הודו / פלג as anchors rather than labels',
        why:
          'The board writes them beside clock faces, and one week of arithmetic ' +
          'is not evidence of a rule — 18:10 is plag + 23, which no shul would ' +
          'choose as an offset. A netz minyan does track sunrise, but its offset ' +
          'is whatever makes the Amidah land at netz, and that is not derivable ' +
          'from a single printing. Three consecutive boards would settle all of ' +
          'them; the windows hold the line until then.',
      },
    ],
  },

  /**
   * המרכז למורשת היהדות ע"ש צימבליסטה, חיים לבנון 42 — the synagogue on the
   * Tel Aviv University campus. Weekday board for the week of 2026-08-30.
   *
   * THE FIRST RECORD THAT NEEDS `daysOfWeek`. Shacharit is 07:15 on Sunday,
   * Tuesday and Wednesday and 07:10 on Monday and Thursday, because Monday and
   * Thursday carry קריאת התורה and the service runs longer. Before migration
   * 0008 there was no way to hold both: storing 07:15 alone would have sent a
   * reader five minutes late twice a week, and holding both would have shown
   * nothing for a time we know.
   *
   * Only the Arvit forces a window — 19:10 is three minutes before shkia on
   * 2026-04-15. The rest of the block takes one anyway, because it is printed
   * on the same board and vouched for exactly as long.
   */
  'אוניברסיטת ת"א - צימבוליסטה': {
    verifiedAt: '2026-08-30',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:15' },
        daysOfWeek: [0, 2, 3],
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'Sunday, Tuesday, Wednesday — the days without קריאת התורה',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:10' },
        daysOfWeek: TORAH_READING_DAYS,
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'Monday and Thursday — five minutes earlier for קריאת התורה',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:30' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first Mincha',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:55' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second Mincha, ללא חזרת הש״ץ — see held',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:10' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'three minutes before shkia on 2026-04-15, so never year-round',
      },
    ],
    noMinyanimOn: [],
    held: [
      {
        what: 'ללא חזרת הש״ץ on the 13:55 Mincha',
        why:
          'A real and useful distinction — a shorter minyan, which is why a ' +
          'campus offers it at five to two — and there is no field for it. It is ' +
          'not a nusach, not a style in our taxonomy, and not a time. Stored in ' +
          'the note so the next reader knows the board said it.',
      },
      {
        what: 'whether the schedule follows the university term',
        why:
          'A campus shul plausibly thins out over the summer and between ' +
          'semesters, and nothing on the board addresses it. Not guessed either ' +
          'way: the week-long window says only what was read.',
      },
    ],
  },

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
    // Nothing stated about Shabbat either way, so it stays unknown.
    noMinyanimOn: [],
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
    // Nothing stated about Shabbat either way, so it stays unknown.
    noMinyanimOn: [],
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
/**
 * One notice board, two synagogues.
 *
 * `בית חב"ד רמת אביב ג'` keeps the same times as `כלל ישראל`, in the same
 * building — reported by the user, and independently corroborated by the
 * municipality's own record for it: the GIS layer writes `שחרית-6:30-8:00` and
 * `מנחה-14:00`, against a board reading 6:20, 8:00 and 14:00.
 *
 * REFERENCED, NEVER COPIED. כלל ישראל reprints its weekday board every week
 * and every line of it moved between the two readings we have, which is why
 * those rows carry a validity window at all. Pasting a copy into a second
 * record would mean two sets of times that agree today and disagree the moment
 * the next board is read — and the one nobody remembered to update would go on
 * publishing a stale clock face under its own `last_verified_at`. Sharing the
 * record makes that impossible: one reading updates both.
 *
 * It also keeps provenance true. `verified_by: notice_board` is a claim that
 * somebody read a board for this synagogue, and here that is literally the
 * same board.
 *
 * The key and the value are both source names, like every other table keyed on
 * what the municipality wrote.
 */
export const SHARED_BOARD: Record<string, string> = {
  "המרכזי רמת אביב ג'": 'לכלל ישראל',
};

export function verifiedFor(nameHe: string): VerifiedSynagogue | null {
  const folded = nameHe.replace(/\s+/g, ' ').trim();
  const shared = SHARED_BOARD[folded];
  // One hop only. A chain would let two entries point at each other and hang
  // the importer, and there is no case for one: a board belongs to a building.
  if (shared) return VERIFIED[shared] ?? null;
  return VERIFIED[folded] ?? null;
}
