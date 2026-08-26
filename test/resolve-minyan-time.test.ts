/**
 * Resolving a stored rule into an instant.
 *
 * The most important test in this file is the shortest one: `unknown` does not
 * resolve. Not to null, not to midnight, not to "probably shkia minus twenty
 * because the shul down the road does that". The type makes it impossible and
 * the test says so out loud, because the day someone "improves" this by
 * returning a Date is the day the product stops being trustworthy.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MinyanTime } from '../src/minyan-times/index.ts';
import {
  addDays,
  clockFaceOf,
  isResolved,
  resolveMinyanTime,
  TEL_AVIV,
  zmanimFor,
  type JerusalemDate,
} from '../src/zmanim/index.ts';
import { DST_ENDS, DST_STARTS } from './fixtures.zmanim-ground-truth.ts';

const MINUTE = 60_000;

function date(iso: string): JerusalemDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

const ORDINARY = date('2026-08-26');
const FRIDAY = date('2026-08-28');

describe('unknown never becomes a time', () => {
  const unknown: MinyanTime = { kind: 'unknown', rawText: 'בזמן' };

  it('resolves to an unresolved result, on every date we tried', () => {
    for (const iso of ['2026-01-16', '2026-06-19', '2026-08-26', '2026-08-28', '2027-03-12']) {
      const result = resolveMinyanTime(unknown, date(iso), TEL_AVIV);
      assert.equal(result.kind, 'unresolved', iso);
    }
  });

  it('names the reason and keeps the raw text verbatim', () => {
    const result = resolveMinyanTime(unknown, ORDINARY, TEL_AVIV);
    assert.deepEqual(result, {
      kind: 'unresolved',
      reason: { code: 'unknown_offset', rawText: 'בזמן' },
    });
  });

  it('carries no instant and no clock at all — not even a null one', () => {
    const result = resolveMinyanTime(unknown, ORDINARY, TEL_AVIV);
    // The type already forbids reading these. This asserts the runtime shape
    // matches, so a caller doing `('instant' in r)` cannot be surprised.
    assert.equal(Object.hasOwn(result, 'instant'), false);
    assert.equal(Object.hasOwn(result, 'clock'), false);
    assert.equal(isResolved(result), false);
  });
});

describe('a fixed rule is that clock face on that day, in Asia/Jerusalem', () => {
  it('resolves 06:30 to 06:30', () => {
    const result = resolveMinyanTime({ kind: 'fixed', time: '06:30' }, ORDINARY, TEL_AVIV);
    assert.ok(isResolved(result));
    assert.equal(result.clock, '06:30');
    assert.deepEqual(result.basis, { from: 'fixed' });
  });

  it('is still that clock face on both DST changeover days', () => {
    for (const iso of [DST_STARTS, DST_ENDS]) {
      for (const offset of [-1, 0, 1]) {
        const result = resolveMinyanTime(
          { kind: 'fixed', time: '13:30' },
          addDays(date(iso), offset),
          TEL_AVIV,
        );
        assert.ok(isResolved(result));
        assert.equal(result.clock, '13:30', `${iso} ${offset}`);
      }
    }
  });

  it('resolves a late-evening time without spilling into the next day', () => {
    const result = resolveMinyanTime({ kind: 'fixed', time: '23:45' }, ORDINARY, TEL_AVIV);
    assert.ok(isResolved(result));
    assert.equal(result.clock, '23:45');
    assert.equal(result.instant.toISOString(), '2026-08-26T20:45:00.000Z');
  });
});

describe('a relative rule is an offset from a real solar event', () => {
  it('shkia - 20 is exactly twenty minutes before that day shkia', () => {
    for (const iso of ['2026-01-16', '2026-06-19', '2026-08-26']) {
      const day = zmanimFor(TEL_AVIV, date(iso));
      const result = resolveMinyanTime(
        { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
        date(iso),
        TEL_AVIV,
      );
      assert.ok(isResolved(result));
      assert.equal((day.shkia.getTime() - result.instant.getTime()) / MINUTE, 20, iso);
    }
  });

  it('netz + 0 is netz itself', () => {
    const day = zmanimFor(TEL_AVIV, ORDINARY);
    const result = resolveMinyanTime(
      { kind: 'relative', anchor: 'netz', offsetMinutes: 0 },
      ORDINARY,
      TEL_AVIV,
    );
    assert.ok(isResolved(result));
    assert.equal(result.instant.getTime(), day.netz.getTime());
    assert.equal(result.clock, clockFaceOf(day.netz));
  });

  it('a positive offset is after, a negative offset is before', () => {
    const day = zmanimFor(TEL_AVIV, ORDINARY);
    const after = resolveMinyanTime(
      { kind: 'relative', anchor: 'tzeit', offsetMinutes: 15 },
      ORDINARY,
      TEL_AVIV,
    );
    assert.ok(isResolved(after));
    assert.equal((after.instant.getTime() - day.tzeit.getTime()) / MINUTE, 15);
  });

  it('reports the anchor it used, so the page can keep showing the rule', () => {
    const day = zmanimFor(TEL_AVIV, ORDINARY);
    const result = resolveMinyanTime(
      { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
      ORDINARY,
      TEL_AVIV,
    );
    assert.ok(isResolved(result));
    assert.deepEqual(result.basis, {
      from: 'anchor',
      anchor: 'shkia',
      anchorInstant: day.shkia,
      offsetMinutes: -20,
    });
  });

  it('follows the sun rather than the clock: the same rule moves across the year', () => {
    const winter = resolveMinyanTime(
      { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
      date('2026-01-16'),
      TEL_AVIV,
    );
    const summer = resolveMinyanTime(
      { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 },
      date('2026-06-19'),
      TEL_AVIV,
    );
    assert.ok(isResolved(winter) && isResolved(summer));
    assert.notEqual(winter.clock, summer.clock);
    // This is the whole argument for storing a rule instead of a time: one row
    // is correct on both dates, and a stored "16:39" would be nearly three
    // hours wrong in June.
  });
});

describe('candle lighting only exists on a day that has one', () => {
  it('resolves on Friday', () => {
    const day = zmanimFor(TEL_AVIV, FRIDAY);
    const result = resolveMinyanTime(
      { kind: 'relative', anchor: 'candle_lighting', offsetMinutes: -10 },
      FRIDAY,
      TEL_AVIV,
    );
    assert.ok(isResolved(result));
    assert.ok(day.candle_lighting);
    assert.equal((day.candle_lighting.getTime() - result.instant.getTime()) / MINUTE, 10);
  });

  it('does NOT resolve on a Wednesday — it says so instead of inventing one', () => {
    const result = resolveMinyanTime(
      { kind: 'relative', anchor: 'candle_lighting', offsetMinutes: -10 },
      ORDINARY,
      TEL_AVIV,
    );
    assert.deepEqual(result, {
      kind: 'unresolved',
      reason: { code: 'anchor_not_on_this_date', anchor: 'candle_lighting' },
    });
  });
});
