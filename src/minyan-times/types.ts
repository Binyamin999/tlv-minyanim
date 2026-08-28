/**
 * TLV Minyanim — structured minyan times.
 *
 * THE CORE INVARIANT (CLAUDE.md): a minyan time is one of exactly three things.
 * There is no fourth kind and there are no strings. A time we cannot resolve is
 * `unknown` carrying its raw text — never a guess, never a plausible default.
 *
 * Why: LA Jewish Times stores relative times as the literal text
 * "~25 Min before Netz". Those minyanim are invisible to their own next-minyan
 * feature because they cannot be sorted into a timeline. That is the single
 * mistake this file exists to prevent.
 */

/** Named halachic anchors. Resolved by a zmanim library, never by this module. */
export type Zman =
  | 'alot'
  | 'netz'
  | 'shema'
  | 'chatzot'
  | 'mincha_gedola'
  | 'mincha_ketana'
  | 'plag'
  | 'shkia'
  | 'tzeit'
  | 'candle_lighting';

export type MinyanTime =
  /** A clock time, always normalised to "HH:MM" 24h, Asia/Jerusalem. */
  | { kind: 'fixed'; time: string }
  /** A signed offset from a named zman. Negative = before, positive = after. */
  | { kind: 'relative'; anchor: Zman; offsetMinutes: number }
  /** We do not know the offset. `rawText` is preserved verbatim, always. */
  | { kind: 'unknown'; rawText: string };

export type Service = 'shacharit' | 'mincha' | 'arvit';

/**
 * `ח` = חורף (winter) / `ק` = קיץ (summer).
 *
 * Modelled as a property of the minyan rather than as two separate records
 * because the source writes one minyan with two clock faces (`ח 12:30 ק 13:30`),
 * and because the winter/summer switch is a *rule* the caller applies at render
 * time — exactly like a zman offset. `null` means the source stated no season,
 * i.e. the time holds year round. It never means "we forgot to look".
 */
export type Season = 'winter' | 'summer';

/**
 * Which day the time applies to. This is NOT derivable from the text — it comes
 * from which column the string was read out of (`weekday_times_raw` vs
 * `shabbat_times_raw`). The parser therefore accepts it from the caller and
 * refuses to infer it. `null` = the caller did not say, and we will not pretend.
 */
export type DayType = 'weekday' | 'shabbat';

/** CLAUDE.md's synagogue status enum. Some "time" fields are actually statuses. */
export type SynagogueStatus =
  | 'active'
  | 'holidays_only'
  | 'seasonal'
  | 'dormant'
  | 'closed';

/**
 * Why a human has to look at this record before it can be published.
 * A non-empty `needsReview` is a hard publication gate: the value is kept
 * (nothing is ever silently dropped) but it must not reach a user unreviewed.
 */
export type ReviewReason =
  /** The source gave a time with no service label. We refuse to attribute it. */
  | { code: 'unattributed_service'; detail: string }
  /** Text inside the segment that this parser does not understand. */
  | { code: 'unparsed_text'; detail: string }
  /**
   * The clock time cannot be right for this service under either a 12- or a
   * 24-hour reading — e.g. a Shacharit at 22:00, or a Mincha at 11:00 (before
   * chatzot as written, after nightfall with 12 added). Something is wrong in
   * the source and we will not choose which. The time is kept; it must not be
   * published.
   */
  | { code: 'implausible_for_service'; detail: string }
  /**
   * The minyan is anchored to `tzeit`, and `tzeit` names two different times.
   *
   * On a luach, יציאת שבת is the stringent 8.5° value — about shkia + 39 in Tel
   * Aviv — and that is what this codebase resolves `tzeit` to, matching the
   * Rabbanut. But a shul writing צאת הכוכבים on its Arvit line almost always
   * means the ordinary nightfall it davens at, shkia + 13.5 to 25 depending on
   * the community. Those are up to twenty-six minutes apart.
   *
   * Resolving the shul's word against the luach's definition lists the minyan
   * that much LATE — someone arrives to an empty room, which is the exact
   * failure this project exists to prevent. The offset is not written down
   * anywhere we can read, so we keep the anchor, refuse to publish it, and ask
   * the gabbai. See CLAUDE.md and docs/zmanim-ground-truth.md §9.1.
   */
  | { code: 'ambiguous_tzeit'; detail: string };

