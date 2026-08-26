/**
 * The timeline — "where can I daven in the next 40 minutes?"
 *
 * The fixtures below are the real Ramat Aviv shapes, transcribed from the rows
 * the importer actually produced: a shul whose Mincha is only `בזמן`, a shul
 * whose Mincha is `20 דק' לפי שקיעה`, one with `נץ` and a fixed 07:00 in the
 * same field, one with `מנחה-13:00-בזמן` (two Minchas, one of them unknown),
 * and the winter/summer pair `ח 12:30 ק 13:30`.
 *
 * The load-bearing test in this file is `a shul with only unknown times still
 * appears`. 12 of our 16 shuls are in exactly that state; a timeline that
 * drops them has an empty afternoon and no reason to exist.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DayType, MinyanTime, Season, Service } from '../src/minyan-times/index.ts';
import {
  instantOfClockTime,
  nextMinyanim,
  TEL_AVIV,
  zmanimFor,
  type TimelineMinyan,
  type TimelineSynagogue,
  type JerusalemDate,
} from '../src/zmanim/index.ts';

function date(iso: string): JerusalemDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

let nextId = 1;
function minyan(
  service: Service,
  dayType: DayType,
  time: MinyanTime,
  extra: { season?: Season; isPublishable?: boolean } = {},
): TimelineMinyan {
  return {
    id: nextId++,
    service,
    dayType,
    season: extra.season ?? null,
    time,
    isPublishable: extra.isPublishable ?? true,
  };
}

function shul(nameHe: string, minyanim: TimelineMinyan[]): TimelineSynagogue {
  return {
    id: nextId++,
    slug: `s-${nextId}`,
    nameHe,
    nameEn: null,
    addressHe: null,
    addressEn: null,
    lat: 32.11,
    lng: 34.79,
    lastVerifiedAt: null,
    verifiedBy: null,
    minyanim,
  };
}

/* --- the real Ramat Aviv shapes ------------------------------------- */

/** `שחרית-6:00` / `מנחה-בזמן` — the commonest shape in the source by far. */
const HARAMBAM = shul('הרמב"ם', [
  minyan('shacharit', 'weekday', { kind: 'fixed', time: '06:00' }),
  minyan('mincha', 'weekday', { kind: 'unknown', rawText: 'בזמן' }),
  minyan('shacharit', 'shabbat', { kind: 'fixed', time: '07:00' }),
  minyan('mincha', 'shabbat', { kind: 'unknown', rawText: 'בזמן' }),
]);

/** `מנחה 20 דק' לפי שקיעה` and `מנחה - 10 דק' לפי כניסת שבת`. */
const LICHLAL_YISRAEL = shul('לכלל ישראל', [
  minyan('shacharit', 'weekday', { kind: 'fixed', time: '06:25' }),
  minyan('mincha', 'weekday', { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 }),
  minyan('shacharit', 'shabbat', { kind: 'fixed', time: '08:00' }),
  minyan('mincha', 'shabbat', {
    kind: 'relative',
    anchor: 'candle_lighting',
    offsetMinutes: -10,
  }),
]);

/** `שחרית-נץ-7:00` = two minyanim, and `מנחה-13:00-בזמן` = two more. */
const TEHILAT_AVIV = shul('תהילת אביב', [
  minyan('shacharit', 'weekday', { kind: 'relative', anchor: 'netz', offsetMinutes: 0 }),
  minyan('shacharit', 'weekday', { kind: 'fixed', time: '07:00' }),
  minyan('mincha', 'weekday', { kind: 'fixed', time: '13:00' }),
  minyan('mincha', 'weekday', { kind: 'unknown', rawText: 'בזמן' }),
]);

/** `ח 12:30 ק 13:30` — one minyan with two clock faces. */
const SEASONAL = shul('עונתי', [
  minyan('mincha', 'weekday', { kind: 'fixed', time: '12:30' }, { season: 'winter' }),
  minyan('mincha', 'weekday', { kind: 'fixed', time: '13:30' }, { season: 'summer' }),
]);

/** Never publishable: the source gave a bare time with no service word. */
const UNREVIEWED = shul('טעון בדיקה', [
  minyan('shacharit', 'weekday', { kind: 'fixed', time: '06:05' }, { isPublishable: false }),
]);

