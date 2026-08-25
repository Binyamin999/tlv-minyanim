/**
 * parseMinyanTimes — Hebrew free-text prayer times -> structured MinyanTime values.
 *
 * SCOPE NOTE. This parser was written against the 16 Ramat Aviv synagogues in
 * `data/seed-ramat-aviv.json`, but it is built for all 484 Tel Aviv-Yafo shuls.
 * The Ramat Aviv sample is small and tidy by comparison with what the rest of
 * the GIS layer contains. Shapes not in this sample WILL appear. When they do
 * this parser must fail loudly — an `unrecognized_text` issue naming the exact
 * fragment — and must never quietly drop text or invent a value to make the
 * numbers look better. A low coverage figure is information; a high one bought
 * by guessing is a liability.
 *
 * THE RULE THAT GOVERNS EVERYTHING HERE
 * `בזמן` ("at the proper time") is `kind: 'unknown'`, always, with its raw text
 * preserved. It is the most common value in the corpus. It is a placeholder for
 * an offset nobody wrote down. Do not infer it from a neighbouring synagogue,
 * do not average it, do not substitute a plausible default. A blank Mincha is
 * honest. A wrong one sends someone to an empty room and costs us that user
 * permanently.
 *
 * This module computes nothing. It determines the *rule*; a zmanim library
 * applies it.
 */
import {
  ANCHOR_PHRASES,
  MINUTE_WORDS,
  PREPOSITIONS,
  SEASON_MARKERS,
  SERVICE_LABELS,
  SHIUR_MARKERS,
  STATUS_PATTERNS,
  UNKNOWN_MARKERS,
} from './lexicon.ts';
import type {
  ClockNormalisation,
  MinyanTime,
  ParseContext,
  ParseIssue,
  ParsedMinyan,
  ParseResult,
  ReviewReason,
  Season,
  Service,
  ShiurFinding,
  SignBasis,
  StatusFinding,
  Zman,
} from './types.ts';

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/** Bidi control characters that ride along invisibly in copy-pasted Hebrew. */
const BIDI_MARKS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/g;
/** Every dash the sources use (Hebrew maqaf, en/em dash, minus), to ASCII. */
const DASHES = /[\u05BE\u2010-\u2015\u2212]/g;
/** Hebrew geresh and curly apostrophes, folded to ASCII. */
const APOSTROPHES = /[\u05F3\u2018\u2019\u02BC]/g;
/** Hebrew gershayim and curly quotes, folded to ASCII. */
const QUOTES = /[\u05F4\u201C\u201D]/g;
/** Hebrew letters, for word-boundary tests. */
const HEBREW_LETTER = /[\u05D0-\u05EA]/;

