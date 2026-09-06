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
import type {
  DayType,
  MinyanLocation,
  MinyanTime,
  Service,
  Weekday,
} from '../minyan-times/index.ts';
import type { MinyanStyle, Nusach } from './taxonomy.ts';

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
  /**
   * Where in the building, when the board says. Omitted means nothing was
   * stated, which for a one-room shul is the truth rather than a gap.
   */
  location?: MinyanLocation;
  /**
   * What the board calls this minyan — נץ, הודו, פלג.
   *
   * A LABEL, not an anchor. Setting `netz` does not license storing the time
   * as netz-relative, and the time beside it stays a clock face with its own
   * window. See MinyanStyle.
   */
  style?: MinyanStyle;
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

/**
 * A service a synagogue states it does not hold.
 *
 * `service` omitted means the whole day. Never "unknown which service" — a row
 * of this shape is always a positive claim.
 */
export interface StatedAbsence {
  dayType: DayType;
  service?: Service;
}

export interface VerifiedSynagogue {
  /** ISO date the notice board was read. Becomes `last_verified_at`. */
  verifiedAt: string;
  /** Becomes `verified_by`. See VerificationSource. */
  verifiedBy: VerificationSource;
  minyanim: readonly VerifiedMinyan[];
  /**
   * What this synagogue states it does NOT hold.
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
   * An entry with no `service` means nothing at all happens that day. With a
   * service, that ONE service is not held while others on the same day may be:
   * נוה קודש davens Shacharit every weekday and holds no Mincha or Arvit,
   * which the day-wide form could not say — the page showed a lone Shacharit
   * row and left a reader unable to tell a missing Mincha from an absent one.
   *
   * It lives HERE rather than on the synagogue record because absence can only
   * ever be stated, never parsed. A missing row in the GIS layer means the
   * municipality did not write one down; only a person who read the board — or
   * asked — can say that Friday night is empty. Anything not listed here stays
   * unknown, which is why the default is the empty array and not "every day
   * except the ones with rows".
   */
  noMinyanim: readonly StatedAbsence[];
  held: readonly HeldTime[];
}

/**
 * Keyed on the Hebrew name as the source writes it, like `curation.ts`.
 */