const ALL = [HARAMBAM, LICHLAL_YISRAEL, TEHILAT_AVIV, SEASONAL, UNREVIEWED];

/**
 * "14:00 in Tel Aviv on this date", built with the engine's own clock helper —
 * which is itself tested against absolute UTC instants and both DST changeovers
 * in `jerusalem-clock.test.ts`. Constructing it any other way here would make
 * the test and the code disagree about what a wall clock is.
 */
function at(iso: string, clock: string): Date {
  return instantOfClockTime(date(iso), clock);
}

function run(iso: string, clock: string, within: number, services?: readonly Service[]) {
  return nextMinyanim({
    now: at(iso, clock),
    within,
    location: TEL_AVIV,
    synagogues: ALL,
    ...(services ? { services } : {}),
  });
}

const names = (rows: Array<{ synagogue: TimelineSynagogue }>) =>
  rows.map((r) => r.synagogue.nameHe);

/* -------------------------------------------------------------------- */

describe('the timeline sorts resolved minyanim by real instant', () => {
  it('puts a netz-relative Shacharit in its true place among fixed ones', () => {
    // 2026-08-25 is a Tuesday. Netz is about 06:11, so the order must be
    // הרמב"ם 06:00, לכלל ישראל 06:25, תהילת אביב netz, תהילת אביב 07:00 —
    // with netz sorted BETWEEN two clock times, which is the whole point.
    const timeline = run('2026-08-25', '05:00', 180, ['shacharit']);
    const clocks = timeline.upcoming.map((u) => u.clock);
    const sorted = [...clocks].sort();
    assert.deepEqual(clocks, sorted, clocks.join(' '));
    assert.ok(clocks.includes('06:00'));
    assert.ok(clocks.includes('07:00'));
    // The netz minyan is in there, as a number, not as the word "netz".
    assert.ok(clocks.some((c) => c > '06:00' && c < '06:25'), clocks.join(' '));
  });

  it('reports minutes from now, counted from the instant it resolved', () => {
    const timeline = run('2026-08-25', '05:00', 180, ['shacharit']);
    for (const row of timeline.upcoming) {
      const expected = Math.round((row.instant.getTime() - timeline.now.getTime()) / 60_000);
      assert.equal(row.minutesFromNow, expected);
      assert.ok(row.minutesFromNow >= 0);
    }
  });

  it('honours the horizon: nothing beyond `within`', () => {
    const timeline = run('2026-08-25', '05:00', 40, ['shacharit']);
    for (const row of timeline.upcoming) assert.ok(row.minutesFromNow <= 40);
    assert.ok(timeline.upcoming.every((r) => r.instant <= timeline.until));
  });

  it('never returns a minyan that has already started', () => {
    const timeline = run('2026-08-25', '06:30', 240, ['shacharit']);
    assert.equal(timeline.upcoming.some((r) => r.clock === '06:00'), false);
    assert.equal(timeline.upcoming.some((r) => r.clock === '06:25'), false);
    assert.ok(timeline.upcoming.some((r) => r.clock === '07:00'));
  });
});