function normalise(raw: string): string {
  return raw
    .replace(BIDI_MARKS, '')
    .replace(DASHES, '-')
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    .replace(/[ \t]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Separators between items inside one segment. */
const SEP = /^[\s\-–—:]+(?=\S)|^[\s\-–—]+$/;

/* ------------------------------------------------------------------ */
/* Clock times                                                         */
/* ------------------------------------------------------------------ */

/**
 * `6:30`, `7.30`, `13:55`. Periods are used interchangeably with colons in the
 * source. A trailing hyphen or word boundary must follow — we will not read
 * `6:30` out of the middle of a longer number.
 */
const TIME_RE = /^(\d{1,2})[:.](\d{2})(?![:.\d])/;

function normaliseClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Clock-face plausibility                                             */
/* ------------------------------------------------------------------ */

/**
 * When may a stated clock time belong to a given service?
 *
 * The source mixes 12- and 24-hour faces freely: `מנחה 1:30` is half past one
 * in the *afternoon*, because Mincha at 01:30 does not exist. Reading it
 * literally publishes a time that is not merely unusual but impossible, and it
 * does so with a clean record and no review flag — the one way this module can
 * be confidently wrong. So we test each stated time against the window its
 * service can actually occupy.
 *
 * The windows are deliberately generous. They are not halachic boundaries and
 * must never be used to compute anything — a zmanim library does that. They
 * exist only to answer "could a human plausibly have written this for this
 * service?", and they are drawn wide enough to cover Tel Aviv's full seasonal
 * swing plus the outliers real communities keep:
 *
 *   shacharit  03:00-12:00  vatikin in midsummer is ~05:00, and Shabbat
 *                           minyanim run to 10:00; 11:00 exists. Nothing
 *                           legitimate is later, since Shacharit ends by
 *                           chatzot (~11:39 winter).
 *   mincha     12:00-20:00  earliest is mincha gedola (~12:10 winter); latest
 *                           is just before shkia (~19:50 midsummer DST).
 *   arvit      16:30-23:59  a winter plag minyan can start ~16:30; late
 *                           minyanim run to 23:00 and past it.
 *
 * A time outside its window gets ONE chance: add twelve hours. If that lands
 * inside, the writer used a 12-hour face and we say so via ClockNormalisation.
 * If it does not, we do not choose — the minyan is flagged
 * `implausible_for_service` and is unpublishable until a human looks.
 *
 * Note what this deliberately does NOT do: it never shifts a time that is
 * already plausible. `מנחה 12:30` stays 12:30. Ambiguity is only ever resolved
 * when exactly one reading survives.
 */
const SERVICE_WINDOWS: Readonly<Record<Service, readonly [number, number]>> = {
  // [earliest, latest] in minutes from midnight.
  shacharit: [3 * 60, 12 * 60],
  mincha: [12 * 60, 20 * 60],
  arvit: [16 * 60 + 30, 24 * 60 - 1],
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function withinWindow(minutes: number, service: Service): boolean {
  const [lo, hi] = SERVICE_WINDOWS[service];
  return minutes >= lo && minutes <= hi;
}

interface ClockVerdict {
  /** The time to use. Unchanged unless a 12-hour face was resolved. */
  time: string;
  normalisation?: ClockNormalisation;
  implausible?: string;
}

/**
 * Decide what a stated clock time means for a service. Returns the time to
 * store, plus provenance if it was shifted or a reason if it cannot be right.
 *
 * A minyan with no service label is left alone: without knowing the service
 * there is no window to test against, and such a record is already held back
 * by `unattributed_service`.
 */
function judgeClock(stated: string, service: Service | null): ClockVerdict {
  if (service === null) return { time: stated };

  const minutes = toMinutes(stated);
  if (withinWindow(minutes, service)) return { time: stated };

  const shifted = minutes + 12 * 60;
  if (shifted < 24 * 60 && withinWindow(shifted, service)) {
    const to = normaliseClock(Math.floor(shifted / 60), shifted % 60);
    return {
      time: to,
      normalisation: { from: stated, to, basis: 'only_possible_reading_for_service' },
    };
  }

  const [lo, hi] = SERVICE_WINDOWS[service];
  return {
    time: stated,
    implausible:
      `${stated} is not a possible ${service} time, and neither is ` +
      `${normaliseClock(Math.floor((shifted % (24 * 60)) / 60), shifted % 60)}. ` +
      `Expected between ${normaliseClock(Math.floor(lo / 60), lo % 60)} and ` +
      `${normaliseClock(Math.floor(hi / 60), hi % 60)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Scanner state                                                       */
/* ------------------------------------------------------------------ */

interface Emitted {
  time: MinyanTime;
  season: Season | null;
  signBasis?: SignBasis;
  /**
   * True when the time came from a bare anchor word with no number (`נץ`),
   * which we read as offset 0. That reading is only safe if the rest of the
   * segment was fully understood — see the downgrade in parseMinyanTimes.
   */
  fromBareAnchor?: boolean;
}

interface PhraseMatch<T> {
  /** The literal text matched, including any `ה` prefix. */
  phrase: string;
  value: T;
  length: number;
}

/**
 * Longest-first phrase match anchored at position 0, respecting Hebrew word
 * boundaries so `ח` (winter) never matches inside `חצות` and `נץ` never matches
 * inside a longer word. The phrase tables are ordered longest-first; no entry
 * may follow one it is a prefix of.
 */
function matchAtStart<T>(
  text: string,
  phrases: ReadonlyArray<readonly [string, T]>,
  allowHePrefix = false,
): PhraseMatch<T> | null {
  for (const [phrase, value] of phrases) {
    if (text.startsWith(phrase) && isWordEnd(text, phrase.length)) {
      return { phrase, value, length: phrase.length };
    }
    if (allowHePrefix) {
      const withHe = `ה${phrase}`;
      if (text.startsWith(withHe) && isWordEnd(text, withHe.length)) {
        return { phrase: withHe, value, length: withHe.length };
      }
    }
  }
  return null;
}

/** A Hebrew word has ended if the next character is not a Hebrew letter. */
function isWordEnd(text: string, at: number): boolean {
  if (at >= text.length) return true;
  return !HEBREW_LETTER.test(text.charAt(at));
}

interface PrepositionMatch {
  sign: -1 | 1;
  signBasis: SignBasis;
  length: number;
}

/** לפני / קודם = before, אחרי / לאחר = after, לפי = before by convention. */
function matchPreposition(text: string): PrepositionMatch | null {
  for (const [word, sign, basis] of PREPOSITIONS) {
    if (text.startsWith(word) && isWordEnd(text, word.length)) {
      return { sign, signBasis: basis, length: word.length };
    }
  }
  return null;
}

/** Identity phrase table helper: match a bare word list. */
function words(list: readonly string[]): ReadonlyArray<readonly [string, string]> {
  return list.map((w) => [w, w] as const);
}

/* ------------------------------------------------------------------ */
/* Segment scanning                                                    */
/* ------------------------------------------------------------------ */

interface SegmentScan {
  emitted: Emitted[];
  issues: Array<{ code: 'unrecognized_text' | 'invalid_time'; fragment: string }>;
}

/**
 * Walk one segment left to right, emitting a MinyanTime for every time-like
 * thing found. Anything unmatched is captured verbatim as an issue and skipped —
 * the segment keeps going, so one bad word never swallows the times around it.
 */
function scanSegment(text: string): SegmentScan {
  const emitted: Emitted[] = [];
  const issues: SegmentScan['issues'] = [];
  let pendingSeason: Season | null = null;
  let rest = text;

  while (rest.length > 0) {
    const sep = rest.match(SEP);
    if (sep) {
      rest = rest.slice(sep[0].length);
      continue;
    }
    if (rest.trim().length === 0) break;

    // 1. An explicit offset: "20 דק' לפי שקיעה" / "10 דקות לפני הדלקת נרות".
    const offset = matchOffsetPhrase(rest);
    if (offset) {
      emitted.push({
        time: {
          kind: 'relative',
          anchor: offset.anchor,
          offsetMinutes: offset.offsetMinutes,
        },
        season: pendingSeason,
        signBasis: offset.signBasis,
      });
      pendingSeason = null;
      rest = rest.slice(offset.length);
      continue;
    }

    // 2. A directional phrase with no number: "לפני השקיעה".
    //    We know the anchor but not the offset. That is `unknown`, not zero.
    const bareDirection = matchBareDirection(rest);
    if (bareDirection) {
      emitted.push({
        time: { kind: 'unknown', rawText: bareDirection.text },
        season: pendingSeason,
      });
      pendingSeason = null;
      rest = rest.slice(bareDirection.length);
      continue;
    }

    // 3. Season marker: standalone `ח` or `ק`, applying to whatever follows.
    //    Guarded hard: a single letter is only a season marker if a separator
    //    or a digit follows it. Without this, `ק"ש` (sof zman kriat shma)
    //    would read as "summer" plus a stray letter.
    const season = matchAtStart<Season>(rest, SEASON_MARKERS);
    if (season && /^[\s\-]*\d/.test(rest.slice(season.length))) {
      pendingSeason = season.value;
      rest = rest.slice(season.length);
      continue;
    }

    // 4. A bare anchor word: `נץ` means "at netz", i.e. offset 0.
    const anchor = matchAtStart<Zman>(rest, ANCHOR_PHRASES, true);
    if (anchor) {
      // `נץ` on its own means "at netz": offset 0. There is no sign to get
      // wrong here, so no signBasis is recorded.
      emitted.push({
        time: { kind: 'relative', anchor: anchor.value, offsetMinutes: 0 },
        season: pendingSeason,
        fromBareAnchor: true,
      });
      pendingSeason = null;
      rest = rest.slice(anchor.length);
      continue;
    }

    // 5. A clock time.
    const time = TIME_RE.exec(rest);
    if (time && time[1] !== undefined && time[2] !== undefined) {
      const hour = Number(time[1]);
      const minute = Number(time[2]);
      if (hour > 23 || minute > 59) {
        issues.push({ code: 'invalid_time', fragment: time[0] });
      } else {
        emitted.push({
          time: { kind: 'fixed', time: normaliseClock(hour, minute) },
          season: pendingSeason,
        });
        pendingSeason = null;
      }
      rest = rest.slice(time[0].length);
      continue;
    }

    // 6. `בזמן` — the honest unknown. Raw text preserved, never resolved.
    const unknown = matchAtStart(rest, words(UNKNOWN_MARKERS));
    if (unknown) {
      emitted.push({
        time: { kind: 'unknown', rawText: unknown.phrase },
        season: pendingSeason,
      });
      pendingSeason = null;
      rest = rest.slice(unknown.length);
      continue;
    }

    // 7. Nothing matched. Capture the run verbatim and keep going — loudly.
    //    The run stops at a separator so that one unknown word cannot swallow
    //    the times around it: `מנחה וערבית-18:00` must still yield 18:00 (for
    //    review), not lose it inside the fragment.
    const unrecognised = /^[^\s,\-]+/.exec(rest);
    const fragment = unrecognised ? unrecognised[0] : rest;
    issues.push({ code: 'unrecognized_text', fragment });
    rest = rest.slice(fragment.length);
  }

  return { emitted, issues };
}

/**
 * An explicit offset: `20 דק' לפי שקיעה` -> shkia -20.
 *
 * These are the most valuable rows in the whole dataset. They are the shape
 * every `בזמן` should eventually take, and the only rows where we know the rule
 * rather than merely knowing that a rule exists.
 */
function matchOffsetPhrase(text: string): {
  anchor: Zman;
  offsetMinutes: number;
  signBasis: SignBasis;
  length: number;
} | null {
  const num = /^(\d{1,3})\s*/.exec(text);
  if (!num || num[1] === undefined) return null;
  let cursor = num[0].length;
  const minutes = Number(num[1]);

  const minuteWord = matchAtStart(text.slice(cursor), words(MINUTE_WORDS));
  if (minuteWord) cursor += minuteWord.length;
  cursor += skipGap(text.slice(cursor));

  const prep = matchPreposition(text.slice(cursor));
  if (!prep) return null;
  cursor += prep.length;
  cursor += skipGap(text.slice(cursor));

  const anchor = matchAtStart<Zman>(text.slice(cursor), ANCHOR_PHRASES, true);
  if (!anchor) return null;
  cursor += anchor.length;

  return {
    anchor: anchor.value,
    offsetMinutes: prep.sign * minutes,
    signBasis: prep.signBasis,
    length: cursor,
  };
}

/** Whitespace and hyphens between the parts of an offset phrase. */
function skipGap(text: string): number {
  const m = /^[\s\-]*/.exec(text);
  return m ? m[0].length : 0;
}

/**
 * `לפני השקיעה` with no number. We know the anchor but NOT the offset.
 * That is `unknown` — not zero. Reading a missing number as 0 would be exactly
 * the invented offset this module exists to refuse.
 */
function matchBareDirection(text: string): { text: string; length: number } | null {
  const prep = matchPreposition(text);
  if (!prep) return null;
  let cursor = prep.length;
  cursor += skipGap(text.slice(cursor));
  const anchor = matchAtStart<Zman>(text.slice(cursor), ANCHOR_PHRASES, true);
  if (!anchor) return null;
  cursor += anchor.length;
  return { text: text.slice(0, cursor), length: cursor };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse one raw time field into the minyanim it encodes.
 *
 * One field routinely encodes several: `שחרית-6:30-7:30-9:00-10:00` is four,
 * `שחרית-נץ-7:00` is a netz-relative one plus a fixed one, `מנחה-13:30-13:55-בזמן`
 * is two known and one unknown.
 *
 * Returns a `ParseResult` rather than a bare array. That is a deliberate
 * departure from "returns the list of minyanim": a field can also carry a
 * status (`פתוח בחגים בלבד`), a shiur, and text we failed on. Returning only
 * the array would mean throwing the rest away silently, which is the one thing
 * this module is not allowed to do. `result.minyanim` is the list.
 *
 * @param raw     The field, verbatim, from the GIS layer or Religious Council.
 * @param context `dayType` comes from *which column* the string was read from.
 *                It is never inferred from the text. Omit it only if you truly
 *                do not know, and it will stay `null`.
 */
export function parseMinyanTimes(raw: string, context: ParseContext = {}): ParseResult {
  const dayType = context.dayType ?? null;
  const result: ParseResult = {
    raw,
    dayType,
    minyanim: [],
    statuses: [],
    shiurim: [],
    issues: [],
  };

  const text = normalise(raw ?? '');
  if (text.length === 0 || /^[\s,\-.]*$/.test(text)) {
    result.issues.push({
      code: 'empty_field',
      fragment: raw,
      message: 'Field is empty or punctuation only.',
      rawField: raw,
    });
    return result;
  }

  // Split on commas and semicolons. A trailing comma yields an empty segment,
  // which is punctuation and not a failure — `שחרית-6:30,` is one minyan.
  const segments = text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  /**
   * Sticky: once a segment in this field has been identified as a shiur, later
   * *unlabelled* segments belong to that shiur, not to a minyan
   * (`שיעור דף יומי, בימים א-ה בשעה 7:00` — the 7:00 is the class, not a
   * shacharit). Any segment carrying a real service label resets it.
   */
  let inShiur = false;
  let index = 0;

  for (const segment of segments) {
    const status = STATUS_PATTERNS.find(([re]) => re.test(segment));
    if (status) {
      result.statuses.push({ status: status[1], rawSegment: segment });
      continue;
    }

    if (SHIUR_MARKERS.some((re) => re.test(segment))) {
      inShiur = true;
      result.shiurim.push({ rawSegment: segment, times: lenientTimes(segment) });
      continue;
    }

    const label = matchServiceLabel(segment);

    if (inShiur && !label) {
      result.shiurim.push({ rawSegment: segment, times: lenientTimes(segment) });
      continue;
    }
    if (label) inShiur = false;

    const body = label ? segment.slice(label.consumed).trim() : segment;
    const { emitted, issues } = scanSegment(body);

    // A bare anchor read as offset 0 is only trustworthy when we understood
    // the whole segment. `מנחה כרבע שעה טרם השקיעה` ("about a quarter hour
    // before sunset") would otherwise become shkia+0 — a fabricated offset,
    // and a wrong one, because the words we failed on WERE the offset. When
    // anything in the segment is unparsed, such a time is downgraded to
    // `unknown` carrying the whole segment as its raw text. We would rather
    // say we do not know than say zero.
    if (issues.length > 0) {
      for (const item of emitted) {
        if (item.fromBareAnchor) {
          item.time = { kind: 'unknown', rawText: segment };
          delete item.signBasis;
        }
      }
    }

    if (emitted.length === 0 && issues.length === 0 && label?.fallbackAnchor) {
      // `מנחה גדולה` with nothing after it: the label was the time.
      emitted.push({
        time: { kind: 'relative', anchor: label.fallbackAnchor, offsetMinutes: 0 },
        season: null,
      });
    }

    const segmentReview: ReviewReason[] = [];
    for (const issue of issues) {
      result.issues.push({
        code: issue.code,
        fragment: issue.fragment,
        message:
          issue.code === 'invalid_time'
            ? `Not a valid clock time: "${issue.fragment}"`
            : `No rule matched "${issue.fragment}". Add it to the lexicon with a source, or leave it failing.`,
        rawField: raw,
      });
      segmentReview.push({ code: 'unparsed_text', detail: issue.fragment });
    }

    for (const item of emitted) {
      const needsReview: ReviewReason[] = [...segmentReview];
      if (!label) {
        // A bare time with no service word. We keep the time — it is a fact —
        // but we refuse to attribute it. In the חב"ד row `..., 21:00` follows a
        // Mincha segment; carrying Mincha over would publish a 21:00 Mincha,
        // and reading the clock to call it Arvit would be us deciding, not the
        // source. Neither is ours to do. It goes to a human.
        needsReview.push({
          code: 'unattributed_service',
          detail: `No service label for "${segment}" in "${text}"`,
        });
      }
      const service = label ? label.service : null;

      // A stated clock time is tested against the window its service can
      // actually occupy: `מנחה 1:30` is 13:30 because Mincha at 01:30 does not
      // exist. Only `fixed` times are candidates — a relative time carries no
      // clock face to misread, and an unknown has nothing to test.
      let time = item.time;
      let normalisation: ClockNormalisation | undefined;
      if (time.kind === 'fixed') {
        const verdict = judgeClock(time.time, service);
        if (verdict.normalisation) {
          time = { kind: 'fixed', time: verdict.time };
          normalisation = verdict.normalisation;
        }
        if (verdict.implausible) {
          needsReview.push({
            code: 'implausible_for_service',
            detail: verdict.implausible,
          });
        }
      }

      const minyan: ParsedMinyan = {
        service,
        time,
        season: item.season,
        dayType,
        rawSegment: segment,
        rawField: raw,
        index: index++,
        needsReview,
      };
      if (item.signBasis) minyan.signBasis = item.signBasis;
      if (normalisation) minyan.clockNormalisation = normalisation;
      result.minyanim.push(minyan);
    }
  }

  if (
    result.minyanim.length === 0 &&
    result.statuses.length === 0 &&
    result.shiurim.length === 0 &&
    result.issues.length === 0
  ) {
    result.issues.push({
      code: 'no_content_recognised',
      fragment: raw,
      message: 'Field had content but yielded no minyan, status or shiur.',
      rawField: raw,
    });
  }

  return result;
}

interface ServiceLabel {
  service: Service;
  consumed: number;
  /**
   * Set when the label itself names a zman (`מנחה גדולה`). If the segment turns
   * out to carry no other time, THAT is the time. Used only as a fallback — we
   * never emit it alongside a clock time, because `מנחה גדולה 13:00` is one
   * minyan at 13:00, not a 13:00 minyan plus a phantom one at mincha gedola.
   */
  fallbackAnchor?: Zman;
}

/** Service label, only at the start of a segment. */
function matchServiceLabel(segment: string): ServiceLabel | null {
  const zmanLabel = /^מנחה\s+(גדולה|קטנה)/.exec(segment);
  if (zmanLabel) {
    return {
      service: 'mincha',
      consumed: zmanLabel[0].length,
      fallbackAnchor: zmanLabel[1] === 'גדולה' ? 'mincha_gedola' : 'mincha_ketana',
    };
  }
  const label = matchAtStart<Service>(segment, SERVICE_LABELS);
  if (!label) return null;
  return { service: label.value, consumed: label.length };
}

/**
 * Times inside a shiur line. Lenient by design: we are not going to publish
 * these as minyanim, so unrecognised prose around them is not a failure.
 */
function lenientTimes(segment: string): MinyanTime[] {
  const out: MinyanTime[] = [];
  const re = /(\d{1,2})[:.](\d{2})(?![:.\d])/g;
  for (const m of segment.matchAll(re)) {
    if (m[1] === undefined || m[2] === undefined) continue;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour <= 23 && minute <= 59) {
      out.push({ kind: 'fixed', time: normaliseClock(hour, minute) });
    }
  }
  return out;
}

/** Convenience for callers that only want the list and have handled `issues`. */
export function minyanimOnly(raw: string, context: ParseContext = {}): ParsedMinyan[] {
  return parseMinyanTimes(raw, context).minyanim;
}

/** True when a record is safe to show a user. Non-empty review ⇒ never. */
export function isPublishable(minyan: ParsedMinyan): boolean {
  return minyan.needsReview.length === 0;
}
