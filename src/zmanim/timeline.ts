/**
 * "Where can I daven in the next 40 minutes?"
 *
 * This is the feature the product exists for, and the one thing every other
 * minyan directory gets wrong. LA Jewish Times stores `"~25 Min before Netz"`
 * as text, so those minyanim cannot be sorted into a timeline and their
 * next-minyan feature simply cannot see them. Ours resolves the rule.
 *
 * ---------------------------------------------------------------------------
 * TWO LISTS, NOT ONE — and that is the honest shape
 * ---------------------------------------------------------------------------
 * 12 of our 16 shuls say only `בזמן` for Mincha. They have a Mincha. We do not
 * know when. Dropping them empties the afternoon; guessing an offset is the
 * one unrecoverable mistake. So the result carries:
 *
 *   `upcoming`    — resolved instants, sorted. A real timeline.
 *   `unconfirmed` — "davens Mincha here, time unconfirmed", with the halachic
 *                   window for that service on that day. Deliberately NOT
 *                   sorted into `upcoming`: a thing with no time cannot have a
 *                   position among things that do, and forcing it into one
 *                   would be the fabrication we are avoiding.
 *
 * An unconfirmed entry carries `serviceWindow` — e.g. mincha gedola to shkia.
 * That is a fact about the day, computed by the library, not a claim about
 * this shul. It is what makes "we don't know" actionable instead of merely
 * honest: it is why the entry appears at 16:00 and not at 06:00.
 *
 * ---------------------------------------------------------------------------
 * Pure by construction
 * ---------------------------------------------------------------------------
 * Rows come in as an argument. No database, no `new Date()` — `now` is passed.
 * That is what lets the whole engine be tested at midwinter, at midsummer, on
 * both DST mornings and in Adar II without a clock or a Postgres.
 */
import type { Location } from '@hebcal/core';
import type { DayType, MinyanTime, Season, Service, Zman } from '../minyan-times/index.ts';
import type { DayZmanim, HebrewDay } from './day.ts';
import { hebrewDayAt, zmanimFor } from './day.ts';
import { addDays, dayOfWeek, isoDate, jerusalemDateOf, type JerusalemDate } from './jerusalem-date.ts';
import { isResolved, resolveAgainstDay, resolveMinyanTime, type ResolutionBasis } from './resolve.ts';
import { windowsBetween, type DayPhase, type DayWindow } from './windows.ts';

/* ------------------------------------------------------------------ */
/* Inputs — structural, so this module never imports the database      */
/* ------------------------------------------------------------------ */

/**
 * The minimum a row must be for the timeline to place it. `Minyan` from
 * `src/db/queries.ts` satisfies this structurally; the timeline deliberately
 * does not import it, because `pg` must not be dragged into a module that
 * `node --test` loads without a database.
 */
export interface TimelineMinyan {
  id: number;
  service: Service | null;
  dayType: DayType | null;
  season: Season | null;
  time: MinyanTime;
  isPublishable: boolean;
}

export interface TimelineSynagogue {
  id: number;
  slug: string;
  nameHe: string;
  nameEn: string | null;
  addressHe: string | null;
  addressEn: string | null;
  lat: number;
  lng: number;
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  minyanim: readonly TimelineMinyan[];
}

/* ------------------------------------------------------------------ */
/* Outputs                                                             */
/* ------------------------------------------------------------------ */

interface Placed {
  synagogue: TimelineSynagogue;
  minyan: TimelineMinyan;
  service: Service;
  dayType: DayType;
  phase: DayPhase;
  date: JerusalemDate;
  hebrewDate: HebrewDay;
}