export const VERIFIED: Record<string, VerifiedSynagogue> = {
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
   * See `noMinyanim`.
   */
  'בית חב"ד קניון רמת אביב': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '10:00' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // Last week this was two rows with adjacent windows — 10:30 through
        // Monday, 10:00 from Tuesday. This week it is one time all week, so
        // the split was a fact about that week and not about the shul.
        note: 'one Shacharit all week; last week it moved mid-week from 10:30',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '15:30' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'unchanged from last week',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        // NO WINDOW, and it keeps the rule rather than reverting to held.
        //
        // The board says צאת הכוכבים again, which is the phrase that had this
        // minyan held in the first place. It is not held now because the shul
        // was asked what it means and answered twenty minutes after shkia —
        // and that answer does not expire with the week the board was printed
        // in. A rule outlives its board; that is the whole point of one.
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: 20 },
        note: "the board says צאת הכוכבים; the shul's own answer is shkia + 20",
      },
    ],
    // The mall closes for Shabbat, so there is no erev-Shabbat and no Shabbat
    // minyan here — stated by the shul, not inferred from an absence of rows.
    noMinyanim: [{ dayType: 'erev_shabbat' }, { dayType: 'shabbat' }],
    held: [
      {
        what: 'that the minyan is on level −1 of the mall',
        why:
          'It is in the address — קניון רמת אביב, איינשטיין 40, קומה -1 — and ' +
          'renders there. `minyanim.location` covers a room inside a building, ' +
          'not a floor of a shopping centre, and adding a code for one floor ' +
          'used once would be inventing vocabulary a board never wrote.',
      },
    ],
  },

  /**
   * תהילת אביב, שרגא פרידמן 1. Weekday board for the week of 2026-08-30.
   * Shabbat is not here yet — the user is supplying it separately, so those
   * days stay unknown rather than being claimed empty.
   *
   * THE WEEKLY REPRINT IS CONFIRMED, not assumed. The user was asked directly
   * whether this board is reprinted each week and said yes, so the windows
   * below are what the source vouches for rather than a cautious guess. That
   * matters: without it, the three times that DO hold all year would have been
   * arguable, and the shul reading unknown from Saturday would have been an
   * over-claim of caution rather than an accurate one.
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
  /**
   * תהילת אביב, שרגא פרידמן 1. SECOND WEEK read — 2026-09-06 to 2026-09-11.
   *
   * ---------------------------------------------------------------------------
   * WHAT TWO WEEKS SETTLED
   * ---------------------------------------------------------------------------
   * This is the first shul read twice, which is the only way to tell a rule
   * from a reprinted clock face without asking. Between the printed weeks
   * netz moved +4 minutes and shkia −9. What the board did:
   *
   *   שחרית  05:40 07:13 08:15   unchanged, while netz moved +4
   *   מנחה   13:15               unchanged, while shkia moved −9
   *   מנחה   17:45 -> 17:35      −10; offset from shkia −80 -> −81
   *   מנחה   18:50 -> 18:45      −5;  offset −15 -> −11
   *   ערבית  18:10 -> 18:00      −10; offset from plag +25 -> +23
   *   ערבית  19:35 -> 19:30      −5;  offset +30 -> +34
   *   ערבית  20:00               unchanged
   *
   * THE נץ MINYAN DOES NOT TRACK NETZ. 05:40 held still while sunrise moved
   * four minutes later, so it is netz − 36 one week and netz − 40 the next.
   * That is the label-is-not-an-anchor rule proved rather than argued: had it
   * been stored as `netz − 36` when it was first read, it would already be
   * four minutes wrong, and by December — when netz is 06:37 — it would be an
   * hour out. It keeps its `netz` style, because the style says what KIND of
   * minyan it is and never how the time is computed.
   *
   * NOTHING IS PROMOTED TO A RULE. Only the 17:35 Mincha held its offset
   * across the two weeks, and one interval agreeing within a minute is not
   * evidence — a shul that adjusts in five-minute steps will coincide with
   * sunset sometimes. CLAUDE.md asks for three consecutive weeks and it is
   * right to. A third reading settles it.
   *
   * What this board actually looks like is a set of clock faces nudged in
   * 5- and 10-minute steps every week or two, not offsets recomputed nightly.
   * So every line is windowed again, and the shul goes quiet again on Friday
   * unless somebody reads it a third time.
   *
   * Shabbat is still not here.
   */
  'תהילת אביב': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '05:40' },
        style: 'netz',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'first minyan; unchanged from last week while netz moved +4 — not netz-tracking',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:13' },
        style: 'hodu',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'second minyan; unchanged',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '08:15' },
        style: 'hodu',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'third minyan; unchanged',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:15' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'first Mincha; unchanged. Before mincha gedola on 2026-03-27, so never year-round',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '17:35' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // The only line that held its offset: shkia − 80 then shkia − 81. One
        // interval is not a rule; a third week decides.
        note: 'second Mincha; was 17:45. Held shkia − 80 across both weeks — watch this one',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:45' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'third Mincha; was 18:50. Offset moved shkia − 15 to − 11, so not a rule',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:00' },
        style: 'plag',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'first Arvit; was 18:10. plag + 25 then plag + 23',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:30' },
        location: 'upstairs',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'second Arvit, למעלה; was 19:35',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '20:00' },
        location: 'downstairs',
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'third Arvit, למטה; unchanged',
      },
    ],
    noMinyanim: [],
    held: [
      {
        what: 'whether any of these nine is a rule',
        why:
          'Two weeks in, eight of nine are not: five clock faces did not move ' +
          'at all while their anchors moved, and three moved by an amount that ' +
          'does not match. Only the 17:35 Mincha held an offset (shkia − 80 ' +
          'then − 81), and a single interval agreeing within a minute is a ' +
          'coincidence a shul nudging times in five-minute steps will produce ' +
          'often enough. A third consecutive reading decides it, or one ' +
          'question to the gabbai does — see docs/gabbai-questions.md.',
      },
      {
        what: 'נץ / הודו / פלג as anchors',
        why:
          'Now settled the other way and worth keeping as the evidence. 05:40 ' +
          'is marked נץ and did NOT move while sunrise moved four minutes ' +
          'later, so the label names the minyan and not the arithmetic. Storing ' +
          'it as netz − 36 when first read would already be four minutes wrong ' +
          'and would be an hour out by December.',
      },
    ],
  },

  /**
   * המרכז למורשת היהדות ע"ש צימבליסטה, חיים לבנון 42 — the synagogue on the
   * Tel Aviv University campus. Weekday board read 2026-08-30 and again
   * 2026-09-06: every line identical.
   *
   * THE FIRST RECORD THAT NEEDS `daysOfWeek`. Shacharit is 07:15 on Sunday,
   * Tuesday and Wednesday and 07:10 on Monday and Thursday, because Monday and
   * Thursday carry קריאת התורה and the service runs longer. Before migration
   * 0008 there was no way to hold both: storing 07:15 alone would have sent a
   * reader five minutes late twice a week, and holding both would have shown
   * nothing for a time we know.
   *
   * A BOARD THAT DID NOT MOVE IS EVIDENCE, and here it is the clearest yet
   * that these are clock faces rather than rules. Shkia fell nine minutes
   * between the two readings — 19:07 to 18:58 — and the Arvit stayed at 19:10,
   * going from shkia + 3 to shkia + 12. A shul recomputing its Arvit from
   * sunset could not have printed the same number twice. Four shuls have now
   * been read twice and not one of them holds an offset:
   *
   *   צימבליסטה     unchanged while shkia moved 9   -> not sunset-derived
   *   נוה קודש      unchanged while netz moved 5    -> not sunrise-derived
   *   תומכי תמימים  moved 8 where shkia moved 9     -> near, and not a rule
   *   היכל חיים     netz − 24 became netz − 19      -> near, and not a rule
   *
   * The windows stay for the reason they were set: the user has confirmed
   * these boards are reprinted weekly, so one printing vouches for one week
   * whatever it happens to say. Two identical printings are two weeks, not a
   * promise about the third — and 19:10 is three minutes BEFORE shkia on
   * 2026-04-15, which is what a promise about the third would have to survive.
   */
  'אוניברסיטת ת"א - צימבוליסטה': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:15' },
        daysOfWeek: [0, 2, 3],
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'Sunday, Tuesday, Wednesday — the days without קריאת התורה',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:10' },
        daysOfWeek: TORAH_READING_DAYS,
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'Monday and Thursday — five minutes earlier for קריאת התורה',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:30' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'first Mincha',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:55' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'second Mincha, ללא חזרת הש״ץ — see held',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:10' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'three minutes before shkia on 2026-04-15, so never year-round',
      },
    ],
    noMinyanim: [],
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

  /**
   * תומכי תמימים - בית חב"ד, ברודצקי 19. Weekday board for the week of
   * 2026-09-06 — the SECOND consecutive reading of this shul's board, and the
   * one that settles what the first could only suspect.
   *
   * SEVEN MINYANIM, WHERE LAST WEEK HAD EIGHT. Shacharit went from three
   * (07:30 / 08:30 / 09:30) to two (08:00 / 09:45), and not one of the three
   * times survived into the new week. A shul that reprints its morning with a
   * different number of minyanim at different hours is not publishing a rule
   * in any form, and no amount of further reading will turn these into one.
   *
   * THE EVENING PAIR IS WHY "THREE CONSECUTIVE BOARDS" WAS THE RIGHT NUMBER.
   * Last week 18:58 and 19:34 sat at shkia − 8 and tzeit − 9 on the Monday,
   * close enough to a rule to be tempting. This week reads 18:50 and 19:26 —
   * both exactly eight minutes earlier, while shkia moved nine minutes earlier
   * and tzeit ten. So the offsets do not repeat:
   *
   *   Sun 2026-08-30   18:58 = shkia − 9    19:34 = tzeit − 11
   *   Sun 2026-09-06   18:50 = shkia − 8    19:26 = tzeit − 9
   *
   * They coincide only if the two weeks are aligned a day apart, which is not
   * a rule — a rule that is right on a different weekday each week is a
   * coincidence wearing arithmetic. Had one board been enough, this shul would
   * now be publishing `shkia − 8` and be a minute wrong for most of the year,
   * drifting further every week. Both stay clock faces with a window.
   *
   * WHAT THIS REPLACES. The GIS layer claims weekday Shacharit at 06:30,
   * 07:30, 09:00 and 10:00 and Mincha at 14:05 and 15:15. Last week exactly
   * one of those (07:30) matched the board; this week none of them do. The
   * municipality was wrong about this shul's location by 950 m and has now
   * been wrong about its times twice over.
   *
   * 09:45 IS THE LATEST SHACHARIT ON THE SITE and it could not be stored
   * unwindowed even if the shul swore to it: sof zman tefila (GRA) falls to
   * 09:33 on 2026-10-25, so a 09:45 minyan begins after it on the darkest
   * winter mornings. This week it clears by 47 minutes. The window is doing
   * two jobs at once here.
   *
   * All seven carry the same window for the reason כלל ישראל's 14:00 does
   * not: one board vouches for one week, and two boards that disagree with
   * each other vouch for less, not more.
   */
  'תומכי תמימים - בית חב"ד': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '08:00' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'first minyan',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '09:45' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'second minyan; sof zman tefila is 10:32 this week',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '13:45' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // Unchanged from last week's board — the only one of the eight that is.
        // Two identical printings is not a rule either; it is one number twice,
        // and an early-afternoon Mincha has no zman to track anyway.
        note: 'first Mincha',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '14:35' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'second Mincha; was 14:30 last week',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:50' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'third Mincha; shkia − 8 today and after shkia from November',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:26' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // tzeit − 9 today, which is NOT why it is stored this way and must not
        // become an anchor: tzeit names two different times, so a tzeit-relative
        // row is held by the ambiguous_tzeit guard whether or not the offset is
        // stated. It is also before shkia in June, so it needs the window twice
        // over. It is a clock face.
        note: 'first Arvit; follows the third Mincha',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '21:00' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'second Arvit, late; unchanged from last week',
      },
    ],
    noMinyanim: [],
    held: [
      {
        what: "the GIS layer's Shabbat Shacharit at 10:00",
        why:
          'A source demonstrably wrong about this shul\'s address by 950 m and ' +
          'about every one of its weekday times on two separate readings has ' +
          'not earned belief about its Shabbat. Dropped with the rest rather ' +
          'than kept as though it were a different class of fact. Shabbat now ' +
          'reads as honestly unknown until somebody photographs that sheet — ' +
          'the same position היכל חיים is in.',
      },
      {
        what: 'whether 18:50 and 19:26 are rules — asked again, answered no',
        why:
          'Two boards now. The offsets shifted by a minute rather than holding, ' +
          'so there is nothing to extract: this shul prints a clock face each ' +
          'week and moves it by roughly, not exactly, what sunset moved. The ' +
          'windows stay, and 19:26 could not be tzeit-anchored in any case — ' +
          'that anchor names two different times and is held on sight.',
      },
      {
        what: 'why last week\'s 07:30, 08:30 and 09:30 Shacharit are simply gone',
        why:
          'A verified record replaces the previous one wholesale, the same way ' +
          'it replaces the parsed one. Carrying last week\'s morning forward ' +
          'beside this week\'s would show five Shacharit minyanim at a shul ' +
          'that holds two, and the expired window would not stop a reader ' +
          'seeing them listed.',
      },
    ],
  },

  /**
   * נוה קודש, אופנהיימר 5 — the second congregation at that door, alongside
   * היכל חיים. Weekday board read 2026-08-31 and again 2026-09-06: unchanged.
   *
   * SHACHARIT AND NOTHING ELSE. The shul states it holds no Mincha and no
   * Arvit at all, which is the first absence narrower than a whole day and
   * the reason migration 0011 exists. Before it, the page showed a single
   * Shacharit row and a reader could not tell a Mincha we were missing from
   * one that does not happen.
   *
   * Scoped to WEEKDAYS deliberately. The user said the shul has Shabbat
   * minyanim and would send them separately, so Shabbat is not claimed empty
   * here — an "at all" that swallowed Shabbat would contradict the same
   * sentence that reported it. If Mincha is absent on Shabbat too, that is a
   * separate statement and it can be added when the Shabbat sheet arrives.
   *
   * Monday and Thursday start ten minutes earlier for קריאת התורה — the same
   * shape as צימבליסטה, and the second shul to need `daysOfWeek`. Between
   * them the two rows cover every weekday exactly once.
   *
   * TWO IDENTICAL WEEKS ARGUE AGAINST A NETZ ANCHOR, not for one. Netz moved
   * from 06:14 to 06:19 between the two readings and the board did not move at
   * all, so 06:30 is not sunrise-relative — it is a clock face that happens to
   * sit near sunrise in September. This is תהילת אביב's lesson a second time,
   * from the opposite direction: there the נץ *label* did not imply the
   * arithmetic, here the *proximity* does not either.
   *
   * So the window is extended rather than the rule promoted. Both faces hold
   * all year and both carry a window anyway: a board vouches for the weeks it
   * was read in, and two readings vouch for two weeks, not for always.
   *
   * This replaces a GIS Shacharit of 06:45, which matches neither reading.
   */
  'נוה קודש': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:30' },
        daysOfWeek: [0, 2, 3],
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'Sunday, Tuesday, Wednesday — the days without קריאת התורה',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:20' },
        daysOfWeek: TORAH_READING_DAYS,
        validFrom: '2026-08-30',
        validUntil: '2026-09-11',
        note: 'Monday and Thursday — ten minutes earlier for קריאת התורה',
      },
    ],
    // Stated by the shul: mornings only, on weekdays. Nothing is claimed about
    // Shabbat, which is still to come.
    noMinyanim: [
      { dayType: 'weekday', service: 'mincha' },
      { dayType: 'weekday', service: 'arvit' },
    ],
    held: [
      {
        what: "the GIS layer's Shabbat rows — Shacharit 07:50 and Mincha בזמן",
        why:
          'A verified record replaces the parsed one wholesale, and the source ' +
          'was wrong about the weekday Shacharit it did report (06:45, against ' +
          'a board reading 06:30 and 06:20). The shul does hold Shabbat ' +
          'minyanim — the user said so — so Shabbat is honestly unknown rather ' +
          'than empty, until that sheet arrives.',
      },
    ],
  },

  /**
   * אוהל יוסף יצחק, בשוויס זינגר 1 — a Chabad house. Weekday board for the
   * week of 2026-08-30.
   *
   * NINE TIMES IDENTICAL TO תהילת אביב'S, AND THAT IS NOT A MISTAKE. It looks
   * exactly like one: two unrelated congregations 734 m apart, one עדות
   * המזרח and one Chabad, both starting a minyan at 07:13. It was queried on
   * exactly those grounds and confirmed — so it is written down here, because
   * the next person to notice will reach for the same conclusion and should
   * find the answer rather than repeat the question.
   *
   * NOT a `SHARED_BOARD`, deliberately. That mechanism means ONE physical
   * board serving two shuls in one building — כלל ישראל and בית חב"ד רמת אביב
   * ג' at nought metres — where a single reading genuinely vouches for both.
   * These are two buildings with two boards that happen to agree this week.
   * Sharing the record would mean next week's reading of תהילת אביב silently
   * rewriting a shul nobody had been to, which is fabrication with extra
   * steps. Two records, and the windows below are what makes copying safe:
   * whichever is not re-read simply expires and goes honestly unknown.
   *
   * ONLY THE LABELS THE BOARD GAVE. תהילת אביב's 05:40 is marked נץ, its
   * 18:10 פלג, and its two late Arvits למעלה and למטה. None of that was said
   * about this shul, so none of it is recorded here — identical times do not
   * license identical labels, and the labels are what a reader picks by.
   *
   * Five of the nine cannot hold all year, the same five as at תהילת אביב:
   * mincha 13:15 falls before mincha gedola on 2026-03-27, 17:45 and 18:50
   * are after shkia from November, arvit 18:10 is before shkia on 2026-03-27
   * and 19:35 on 2026-05-21. The whole block is windowed regardless.
   */
  'אוהל יוסף יצחק': {
    verifiedAt: '2026-08-31',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '05:40' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first minyan',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:13' },
        style: 'hodu',
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second minyan',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '08:15' },
        style: 'hodu',
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third minyan',
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
        note: 'third Mincha; shkia − 16 this week and after sunset from November',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '18:10' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'first Arvit',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:35' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'second Arvit',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '20:00' },
        validFrom: '2026-08-30',
        validUntil: '2026-09-04',
        note: 'third Arvit',
      },
    ],
    noMinyanim: [],
    held: [
      {
        what: "the GIS layer's Shabbat Shacharit at 05:45",
        why:
          'A verified record replaces the parsed one wholesale, and the source ' +
          'listed nothing at all for this shul on weekdays while the board ' +
          'carries nine. Shabbat is coming separately, so it stays honestly ' +
          'unknown rather than being claimed empty.',
      },
      {
        what: "whether תהילת אביב's labels apply here too",
        why:
          'The times match line for line, and תהילת אביב marks its 05:40 נץ, ' +
          'its 18:10 פלג and its late Arvits למעלה and למטה. This board was not ' +
          'reported as saying any of that. Matching times are not evidence of ' +
          'matching labels, and a label is what a reader chooses a minyan by — ' +
          'so they are held rather than assumed. One question at the shul settles it.',
      },
    ],
  },

  /**
   * המרכזי, נח 20. Weekday board for the week of 2026-09-06.
   *
   * MINCHA AND ARVIT ONLY — the shul holds no weekday Shacharit at all,
   * stated. The municipality claims one at 06:30, which makes this the sixth
   * shul whose GIS times are simply wrong rather than merely stale, and the
   * second where the correction is that a service does not happen.
   *
   * Without `synagogue_absences` this would have shown two rows and left a
   * reader unable to tell a Shacharit we were missing from one that is not
   * held. Scoped to weekdays: nothing was said about Shabbat, and the GIS
   * Shabbat rows go with the rest rather than being kept as a better class of
   * fact.
   *
   * Mincha 16:45 cannot hold all year — on 2026-11-08 shkia IS 16:45, so it
   * would be a Mincha exactly at sunset. Windowed, and the 365-day sweep found
   * it rather than an eye. Arvit 19:55 would survive unwindowed and takes one
   * anyway, printed on the same board and vouched for exactly as long.
   */
  'המרכזי': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '16:45' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'exactly at shkia on 2026-11-08, so never year-round',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '19:55' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'shkia + 57 this week',
      },
    ],
    noMinyanim: [{ dayType: 'weekday', service: 'shacharit' }],
    held: [
      {
        what: "the GIS layer's weekday Shacharit at 06:30 and Shabbat rows",
        why:
          'The weekday Shacharit does not exist — the shul holds none, which is ' +
          'now recorded as a stated absence rather than left as a silence. A ' +
          'source wrong about whether a service happens at all has not earned ' +
          'belief about Shabbat either, so its Shabbat Shacharit at 08:15 goes ' +
          'with it and Shabbat reads as honestly unknown.',
      },
    ],
  },

  /**
   * היכל חיים, אופנהיימר 5. Weekday board for the week of 2026-09-06 — the
   * SECOND consecutive reading, and it says the same thing תומכי תמימים's
   * second board said: there is no rule here to extract.
   *
   *   נץ minyan   05:50 = netz − 24 (30 Aug)   06:00 = netz − 19 (6 Sep)
   *   Mincha      17:40                         17:30
   *   third       07:25                         07:25
   *
   * The נץ offset moved five minutes between two printings. A minyan that
   * genuinely recomputed sunrise each week would hold its offset and move its
   * clock face; this one moves both. So the `netz` style stays a LABEL and the
   * time stays a windowed clock face — which is what the style's own docstring
   * says it is for, now demonstrated twice rather than assumed.
   *
   * THE ARVIT LOST ITS TIME. Last week's board printed 18:05. This week says
   * only that Arvit follows Mincha, so it is stored `unknown`: we know the
   * service happens and not when. Carrying 18:05 forward would be inventing an
   * offset from a Mincha that itself moved ten minutes — exactly the `בזמן`
   * mistake, made from a better-looking starting point. A record replaces the
   * previous one wholesale, and sometimes wholesale means downward.
   *
   * `רבי ישמעאל` BESIDE THE SECOND AND THIRD SHACHARIT is now a stored style,
   * not a held word. It was held for exactly one reading, then asked: the shul
   * says it means what `hodu` means one step earlier — the minyan begins at
   * ברייתא דרבי ישמעאל in the korbanot rather than at הודו. Migration 0012.
   * Not folded into `hodu`, which names a different place to start.
   *
   * Last week's `למנצח` beside Mincha was not reported this time and stays
   * held; see below.
   */
  'היכל חיים': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:00' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // netz − 19 this week against netz − 24 last week. Two printings, two
        // offsets: the label is not the arithmetic. Stored as the clock face
        // the board prints, with the window every netz clock face must carry
        // because sunrise moves an hour across the year.
        style: 'netz',
        note: 'first minyan, in the synagogue',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:05' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        location: 'sukkah',
        style: 'rabbi_yishmael',
        note: 'second minyan, in the sukkah',
      },
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '07:25' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        style: 'rabbi_yishmael',
        note: 'third minyan',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '17:30' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        // shkia − 88 this week and shkia + 55 in December. The window is not
        // optional on this one.
        note: 'before plag (17:39 today), which is what the early Arvit needs',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'unknown', rawText: 'אחרי מנחה' },
        validFrom: '2026-09-06',
        validUntil: '2026-09-11',
        note: 'the board states only that it follows Mincha',
      },
    ],
    // Nothing stated either way, so everything unlisted stays unknown.
    noMinyanim: [],
    held: [
      {
        what: 'the GIS layer\'s Shabbat Shacharit, 07:30 and 08:30',
        why:
          'Dropped with the rest of the municipal record for this shul. It had ' +
          'the weekdays wrong in every particular on two separate readings — ' +
          '06:15 and 07:30 against 05:50/06:50/07:25 and then 06:00/06:05/' +
          '07:25 — so its Shabbat times are not a better class of evidence, ' +
          'they are the same evidence. Recorded here so the loss is deliberate ' +
          'and recoverable, and so the next person knows to read the Shabbat ' +
          'sheet rather than assume we never had one.',
      },
      {
        what: 'last week\'s `למנצח` beside Mincha, not reported this week',
        why:
          'Recorded so its absence is not read as the board having changed. It ' +
          'was never stored — there is no field for it, and it is not a style ' +
          'in the sense the enum means — and this reading simply did not ' +
          'mention it either way.',
      },
      {
        what: 'why the sukkah minyan moved from 06:50 to 06:05',
        why:
          'Every other line moved by ten minutes or less between the two ' +
          'readings; this one moved forty-five, landing five minutes after the ' +
          'נץ minyan rather than an hour after it. Asked, and the answer is ' +
          'that this is what the shul says — not something readable off a sign ' +
          'a second time. So it is stored as reported and the reason is simply ' +
          'not known, which is a different state from a doubtful transcription ' +
          'and is recorded as such. Nothing to resolve until someone asks the ' +
          'shul why.',
      },
      {
        what: 'whether any of this is a rule',
        why:
          'Two boards now, and they disagree about the נץ offset by five ' +
          'minutes and about the Mincha by ten. So nothing here is a rule yet, ' +
          'and the case is stronger than it was after one reading: a single ' +
          'board could not tell a rule from a reprint, and two boards that ' +
          'move differently rule the first out.',
      },
    ],
  },

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
    // Nothing stated either way, so everything unlisted stays unknown.
    noMinyanim: [],
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

  /**
   * משכן אחים, ברודצקי 21. Not a weekly board — a standing schedule, and the
   * first record in this file that is mostly RULES rather than clock faces.
   *
   * TWO MINYANIM UNDER ONE ROOF, with different times for almost everything:
   * a מניין תימני and a מניין ספרדי. The GIS layer has this shul as `תימני`
   * with a single Shabbat Shacharit at 07:00, and both halves of that are
   * wrong — there are two groups and neither davens at seven.
   *
   * THE SECOND GROUP IS עדות המזרח, and that is a reading rather than a
   * choice. It was stored as `general` for one day — a distinct group whose
   * rite we would not assign — and then asked. The answer, `נוסח ספרדי`, is
   * the same word `curation.ts` already resolves for כלל ישראל's
   * `מניין אשכנזי-ספרדי`: in Israeli usage `ספרדי` is the Sephardi-Mizrahi
   * rite, not the chassidic נוסח ספרד, which would be a strange thing to find
   * nested inside a Yemenite congregation. Applying a reading this codebase
   * has already established, for the same word from the same person, is not
   * the forbidden step of picking a liturgy for a congregation.
   *
   * `synagogues.nusachim` becomes `{teimani, edot_hamizrach}` through
   * `NUSACHIM_SERVED`, so the building now answers a filter for either rite
   * rather than only for the one the municipality wrote down.
   *
   * ALL OF IT FOLLOWS THE אור החיים LUACH, which the shul states and which
   * this codebase cannot yet honour — every zman here is GRA via the Rabbanut.
   * What that costs, line by line:
   *
   *   shkia − 15        negligible. Sunset is sunset; luachot differ by
   *                     seconds over נראית vs אמיתית, not by minutes.
   *   candle_lighting   up to two minutes, if אור החיים prints 20 for Tel Aviv
   *                     where the Religious Council prints 22. Ours is the
   *                     earlier of the two, which is the side to be wrong on.
   *   tzeit             unbounded, and already the reason those rows are held.
   *
   * So the luach question is no longer a design note — this is the first shul
   * that needs it, and the tzeit rows below cannot be published until it is
   * answered for אור החיים specifically.
   *
   * WHAT CANNOT BE SAID HERE. The Yemenite group holds no weekday Mincha and
   * no weekday Arvit; the Sephardi group holds both. `synagogue_absences` is
   * keyed on the BUILDING — a day plus an optional service — so it can say
   * "this shul holds no weekday Mincha", which would be false, and it cannot
   * say "this GROUP holds none", which is what is true. The absence is real
   * and is recorded in `held` rather than asserted in a shape that would
   * overstate it. נוה קודש needed absence narrower than a day; this needs it
   * narrower than a building.
   */
  'משכן אחים': {
    verifiedAt: '2026-09-06',
    verifiedBy: 'notice_board',
    minyanim: [
      /* ---------------------------- מניין תימני ---------------------------- */
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:20' },
        nusach: 'teimani',
        // No window. This is not a reprinted board: the shul states a standing
        // schedule, and 06:20 is a legal Shacharit on all 365 days.
        note: 'מניין תימני',
      },
      {
        service: 'mincha',
        dayType: 'erev_shabbat',
        time: { kind: 'relative', anchor: 'candle_lighting', offsetMinutes: 0 },
        nusach: 'teimani',
        // Stored on FRIDAY, not on Shabbat — the shul separated the two in the
        // telling, which is the only thing that may set erev_shabbat. And the
        // day comes from that separation, never from the anchor: כלל ישראל's
        // erev-Shabbat Mincha is shkia − 20 and is still a Friday.
        note: 'מניין תימני — at כניסת שבת',
      },
      {
        service: 'arvit',
        dayType: 'erev_shabbat',
        time: { kind: 'unknown', rawText: 'אחרי מנחה' },
        nusach: 'teimani',
        note: 'מניין תימני — follows the erev-Shabbat Mincha',
      },
      {
        service: 'shacharit',
        dayType: 'shabbat',
        time: { kind: 'fixed', time: '08:00' },
        nusach: 'teimani',
        // "Always at 8:00" — the shul's own word, and the rare case where a
        // clock face is claimed to be durable by the source rather than merely
        // surviving the sweep. No window, because none was implied.
        note: 'מניין תימני — stated as always 08:00',
      },
      {
        service: 'mincha',
        dayType: 'shabbat',
        time: { kind: 'relative', anchor: 'tzeit', offsetMinutes: -90 },
        nusach: 'teimani',
        // Held by ambiguous_tzeit, correctly. `צאת שבת` on a luach is the
        // stringent value and would normally be unambiguous — but the luach in
        // question is אור החיים, whose convention we do not have. The anchor is
        // kept and never published, which is exactly what the guard is for.
        note: 'מניין תימני — 90 minutes before צאת שבת',
      },
      {
        service: 'arvit',
        dayType: 'shabbat',
        time: { kind: 'relative', anchor: 'tzeit', offsetMinutes: 0 },
        nusach: 'teimani',
        note: 'מניין תימני — motzaei Shabbat, at צאת הכוכבים',
      },

      /* --------------------------- מניין ספרדי ---------------------------- */
      {
        service: 'shacharit',
        dayType: 'weekday',
        time: { kind: 'fixed', time: '06:00' },
        nusach: 'edot_hamizrach',
        note: 'מניין ספרדי',
      },
      {
        service: 'mincha',
        dayType: 'weekday',
        time: { kind: 'relative', anchor: 'shkia', offsetMinutes: -15 },
        nusach: 'edot_hamizrach',
        // THE BEST KIND OF ROW THIS PROJECT CAN HOLD. A rule, so it is correct
        // in December as well as today, and it never expires because sunset
        // moves with it. Every windowed clock face in this file is a
        // placeholder for one of these.
        note: 'מניין ספרדי — 15 minutes before shkia',
      },
      {
        service: 'arvit',
        dayType: 'weekday',
        time: { kind: 'unknown', rawText: 'אחרי מנחה' },
        nusach: 'edot_hamizrach',
        // Follows a Mincha that is itself shkia − 15, so it lands somewhere
        // around sunset — and "around" is not a time. Deriving one from the
        // Mincha rule would be inventing an offset the shul never stated.
        note: 'מניין ספרדי — follows Mincha',
      },
      {
        service: 'mincha',
        dayType: 'erev_shabbat',
        time: { kind: 'relative', anchor: 'candle_lighting', offsetMinutes: 0 },
        nusach: 'edot_hamizrach',
        note: 'מניין ספרדי — at כניסת שבת',
      },
      {
        service: 'arvit',
        dayType: 'erev_shabbat',
        time: { kind: 'unknown', rawText: 'אחרי מנחה' },
        nusach: 'edot_hamizrach',
        note: 'מניין ספרדי — follows the erev-Shabbat Mincha',
      },
      {
        service: 'shacharit',
        dayType: 'shabbat',
        time: { kind: 'fixed', time: '07:45' },
        nusach: 'edot_hamizrach',
        note: 'מניין ספרדי',
      },
      {
        service: 'mincha',
        dayType: 'shabbat',
        time: { kind: 'relative', anchor: 'tzeit', offsetMinutes: -90 },
        nusach: 'edot_hamizrach',
        note: 'מניין ספרדי — 90 minutes before צאת שבת',
      },
    ],
    // Nothing can be stated. The one absence this shul has is narrower than
    // the building — see the note above and the held entry below.
    noMinyanim: [],
    held: [
      {
        what: 'that the Yemenite group holds no weekday Mincha and no weekday Arvit',
        why:
          'True, stated, and unrepresentable. `synagogue_absences` is keyed on ' +
          'the building, so the only row available would say the SHUL holds no ' +
          'weekday Mincha — and it does, at shkia − 15, with the Sephardi ' +
          'group. Asserting it would turn a true statement about one minyan ' +
          'into a false one about the shul, which is worse than the silence. ' +
          'Recorded here so the absence is not lost while the schema cannot ' +
          'hold it, and so nobody later reads the missing rows as data we ' +
          'never had.',
      },
      {
        what: 'the two Shabbat Mincha rules and the motzaei-Shabbat Arvit',
        why:
          'Stored with their anchors and held by ambiguous_tzeit, not dropped. ' +
          '`צאת שבת` would normally be the stringent 8.5° value and unambiguous ' +
          '— but this shul follows אור החיים, and we do not have that luach\'s ' +
          'convention. Resolving 90 minutes before the wrong nightfall puts a ' +
          'Mincha up to half an hour off. This is the guard doing its job on a ' +
          'question that now has a specific, askable answer.',
      },
      {
        what: "the GIS layer's Shabbat Shacharit at 07:00",
        why:
          'It matches neither group — the Yemenite minyan is 08:00 and the ' +
          'Sephardi 07:45 — and the source did not know there were two groups ' +
          'at all. Dropped with the rest, wholesale.',
      },
      {
        what: 'whether every zman here should be read from אור החיים',
        why:
          'The shul says its times follow that luach and ours are GRA via the ' +
          'Rabbanut. Only the tzeit rows are actually blocked by it; the ' +
          'shkia rule is unaffected and candle lighting is at most two minutes ' +
          'and on the safe side. Written down because this is the first record ' +
          'where the per-luach question stops being theoretical.',
      },
    ],
  },

};

/** The verified record for a synagogue, or null if nobody has read its board. */
/**
 * One notice board, two synagogues.
 *
 * SETTLED, not provisional. Two records at one point with identical times look
 * exactly like one shul entered twice, and the user — who davens in this
 * neighbourhood — was asked and confirmed they are two different congregations
 * sharing a building and a schedule. Do not merge them, and do not re-open it
 * on the evidence of the data alone: that evidence cannot tell the two apart,
 * which is why it was a question for a person.
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
