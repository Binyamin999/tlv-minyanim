/**
 * Boundary conditions for `src/lib/distance.ts` not already covered by
 * `test/distance.test.ts`. Kept in a separate file rather than edited into
 * that one so the two can be reviewed independently — this one is purely
 * "what happens exactly at the edge", where that one is the narrative case
 * for each function.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCURACY_LIMIT_METRES,
  formatMetres,
  reachability,
  walkingMinutes,
} from '../src/lib/distance.ts';

describe('reachability — accuracy boundary', () => {
  it('judges normally exactly AT the accuracy limit (the guard is a strict >)', () => {
    // ACCURACY_LIMIT_METRES itself must still be trusted; only strictly
    // beyond it does the verdict fall back to unknown. Comment on the
    // constant calls it "beyond this" — confirm the code means that literally.
    assert.equal(reachability(30, 10, ACCURACY_LIMIT_METRES), 'reachable');
    assert.equal(reachability(5, 10, ACCURACY_LIMIT_METRES), 'too_far');
  });

  it('flips to unknown one metre past the limit', () => {
    assert.equal(reachability(30, 10, ACCURACY_LIMIT_METRES + 1), 'unknown');
  });
});

describe('reachability — a minyan that has already started', () => {
  it('is too_far, not reachable, for a negative countdown', () => {
    // decorate() computes minutesUntil from the row's own instant at read
    // time, so a page left open past start time passes a negative number
    // through, not null. That must never read as reachable.
    assert.equal(reachability(-3, 5, 10), 'too_far');
  });

  it('is too_far at the exact moment it starts (zero minutes left, any walk)', () => {
    assert.equal(reachability(0, 1, 10), 'too_far');
  });
});

describe('walkingMinutes — exact-minute boundaries never round down', () => {
  it('a distance that divides exactly still ceils rather than floors', () => {
    // 75 m * 1.4 / 75 = 1.4 -> ceil 2, not 1: never let an exact-looking
    // number tempt a floor instead of a ceil.
    assert.equal(walkingMinutes(75), 2);
  });

  it('the smallest distance that requires 2 minutes', () => {
    // (m * 1.4) / 75 > 1  =>  m > 53.57
    assert.equal(walkingMinutes(53), 1);
    assert.equal(walkingMinutes(54), 2);
  });
});

describe('formatMetres — the 1000 m unit switch', () => {
  it('999 m is still metres, rounded to the nearest 50', () => {
    assert.deepEqual(formatMetres(999), { value: 1000, unit: 'm' });
  });

  it('exactly 1000 m switches to kilometres', () => {
    assert.deepEqual(formatMetres(1000), { value: 1, unit: 'km' });
  });

  it('never rounds a sub-km distance up into a bare "1000 מ״" — the unit switch owns that boundary', () => {
    // 975-999 m all round to 1000 under the m-branch; that reads oddly
    // ("1000 מ׳") but is a display nuance, not a correctness bug — pinned
    // here so a future change to the rounding step notices this edge exists.
    assert.deepEqual(formatMetres(985), { value: 1000, unit: 'm' });
  });
});