export interface UpcomingMinyan extends Placed {
  /** The moment the minyan starts. Minute-aligned, Asia/Jerusalem. */
  instant: Date;
  /** The same moment as a wall clock, "HH:MM". Print this, never a Date. */
  clock: string;
  minutesFromNow: number;
  /** The rule that produced it. Keep showing the rule — it is the honest thing. */
  basis: ResolutionBasis;
  /** Shkia on this minyan's day. */
  shkia: Date;
  /**
   * Minutes from `now` until that shkia; negative once shkia has passed.
   *
   * This is the DATA behind CLAUDE.md's signature detail — Mincha listings
   * warming toward the sunset colour as the window closes. The curve that
   * turns it into a colour lives in `src/lib/sunset-warmth.ts` and stays out
   * of here, so the engine has no opinion about paint. There is no toggle: a
   * real site computes this, it does not offer a button that makes it evening.
   */
  minutesUntilShkia: number;
}

export type UnconfirmedReason =
  /** The source said `בזמן`. Never resolved, never guessed. */
  | { code: 'unknown_offset'; rawText: string }
  /** Erev Shabbat: Mincha and Arvit move to candle lighting and the source
   *  never said to when. The shul davens; the time is not ours to state. */
  | { code: 'erev_shabbat_time_unstated' }
  /** Erev Yom Tov, same reasoning as erev Shabbat. */
  | { code: 'erev_yom_tov_time_unstated'; yomTov: string }
  /** A Yom Tov schedule is neither the weekday nor the Shabbat column. */
  | { code: 'yom_tov_schedule_unknown'; yomTov: string }
  /** `כניסת שבת`-relative on a date with no candle lighting. */
  | { code: 'anchor_not_on_this_date'; anchor: Zman }
  | { code: 'zman_not_computable'; anchor: Zman };

export interface UnconfirmedMinyan extends Placed {
  reason: UnconfirmedReason;
  /**
   * The halachic window for this service on this date — mincha gedola to
   * shkia, and so on. A fact about the day from the zmanim library, NOT a
   * claim about when this shul davens. It exists so the entry can surface at
   * the right time of day instead of all day.
   */
  serviceWindow: { from: Date; to: Date };
}

export interface Timeline {
  now: Date;
  until: Date;
  /** Resolved, ascending by instant. */
  upcoming: UpcomingMinyan[];
  /** Has a service and a place, has no time. Ascending by service window. */
  unconfirmed: UnconfirmedMinyan[];
  /** Zmanim for the calendar square `now` falls on. */
  today: DayZmanim;
  /** The Hebrew date at `now` — rolled at shkia, not at midnight. */
  hebrewNow: HebrewDay;
  /** The window `now` is in, so a caller can say "Shabbat" without recomputing. */
  phase: DayPhase;
}

