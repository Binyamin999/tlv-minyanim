/**
 * Wall-clock arithmetic in Asia/Jerusalem.
 *
 * These tests do not need a zmanim library and do not assert anything the
 * library told us. They assert that a clock face means the same thing on both
 * sides of a DST changeover, which is the property a stored `fixed` rule
 * depends on and the one nobody notices is broken until March.
 *
 * Everything here also runs identically whatever `TZ` the machine is set to.
 * That is deliberate: Vercel runs in UTC and the laptop does not.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays,
  clockFaceOf,
  dayOfWeek,
  instantOfClockTime,
  isoDate,
  jerusalemDateOf,
  jerusalemInstant,
  seasonAt,
  startOfJerusalemDay,
  zoneOffsetMs,
} from '../src/zmanim/index.ts';
import { DST_ENDS, DST_STARTS } from './fixtures.zmanim-ground-truth.ts';

const HOUR = 3_600_000;

function date(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

describe('the tz database, not our memory, says when Israel changes its clocks', () => {
  it('is on IST the day before the spring change and IDT on the day itself', () => {
    assert.equal(zoneOffsetMs(instantOfClockTime(date(DST_STARTS), '12:00')), 3 * HOUR);
    const before = addDays(date(DST_STARTS), -1);
    assert.equal(zoneOffsetMs(instantOfClockTime(before, '12:00')), 2 * HOUR);
  });

  it('is on IDT the day before the autumn change and IST on the day itself', () => {
    assert.equal(zoneOffsetMs(instantOfClockTime(date(DST_ENDS), '12:00')), 2 * HOUR);
    const before = addDays(date(DST_ENDS), -1);
    assert.equal(zoneOffsetMs(instantOfClockTime(before, '12:00')), 3 * HOUR);
  });

  it('maps ק / ח onto the clock change, which is the one-hour shift the source means', () => {
    assert.equal(seasonAt(instantOfClockTime(date(DST_STARTS), '12:00')), 'summer');
    assert.equal(seasonAt(instantOfClockTime(addDays(date(DST_STARTS), -1), '12:00')), 'winter');
    assert.equal(seasonAt(instantOfClockTime(date(DST_ENDS), '12:00')), 'winter');
    assert.equal(seasonAt(instantOfClockTime(addDays(date(DST_ENDS), -1), '12:00')), 'summer');
  });
});

describe('a DST transition must not move a minyan', () => {
  // The bug this guards: resolve a 06:30 shacharit by adding a constant offset
  // to midnight UTC. It works for ten months and then a whole city's minyanim
  // are an hour out for a morning, twice a year.
  for (const [label, day] of [
    ['clocks forward', DST_STARTS],
    ['clocks back', DST_ENDS],
  ] as const) {
    it(`${label}: 06:30 is 06:30 on the day, the day before and the day after`, () => {
      for (const offset of [-1, 0, 1]) {
        const d = addDays(date(day), offset);
        assert.equal(clockFaceOf(instantOfClockTime(d, '06:30')), '06:30', isoDate(d));
      }
    });

    it(`${label}: the day is 23 or 25 real hours long, and 06:30 sits inside it`, () => {
      const d = date(day);
      const length = startOfJerusalemDay(addDays(d, 1)).getTime() - startOfJerusalemDay(d).getTime();
      assert.equal(length, day === DST_STARTS ? 23 * HOUR : 25 * HOUR);

      const morning = instantOfClockTime(d, '06:30');
      assert.ok(morning.getTime() > startOfJerusalemDay(d).getTime());
      assert.ok(morning.getTime() < startOfJerusalemDay(addDays(d, 1)).getTime());
    });
  }

  it('06:30 on the spring day is 23 hours after 06:30 the day before, not 24', () => {
    const d = date(DST_STARTS);
    const gap =
      instantOfClockTime(d, '06:30').getTime() -
      instantOfClockTime(addDays(d, -1), '06:30').getTime();
    assert.equal(gap, 23 * HOUR);
  });

  it('06:30 on the autumn day is 25 hours after 06:30 the day before', () => {
    const d = date(DST_ENDS);
    const gap =
      instantOfClockTime(d, '06:30').getTime() -
      instantOfClockTime(addDays(d, -1), '06:30').getTime();
    assert.equal(gap, 25 * HOUR);
  });
});

describe('calendar squares are not instants', () => {
  it('round-trips a date through an instant and back', () => {
    for (const iso of ['2026-01-16', '2026-03-27', '2026-06-19', '2026-10-25', '2027-03-12']) {
      const d = date(iso);
      assert.equal(isoDate(jerusalemDateOf(instantOfClockTime(d, '00:00'))), iso);
      assert.equal(isoDate(jerusalemDateOf(instantOfClockTime(d, '23:59'))), iso);
    }
  });

  it('rolls month and year ends correctly', () => {
    assert.equal(isoDate(addDays(date('2026-01-31'), 1)), '2026-02-01');
    assert.equal(isoDate(addDays(date('2026-12-31'), 1)), '2027-01-01');
    assert.equal(isoDate(addDays(date('2028-02-28'), 1)), '2028-02-29');
    assert.equal(isoDate(addDays(date('2026-03-01'), -1)), '2026-02-28');
  });

  it('knows which day of the week a square is', () => {
    assert.equal(dayOfWeek(date('2026-08-28')), 5, 'Friday');
    assert.equal(dayOfWeek(date('2026-08-29')), 6, 'Saturday');
    assert.equal(dayOfWeek(date('2026-08-30')), 0, 'Sunday');
  });

  it('rejects anything that is not an HH:MM clock face', () => {
    assert.throws(() => instantOfClockTime(date('2026-08-26'), '6:30'));
    assert.throws(() => instantOfClockTime(date('2026-08-26'), '25:00'));
    assert.throws(() => instantOfClockTime(date('2026-08-26'), 'בזמן'));
  });

  it('is indifferent to the host timezone', () => {
    // TZ is read once per process by Intl, so this asserts the property that
    // makes that safe: nothing here consults the host's local Date fields.
    const noon = jerusalemInstant(date('2026-08-26'), 12, 0);
    assert.equal(noon.toISOString(), '2026-08-26T09:00:00.000Z');
    const winterNoon = jerusalemInstant(date('2026-01-16'), 12, 0);
    assert.equal(winterNoon.toISOString(), '2026-01-16T10:00:00.000Z');
  });
});