describe('a shul with only unknown times still appears', () => {
  // THE test. 12 of 16 shuls are `מנחה-בזמן` and dropping them empties the
  // afternoon — which is when most people actually need this product.
  it('surfaces הרמב"ם for Mincha even though its time is only בזמן', () => {
    const timeline = run('2026-08-25', '15:00', 120, ['mincha']);
    assert.equal(
      timeline.upcoming.some((r) => r.synagogue === HARAMBAM),
      false,
      'an unknown must never be given an instant',
    );
    assert.ok(names(timeline.unconfirmed).includes('הרמב"ם'));
  });

  it('says why, and keeps the raw source text', () => {
    const timeline = run('2026-08-25', '15:00', 120, ['mincha']);
    const row = timeline.unconfirmed.find((r) => r.synagogue === HARAMBAM);
    assert.ok(row);
    assert.deepEqual(row.reason, { code: 'unknown_offset', rawText: 'בזמן' });
  });

  it('carries the halachic Mincha window — a fact about the day, not about the shul', () => {
    const timeline = run('2026-08-25', '15:00', 120, ['mincha']);
    const row = timeline.unconfirmed.find((r) => r.synagogue === HARAMBAM);
    assert.ok(row);
    const day = zmanimFor(TEL_AVIV, date('2026-08-25'));
    assert.equal(row.serviceWindow.from.getTime(), day.mincha_gedola.getTime());
    assert.equal(row.serviceWindow.to.getTime(), day.shkia.getTime());
  });

  it('does not shout about an afternoon Mincha at six in the morning', () => {
    const timeline = run('2026-08-25', '05:00', 120, ['mincha']);
    assert.deepEqual(timeline.unconfirmed, []);
  });

  it('keeps the EXTRA unknown Mincha beside the one time we do know', () => {
    // `מנחה-13:00-בזמן` is two minyanim. The 13:00 is a time; the second is a
    // real additional Mincha whose time we do not have. Both must show.
    const timeline = run('2026-08-25', '12:00', 180, ['mincha']);
    assert.ok(timeline.upcoming.some((r) => r.synagogue === TEHILAT_AVIV && r.clock === '13:00'));
    assert.ok(timeline.unconfirmed.some((r) => r.synagogue === TEHILAT_AVIV));
  });
});