export interface NextMinyanimOptions {
  now: Date;
  /** How far ahead to look, in minutes. */
  within: number;
  /** Restrict to these services. Omitted = all three. */
  services?: readonly Service[];
  location: Location;
  synagogues: readonly TimelineSynagogue[];
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

type Placement =
  | { at: 'resolve' }
  | { at: 'unconfirmed'; reason: UnconfirmedReason }
  | { at: 'absent' };

const RESOLVE: Placement = { at: 'resolve' };
const ABSENT: Placement = { at: 'absent' };

/** A `כניסת שבת`-anchored rule is unambiguously the erev-Shabbat minyan. */
/**
 * A PROXY for "this Shabbat-column row is really an erev-Shabbat time", used
 * only where the source never separated the two days.
 *
 * It is a proxy and not a fact: an erev-Shabbat Mincha can be anchored to
 * anything, and כלל ישראל's is `shkia − 20`. Where the source DOES separate
 * them, `dayType: 'erev_shabbat'` says so outright and this is never consulted.
 * Do not extend this function to recognise more anchors — that is guessing the
 * day from the time, which is what went wrong.
 */
function isCandleLightingRule(time: MinyanTime): boolean {
  return time.kind === 'relative' && time.anchor === 'candle_lighting';
}

/**
 * Which period of the week a stored row governs.
 *
 * The Shabbat column is the awkward one: it holds Shacharit (Saturday
 * morning, unambiguous), Mincha (Friday evening or Saturday afternoon — the
 * source does not say) and Arvit (Friday night or motzaei Shabbat — likewise).
 * The rules chosen:
 *
 *  - Shabbat Shacharit  -> Saturday morning only.
 *  - Shabbat Mincha     -> Saturday afternoon, UNLESS it is anchored to
 *                          candle lighting, which can only be Friday.
 *                          On Friday afternoon it also surfaces, unconfirmed.
 *  - Shabbat Arvit      -> Friday night. On a shul sign, `ערבית` beside the
 *                          erev-Shabbat Mincha is Friday night; motzaei
 *                          Shabbat is written out as `ערבית מוצ״ש`.
 *                          TODO: our 16 shuls have no Arvit row at all, so
 *                          this rule is untested against real data. Revisit
 *                          when the Kfar Shalem import lands.
 */
function basePlacement(minyan: TimelineMinyan, service: Service, window: DayWindow): Placement {
  const column = minyan.dayType;

  if (column === 'weekday') {
    switch (window.phase) {
      case 'weekday':
      case 'motzaei_shabbat':
        return RESOLVE;
      case 'erev_shabbat':
        // Friday morning already happened in Friday's weekday window.
        if (service === 'shacharit') return ABSENT;
        // The heart of the Friday decision: this shul DOES daven Mincha on
        // erev Shabbat. The 14:00 on the door is not when.
        return { at: 'unconfirmed', reason: { code: 'erev_shabbat_time_unstated' } };
      case 'shabbat':
        return ABSENT;
    }
  }

  // Stated by the source, so nothing has to be guessed from the anchor. This
  // is the case the `isCandleLightingRule` proxy below was standing in for, and
  // it exists because that proxy got a real minyan wrong: correcting כלל
  // ישראל's erev-Shabbat Mincha from the municipality's candle_lighting − 10 to
  // the sheet's shkia − 20 moved it from Friday to Saturday, and the page
  // offered it "in a day" when it was ninety minutes off.
  if (column === 'erev_shabbat') {
    return window.phase === 'erev_shabbat' ? RESOLVE : ABSENT;
  }

  if (column === 'shabbat') {
    switch (window.phase) {
      case 'shabbat':
        if (service === 'arvit') return ABSENT;
        if (service === 'mincha' && isCandleLightingRule(minyan.time)) return ABSENT;
        return RESOLVE;
      case 'erev_shabbat':
        if (service === 'shacharit') return ABSENT;
        if (service === 'arvit') return RESOLVE;
        if (isCandleLightingRule(minyan.time)) return RESOLVE;
        return { at: 'unconfirmed', reason: { code: 'erev_shabbat_time_unstated' } };
      case 'weekday':
      case 'motzaei_shabbat':
        return ABSENT;
    }
  }

  // day_type NULL. Such a row is never publishable, so this is unreachable in
  // practice; being explicit beats falling through to a resolve.
  return ABSENT;
}

/** Yom Tov and erev Yom Tov demote a resolution; they never create one. */
function applyCalendarOverrides(
  placement: Placement,
  service: Service,
  window: DayWindow,
  location: Location,
): Placement {
  if (placement.at === 'absent') return placement;

  const { yomTov, candle_lighting } = window.zmanim;

  if (yomTov !== null) {
    // Neither column is a Yom Tov schedule. A 06:30 weekday Shacharit on Rosh
    // Hashana is not merely stale, it is wrong, and someone acts on it.
    return { at: 'unconfirmed', reason: { code: 'yom_tov_schedule_unknown', yomTov } };
  }

  // Candle lighting on a day that is not Friday means erev Yom Tov: Mincha and
  // Arvit move, exactly as they do on erev Shabbat.
  if (
    candle_lighting !== null &&
    dayOfWeek(window.date) !== FRIDAY &&
    (service === 'mincha' || service === 'arvit')
  ) {
    const tomorrow = zmanimFor(location, addDays(window.date, 1));
    return {
      at: 'unconfirmed',
      reason: {
        code: 'erev_yom_tov_time_unstated',
        yomTov: tomorrow.yomTov ?? 'Yom Tov',
      },
    };
  }

  return placement;
}

/* ------------------------------------------------------------------ */
/* Service windows                                                     */
/* ------------------------------------------------------------------ */

/**
 * The halachic span in which a service can be davened on a given day.
 *
 * Used ONLY to decide whether an unconfirmed entry is worth showing right now.
 * It is never presented as this shul's time and never sorted into `upcoming`.
 *
 *   shacharit  alot .. chatzot          (b'dieved bound; many shuls run to 10:00)
 *   mincha     mincha gedola .. shkia
 *   arvit      plag .. chatzot of the following night
 */
function serviceWindow(service: Service, day: DayZmanim): { from: Date; to: Date } {
  switch (service) {
    case 'shacharit':
      return { from: day.alot, to: day.chatzot };
    case 'mincha':
      return { from: day.mincha_gedola, to: day.shkia };
    case 'arvit':
      return { from: day.plag, to: day.chatzot_night_after };
  }
}

function overlaps(a: { from: Date; to: Date }, b: { from: Date; to: Date }): boolean {
  return a.from.getTime() <= b.to.getTime() && b.from.getTime() <= a.to.getTime();
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

const ALL_SERVICES: readonly Service[] = ['shacharit', 'mincha', 'arvit'];

/** 0 = Sunday. */
const FRIDAY = 5;

/** More specific reasons win when one shul yields several for the same slot. */
const REASON_RANK: Record<UnconfirmedReason['code'], number> = {
  yom_tov_schedule_unknown: 0,
  erev_yom_tov_time_unstated: 1,
  erev_shabbat_time_unstated: 2,
  anchor_not_on_this_date: 3,
  zman_not_computable: 4,
  unknown_offset: 5,
};

export function nextMinyanim(options: NextMinyanimOptions): Timeline {
  const { now, within, location, synagogues } = options;
  const services = options.services ?? ALL_SERVICES;
  const until = new Date(now.getTime() + within * 60_000);

  const upcoming: UpcomingMinyan[] = [];
  const unconfirmedByKey = new Map<string, UnconfirmedMinyan>();
  /**
   * Slots for which some row DID resolve on its own day, whether or not the
   * result fell inside the horizon. Used to suppress a redundant "time
   * unconfirmed" beside a time we actually know — see `CALENDAR_MOVED`.
   */
  const slotsWithAKnownTime = new Set<string>();

  for (const window of windowsBetween(location, now, until)) {
    const hebrewDate = hebrewDayAt(location, window.from);

    for (const synagogue of synagogues) {
      for (const minyan of synagogue.minyanim) {
        // Not confirmed is not shown. The gate is computed in the database.
        if (!minyan.isPublishable) continue;
        const service = minyan.service;
        const column = minyan.dayType;
        if (service === null || column === null) continue;
        if (!services.includes(service)) continue;
        // `ח` / `ק`: the winter and summer faces of one minyan must never
        // both appear on the same day.
        if (minyan.season !== null && minyan.season !== window.season) continue;

        // `basePlacement` is the ONLY authority on which column governs which
        // period. Filtering on `dayType` here as well would look harmless and
        // would silently delete the erev-Shabbat case: a weekday row has to
        // reach `basePlacement` in the `erev_shabbat` window in order to be
        // demoted to unconfirmed rather than dropped.
        const placement = applyCalendarOverrides(
          basePlacement(minyan, service, window),
          service,
          window,
          location,
        );
        if (placement.at === 'absent') continue;

        const placed: Placed = {
          synagogue,
          minyan,
          service,
          dayType: column,
          phase: window.phase,
          date: window.date,
          hebrewDate,
        };

        if (placement.at === 'unconfirmed') {
          addUnconfirmed(unconfirmedByKey, placed, placement.reason, window, now, until);
          continue;
        }

        const resolved =
          minyan.time.kind === 'relative'
            ? resolveAgainstDay(minyan.time.anchor, minyan.time.offsetMinutes, window.zmanim)
            : resolveMinyanTime(minyan.time, window.date, location);

        if (!isResolved(resolved)) {
          addUnconfirmed(unconfirmedByKey, placed, resolved.reason, window, now, until);
          continue;
        }

        const at = resolved.instant.getTime();
        // Containment in the window is what keeps a weekday 14:00 Mincha off
        // Friday afternoon: Friday's weekday window closes at chatzot.
        if (at < window.from.getTime() || at >= window.to.getTime()) continue;
        slotsWithAKnownTime.add(slotKey(placed));
        if (at < now.getTime() || at > until.getTime()) continue;

        upcoming.push({
          ...placed,
          instant: resolved.instant,
          clock: resolved.clock,
          minutesFromNow: Math.round((at - now.getTime()) / 60_000),
          basis: resolved.basis,
          shkia: window.zmanim.shkia,
          minutesUntilShkia: Math.round(
            (window.zmanim.shkia.getTime() - now.getTime()) / 60_000,
          ),
        });
      }
    }
  }

  upcoming.sort(
    (a, b) =>
      a.instant.getTime() - b.instant.getTime() ||
      a.synagogue.nameHe.localeCompare(b.synagogue.nameHe, 'he'),
  );

  const unconfirmed = [...unconfirmedByKey.values()]
    .filter(
      // "Mincha moves on erev Shabbat and the source never said to when" is
      // worth saying — unless this shul DID say, in which case repeating it
      // next to the time we know reads as doubt about the time we know.
      // `unknown_offset` is not filtered: `מנחה-13:00-בזמן` is two minyanim,
      // and the second one really is an extra Mincha with no stated time.
      (entry) =>
        !(CALENDAR_MOVED.has(entry.reason.code) && slotsWithAKnownTime.has(slotKey(entry))),
    )
    .sort(
    (a, b) =>
      a.serviceWindow.from.getTime() - b.serviceWindow.from.getTime() ||
      a.synagogue.nameHe.localeCompare(b.synagogue.nameHe, 'he'),
  );

  const todayDate = jerusalemDateOf(now);
  return {
    now,
    until,
    upcoming,
    unconfirmed,
    today: zmanimFor(location, todayDate),
    hebrewNow: hebrewDayAt(location, now),
    phase: phaseAt(location, now),
  };
}

/** One shul, one service, one period of one day. */
function slotKey(placed: Placed): string {
  return `${placed.synagogue.id}|${placed.service}|${placed.phase}|${isoDate(placed.date)}`;
}

/** Reasons that mean "the calendar moved this", not "there is an extra minyan". */
const CALENDAR_MOVED: ReadonlySet<UnconfirmedReason['code']> = new Set([
  'erev_shabbat_time_unstated',
  'erev_yom_tov_time_unstated',
]);

function addUnconfirmed(
  into: Map<string, UnconfirmedMinyan>,
  placed: Placed,
  reason: UnconfirmedReason,
  window: DayWindow,
  now: Date,
  until: Date,
): void {
  const span = serviceWindow(placed.service, window.zmanim);
  // Only when the service could plausibly be happening in the horizon asked
  // about. Without this every `בזמן` Mincha appears at six in the morning.
  if (!overlaps(span, { from: now, to: until })) return;

  // One shul davening one service in one period is ONE unconfirmed entry, no
  // matter how many rows produced it (`מנחה-13:00-בזמן` is two rows).
  const key = slotKey(placed);
  const existing = into.get(key);
  if (existing && REASON_RANK[existing.reason.code] <= REASON_RANK[reason.code]) return;

  into.set(key, { ...placed, reason, serviceWindow: span });
}

function phaseAt(location: Location, instant: Date): DayPhase {
  for (const window of windowsBetween(location, instant, instant)) {
    if (instant.getTime() >= window.from.getTime() && instant.getTime() < window.to.getTime()) {
      return window.phase;
    }
  }
  return 'weekday';
}