/**
 * Recorded when a 12-hour clock face was resolved to its only possible 24-hour
 * reading — `מנחה 1:30` -> 13:30, because Mincha at 01:30 does not exist.
 *
 * This is NOT the invented-offset problem. `בזמן` has no time in the source at
 * all, so supplying one would be fabrication. Here the time *is* stated and the
 * only question is which of two clock conventions the writer used — and for a
 * given service exactly one of them is halachically possible. Resolving that is
 * reading the source, not guessing past it.
 *
 * We record it anyway. A conversion is a claim about the source, so it stays
 * auditable and queryable: `WHERE clock_normalisation IS NOT NULL` returns every
 * one of them for a human to spot-check against a photograph of the sign.
 */
export interface ClockNormalisation {
  /** What the source wrote, normalised to HH:MM but not shifted. */
  from: string;
  /** What we read it as. */
  to: string;
  /** Why we were entitled to shift it. */
  basis: 'only_possible_reading_for_service';
}

/**
 * How we know the sign of a relative offset.
 *  - 'explicit'   — the source used an unambiguous preposition (לפני / אחרי).
 *  - 'convention' — the source used `לפי` ("according to"), which is not
 *                   literally directional. CLAUDE.md fixes it as *before*.
 *                   Publishable, but worth a periodic eyeball against a source.
 */
export type SignBasis = 'explicit' | 'convention';

export interface ParsedMinyan {
  /** null when the source gave a bare time with no service word. Never guessed. */
  service: Service | null;
  time: MinyanTime;
  /** null = stated for no particular season, i.e. year round. */
  season: Season | null;
  /** Supplied by the caller from the field name; null if the caller did not say. */
  dayType: DayType | null;
  /** Only present on `relative` times. */
  signBasis?: SignBasis;
  /** Present only when a 12-hour clock face was shifted. See ClockNormalisation. */
  clockNormalisation?: ClockNormalisation;
  /** Verbatim slice of the field this minyan was read out of. Round-trip anchor. */
  rawSegment: string;
  /** The whole original field, untouched. */
  rawField: string;
  /** Position within the field, 0-based. Stable identity for the nightly diff. */
  index: number;
  /** Non-empty ⇒ do not publish. */
  needsReview: ReviewReason[];
}

export interface StatusFinding {
  status: SynagogueStatus;
  rawSegment: string;
}

/**
 * A shiur (class), not a minyan. Kept because "not everything in a time field is
 * a time" and because dropping it would lose data — but it must never become a
 * ParsedMinyan. A 7:00 daf yomi is not a 7:00 shacharit.
 */
export interface ShiurFinding {
  rawSegment: string;
  /** Times mentioned in the shiur text, parsed but explicitly not minyanim. */
  times: MinyanTime[];
}

export type ParseIssueCode =
  /** A run of characters no rule matched. The loud failure. */
  | 'unrecognized_text'
  /** Looked like a time but is not one (e.g. 25:70). */
  | 'invalid_time'
  /** A relative phrase whose anchor word we do not have in the lexicon. */
  | 'unknown_anchor'
  /** The field was empty or punctuation only. */
  | 'empty_field'
  /** The field had content but yielded no minyan, no status and no shiur. */
  | 'no_content_recognised';

export interface ParseIssue {
  code: ParseIssueCode;
  /** The exact fragment that failed. Never elided — a low number beats a wrong one. */
  fragment: string;
  message: string;
  rawField: string;
}

export interface ParseResult {
  /** The input, verbatim. */
  raw: string;
  dayType: DayType | null;
  /** The minyanim this field encodes. One field routinely encodes several. */
  minyanim: ParsedMinyan[];
  statuses: StatusFinding[];
  shiurim: ShiurFinding[];
  /** Anything the parser could not account for. Never empty just to look clean. */
  issues: ParseIssue[];
}

export interface ParseContext {
  /** Which column this string came from. Omit only if you genuinely do not know. */
  dayType?: DayType;
}