describe('day_type is respected', () => {
  it('does not surface a Shabbat minyan on a Tuesday', () => {
    const timeline = run('2026-08-25', '05:00', 300);
    assert.equal(timeline.upcoming.some((r) => r.dayType === 'shabbat'), false);
    assert.equal(timeline.unconfirmed.some((r) => r.dayType === 'shabbat'), false);
  });

  it('does not surface a weekday minyan on Shabbat morning', () => {
    const timeline = run('2026-08-29', '05:00', 300);
    assert.equal(timeline.upcoming.some((r) => r.dayType === 'weekday'), false);
    assert.ok(timeline.upcoming.some((r) => r.clock === '07:00'), 'Shabbat 07:00 must show');
    assert.ok(timeline.upcoming.some((r) => r.clock === '08:00'));
  });

  it('brings the weekday column back after tzeit on Saturday night', () => {
    const day = zmanimFor(TEL_AVIV, date('2026-08-29'));
    const timeline = nextMinyanim({
      now: new Date(day.tzeit.getTime() + 5 * 60_000),
      // Far enough to reach Sunday morning: tzeit is 19:46 in late August.
      within: 800,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    assert.equal(timeline.phase, 'motzaei_shabbat');
    // Sunday morning's weekday Shacharit is now the next thing.
    assert.ok(timeline.upcoming.some((r) => r.dayType === 'weekday' && r.clock === '06:00'));
  });
});

describe('Friday: the deliberate decision', () => {
  const FRIDAY = '2026-08-28';

  it('Friday morning is a weekday morning — the weekday Shacharit resolves', () => {
    const timeline = run(FRIDAY, '05:00', 180, ['shacharit']);
    assert.equal(timeline.phase, 'weekday');
    assert.ok(timeline.upcoming.some((r) => r.clock === '06:00' && r.dayType === 'weekday'));
  });

  it('Friday afternoon does NOT show the weekday Mincha clock time', () => {
    // תהילת אביב davens weekday Mincha at 13:00. On Friday it does not.
    const timeline = run(FRIDAY, '12:00', 300, ['mincha']);
    assert.equal(
      timeline.upcoming.some((r) => r.clock === '13:00'),
      false,
      'a weekday 13:00 Mincha must not surface on erev Shabbat',
    );
  });

  it('but the shul does not vanish — it appears as "time unconfirmed"', () => {
    const timeline = run(FRIDAY, '14:00', 300, ['mincha']);
    const row = timeline.unconfirmed.find((r) => r.synagogue === TEHILAT_AVIV);
    assert.ok(row, 'a shul that davens Mincha on erev Shabbat must still appear');
    assert.equal(row.reason.code, 'erev_shabbat_time_unstated');
    assert.equal(row.phase, 'erev_shabbat');
  });

  it('a כניסת שבת-relative Mincha resolves on Friday, and only on Friday', () => {
    const timeline = run(FRIDAY, '12:00', 480, ['mincha']);
    const row = timeline.upcoming.find((r) => r.synagogue === LICHLAL_YISRAEL);
    assert.ok(row, 'candle-lighting Mincha must resolve on erev Shabbat');
    const day = zmanimFor(TEL_AVIV, date(FRIDAY));
    assert.ok(day.candle_lighting);
    assert.equal((day.candle_lighting.getTime() - row.instant.getTime()) / 60_000, 10);

    // Saturday afternoon is a different minyan and we were not told when it is.
    const saturday = run('2026-08-29', '14:00', 300, ['mincha']);
    assert.equal(saturday.upcoming.some((r) => r.synagogue === LICHLAL_YISRAEL), false);
  });

  it('does not repeat "unconfirmed" for a shul whose erev-Shabbat time we know', () => {
    const timeline = run(FRIDAY, '14:00', 300, ['mincha']);
    assert.equal(
      timeline.unconfirmed.some((r) => r.synagogue === LICHLAL_YISRAEL),
      false,
      'we know their erev-Shabbat Mincha; saying "unconfirmed" beside it reads as doubt',
    );
  });

  it('the Shabbat Shacharit does not appear on Friday', () => {
    const timeline = run(FRIDAY, '05:00', 300, ['shacharit']);
    assert.equal(timeline.upcoming.some((r) => r.dayType === 'shabbat'), false);
  });

  it('one shul, one service, one period is one unconfirmed row however many rows fed it', () => {
    // תהילת אביב has TWO weekday Mincha rows (13:00 and בזמן). On Friday both
    // are demoted, and the reader must not see the same shul twice.
    const timeline = run(FRIDAY, '14:00', 300, ['mincha']);
    const rows = timeline.unconfirmed.filter((r) => r.synagogue === TEHILAT_AVIV);
    assert.equal(rows.length, 1);
  });
});

describe('sunset rollover', () => {
  const FRIDAY = '2026-08-28';

  it('the Hebrew date has rolled an hour after shkia while the civil date has not', () => {
    const day = zmanimFor(TEL_AVIV, date(FRIDAY));
    const before = nextMinyanim({
      now: new Date(day.shkia.getTime() - 3_600_000),
      within: 60,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    const after = nextMinyanim({
      now: new Date(day.shkia.getTime() + 3_600_000),
      within: 60,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    assert.equal(after.hebrewNow.day, before.hebrewNow.day + 1);
    assert.equal(after.today.date.day, before.today.date.day, 'still the same civil date');
  });

  it('Shabbat has begun after shkia on Friday, by the halachic clock', () => {
    const day = zmanimFor(TEL_AVIV, date(FRIDAY));
    const timeline = nextMinyanim({
      now: new Date(day.shkia.getTime() + 60_000),
      within: 60,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    assert.equal(timeline.phase, 'erev_shabbat');
    // The Shabbat column governs, so no weekday minyan can surface.
    assert.equal(timeline.upcoming.some((r) => r.dayType === 'weekday'), false);
  });

  it('Shabbat ends at tzeit on Saturday, not at midnight', () => {
    const day = zmanimFor(TEL_AVIV, date('2026-08-29'));
    const before = nextMinyanim({
      now: new Date(day.tzeit.getTime() - 60_000),
      within: 30,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    const after = nextMinyanim({
      now: new Date(day.tzeit.getTime() + 60_000),
      within: 30,
      location: TEL_AVIV,
      synagogues: ALL,
    });
    assert.equal(before.phase, 'shabbat');
    assert.equal(after.phase, 'motzaei_shabbat');
  });
});

describe('season: the winter and summer faces never appear on the same day', () => {
  it('shows only the summer face in August', () => {
    const timeline = run('2026-08-25', '11:00', 240, ['mincha']);
    const rows = timeline.upcoming.filter((r) => r.synagogue === SEASONAL);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.clock, '13:30');
    assert.equal(rows[0]!.minyan.season, 'summer');
  });

  it('shows only the winter face in January', () => {
    const timeline = run('2026-01-13', '11:00', 240, ['mincha']);
    const rows = timeline.upcoming.filter((r) => r.synagogue === SEASONAL);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.clock, '12:30');
    assert.equal(rows[0]!.minyan.season, 'winter');
  });

  it('switches on the day the clocks do', () => {
    // 2026-03-26 is the last day of winter time; 2026-03-27 the first of summer.
    const winter = run('2026-03-26', '11:00', 240, ['mincha']);
    const summer = run('2026-03-27', '11:00', 240, ['mincha']);
    assert.equal(winter.upcoming.find((r) => r.synagogue === SEASONAL)?.clock, '12:30');
    // 2026-03-27 is a Friday, so the seasonal weekday Mincha is demoted rather
    // than resolved — but it is demoted as the SUMMER row, never as both.
    const rows = [
      ...summer.upcoming.filter((r) => r.synagogue === SEASONAL),
      ...summer.unconfirmed.filter((r) => r.synagogue === SEASONAL),
    ];
    assert.ok(rows.length <= 1, 'never both faces on one day');
  });
});

describe('what must never be in the timeline', () => {
  it('excludes rows that are not publishable', () => {
    const timeline = run('2026-08-25', '05:00', 300);
    assert.equal(timeline.upcoming.some((r) => r.synagogue === UNREVIEWED), false);
    assert.equal(timeline.unconfirmed.some((r) => r.synagogue === UNREVIEWED), false);
  });

  it('every upcoming row has a service — none is unattributed', () => {
    const timeline = run('2026-08-25', '05:00', 900);
    for (const row of timeline.upcoming) assert.ok(row.service);
    for (const row of timeline.unconfirmed) assert.ok(row.service);
  });

  it('filters by service when asked', () => {
    const timeline = run('2026-08-25', '05:00', 900, ['mincha']);
    for (const row of timeline.upcoming) assert.equal(row.service, 'mincha');
    for (const row of timeline.unconfirmed) assert.equal(row.service, 'mincha');
  });

  it('carries no shiurim: they are a different table and never reach this engine', () => {
    // Structural, not behavioural — `TimelineMinyan.service` is the Service
    // enum, and a shiur has no service. This asserts the shape stays that way.
    const timeline = run('2026-08-25', '05:00', 900);
    for (const row of timeline.upcoming) {
      assert.ok(['shacharit', 'mincha', 'arvit'].includes(row.service));
    }
  });
});

describe('Yom Tov is not a weekday and not a Shabbat', () => {
  it('does not publish the weekday Shacharit on Rosh Hashana', () => {
    // 2026-09-12 is 1 Tishrei 5787 — and a Saturday, so both columns are wrong.
    const timeline = run('2026-09-12', '05:00', 180, ['shacharit']);
    assert.equal(timeline.upcoming.length, 0, 'no clock time may be claimed on Yom Tov');
    assert.ok(
      timeline.unconfirmed.every((r) => r.reason.code === 'yom_tov_schedule_unknown'),
      timeline.unconfirmed.map((r) => r.reason.code).join(', '),
    );
  });

  it('names the festival so the page can say which one', () => {
    const timeline = run('2026-09-12', '05:00', 180, ['shacharit']);
    const row = timeline.unconfirmed[0];
    assert.ok(row);
    assert.equal(row.reason.code, 'yom_tov_schedule_unknown');
    if (row.reason.code === 'yom_tov_schedule_unknown') {
      assert.match(row.reason.yomTov, /Rosh Hashana/);
    }
  });
});

describe('midnight and the horizon crossing it', () => {
  it('a 40-minute question asked at 23:50 reaches into tomorrow', () => {
    const timeline = run('2026-08-25', '23:50', 480, ['shacharit']);
    assert.ok(timeline.upcoming.length > 0, 'tomorrow morning must be reachable');
    for (const row of timeline.upcoming) {
      assert.equal(row.date.day, 26, 'and it must be dated tomorrow, not today');
    }
  });

  it('does not resolve tomorrow morning against today zmanim', () => {
    const timeline = run('2026-08-25', '23:50', 480, ['shacharit']);
    const netzRow = timeline.upcoming.find((r) => r.basis.from === 'anchor');
    assert.ok(netzRow);
    const tomorrow = zmanimFor(TEL_AVIV, date('2026-08-26'));
    assert.equal(netzRow.instant.getTime(), tomorrow.netz.getTime());
  });
});
